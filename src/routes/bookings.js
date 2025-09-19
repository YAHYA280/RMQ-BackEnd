// src/routes/bookings.js - CORRECTED: Fixed route ordering
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
  pickupVehicle, // Updated name (was markAsPickedUp)
  returnVehicle, // Updated name (was completeBooking)
  getBookingStats,
  generateContract, // NEW: Added contract generation
  checkAvailability, // KEPT: Your original function
  getCustomerBookings, // KEPT: Your original function
  getVehicleCalendar, // KEPT: Your original function
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

// CRITICAL: These specific routes MUST come before any /:id routes!
// Otherwise Express will match /:id instead of these literal paths

// 1. Stats route (literal path)
router.get("/stats", getBookingStats);

// 2. Availability check (parameterized but specific pattern)
router.get("/availability/:vehicleId", validateUUID, checkAvailability);

// 3. Customer bookings (parameterized but specific pattern)
router.get("/customer/:customerId", validateUUID, getCustomerBookings);

// 4. General booking list (must come before /:id)
router.get("/", validatePagination, getBookings);

// 5. Admin booking creation (POST, won't conflict)
router.post("/", validateAdminBooking, createAdminBooking);

// ========== DYNAMIC ROUTES WITH :id PARAMETER ==========
// These MUST come after all specific literal routes above!

// Contract generation (specific /:id/action pattern)
router.get("/:id/contract", validateUUID, generateContract);

// Booking workflow routes (specific /:id/action patterns)
router.put("/:id/confirm", validateUUID, confirmBooking);
router.put("/:id/cancel", validateUUID, cancelBooking);
router.put("/:id/pickup", validateUUID, pickupVehicle);
router.put("/:id/return", validateUUID, returnVehicle);

// Generic /:id routes (MUST be last!)
router.get("/:id", validateUUID, getBooking);
router.put("/:id", validateUUID, validateBookingUpdate, updateBooking);
router.delete("/:id", validateUUID, authorize("super-admin"), deleteBooking);

module.exports = router;
