/**
 * tests/test_database_safety_foundation.js
 *
 * Focused Database-Independent Verification Suite for Phase 1.
 *
 * Verifies that all safeguards prevent accidental connection to or mutation of
 * the primary 'rag_healthcare' database, enforcing fail-closed boundaries:
 * 1. Missing explicit opt-in rejection.
 * 2. Primary database ('rag_healthcare') rejection.
 * 3. Production-like database name rejection.
 * 4. Invalid disposable database name rejection.
 * 5. Valid disposable database acceptance.
 * 6. Missing DB_NAME configuration rejection (no silent fallback).
 * 7. Refusal before database connection via DB_CONFIG getter.
 * 8. Port 5000 collision prevention in httpRequest.
 * 9. Port 5000 collision prevention in probeGatewaySafety.
 * 10. Live gateway primary-database interception (detecting server connected to rag_healthcare).
 * 11. Live gateway database mismatch rejection.
 * 12. Correct test environment configuration propagation.
 *
 * ZERO MYSQL DATABASE CONNECTIONS ARE INITIATED IN THIS SUITE.
 */

const http = require("http");
const path = require("path");
const {
  verifyDestructiveTestSafety,
  verifyTestDatabasePreflight,
  probeGatewaySafety
} = require("./safety/databaseSafetyGuard");

let passed = 0;
let failed = 0;

function assert(condition, message, detail = "") {
  if (condition) {
    console.log(`  ✓ [PASS] ${message} ${detail}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${message} ${detail}`);
    failed++;
  }
}

async function runTests() {
  console.log("==========================================================================");
  console.log("     PHASE 1: DATABASE SAFETY FOUNDATION VERIFICATION SUITE              ");
  console.log("==========================================================================\n");

  const origEnv = { ...process.env };

  // --------------------------------------------------------------------------
  // TEST 1: Missing explicit opt-in rejection
  // --------------------------------------------------------------------------
  console.log("► Test 1: Missing explicit opt-in rejection");
  delete process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS;
  let t1Blocked = false;
  try {
    verifyDestructiveTestSafety("rag_healthcare_test");
  } catch (err) {
    t1Blocked = err.message.includes("ALLOW_DESTRUCTIVE_DATABASE_TESTS=true");
  }
  assert(t1Blocked, "Rejects execution when ALLOW_DESTRUCTIVE_DATABASE_TESTS is unset");

  // Also test when explicitly set to "false" or invalid
  process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS = "false";
  let t1bBlocked = false;
  try {
    verifyDestructiveTestSafety("rag_healthcare_test");
  } catch (err) {
    t1bBlocked = err.message.includes("ALLOW_DESTRUCTIVE_DATABASE_TESTS=true");
  }
  assert(t1bBlocked, "Rejects execution when ALLOW_DESTRUCTIVE_DATABASE_TESTS is 'false'");

  // --------------------------------------------------------------------------
  // TEST 2: Primary database ('rag_healthcare') rejection
  // --------------------------------------------------------------------------
  console.log("\n► Test 2: Primary database ('rag_healthcare') rejection");
  process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS = "true";
  let t2Blocked = false;
  try {
    verifyDestructiveTestSafety("rag_healthcare");
  } catch (err) {
    t2Blocked = err.message.includes("primary application or production database");
  }
  assert(t2Blocked, "Strictly rejects primary database 'rag_healthcare'");

  // Also test case-insensitivity and whitespace
  let t2bBlocked = false;
  try {
    verifyDestructiveTestSafety("  RAG_HEALTHCARE  ");
  } catch (err) {
    t2bBlocked = err.message.includes("primary application or production database");
  }
  assert(t2bBlocked, "Strictly rejects primary database with spaces and mixed case '  RAG_HEALTHCARE  '");

  // --------------------------------------------------------------------------
  // TEST 3: Production-like database rejection
  // --------------------------------------------------------------------------
  console.log("\n► Test 3: Production-like database rejection");
  const prodNames = ["production", "prod_healthcare", "cdss_prod_db", "healthcare_production_test"];
  for (const name of prodNames) {
    let blocked = false;
    try {
      verifyDestructiveTestSafety(name);
    } catch (err) {
      blocked = err.message.includes("primary application or production database");
    }
    assert(blocked, `Rejects production-like database '${name}'`);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Invalid disposable database names rejection
  // --------------------------------------------------------------------------
  console.log("\n► Test 4: Invalid disposable database names rejection");
  const invalidNames = ["rag_healthcare_staging", "healthcare_dev", "test_database", "disposable_test_run"];
  for (const name of invalidNames) {
    let blocked = false;
    try {
      verifyDestructiveTestSafety(name);
    } catch (err) {
      blocked = err.message.includes("must end with '_test' or '_disposable'");
    }
    assert(blocked, `Rejects database '${name}' because suffix is not _test or _disposable`);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Valid disposable database names accepted
  // --------------------------------------------------------------------------
  console.log("\n► Test 5: Valid disposable database names accepted");
  const validNames = ["rag_healthcare_test", "cdss_disposable", "hospital_unit_test", "healthcare_synthetic_disposable"];
  for (const name of validNames) {
    let passedValidation = false;
    try {
      passedValidation = verifyDestructiveTestSafety(name);
    } catch (err) {
      passedValidation = false;
    }
    assert(passedValidation === true, `Accepts compliant disposable database '${name}'`);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Missing DB_NAME configuration (no silent fallback)
  // --------------------------------------------------------------------------
  console.log("\n► Test 6: Missing DB_NAME configuration rejection");
  delete process.env.DB_NAME;
  let t6Blocked = false;
  try {
    verifyTestDatabasePreflight();
  } catch (err) {
    t6Blocked = err.message.includes("Missing required DB_NAME environment variable");
  }
  assert(t6Blocked, "Preflight refuses to execute when DB_NAME is missing (no silent fallback to rag_healthcare)");

  process.env.DB_NAME = "   ";
  let t6bBlocked = false;
  try {
    verifyTestDatabasePreflight();
  } catch (err) {
    t6bBlocked = err.message.includes("Missing required DB_NAME environment variable");
  }
  assert(t6bBlocked, "Preflight refuses to execute when DB_NAME is empty whitespace");

  // --------------------------------------------------------------------------
  // TEST 7: Refusal before database connection via DB_CONFIG getter
  // --------------------------------------------------------------------------
  console.log("\n► Test 7: Refusal before database connection via DB_CONFIG getter");
  delete process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS;
  process.env.DB_NAME = "rag_healthcare_test";
  const testHelper = require("./integration/testHelper");

  let t7Blocked = false;
  try {
    // Attempting to read DB_CONFIG.database triggers the getter
    const target = testHelper.DB_CONFIG.database;
  } catch (err) {
    t7Blocked = err.message.includes("ALLOW_DESTRUCTIVE_DATABASE_TESTS=true");
  }
  assert(t7Blocked, "Accessing DB_CONFIG.database throws before connection when opt-in missing");

  // Test when DB_NAME in .env or env is rag_healthcare
  process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS = "true";
  process.env.DB_NAME = "rag_healthcare";
  let t7bBlocked = false;
  try {
    const target = testHelper.DB_CONFIG.database;
  } catch (err) {
    t7bBlocked = err.message.includes("primary application or production database");
  }
  assert(t7bBlocked, "Accessing DB_CONFIG.database throws before connection when DB is rag_healthcare");

  // --------------------------------------------------------------------------
  // TEST 8: Port 5000 collision prevention in httpRequest
  // --------------------------------------------------------------------------
  console.log("\n► Test 8: Port 5000 collision prevention in httpRequest");
  delete process.env.ALLOW_DEFAULT_DEV_PORT;
  let t8Blocked = false;
  try {
    await testHelper.httpRequest({ port: 5000, path: "/health" });
  } catch (err) {
    t8Blocked = err.message.includes("httpRequest is targeting port 5000");
  }
  assert(t8Blocked, "httpRequest rejects port 5000 to prevent mutating running dev server");

  // --------------------------------------------------------------------------
  // TEST 9: Port 5000 collision prevention in probeGatewaySafety
  // --------------------------------------------------------------------------
  console.log("\n► Test 9: Port 5000 collision prevention in probeGatewaySafety");
  delete process.env.ALLOW_DEFAULT_DEV_PORT;
  let t9Blocked = false;
  try {
    await probeGatewaySafety(5000, "rag_healthcare_test");
  } catch (err) {
    t9Blocked = err.message.includes("targeting port 5000 (default development port)");
  }
  assert(t9Blocked, "probeGatewaySafety rejects port 5000 when ALLOW_DEFAULT_DEV_PORT is not set");

  // --------------------------------------------------------------------------
  // TEST 10: Live gateway primary-database interception
  // --------------------------------------------------------------------------
  console.log("\n► Test 10: Live gateway primary-database interception");
  const mockPrimaryServer = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "healthy",
      services: {
        database: "connected",
        database_name: "rag_healthcare"
      }
    }));
  });

  await new Promise(resolve => mockPrimaryServer.listen(5991, "127.0.0.1", resolve));

  let t10Blocked = false;
  try {
    await probeGatewaySafety(5991, "rag_healthcare_test");
  } catch (err) {
    t10Blocked = err.message.includes("connected to primary/production database 'rag_healthcare'");
  }
  await new Promise(resolve => mockPrimaryServer.close(resolve));
  assert(t10Blocked, "probeGatewaySafety intercepts and aborts if server is connected to 'rag_healthcare'");

  // --------------------------------------------------------------------------
  // TEST 11: Live gateway database mismatch rejection
  // --------------------------------------------------------------------------
  console.log("\n► Test 11: Live gateway database mismatch rejection");
  const mockOtherServer = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "healthy",
      services: {
        database: "connected",
        database_name: "other_test_db_test"
      }
    }));
  });

  await new Promise(resolve => mockOtherServer.listen(5992, "127.0.0.1", resolve));

  let t11Blocked = false;
  try {
    await probeGatewaySafety(5992, "rag_healthcare_test");
  } catch (err) {
    t11Blocked = err.message.includes("Database mismatch");
  }
  await new Promise(resolve => mockOtherServer.close(resolve));
  assert(t11Blocked, "probeGatewaySafety aborts if server DB ('other_test_db_test') does not match expected test DB");

  // --------------------------------------------------------------------------
  // TEST 12: Compliant test gateway acceptance
  // --------------------------------------------------------------------------
  console.log("\n► Test 12: Compliant test gateway acceptance");
  const mockCompliantServer = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "healthy",
      services: {
        database: "connected",
        database_name: "rag_healthcare_test"
      }
    }));
  });

  await new Promise(resolve => mockCompliantServer.listen(5993, "127.0.0.1", resolve));

  let t12Passed = false;
  try {
    const probe = await probeGatewaySafety(5993, "rag_healthcare_test");
    t12Passed = probe.active && probe.serverDbName === "rag_healthcare_test";
  } catch (err) {
    t12Passed = false;
  }
  await new Promise(resolve => mockCompliantServer.close(resolve));
  assert(t12Passed, "probeGatewaySafety accepts verified test backend connected to 'rag_healthcare_test'");

  // --------------------------------------------------------------------------
  // TEST 13: Correct test environment configuration propagation
  // --------------------------------------------------------------------------
  console.log("\n► Test 13: Correct test environment configuration propagation");
  process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS = "true";
  process.env.DB_NAME = "rag_healthcare_test";
  const verifiedDb = verifyTestDatabasePreflight();
  assert(verifiedDb === "rag_healthcare_test", "verifyTestDatabasePreflight returns sanitized database target name");

  // --------------------------------------------------------------------------
  // TEST 14: Unreachable service fails closed
  // --------------------------------------------------------------------------
  console.log("\n► Test 14: Unreachable service fails closed");
  let t14Blocked = false;
  try {
    // Port 5990 has no listener
    await probeGatewaySafety(5990, "rag_healthcare_test");
  } catch (err) {
    t14Blocked = err.message.includes("is unreachable") || err.message.includes("ECONNREFUSED");
  }
  assert(t14Blocked, "probeGatewaySafety rejects when target test gateway is unreachable");

  // --------------------------------------------------------------------------
  // TEST 15: Missing database identity fails closed
  // --------------------------------------------------------------------------
  console.log("\n► Test 15: Missing database identity in /health fails closed");
  const mockNoIdentityServer = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    // Returns 200 healthy but omits database_name
    res.end(JSON.stringify({
      status: "healthy",
      services: { database: "connected" }
    }));
  });
  await new Promise(resolve => mockNoIdentityServer.listen(5994, "127.0.0.1", resolve));

  let t15Blocked = false;
  try {
    await probeGatewaySafety(5994, "rag_healthcare_test");
  } catch (err) {
    t15Blocked = err.message.includes("did not report its database identity");
  }
  await new Promise(resolve => mockNoIdentityServer.close(resolve));
  assert(t15Blocked, "probeGatewaySafety rejects when server fails to report database identity");

  // --------------------------------------------------------------------------
  // TEST 16: Non-200 status response fails closed
  // --------------------------------------------------------------------------
  console.log("\n► Test 16: Non-200 status response fails closed");
  const mock503Server = http.createServer((req, res) => {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "degraded", services: { database: "disconnected" } }));
  });
  await new Promise(resolve => mock503Server.listen(5995, "127.0.0.1", resolve));

  let t16Blocked = false;
  try {
    await probeGatewaySafety(5995, "rag_healthcare_test");
  } catch (err) {
    t16Blocked = err.message.includes("returned non-200 status (503)");
  }
  await new Promise(resolve => mock503Server.close(resolve));
  assert(t16Blocked, "probeGatewaySafety rejects degraded/error HTTP status codes");

  // --------------------------------------------------------------------------
  // TEST 17: Malformed / non-JSON response fails closed
  // --------------------------------------------------------------------------
  console.log("\n► Test 17: Malformed / non-JSON response fails closed");
  const mockHtmlServer = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<html><body>Error or Nginx Proxy Page</body></html>");
  });
  await new Promise(resolve => mockHtmlServer.listen(5996, "127.0.0.1", resolve));

  let t17Blocked = false;
  try {
    await probeGatewaySafety(5996, "rag_healthcare_test");
  } catch (err) {
    t17Blocked = err.message.includes("returned malformed/non-JSON response");
  }
  await new Promise(resolve => mockHtmlServer.close(resolve));
  assert(t17Blocked, "probeGatewaySafety rejects malformed or HTML responses");

  // Restore environment
  for (const key of Object.keys(process.env)) {
    if (!(key in origEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, origEnv);

  console.log("\n==========================================================================");
  console.log(`  SAFETY FOUNDATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
