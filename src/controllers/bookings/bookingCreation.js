// src/controllers/bookings/bookingCreation.js - REFACTORED: Admin sub-day bookings + new pricing
const { Booking, Customer, Vehicle, Admin } = require("../../models");
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const asyncHandler = require("../../middleware/asyncHandler");
const ErrorResponse = require("../../utils/errorResponse");

// --- Import New Utility Functions ---
const {
  calculateChargedDaysWithLatenessRule,
  calculateRentalDaysWithTimeLogic, // Website legacy
  validateBookingDates, // Website validation (1-day min)
  validateAdminBookingDates, // Admin validation (sub-day OK)
  checkAdvancedAvailability,
} = require("../../utils/bookingUtils");

// @desc    Create new booking from website
// @route   POST /api/bookings/website
// @access  Public
exports.createWebsiteBooking = asyncHandler(async (req, res, next) => {
  // --- Validation ---
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error("Validation errors:", errors.array());
    return next(new ErrorResponse("Validation failed", 400, errors.array()));
  }

  const {
    vehicleId,
    pickupDate,
    returnDate,
    pickupTime,
    returnTime,
    pickupLocation,
    returnLocation,
    firstName,
    lastName,
    phone,
    email,
  } = req.body;

  console.log("Website booking request:", req.body);

  try {
    // Website validation: minimum 1 day enforced
    const dateValidation = validateBookingDates(
      pickupDate,
      returnDate,
      pickupTime,
      returnTime
    );
    if (!dateValidation.isValid) {
      return next(new ErrorResponse(dateValidation.error, 400));
    }

    // --- Vehicle Verification ---
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) {
      return next(new ErrorResponse("Vehicle not found", 404));
    }

    if (vehicle.status !== "active") {
      return next(new ErrorResponse("Vehicle is not active", 400));
    }

    // --- Availability Check ---
    const availabilityDetails = await Booking.getVehicleAvailabilityDetails(
      vehicleId,
      pickupDate,
      returnDate,
      pickupTime,
      returnTime
    );

    if (!availabilityDetails.isAvailable) {
      console.error("Vehicle availability conflict:", availabilityDetails);

      let errorMessage =
        "Vehicle is not available for the selected dates and times.";

      if (availabilityDetails.conflictingBookings.length > 0) {
        const conflictDetails = availabilityDetails.conflictingBookings
          .map(
            (booking) =>
              `${booking.bookingNumber} (${booking.pickupDate} to ${booking.returnDate})`
          )
          .join(", ");
        errorMessage += ` Conflicts: ${conflictDetails}.`;
      }

      return next(new ErrorResponse(errorMessage, 409));
    }

    // --- Pricing (Website uses legacy 1-day minimum) ---
    const totalDays = calculateRentalDaysWithTimeLogic(
      pickupDate,
      returnDate,
      pickupTime,
      returnTime
    );

    if (totalDays < 1) {
      return next(new ErrorResponse("Minimum rental period is 1 day", 400));
    }

    const totalAmount = parseFloat(vehicle.price) * totalDays;
    const bookingNumber = await Booking.generateBookingNumber();

    console.log("Website booking calculation (1-day min):", {
      bookingNumber,
      totalDays,
      totalAmount,
      dailyRate: vehicle.price,
    });

    // --- Customer Lookup/Creation ---
    let customer = await Customer.findOne({ where: { phone } });

    if (!customer && email) {
      customer = await Customer.findOne({ where: { email } });
    }

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

    // --- Persistence ---
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

    console.log("Website booking created:", {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      totalDays: booking.totalDays,
      totalAmount: booking.totalAmount,
    });

    // Fetch with associations
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
        duration: `${totalDays} day${totalDays > 1 ? "s" : ""}`,
        totalAmount: `€${totalAmount}`,
        dailyRate: `€${vehicle.price}/day`,
        minimumMet: totalDays >= 1,
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
  // --- Validation ---
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
    // Admin validation: sub-day bookings allowed (min 15 minutes)
    const dateValidation = validateAdminBookingDates(
      pickupDate,
      returnDate,
      pickupTime,
      returnTime,
      15 // configurable minimum duration in minutes
    );

    if (!dateValidation.isValid) {
      return next(new ErrorResponse(dateValidation.error, 400));
    }

    // --- Customer Verification ---
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return next(new ErrorResponse("Customer not found", 404));
    }
    if (customer.status !== "active") {
      return next(new ErrorResponse("Customer account is not active", 400));
    }

    // --- Vehicle Verification ---
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) {
      return next(new ErrorResponse("Vehicle not found", 404));
    }

    if (vehicle.status !== "active") {
      return next(new ErrorResponse("Vehicle is not active", 400));
    }

    // --- Availability Check ---
    const availabilityDetails = await Booking.getVehicleAvailabilityDetails(
      vehicleId,
      pickupDate,
      returnDate,
      pickupTime,
      returnTime
    );

    if (!availabilityDetails.isAvailable) {
      console.error("Vehicle availability conflict:", availabilityDetails);

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

      return next(new ErrorResponse(errorMessage, 400));
    }

    // --- Pricing (Charged Days with Lateness Rule) ---
    const pricingResult = calculateChargedDaysWithLatenessRule(
      pickupDate,
      returnDate,
      pickupTime,
      returnTime
    );

    const { fullDays, latenessMinutes, chargedDays, durationMinutes } =
      pricingResult;

    const totalAmount = parseFloat(vehicle.price) * chargedDays;
    const bookingNumber = await Booking.generateBookingNumber();

    console.log("Admin booking calculation (lateness rule):", {
      bookingNumber,
      durationMinutes,
      fullDays,
      latenessMinutes,
      chargedDays,
      totalAmount,
      dailyRate: vehicle.price,
      latenessFeeApplied: latenessMinutes >= 90,
    });

    // --- Persistence ---
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
      totalDays: chargedDays, // Store charged days
      totalAmount,
      createdById: req.admin.id,
      source: "admin",
      status: "confirmed", // Admin bookings auto-confirmed
      confirmedById: req.admin.id,
      confirmedAt: new Date(),
    });

    console.log("Admin booking created:", {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      durationMinutes: durationMinutes,
      chargedDays: chargedDays,
      totalAmount: totalAmount,
      latenessFeeApplied: latenessMinutes >= 90,
    });

    // Update customer and vehicle stats
    await customer.incrementBookings(booking.totalAmount);
    await vehicle.incrementBookings();

    // Make vehicle unavailable if booking starts today or in the past
    const today = new Date().toISOString().split("T")[0];
    if (pickupDate <= today) {
      await vehicle.update({ available: false });
    }

    // Fetch with associations
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
        durationMinutes: durationMinutes,
        durationHours: (durationMinutes / 60).toFixed(1),
        fullDays: fullDays,
        latenessMinutes: latenessMinutes,
        chargedDays: chargedDays,
        latenessFeeApplied: latenessMinutes >= 90,
        totalAmount: `€${totalAmount}`,
        dailyRate: `€${vehicle.price}/day`,
        autoConfirmed: true,
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
