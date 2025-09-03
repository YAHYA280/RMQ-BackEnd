// src/models/Vehicle.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Vehicle = sequelize.define(
  "Vehicle",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Please add a vehicle name",
        },
        len: {
          args: [1, 50],
          msg: "Name cannot be more than 50 characters",
        },
      },
    },
    brand: {
      type: DataTypes.ENUM(
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
        "Volkswagen"
      ),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Please add a brand",
        },
      },
    },
    model: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Please add a model",
        },
      },
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: {
          args: 2000,
          msg: "Year cannot be less than 2000",
        },
        max: {
          args: new Date().getFullYear() + 1,
          msg: "Year cannot be in the future",
        },
      },
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: {
          args: 0,
          msg: "Price cannot be negative",
        },
      },
    },
    transmission: {
      type: DataTypes.ENUM("Manual", "Automatic"),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Please select transmission type",
        },
      },
    },
    fuelType: {
      type: DataTypes.ENUM("Petrol", "Diesel", "Electric", "Hybrid"),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Please select fuel type",
        },
      },
    },
    seats: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: {
          args: 2,
          msg: "Must have at least 2 seats",
        },
        max: {
          args: 8,
          msg: "Cannot have more than 8 seats",
        },
      },
    },
    doors: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: {
          args: 2,
          msg: "Must have at least 2 doors",
        },
        max: {
          args: 5,
          msg: "Cannot have more than 5 doors",
        },
      },
    },
    licensePlate: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        is: {
          args: /^\d{5}[A-Z]$/,
          msg: "License plate must be in format: 12345A",
        },
      },
      set(value) {
        this.setDataValue(
          "licensePlate",
          value ? value.toUpperCase().trim() : value
        );
      },
    },
    whatsappNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        is: {
          args: /^(\+212|212|0)[5-7]\d{8}$/,
          msg: "Please add a valid Moroccan phone number",
        },
      },
    },
    caution: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: {
          args: 0,
          msg: "Caution cannot be negative",
        },
      },
    },
    mileage: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: "Mileage cannot be negative",
        },
      },
    },
    available: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    features: {
      type: DataTypes.ARRAY(
        DataTypes.ENUM(
          "airConditioning",
          "bluetooth",
          "gps",
          "cruiseControl",
          "parkingSensors",
          "backupCamera",
          "leatherSeats",
          "keylessEntry",
          "electricWindows",
          "abs"
        )
      ),
      defaultValue: [],
    },
    description: {
      type: DataTypes.TEXT,
      validate: {
        len: {
          args: [0, 500],
          msg: "Description cannot be more than 500 characters",
        },
      },
    },
    images: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    mainImage: {
      type: DataTypes.JSONB,
    },
    location: {
      type: DataTypes.ENUM(
        "Tangier Airport",
        "Tangier City Center",
        "Tangier Port"
      ),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Please add vehicle location",
        },
      },
    },
    lastTechnicalVisit: {
      type: DataTypes.DATE,
    },
    lastOilChange: {
      type: DataTypes.DATE,
    },
    rating: {
      type: DataTypes.DECIMAL(2, 1),
      defaultValue: 4.5,
      validate: {
        min: {
          args: 1,
          msg: "Rating must be at least 1",
        },
        max: {
          args: 5,
          msg: "Rating cannot be more than 5",
        },
      },
    },
    bookings: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: "Bookings cannot be negative",
        },
      },
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdById: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "admins",
        key: "id",
      },
    },
  },
  {
    tableName: "vehicles",
    hooks: {
      beforeSave: (vehicle) => {
        if (vehicle.name && vehicle.brand) {
          vehicle.slug =
            vehicle.brand.toLowerCase() +
            "-" +
            vehicle.name.toLowerCase().replace(/\s+/g, "-");
        }
      },
    },
  }
);

module.exports = Vehicle;
