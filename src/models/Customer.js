// src/models/Customer.js - Complete implementation
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
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },
    phone: {
      type: DataTypes.STRING(15),
      allowNull: false,
      validate: {
        is: /^(\+212|212|0)[5-7]\d{8}$/,
      },
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      validate: {
        isDate: true,
        isBefore: new Date().toISOString(), // Must be in the past
      },
    },
    address: {
      type: DataTypes.STRING(200),
      validate: {
        len: [0, 200],
      },
    },
    city: {
      type: DataTypes.STRING(50),
      validate: {
        len: [0, 50],
      },
    },
    postalCode: {
      type: DataTypes.STRING(10),
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
    driverLicenseNumber: {
      type: DataTypes.STRING(20),
      validate: {
        len: [0, 20],
      },
    },
    driverLicenseImage: {
      type: DataTypes.JSONB,
      defaultValue: null,
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
    },
    indexes: [
      {
        fields: ["email"],
        unique: true,
      },
      {
        fields: ["phone"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["createdById"],
      },
      {
        fields: ["referralCode"],
        unique: true,
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
    whereClause[Op.or] = [
      { firstName: { [Op.iLike]: `%${searchTerm}%` } },
      { lastName: { [Op.iLike]: `%${searchTerm}%` } },
      { email: { [Op.iLike]: `%${searchTerm}%` } },
      { phone: { [Op.like]: `%${searchTerm}%` } },
      { referralCode: { [Op.iLike]: `%${searchTerm}%` } },
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
    ],
    raw: true,
  });

  return stats[0];
};

module.exports = Customer;
