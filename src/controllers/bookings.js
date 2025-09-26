// src/controllers/bookings.js - UPDATED: Export debug function
const { Booking, Customer, Vehicle, Admin } = require("../models");
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const asyncHandler = require("../middleware/asyncHandler");
const ErrorResponse = require("../utils/errorResponse");
const { calculateRentalDaysWithTimeLogic } = require("../utils/bookingUtils");

// Import other parts
const {
  createWebsiteBooking,
  createAdminBooking,
} = require("./bookings/bookingCreation");

const {
  confirmBooking,
  cancelBooking,
  pickupVehicle,
  returnVehicle,
} = require("./bookings/bookingWorkflow");

const {
  generateContract,
  getBookingStats,
  getBookingStatsDebug, // NEW: Import debug function
  checkAvailability,
  getCustomerBookings,
  getVehicleCalendar,
} = require("./bookings/bookingUtilities");

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
          "dateOfBirth",
          "address",
          "country",
          "driverLicenseNumber",
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
          "price",
          "mileage",
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

// Export the helper function for other modules
exports.calculateRentalDaysWithTimeLogic = calculateRentalDaysWithTimeLogic;

// Export functions from other modules
exports.createWebsiteBooking = createWebsiteBooking;
exports.createAdminBooking = createAdminBooking;
exports.confirmBooking = confirmBooking;
exports.cancelBooking = cancelBooking;
exports.pickupVehicle = pickupVehicle;
exports.returnVehicle = returnVehicle;
exports.generateContract = generateContract;
exports.getBookingStats = getBookingStats;
exports.getBookingStatsDebug = getBookingStatsDebug;
exports.checkAvailability = checkAvailability;
exports.getCustomerBookings = getCustomerBookings;
exports.getVehicleCalendar = getVehicleCalendar;
