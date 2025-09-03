// reset-db.js - Clean database reset
require("dotenv").config();
const { Client } = require("pg");

async function resetDatabase() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    await client.connect();
    console.log("🔗 Connected to database");

    // Drop all tables and enums
    console.log("🗑️ Dropping existing tables...");

    await client.query(`
      DROP TABLE IF EXISTS bookings CASCADE;
      DROP TABLE IF EXISTS customers CASCADE; 
      DROP TABLE IF EXISTS vehicles CASCADE;
      DROP TABLE IF EXISTS admins CASCADE;
      
      DROP TYPE IF EXISTS "enum_admins_role" CASCADE;
      DROP TYPE IF EXISTS "enum_vehicles_brand" CASCADE;
      DROP TYPE IF EXISTS "enum_vehicles_transmission" CASCADE;
      DROP TYPE IF EXISTS "enum_vehicles_fuel_type" CASCADE;
      DROP TYPE IF EXISTS "enum_vehicles_location" CASCADE;
      DROP TYPE IF EXISTS "enum_vehicles_status" CASCADE;
      DROP TYPE IF EXISTS "enum_customers_status" CASCADE;
      DROP TYPE IF EXISTS "enum_customers_source" CASCADE;
      DROP TYPE IF EXISTS "enum_bookings_status" CASCADE;
      DROP TYPE IF EXISTS "enum_bookings_source" CASCADE;
      DROP TYPE IF EXISTS "enum_bookings_pickup_location" CASCADE;
      DROP TYPE IF EXISTS "enum_bookings_return_location" CASCADE;
      DROP TYPE IF EXISTS "enum_bookings_payment_status" CASCADE;
      DROP TYPE IF EXISTS "enum_bookings_payment_method" CASCADE;
      DROP TYPE IF EXISTS "enum_bookings_discount_type" CASCADE;
    `);

    console.log("✅ Database reset completed!");
    console.log(
      "📝 Now run the server to recreate tables with proper structure"
    );
  } catch (error) {
    console.error("❌ Error resetting database:", error.message);
  } finally {
    await client.end();
  }
}

resetDatabase();
