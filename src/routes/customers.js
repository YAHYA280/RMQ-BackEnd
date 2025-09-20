// src/routes/customers.js - UPDATED: Added routes for passport and CIN document uploads
const express = require("express");
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  updateCustomerStatus,
  uploadDriverLicense,
  uploadPassport, // NEW
  uploadCin, // NEW
  uploadCustomerDocuments, // NEW
  getCustomerStats,
  searchCustomers,
} = require("../controllers/customers");

const { protect, authorize } = require("../middleware/auth");
const {
  uploadDriverLicense: uploadDriverLicenseMiddleware,
  uploadPassportImage, // NEW
  uploadCinImage, // NEW
  uploadCustomerDocuments: uploadCustomerDocumentsMiddleware, // NEW
  handleUploadError,
  validateCustomerImages, // NEW
  processCustomerDocuments, // NEW
  validateDocumentType, // NEW
  validateFileSize, // NEW
} = require("../middleware/upload");
const {
  validateCustomer,
  validateCustomerUpdate,
  validateUUID,
  validatePagination,
} = require("../utils/validation");

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(authorize("admin", "super-admin"));

// IMPORTANT: Specific routes must come BEFORE parameterized routes

// Search customers - must come before /:id routes
router.get("/search", searchCustomers);

// Get customer statistics - must come before /:id routes
router.get("/stats", getCustomerStats);

// Get all customers with pagination and filtering
router.get("/", validatePagination, getCustomers);

// Create new customer with document uploads
router.post(
  "/",
  uploadCustomerDocumentsMiddleware, // Handle multiple document types
  handleUploadError,
  validateCustomerImages,
  processCustomerDocuments,
  validateCustomer,
  createCustomer
);

// ========== SINGLE CUSTOMER ROUTES (/:id) ==========
// These routes operate on specific customers by ID

// Get single customer
router.get("/:id", validateUUID, getCustomer);

// Update customer with document uploads
router.put(
  "/:id",
  validateUUID,
  uploadCustomerDocumentsMiddleware, // Handle multiple document types
  handleUploadError,
  validateCustomerImages,
  processCustomerDocuments,
  validateCustomerUpdate,
  updateCustomer
);

// Delete customer (super-admin only)
router.delete("/:id", validateUUID, authorize("super-admin"), deleteCustomer);

// ========== STATUS MANAGEMENT ==========

// Update customer status
router.put("/:id/status", validateUUID, updateCustomerStatus);

// ========== DOCUMENT UPLOAD ENDPOINTS ==========
// These routes handle individual document uploads

// LEGACY: Upload driver license only (backward compatibility)
router.put(
  "/:id/driver-license",
  validateUUID,
  uploadDriverLicenseMiddleware,
  handleUploadError,
  validateCustomerImages,
  validateDocumentType("driverLicense"),
  validateFileSize(10), // 10MB max
  uploadDriverLicense
);

// NEW: Upload passport only
router.put(
  "/:id/passport",
  validateUUID,
  uploadPassportImage,
  handleUploadError,
  validateCustomerImages,
  validateDocumentType("passport"),
  validateFileSize(10), // 10MB max
  uploadPassport
);

// NEW: Upload CIN only
router.put(
  "/:id/cin",
  validateUUID,
  uploadCinImage,
  handleUploadError,
  validateCustomerImages,
  validateDocumentType("cin"),
  validateFileSize(10), // 10MB max
  uploadCin
);

// NEW: Upload multiple documents at once
router.put(
  "/:id/documents",
  validateUUID,
  uploadCustomerDocumentsMiddleware, // Handle all document types
  handleUploadError,
  validateCustomerImages,
  processCustomerDocuments,
  validateFileSize(10), // 10MB max per file
  uploadCustomerDocuments
);

// ========== ADDITIONAL UTILITY ROUTES ==========

// NEW: Get customer document completion status
router.get("/:id/documents/status", validateUUID, async (req, res, next) => {
  try {
    const { Customer } = require("../models");
    const customer = await Customer.findByPk(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Client non trouvé",
      });
    }

    const documentStatus = customer.hasCompleteDocumentation();

    res.status(200).json({
      success: true,
      data: {
        customerId: customer.id,
        customerName: `${customer.firstName} ${customer.lastName}`,
        documentCompletion: documentStatus,
        documents: {
          driverLicense: {
            hasNumber: !!customer.driverLicenseNumber,
            hasImage: !!customer.driverLicenseImageData,
            complete: !!(
              customer.driverLicenseNumber && customer.driverLicenseImageData
            ),
          },
          passport: {
            hasNumber: !!customer.passportNumber,
            hasImage: !!customer.passportImageData,
            hasIssuedAt: !!customer.passportIssuedAt,
            complete: !!(customer.passportNumber && customer.passportImageData),
          },
          cin: {
            hasNumber: !!customer.cinNumber,
            hasImage: !!customer.cinImageData,
            complete: !!(customer.cinNumber && customer.cinImageData),
          },
          personal: {
            hasDateOfBirth: !!customer.dateOfBirth,
            hasAddress: !!customer.address,
            hasAge: !!customer.getAge(),
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// NEW: Remove specific document
router.delete(
  "/:id/documents/:documentType",
  validateUUID,
  async (req, res, next) => {
    try {
      const { Customer } = require("../models");
      const { documentType } = req.params;

      const allowedTypes = ["driverLicense", "passport", "cin"];
      if (!allowedTypes.includes(documentType)) {
        return res.status(400).json({
          success: false,
          message: "Type de document invalide",
        });
      }

      const customer = await Customer.findByPk(req.params.id);

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Client non trouvé",
        });
      }

      // Prepare update data to remove document
      let updateData = {};
      let documentName = "";

      switch (documentType) {
        case "driverLicense":
          updateData = {
            driverLicenseImageData: null,
            driverLicenseImageMimetype: null,
            driverLicenseImageName: null,
          };
          documentName = "permis de conduire";
          break;
        case "passport":
          updateData = {
            passportImageData: null,
            passportImageMimetype: null,
            passportImageName: null,
          };
          documentName = "passeport";
          break;
        case "cin":
          updateData = {
            cinImageData: null,
            cinImageMimetype: null,
            cinImageName: null,
          };
          documentName = "CIN";
          break;
      }

      await customer.update(updateData);

      res.status(200).json({
        success: true,
        message: `Image du ${documentName} supprimée avec succès`,
        data: {
          customerId: customer.id,
          removedDocument: documentType,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// NEW: Get customers with incomplete documents
router.get(
  "/filter/incomplete-documents",
  validatePagination,
  async (req, res, next) => {
    try {
      const { Customer, Admin } = require("../models");
      const { Op } = require("sequelize");
      const { page = 1, limit = 25 } = req.query;

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;

      // Find customers with incomplete documentation
      const { count, rows: customers } = await Customer.findAndCountAll({
        where: {
          [Op.or]: [
            { driverLicenseNumber: { [Op.is]: null } },
            { driverLicenseImageData: { [Op.is]: null } },
            { passportNumber: { [Op.is]: null } },
            { passportImageData: { [Op.is]: null } },
            { cinNumber: { [Op.is]: null } },
            { cinImageData: { [Op.is]: null } },
            { dateOfBirth: { [Op.is]: null } },
            { address: { [Op.is]: null } },
          ],
        },
        limit: limitNum,
        offset,
        order: [["createdAt", "DESC"]],
        include: [
          {
            model: Admin,
            as: "createdBy",
            attributes: ["id", "name", "email"],
          },
        ],
      });

      // Transform customers with document completion status
      const transformedCustomers = customers.map((customer) => {
        const customerData = customer.toJSON();
        customerData.documentCompletion = customer.hasCompleteDocumentation();
        return customerData;
      });

      res.status(200).json({
        success: true,
        count: transformedCustomers.length,
        total: count,
        data: transformedCustomers,
        pagination: {
          current: pageNum,
          totalPages: Math.ceil(count / limitNum),
          ...(pageNum < Math.ceil(count / limitNum) && {
            next: { page: pageNum + 1, limit: limitNum },
          }),
          ...(pageNum > 1 && {
            prev: { page: pageNum - 1, limit: limitNum },
          }),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// NEW: Bulk document upload for multiple customers
router.post("/bulk/documents", async (req, res, next) => {
  try {
    const { customers } = req.body; // Array of customer updates

    if (!customers || !Array.isArray(customers)) {
      return res.status(400).json({
        success: false,
        message:
          "Format de données invalide. Un tableau de clients est requis.",
      });
    }

    const { Customer } = require("../models");
    const results = [];
    const errors = [];

    for (const customerUpdate of customers) {
      try {
        const { id, ...updateData } = customerUpdate;

        const customer = await Customer.findByPk(id);
        if (!customer) {
          errors.push({
            customerId: id,
            error: "Client non trouvé",
          });
          continue;
        }

        await customer.update(updateData);
        results.push({
          customerId: id,
          customerName: `${customer.firstName} ${customer.lastName}`,
          updated: true,
        });
      } catch (error) {
        errors.push({
          customerId: customerUpdate.id,
          error: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Mise à jour en lot terminée. ${results.length} clients mis à jour, ${errors.length} erreurs.`,
      data: {
        successful: results,
        errors: errors,
        summary: {
          total: customers.length,
          successful: results.length,
          failed: errors.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
