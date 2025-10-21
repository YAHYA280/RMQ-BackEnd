// src/routes/bookings.js - REFACTORED: Add availability preview endpoint
const express = require("express");
const {
  getBookings,
  getBooking,
  createWebsiteBooking,
  createAdminBooking,
  updateBooking,
  deleteBooking,
  confirmBooking,
  cancelBooking,
  pickupVehicle,
  returnVehicle,
  getBookingStats,
  getBookingStatsDebug,
  generateContract,
  checkAvailability,
  getCustomerBookings,
  getVehicleCalendar,
} = require("../controllers/bookings");

const { protect, authorize } = require("../middleware/auth");
const {
  validateWebsiteBooking,
  validateAdminBooking,
  validateBookingUpdate,
  validateUUID,
  validatePagination,
} = require("../utils/validation");

const router = express.Router();

// --- Debug Middleware ---
router.use((req, res, next) => {
  console.log(`🔍 Booking Route: ${req.method} ${req.path}`);
  console.log(`🔍 Full URL: ${req.originalUrl}`);
  next();
});

// --- PUBLIC ROUTES ---

// Vehicle calendar (used by booking form)
router.get("/calendar/:vehicleId", validateUUID, getVehicleCalendar);

// Website bookings
router.post("/website", validateWebsiteBooking, createWebsiteBooking);

// NEW: Availability & pricing preview for admin form
router.get("/preview-availability/:vehicleId", async (req, res, next) => {
  try {
    const { vehicleId } = req.params;
    const { pickupDate, returnDate, pickupTime, returnTime } = req.query;

    if (!pickupDate || !returnDate || !pickupTime || !returnTime) {
      return res.status(400).json({
        success: false,
        message: "All date and time parameters are required",
      });
    }

    const { Booking, Vehicle } = require("../models");
    const {
      calculateChargedDaysWithLatenessRule,
    } = require("../utils/bookingUtils");

    // Get vehicle
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // Check availability
    const availabilityDetails = await Booking.getVehicleAvailabilityDetails(
      vehicleId,
      pickupDate,
      returnDate,
      pickupTime,
      returnTime
    );

    // Calculate pricing
    const pricing = calculateChargedDaysWithLatenessRule(
      pickupDate,
      returnDate,
      pickupTime,
      returnTime
    );

    const totalAmount = parseFloat(vehicle.price) * pricing.chargedDays;

    res.status(200).json({
      success: true,
      data: {
        available: availabilityDetails.isAvailable,
        conflictingBookings: availabilityDetails.conflictingBookings.map(
          (b) => ({
            bookingNumber: b.bookingNumber,
            pickupDate: b.pickupDate,
            returnDate: b.returnDate,
            pickupTime: b.pickupTime,
            returnTime: b.returnTime,
          })
        ),
        pricing: {
          durationMinutes: pricing.durationMinutes,
          durationHours: (pricing.durationMinutes / 60).toFixed(1),
          fullDays: pricing.fullDays,
          latenessMinutes: pricing.latenessMinutes,
          chargedDays: pricing.chargedDays,
          latenessFeeApplied: pricing.latenessMinutes >= 90,
          dailyRate: vehicle.price,
          totalAmount: totalAmount,
        },
        message: availabilityDetails.message,
      },
    });
  } catch (error) {
    console.error("Error in preview-availability:", error);
    next(error);
  }
});

// --- PROTECTED ROUTES ---
router.use(protect);
router.use(authorize("admin", "super-admin"));

// Stats routes
router.get("/stats", (req, res, next) => {
  console.log("📊 Booking stats route hit");

  const statsHandler = async (req, res, next) => {
    try {
      await getBookingStats(req, res, next);
    } catch (error) {
      console.error("📊 Stats endpoint error:", error);

      res.status(200).json({
        success: true,
        message: "Stats retrieved with fallback data",
        data: {
          totalBookings: 0,
          pendingBookings: 0,
          confirmedBookings: 0,
          activeBookings: 0,
          completedBookings: 0,
          cancelledBookings: 0,
          totalRevenue: 0,
          averageBookingValue: 0,
          monthlyRevenue: 0,
        },
        warning: "Using fallback stats due to server error",
      });
    }
  };

  statsHandler(req, res, next);
});

router.get("/stats/debug", (req, res, next) => {
  console.log("🔍 Booking stats DEBUG route hit");
  getBookingStatsDebug(req, res, next);
});

// Availability check
router.get("/availability/:vehicleId", validateUUID, checkAvailability);

// Customer bookings
router.get("/customer/:customerId", validateUUID, getCustomerBookings);

// General booking list
router.get("/", validatePagination, getBookings);

// Admin booking creation
router.post("/", validateAdminBooking, createAdminBooking);

// --- Dynamic Routes with :id ---

// Contract generation
router.get("/:id/contract", validateUUID, generateContract);

// Booking workflow
router.put("/:id/confirm", validateUUID, confirmBooking);
router.put("/:id/cancel", validateUUID, cancelBooking);
router.put("/:id/pickup", validateUUID, pickupVehicle);
router.put("/:id/return", validateUUID, returnVehicle);

// Generic :id routes (must be last)
router.get("/:id", validateUUID, getBooking);
router.put("/:id", validateUUID, validateBookingUpdate, updateBooking);
router.delete("/:id", validateUUID, authorize("super-admin"), deleteBooking);

// --- Error Handling ---
router.use("/stats*", (error, req, res, next) => {
  console.error(`💥 Stats route error: ${req.method} ${req.path}:`, error);

  res.status(200).json({
    success: true,
    message: "Stats retrieved with error handling",
    data: {
      totalBookings: 0,
      pendingBookings: 0,
      confirmedBookings: 0,
      activeBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      totalRevenue: 0,
      averageBookingValue: 0,
      monthlyRevenue: 0,
    },
    warning: `Error occurred: ${error.message}`,
    debug: process.env.NODE_ENV === "development" ? error.stack : undefined,
  });
});

router.use((error, req, res, next) => {
  console.error(`💥 Booking route error on ${req.method} ${req.path}:`, error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error in booking routes",
    ...(process.env.NODE_ENV === "development" && {
      stack: error.stack,
      details: error,
    }),
  });
});

module.exports = router;
