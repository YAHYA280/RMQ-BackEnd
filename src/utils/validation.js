// src/utils/validation.js - Updated with new WhatsApp validation
const { body, param, query } = require("express-validator");

// Admin registration validation
exports.validateAdminRegistration = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),

  body("email")
    .isEmail()
    .withMessage("Please enter a valid email")
    .normalizeEmail(),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, and one number"
    ),

  body("role")
    .optional()
    .isIn(["admin", "super-admin"])
    .withMessage("Role must be either admin or super-admin"),
];

// Admin login validation
exports.validateAdminLogin = [
  body("email")
    .isEmail()
    .withMessage("Please enter a valid email")
    .normalizeEmail(),

  body("password").notEmpty().withMessage("Password is required"),
];

// Profile update validation
exports.validateProfileUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),

  body("email")
    .optional()
    .isEmail()
    .withMessage("Please enter a valid email")
    .normalizeEmail(),
];

// Password update validation
exports.validatePasswordUpdate = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "New password must contain at least one lowercase letter, one uppercase letter, and one number"
    ),
];

// Vehicle validation - Updated without location and model fields
exports.validateVehicle = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Vehicle name is required")
    .isLength({ min: 1, max: 50 })
    .withMessage("Vehicle name must be between 1 and 50 characters"),

  body("brand")
    .isIn([
      "Cupra",
      "Dacia",
      "Hyundai",
      "KIA",
      "Mercedes",
      "Opel",
      "Peugeot",
      "Porsche",
      "Renault",
      "SEAT",
      "Volkswagen",
    ])
    .withMessage("Please select a valid brand"),

  body("year")
    .isInt({ min: 2000, max: new Date().getFullYear() + 1 })
    .withMessage(
      `Year must be between 2000 and ${new Date().getFullYear() + 1}`
    ),

  body("price")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  body("transmission")
    .isIn(["manual", "automatic"])
    .withMessage("Transmission must be either manual or automatic"),

  body("fuelType")
    .isIn(["petrol", "diesel", "electric", "hybrid"])
    .withMessage("Fuel type must be petrol, diesel, electric, or hybrid"),

  body("seats")
    .isInt({ min: 2, max: 8 })
    .withMessage("Seats must be between 2 and 8"),

  body("doors")
    .isInt({ min: 2, max: 5 })
    .withMessage("Doors must be between 2 and 5"),

  body("licensePlate")
    .trim()
    .matches(/^\d{5}[A-Z]$/)
    .withMessage("License plate must be in format: 12345A"),

  body("whatsappNumber")
    .matches(/^0[67]\d{8}$/)
    .withMessage(
      "Please enter a valid WhatsApp number (06XXXXXXXX or 07XXXXXXXX)"
    ),

  body("caution")
    .isFloat({ min: 0 })
    .withMessage("Caution must be a positive number"),

  body("mileage")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Mileage must be a positive number"),

  body("features")
    .optional()
    .isArray()
    .withMessage("Features must be an array"),

  body("features.*")
    .optional()
    .isIn([
      "airConditioning",
      "bluetooth",
      "gps",
      "cruiseControl",
      "parkingSensors",
      "backupCamera",
      "leatherSeats",
      "keylessEntry",
      "electricWindows",
      "abs",
    ])
    .withMessage("Invalid feature selected"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot be more than 500 characters"),

  body("lastTechnicalVisit")
    .optional()
    .isISO8601()
    .withMessage("Please enter a valid date for last technical visit"),

  body("lastOilChange")
    .optional()
    .isISO8601()
    .withMessage("Please enter a valid date for last oil change"),
];

// Vehicle update validation (same as create but with optional fields)
exports.validateVehicleUpdate = [
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Vehicle name cannot be empty")
    .isLength({ min: 1, max: 50 })
    .withMessage("Vehicle name must be between 1 and 50 characters"),

  body("brand")
    .optional()
    .isIn([
      "Cupra",
      "Dacia",
      "Hyundai",
      "KIA",
      "Mercedes",
      "Opel",
      "Peugeot",
      "Porsche",
      "Renault",
      "SEAT",
      "Volkswagen",
    ])
    .withMessage("Please select a valid brand"),

  body("year")
    .optional()
    .isInt({ min: 2000, max: new Date().getFullYear() + 1 })
    .withMessage(
      `Year must be between 2000 and ${new Date().getFullYear() + 1}`
    ),

  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  body("transmission")
    .optional()
    .isIn(["manual", "automatic"])
    .withMessage("Transmission must be either manual or automatic"),

  body("fuelType")
    .optional()
    .isIn(["petrol", "diesel", "electric", "hybrid"])
    .withMessage("Fuel type must be petrol, diesel, electric, or hybrid"),

  body("seats")
    .optional()
    .isInt({ min: 2, max: 8 })
    .withMessage("Seats must be between 2 and 8"),

  body("doors")
    .optional()
    .isInt({ min: 2, max: 5 })
    .withMessage("Doors must be between 2 and 5"),

  body("licensePlate")
    .optional()
    .trim()
    .matches(/^\d{5}[A-Z]$/)
    .withMessage("License plate must be in format: 12345A"),

  body("whatsappNumber")
    .optional()
    .matches(/^0[67]\d{8}$/)
    .withMessage(
      "Please enter a valid WhatsApp number (06XXXXXXXX or 07XXXXXXXX)"
    ),

  body("caution")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Caution must be a positive number"),

  body("mileage")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Mileage must be a positive number"),

  body("features")
    .optional()
    .isArray()
    .withMessage("Features must be an array"),

  body("available")
    .optional()
    .isBoolean()
    .withMessage("Available status must be true or false"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot be more than 500 characters"),

  body("lastTechnicalVisit")
    .optional()
    .isISO8601()
    .withMessage("Please enter a valid date for last technical visit"),

  body("lastOilChange")
    .optional()
    .isISO8601()
    .withMessage("Please enter a valid date for last oil change"),
];

// Customer validation
exports.validateCustomer = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),

  body("email")
    .isEmail()
    .withMessage("Please enter a valid email")
    .normalizeEmail(),

  body("phone")
    .matches(/^0[67]\d{8}$/)
    .withMessage(
      "Please enter a valid Moroccan phone number (06XXXXXXXX or 07XXXXXXXX)"
    ),

  body("dateOfBirth")
    .optional()
    .isISO8601()
    .withMessage("Please enter a valid date of birth"),

  body("address")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Address cannot be more than 200 characters"),
];

// Customer update validation
exports.validateCustomerUpdate = [
  body("firstName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("First name cannot be empty")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),

  body("lastName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Last name cannot be empty")
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),

  body("email")
    .optional()
    .isEmail()
    .withMessage("Please enter a valid email")
    .normalizeEmail(),

  body("phone")
    .optional()
    .matches(/^0[67]\d{8}$/)
    .withMessage(
      "Please enter a valid Moroccan phone number (06XXXXXXXX or 07XXXXXXXX)"
    ),

  body("dateOfBirth")
    .optional()
    .isISO8601()
    .withMessage("Please enter a valid date of birth"),

  body("address")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Address cannot be more than 200 characters"),

  body("status")
    .optional()
    .isIn(["active", "inactive", "blocked"])
    .withMessage("Status must be active, inactive, or blocked"),
];

// Booking validation
exports.validateBooking = [
  body("customerId")
    .notEmpty()
    .withMessage("Customer ID is required")
    .isUUID()
    .withMessage("Invalid customer ID format"),

  body("vehicleId")
    .notEmpty()
    .withMessage("Vehicle ID is required")
    .isUUID()
    .withMessage("Invalid vehicle ID format"),

  body("pickupDate")
    .isISO8601()
    .withMessage("Please enter a valid pickup date")
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error("Pickup date cannot be in the past");
      }
      return true;
    }),

  body("returnDate")
    .isISO8601()
    .withMessage("Please enter a valid return date")
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.pickupDate)) {
        throw new Error("Return date must be after pickup date");
      }
      return true;
    }),

  body("pickupTime")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Please enter a valid pickup time (HH:MM format)"),

  body("returnTime")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Please enter a valid return time (HH:MM format)"),

  body("pickupLocation")
    .isIn([
      "Tangier Airport",
      "Tangier City Center",
      "Tangier Port",
      "Hotel Pickup",
      "Custom Location",
    ])
    .withMessage("Please select a valid pickup location"),

  body("returnLocation")
    .isIn([
      "Tangier Airport",
      "Tangier City Center",
      "Tangier Port",
      "Hotel Pickup",
      "Custom Location",
    ])
    .withMessage("Please select a valid return location"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot be more than 500 characters"),
];

// Booking update validation
exports.validateBookingUpdate = [
  body("pickupDate")
    .optional()
    .isISO8601()
    .withMessage("Please enter a valid pickup date"),

  body("returnDate")
    .optional()
    .isISO8601()
    .withMessage("Please enter a valid return date"),

  body("pickupTime")
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Please enter a valid pickup time (HH:MM format)"),

  body("returnTime")
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Please enter a valid return time (HH:MM format)"),

  body("pickupLocation")
    .optional()
    .isIn([
      "Tangier Airport",
      "Tangier City Center",
      "Tangier Port",
      "Hotel Pickup",
      "Custom Location",
    ])
    .withMessage("Please select a valid pickup location"),

  body("returnLocation")
    .optional()
    .isIn([
      "Tangier Airport",
      "Tangier City Center",
      "Tangier Port",
      "Hotel Pickup",
      "Custom Location",
    ])
    .withMessage("Please select a valid return location"),

  body("status")
    .optional()
    .isIn(["pending", "confirmed", "active", "completed", "cancelled"])
    .withMessage("Invalid status"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot be more than 500 characters"),
];

// Parameter validations
exports.validateUUID = [param("id").isUUID().withMessage("Invalid ID format")];

// Query validations
exports.validatePagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];
