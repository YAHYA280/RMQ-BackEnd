// src/controllers/bookings/bookingCreation.js - PART 2: Booking Creation Functions
const { Booking, Customer, Vehicle, Admin } = require("../../models");
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const asyncHandler = require("../../middleware/asyncHandler");
const ErrorResponse = require("../../utils/errorResponse");

// Import the helper function
const {
  calculateRentalDaysWithTimeLogic,
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
    // Verify vehicle exists and is active
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) {
      return next(new ErrorResponse("Vehicle not found", 404));
    }

    if (vehicle.status !== "active") {
      return next(new ErrorResponse("Vehicle is not active", 400));
    }

    // Check ACTUAL availability for the requested dates
    const isAvailable = await Booking.checkVehicleAvailability(
      vehicleId,
      pickupDate,
      returnDate
    );

    if (!isAvailable) {
      const conflictingBookings = await Booking.findAll({
        where: {
          vehicleId,
          status: ["confirmed", "active"],
          [Op.or]: [
            {
              pickupDate: {
                [Op.between]: [pickupDate, returnDate],
              },
            },
            {
              returnDate: {
                [Op.between]: [pickupDate, returnDate],
              },
            },
            {
              [Op.and]: [
                { pickupDate: { [Op.lte]: pickupDate } },
                { returnDate: { [Op.gte]: returnDate } },
              ],
            },
          ],
        },
        attributes: ["bookingNumber", "pickupDate", "returnDate"],
      });

      const conflictDetails = conflictingBookings
        .map(
          (booking) =>
            `${booking.bookingNumber} (${booking.pickupDate} to ${booking.returnDate})`
        )
        .join(", ");

      return next(
        new ErrorResponse(
          `Vehicle is not available for the selected dates. Conflicting with: ${conflictDetails}`,
          409
        )
      );
    }

    // Calculate required fields using your time logic
    const totalDays = calculateRentalDaysWithTimeLogic(
      pickupDate,
      returnDate,
      pickupTime,
      returnTime
    );
    const totalAmount = parseFloat(vehicle.price) * totalDays;

    // Generate booking number
    const bookingNumber = await Booking.generateBookingNumber();

    console.log("Calculated values with time logic:", {
      bookingNumber,
      totalDays,
      totalAmount,
      dailyRate: vehicle.price,
      requestedDates: { pickupDate, returnDate },
      requestedTimes: { pickupTime, returnTime },
      isAvailable,
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

  // Check ACTUAL availability for the requested dates
  const isAvailable = await Booking.checkVehicleAvailability(
    vehicleId,
    pickupDate,
    returnDate
  );

  if (!isAvailable) {
    return next(
      new ErrorResponse("Vehicle is not available for the selected dates", 400)
    );
  }

  // Calculate required fields using your time logic
  const totalDays = calculateRentalDaysWithTimeLogic(
    pickupDate,
    returnDate,
    pickupTime,
    returnTime
  );
  const totalAmount = parseFloat(vehicle.price) * totalDays;

  // Generate booking number
  const bookingNumber = await Booking.generateBookingNumber();

  console.log("Calculated values with time logic:", {
    bookingNumber,
    totalDays,
    totalAmount,
    dailyRate: vehicle.price,
    requestedTimes: { pickupTime, returnTime },
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
    status: "confirmed",
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
    contractAvailable: true,
    contractDownloadUrl: `/api/bookings/${booking.id}/contract`,
  });
});
