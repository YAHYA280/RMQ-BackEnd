// src/utils/validation.js
const { body } = require("express-validator");

// Admin registration validation
exports.validateAdminRegistration = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),

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

// Vehicle validation
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

  body("model").trim().notEmpty().withMessage("Vehicle model is required"),

  body("year")
    .isInt({ min: 2000, max: new Date().getFullYear() + 1 })
    .withMessage(
      `Year must be between 2000 and ${new Date().getFullYear() + 1}`
    ),

  body("price")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  body("transmission")
    .isIn(["Manual", "Automatic"])
    .withMessage("Transmission must be either Manual or Automatic"),

  body("fuelType")
    .isIn(["Petrol", "Diesel", "Electric", "Hybrid"])
    .withMessage("Fuel type must be Petrol, Diesel, Electric, or Hybrid"),

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
    .matches(/^(\+212|212|0)[5-7]\d{8}$/)
    .withMessage("Please enter a valid Moroccan phone number"),

  body("caution")
    .isFloat({ min: 0 })
    .withMessage("Caution must be a positive number"),

  body("mileage")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Mileage must be a positive number"),

  body("location")
    .isIn(["Tangier Airport", "Tangier City Center", "Tangier Port"])
    .withMessage("Please select a valid location"),

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

  body("model")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Vehicle model cannot be empty"),

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
    .isIn(["Manual", "Automatic"])
    .withMessage("Transmission must be either Manual or Automatic"),

  body("fuelType")
    .optional()
    .isIn(["Petrol", "Diesel", "Electric", "Hybrid"])
    .withMessage("Fuel type must be Petrol, Diesel, Electric, or Hybrid"),

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
    .matches(/^(\+212|212|0)[5-7]\d{8}$/)
    .withMessage("Please enter a valid Moroccan phone number"),

  body("caution")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Caution must be a positive number"),

  body("mileage")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Mileage must be a positive number"),

  body("location")
    .optional()
    .isIn(["Tangier Airport", "Tangier City Center", "Tangier Port"])
    .withMessage("Please select a valid location"),

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

  body("available")
    .optional()
    .isBoolean()
    .withMessage("Available status must be true or false"),

  body("lastTechnicalVisit")
    .optional()
    .isISO8601()
    .withMessage("Please enter a valid date for last technical visit"),

  body("lastOilChange")
    .optional()
    .isISO8601()
    .withMessage("Please enter a valid date for last oil change"),
];
