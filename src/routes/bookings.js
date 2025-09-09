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
  markAsPickedUp,
  completeBooking,
  getBookingStats, // MAKE SURE THIS IS IMPORTED
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

// ========== PUBLIC ROUTES (NO AUTH REQUIRED) ==========
// These routes MUST be before the auth middleware!

// Public route for vehicle calendar (used by booking form)
router.get("/calendar/:vehicleId", validateUUID, getVehicleCalendar);

// Public route for website bookings
router.post("/website", validateWebsiteBooking, createWebsiteBooking);

// ========== PROTECTED ROUTES (AUTH REQUIRED) ==========
// All routes below require authentication and admin role
router.use(protect);
router.use(authorize("admin", "super-admin"));

// IMPORTANT: Stats route MUST come before "/:id" route to avoid conflicts
router.get("/stats", getBookingStats); // FIXED: Position this BEFORE /:id routes

// Booking management routes
router.get("/", validatePagination, getBookings);

// Admin booking creation
router.post("/", validateAdminBooking, createAdminBooking);

// Availability check (admin only)
router.get("/availability/:vehicleId", validateUUID, checkAvailability);

// Customer bookings (admin only)
router.get("/customer/:customerId", validateUUID, getCustomerBookings);

// Single booking routes (THESE MUST COME AFTER /stats)
router.get("/:id", validateUUID, getBooking);
router.put("/:id", validateUUID, validateBookingUpdate, updateBooking);
router.delete("/:id", validateUUID, authorize("super-admin"), deleteBooking);

// Booking workflow routes
router.put("/:id/confirm", validateUUID, confirmBooking);
router.put("/:id/cancel", validateUUID, cancelBooking);
router.put("/:id/pickup", validateUUID, markAsPickedUp);
router.put("/:id/return", validateUUID, completeBooking);

module.exports = router;
