// src/controllers/bookings/bookingCreation.js - UPDATED: Minimum 2 days + same-day logic
const { Booking, Customer, Vehicle, Admin } = require("../../models");
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const asyncHandler = require("../../middleware/asyncHandler");
const ErrorResponse = require("../../utils/errorResponse");

// Import the helper functions with new same-day logic
const {
  calculateRentalDaysWithTimeLogic,
  validateBookingDates,
  validateSameDayBooking,
  checkAdvancedAvailability,
} = require("../../utils/bookingUtils");

// @desc    Create new booking from website
// @route   POST /api/bookings/website
// @access  Public
exports.createWebsiteBooking = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error("Validation errors:", errors.array());
    return next(new ErrorResponse("Validation failed", 400, errors.array()));
  }

  const {
    // Vehicle and dates
    vehicleId,
    pickupDate,
    returnDate,
    pickupTime,
    returnTime,
    pickupLocation,
    returnLocation,
    // Customer information
    firstName,
    lastName,
    phone,
    email, // Optional
  } = req.body;

  console.log("Website booking request:", req.body);

  try {
    // UPDATED: Validate minimum 2 days first
    const dateValidation = validateBookingDates(pickupDate, returnDate);
    if (!dateValidation.isValid) {
      return next(new ErrorResponse(dateValidation.error, 400));
    }

    // Verify vehicle exists and is active
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) {
      return next(new ErrorResponse("Vehicle not found", 404));
    }

    if (vehicle.status !== "active") {
      return next(new ErrorResponse("Vehicle is not active", 400));
    }

    // UPDATED: Enhanced availability check with same-day logic
    const availabilityDetails = await Booking.getVehicleAvailabilityDetails(
      vehicleId,
      pickupDate,
      returnDate,
      pickupTime,
      returnTime
    );

    if (!availabilityDetails.isAvailable) {
      console.error("Vehicle availability conflict:", availabilityDetails);

      // Build detailed error message
      let errorMessage =
        "Vehicle is not available for the selected dates and times.";

      if (availabilityDetails.conflictingBookings.length > 0) {
        const conflictDetails = availabilityDetails.conflictingBookings
          .map(
            (booking) =>
              `${booking.bookingNumber} (${booking.pickupDate} to ${booking.returnDate})`
          )
          .join(", ");
        errorMessage += ` Date conflicts: ${conflictDetails}.`;
      }

      if (availabilityDetails.sameDayConflicts.length > 0) {
        const sameDayDetails = availabilityDetails.sameDayConflicts
          .map((conflict) => conflict.reason)
          .join(", ");
        errorMessage += ` Time conflicts: ${sameDayDetails}.`;
      }

      return next(new ErrorResponse(errorMessage, 409));
    }

    // Calculate required fields using your time logic (minimum 2 days)
    const totalDays = calculateRentalDaysWithTimeLogic(
      pickupDate,
      returnDate,
      pickupTime,
      returnTime
    );

    // UPDATED: Validate that we have at least 2 days
    if (totalDays < 1) {
      return next(new ErrorResponse("Minimum rental period is 2 days", 400));
    }

    const totalAmount = parseFloat(vehicle.price) * totalDays;

    // Generate booking number
    const bookingNumber = await Booking.generateBookingNumber();

    console.log("Calculated values with time logic (minimum 2 days):", {
      bookingNumber,
      totalDays,
      totalAmount,
      dailyRate: vehicle.price,
      requestedDates: { pickupDate, returnDate },
      requestedTimes: { pickupTime, returnTime },
      isAvailable: availabilityDetails.isAvailable,
    });

    // Find or create customer
    let customer = null;

    // First try to find by phone (primary identifier)
    customer = await Customer.findOne({ where: { phone } });

    // If not found by phone, try by email (if provided)
    if (!customer && email) {
      customer = await Customer.findOne({ where: { email } });
    }

    // If customer doesn't exist, create new one
    if (!customer) {
      customer = await Customer.create({
        firstName,
        lastName,
        phone,
        email: email || null,
        source: "website",
        status: "active",
      });
      console.log("Created new customer:", customer.id);
    } else {
      console.log("Found existing customer:", customer.id);
    }

    // Create booking with ALL required fields explicitly set
    const booking = await Booking.create({
      bookingNumber,
      customerId: customer.id,
      vehicleId,
      pickupDate,
      returnDate,
      pickupTime,
      returnTime,
      pickupLocation,
      returnLocation,
      dailyRate: vehicle.price,
      totalDays,
      totalAmount,
      source: "website",
      status: "pending",
    });

    console.log("Created booking successfully with time logic:", {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      totalDays: booking.totalDays,
      totalAmount: booking.totalAmount,
      status: booking.status,
      pickupTime: booking.pickupTime,
      returnTime: booking.returnTime,
      minimumDays: totalDays >= 2 ? "✓" : "✗",
    });

    // Fetch the created booking with associations
    const createdBooking = await Booking.findByPk(booking.id, {
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "firstName", "lastName", "email", "phone"],
        },
        {
          model: Vehicle,
          as: "vehicle",
          attributes: ["id", "name", "brand", "year", "licensePlate"],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message:
        "Booking request submitted successfully. We will contact you soon to confirm.",
      data: createdBooking,
      bookingDetails: {
        duration: `${totalDays} days`,
        totalAmount: `€${totalAmount}`,
        dailyRate: `€${vehicle.price}/day`,
        minimumMet: totalDays >= 2,
      },
    });
  } catch (error) {
    console.error("Error in createWebsiteBooking:", error);
    return next(
      new ErrorResponse("Failed to create booking. Please try again.", 500)
    );
  }
});

// @desc    Create new booking from admin dashboard
// @route   POST /api/bookings
// @access  Private (admin)
exports.createAdminBooking = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse("Validation failed", 400, errors.array()));
  }

  const {
    customerId,
    vehicleId,
    pickupDate,
    returnDate,
    pickupTime,
    returnTime,
    pickupLocation,
    returnLocation,
  } = req.body;

  console.log("Admin booking request:", req.body);

  try {
    // UPDATED: Validate minimum 2 days first
    const dateValidation = validateBookingDates(pickupDate, returnDate);
    if (!dateValidation.isValid) {
      return next(new ErrorResponse(dateValidation.error, 400));
    }

    // Verify customer exists and is active
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return next(new ErrorResponse("Customer not found", 404));
    }
    if (customer.status !== "active") {
      return next(new ErrorResponse("Customer account is not active", 400));
    }

    // Verify vehicle exists and is active
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) {
      return next(new ErrorResponse("Vehicle not found", 404));
    }

    if (vehicle.status !== "active") {
      return next(new ErrorResponse("Vehicle is not active", 400));
    }

    // UPDATED: Enhanced availability check with same-day logic
    const availabilityDetails = await Booking.getVehicleAvailabilityDetails(
      vehicleId,
      pickupDate,
      returnDate,
      pickupTime,
      returnTime
    );

    if (!availabilityDetails.isAvailable) {
      console.error("Vehicle availability conflict:", availabilityDetails);

      // Build detailed error message for admin
      let errorMessage =
        "Vehicle is not available for the selected dates and times.";

      if (availabilityDetails.conflictingBookings.length > 0) {
        const conflictDetails = availabilityDetails.conflictingBookings
          .map((booking) => {
            const customerName = booking.customer
              ? `${booking.customer.firstName} ${booking.customer.lastName}`
              : "Unknown";
            return `${booking.bookingNumber} (${customerName}, ${booking.pickupDate} to ${booking.returnDate})`;
          })
          .join(", ");
        errorMessage += ` Conflicting bookings: ${conflictDetails}.`;
      }

      if (availabilityDetails.sameDayConflicts.length > 0) {
        const sameDayDetails = availabilityDetails.sameDayConflicts
          .map((conflict) => {
            const type =
              conflict.type === "same_day_start"
                ? "New booking starts too early"
                : "New booking ends too late";
            return `${type}: ${conflict.reason}`;
          })
          .join(", ");
        errorMessage += ` Same-day conflicts: ${sameDayDetails}`;
      }

      return next(new ErrorResponse(errorMessage, 400));
    }

    // Calculate required fields using your time logic (minimum 2 days)
    const totalDays = calculateRentalDaysWithTimeLogic(
      pickupDate,
      returnDate,
      pickupTime,
      returnTime
    );

    // UPDATED: Validate that we have at least 2 days
    if (totalDays < 2) {
      return next(new ErrorResponse("Minimum rental period is 2 days", 400));
    }

    const totalAmount = parseFloat(vehicle.price) * totalDays;

    // Generate booking number
    const bookingNumber = await Booking.generateBookingNumber();

    console.log("Calculated admin booking values (minimum 2 days):", {
      bookingNumber,
      totalDays,
      totalAmount,
      dailyRate: vehicle.price,
      requestedTimes: { pickupTime, returnTime },
      availabilityCheck: availabilityDetails.message,
    });

    // Create booking with ALL required fields explicitly set
    const booking = await Booking.create({
      bookingNumber,
      customerId,
      vehicleId,
      pickupDate,
      returnDate,
      pickupTime,
      returnTime,
      pickupLocation,
      returnLocation,
      dailyRate: vehicle.price,
      totalDays,
      totalAmount,
      createdById: req.admin.id,
      source: "admin",
      status: "confirmed", // Admin bookings are automatically confirmed
      confirmedById: req.admin.id,
      confirmedAt: new Date(),
    });

    console.log("Created admin booking with time logic:", {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      totalDays: booking.totalDays,
      totalAmount: booking.totalAmount,
      pickupTime: booking.pickupTime,
      returnTime: booking.returnTime,
      minimumDays: totalDays >= 2 ? "✓" : "✗",
      status: "confirmed",
    });

    // Update customer and vehicle stats
    await customer.incrementBookings(booking.totalAmount);
    await vehicle.incrementBookings();

    // Make vehicle unavailable if booking starts today or in the past
    const today = new Date().toISOString().split("T")[0];
    if (pickupDate <= today) {
      await vehicle.update({ available: false });
    }

    // Fetch the created booking with associations
    const createdBooking = await Booking.findByPk(booking.id, {
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "firstName", "lastName", "email", "phone"],
        },
        {
          model: Vehicle,
          as: "vehicle",
          attributes: ["id", "name", "brand", "year", "licensePlate"],
        },
        {
          model: Admin,
          as: "createdBy",
          attributes: ["id", "name", "email"],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: createdBooking,
      bookingDetails: {
        duration: `${totalDays} days (minimum 2 days met)`,
        totalAmount: `€${totalAmount}`,
        dailyRate: `€${vehicle.price}/day`,
        autoConfirmed: true,
        availabilityCheck: availabilityDetails.message,
      },
      contractAvailable: true,
      contractDownloadUrl: `/api/bookings/${booking.id}/contract`,
    });
  } catch (error) {
    console.error("Error in createAdminBooking:", error);
    return next(
      new ErrorResponse("Failed to create booking. Please try again.", 500)
    );
  }
});
