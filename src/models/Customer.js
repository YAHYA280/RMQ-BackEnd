// src/models/Customer.js - UPDATED: Added passport, CIN, and additional fields
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Customer = sequelize.define(
  "Customer",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    firstName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 50],
      },
    },
    lastName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 50],
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true, // Email is optional
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING(15),
      allowNull: false,
      validate: {
        is: /^0[67]\d{8}$/,
      },
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true, // Optional but important for contract
      validate: {
        isDate: true,
        isBefore: new Date().toISOString(), // Must be in the past
      },
    },
    address: {
      type: DataTypes.STRING(500), // Increased from 200 to 500 for longer addresses
      allowNull: true,
      validate: {
        len: [0, 500],
      },
    },
    city: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [0, 50],
      },
    },
    postalCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
      validate: {
        len: [0, 10],
      },
    },
    country: {
      type: DataTypes.STRING(2),
      defaultValue: "MA", // Morocco
      validate: {
        len: [2, 2],
      },
    },
    // UPDATED: Driver license information
    driverLicenseNumber: {
      type: DataTypes.STRING(20),
      allowNull: true, // Optional
      validate: {
        len: [0, 20],
      },
    },
    // Driver license image stored as BYTEA
    driverLicenseImageData: {
      type: DataTypes.BLOB("long"), // For PostgreSQL, this becomes BYTEA
      allowNull: true,
    },
    driverLicenseImageMimetype: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    driverLicenseImageName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // NEW: Passport information
    passportNumber: {
      type: DataTypes.STRING(20),
      allowNull: true, // Optional
      validate: {
        len: [0, 20],
      },
    },
    passportIssuedAt: {
      type: DataTypes.STRING(100), // City/Country where passport was issued
      allowNull: true,
      validate: {
        len: [0, 100],
      },
    },
    // Passport image stored as BYTEA
    passportImageData: {
      type: DataTypes.BLOB("long"), // For PostgreSQL, this becomes BYTEA
      allowNull: true,
    },
    passportImageMimetype: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    passportImageName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // NEW: CIN (Carte d'Identité Nationale) - Moroccan ID Card
    cinNumber: {
      type: DataTypes.STRING(20),
      allowNull: true, // Optional
      validate: {
        len: [0, 20],
      },
    },
    // CIN image stored as BYTEA
    cinImageData: {
      type: DataTypes.BLOB("long"), // For PostgreSQL, this becomes BYTEA
      allowNull: true,
    },
    cinImageMimetype: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    cinImageName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    emergencyContact: {
      type: DataTypes.JSONB,
      defaultValue: null,
      // Structure: { name: "...", phone: "...", relationship: "..." }
    },
    preferences: {
      type: DataTypes.JSONB,
      defaultValue: {},
      // Structure: { communicationLanguage: "en", receivePromotions: true, etc. }
    },
    status: {
      type: DataTypes.ENUM("active", "inactive", "blocked"),
      defaultValue: "active",
    },
    totalBookings: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    totalSpent: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
      validate: {
        min: 0,
      },
    },
    averageRating: {
      type: DataTypes.DECIMAL(2, 1),
      defaultValue: null,
      validate: {
        min: 1,
        max: 5,
      },
    },
    lastBookingDate: {
      type: DataTypes.DATE,
    },
    // Marketing and analytics
    source: {
      type: DataTypes.ENUM("website", "admin", "referral", "social", "other"),
      defaultValue: "website",
    },
    referralCode: {
      type: DataTypes.STRING(10),
      unique: true,
    },
    // Verification
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    phoneVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Admin tracking
    createdById: {
      type: DataTypes.UUID,
      allowNull: true, // Can be null for self-registrations
      references: {
        model: "admins",
        key: "id",
      },
    },
    notes: {
      type: DataTypes.TEXT,
    },
  },
  {
    tableName: "customers",
    timestamps: true,
    hooks: {
      beforeCreate: async (customer) => {
        // Generate unique referral code
        if (!customer.referralCode) {
          customer.referralCode = await Customer.generateReferralCode();
        }
      },
      beforeValidate: async (customer) => {
        // Make email unique only if provided
        if (customer.email && customer.email.trim() === "") {
          customer.email = null;
        }
      },
    },
    indexes: [
      {
        fields: ["email"],
        unique: true,
        where: {
          email: { [require("sequelize").Op.ne]: null },
        },
      },
      {
        fields: ["phone"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["created_by_id"],
      },
      {
        fields: ["referral_code"],
        unique: true,
      },
      // NEW: Index for passport and CIN numbers for quick lookup
      {
        fields: ["passport_number"],
        where: {
          passport_number: { [require("sequelize").Op.ne]: null },
        },
      },
      {
        fields: ["cin_number"],
        where: {
          cin_number: { [require("sequelize").Op.ne]: null },
        },
      },
    ],
  }
);

// Instance methods
Customer.prototype.getFullName = function () {
  return `${this.firstName} ${this.lastName}`;
};

Customer.prototype.getAge = function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
};

// Get driver license image as base64 data URL for frontend
Customer.prototype.getDriverLicenseImageDataUrl = function () {
  if (this.driverLicenseImageData && this.driverLicenseImageMimetype) {
    const base64 = this.driverLicenseImageData.toString("base64");
    return `data:${this.driverLicenseImageMimetype};base64,${base64}`;
  }
  return null;
};

// NEW: Get passport image as base64 data URL for frontend
Customer.prototype.getPassportImageDataUrl = function () {
  if (this.passportImageData && this.passportImageMimetype) {
    const base64 = this.passportImageData.toString("base64");
    return `data:${this.passportImageMimetype};base64,${base64}`;
  }
  return null;
};

// NEW: Get CIN image as base64 data URL for frontend
Customer.prototype.getCinImageDataUrl = function () {
  if (this.cinImageData && this.cinImageMimetype) {
    const base64 = this.cinImageData.toString("base64");
    return `data:${this.cinImageMimetype};base64,${base64}`;
  }
  return null;
};

// Format phone number for display
Customer.prototype.getFormattedPhone = function () {
  if (!this.phone) return "";
  const cleaned = this.phone.replace(/\s/g, "");
  if (cleaned.length === 10) {
    return `${cleaned.substring(0, 2)} ${cleaned.substring(
      2,
      4
    )} ${cleaned.substring(4, 6)} ${cleaned.substring(
      6,
      8
    )} ${cleaned.substring(8, 10)}`;
  }
  return this.phone;
};

Customer.prototype.incrementBookings = async function (amount = 0) {
  const newTotalBookings = this.totalBookings + 1;
  const newTotalSpent = parseFloat(this.totalSpent) + parseFloat(amount);

  await this.update({
    totalBookings: newTotalBookings,
    totalSpent: newTotalSpent,
    lastBookingDate: new Date(),
  });

  await this.reload();
  return this;
};

Customer.prototype.updateRating = async function (newRating) {
  // Simple average calculation - in production, you'd store individual ratings
  const currentRating = parseFloat(this.averageRating) || 0;
  const bookingCount = this.totalBookings || 1;

  let updatedRating;
  if (currentRating === 0) {
    updatedRating = newRating;
  } else {
    updatedRating =
      (currentRating * (bookingCount - 1) + newRating) / bookingCount;
  }

  await this.update({
    averageRating: Math.round(updatedRating * 10) / 10,
  });
  return this;
};

Customer.prototype.isEligibleForDiscount = function () {
  return this.totalBookings >= 5 || this.totalSpent >= 1000;
};

Customer.prototype.getCustomerTier = function () {
  if (this.totalSpent >= 5000) return "platinum";
  if (this.totalSpent >= 2000) return "gold";
  if (this.totalSpent >= 500) return "silver";
  return "bronze";
};

// NEW: Check if customer has all required documents for contract
Customer.prototype.hasCompleteDocumentation = function () {
  return {
    hasDriverLicense: !!(
      this.driverLicenseNumber && this.driverLicenseImageData
    ),
    hasPassport: !!(this.passportNumber && this.passportImageData),
    hasCin: !!(this.cinNumber && this.cinImageData),
    hasDateOfBirth: !!this.dateOfBirth,
    hasAddress: !!this.address,
    completionScore: [
      this.driverLicenseNumber && this.driverLicenseImageData,
      this.passportNumber && this.passportImageData,
      this.cinNumber && this.cinImageData,
      this.dateOfBirth,
      this.address,
    ].filter(Boolean).length,
  };
};

// Class methods
Customer.generateReferralCode = async function () {
  let code;
  let isUnique = false;

  while (!isUnique) {
    // Generate 6-character alphanumeric code
    code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const existingCustomer = await Customer.findOne({
      where: { referralCode: code },
    });

    if (!existingCustomer) {
      isUnique = true;
    }
  }

  return code;
};

Customer.searchCustomers = async function (searchTerm, options = {}) {
  const {
    limit = 10,
    offset = 0,
    status = null,
    sortBy = "createdAt",
    sortOrder = "DESC",
  } = options;

  const whereClause = {};

  if (status) {
    whereClause.status = status;
  }

  if (searchTerm) {
    whereClause[require("sequelize").Op.or] = [
      { firstName: { [require("sequelize").Op.iLike]: `%${searchTerm}%` } },
      { lastName: { [require("sequelize").Op.iLike]: `%${searchTerm}%` } },
      { email: { [require("sequelize").Op.iLike]: `%${searchTerm}%` } },
      { phone: { [require("sequelize").Op.like]: `%${searchTerm}%` } },
      { referralCode: { [require("sequelize").Op.iLike]: `%${searchTerm}%` } },
      // NEW: Search in passport and CIN numbers
      {
        passportNumber: { [require("sequelize").Op.iLike]: `%${searchTerm}%` },
      },
      { cinNumber: { [require("sequelize").Op.iLike]: `%${searchTerm}%` } },
      {
        driverLicenseNumber: {
          [require("sequelize").Op.iLike]: `%${searchTerm}%`,
        },
      },
    ];
  }

  return await Customer.findAndCountAll({
    where: whereClause,
    limit,
    offset,
    order: [[sortBy, sortOrder]],
    include: [
      {
        model: require("./Admin"),
        as: "createdBy",
        attributes: ["id", "name", "email"],
      },
    ],
  });
};

Customer.getCustomerStats = async function () {
  const { sequelize } = require("../config/database");

  const stats = await Customer.findAll({
    attributes: [
      [sequelize.fn("COUNT", sequelize.col("id")), "totalCustomers"],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN status = 'active' THEN 1 END")
        ),
        "activeCustomers",
      ],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN status = 'blocked' THEN 1 END")
        ),
        "blockedCustomers",
      ],
      [
        sequelize.fn("AVG", sequelize.col("totalSpent")),
        "averageLifetimeValue",
      ],
      [sequelize.fn("AVG", sequelize.col("totalBookings")), "averageBookings"],
      // NEW: Stats for document completion
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal(
            "CASE WHEN driver_license_number IS NOT NULL THEN 1 END"
          )
        ),
        "customersWithDriverLicense",
      ],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN passport_number IS NOT NULL THEN 1 END")
        ),
        "customersWithPassport",
      ],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN cin_number IS NOT NULL THEN 1 END")
        ),
        "customersWithCin",
      ],
    ],
    raw: true,
  });

  return stats[0];
};

module.exports = Customer;
