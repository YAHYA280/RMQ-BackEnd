// src/routes/auth.js
const express = require("express");
const {
  register,
  login,
  getMe,
  updateProfile,
  updatePassword,
} = require("../controllers/auth");

const { protect, authorize } = require("../middleware/auth");
const {
  validateAdminRegistration,
  validateAdminLogin,
} = require("../utils/validation");

const router = express.Router();

router.post(
  "/register",
  protect,
  authorize("super-admin"),
  validateAdminRegistration,
  register
);
router.post("/login", validateAdminLogin, login);
router.get("/me", protect, getMe);
router.put("/updateprofile", protect, updateProfile);
router.put("/updatepassword", protect, updatePassword);

module.exports = router;
