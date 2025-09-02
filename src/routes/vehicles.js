// src/routes/vehicles.js
const express = require("express");
const {
  getVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  uploadVehicleImages,
  getVehicleStats,
} = require("../controllers/vehicles");

const { protect } = require("../middleware/auth");
const {
  uploadMultipleImages,
  handleUploadError,
} = require("../middleware/upload");
const {
  validateVehicle,
  validateVehicleUpdate,
} = require("../utils/validation");

const router = express.Router();

// Public routes
router.get("/", getVehicles);
router.get("/stats", protect, getVehicleStats);
router.get("/:id", getVehicle);

// Protected routes
router.post(
  "/",
  protect,
  uploadMultipleImages,
  handleUploadError,
  validateVehicle,
  createVehicle
);

router.put(
  "/:id",
  protect,
  uploadMultipleImages,
  handleUploadError,
  validateVehicleUpdate,
  updateVehicle
);

router.delete("/:id", protect, deleteVehicle);

router.put(
  "/:id/images",
  protect,
  uploadMultipleImages,
  handleUploadError,
  uploadVehicleImages
);

module.exports = router;
