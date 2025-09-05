// src/middleware/upload.js - Updated with memory storage for BYTEA
const multer = require("multer");
const path = require("path");

// CHANGED: Using memory storage instead of disk storage
// This stores files in memory as Buffer objects, which we can directly save to PostgreSQL as BYTEA
const memoryStorage = multer.memoryStorage();

// File filter for images (same as before)
const imageFileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype.startsWith("image/")) {
    // Check file extension as well
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only image files with extensions .jpg, .jpeg, .png, .webp, .gif are allowed"
        ),
        false
      );
    }
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

// UPDATED: Create multer upload instances with memory storage
const vehicleUpload = multer({
  storage: memoryStorage, // CHANGED: Using memory storage
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 6, // 1 main image + 5 additional images
  },
  fileFilter: imageFileFilter,
});

const customerUpload = multer({
  storage: memoryStorage, // CHANGED: Using memory storage
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 1,
  },
  fileFilter: imageFileFilter,
});

// Middleware for single main image upload
exports.uploadMainImage = vehicleUpload.single("mainImage");

// Middleware for multiple images upload (max 5 additional images + 1 main image)
exports.uploadMultipleImages = vehicleUpload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "additionalImages", maxCount: 5 },
]);

// Middleware for customer driver license upload
exports.uploadDriverLicense = customerUpload.single("driverLicenseImage");

// Middleware for any single image
exports.uploadSingleImage = vehicleUpload.single("image");

// REMOVED: Generic file upload and disk storage configurations
// We no longer need disk storage since everything goes to database

// Error handling middleware for multer (same as before)
exports.handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    let message = "Upload error";
    let statusCode = 400;

    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        message = `File too large. Maximum size is ${
          (parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024) /
          (1024 * 1024)
        }MB`;
        break;
      case "LIMIT_FILE_COUNT":
        message = "Too many files. Maximum is 6 images total";
        break;
      case "LIMIT_UNEXPECTED_FILE":
        message = "Unexpected file field";
        break;
      case "LIMIT_FIELD_KEY":
        message = "Field name too long";
        break;
      case "LIMIT_FIELD_VALUE":
        message = "Field value too long";
        break;
      case "LIMIT_FIELD_COUNT":
        message = "Too many fields";
        break;
      case "LIMIT_PART_COUNT":
        message = "Too many parts";
        break;
      default:
        message = err.message;
    }

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  if (
    err.message.includes("Only image files") ||
    err.message.includes("Only image files with extensions")
  ) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  next(err);
};

// REMOVED: File cleanup functions since we no longer save to disk

// Middleware to validate uploaded images (updated for memory storage)
exports.validateImages = (req, res, next) => {
  const errors = [];

  if (req.files) {
    // Check main image
    if (req.files.mainImage && req.files.mainImage[0]) {
      const file = req.files.mainImage[0];
      if (file.size === 0) {
        errors.push("Main image file is empty");
      }
      // With memory storage, we have access to file.buffer
      if (!file.buffer || file.buffer.length === 0) {
        errors.push("Main image data is corrupted");
      }
    }

    // Check additional images
    if (req.files.additionalImages) {
      req.files.additionalImages.forEach((file, index) => {
        if (file.size === 0) {
          errors.push(`Additional image ${index + 1} is empty`);
        }
        if (!file.buffer || file.buffer.length === 0) {
          errors.push(`Additional image ${index + 1} data is corrupted`);
        }
      });
    }

    // Check driver license
    if (req.files.driverLicenseImage && req.files.driverLicenseImage[0]) {
      const file = req.files.driverLicenseImage[0];
      if (file.size === 0) {
        errors.push("Driver license image file is empty");
      }
      if (!file.buffer || file.buffer.length === 0) {
        errors.push("Driver license image data is corrupted");
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid uploaded files",
      errors,
    });
  }

  next();
};
