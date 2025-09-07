// src/routes/bookings.js - FIXED: Separate validation for website vs admin bookings
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
  validateWebsiteBooking, // FIXED: Use separate validation for website
  validateAdminBooking, // FIXED: Use separate validation for admin
  validateBookingUpdate,
  validateUUID,
  validatePagination,
} = require("../utils/validation");

const router = express.Router();

// FIXED: Public route for website bookings with website-specific validation
router.post("/website", validateWebsiteBooking, createWebsiteBooking);

// All other routes require authentication and admin role
router.use(protect);
router.use(authorize("admin", "super-admin"));

// Booking management routes
router.get("/", validatePagination, getBookings);
router.get("/stats", getBookingStats);

// FIXED: Admin booking creation with admin-specific validation
router.post("/", validateAdminBooking, createAdminBooking);

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
