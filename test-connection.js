// test-connection.js
require("dotenv").config();
const { Client } = require("pg");

async function testPostgreSQLConnection() {
  console.log("🧪 Test de connexion PostgreSQL...");
  console.log("======================================");
  console.log("📡 Host:", process.env.DB_HOST);
  console.log("🔌 Port:", process.env.DB_PORT);
  console.log("🗄️  Database:", process.env.DB_NAME);
  console.log("👤 User:", process.env.DB_USER);
  console.log("======================================\n");

  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    // Test de connexion
    console.log("🔄 Connexion en cours...");
    await client.connect();
    console.log("✅ Connexion PostgreSQL réussie! 🎉\n");

    // Test requête simple
    console.log("🔍 Test d'une requête simple...");
    const result = await client.query(
      "SELECT NOW() as current_time, version() as pg_version"
    );
    console.log("⏰ Heure serveur:", result.rows[0].current_time);
    console.log(
      "🐘 Version PostgreSQL:",
      result.rows[0].pg_version.split(" ")[0],
      "\n"
    );

    // Test extension UUID
    console.log("🔧 Test de l'extension UUID...");
    const uuidResult = await client.query(
      "SELECT uuid_generate_v4() as test_uuid"
    );
    console.log("🆔 UUID généré:", uuidResult.rows[0].test_uuid, "\n");

    // Vérifier les permissions
    console.log("🔐 Vérification des permissions...");
    const permResult = await client.query(
      "SELECT current_user, current_database()"
    );
    console.log("👤 Utilisateur actuel:", permResult.rows[0].current_user);
    console.log(
      "🗄️  Base de données actuelle:",
      permResult.rows[0].current_database,
      "\n"
    );

    console.log("🎊 TOUS LES TESTS SONT RÉUSSIS! 🎊");
    console.log("Votre PostgreSQL est prêt pour le backend! 🚀");
  } catch (error) {
    console.error("❌ ERREUR DE CONNEXION:", error.message);
    console.log("\n💡 SOLUTIONS POSSIBLES:");
    console.log("1. 🔄 Vérifiez que PostgreSQL est démarré");
    console.log("2. 🔑 Vérifiez le mot de passe dans .env");
    console.log('3. 🗄️  Vérifiez que la base "rental_app" existe');
    console.log('4. 👤 Vérifiez que l\'utilisateur "rental_admin" existe');
    console.log("5. 🌐 Vérifiez les paramètres de connexion");
  } finally {
    await client.end();
    console.log("\n🔚 Connexion fermée.");
  }
}

testPostgreSQLConnection();
