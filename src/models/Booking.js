// src/models/Booking.js - Complete implementation
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Booking = sequelize.define(
  "Booking",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    bookingNumber: {
      type: DataTypes.STRING(12),
      unique: true,
      allowNull: false,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "customers",
        key: "id",
      },
    },
    vehicleId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "vehicles",
        key: "id",
      },
    },
    // Date and time information
    pickupDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: true,
        isAfter: new Date().toISOString().split("T")[0], // Must be future date
      },
    },
    returnDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: true,
        isAfterPickup(value) {
          if (value <= this.pickupDate) {
            throw new Error("Return date must be after pickup date");
          }
        },
      },
    },
    pickupTime: {
      type: DataTypes.TIME,
      allowNull: false,
      validate: {
        is: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
      },
    },
    returnTime: {
      type: DataTypes.TIME,
      allowNull: false,
      validate: {
        is: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
      },
    },
    // Location information
    pickupLocation: {
      type: DataTypes.ENUM(
        "Tangier Airport",
        "Tangier City Center",
        "Tangier Port",
        "Hotel Pickup",
        "Custom Location"
      ),
      allowNull: false,
    },
    returnLocation: {
      type: DataTypes.ENUM(
        "Tangier Airport",
        "Tangier City Center",
        "Tangier Port",
        "Hotel Pickup",
        "Custom Location"
      ),
      allowNull: false,
    },
    pickupAddress: {
      type: DataTypes.STRING(200),
      // Required if pickupLocation is "Hotel Pickup" or "Custom Location"
    },
    returnAddress: {
      type: DataTypes.STRING(200),
      // Required if returnLocation is "Hotel Pickup" or "Custom Location"
    },
    // Pricing information
    dailyRate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    totalDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    discountAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
      validate: {
        min: 0,
      },
    },
    discountType: {
      type: DataTypes.ENUM("percentage", "fixed", "loyalty", "promotional"),
      allowNull: true,
    },
    discountCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    taxAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
      validate: {
        min: 0,
      },
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    cautionAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    // Booking status and workflow
    status: {
      type: DataTypes.ENUM(
        "pending",
        "confirmed",
        "active",
        "completed",
        "cancelled"
      ),
      defaultValue: "pending",
    },
    source: {
      type: DataTypes.ENUM("website", "admin", "phone", "mobile-app"),
      defaultValue: "website",
    },
    // Payment information
    paymentStatus: {
      type: DataTypes.ENUM("pending", "partial", "paid", "refunded"),
      defaultValue: "pending",
    },
    paymentMethod: {
      type: DataTypes.ENUM("cash", "card", "bank-transfer", "online"),
      allowNull: true,
    },
    paidAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
      validate: {
        min: 0,
      },
    },
    // Vehicle condition tracking
    pickupCondition: {
      type: DataTypes.JSONB,
      defaultValue: null,
      // Structure: { mileage: 12000, fuelLevel: "full", damages: [...], photos: [...] }
    },
    returnCondition: {
      type: DataTypes.JSONB,
      defaultValue: null,
      // Structure: { mileage: 12500, fuelLevel: "half", damages: [...], photos: [...] }
    },
    // Additional services
    additionalServices: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      // e.g., ["gps", "child-seat", "additional-driver", "insurance-upgrade"]
    },
    additionalServicesTotal: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
      validate: {
        min: 0,
      },
    },
    // Special requirements and notes
    specialRequirements: {
      type: DataTypes.TEXT,
    },
    customerNotes: {
      type: DataTypes.TEXT,
    },
    adminNotes: {
      type: DataTypes.TEXT,
    },
    // Tracking and audit
    createdById: {
      type: DataTypes.UUID,
      allowNull: true, // Can be null for website bookings
      references: {
        model: "admins",
        key: "id",
      },
    },
    confirmedAt: {
      type: DataTypes.DATE,
    },
    confirmedById: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "admins",
        key: "id",
      },
    },
    cancelledAt: {
      type: DataTypes.DATE,
    },
    cancelledById: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "admins",
        key: "id",
      },
    },
    cancellationReason: {
      type: DataTypes.TEXT,
    },
    // Customer satisfaction
    customerRating: {
      type: DataTypes.INTEGER,
      validate: {
        min: 1,
        max: 5,
      },
    },
    customerFeedback: {
      type: DataTypes.TEXT,
    },
    // Email and notification tracking
    confirmationEmailSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    reminderEmailSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    completionEmailSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "bookings",
    timestamps: true,
    hooks: {
      beforeCreate: async (booking) => {
        // Generate unique booking number
        if (!booking.bookingNumber) {
          booking.bookingNumber = await Booking.generateBookingNumber();
        }

        // Calculate total days
        const pickupDate = new Date(booking.pickupDate);
        const returnDate = new Date(booking.returnDate);
        const diffTime = Math.abs(returnDate - pickupDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        booking.totalDays = Math.max(1, diffDays);

        // Calculate subtotal
        booking.subtotal = parseFloat(booking.dailyRate) * booking.totalDays;

        // Calculate total amount (subtotal - discount + tax + additional services)
        const subtotal = parseFloat(booking.subtotal);
        const discount = parseFloat(booking.discountAmount) || 0;
        const tax = parseFloat(booking.taxAmount) || 0;
        const additionalServices =
          parseFloat(booking.additionalServicesTotal) || 0;

        booking.totalAmount = subtotal - discount + tax + additionalServices;
      },
      beforeUpdate: async (booking) => {
        // Recalculate totals if relevant fields changed
        if (
          booking.changed("dailyRate") ||
          booking.changed("pickupDate") ||
          booking.changed("returnDate")
        ) {
          const pickupDate = new Date(booking.pickupDate);
          const returnDate = new Date(booking.returnDate);
          const diffTime = Math.abs(returnDate - pickupDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          booking.totalDays = Math.max(1, diffDays);
          booking.subtotal = parseFloat(booking.dailyRate) * booking.totalDays;
        }

        if (
          booking.changed("subtotal") ||
          booking.changed("discountAmount") ||
          booking.changed("taxAmount") ||
          booking.changed("additionalServicesTotal")
        ) {
          const subtotal = parseFloat(booking.subtotal);
          const discount = parseFloat(booking.discountAmount) || 0;
          const tax = parseFloat(booking.taxAmount) || 0;
          const additionalServices =
            parseFloat(booking.additionalServicesTotal) || 0;

          booking.totalAmount = subtotal - discount + tax + additionalServices;
        }

        // Set confirmation timestamp
        if (
          booking.changed("status") &&
          booking.status === "confirmed" &&
          !booking.confirmedAt
        ) {
          booking.confirmedAt = new Date();
        }

        // Set cancellation timestamp
        if (
          booking.changed("status") &&
          booking.status === "cancelled" &&
          !booking.cancelledAt
        ) {
          booking.cancelledAt = new Date();
        }
      },
    },
    indexes: [
      {
        fields: ["booking_number"], // Use snake_case
        unique: true,
      },
      {
        fields: ["customer_id"], // Use snake_case
      },
      {
        fields: ["vehicle_id"], // Use snake_case
      },
      {
        fields: ["status"],
      },
      {
        fields: ["pickup_date", "return_date"], // Use snake_case
      },
      {
        fields: ["created_by_id"], // Use snake_case
      },
    ],
  }
);

// Instance methods
Booking.prototype.getDuration = function () {
  const pickup = new Date(this.pickupDate);
  const returnDate = new Date(this.returnDate);
  const diffTime = Math.abs(returnDate - pickup);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

Booking.prototype.isOverdue = function () {
  if (this.status !== "active") return false;
  const today = new Date();
  const returnDate = new Date(this.returnDate);
  return today > returnDate;
};

Booking.prototype.canBeCancelled = function () {
  const allowedStatuses = ["pending", "confirmed"];
  return allowedStatuses.includes(this.status);
};

Booking.prototype.calculateRefund = function () {
  const today = new Date();
  const pickupDate = new Date(this.pickupDate);
  const daysUntilPickup = Math.ceil(
    (pickupDate - today) / (1000 * 60 * 60 * 24)
  );

  let refundPercentage = 0;

  if (daysUntilPickup >= 7) {
    refundPercentage = 100; // Full refund
  } else if (daysUntilPickup >= 3) {
    refundPercentage = 50; // 50% refund
  } else if (daysUntilPickup >= 1) {
    refundPercentage = 25; // 25% refund
  }
  // else 0% refund for same-day cancellations

  return {
    refundPercentage,
    refundAmount: (parseFloat(this.paidAmount) * refundPercentage) / 100,
  };
};

// Class methods
Booking.generateBookingNumber = async function () {
  let bookingNumber;
  let isUnique = false;

  while (!isUnique) {
    const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, ""); // YYMMDD format
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase(); // 6 random chars
    bookingNumber = `BK${datePart}${randomPart}`;

    const existingBooking = await Booking.findOne({
      where: { bookingNumber },
    });

    if (!existingBooking) {
      isUnique = true;
    }
  }

  return bookingNumber;
};

Booking.checkVehicleAvailability = async function (
  vehicleId,
  pickupDate,
  returnDate,
  excludeBookingId = null
) {
  const whereClause = {
    vehicleId,
    status: ["confirmed", "active"],
    [require("sequelize").Op.or]: [
      {
        pickupDate: {
          [require("sequelize").Op.between]: [pickupDate, returnDate],
        },
      },
      {
        returnDate: {
          [require("sequelize").Op.between]: [pickupDate, returnDate],
        },
      },
      {
        [require("sequelize").Op.and]: [
          { pickupDate: { [require("sequelize").Op.lte]: pickupDate } },
          { returnDate: { [require("sequelize").Op.gte]: returnDate } },
        ],
      },
    ],
  };

  if (excludeBookingId) {
    whereClause.id = { [require("sequelize").Op.ne]: excludeBookingId };
  }

  const conflictingBookings = await Booking.findAll({
    where: whereClause,
  });

  return conflictingBookings.length === 0;
};

Booking.getBookingStats = async function () {
  const { sequelize } = require("../config/database");

  const stats = await Booking.findAll({
    attributes: [
      [sequelize.fn("COUNT", sequelize.col("id")), "totalBookings"],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN status = 'pending' THEN 1 END")
        ),
        "pendingBookings",
      ],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN status = 'confirmed' THEN 1 END")
        ),
        "confirmedBookings",
      ],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN status = 'active' THEN 1 END")
        ),
        "activeBookings",
      ],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN status = 'completed' THEN 1 END")
        ),
        "completedBookings",
      ],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN status = 'cancelled' THEN 1 END")
        ),
        "cancelledBookings",
      ],
      [sequelize.fn("SUM", sequelize.col("totalAmount")), "totalRevenue"],
      [
        sequelize.fn("AVG", sequelize.col("totalAmount")),
        "averageBookingValue",
      ],
      [sequelize.fn("AVG", sequelize.col("customerRating")), "averageRating"],
    ],
    raw: true,
  });

  return stats[0];
};

module.exports = Booking;
