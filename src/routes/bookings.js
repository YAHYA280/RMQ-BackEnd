// src/routes/bookings.js - Complete implementation
const express = require("express");
const {
  getBookings,
  getBooking,
  createBooking,
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

// All routes require authentication
router.use(protect);

// All routes require admin or super-admin role
router.use(authorize("admin", "super-admin"));

// Booking management routes
router.get("/", validatePagination, getBookings);
router.get("/stats", getBookingStats);
router.get("/availability/:vehicleId", validateUUID, checkAvailability);
router.get("/customer/:customerId", validateUUID, getCustomerBookings);

router.post("/", validateBooking, createBooking);

router.get("/:id", validateUUID, getBooking);

router.put("/:id", validateUUID, validateBookingUpdate, updateBooking);

router.delete("/:id", validateUUID, authorize("super-admin"), deleteBooking);

// Booking workflow routes
router.put("/:id/confirm", validateUUID, confirmBooking);
router.put("/:id/cancel", validateUUID, cancelBooking);
router.put("/:id/pickup", validateUUID, markAsPickedUp);
router.put("/:id/return", validateUUID, completeBooking);

module.exports = router;
