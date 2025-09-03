// src/models/index.js - Fixed associations to avoid naming collisions
const Admin = require("./Admin");
const Vehicle = require("./Vehicle");
const Customer = require("./Customer");
const Booking = require("./Booking");

// Admin associations
Admin.hasMany(Vehicle, {
  foreignKey: "createdById",
  as: "vehicles",
  onDelete: "CASCADE",
});

Admin.hasMany(Customer, {
  foreignKey: "createdById",
  as: "customers",
  onDelete: "SET NULL",
});

Admin.hasMany(Booking, {
  foreignKey: "createdById",
  as: "createdBookings",
  onDelete: "SET NULL",
});

Admin.hasMany(Booking, {
  foreignKey: "confirmedById",
  as: "confirmedBookings",
  onDelete: "SET NULL",
});

Admin.hasMany(Booking, {
  foreignKey: "cancelledById",
  as: "cancelledBookings",
  onDelete: "SET NULL",
});

// Vehicle associations
Vehicle.belongsTo(Admin, {
  foreignKey: "createdById",
  as: "createdBy",
});

Vehicle.hasMany(Booking, {
  foreignKey: "vehicleId",
  as: "vehicleBookings", // Changed from "bookings" to avoid collision
  onDelete: "CASCADE",
});

// Customer associations
Customer.belongsTo(Admin, {
  foreignKey: "createdById",
  as: "createdBy",
});

Customer.hasMany(Booking, {
  foreignKey: "customerId",
  as: "customerBookings", // Changed from "bookings" for consistency
  onDelete: "CASCADE",
});

// Booking associations
Booking.belongsTo(Admin, {
  foreignKey: "createdById",
  as: "createdBy",
});

Booking.belongsTo(Admin, {
  foreignKey: "confirmedById",
  as: "confirmedBy",
});

Booking.belongsTo(Admin, {
  foreignKey: "cancelledById",
  as: "cancelledBy",
});

Booking.belongsTo(Customer, {
  foreignKey: "customerId",
  as: "customer",
});

Booking.belongsTo(Vehicle, {
  foreignKey: "vehicleId",
  as: "vehicle",
});

// Export models
module.exports = {
  Admin,
  Vehicle,
  Customer,
  Booking,
};
