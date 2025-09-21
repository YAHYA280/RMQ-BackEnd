// src/utils/validation.js - UPDATED: Removed validation for city, postalCode, emergencyContact, notes, and referralCode
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
    .isLength({ min: 1, max: 100 })
    .withMessage("Vehicle name must be between 1 and 100 characters"),

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
    .isLength({ min: 1, max: 100 })
    .withMessage("Vehicle name must be between 1 and 100 characters"),

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

// UPDATED: Customer validation with simplified fields (removed city, postalCode, notes, emergencyContact)
exports.validateCustomer = [
  // Basic required fields
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("Prénom est requis")
    .isLength({ min: 2, max: 50 })
    .withMessage("Le prénom doit contenir entre 2 et 50 caractères"),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Nom est requis")
    .isLength({ min: 2, max: 50 })
    .withMessage("Le nom doit contenir entre 2 et 50 caractères"),

  // Email is optional
  body("email")
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .withMessage("Veuillez saisir un email valide")
    .normalizeEmail(),

  // Phone validation with proper Moroccan format
  body("phone")
    .matches(/^0[67]\d{8}$/)
    .withMessage(
      "Veuillez saisir un numéro de téléphone marocain valide (06XXXXXXXX ou 07XXXXXXXX)"
    ),

  // Date of birth validation
  body("dateOfBirth")
    .optional()
    .isISO8601()
    .withMessage("Veuillez saisir une date de naissance valide")
    .custom((value) => {
      if (value) {
        const birthDate = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();

        if (age < 18) {
          throw new Error("Le client doit avoir au moins 18 ans");
        }
        if (age > 100) {
          throw new Error("Date de naissance invalide");
        }
      }
      return true;
    }),

  // Address validation (simplified to single field)
  body("address")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("L'adresse ne peut pas dépasser 500 caractères"),

  // Country validation
  body("country")
    .optional()
    .isLength({ min: 2, max: 2 })
    .withMessage("Le code pays doit contenir exactement 2 caractères"),

  // Driver license number validation
  body("driverLicenseNumber")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage(
      "Le numéro de permis de conduire ne peut pas dépasser 20 caractères"
    ),

  // Passport number validation
  body("passportNumber")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Le numéro de passeport ne peut pas dépasser 20 caractères"),

  // Passport issued at validation
  body("passportIssuedAt")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage(
      "Le lieu de délivrance du passeport ne peut pas dépasser 100 caractères"
    ),

  // CIN number validation
  body("cinNumber")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Le numéro CIN ne peut pas dépasser 20 caractères"),
];

// UPDATED: Customer update validation with simplified fields
exports.validateCustomerUpdate = [
  body("firstName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Le prénom ne peut pas être vide")
    .isLength({ min: 2, max: 50 })
    .withMessage("Le prénom doit contenir entre 2 et 50 caractères"),

  body("lastName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Le nom ne peut pas être vide")
    .isLength({ min: 2, max: 50 })
    .withMessage("Le nom doit contenir entre 2 et 50 caractères"),

  // Email is optional for updates too
  body("email")
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .withMessage("Veuillez saisir un email valide")
    .normalizeEmail(),

  // Phone validation with proper Moroccan format
  body("phone")
    .optional()
    .matches(/^0[67]\d{8}$/)
    .withMessage(
      "Veuillez saisir un numéro de téléphone marocain valide (06XXXXXXXX ou 07XXXXXXXX)"
    ),

  // Date of birth validation for updates
  body("dateOfBirth")
    .optional()
    .isISO8601()
    .withMessage("Veuillez saisir une date de naissance valide")
    .custom((value) => {
      if (value) {
        const birthDate = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();

        if (age < 18) {
          throw new Error("Le client doit avoir au moins 18 ans");
        }
        if (age > 100) {
          throw new Error("Date de naissance invalide");
        }
      }
      return true;
    }),

  // Address validation for updates (simplified)
  body("address")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("L'adresse ne peut pas dépasser 500 caractères"),

  // Country validation
  body("country")
    .optional()
    .isLength({ min: 2, max: 2 })
    .withMessage("Le code pays doit contenir exactement 2 caractères"),

  // Document number validations for updates
  body("driverLicenseNumber")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage(
      "Le numéro de permis de conduire ne peut pas dépasser 20 caractères"
    ),

  body("passportNumber")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Le numéro de passeport ne peut pas dépasser 20 caractères"),

  body("passportIssuedAt")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage(
      "Le lieu de délivrance du passeport ne peut pas dépasser 100 caractères"
    ),

  body("cinNumber")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Le numéro CIN ne peut pas dépasser 20 caractères"),

  body("status")
    .optional()
    .isIn(["active", "inactive", "blocked"])
    .withMessage("Le statut doit être actif, inactif ou bloqué"),
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

// UPDATED: Website booking validation with simplified customer fields
exports.validateWebsiteBooking = [
  // Customer information (simplified)
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("Prénom est requis")
    .isLength({ min: 2, max: 50 })
    .withMessage("Le prénom doit contenir entre 2 et 50 caractères"),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Nom est requis")
    .isLength({ min: 2, max: 50 })
    .withMessage("Le nom doit contenir entre 2 et 50 caractères"),

  body("phone")
    .matches(/^0[67]\d{8}$/)
    .withMessage(
      "Veuillez saisir un numéro de téléphone marocain valide (06XXXXXXXX ou 07XXXXXXXX)"
    ),

  body("email")
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .withMessage("Veuillez saisir un email valide")
    .normalizeEmail(),

  // Vehicle and booking details
  body("vehicleId")
    .notEmpty()
    .withMessage("Vehicle ID is required")
    .isUUID()
    .withMessage("Invalid vehicle ID format"),

  body("pickupDate")
    .isISO8601()
    .withMessage("Please enter a valid pickup date")
    .custom((value) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(value) < today) {
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
    .trim()
    .notEmpty()
    .withMessage("Pickup location is required")
    .isIn([
      "Tangier Airport",
      "Tangier City Center",
      "Tangier Port",
      "Hotel Pickup",
      "Custom Location",
    ])
    .withMessage("Please select a valid pickup location"),

  body("returnLocation")
    .trim()
    .notEmpty()
    .withMessage("Return location is required")
    .isIn([
      "Tangier Airport",
      "Tangier City Center",
      "Tangier Port",
      "Hotel Pickup",
      "Custom Location",
    ])
    .withMessage("Please select a valid return location"),
];

// UPDATED: Admin booking validation (simplified)
exports.validateAdminBooking = [
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
    .withMessage("Please enter a valid pickup date"),

  body("returnDate")
    .isISO8601()
    .withMessage("Please enter a valid return date"),

  body("pickupTime")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Please enter a valid pickup time (HH:MM format)"),

  body("returnTime")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Please enter a valid return time (HH:MM format)"),

  body("pickupLocation")
    .trim()
    .notEmpty()
    .withMessage("Pickup location is required"),

  body("returnLocation")
    .trim()
    .notEmpty()
    .withMessage("Return location is required"),
];
