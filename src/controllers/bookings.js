// src/controllers/bookings.js - Updated for website and admin bookings
const { Booking, Customer, Vehicle, Admin } = require("../models");
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const asyncHandler = require("../middleware/asyncHandler");
const ErrorResponse = require("../utils/errorResponse");

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

  // Verify vehicle exists and is available
  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle) {
    return next(new ErrorResponse("Vehicle not found", 404));
  }
  if (!vehicle.available || vehicle.status !== "active") {
    return next(new ErrorResponse("Vehicle is not available", 400));
  }

  // Check vehicle availability for the requested dates
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

  // FIXED: Calculate required fields BEFORE creating booking
  const pickup = new Date(pickupDate);
  const returnD = new Date(returnDate);
  const diffTime = Math.abs(returnD.getTime() - pickup.getTime());
  const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const totalAmount = parseFloat(vehicle.price) * totalDays;

  // FIXED: Generate booking number BEFORE creating booking
  const bookingNumber = await Booking.generateBookingNumber();

  console.log("Calculated values:", {
    bookingNumber,
    totalDays,
    totalAmount,
    dailyRate: vehicle.price,
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
      email: email || null, // Email is optional
      source: "website",
      status: "active",
    });
    console.log("Created new customer:", customer.id);
  } else {
    console.log("Found existing customer:", customer.id);
  }

  // FIXED: Create booking with ALL required fields explicitly set
  const booking = await Booking.create({
    bookingNumber, // FIXED: Explicitly provided
    customerId: customer.id,
    vehicleId,
    pickupDate,
    returnDate,
    pickupTime,
    returnTime,
    pickupLocation,
    returnLocation,
    dailyRate: vehicle.price,
    totalDays, // FIXED: Explicitly calculated
    totalAmount, // FIXED: Explicitly calculated
    source: "website",
    status: "pending", // Website bookings start as pending
  });

  console.log("Created booking:", {
    id: booking.id,
    bookingNumber: booking.bookingNumber,
    totalDays: booking.totalDays,
    totalAmount: booking.totalAmount,
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

  // Verify vehicle exists and is available
  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle) {
    return next(new ErrorResponse("Vehicle not found", 404));
  }
  if (!vehicle.available || vehicle.status !== "active") {
    return next(new ErrorResponse("Vehicle is not available", 400));
  }

  // Check vehicle availability for the requested dates
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

  // FIXED: Calculate required fields BEFORE creating booking
  const pickup = new Date(pickupDate);
  const returnD = new Date(returnDate);
  const diffTime = Math.abs(returnD.getTime() - pickup.getTime());
  const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const totalAmount = parseFloat(vehicle.price) * totalDays;

  // FIXED: Generate booking number BEFORE creating booking
  const bookingNumber = await Booking.generateBookingNumber();

  console.log("Calculated values:", {
    bookingNumber,
    totalDays,
    totalAmount,
    dailyRate: vehicle.price,
  });

  // FIXED: Create booking with ALL required fields explicitly set
  const booking = await Booking.create({
    bookingNumber, // FIXED: Explicitly provided
    customerId,
    vehicleId,
    pickupDate,
    returnDate,
    pickupTime,
    returnTime,
    pickupLocation,
    returnLocation,
    dailyRate: vehicle.price,
    totalDays, // FIXED: Explicitly calculated
    totalAmount, // FIXED: Explicitly calculated
    createdById: req.admin.id,
    source: "admin",
    status: "confirmed", // Admin bookings are auto-confirmed
    confirmedById: req.admin.id,
    confirmedAt: new Date(),
  });

  console.log("Created admin booking:", {
    id: booking.id,
    bookingNumber: booking.bookingNumber,
    totalDays: booking.totalDays,
    totalAmount: booking.totalAmount,
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

  // Verify vehicle is still available
  const isAvailable = await Booking.checkVehicleAvailability(
    booking.vehicleId,
    booking.pickupDate,
    booking.returnDate,
    booking.id
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

  // Update customer and vehicle stats if not already done
  const customer = await Customer.findByPk(booking.customerId);
  const vehicle = await Vehicle.findByPk(booking.vehicleId);

  await customer.incrementBookings(booking.totalAmount);
  await vehicle.incrementBookings();

  // Make vehicle unavailable if booking starts today or in the past
  const today = new Date().toISOString().split("T")[0];
  if (booking.pickupDate <= today) {
    await vehicle.update({ available: false });
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

  // Make vehicle available again
  const vehicle = await Vehicle.findByPk(booking.vehicleId);
  await vehicle.update({ available: true });

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
  const stats = await Booking.getBookingStats();

  // Get monthly booking trends (last 12 months)
  const { sequelize } = require("../config/database");

  const monthlyTrends = await Booking.findAll({
    attributes: [
      [
        sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt")),
        "month",
      ],
      [sequelize.fn("COUNT", sequelize.col("id")), "bookings"],
      [sequelize.fn("SUM", sequelize.col("totalAmount")), "revenue"],
    ],
    where: {
      createdAt: {
        [Op.gte]: new Date(new Date().setMonth(new Date().getMonth() - 12)),
      },
    },
    group: [sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt"))],
    order: [
      [sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt")), "DESC"],
    ],
    raw: true,
  });

  res.status(200).json({
    success: true,
    data: {
      overview: stats,
      monthlyTrends,
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
