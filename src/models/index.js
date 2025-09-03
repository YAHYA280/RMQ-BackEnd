// src/models/index.js
// Import models without associations for now
const Admin = require("./Admin");
const Vehicle = require("./Vehicle");

// Export models - NO ASSOCIATIONS for now
module.exports = {
  Admin,
  Vehicle,
};
