// src/controllers/bookings.js - Complete implementation
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
    paymentStatus,
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

  if (paymentStatus) {
    where.paymentStatus = paymentStatus;
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
          "model",
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
          "driverLicenseImage",
        ],
      },
      {
        model: Vehicle,
        as: "vehicle",
        attributes: [
          "id",
          "name",
          "brand",
          "model",
          "year",
          "licensePlate",
          "whatsappNumber",
          "mainImage",
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

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private (admin)
exports.createBooking = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse("Validation failed", 400, errors.array()));
  }

  const { customerId, vehicleId, pickupDate, returnDate } = req.body;

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

  // Set booking details
  req.body.createdById = req.admin.id;
  req.body.source = "admin";
  req.body.status = "confirmed"; // Admin bookings are auto-confirmed
  req.body.dailyRate = vehicle.price;
  req.body.cautionAmount = vehicle.caution;

  // Calculate tax (10% for Morocco)
  const subtotal = parseFloat(vehicle.price) * req.body.totalDays;
  req.body.taxAmount = Math.round(subtotal * 0.1 * 100) / 100;

  // Create booking
  const booking = await Booking.create(req.body);

  // Update customer and vehicle stats
  await customer.incrementBookings(booking.totalAmount);
  await vehicle.incrementBookings();

  // Make vehicle temporarily unavailable if booking is active
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
        attributes: ["id", "name", "brand", "model", "licensePlate"],
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
        attributes: ["id", "name", "brand", "model", "licensePlate"],
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
  const { pickupCondition } = req.body;
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
    pickupCondition: pickupCondition || null,
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
  const { returnCondition, customerRating, customerFeedback } = req.body;
  const booking = await Booking.findByPk(req.params.id);

  if (!booking) {
    return next(new ErrorResponse("Booking not found", 404));
  }

  if (booking.status !== "active") {
    return next(
      new ErrorResponse("Only active bookings can be completed", 400)
    );
  }

  const updateData = {
    status: "completed",
    returnCondition: returnCondition || null,
  };

  if (customerRating) {
    updateData.customerRating = customerRating;
  }

  if (customerFeedback) {
    updateData.customerFeedback = customerFeedback;
  }

  await booking.update(updateData);

  // Make vehicle available again
  const vehicle = await Vehicle.findByPk(booking.vehicleId);
  await vehicle.update({ available: true });

  // Update vehicle rating if customer provided rating
  if (customerRating) {
    await vehicle.updateRating(customerRating);
  }

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

  // Get popular vehicles
  const popularVehicles = await Booking.findAll({
    attributes: [[sequelize.fn("COUNT", sequelize.col("id")), "bookingCount"]],
    include: [
      {
        model: Vehicle,
        as: "vehicle",
        attributes: ["id", "name", "brand", "model", "licensePlate"],
      },
    ],
    group: [
      "vehicle.id",
      "vehicle.name",
      "vehicle.brand",
      "vehicle.model",
      "vehicle.licensePlate",
    ],
    order: [[sequelize.fn("COUNT", sequelize.col("id")), "DESC"]],
    limit: 10,
    raw: false,
  });

  res.status(200).json({
    success: true,
    data: {
      overview: stats,
      monthlyTrends,
      popularVehicles,
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
        attributes: ["id", "name", "brand", "model", "licensePlate"],
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
