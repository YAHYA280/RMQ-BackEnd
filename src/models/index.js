// src/models/index.js
const Admin = require("./Admin");
const Vehicle = require("./Vehicle");

// Define associations
Admin.hasMany(Vehicle, {
  foreignKey: "createdById",
  as: "vehicles",
});

Vehicle.belongsTo(Admin, {
  foreignKey: "createdById",
  as: "createdBy",
});

module.exports = {
  Admin,
  Vehicle,
};
