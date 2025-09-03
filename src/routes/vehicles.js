// src/routes/vehicles.js - Complete implementation
const express = require("express");
const {
  getVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  uploadVehicleImages,
  removeVehicleImage,
  getVehicleStats,
  getAvailableVehicles,
  updateVehicleStatus,
} = require("../controllers/vehicles");

const { protect, authorize, optionalAuth } = require("../middleware/auth");
const {
  uploadMultipleImages,
  handleUploadError,
} = require("../middleware/upload");
const {
  validateVehicle,
  validateVehicleUpdate,
  validateUUID,
  validatePagination,
} = require("../utils/validation");

const router = express.Router();

// Public routes
router.get("/", validatePagination, optionalAuth, getVehicles);
router.get("/availability", getAvailableVehicles);
router.get("/:id", validateUUID, getVehicle);

// Protected routes (require authentication)
router.use(protect);

// Admin routes
router.get("/admin/stats", authorize("admin", "super-admin"), getVehicleStats);

router.post(
  "/",
  authorize("admin", "super-admin"),
  uploadMultipleImages,
  handleUploadError,
  validateVehicle,
  createVehicle
);

router.put(
  "/:id",
  validateUUID,
  authorize("admin", "super-admin"),
  uploadMultipleImages,
  handleUploadError,
  validateVehicleUpdate,
  updateVehicle
);

router.delete(
  "/:id",
  validateUUID,
  authorize("admin", "super-admin"),
  deleteVehicle
);

// Image management routes
router.put(
  "/:id/images",
  validateUUID,
  authorize("admin", "super-admin"),
  uploadMultipleImages,
  handleUploadError,
  uploadVehicleImages
);

router.delete(
  "/:id/images/:imageIndex",
  validateUUID,
  authorize("admin", "super-admin"),
  removeVehicleImage
);

// Status management
router.put(
  "/:id/status",
  validateUUID,
  authorize("admin", "super-admin"),
  updateVehicleStatus
);

module.exports = router;
