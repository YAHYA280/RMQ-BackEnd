// src/middleware/upload.js
const multer = require("multer");
const path = require("path");

// Create multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads/vehicles");
  },
  filename: (req, file, cb) => {
    // Create unique filename: vehicleid-timestamp-originalname
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Please upload only image files"), false);
  }
};

// Create multer upload
const upload = multer({
  storage: storage,
  limits: {
    fileSize: process.env.MAX_FILE_SIZE || 5000000, // 5MB
  },
  fileFilter: fileFilter,
});

// Middleware for single main image upload
exports.uploadMainImage = upload.single("mainImage");

// Middleware for multiple images upload (max 5 additional images)
exports.uploadMultipleImages = upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "additionalImages", maxCount: 5 },
]);

// Error handling middleware for multer
exports.handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files. Maximum is 6 images total",
      });
    }
  }

  if (err.message === "Please upload only image files") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  next(err);
};
