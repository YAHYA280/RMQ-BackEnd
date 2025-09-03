// src/routes/auth.js - Complete implementation
const express = require("express");
const {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  updatePassword,
  getAdmins,
  updateAdminStatus,
  deleteAdmin,
} = require("../controllers/auth");

const { protect, authorize } = require("../middleware/auth");
const {
  validateAdminRegistration,
  validateAdminLogin,
  validatePasswordUpdate,
  validateProfileUpdate,
  validateUUID,
  validatePagination,
} = require("../utils/validation");

const router = express.Router();

// Public routes
router.post("/login", validateAdminLogin, login);
router.get("/logout", logout);

// Protected routes
router.use(protect);

// Admin profile routes
router.get("/me", getMe);
router.put("/updateprofile", validateProfileUpdate, updateProfile);
router.put("/updatepassword", validatePasswordUpdate, updatePassword);

// Super admin routes
router.use(authorize("super-admin"));

router.post("/register", validateAdminRegistration, register);
router.get("/admins", validatePagination, getAdmins);
router.put("/admins/:id/status", validateUUID, updateAdminStatus);
router.delete("/admins/:id", validateUUID, deleteAdmin);

module.exports = router;
