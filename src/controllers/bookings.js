// src/controllers/bookings.js - REFACTORED: Update exports and recalculation logic
const { Booking, Customer, Vehicle, Admin } = require("../models");
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const asyncHandler = require("../middleware/asyncHandler");
const ErrorResponse = require("../utils/errorResponse");
const {
  calculateChargedDaysWithLatenessRule,
} = require("../utils/bookingUtils");

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
  getBookingStatsDebug,
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

  // --- Build Where Clause ---
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

  // --- Pagination ---
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  // --- Execute Query ---
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

  // --- Build Pagination Result ---
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
  // --- Validation ---
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse("Validation failed", 400, errors.array()));
  }

  let booking = await Booking.findByPk(req.params.id, {
    include: [
      {
        model: Vehicle,
        as: "vehicle",
        attributes: ["id", "price"],
      },
    ],
  });

  if (!booking) {
    return next(new ErrorResponse("Booking not found", 404));
  }

  // Prevent updating completed or cancelled bookings
  if (["completed", "cancelled"].includes(booking.status)) {
    return next(
      new ErrorResponse("Cannot update completed or cancelled bookings", 400)
    );
  }

  // --- If Dates/Times Changed, Check Availability & Recalculate ---
  if (
    req.body.pickupDate ||
    req.body.returnDate ||
    req.body.pickupTime ||
    req.body.returnTime
  ) {
    const newPickupDate = req.body.pickupDate || booking.pickupDate;
    const newReturnDate = req.body.returnDate || booking.returnDate;
    const newPickupTime = req.body.pickupTime || booking.pickupTime;
    const newReturnTime = req.body.returnTime || booking.returnTime;

    // Check availability
    const isAvailable = await Booking.checkVehicleAvailability(
      booking.vehicleId,
      newPickupDate,
      newReturnDate,
      booking.id,
      newPickupTime,
      newReturnTime
    );

    if (!isAvailable) {
      return next(
        new ErrorResponse("Vehicle is not available for the updated dates", 400)
      );
    }

    // Recalculate charged days with lateness rule
    const pricing = calculateChargedDaysWithLatenessRule(
      newPickupDate,
      newReturnDate,
      newPickupTime,
      newReturnTime
    );

    req.body.totalDays = pricing.chargedDays;
    req.body.totalAmount =
      parseFloat(booking.vehicle.price) * pricing.chargedDays;

    console.log("Booking update - recalculated pricing:", {
      bookingId: booking.id,
      originalChargedDays: booking.totalDays,
      newChargedDays: pricing.chargedDays,
      latenessMinutes: pricing.latenessMinutes,
      latenessFeeApplied: pricing.latenessMinutes >= 90,
    });
  }

  // --- Update Booking ---
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

// --- Export Helper Function ---
exports.calculateChargedDaysWithLatenessRule =
  calculateChargedDaysWithLatenessRule;

// --- Export Functions from Other Modules ---
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
