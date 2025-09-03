// src/routes/customers.js - Complete implementation
const express = require("express");
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  updateCustomerStatus,
  uploadDriverLicense,
  getCustomerStats,
  searchCustomers,
} = require("../controllers/customers");

const { protect, authorize } = require("../middleware/auth");
const {
  uploadDriverLicense: uploadDriverLicenseMiddleware,
  handleUploadError,
} = require("../middleware/upload");
const {
  validateCustomer,
  validateCustomerUpdate,
  validateUUID,
  validatePagination,
} = require("../utils/validation");

const router = express.Router();

// All routes require authentication
router.use(protect);

// All routes require admin or super-admin role
router.use(authorize("admin", "super-admin"));

// Customer management routes
router.get("/", validatePagination, getCustomers);
router.get("/search", searchCustomers);
router.get("/stats", getCustomerStats);

router.post(
  "/",
  uploadDriverLicenseMiddleware,
  handleUploadError,
  validateCustomer,
  createCustomer
);

router.get("/:id", validateUUID, getCustomer);

router.put(
  "/:id",
  validateUUID,
  uploadDriverLicenseMiddleware,
  handleUploadError,
  validateCustomerUpdate,
  updateCustomer
);

router.delete("/:id", validateUUID, authorize("super-admin"), deleteCustomer);

// Status management
router.put("/:id/status", validateUUID, updateCustomerStatus);

// Driver license upload
router.put(
  "/:id/driver-license",
  validateUUID,
  uploadDriverLicenseMiddleware,
  handleUploadError,
  uploadDriverLicense
);

module.exports = router;
