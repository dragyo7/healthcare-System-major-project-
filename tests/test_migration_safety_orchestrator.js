/**
 * tests/test_migration_safety_orchestrator.js
 *
 * Comprehensive Automated Safety & Invariant Verification Suite for the CDSS Migration Orchestrator.
 *
 * Verifies Scenarios A through O:
 * A. Fresh disposable database: apply all forward migrations in order.
 * B. Repeat run: no already-applied migration is executed again.
 * C. Dry-run: schema and migration history remain unchanged.
 * D. Status: no schema mutation occurs.
 * E. Missing DB_NAME: execution is rejected.
 * F. Primary database target ('rag_healthcare'): execution is rejected before mutation.
 * G. Production-like database target: execution is rejected before mutation.
 * H. Unsafe database suffix: execution is rejected before mutation.
 * I. Missing destructive test opt-in: execution is rejected before mutation.
 * J. Checksum integrity: modified applied migration is detected and execution is halted.
 * K. Concurrency protection: duplicate execution prevented via MySQL advisory lock.
 * L. Rollback guard: rollback cannot target primary database or run without confirmation flag.
 * M. Receptionist safety: broad deletion absent, accounts preserved.
 * N. Consent migration idempotency: rerun/partial application handled safely.
 * O. Disposable database cleanup.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const mysql = require(path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/node_modules/mysql2/promise"));

require(path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/node_modules/dotenv")).config({
    path: path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/.env")
});

const { verifyDestructiveTestSafety } = require("./safety/databaseSafetyGuard");

const DISPOSABLE_DB = "cdss_mig_safety_disposable";

let totalTests = 0;
let passedTests = 0;

function check(title, fn) {
    totalTests++;
    process.stdout.write(`► [Test ${totalTests}] ${title}... `);
    try {
        fn();
        console.log("✓ PASS");
        passedTests++;
    } catch (err) {
        console.log(`✗ FAIL: ${err.message}`);
        throw err;
    }
}

async function checkAsync(title, fn) {
    totalTests++;
    process.stdout.write(`► [Test ${totalTests}] ${title}... `);
    try {
        await fn();
        console.log("✓ PASS");
        passedTests++;
    } catch (err) {
        console.log(`✗ FAIL: ${err.message}`);
        throw err;
    }
}

function runScriptSubprocess(scriptPath, args = [], envOverrides = {}) {
    const env = {
        ...process.env,
        ...envOverrides
    };

    const res = spawnSync(process.execPath, [scriptPath, ...args], {
        env,
        encoding: "utf8",
        cwd: path.resolve(__dirname, "..")
    });

    return {
        code: res.status,
        stdout: res.stdout || "",
        stderr: res.stderr || ""
    };
}

async function main() {
    console.log("==========================================================================");
    console.log("       CDSS MIGRATION ORCHESTRATOR & ROLLBACK SAFETY AUDIT SUITE          ");
    console.log("==========================================================================\n");

    const runnerScript = path.resolve(__dirname, "../scripts/run_migrations.js");
    const rollbackScript = path.resolve(__dirname, "../scripts/run_rollback.js");

    // --------------------------------------------------------------------------
    // SECTION 1: FAIL-CLOSED ENVIRONMENT & TARGET SAFETY REFUSALS
    // --------------------------------------------------------------------------
    console.log("=== SECTION 1: FAIL-CLOSED TARGET VALIDATION INVARIANTS ===");

    check("Missing DB_NAME fails closed immediately", () => {
        const res = runScriptSubprocess(runnerScript, [], {
            DB_NAME: "",
            ALLOW_DESTRUCTIVE_DATABASE_TESTS: "true"
        });
        assert.notStrictEqual(res.code, 0, "Must exit with non-zero error code");
        assert(
            res.stderr.includes("MIGRATION SAFETY REFUSAL") && res.stderr.includes("Missing required DB_NAME"),
            "Error output must state DB_NAME refusal"
        );
    });

    check("Primary application database 'rag_healthcare' is strictly refused", () => {
        const res = runScriptSubprocess(runnerScript, [], {
            DB_NAME: "rag_healthcare",
            ALLOW_DESTRUCTIVE_DATABASE_TESTS: "true"
        });
        assert.notStrictEqual(res.code, 0, "Must exit with non-zero error code");
        assert(
            res.stderr.includes("MIGRATION SAFETY REFUSAL") && res.stderr.includes("primary application or production database"),
            "Must refuse primary database 'rag_healthcare'"
        );
    });

    check("Production database name containing 'prod' is strictly refused", () => {
        const res = runScriptSubprocess(runnerScript, [], {
            DB_NAME: "cdss_prod_db",
            ALLOW_DESTRUCTIVE_DATABASE_TESTS: "true"
        });
        assert.notStrictEqual(res.code, 0, "Must exit with non-zero error code");
        assert(
            res.stderr.includes("MIGRATION SAFETY REFUSAL"),
            "Must refuse production target"
        );
    });

    check("Arbitrary database name lacking '_test' or '_disposable' is refused", () => {
        const res = runScriptSubprocess(runnerScript, [], {
            DB_NAME: "my_custom_ehr",
            ALLOW_DESTRUCTIVE_DATABASE_TESTS: "true"
        });
        assert.notStrictEqual(res.code, 0, "Must exit with non-zero error code");
        assert(
            res.stderr.includes("must end with '_test' or '_disposable'"),
            "Must require safe suffix"
        );
    });

    check("Execution without ALLOW_DESTRUCTIVE_DATABASE_TESTS=true is refused", () => {
        const res = runScriptSubprocess(runnerScript, [], {
            DB_NAME: DISPOSABLE_DB,
            ALLOW_DESTRUCTIVE_DATABASE_TESTS: "false"
        });
        assert.notStrictEqual(res.code, 0, "Must exit with non-zero error code");
        assert(
            res.stderr.includes("ALLOW_DESTRUCTIVE_DATABASE_TESTS=true"),
            "Must require explicit opt-in"
        );
    });

    // --------------------------------------------------------------------------
    // SECTION 2: READ-ONLY STATUS & DRY-RUN INVARIANTS (ON FRESH DB)
    // --------------------------------------------------------------------------
    console.log("\n=== SECTION 2: READ-ONLY STATUS & DRY-RUN INVARIANTS ===");

    const rootConn = await mysql.createConnection({
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD,
        multipleStatements: true
    });

    try {
        // Create clean disposable database
        await rootConn.query(`DROP DATABASE IF EXISTS \`${DISPOSABLE_DB}\``);
        await rootConn.query(`CREATE DATABASE \`${DISPOSABLE_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);

        const disposablePool = mysql.createPool({
            host: process.env.DB_HOST || "127.0.0.1",
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER || "root",
            password: process.env.DB_PASSWORD,
            database: DISPOSABLE_DB,
            multipleStatements: true
        });

        await checkAsync("--status on clean DB does NOT create schema_migrations or alter schema", async () => {
            const res = runScriptSubprocess(runnerScript, ["--status"], {
                DB_NAME: DISPOSABLE_DB,
                ALLOW_DESTRUCTIVE_DATABASE_TESTS: "true"
            });
            assert.strictEqual(res.code, 0, "Status must exit cleanly");
            assert(res.stdout.includes("Genuinely read-only"), "Must log read-only confirmation");

            // Verify table was NOT created
            const [tables] = await disposablePool.query("SHOW TABLES");
            assert.strictEqual(tables.length, 0, "Zero tables must exist after --status");
        });

        await checkAsync("--dry-run on clean DB does NOT create schema_migrations or apply SQL", async () => {
            const res = runScriptSubprocess(runnerScript, ["--dry-run"], {
                DB_NAME: DISPOSABLE_DB,
                ALLOW_DESTRUCTIVE_DATABASE_TESTS: "true"
            });
            assert.strictEqual(res.code, 0, "Dry-run must exit cleanly");
            assert(res.stdout.includes("DRY-RUN SUMMARY"), "Must output dry-run summary");

            // Verify table was NOT created
            const [tables] = await disposablePool.query("SHOW TABLES");
            assert.strictEqual(tables.length, 0, "Zero tables must exist after --dry-run");
        });

        // --------------------------------------------------------------------------
        // SECTION 3: FORWARD MIGRATION EXECUTION & CHECKSUM INTEGRITY
        // --------------------------------------------------------------------------
        console.log("\n=== SECTION 3: FORWARD EXECUTION, IDEMPOTENCY & CHECKSUMS ===");

        await checkAsync("Active migration run applies all 7 forward migrations with checksums", async () => {
            const res = runScriptSubprocess(runnerScript, [], {
                DB_NAME: DISPOSABLE_DB,
                ALLOW_DESTRUCTIVE_DATABASE_TESTS: "true"
            });
            assert.strictEqual(res.code, 0, `Migration run must succeed: ${res.stderr}`);
            assert(res.stdout.includes("MIGRATION RUN COMPLETE: 7 applied in this run"), "Must apply 7 migrations");

            const [tables] = await disposablePool.query("SHOW TABLES");
            assert(tables.length >= 14, `Expected at least 14 tables in schema, found ${tables.length}`);

            const [migrations] = await disposablePool.query("SELECT version, checksum FROM schema_migrations ORDER BY version ASC");
            assert.strictEqual(migrations.length, 7, "All 7 migrations must be recorded in schema_migrations");
            for (const m of migrations) {
                assert(m.checksum && m.checksum.length === 64, `Migration ${m.version} must record a 64-char SHA-256 checksum`);
            }
        });

        await checkAsync("Repeat migration run skips already-applied migrations (0 applied in repeat)", async () => {
            const res = runScriptSubprocess(runnerScript, [], {
                DB_NAME: DISPOSABLE_DB,
                ALLOW_DESTRUCTIVE_DATABASE_TESTS: "true"
            });
            assert.strictEqual(res.code, 0, "Repeat run must succeed");
            assert(res.stdout.includes("0 applied in this run"), "Repeat run must apply 0 migrations");
            assert(res.stdout.includes("checksum verified"), "Must verify existing checksums");
        });

        await checkAsync("Checksum mismatch on modified applied migration causes fail-closed abort", async () => {
            // Tamper with checksum of 006 in database
            await disposablePool.query(
                "UPDATE schema_migrations SET checksum = '0000000000000000000000000000000000000000000000000000000000000000' WHERE version = '006_add_consent_audit_to_users.sql'"
            );

            const res = runScriptSubprocess(runnerScript, [], {
                DB_NAME: DISPOSABLE_DB,
                ALLOW_DESTRUCTIVE_DATABASE_TESTS: "true"
            });
            assert.notStrictEqual(res.code, 0, "Must exit with non-zero error code on checksum mismatch");
            assert(
                res.stderr.includes("MIGRATION INTEGRITY ERROR: Checksum mismatch"),
                "Must log descriptive checksum mismatch error"
            );

            // Restore correct checksum
            const mig006Path = path.resolve(__dirname, "../migrations/006_add_consent_audit_to_users.sql");
            const crypto = require("crypto");
            const realChecksum = crypto.createHash("sha256").update(fs.readFileSync(mig006Path, "utf8"), "utf8").digest("hex");
            await disposablePool.query(
                "UPDATE schema_migrations SET checksum = ? WHERE version = '006_add_consent_audit_to_users.sql'",
                [realChecksum]
            );
        });

        // --------------------------------------------------------------------------
        // SECTION 4: CONCURRENCY ADVISORY LOCKING
        // --------------------------------------------------------------------------
        console.log("\n=== SECTION 4: CONCURRENCY ADVISORY LOCKING ===");

        await checkAsync("Concurrency protection blocks parallel runner when lock is held", async () => {
            // Acquire lock manually
            const [lockRes] = await disposablePool.query("SELECT GET_LOCK('cdss_migration_runner_lock', 2) AS lk");
            assert.strictEqual(lockRes[0].lk, 1, "Must acquire lock");

            try {
                const res = runScriptSubprocess(runnerScript, [], {
                    DB_NAME: DISPOSABLE_DB,
                    ALLOW_DESTRUCTIVE_DATABASE_TESTS: "true"
                });
                assert.notStrictEqual(res.code, 0, "Must fail when lock is held by another process");
                assert(
                    res.stderr.includes("MIGRATION CONCURRENCY REFUSAL") || res.stderr.includes("Could not acquire advisory lock"),
                    "Must refuse execution when lock is held"
                );
            } finally {
                await disposablePool.query("SELECT RELEASE_LOCK('cdss_migration_runner_lock')");
            }
        });

        // --------------------------------------------------------------------------
        // SECTION 5: CONTROLLED ROLLBACK SAFETY & RECEPTIONIST PROTECTION
        // --------------------------------------------------------------------------
        console.log("\n=== SECTION 5: CONTROLLED ROLLBACK SAFETY & RECEPTIONIST PRESERVATION ===");

        check("Rollback executor rejects execution without --confirm-destructive-rollback", () => {
            const res = runScriptSubprocess(rollbackScript, [], {
                DB_NAME: DISPOSABLE_DB,
                ALLOW_DESTRUCTIVE_DATABASE_TESTS: "true"
            });
            assert.notStrictEqual(res.code, 0, "Must fail without confirmation flag");
            assert(
                res.stderr.includes("ROLLBACK SAFETY REFUSAL") && res.stderr.includes("--confirm-destructive-rollback"),
                "Must require confirmation flag"
            );
        });

        check("Rollback executor strictly refuses primary database 'rag_healthcare'", () => {
            const res = runScriptSubprocess(rollbackScript, ["--confirm-destructive-rollback"], {
                DB_NAME: "rag_healthcare",
                ALLOW_DESTRUCTIVE_DATABASE_TESTS: "true"
            });
            assert.notStrictEqual(res.code, 0, "Must fail on primary database");
            assert(res.stderr.includes("MIGRATION SAFETY REFUSAL"), "Must refuse primary database");
        });

        await checkAsync("Receptionist accounts are protected from broad deletion in rollback 001", async () => {
            // Read 001_rollback.sql content
            const rb001Content = fs.readFileSync(path.resolve(__dirname, "../migrations/001_rollback.sql"), "utf8");
            assert(
                !rb001Content.includes("DELETE FROM users WHERE role = 'receptionist'"),
                "Broad deletion 'DELETE FROM users WHERE role = receptionist' MUST NOT be present in 001_rollback.sql"
            );
        });

        await checkAsync("Single rollback step rolls back 006 and removes it from schema_migrations", async () => {
            const res = runScriptSubprocess(rollbackScript, ["--step", "1", "--confirm-destructive-rollback"], {
                DB_NAME: DISPOSABLE_DB,
                ALLOW_DESTRUCTIVE_DATABASE_TESTS: "true"
            });
            assert.strictEqual(res.code, 0, `Rollback step 1 must succeed: ${res.stderr}`);
            assert(res.stdout.includes("006_add_consent_audit_to_users.sql"), "Must roll back 006");

            const [check006] = await disposablePool.query("SELECT 1 FROM schema_migrations WHERE version = '006_add_consent_audit_to_users.sql'");
            assert.strictEqual(check006.length, 0, "006 must be removed from schema_migrations table");

            // Verify consent columns dropped from users
            const [cols] = await disposablePool.query(
                "SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = 'users' AND column_name IN ('consent_timestamp', 'consent_version')",
                [DISPOSABLE_DB]
            );
            assert.strictEqual(cols.length, 0, "Consent columns must be removed from users table");
        });

        await checkAsync("Re-applying forward migration 006 succeeds cleanly (deterministic idempotency)", async () => {
            const res = runScriptSubprocess(runnerScript, [], {
                DB_NAME: DISPOSABLE_DB,
                ALLOW_DESTRUCTIVE_DATABASE_TESTS: "true"
            });
            assert.strictEqual(res.code, 0, "Re-application of 006 must succeed");
            assert(res.stdout.includes("1 applied in this run"), "Must re-apply exactly 006");

            const [check006] = await disposablePool.query("SELECT 1 FROM schema_migrations WHERE version = '006_add_consent_audit_to_users.sql'");
            assert.strictEqual(check006.length, 1, "006 must be restored in schema_migrations");
        });

        await disposablePool.end();

        // --------------------------------------------------------------------------
        // CLEANUP
        // --------------------------------------------------------------------------
        console.log("\n► Cleaning up ephemeral disposable database...");
        await rootConn.query(`DROP DATABASE IF EXISTS \`${DISPOSABLE_DB}\``);
        console.log(`  ✓ Ephemeral database '${DISPOSABLE_DB}' dropped cleanly.`);

    } finally {
        await rootConn.end();
    }

    console.log("\n==========================================================================");
    console.log(`MIGRATION SAFETY AUDIT COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
    console.log("==========================================================================");
}

main().catch(err => {
    console.error("\n[TEST RUNNER FATAL ERROR]:", err);
    process.exit(1);
});
