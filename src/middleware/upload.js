// src/middleware/upload.js - Updated with better error handling
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directories exist
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Create multer storage for vehicles
const vehicleStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads/vehicles");
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Create unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    const filename = `vehicle-${uniqueSuffix}${extension}`;
    cb(null, filename);
  },
});

// Create multer storage for customers (driver licenses)
const customerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads/customers");
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    const filename = `license-${uniqueSuffix}${extension}`;
    cb(null, filename);
  },
});

// File filter for images
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

// Create multer upload instances
const vehicleUpload = multer({
  storage: vehicleStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 6, // 1 main image + 5 additional images
  },
  fileFilter: imageFileFilter,
});

const customerUpload = multer({
  storage: customerStorage,
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

// Generic upload for any file type (be careful with this)
const genericStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads/misc");
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    const filename = `file-${uniqueSuffix}${extension}`;
    cb(null, filename);
  },
});

const genericUpload = multer({
  storage: genericStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
  },
});

exports.uploadGeneric = genericUpload.single("file");

// Error handling middleware for multer
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

// Utility function to delete uploaded files (in case of error)
exports.cleanupUploadedFiles = (files) => {
  if (!files) return;

  const filesToDelete = [];

  // Handle single file
  if (files.path) {
    filesToDelete.push(files.path);
  }

  // Handle multiple files from multer
  if (files.mainImage) {
    filesToDelete.push(...files.mainImage.map((file) => file.path));
  }

  if (files.additionalImages) {
    filesToDelete.push(...files.additionalImages.map((file) => file.path));
  }

  if (files.driverLicenseImage) {
    filesToDelete.push(...files.driverLicenseImage.map((file) => file.path));
  }

  // Handle array of files
  if (Array.isArray(files)) {
    filesToDelete.push(...files.map((file) => file.path));
  }

  // Delete files
  filesToDelete.forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.warn(
          `Warning: Could not delete file ${filePath}:`,
          error.message
        );
      }
    }
  });
};

// Middleware to validate uploaded images
exports.validateImages = (req, res, next) => {
  const errors = [];

  if (req.files) {
    // Check main image
    if (req.files.mainImage && req.files.mainImage[0]) {
      const file = req.files.mainImage[0];
      if (file.size === 0) {
        errors.push("Main image file is empty");
      }
    }

    // Check additional images
    if (req.files.additionalImages) {
      req.files.additionalImages.forEach((file, index) => {
        if (file.size === 0) {
          errors.push(`Additional image ${index + 1} is empty`);
        }
      });
    }

    // Check driver license
    if (req.files.driverLicenseImage && req.files.driverLicenseImage[0]) {
      const file = req.files.driverLicenseImage[0];
      if (file.size === 0) {
        errors.push("Driver license image file is empty");
      }
    }
  }

  if (errors.length > 0) {
    // Clean up uploaded files
    exports.cleanupUploadedFiles(req.files);

    return res.status(400).json({
      success: false,
      message: "Invalid uploaded files",
      errors,
    });
  }

  next();
};
