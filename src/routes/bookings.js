// src/routes/bookings.js - Complete updated routes for website and admin bookings
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
  getBookingStats,
  checkAvailability,
  getCustomerBookings,
} = require("../controllers/bookings");

const { protect, authorize } = require("../middleware/auth");
const {
  validateBooking,
  validateBookingUpdate,
  validateUUID,
  validatePagination,
} = require("../utils/validation");

const router = express.Router();

// Public route for website bookings
router.post("/website", validateBooking, createWebsiteBooking);

// All other routes require authentication and admin role
router.use(protect);
router.use(authorize("admin", "super-admin"));

// Booking management routes
router.get("/", validatePagination, getBookings);
router.get("/stats", getBookingStats);

// Admin booking creation
router.post("/", validateBooking, createAdminBooking);

// Availability check
router.get("/availability/:vehicleId", validateUUID, checkAvailability);

// Customer bookings
router.get("/customer/:customerId", validateUUID, getCustomerBookings);

// Single booking routes
router.get("/:id", validateUUID, getBooking);
router.put("/:id", validateUUID, validateBookingUpdate, updateBooking);
router.delete("/:id", validateUUID, authorize("super-admin"), deleteBooking);

// Booking workflow routes
router.put("/:id/confirm", validateUUID, confirmBooking);
router.put("/:id/cancel", validateUUID, cancelBooking);
router.put("/:id/pickup", validateUUID, markAsPickedUp);
router.put("/:id/return", validateUUID, completeBooking);

module.exports = router;
