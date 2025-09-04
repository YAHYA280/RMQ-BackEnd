// test-login.js - Script to test login directly
const fetch = require("node-fetch");

async function testLogin() {
  try {
    console.log("🧪 Testing login endpoint...");

    const response = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "admin@melhorquenada.com",
        password: "AdminPassword123!",
      }),
    });

    const data = await response.json();

    console.log("Status:", response.status);
    console.log("Response:", JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log("✅ Login successful!");
      console.log("🔑 Token:", data.token);

      // Test the token with /me endpoint
      console.log("\n🧪 Testing token with /me endpoint...");
      const meResponse = await fetch("http://localhost:5000/api/auth/me", {
        headers: {
          Authorization: `Bearer ${data.token}`,
        },
      });

      const meData = await meResponse.json();
      console.log("Me Response:", JSON.stringify(meData, null, 2));
    } else {
      console.log("❌ Login failed:", data.message);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testLogin();
