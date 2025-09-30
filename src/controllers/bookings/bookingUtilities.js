// src/controllers/bookings/bookingUtilities.js - FIXED: Complete stats function
const { Booking, Customer, Vehicle, Admin } = require("../../models");
const { Op, Sequelize } = require("sequelize"); // FIXED: Added Sequelize import
const asyncHandler = require("../../middleware/asyncHandler");
const ErrorResponse = require("../../utils/errorResponse");
const ContractGenerator = require("../../services/contractGenerator");

// @desc    Generate contract PDF for booking
// @route   GET /api/bookings/:id/contract
// @access  Private (admin)
exports.generateContract = asyncHandler(async (req, res, next) => {
  console.log(`Starting contract generation for booking ID: ${req.params.id}`);

  try {
    // FIXED: More specific attribute selection to avoid SQL conflicts
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
            "address", // Single address field
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

    // UPDATED: Allow contract generation for confirmed, active, AND completed bookings
    if (!["confirmed", "active", "completed"].includes(booking.status)) {
      console.log(`Invalid booking status for contract: ${booking.status}`);
      return next(
        new ErrorResponse(
          "Contract can only be generated for confirmed, active, or completed bookings",
          400
        )
      );
    }

    // Check if customer data is sufficient for contract
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

    // Generate the contract
    const contractGenerator = new ContractGenerator();
    console.log("Generating PDF contract...");

    const pdfBuffer = await contractGenerator.generateContract(booking);

    console.log(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);

    // Set response headers for PDF download
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

    // More specific error handling
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

// FIXED: Complete booking statistics function
// @desc    Get booking statistics
// @route   GET /api/bookings/stats
// @access  Private (admin)
exports.getBookingStats = asyncHandler(async (req, res, next) => {
  try {
    console.log("📊 Getting booking statistics...");

    // Get all bookings for detailed statistics
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

    // Initialize stats
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

    // Current month/year for monthly revenue
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    let totalRevenue = 0;
    let monthlyRevenue = 0;
    let completedBookingsCount = 0;

    // Process each booking
    allBookings.forEach((booking) => {
      // Count by status
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

      // Calculate revenue with fallbacks
      let bookingAmount = 0;

      // Try totalAmount first
      if (booking.totalAmount && !isNaN(booking.totalAmount)) {
        bookingAmount = parseFloat(booking.totalAmount);
      }
      // Fallback: calculate from dailyRate * totalDays
      else if (
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
      }
      // Last resort: use dailyRate
      else if (booking.dailyRate && !isNaN(booking.dailyRate)) {
        bookingAmount = parseFloat(booking.dailyRate);
      }

      // Only count revenue for completed bookings
      if (booking.status === "completed" && bookingAmount > 0) {
        totalRevenue += bookingAmount;

        // Check if booking is from current month
        const bookingDate = new Date(booking.createdAt);
        if (
          bookingDate.getMonth() === currentMonth &&
          bookingDate.getFullYear() === currentYear
        ) {
          monthlyRevenue += bookingAmount;
        }
      }
    });

    // Final calculations
    stats.totalRevenue = Math.round(totalRevenue * 100) / 100;
    stats.monthlyRevenue = Math.round(monthlyRevenue * 100) / 100;
    stats.averageBookingValue =
      completedBookingsCount > 0
        ? Math.round((totalRevenue / completedBookingsCount) * 100) / 100
        : 0;

    console.log("📊 Final stats calculated:", {
      totalBookings: stats.totalBookings,
      pendingBookings: stats.pendingBookings,
      confirmedBookings: stats.confirmedBookings,
      activeBookings: stats.activeBookings,
      completedBookings: stats.completedBookings,
      cancelledBookings: stats.cancelledBookings,
      totalRevenue: stats.totalRevenue,
      averageBookingValue: stats.averageBookingValue,
      monthlyRevenue: stats.monthlyRevenue,
    });

    res.status(200).json({
      success: true,
      message: "Booking statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("❌ Error in getBookingStats:", error);

    // Return safe fallback stats
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

    // Try to get at least basic counts if possible
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

// NEW: Debug stats endpoint for troubleshooting
exports.getBookingStatsDebug = asyncHandler(async (req, res, next) => {
  try {
    console.log(
      "🔍 DEBUG: Getting booking statistics with detailed logging..."
    );

    // Get sample booking to check structure
    const sampleBooking = await Booking.findOne({
      limit: 1,
      raw: true,
    });

    console.log("🔍 DEBUG: Sample booking structure:", sampleBooking);

    // Get all bookings with key fields
    const allBookings = await Booking.findAll({
      attributes: [
        "id",
        "status",
        "dailyRate",
        "totalDays",
        "totalAmount",
        "createdAt",
      ],
      limit: 10, // Limit for debugging
      raw: true,
    });

    console.log("🔍 DEBUG: Sample bookings data:", allBookings);

    // Get status counts
    const statusCounts = await Booking.findAll({
      attributes: [
        "status",
        [Sequelize.fn("COUNT", Sequelize.col("status")), "count"],
      ],
      group: ["status"],
      raw: true,
    });

    console.log("🔍 DEBUG: Status counts:", statusCounts);

    // Try to get revenue data
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
    attributes: [
      "id",
      "bookingNumber",
      "pickupDate",
      "returnDate",
      "pickupTime", // ✅ ADD THIS
      "returnTime", // ✅ ADD THIS
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
      pickupTime: booking.pickupTime,
      returnTime: booking.returnTime,
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

  // Calculate next available date and time
  let nextAvailableDate = null;
  let nextAvailableTime = null;

  if (currentBooking) {
    const returnDate = new Date(currentBooking.returnDate);
    const returnTime = currentBooking.returnTime || "23:59";

    console.log("🔍 Current booking return:", {
      returnDate: currentBooking.returnDate,
      returnTime: returnTime,
    });

    // Parse return time
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
  console.log("Next available:", nextAvailableDate);

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
