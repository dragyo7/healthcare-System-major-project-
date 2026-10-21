/**
 * test_destructive_guard_rejection.js
 *
 * Verifies that the destructive integration test guard fails closed:
 * 1. Refuses execution when ALLOW_DESTRUCTIVE_DATABASE_TESTS is absent or false
 * 2. Refuses execution when target database is 'rag_healthcare' (primary DB protection)
 * 3. Refuses execution when target database is production or contains 'prod'
 * 4. Refuses execution when target database does not end with '_test' or '_disposable'
 * 5. Passes only when ALLOW_DESTRUCTIVE_DATABASE_TESTS === 'true' AND target ends in '_test' or '_disposable'
 * 6. Executes actual script in a subprocess to prove fail-closed refusal before connection
 */

const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");
const { verifyDestructiveTestSafety } = require("./integration/test_doctor_safety_and_alternatives_e2e");

console.log("==========================================================================");
console.log("     VERIFYING DESTRUCTIVE TEST SAFETY GUARDS & REFUSAL INVARIANTS       ");
console.log("==========================================================================\n");

let passed = 0;
let failed = 0;

function check(title, fn) {
  process.stdout.write(`► ${title}... `);
  try {
    fn();
    console.log("✓ PASS");
    passed++;
  } catch (err) {
    console.log(`✗ FAIL: ${err.message}`);
    failed++;
  }
}

// Ensure clean env for testing
const originalOptIn = process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS;

try {
  // Test 1: Missing opt-in env var
  check("Guard rejects execution when ALLOW_DESTRUCTIVE_DATABASE_TESTS is unset", () => {
    delete process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS;
    assert.throws(() => {
      verifyDestructiveTestSafety("disposable_test");
    }, /Execution requires explicit opt-in via environment variable ALLOW_DESTRUCTIVE_DATABASE_TESTS=true/);
  });

  // Test 2: Opt-in set to "false" or random string
  check("Guard rejects execution when ALLOW_DESTRUCTIVE_DATABASE_TESTS is not 'true'", () => {
    process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS = "false";
    assert.throws(() => {
      verifyDestructiveTestSafety("disposable_test");
    }, /Execution requires explicit opt-in/);

    process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS = "1";
    assert.throws(() => {
      verifyDestructiveTestSafety("disposable_test");
    }, /Execution requires explicit opt-in/);
  });

  // Test 3: Rejection of primary application database 'rag_healthcare'
  check("Guard strictly forbids primary database 'rag_healthcare'", () => {
    process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS = "true";
    assert.throws(() => {
      verifyDestructiveTestSafety("rag_healthcare");
    }, /Target database 'rag_healthcare' is the primary application or production database/);
  });

  // Test 4: Rejection of production database names
  check("Guard strictly forbids production database targets", () => {
    process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS = "true";
    assert.throws(() => {
      verifyDestructiveTestSafety("production");
    }, /primary application or production database/);

    assert.throws(() => {
      verifyDestructiveTestSafety("prod_db_test");
    }, /primary application or production database/);
  });

  // Test 5: Rejection of databases lacking '_test' or '_disposable' suffix
  check("Guard strictly rejects arbitrary databases lacking test/disposable suffix", () => {
    process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS = "true";
    assert.throws(() => {
      verifyDestructiveTestSafety("my_app_db");
    }, /must end with '_test' or '_disposable'/);
  });

  // Test 6: Permitted target with proper suffix
  check("Guard accepts valid disposable database with opt-in enabled", () => {
    process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS = "true";
    assert.doesNotThrow(() => {
      verifyDestructiveTestSafety("rag_healthcare_disposable");
    });
    assert.doesNotThrow(() => {
      verifyDestructiveTestSafety("clinical_sandbox_test");
    });
  });

  // Test 7: Subprocess execution of the destructive test script fails-closed
  check("Direct execution of test_doctor_safety_and_alternatives_e2e.js exits non-zero without opt-in", () => {
    const scriptPath = path.resolve(__dirname, "integration/test_doctor_safety_and_alternatives_e2e.js");
    const subEnv = { ...process.env };
    delete subEnv.ALLOW_DESTRUCTIVE_DATABASE_TESTS;

    const res = spawnSync("node", [scriptPath], {
      env: subEnv,
      encoding: "utf8"
    });

    assert.strictEqual(res.status, 1, `Expected exit code 1, got ${res.status}`);
    const output = (res.stdout || "") + (res.stderr || "");
    assert.ok(
      output.includes("SAFETY REFUSAL") || output.includes("ALLOW_DESTRUCTIVE_DATABASE_TESTS=true"),
      `Expected output to contain 'SAFETY REFUSAL', got: ${output}`
    );
  });

} finally {
  if (originalOptIn !== undefined) {
    process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS = originalOptIn;
  } else {
    delete process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS;
  }
}

console.log("\n==========================================================================");
console.log(`  DESTRUCTIVE GUARD REJECTION SUMMARY: ${passed}/${passed + failed} CHECKS PASSED`);
console.log("==========================================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
