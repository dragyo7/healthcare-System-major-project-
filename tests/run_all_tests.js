/**
 * tests/run_all_tests.js
 *
 * Master test runner for all maintained integration, security, and E2E test suites.
 * Executes:
 *   1. tests/integration/test_route_authorization_matrix.js (BOLA & RBAC matrix)
 *   2. scratch/test_activation_and_role_mismatch.js (Account activation & RBAC)
 *   3. scratch/test_receptionist_endpoints.js (Receptionist workflow)
 *   4. scratch/test_phase3_express_bridge.js (Express to FastAPI bridge)
 *   5. scratch/test_portal_cds_responsibilities.js (CDS role boundaries)
 *   6. scratch/test_prescription_ocr_pipeline.js (Prescription OCR pipeline)
 *   7. scratch/test_patient_and_discharge.js (Patient portal & discharge care)
 *   8. scratch/test_doctor_portal_e2e.js (Doctor portal workflow)
 *   9. scratch/test_full_system_multi_role_e2e.js (End-to-end multi-role journey)
 */

const { spawnSync } = require("child_process");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const backendModules = path.resolve(
  repoRoot,
  "Portal Major P/Bhumi/Doctor portal/backend/node_modules"
);

const suites = [
  { name: "Route Authorization & BOLA Matrix", script: "tests/integration/test_route_authorization_matrix.js" },
  { name: "Account Activation & RBAC Isolation", script: "scratch/test_activation_and_role_mismatch.js" },
  { name: "Receptionist Administrative Workflow", script: "scratch/test_receptionist_endpoints.js" },
  { name: "Express-to-FastAPI Gateway Bridge", script: "scratch/test_phase3_express_bridge.js" },
  { name: "Portal CDS Role Boundaries", script: "scratch/test_portal_cds_responsibilities.js" },
  { name: "Prescription OCR Pipeline & Review", script: "scratch/test_prescription_ocr_pipeline.js" },
  { name: "Patient Self-Service & Discharge Care", script: "scratch/test_patient_and_discharge.js" },
  { name: "Doctor Portal Clinical E2E", script: "scratch/test_doctor_portal_e2e.js" },
  { name: "Full-System Multi-Role Synthetic Journey", script: "scratch/test_full_system_multi_role_e2e.js" },
  { name: "Adversarial Gateway & Security Invariants", script: "tests/test_adversarial_gateway_e2e.js" },
  { name: "Supabase Auth & Deployment Security", script: "scratch/test_supabase_security_and_deployment.js" },
  { name: "Authentication & Role Tampering Security", script: "scratch/test_auth_and_tampering_security.js" },
  { name: "Concurrent Prescription Idempotency & Locking", script: "tests/integration/test_concurrent_prescription_idempotency.js" },
  { name: "Prescription PDF Ownership & Lock Failure", script: "tests/integration/test_pdf_ownership_and_lock_failure.js" },
  { name: "JWT Security & Fail-Closed Configuration", script: "tests/test_jwt_security_configuration.js" },
  { name: "Destructive Test Guard Rejection & Safety Invariants", script: "tests/test_destructive_guard_rejection.js" },
];

const {
  verifyTestDatabasePreflight,
  probeGatewaySafety
} = require("./safety/databaseSafetyGuard");

async function main() {
  console.log("==========================================================================");
  console.log("             RUNNING COMPLETE HEALTHCARE CDS TEST SUITE                   ");
  console.log("==========================================================================\n");

  // Preflight Database Safety Invariant Verification
  console.log("► [PREFLIGHT] Verifying Database Safety Invariants...");
  let targetDb;
  try {
    targetDb = verifyTestDatabasePreflight();
    console.log(`✓ [PREFLIGHT] Verified test database target: '${targetDb}' (Opt-in confirmed)`);
  } catch (err) {
    console.error(`\n❌ [PREFLIGHT ABORT] Test suite execution blocked by Database Safety Guard:`);
    console.error(`   ${err.message}\n`);
    process.exit(1);
  }

  // Preflight Gateway Safety Verification
  const testPort = parseInt(process.env.TEST_EXPRESS_PORT || process.env.EXPRESS_PORT || "5001");
  console.log(`► [PREFLIGHT] Probing Gateway Safety on port ${testPort}...`);
  try {
    const probe = await probeGatewaySafety(testPort, targetDb);
    console.log(`✓ [PREFLIGHT] Active gateway on port ${testPort} verified safe (DB: '${probe.serverDbName}')`);
  } catch (err) {
    console.error(`\n❌ [PREFLIGHT ABORT] Gateway safety probe failed:`);
    console.error(`   ${err.message}\n`);
    process.exit(1);
  }
  console.log();

  let passedSuites = 0;
  let failedSuites = 0;
  const results = [];

  const fs = require("fs");
  let testDbFileConfig = {};
  try {
    const cfgPath = path.resolve(repoRoot, "scratch/test_db_config.json");
    if (fs.existsSync(cfgPath)) {
      testDbFileConfig = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    }
  } catch (_) {}

  const env = {
    ...process.env,
    NODE_ENV: "test",
    DB_NAME: targetDb,
    DB_USER: process.env.DB_USER || testDbFileConfig.user || "root",
    DB_PASSWORD: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (testDbFileConfig.password !== undefined ? testDbFileConfig.password : ""),
    DB_HOST: process.env.DB_HOST || testDbFileConfig.host || "127.0.0.1",
    DB_PORT: String(process.env.DB_PORT || testDbFileConfig.port || "3306"),
    TEST_EXPRESS_PORT: String(testPort),
    NODE_PATH: backendModules,
    JWT_SECRET: process.env.JWT_SECRET || "rag_healthcare_secret",
  };

  for (const suite of suites) {
    process.stdout.write(`► Running: ${suite.name} (${suite.script})... `);
    const start = Date.now();
    const scriptPath = path.resolve(repoRoot, suite.script);

    const res = spawnSync("node", [scriptPath], {
      cwd: repoRoot,
      env,
      encoding: "utf8",
      timeout: 180000,
    });

    const duration = ((Date.now() - start) / 1000).toFixed(1);

    if (res.status === 0) {
      console.log(`[PASS] (${duration}s)`);
      passedSuites++;
      results.push({ name: suite.name, status: "PASS", duration, output: res.stdout });
    } else {
      console.log(`[FAIL] (exit code: ${res.status}, ${duration}s)`);
      if (res.stderr) console.error(res.stderr);
      failedSuites++;
      results.push({ name: suite.name, status: "FAIL", duration, output: res.stdout || res.stderr });
    }
  }

  console.log("\n==========================================================================");
  console.log(`  COMPLETE TEST SUITE SUMMARY: ${passedSuites}/${suites.length} SUITES PASSED, ${failedSuites} FAILED`);
  console.log("==========================================================================\n");

  if (failedSuites > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error("Unhandled error during test run:", err);
  process.exit(1);
});
