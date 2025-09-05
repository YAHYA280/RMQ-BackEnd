// src/routes/vehicles.js - Complete and Fixed Implementation
const express = require("express");
const {
  getBrands,
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
router.get("/brands", getBrands);
router.get("/", validatePagination, optionalAuth, getVehicles);
router.get("/availability", getAvailableVehicles);

// Protected routes
router.get(
  "/stats",
  protect,
  authorize("admin", "super-admin"),
  getVehicleStats
);

router.post(
  "/",
  protect,
  authorize("admin", "super-admin"),
  uploadMultipleImages,
  handleUploadError,
  validateVehicle,
  createVehicle
);

// Single vehicle routes
router.get("/:id", validateUUID, getVehicle);

router.put(
  "/:id",
  protect,
  authorize("admin", "super-admin"),
  validateUUID,
  uploadMultipleImages,
  handleUploadError,
  validateVehicleUpdate,
  updateVehicle
);

router.delete(
  "/:id",
  protect,
  authorize("admin", "super-admin"),
  validateUUID,
  deleteVehicle
);

// Image management routes
router.put(
  "/:id/images",
  protect,
  authorize("admin", "super-admin"),
  validateUUID,
  uploadMultipleImages,
  handleUploadError,
  uploadVehicleImages
);

router.delete(
  "/:id/images/:imageIndex",
  protect,
  authorize("admin", "super-admin"),
  validateUUID,
  removeVehicleImage
);

// Status management
router.put(
  "/:id/status",
  protect,
  authorize("admin", "super-admin"),
  validateUUID,
  updateVehicleStatus
);

module.exports = router;
