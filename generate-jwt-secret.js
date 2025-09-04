const crypto = require("crypto");

// Generate a secure 64-character random secret
const jwtSecret = crypto.randomBytes(64).toString("hex");

console.log("🔑 Your JWT Secret:");
console.log(jwtSecret);
console.log("");
console.log("📝 Add this to your .env file:");
console.log(`JWT_SECRET=${jwtSecret}`);
