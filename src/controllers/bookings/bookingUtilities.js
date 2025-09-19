// src/controllers/bookings/bookingUtilities.js - PART 4: Utility Functions
const { Booking, Customer, Vehicle, Admin } = require("../../models");
const { Op } = require("sequelize");
const asyncHandler = require("../../middleware/asyncHandler");
const ErrorResponse = require("../../utils/errorResponse");
const ContractGenerator = require("../../services/contractGenerator");

// @desc    Generate contract PDF for booking
// @route   GET /api/bookings/:id/contract
// @access  Private (admin)
exports.generateContract = asyncHandler(async (req, res, next) => {
  const booking = await Booking.findByPk(req.params.id, {
    include: [
      {
        model: Customer,
        as: "customer",
        attributes: [
          "id",
          "firstName",
          "lastName",
          "phone",
          "email",
          "dateOfBirth",
          "address",
          "city",
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
          "price",
          "mileage",
        ],
      },
    ],
  });

  if (!booking) {
    return next(new ErrorResponse("Booking not found", 404));
  }

  // Only generate contract for confirmed or active bookings
  if (!["confirmed", "active"].includes(booking.status)) {
    return next(
      new ErrorResponse(
        "Contract can only be generated for confirmed or active bookings",
        400
      )
    );
  }

  try {
    const contractGenerator = new ContractGenerator();
    const pdfBuffer = await contractGenerator.generateContract(booking);

    // Set response headers for PDF download
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Contract_${booking.bookingNumber}.pdf"`,
      "Content-Length": pdfBuffer.length,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error("Contract generation error:", error);
    return next(new ErrorResponse("Failed to generate contract", 500));
  }
});

// @desc    Get booking statistics
// @route   GET /api/bookings/stats
// @access  Private (admin)
exports.getBookingStats = asyncHandler(async (req, res, next) => {
  const { sequelize } = require("../../config/database");

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
