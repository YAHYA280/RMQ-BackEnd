// src/config/database.js - Fixed with proper naming strategy
const { Sequelize } = require("sequelize");
require("colors");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    define: {
      timestamps: true,
      underscored: true, // This ensures snake_case in database
      freezeTableName: true, // Prevent pluralization
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ PostgreSQL Connected successfully!".cyan.underline.bold);

    // Sync database in development - but be careful with alter
    if (process.env.NODE_ENV === "development") {
      await sequelize.sync({ force: false }); // Changed from alter to avoid conflicts
      console.log(
        "✅ Database synchronized - Tables created/updated".green.bold
      );
    }

    return sequelize;
  } catch (error) {
    console.error(
      `❌ Database connection error: ${error.message}`.red.underline.bold
    );
    console.error(
      "💡 Vérifiez que PostgreSQL fonctionne et que les credentials sont corrects"
    );
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
