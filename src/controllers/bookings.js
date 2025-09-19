// src/controllers/bookings.js - Updated for website and admin bookings
const { Booking, Customer, Vehicle, Admin } = require("../models");
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const asyncHandler = require("../middleware/asyncHandler");
const ErrorResponse = require("../utils/errorResponse");
const calculateRentalDaysWithTimeLogic = (
  pickupDate,
  returnDate,
  pickupTime,
  returnTime
) => {
  // Calculate basic day difference
  const pickupDateObj = new Date(pickupDate);
  const returnDateObj = new Date(returnDate);
  const basicDays = Math.ceil(
    (returnDateObj.getTime() - pickupDateObj.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Convert times to minutes for easier comparison
  const [pickupHour, pickupMin] = pickupTime.split(":").map(Number);
  const [returnHour, returnMin] = returnTime.split(":").map(Number);

  const pickupMinutes = pickupHour * 60 + pickupMin;
  const returnMinutes = returnHour * 60 + returnMin;

  // Your logic: if return time is more than 1 hour after pickup time, add 1 day
  const timeDifference = returnMinutes - pickupMinutes;
  const oneHourInMinutes = 60;

  let rentalDays = basicDays;

  // If return time exceeds pickup time by more than 1 hour, add extra day
  if (timeDifference > oneHourInMinutes) {
    rentalDays += 1;
  }

  return Math.max(1, rentalDays);
};

// @desc    Get all bookings with filtering and pagination
// @route   GET /api/bookings
// @access  Private (admin)
exports.getBookings = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 25,
    search,
    status,
    sort = "createdAt",
    order = "DESC",
    source,
    customerId,
    vehicleId,
    dateFrom,
    dateTo,
  } = req.query;

  // Build where clause
  const where = {};

  if (status) {
    where.status = Array.isArray(status) ? { [Op.in]: status } : status;
  }

  if (source) {
    where.source = Array.isArray(source) ? { [Op.in]: source } : source;
  }

  if (customerId) {
    where.customerId = customerId;
  }

  if (vehicleId) {
    where.vehicleId = vehicleId;
  }

  // Date filtering
  if (dateFrom || dateTo) {
    where.pickupDate = {};
    if (dateFrom) where.pickupDate[Op.gte] = dateFrom;
    if (dateTo) where.pickupDate[Op.lte] = dateTo;
  }

  // Search functionality
  if (search) {
    where[Op.or] = [
      { bookingNumber: { [Op.iLike]: `%${search}%` } },
      { "$customer.firstName$": { [Op.iLike]: `%${search}%` } },
      { "$customer.lastName$": { [Op.iLike]: `%${search}%` } },
      { "$customer.email$": { [Op.iLike]: `%${search}%` } },
      { "$vehicle.name$": { [Op.iLike]: `%${search}%` } },
      { "$vehicle.licensePlate$": { [Op.iLike]: `%${search}%` } },
    ];
  }

  // Pagination
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  // Execute query
  const { count, rows: bookings } = await Booking.findAndCountAll({
    where,
    limit: limitNum,
    offset,
    order: [[sort, order]],
    include: [
      {
        model: Customer,
        as: "customer",
        attributes: ["id", "firstName", "lastName", "email", "phone"],
      },
      {
        model: Vehicle,
        as: "vehicle",
        attributes: [
          "id",
          "name",
          "brand",
          "year",
          "licensePlate",
          "whatsappNumber",
        ],
      },
      {
        model: Admin,
        as: "createdBy",
        attributes: ["id", "name", "email"],
      },
      {
        model: Admin,
        as: "confirmedBy",
        attributes: ["id", "name", "email"],
      },
    ],
  });

  // Build pagination result
  const pagination = {};
  const totalPages = Math.ceil(count / limitNum);

  if (pageNum < totalPages) {
    pagination.next = { page: pageNum + 1, limit: limitNum };
  }

  if (pageNum > 1) {
    pagination.prev = { page: pageNum - 1, limit: limitNum };
  }

  pagination.current = pageNum;
  pagination.totalPages = totalPages;

  res.status(200).json({
    success: true,
    count: bookings.length,
    total: count,
    pagination,
    data: bookings,
  });
});

// @desc    Get single booking
// @route   GET /api/bookings/:id
// @access  Private (admin)
exports.getBooking = asyncHandler(async (req, res, next) => {
  const booking = await Booking.findByPk(req.params.id, {
    include: [
      {
        model: Customer,
        as: "customer",
        attributes: [
          "id",
          "firstName",
          "lastName",
          "email",
          "phone",
          "driverLicenseImageData",
          "driverLicenseImageMimetype",
          "driverLicenseImageName",
        ],
      },
      {
        model: Vehicle,
        as: "vehicle",
        attributes: [
          "id",
          "name",
          "brand",
          "year",
          "licensePlate",
          "whatsappNumber",
          "mainImageData",
          "mainImageMimetype",
          "features",
        ],
      },
      {
        model: Admin,
        as: "createdBy",
        attributes: ["id", "name", "email"],
      },
      {
        model: Admin,
        as: "confirmedBy",
        attributes: ["id", "name", "email"],
      },
      {
        model: Admin,
        as: "cancelledBy",
        attributes: ["id", "name", "email"],
      },
    ],
  });

  if (!booking) {
    return next(new ErrorResponse("Booking not found", 404));
  }

  res.status(200).json({
    success: true,
    data: booking,
  });
});

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

    // UPDATED: Calculate required fields using your time logic
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

  // UPDATED: Calculate required fields using your time logic
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
  });
});

// @desc    Update booking
// @route   PUT /api/bookings/:id
// @access  Private (admin)
exports.updateBooking = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse("Validation failed", 400, errors.array()));
  }

  let booking = await Booking.findByPk(req.params.id);

  if (!booking) {
    return next(new ErrorResponse("Booking not found", 404));
  }

  // Prevent updating completed or cancelled bookings
  if (["completed", "cancelled"].includes(booking.status)) {
    return next(
      new ErrorResponse("Cannot update completed or cancelled bookings", 400)
    );
  }

  // If dates are being changed, check vehicle availability
  if (req.body.pickupDate || req.body.returnDate) {
    const newPickupDate = req.body.pickupDate || booking.pickupDate;
    const newReturnDate = req.body.returnDate || booking.returnDate;

    const isAvailable = await Booking.checkVehicleAvailability(
      booking.vehicleId,
      newPickupDate,
      newReturnDate,
      booking.id
    );

    if (!isAvailable) {
      return next(
        new ErrorResponse("Vehicle is not available for the updated dates", 400)
      );
    }
  }

  // Update booking
  await booking.update(req.body);

  // Fetch updated booking with associations
  const updatedBooking = await Booking.findByPk(req.params.id, {
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

  res.status(200).json({
    success: true,
    message: "Booking updated successfully",
    data: updatedBooking,
  });
});

// @desc    Delete booking
// @route   DELETE /api/bookings/:id
// @access  Private (super-admin only)
exports.deleteBooking = asyncHandler(async (req, res, next) => {
  const booking = await Booking.findByPk(req.params.id);

  if (!booking) {
    return next(new ErrorResponse("Booking not found", 404));
  }

  // Only allow deletion of pending or cancelled bookings
  if (!["pending", "cancelled"].includes(booking.status)) {
    return next(
      new ErrorResponse(
        "Only pending or cancelled bookings can be deleted",
        400
      )
    );
  }

  await booking.destroy();

  res.status(200).json({
    success: true,
    message: "Booking deleted successfully",
    data: {},
  });
});

// @desc    Confirm booking
// @route   PUT /api/bookings/:id/confirm
// @access  Private (admin)
exports.confirmBooking = asyncHandler(async (req, res, next) => {
  const booking = await Booking.findByPk(req.params.id);

  if (!booking) {
    return next(new ErrorResponse("Booking not found", 404));
  }

  if (booking.status !== "pending") {
    return next(
      new ErrorResponse("Only pending bookings can be confirmed", 400)
    );
  }

  // Verify vehicle is still available for these dates
  const isAvailable = await Booking.checkVehicleAvailability(
    booking.vehicleId,
    booking.pickupDate,
    booking.returnDate,
    booking.id // Exclude current booking from check
  );

  if (!isAvailable) {
    return next(
      new ErrorResponse(
        "Vehicle is no longer available for the selected dates",
        400
      )
    );
  }

  await booking.update({
    status: "confirmed",
    confirmedById: req.admin.id,
    confirmedAt: new Date(),
  });

  // Update customer and vehicle stats
  const customer = await Customer.findByPk(booking.customerId);
  const vehicle = await Vehicle.findByPk(booking.vehicleId);

  await customer.incrementBookings(booking.totalAmount);
  await vehicle.incrementBookings();

  // FIXED: Only make vehicle unavailable if booking starts today or in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pickupDate = new Date(booking.pickupDate);
  pickupDate.setHours(0, 0, 0, 0);

  if (pickupDate <= today) {
    await vehicle.update({ available: false });
    console.log(
      "Vehicle marked as unavailable because booking starts today or earlier"
    );
  } else {
    console.log(
      "Vehicle remains available because booking starts in the future"
    );
  }

  res.status(200).json({
    success: true,
    message: "Booking confirmed successfully",
    data: booking,
  });
});

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private (admin)
exports.cancelBooking = asyncHandler(async (req, res, next) => {
  const { cancellationReason } = req.body;
  const booking = await Booking.findByPk(req.params.id);

  if (!booking) {
    return next(new ErrorResponse("Booking not found", 404));
  }

  if (!booking.canBeCancelled()) {
    return next(new ErrorResponse("This booking cannot be cancelled", 400));
  }

  await booking.update({
    status: "cancelled",
    cancelledById: req.admin.id,
    cancelledAt: new Date(),
    cancellationReason: cancellationReason || "Cancelled by admin",
  });

  // Make vehicle available again
  const vehicle = await Vehicle.findByPk(booking.vehicleId);
  await vehicle.update({ available: true });

  res.status(200).json({
    success: true,
    message: "Booking cancelled successfully",
    data: booking,
  });
});

// @desc    Mark booking as active (vehicle picked up)
// @route   PUT /api/bookings/:id/pickup
// @access  Private (admin)
exports.markAsPickedUp = asyncHandler(async (req, res, next) => {
  const booking = await Booking.findByPk(req.params.id);

  if (!booking) {
    return next(new ErrorResponse("Booking not found", 404));
  }

  if (booking.status !== "confirmed") {
    return next(
      new ErrorResponse("Only confirmed bookings can be picked up", 400)
    );
  }

  await booking.update({
    status: "active",
  });

  // Make vehicle unavailable
  const vehicle = await Vehicle.findByPk(booking.vehicleId);
  await vehicle.update({ available: false });

  res.status(200).json({
    success: true,
    message: "Booking marked as active (vehicle picked up)",
    data: booking,
  });
});

// @desc    Complete booking (vehicle returned)
// @route   PUT /api/bookings/:id/return
// @access  Private (admin)
exports.completeBooking = asyncHandler(async (req, res, next) => {
  const booking = await Booking.findByPk(req.params.id);

  if (!booking) {
    return next(new ErrorResponse("Booking not found", 404));
  }

  if (booking.status !== "active") {
    return next(
      new ErrorResponse("Only active bookings can be completed", 400)
    );
  }

  await booking.update({
    status: "completed",
  });

  // FIXED: Always make vehicle available again when booking is completed
  const vehicle = await Vehicle.findByPk(booking.vehicleId);
  await vehicle.update({ available: true });
  console.log("Vehicle marked as available because booking is completed");

  res.status(200).json({
    success: true,
    message: "Booking completed successfully",
    data: booking,
  });
});

// @desc    Get booking statistics
// @route   GET /api/bookings/stats
// @access  Private (admin)
exports.getBookingStats = asyncHandler(async (req, res, next) => {
  // SIMPLIFIED: Only get the 4 stats you requested
  const { sequelize } = require("../config/database");

  const stats = await Booking.findAll({
    attributes: [
      [sequelize.fn("COUNT", sequelize.col("id")), "totalBookings"],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN status = 'pending' THEN 1 END")
        ),
        "pendingBookings",
      ],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN status = 'active' THEN 1 END")
        ),
        "activeBookings",
      ],
      [sequelize.fn("SUM", sequelize.col("totalAmount")), "totalRevenue"],
    ],
    raw: true,
  });

  // Convert strings to numbers and handle null values
  const result = stats[0];
  const transformedStats = {
    totalBookings: parseInt(result.totalBookings) || 0,
    pendingBookings: parseInt(result.pendingBookings) || 0,
    activeBookings: parseInt(result.activeBookings) || 0,
    totalRevenue: parseFloat(result.totalRevenue) || 0,
  };

  console.log("Booking stats result:", transformedStats); // Debug log

  res.status(200).json({
    success: true,
    data: {
      overview: transformedStats,
    },
  });
});

// @desc    Check vehicle availability
// @route   GET /api/bookings/availability/:vehicleId
// @access  Private (admin)
exports.checkAvailability = asyncHandler(async (req, res, next) => {
  const { vehicleId } = req.params;
  const { pickupDate, returnDate } = req.query;

  if (!pickupDate || !returnDate) {
    return next(
      new ErrorResponse("Pickup date and return date are required", 400)
    );
  }

  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle) {
    return next(new ErrorResponse("Vehicle not found", 404));
  }

  const isAvailable = await Booking.checkVehicleAvailability(
    vehicleId,
    pickupDate,
    returnDate
  );

  // Get conflicting bookings if not available
  let conflictingBookings = [];
  if (!isAvailable) {
    conflictingBookings = await Booking.findAll({
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
      attributes: ["id", "bookingNumber", "pickupDate", "returnDate", "status"],
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["firstName", "lastName"],
        },
      ],
    });
  }

  res.status(200).json({
    success: true,
    data: {
      vehicleId,
      available: isAvailable,
      searchDates: { pickupDate, returnDate },
      conflictingBookings,
    },
  });
});

// @desc    Get customer booking history
// @route   GET /api/bookings/customer/:customerId
// @access  Private (admin)
exports.getCustomerBookings = asyncHandler(async (req, res, next) => {
  const { customerId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const customer = await Customer.findByPk(customerId);
  if (!customer) {
    return next(new ErrorResponse("Customer not found", 404));
  }

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const { count, rows: bookings } = await Booking.findAndCountAll({
    where: { customerId },
    limit: limitNum,
    offset,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: Vehicle,
        as: "vehicle",
        attributes: ["id", "name", "brand", "year", "licensePlate"],
      },
    ],
  });

  res.status(200).json({
    success: true,
    count: bookings.length,
    total: count,
    data: bookings,
  });
});
// @desc    Get vehicle availability calendar (blocked dates)
// @route   GET /api/bookings/calendar/:vehicleId
// @access  Public
exports.getVehicleCalendar = asyncHandler(async (req, res, next) => {
  const { vehicleId } = req.params;
  const { startDate, endDate } = req.query;

  console.log(
    "Getting calendar for vehicle:",
    vehicleId,
    "from",
    startDate,
    "to",
    endDate
  );

  // Default to next 90 days if no dates provided
  const today = new Date();
  const start = startDate ? new Date(startDate) : today;
  const end = endDate
    ? new Date(endDate)
    : new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle) {
    return next(new ErrorResponse("Vehicle not found", 404));
  }

  // Get all confirmed/active bookings for this vehicle in the date range
  const bookings = await Booking.findAll({
    where: {
      vehicleId,
      status: ["confirmed", "active"],
      [Op.or]: [
        {
          pickupDate: {
            [Op.between]: [
              start.toISOString().split("T")[0],
              end.toISOString().split("T")[0],
            ],
          },
        },
        {
          returnDate: {
            [Op.between]: [
              start.toISOString().split("T")[0],
              end.toISOString().split("T")[0],
            ],
          },
        },
        {
          [Op.and]: [
            { pickupDate: { [Op.lte]: start.toISOString().split("T")[0] } },
            { returnDate: { [Op.gte]: end.toISOString().split("T")[0] } },
          ],
        },
      ],
    },
    attributes: ["id", "bookingNumber", "pickupDate", "returnDate", "status"],
    include: [
      {
        model: Customer,
        as: "customer",
        attributes: ["firstName", "lastName"],
      },
    ],
    order: [["pickupDate", "ASC"]],
  });

  console.log("Found bookings:", bookings.length);

  // Generate array of blocked dates and booking periods
  const blockedDates = [];
  const bookedPeriods = [];

  bookings.forEach((booking) => {
    const pickup = new Date(booking.pickupDate);
    const returnDate = new Date(booking.returnDate);

    console.log(
      "Processing booking:",
      booking.bookingNumber,
      "from",
      booking.pickupDate,
      "to",
      booking.returnDate
    );

    // Add booking period info
    bookedPeriods.push({
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      pickupDate: booking.pickupDate,
      returnDate: booking.returnDate,
      status: booking.status,
      customerName: booking.customer
        ? `${booking.customer.firstName} ${booking.customer.lastName}`
        : "Unknown Customer",
    });

    // Generate all dates in the booking range (inclusive)
    const currentDate = new Date(pickup);
    while (currentDate <= returnDate) {
      const dateStr = currentDate.toISOString().split("T")[0];
      blockedDates.push(dateStr);
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });

  // Remove duplicates from blocked dates
  const uniqueBlockedDates = [...new Set(blockedDates)];
  console.log("Blocked dates:", uniqueBlockedDates);

  // Determine current availability status
  const todayStr = today.toISOString().split("T")[0];

  // Find current booking (if vehicle is currently rented)
  const currentBooking = bookedPeriods.find(
    (period) => todayStr >= period.pickupDate && todayStr <= period.returnDate
  );

  // Find upcoming booking (next booking after today)
  const upcomingBooking = bookedPeriods
    .filter((period) => period.pickupDate > todayStr)
    .sort(
      (a, b) =>
        new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime()
    )[0];

  // Determine if currently available
  const isCurrentlyAvailable = !currentBooking;

  // Calculate next available date
  let nextAvailableDate = null;
  if (currentBooking) {
    const returnDate = new Date(currentBooking.returnDate);
    returnDate.setDate(returnDate.getDate() + 1);
    nextAvailableDate = returnDate.toISOString().split("T")[0];
  }

  console.log("Current booking:", currentBooking);
  console.log("Upcoming booking:", upcomingBooking);
  console.log("Is currently available:", isCurrentlyAvailable);
  console.log("Next available:", nextAvailableDate);

  res.status(200).json({
    success: true,
    data: {
      vehicleId,
      available: isCurrentlyAvailable,
      currentBooking: currentBooking || null,
      upcomingBooking: upcomingBooking || null,
      nextAvailableDate,
      blockedDates: uniqueBlockedDates,
      bookedPeriods,
      searchPeriod: {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      },
    },
  });
});
