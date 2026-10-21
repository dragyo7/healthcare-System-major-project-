/**
 * scripts/start_test_backend.js
 *
 * Launches the Express backend in isolated TEST mode:
 * - PORT: 5001 (or process.env.TEST_EXPRESS_PORT)
 * - NODE_ENV: 'test'
 * - DB_NAME: 'rag_healthcare_test'
 * - DB_USER: 'cdss_test_user'
 * - Credentials securely loaded from scratch/test_db_config.json
 * - ALLOW_DESTRUCTIVE_DATABASE_TESTS: 'true'
 */

const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "../scratch/test_db_config.json");
if (!fs.existsSync(configPath)) {
    console.error("ERROR: Missing scratch/test_db_config.json. Run scratch/provision_and_verify_test_db.js first.");
    process.exit(1);
}

const testConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Set explicit isolated test environment variables before requiring any modules
process.env.NODE_ENV = "test";
process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS = "true";
process.env.ALLOW_DEFAULT_DEV_PORT = "false";
process.env.PORT = String(process.env.TEST_EXPRESS_PORT || 5001);
process.env.HOST = "127.0.0.1";
process.env.DB_HOST = testConfig.host || "127.0.0.1";
process.env.DB_PORT = String(testConfig.port || 3306);
process.env.DB_USER = testConfig.user || "cdss_test_user";
process.env.DB_PASSWORD = testConfig.password;
process.env.DB_NAME = testConfig.database || "rag_healthcare_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "rag_healthcare_secret";
process.env.ENABLE_DEV_LOCAL_ACTIVATION_LINKS = "true";

console.log("==========================================================================");
console.log(`  STARTING ISOLATED CDSS TEST BACKEND ON PORT ${process.env.PORT}`);
console.log(`  Target Database: ${process.env.DB_NAME} (User: ${process.env.DB_USER})`);
console.log("==========================================================================\n");

// Launch the backend application
require("../Portal Major P/Bhumi/Doctor portal/backend/server.js");
