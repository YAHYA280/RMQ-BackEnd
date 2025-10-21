// src/controllers/bookings/bookingUtilities.js - REFACTORED: Update availability endpoint for lateness rule
const { Booking, Customer, Vehicle, Admin } = require("../../models");
const { Op, Sequelize } = require("sequelize");
const asyncHandler = require("../../middleware/asyncHandler");
const ErrorResponse = require("../../utils/errorResponse");
const ContractGenerator = require("../../services/contractGenerator");
const {
  calculateChargedDaysWithLatenessRule,
} = require("../../utils/bookingUtils");

// @desc    Generate contract PDF for booking
// @route   GET /api/bookings/:id/contract
// @access  Private (admin)
exports.generateContract = asyncHandler(async (req, res, next) => {
  console.log(`Starting contract generation for booking ID: ${req.params.id}`);

  try {
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
            "country",
            "driverLicenseNumber",
            "passportNumber",
            "passportIssuedAt",
            "cinNumber",
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
      console.log(`Booking not found for ID: ${req.params.id}`);
      return next(new ErrorResponse("Booking not found", 404));
    }

    console.log(
      `Found booking: ${booking.bookingNumber}, status: ${booking.status}`
    );

    if (!["confirmed", "active", "completed"].includes(booking.status)) {
      console.log(`Invalid booking status for contract: ${booking.status}`);
      return next(
        new ErrorResponse(
          "Contract can only be generated for confirmed, active, or completed bookings",
          400
        )
      );
    }

    if (!booking.customer) {
      console.log("No customer data found for booking");
      return next(new ErrorResponse("Customer data not found", 400));
    }

    if (!booking.vehicle) {
      console.log("No vehicle data found for booking");
      return next(new ErrorResponse("Vehicle data not found", 400));
    }

    console.log(
      `Customer: ${booking.customer.firstName} ${booking.customer.lastName}`
    );
    console.log(`Vehicle: ${booking.vehicle.brand} ${booking.vehicle.name}`);

    const contractGenerator = new ContractGenerator();
    console.log("Generating PDF contract...");

    const pdfBuffer = await contractGenerator.generateContract(booking);

    console.log(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Contract_${booking.bookingNumber}.pdf"`,
      "Content-Length": pdfBuffer.length,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    console.log(`Sending PDF contract for booking ${booking.bookingNumber}`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Contract generation error:", error);
    console.error("Error stack:", error.stack);

    if (error.name === "SequelizeDatabaseError") {
      console.error(
        "Database error during contract generation:",
        error.message
      );
      return next(
        new ErrorResponse("Database error during contract generation", 500)
      );
    } else if (error.message && error.message.includes("Template")) {
      console.error("Template error:", error.message);
      return next(new ErrorResponse("Contract template error", 500));
    } else {
      return next(new ErrorResponse("Failed to generate contract", 500));
    }
  }
});

// @desc    Get booking statistics
// @route   GET /api/bookings/stats
// @access  Private (admin)
exports.getBookingStats = asyncHandler(async (req, res, next) => {
  try {
    console.log("📊 Getting booking statistics...");

    const allBookings = await Booking.findAll({
      attributes: [
        "id",
        "status",
        "dailyRate",
        "totalDays",
        "totalAmount",
        "createdAt",
        "updatedAt",
      ],
      raw: true,
    });

    console.log(
      `📊 Found ${allBookings.length} bookings for stats calculation`
    );

    const stats = {
      totalBookings: allBookings.length,
      pendingBookings: 0,
      confirmedBookings: 0,
      activeBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      totalRevenue: 0,
      averageBookingValue: 0,
      monthlyRevenue: 0,
    };

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    let totalRevenue = 0;
    let monthlyRevenue = 0;
    let completedBookingsCount = 0;

    allBookings.forEach((booking) => {
      switch (booking.status) {
        case "pending":
          stats.pendingBookings++;
          break;
        case "confirmed":
          stats.confirmedBookings++;
          break;
        case "active":
          stats.activeBookings++;
          break;
        case "completed":
          stats.completedBookings++;
          completedBookingsCount++;
          break;
        case "cancelled":
          stats.cancelledBookings++;
          break;
      }

      let bookingAmount = 0;

      if (booking.totalAmount && !isNaN(booking.totalAmount)) {
        bookingAmount = parseFloat(booking.totalAmount);
      } else if (
        booking.dailyRate &&
        booking.totalDays &&
        !isNaN(booking.dailyRate) &&
        !isNaN(booking.totalDays)
      ) {
        bookingAmount =
          parseFloat(booking.dailyRate) * parseInt(booking.totalDays);
        console.log(
          `📊 Calculated amount for booking ${booking.id}: ${bookingAmount}`
        );
      } else if (booking.dailyRate && !isNaN(booking.dailyRate)) {
        bookingAmount = parseFloat(booking.dailyRate);
      }

      if (booking.status === "completed" && bookingAmount > 0) {
        totalRevenue += bookingAmount;

        const bookingDate = new Date(booking.createdAt);
        if (
          bookingDate.getMonth() === currentMonth &&
          bookingDate.getFullYear() === currentYear
        ) {
          monthlyRevenue += bookingAmount;
        }
      }
    });

    stats.totalRevenue = Math.round(totalRevenue * 100) / 100;
    stats.monthlyRevenue = Math.round(monthlyRevenue * 100) / 100;
    stats.averageBookingValue =
      completedBookingsCount > 0
        ? Math.round((totalRevenue / completedBookingsCount) * 100) / 100
        : 0;

    console.log("📊 Final stats calculated:", stats);

    res.status(200).json({
      success: true,
      message: "Booking statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("❌ Error in getBookingStats:", error);

    const fallbackStats = {
      totalBookings: 0,
      pendingBookings: 0,
      confirmedBookings: 0,
      activeBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      totalRevenue: 0,
      averageBookingValue: 0,
      monthlyRevenue: 0,
    };

    try {
      const basicCount = await Booking.count();
      fallbackStats.totalBookings = basicCount;

      console.log("📊 Using fallback stats with basic count:", fallbackStats);
    } catch (fallbackError) {
      console.error("❌ Even basic count failed:", fallbackError);
    }

    res.status(200).json({
      success: true,
      message: "Booking statistics retrieved with fallback data",
      data: fallbackStats,
      warning: "Some statistics may be incomplete due to data issues",
    });
  }
});

// Debug stats endpoint
exports.getBookingStatsDebug = asyncHandler(async (req, res, next) => {
  try {
    console.log(
      "🔍 DEBUG: Getting booking statistics with detailed logging..."
    );

    const sampleBooking = await Booking.findOne({
      limit: 1,
      raw: true,
    });

    console.log("🔍 DEBUG: Sample booking structure:", sampleBooking);

    const allBookings = await Booking.findAll({
      attributes: [
        "id",
        "status",
        "dailyRate",
        "totalDays",
        "totalAmount",
        "createdAt",
      ],
      limit: 10,
      raw: true,
    });

    console.log("🔍 DEBUG: Sample bookings data:", allBookings);

    const statusCounts = await Booking.findAll({
      attributes: [
        "status",
        [Sequelize.fn("COUNT", Sequelize.col("status")), "count"],
      ],
      group: ["status"],
      raw: true,
    });

    console.log("🔍 DEBUG: Status counts:", statusCounts);

    let revenueQuery = null;
    try {
      revenueQuery = await Booking.findAll({
        attributes: [
          [Sequelize.fn("SUM", Sequelize.col("totalAmount")), "total"],
          [Sequelize.fn("AVG", Sequelize.col("totalAmount")), "average"],
          [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
        ],
        where: {
          status: "completed",
          totalAmount: {
            [Op.not]: null,
          },
        },
        raw: true,
      });
      console.log("🔍 DEBUG: Revenue query result:", revenueQuery);
    } catch (revenueError) {
      console.log("🔍 DEBUG: Revenue query failed:", revenueError.message);
    }

    res.status(200).json({
      success: true,
      message: "Debug information retrieved",
      data: {
        sampleBooking,
        sampleBookings: allBookings,
        statusCounts,
        revenueQuery,
        tableInfo: "Check console for detailed structure",
      },
    });
  } catch (error) {
    console.error("❌ Error in debug stats:", error);
    res.status(500).json({
      success: false,
      message: "Debug stats failed",
      error: error.message,
    });
  }
});

// --- Check Availability with Pricing Preview ---
// @desc    Check vehicle availability
// @route   GET /api/bookings/availability/:vehicleId
// @access  Private (admin)
exports.checkAvailability = asyncHandler(async (req, res, next) => {
  const { vehicleId } = req.params;
  const { pickupDate, returnDate, pickupTime, returnTime } = req.query;

  if (!pickupDate || !returnDate) {
    return next(
      new ErrorResponse("Pickup date and return date are required", 400)
    );
  }

  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle) {
    return next(new ErrorResponse("Vehicle not found", 404));
  }

  // Get availability details
  const availabilityDetails = await Booking.getVehicleAvailabilityDetails(
    vehicleId,
    pickupDate,
    returnDate,
    pickupTime,
    returnTime
  );

  // Calculate pricing if times provided
  let pricingPreview = null;
  if (pickupTime && returnTime) {
    const pricing = calculateChargedDaysWithLatenessRule(
      pickupDate,
      returnDate,
      pickupTime,
      returnTime
    );

    const totalAmount = parseFloat(vehicle.price) * pricing.chargedDays;

    pricingPreview = {
      durationMinutes: pricing.durationMinutes,
      durationHours: (pricing.durationMinutes / 60).toFixed(1),
      fullDays: pricing.fullDays,
      latenessMinutes: pricing.latenessMinutes,
      chargedDays: pricing.chargedDays,
      latenessFeeApplied: pricing.latenessMinutes >= 90,
      dailyRate: vehicle.price,
      totalAmount: totalAmount,
    };
  }

  res.status(200).json({
    success: true,
    data: {
      vehicleId,
      available: availabilityDetails.isAvailable,
      searchDates: { pickupDate, returnDate },
      searchTimes: pickupTime && returnTime ? { pickupTime, returnTime } : null,
      conflictingBookings: availabilityDetails.conflictingBookings.map(
        (booking) => ({
          id: booking.id,
          bookingNumber: booking.bookingNumber,
          pickupDate: booking.pickupDate,
          returnDate: booking.returnDate,
          pickupTime: booking.pickupTime,
          returnTime: booking.returnTime,
          status: booking.status,
          customer: booking.customer
            ? {
                firstName: booking.customer.firstName,
                lastName: booking.customer.lastName,
              }
            : null,
        })
      ),
      pricingPreview,
      message: availabilityDetails.message,
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

  const today = new Date();
  const start = startDate ? new Date(startDate) : today;
  const end = endDate
    ? new Date(endDate)
    : new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle) {
    return next(new ErrorResponse("Vehicle not found", 404));
  }

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
    attributes: [
      "id",
      "bookingNumber",
      "pickupDate",
      "returnDate",
      "pickupTime",
      "returnTime",
      "status",
    ],
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

    bookedPeriods.push({
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      pickupDate: booking.pickupDate,
      returnDate: booking.returnDate,
      pickupTime: booking.pickupTime,
      returnTime: booking.returnTime,
      status: booking.status,
      customerName: booking.customer
        ? `${booking.customer.firstName} ${booking.customer.lastName}`
        : "Unknown Customer",
    });

    const currentDate = new Date(pickup);
    while (currentDate <= returnDate) {
      const dateStr = currentDate.toISOString().split("T")[0];
      blockedDates.push(dateStr);
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });

  const uniqueBlockedDates = [...new Set(blockedDates)];
  console.log("Blocked dates:", uniqueBlockedDates);

  const todayStr = today.toISOString().split("T")[0];

  const currentBooking = bookedPeriods.find(
    (period) => todayStr >= period.pickupDate && todayStr <= period.returnDate
  );

  const upcomingBooking = bookedPeriods
    .filter((period) => period.pickupDate > todayStr)
    .sort(
      (a, b) =>
        new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime()
    )[0];

  const isCurrentlyAvailable = !currentBooking;

  let nextAvailableDate = null;
  let nextAvailableTime = null;

  if (currentBooking) {
    const returnDate = new Date(currentBooking.returnDate);
    const returnTime = currentBooking.returnTime || "23:59";

    console.log("🔍 Current booking return:", {
      returnDate: currentBooking.returnDate,
      returnTime: returnTime,
    });

    const [returnHour, returnMin] = returnTime.split(":").map(Number);
    const formattedTime = `${String(returnHour).padStart(2, "0")}:${String(
      returnMin
    ).padStart(2, "0")}`;

    if (returnHour < 20) {
      nextAvailableDate = currentBooking.returnDate;
      nextAvailableTime = formattedTime;
    } else {
      returnDate.setDate(returnDate.getDate() + 1);
      nextAvailableDate = returnDate.toISOString().split("T")[0];
      nextAvailableTime = formattedTime;
    }

    console.log("📅 Calculated next available:", {
      date: nextAvailableDate,
      time: nextAvailableTime,
    });
  }

  console.log("Next available:", { nextAvailableDate, nextAvailableTime });
  console.log("Current booking:", currentBooking);
  console.log("Upcoming booking:", upcomingBooking);
  console.log("Is currently available:", isCurrentlyAvailable);

  res.status(200).json({
    success: true,
    data: {
      vehicleId,
      available: isCurrentlyAvailable,
      currentBooking: currentBooking || null,
      upcomingBooking: upcomingBooking || null,
      nextAvailableDate,
      nextAvailableTime,
      blockedDates: uniqueBlockedDates,
      bookedPeriods,
      searchPeriod: {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      },
    },
  });
});
