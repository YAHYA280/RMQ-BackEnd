// src/controllers/customers.js - UPDATED: Removed city, postalCode, emergencyContact, notes, and referralCode
const { Customer, Admin } = require("../models/index");
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const asyncHandler = require("../middleware/asyncHandler");
const ErrorResponse = require("../utils/errorResponse");

// UPDATED: Helper function to transform customer data for response with simplified fields
const transformCustomerForResponse = (customer) => {
  const customerData = customer.toJSON();

  // Convert driver license image BYTEA to data URL
  if (customer.driverLicenseImageData && customer.driverLicenseImageMimetype) {
    customerData.driverLicenseImage = {
      dataUrl: customer.getDriverLicenseImageDataUrl(),
      mimetype: customer.driverLicenseImageMimetype,
      name: customer.driverLicenseImageName || "permis-conduire",
    };
  }

  // Convert passport image BYTEA to data URL
  if (customer.passportImageData && customer.passportImageMimetype) {
    customerData.passportImage = {
      dataUrl: customer.getPassportImageDataUrl(),
      mimetype: customer.passportImageMimetype,
      name: customer.passportImageName || "passeport",
    };
  }

  // Convert CIN image BYTEA to data URL
  if (customer.cinImageData && customer.cinImageMimetype) {
    customerData.cinImage = {
      dataUrl: customer.getCinImageDataUrl(),
      mimetype: customer.cinImageMimetype,
      name: customer.cinImageName || "cin",
    };
  }

  // Format phone number for display
  customerData.phoneFormatted = customer.getFormattedPhone();

  // Add document completion status
  customerData.documentCompletion = customer.hasCompleteDocumentation();

  // Add age if date of birth is available
  if (customer.dateOfBirth) {
    customerData.age = customer.getAge();
  }

  return customerData;
};

// @desc    Get all customers with filtering and pagination
// @route   GET /api/customers
// @access  Private (admin)
exports.getCustomers = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 25,
    search,
    status,
    sort = "createdAt",
    order = "DESC",
    source,
    tier,
    documentStatus,
  } = req.query;

  // Build where clause
  const where = {};

  if (status) {
    where.status = Array.isArray(status) ? { [Op.in]: status } : status;
  }

  if (source) {
    where.source = Array.isArray(source) ? { [Op.in]: source } : source;
  }

  // Filter by document completion status
  if (documentStatus) {
    switch (documentStatus) {
      case "complete":
        where[Op.and] = [
          { driverLicenseNumber: { [Op.ne]: null } },
          { passportNumber: { [Op.ne]: null } },
          { cinNumber: { [Op.ne]: null } },
          { dateOfBirth: { [Op.ne]: null } },
          { address: { [Op.ne]: null } },
        ];
        break;
      case "incomplete":
        where[Op.or] = [
          { driverLicenseNumber: { [Op.is]: null } },
          { passportNumber: { [Op.is]: null } },
          { cinNumber: { [Op.is]: null } },
          { dateOfBirth: { [Op.is]: null } },
          { address: { [Op.is]: null } },
        ];
        break;
      case "no-documents":
        where[Op.and] = [
          { driverLicenseNumber: { [Op.is]: null } },
          { passportNumber: { [Op.is]: null } },
          { cinNumber: { [Op.is]: null } },
        ];
        break;
    }
  }

  // UPDATED: Enhanced search functionality with simplified fields
  if (search) {
    where[Op.or] = [
      { firstName: { [Op.iLike]: `%${search}%` } },
      { lastName: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } },
      // Search in document numbers
      { driverLicenseNumber: { [Op.iLike]: `%${search}%` } },
      { passportNumber: { [Op.iLike]: `%${search}%` } },
      { cinNumber: { [Op.iLike]: `%${search}%` } },
      { address: { [Op.iLike]: `%${search}%` } },
    ];
  }

  // Filter by customer tier
  if (tier) {
    switch (tier) {
      case "platinum":
        where.totalSpent = { [Op.gte]: 5000 };
        break;
      case "gold":
        where.totalSpent = { [Op.between]: [2000, 4999.99] };
        break;
      case "silver":
        where.totalSpent = { [Op.between]: [500, 1999.99] };
        break;
      case "bronze":
        where.totalSpent = { [Op.lt]: 500 };
        break;
    }
  }

  // Pagination
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  // Execute query
  const { count, rows: customers } = await Customer.findAndCountAll({
    where,
    limit: limitNum,
    offset,
    order: [[sort, order]],
    include: [
      {
        model: Admin,
        as: "createdBy",
        attributes: ["id", "name", "email"],
      },
    ],
  });

  // Transform customers for response
  const transformedCustomers = customers.map(transformCustomerForResponse);

  // Build pagination result
  const pagination = {};
  const totalPages = Math.ceil(count / limitNum);

  if (pageNum < totalPages) {
    pagination.next = { page: pageNum + 1, limit: limitNum };
  }

  if (pageNum > 1) {
    pagination.prev = { page: pageNum - 1, limit: limitNum };
  }

  pagination.current = pageNum;
  pagination.totalPages = totalPages;

  res.status(200).json({
    success: true,
    count: transformedCustomers.length,
    total: count,
    pagination,
    data: transformedCustomers,
  });
});

// @desc    Get single customer
// @route   GET /api/customers/:id
// @access  Private (admin)
exports.getCustomer = asyncHandler(async (req, res, next) => {
  const customer = await Customer.findByPk(req.params.id, {
    include: [
      {
        model: Admin,
        as: "createdBy",
        attributes: ["id", "name", "email"],
      },
    ],
  });

  if (!customer) {
    return next(new ErrorResponse("Client non trouvé", 404));
  }

  // Transform customer for response
  const customerData = transformCustomerForResponse(customer);

  res.status(200).json({
    success: true,
    data: customerData,
  });
});

// @desc    Create new customer
// @route   POST /api/customers
// @access  Private (admin)
exports.createCustomer = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse("Validation échouée", 400, errors.array()));
  }

  // Check email uniqueness only if email is provided
  if (req.body.email && req.body.email.trim() !== "") {
    const existingCustomer = await Customer.findOne({
      where: { email: req.body.email.trim() },
    });

    if (existingCustomer) {
      return next(
        new ErrorResponse("Un client avec cet email existe déjà", 400)
      );
    }
  } else {
    // Remove empty email
    req.body.email = null;
  }

  // Handle all document image uploads
  let documentData = {};

  // Process driver license image
  if (
    req.files &&
    req.files.driverLicenseImage &&
    req.files.driverLicenseImage[0]
  ) {
    const file = req.files.driverLicenseImage[0];
    documentData.driverLicenseImageData = file.buffer;
    documentData.driverLicenseImageMimetype = file.mimetype;
    documentData.driverLicenseImageName = file.originalname;
  }

  // Process passport image
  if (req.files && req.files.passportImage && req.files.passportImage[0]) {
    const file = req.files.passportImage[0];
    documentData.passportImageData = file.buffer;
    documentData.passportImageMimetype = file.mimetype;
    documentData.passportImageName = file.originalname;
  }

  // Process CIN image
  if (req.files && req.files.cinImage && req.files.cinImage[0]) {
    const file = req.files.cinImage[0];
    documentData.cinImageData = file.buffer;
    documentData.cinImageMimetype = file.mimetype;
    documentData.cinImageName = file.originalname;
  }

  // Handle single file upload (backward compatibility)
  if (req.file) {
    const fieldName = req.file.fieldname;
    switch (fieldName) {
      case "driverLicenseImage":
        documentData.driverLicenseImageData = req.file.buffer;
        documentData.driverLicenseImageMimetype = req.file.mimetype;
        documentData.driverLicenseImageName = req.file.originalname;
        break;
      case "passportImage":
        documentData.passportImageData = req.file.buffer;
        documentData.passportImageMimetype = req.file.mimetype;
        documentData.passportImageName = req.file.originalname;
        break;
      case "cinImage":
        documentData.cinImageData = req.file.buffer;
        documentData.cinImageMimetype = req.file.mimetype;
        documentData.cinImageName = req.file.originalname;
        break;
    }
  }

  // Add admin tracking and source
  req.body.createdById = req.admin.id;
  req.body.source = "admin";

  // Merge document data with form data
  const customerData = { ...req.body, ...documentData };

  // Create customer
  const customer = await Customer.create(customerData);

  // Fetch the created customer with associations
  const createdCustomer = await Customer.findByPk(customer.id, {
    include: [
      {
        model: Admin,
        as: "createdBy",
        attributes: ["id", "name", "email"],
      },
    ],
  });

  // Transform for response
  const responseData = transformCustomerForResponse(createdCustomer);

  res.status(201).json({
    success: true,
    message: "Client créé avec succès",
    data: responseData,
  });
});

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private (admin)
exports.updateCustomer = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse("Validation échouée", 400, errors.array()));
  }

  let customer = await Customer.findByPk(req.params.id);

  if (!customer) {
    return next(new ErrorResponse("Client non trouvé", 404));
  }

  // Check email uniqueness only if email is provided and changed
  if (
    req.body.email &&
    req.body.email.trim() !== "" &&
    req.body.email !== customer.email
  ) {
    const existingCustomer = await Customer.findOne({
      where: {
        email: req.body.email.trim(),
        id: { [Op.ne]: customer.id },
      },
    });

    if (existingCustomer) {
      return next(
        new ErrorResponse("Email déjà utilisé par un autre client", 400)
      );
    }
  } else if (!req.body.email || req.body.email.trim() === "") {
    // Remove empty email
    req.body.email = null;
  }

  // Handle all document image uploads for updates
  let documentUpdates = {};

  // Process driver license image
  if (
    req.files &&
    req.files.driverLicenseImage &&
    req.files.driverLicenseImage[0]
  ) {
    const file = req.files.driverLicenseImage[0];
    documentUpdates.driverLicenseImageData = file.buffer;
    documentUpdates.driverLicenseImageMimetype = file.mimetype;
    documentUpdates.driverLicenseImageName = file.originalname;
  }

  // Process passport image
  if (req.files && req.files.passportImage && req.files.passportImage[0]) {
    const file = req.files.passportImage[0];
    documentUpdates.passportImageData = file.buffer;
    documentUpdates.passportImageMimetype = file.mimetype;
    documentUpdates.passportImageName = file.originalname;
  }

  // Process CIN image
  if (req.files && req.files.cinImage && req.files.cinImage[0]) {
    const file = req.files.cinImage[0];
    documentUpdates.cinImageData = file.buffer;
    documentUpdates.cinImageMimetype = file.mimetype;
    documentUpdates.cinImageName = file.originalname;
  }

  // Handle single file upload (backward compatibility)
  if (req.file) {
    const fieldName = req.file.fieldname;
    switch (fieldName) {
      case "driverLicenseImage":
        documentUpdates.driverLicenseImageData = req.file.buffer;
        documentUpdates.driverLicenseImageMimetype = req.file.mimetype;
        documentUpdates.driverLicenseImageName = req.file.originalname;
        break;
      case "passportImage":
        documentUpdates.passportImageData = req.file.buffer;
        documentUpdates.passportImageMimetype = req.file.mimetype;
        documentUpdates.passportImageName = req.file.originalname;
        break;
      case "cinImage":
        documentUpdates.cinImageData = req.file.buffer;
        documentUpdates.cinImageMimetype = req.file.mimetype;
        documentUpdates.cinImageName = req.file.originalname;
        break;
    }
  }

  // Merge form data with document updates
  const updateData = { ...req.body, ...documentUpdates };

  // Update customer
  await customer.update(updateData);

  // Fetch updated customer with associations
  const updatedCustomer = await Customer.findByPk(req.params.id, {
    include: [
      {
        model: Admin,
        as: "createdBy",
        attributes: ["id", "name", "email"],
      },
    ],
  });

  // Transform for response
  const responseData = transformCustomerForResponse(updatedCustomer);

  res.status(200).json({
    success: true,
    message: "Client mis à jour avec succès",
    data: responseData,
  });
});

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private (super-admin only)
exports.deleteCustomer = asyncHandler(async (req, res, next) => {
  const customer = await Customer.findByPk(req.params.id);

  if (!customer) {
    return next(new ErrorResponse("Client non trouvé", 404));
  }

  // Check if customer has active bookings
  const { Booking } = require("../models");
  const activeBookings = await Booking.count({
    where: {
      customerId: customer.id,
      status: ["confirmed", "active"],
    },
  });

  if (activeBookings > 0) {
    return next(
      new ErrorResponse(
        "Impossible de supprimer un client avec des réservations actives. Veuillez d'abord terminer ou annuler toutes les réservations.",
        400
      )
    );
  }

  await customer.destroy();

  res.status(200).json({
    success: true,
    message: "Client supprimé avec succès",
    data: {},
  });
});

// @desc    Update customer status
// @route   PUT /api/customers/:id/status
// @access  Private (admin)
exports.updateCustomerStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;

  if (!["active", "inactive", "blocked"].includes(status)) {
    return next(new ErrorResponse("Statut invalide", 400));
  }

  const customer = await Customer.findByPk(req.params.id);

  if (!customer) {
    return next(new ErrorResponse("Client non trouvé", 404));
  }

  await customer.update({ status });

  // Transform for response
  const responseData = transformCustomerForResponse(customer);

  res.status(200).json({
    success: true,
    message: `Statut du client mis à jour vers ${status}`,
    data: responseData,
  });
});

// Upload customer driver license (legacy endpoint)
// @route   PUT /api/customers/:id/driver-license
// @access  Private (admin)
exports.uploadDriverLicense = asyncHandler(async (req, res, next) => {
  const customer = await Customer.findByPk(req.params.id);

  if (!customer) {
    return next(new ErrorResponse("Client non trouvé", 404));
  }

  if (!req.file) {
    return next(
      new ErrorResponse(
        "Veuillez télécharger une image du permis de conduire",
        400
      )
    );
  }

  // Store driver license image as BYTEA
  await customer.update({
    driverLicenseImageData: req.file.buffer,
    driverLicenseImageMimetype: req.file.mimetype,
    driverLicenseImageName: req.file.originalname,
  });

  // Transform for response
  const responseData = transformCustomerForResponse(customer);

  res.status(200).json({
    success: true,
    message: "Permis de conduire téléchargé avec succès",
    data: responseData,
  });
});

// Upload customer passport
// @route   PUT /api/customers/:id/passport
// @access  Private (admin)
exports.uploadPassport = asyncHandler(async (req, res, next) => {
  const customer = await Customer.findByPk(req.params.id);

  if (!customer) {
    return next(new ErrorResponse("Client non trouvé", 404));
  }

  if (!req.file) {
    return next(
      new ErrorResponse("Veuillez télécharger une image du passeport", 400)
    );
  }

  // Store passport image as BYTEA
  await customer.update({
    passportImageData: req.file.buffer,
    passportImageMimetype: req.file.mimetype,
    passportImageName: req.file.originalname,
  });

  // Transform for response
  const responseData = transformCustomerForResponse(customer);

  res.status(200).json({
    success: true,
    message: "Passeport téléchargé avec succès",
    data: responseData,
  });
});

// Upload customer CIN
// @route   PUT /api/customers/:id/cin
// @access  Private (admin)
exports.uploadCin = asyncHandler(async (req, res, next) => {
  const customer = await Customer.findByPk(req.params.id);

  if (!customer) {
    return next(new ErrorResponse("Client non trouvé", 404));
  }

  if (!req.file) {
    return next(
      new ErrorResponse("Veuillez télécharger une image de la CIN", 400)
    );
  }

  // Store CIN image as BYTEA
  await customer.update({
    cinImageData: req.file.buffer,
    cinImageMimetype: req.file.mimetype,
    cinImageName: req.file.originalname,
  });

  // Transform for response
  const responseData = transformCustomerForResponse(customer);

  res.status(200).json({
    success: true,
    message: "CIN téléchargée avec succès",
    data: responseData,
  });
});

// Upload multiple customer documents at once
// @route   PUT /api/customers/:id/documents
// @access  Private (admin)
exports.uploadCustomerDocuments = asyncHandler(async (req, res, next) => {
  const customer = await Customer.findByPk(req.params.id);

  if (!customer) {
    return next(new ErrorResponse("Client non trouvé", 404));
  }

  if (!req.files || Object.keys(req.files).length === 0) {
    return next(
      new ErrorResponse("Veuillez télécharger au moins un document", 400)
    );
  }

  let updateData = {};
  let uploadedDocuments = [];

  // Process driver license
  if (req.files.driverLicenseImage && req.files.driverLicenseImage[0]) {
    const file = req.files.driverLicenseImage[0];
    updateData.driverLicenseImageData = file.buffer;
    updateData.driverLicenseImageMimetype = file.mimetype;
    updateData.driverLicenseImageName = file.originalname;
    uploadedDocuments.push("permis de conduire");
  }

  // Process passport
  if (req.files.passportImage && req.files.passportImage[0]) {
    const file = req.files.passportImage[0];
    updateData.passportImageData = file.buffer;
    updateData.passportImageMimetype = file.mimetype;
    updateData.passportImageName = file.originalname;
    uploadedDocuments.push("passeport");
  }

  // Process CIN
  if (req.files.cinImage && req.files.cinImage[0]) {
    const file = req.files.cinImage[0];
    updateData.cinImageData = file.buffer;
    updateData.cinImageMimetype = file.mimetype;
    updateData.cinImageName = file.originalname;
    uploadedDocuments.push("CIN");
  }

  await customer.update(updateData);

  // Transform for response
  const responseData = transformCustomerForResponse(customer);

  res.status(200).json({
    success: true,
    message: `Documents téléchargés avec succès: ${uploadedDocuments.join(
      ", "
    )}`,
    data: responseData,
  });
});

// UPDATED: Get customer statistics with simplified document completion metrics
// @route   GET /api/customers/stats
// @access  Private (admin)
exports.getCustomerStats = asyncHandler(async (req, res, next) => {
  const stats = await Customer.getCustomerStats();

  // Get registration trends (last 12 months)
  const { sequelize } = require("../config/database");

  const registrationTrends = await Customer.findAll({
    attributes: [
      [
        sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt")),
        "month",
      ],
      [sequelize.fn("COUNT", sequelize.col("id")), "registrations"],
    ],
    where: {
      createdAt: {
        [Op.gte]: new Date(new Date().setMonth(new Date().getMonth() - 12)),
      },
    },
    group: [sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt"))],
    order: [
      [sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt")), "DESC"],
    ],
    raw: true,
  });

  // Get customer tier distribution
  const tierDistribution = await Customer.findAll({
    attributes: [
      [
        sequelize.literal(`
          CASE 
            WHEN total_spent >= 5000 THEN 'platinum'
            WHEN total_spent >= 2000 THEN 'gold'  
            WHEN total_spent >= 500 THEN 'silver'
            ELSE 'bronze'
          END
        `),
        "tier",
      ],
      [sequelize.fn("COUNT", sequelize.col("id")), "count"],
    ],
    group: [
      sequelize.literal(`
        CASE 
          WHEN total_spent >= 5000 THEN 'platinum'
          WHEN total_spent >= 2000 THEN 'gold'
          WHEN total_spent >= 500 THEN 'silver'
          ELSE 'bronze'
        END
      `),
    ],
    raw: true,
  });

  // Document completion statistics (simplified)
  const documentStats = {
    customersWithDriverLicense: parseInt(stats.customersWithDriverLicense) || 0,
    customersWithPassport: parseInt(stats.customersWithPassport) || 0,
    customersWithCin: parseInt(stats.customersWithCin) || 0,
    totalCustomers: parseInt(stats.totalCustomers) || 0,
  };

  // Calculate completion percentages
  const documentCompletion = {
    driverLicenseCompletion:
      documentStats.totalCustomers > 0
        ? Math.round(
            (documentStats.customersWithDriverLicense /
              documentStats.totalCustomers) *
              100
          )
        : 0,
    passportCompletion:
      documentStats.totalCustomers > 0
        ? Math.round(
            (documentStats.customersWithPassport /
              documentStats.totalCustomers) *
              100
          )
        : 0,
    cinCompletion:
      documentStats.totalCustomers > 0
        ? Math.round(
            (documentStats.customersWithCin / documentStats.totalCustomers) *
              100
          )
        : 0,
  };

  res.status(200).json({
    success: true,
    data: {
      overview: stats,
      registrationTrends,
      tierDistribution,
      documentStats,
      documentCompletion,
    },
  });
});

// @desc    Search customers
// @route   GET /api/customers/search
// @access  Private (admin)
exports.searchCustomers = asyncHandler(async (req, res, next) => {
  const { q, limit = 10, offset = 0 } = req.query;

  if (!q || q.trim().length < 2) {
    return next(
      new ErrorResponse("La recherche doit contenir au moins 2 caractères", 400)
    );
  }

  const result = await Customer.searchCustomers(q.trim(), {
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  // Transform customers for response
  const transformedCustomers = result.rows.map(transformCustomerForResponse);

  res.status(200).json({
    success: true,
    count: transformedCustomers.length,
    total: result.count,
    data: transformedCustomers,
  });
});
