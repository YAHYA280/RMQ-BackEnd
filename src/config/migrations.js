// src/config/migrations.js - Auto-migrate database changes on startup
const { sequelize } = require("./database");
require("colors");

/**
 * Run database migrations automatically on startup
 */
const runMigrations = async () => {
  try {
    console.log("🔄 Running database migrations...".yellow);

    // Migration 1: Update vehicle brand enum
    await updateVehicleBrandEnum();

    // Migration 2: Update license plate length to 15 characters
    await updateLicensePlateField();

    console.log("✅ All migrations completed successfully!".green.bold);
  } catch (error) {
    console.error("❌ Migration error:".red, error.message);
    // Don't exit - let the app continue even if migrations fail
    console.log("⚠️  Continuing without migrations...".yellow);
  }
};

/**
 * Update vehicle brand enum to include new brands
 */
const updateVehicleBrandEnum = async () => {
  try {
    console.log("  → Updating vehicle brands enum...".cyan);

    const newBrands = [
      "Audi",
      "BMW",
      "Citroën",
      "Fiat",
      "Ford",
      "Nissan",
      "Skoda",
      "Tesla",
      "Toyota",
      "Volvo",
    ];

    // Check if we're using PostgreSQL
    const dialect = sequelize.getDialect();

    if (dialect === "postgres") {
      // For each new brand, try to add it
      for (const brand of newBrands) {
        try {
          // Check if brand already exists
          const [results] = await sequelize.query(`
            SELECT EXISTS (
              SELECT 1 FROM pg_enum 
              WHERE enumlabel = '${brand}' 
              AND enumtypid = (
                SELECT oid FROM pg_type WHERE typname = 'enum_vehicles_brand'
              )
            ) as exists;
          `);

          if (!results[0].exists) {
            // Add the brand if it doesn't exist
            await sequelize.query(`
              ALTER TYPE "enum_vehicles_brand" ADD VALUE '${brand}';
            `);
            console.log(`    ✓ Added brand: ${brand}`.green);
          } else {
            console.log(`    ⏭️  Brand already exists: ${brand}`.gray);
          }
        } catch (brandError) {
          // If error contains "already exists", ignore it
          if (brandError.message.includes("already exists")) {
            console.log(`    ⏭️  Brand already exists: ${brand}`.gray);
          } else {
            console.error(
              `    ✗ Error adding ${brand}:`.red,
              brandError.message
            );
          }
        }
      }
    } else {
      console.log("    ⏭️  Not PostgreSQL, skipping enum migration".yellow);
    }

    console.log("  ✓ Vehicle brands enum updated".green);
  } catch (error) {
    console.error("  ✗ Failed to update vehicle brands:".red, error.message);
    throw error;
  }
};

/**
 * Update license plate field from VARCHAR(6) to VARCHAR(15)
 */
const updateLicensePlateField = async () => {
  try {
    console.log("  → Updating license plate field length...".cyan);

    const dialect = sequelize.getDialect();

    if (dialect === "postgres") {
      // Check current column type
      const [currentType] = await sequelize.query(`
        SELECT character_maximum_length 
        FROM information_schema.columns 
        WHERE table_name = 'vehicles' 
        AND column_name = 'license_plate';
      `);

      const currentLength = currentType[0]?.character_maximum_length;
      console.log(`    Current length: ${currentLength}`.gray);

      if (currentLength !== 15) {
        // Alter the column to VARCHAR(15)
        await sequelize.query(`
          ALTER TABLE vehicles 
          ALTER COLUMN license_plate TYPE VARCHAR(15);
        `);
        console.log("    ✓ Updated license_plate to VARCHAR(15)".green);
      } else {
        console.log("    ⏭️  License plate already VARCHAR(15)".gray);
      }
    } else {
      console.log("    ⏭️  Not PostgreSQL, skipping column update".yellow);
    }

    console.log("  ✓ License plate field updated".green);
  } catch (error) {
    console.error(
      "  ✗ Failed to update license plate field:".red,
      error.message
    );
    // Don't throw - allow app to continue
  }
};

module.exports = { runMigrations };
