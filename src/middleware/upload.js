// src/middleware/upload.js - UPDATED: Added support for passport and CIN images
const multer = require("multer");
const path = require("path");

// Using memory storage instead of disk storage
// This stores files in memory as Buffer objects, which we can directly save to PostgreSQL as BYTEA
const memoryStorage = multer.memoryStorage();

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
          "Seuls les fichiers image avec les extensions .jpg, .jpeg, .png, .webp, .gif sont autorisés"
        ),
        false
      );
    }
  } else {
    cb(new Error("Seuls les fichiers image sont autorisés"), false);
  }
};

// Create multer upload instances with memory storage
const vehicleUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 6, // 1 main image + 5 additional images
  },
  fileFilter: imageFileFilter,
});

// UPDATED: Customer upload for multiple document types
const customerUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 3, // driver license + passport + CIN
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

// UPDATED: Middleware for customer document uploads (multiple document types)
exports.uploadCustomerDocuments = customerUpload.fields([
  { name: "driverLicenseImage", maxCount: 1 },
  { name: "passportImage", maxCount: 1 },
  { name: "cinImage", maxCount: 1 },
]);

// Legacy middleware for single driver license upload (backward compatibility)
exports.uploadDriverLicense = customerUpload.single("driverLicenseImage");

// NEW: Individual document upload middlewares
exports.uploadPassportImage = customerUpload.single("passportImage");
exports.uploadCinImage = customerUpload.single("cinImage");

// Middleware for any single image
exports.uploadSingleImage = vehicleUpload.single("image");

// UPDATED: Error handling middleware for multer with French messages
exports.handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    let message = "Erreur de téléchargement";
    let statusCode = 400;

    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        message = `Fichier trop volumineux. La taille maximale est de ${
          (parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024) /
          (1024 * 1024)
        }MB`;
        break;
      case "LIMIT_FILE_COUNT":
        message = "Trop de fichiers. Maximum 3 documents par client";
        break;
      case "LIMIT_UNEXPECTED_FILE":
        message = "Champ de fichier inattendu";
        break;
      case "LIMIT_FIELD_KEY":
        message = "Nom de champ trop long";
        break;
      case "LIMIT_FIELD_VALUE":
        message = "Valeur de champ trop longue";
        break;
      case "LIMIT_FIELD_COUNT":
        message = "Trop de champs";
        break;
      case "LIMIT_PART_COUNT":
        message = "Trop de parties";
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
    err.message.includes("Seuls les fichiers image") ||
    err.message.includes("Seuls les fichiers image avec les extensions")
  ) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  next(err);
};

// UPDATED: Middleware to validate uploaded images for customers
exports.validateCustomerImages = (req, res, next) => {
  const errors = [];

  if (req.files) {
    // Check driver license image
    if (req.files.driverLicenseImage && req.files.driverLicenseImage[0]) {
      const file = req.files.driverLicenseImage[0];
      if (file.size === 0) {
        errors.push("Le fichier du permis de conduire est vide");
      }
      if (!file.buffer || file.buffer.length === 0) {
        errors.push("Les données du permis de conduire sont corrompues");
      }
    }

    // NEW: Check passport image
    if (req.files.passportImage && req.files.passportImage[0]) {
      const file = req.files.passportImage[0];
      if (file.size === 0) {
        errors.push("Le fichier du passeport est vide");
      }
      if (!file.buffer || file.buffer.length === 0) {
        errors.push("Les données du passeport sont corrompues");
      }
    }

    // NEW: Check CIN image
    if (req.files.cinImage && req.files.cinImage[0]) {
      const file = req.files.cinImage[0];
      if (file.size === 0) {
        errors.push("Le fichier de la CIN est vide");
      }
      if (!file.buffer || file.buffer.length === 0) {
        errors.push("Les données de la CIN sont corrompues");
      }
    }
  }

  // Check single file upload (backward compatibility)
  if (req.file) {
    if (req.file.size === 0) {
      errors.push("Le fichier téléchargé est vide");
    }
    if (!req.file.buffer || req.file.buffer.length === 0) {
      errors.push("Les données du fichier sont corrompues");
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Fichiers téléchargés invalides",
      errors,
    });
  }

  next();
};

// Middleware to validate uploaded images for vehicles (unchanged)
exports.validateImages = (req, res, next) => {
  const errors = [];

  if (req.files) {
    // Check main image
    if (req.files.mainImage && req.files.mainImage[0]) {
      const file = req.files.mainImage[0];
      if (file.size === 0) {
        errors.push("Main image file is empty");
      }
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

// NEW: Helper function to process customer document uploads
exports.processCustomerDocuments = (req, res, next) => {
  // Process driver license image
  if (
    req.files &&
    req.files.driverLicenseImage &&
    req.files.driverLicenseImage[0]
  ) {
    const file = req.files.driverLicenseImage[0];
    req.body.driverLicenseImageData = file.buffer;
    req.body.driverLicenseImageMimetype = file.mimetype;
    req.body.driverLicenseImageName = file.originalname;
  }

  // NEW: Process passport image
  if (req.files && req.files.passportImage && req.files.passportImage[0]) {
    const file = req.files.passportImage[0];
    req.body.passportImageData = file.buffer;
    req.body.passportImageMimetype = file.mimetype;
    req.body.passportImageName = file.originalname;
  }

  // NEW: Process CIN image
  if (req.files && req.files.cinImage && req.files.cinImage[0]) {
    const file = req.files.cinImage[0];
    req.body.cinImageData = file.buffer;
    req.body.cinImageMimetype = file.mimetype;
    req.body.cinImageName = file.originalname;
  }

  // Handle single file upload (backward compatibility)
  if (req.file) {
    // Determine which type of document based on field name
    const fieldName = req.file.fieldname;
    switch (fieldName) {
      case "driverLicenseImage":
        req.body.driverLicenseImageData = req.file.buffer;
        req.body.driverLicenseImageMimetype = req.file.mimetype;
        req.body.driverLicenseImageName = req.file.originalname;
        break;
      case "passportImage":
        req.body.passportImageData = req.file.buffer;
        req.body.passportImageMimetype = req.file.mimetype;
        req.body.passportImageName = req.file.originalname;
        break;
      case "cinImage":
        req.body.cinImageData = req.file.buffer;
        req.body.cinImageMimetype = req.file.mimetype;
        req.body.cinImageName = req.file.originalname;
        break;
    }
  }

  next();
};

// NEW: Validation for specific document types
exports.validateDocumentType = (documentType) => {
  return (req, res, next) => {
    const allowedTypes = ["driverLicense", "passport", "cin"];

    if (!allowedTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: "Type de document invalide",
      });
    }

    // Check if the correct file field is present
    const fieldMap = {
      driverLicense: "driverLicenseImage",
      passport: "passportImage",
      cin: "cinImage",
    };

    const expectedField = fieldMap[documentType];

    if (!req.file && (!req.files || !req.files[expectedField])) {
      return res.status(400).json({
        success: false,
        message: `Veuillez télécharger une image de ${
          documentType === "driverLicense"
            ? "permis de conduire"
            : documentType === "passport"
            ? "passeport"
            : "CIN"
        }`,
      });
    }

    next();
  };
};

// NEW: Get file info helper
exports.getFileInfo = (file) => {
  if (!file) return null;

  return {
    name: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
    buffer: file.buffer,
  };
};

// NEW: Validate file size for specific document
exports.validateFileSize = (maxSizeInMB = 10) => {
  return (req, res, next) => {
    const maxSize = maxSizeInMB * 1024 * 1024;

    let fileToCheck = req.file;
    if (!fileToCheck && req.files) {
      // Get the first file from any field
      const fileArrays = Object.values(req.files);
      if (fileArrays.length > 0 && fileArrays[0].length > 0) {
        fileToCheck = fileArrays[0][0];
      }
    }

    if (fileToCheck && fileToCheck.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: `Le fichier est trop volumineux. Taille maximale: ${maxSizeInMB}MB`,
      });
    }

    next();
  };
};

// Export constants for use in other files
exports.UPLOAD_LIMITS = {
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
  MAX_VEHICLE_FILES: 6,
  MAX_CUSTOMER_FILES: 3,
  ALLOWED_EXTENSIONS: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
  ALLOWED_MIMETYPES: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ],
};

// Export document field mapping
exports.DOCUMENT_FIELDS = {
  DRIVER_LICENSE: "driverLicenseImage",
  PASSPORT: "passportImage",
  CIN: "cinImage",
};
