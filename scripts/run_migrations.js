/**
 * scripts/run_migrations.js
 *
 * Fail-Closed Database Migration Orchestrator for the Clinical Decision Support System (CDSS).
 * Tracks and applies incremental SQL migrations in migrations/ directory with strict safety invariants.
 *
 * SAFETY INVARIANTS:
 * 1. Target database MUST be explicitly configured via process.env.DB_NAME (no silent default).
 * 2. Primary database 'rag_healthcare' and production targets are strictly refused.
 * 3. Target database MUST end with '_test' or '_disposable'.
 * 4. --status and --dry-run are genuinely read-only (zero schema mutations, no table creation).
 * 5. Concurrency protection via MySQL advisory locks (GET_LOCK / RELEASE_LOCK).
 * 6. Cryptographic integrity verification via SHA-256 checksums in schema_migrations table.
 * 7. Records applied migrations in history ONLY after SQL execution succeeds.
 * 8. Sanitizes diagnostics to prevent credential leakage.
 *
 * Usage:
 *   node scripts/run_migrations.js           # Apply pending migrations
 *   node scripts/run_migrations.js --status  # Check migration status (read-only)
 *   node scripts/run_migrations.js --dry-run # Preview pending migrations (read-only)
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require(path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/node_modules/mysql2/promise"));

// Load environment configuration if available
const envPath = path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/.env");
if (fs.existsSync(envPath)) {
    require(path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/node_modules/dotenv")).config({
        path: envPath
    });
}

const { verifyDestructiveTestSafety } = require("../tests/safety/databaseSafetyGuard");

/**
 * Validates target database name against fail-closed safety constraints.
 * Throws a descriptive Error if the database target is unverified or unsafe.
 */
function validateMigrationTarget(targetDb) {
    if (!targetDb || typeof targetDb !== "string" || targetDb.trim().length === 0) {
        throw new Error(
            "MIGRATION SAFETY REFUSAL: Missing required DB_NAME environment variable. " +
            "The migration orchestrator strictly refuses to default to 'rag_healthcare' or any implicit database. " +
            "Please explicitly configure DB_NAME ending in '_test' or '_disposable'."
        );
    }

    const normalized = targetDb.trim().toLowerCase();
    if (normalized === "rag_healthcare" || normalized === "production" || normalized.includes("prod")) {
        throw new Error(
            `MIGRATION SAFETY REFUSAL: Target database '${targetDb}' is the primary application or production database! ` +
            `Direct automated migration execution against '${targetDb}' is strictly forbidden.`
        );
    }

    if (!normalized.endsWith("_test") && !normalized.endsWith("_disposable")) {
        throw new Error(
            `MIGRATION SAFETY REFUSAL: Target database '${targetDb}' must end with '_test' or '_disposable'. ` +
            `Non-disposable database targets are strictly blocked.`
        );
    }

    // Enforce destructive test safety guard
    verifyDestructiveTestSafety(normalized);
    return normalized;
}

/**
 * Reads and strictly validates migration files in the migrations/ directory.
 * Returns sorted list of valid forward migration filenames.
 */
function getMigrationFiles(migrationsDir) {
    if (!fs.existsSync(migrationsDir)) {
        throw new Error(`Migrations directory not found at '${migrationsDir}'`);
    }

    const entries = fs.readdirSync(migrationsDir);
    const validPattern = /^\d{3}_[a-z0-9_]+\.sql$/i;
    const forwardFiles = [];

    for (const file of entries) {
        if (!file.endsWith(".sql")) {
            continue;
        }

        // Exclude rollback files reliably
        if (file.toLowerCase().includes("rollback")) {
            continue;
        }

        if (!validPattern.test(file)) {
            throw new Error(
                `MIGRATION SAFETY REFUSAL: Unexpected SQL filename '${file}' in migrations directory. ` +
                `Forward migrations must match convention 'NNN_description.sql' (e.g., '001_add_receptionist_role.sql').`
            );
        }

        forwardFiles.push(file);
    }

    return forwardFiles.sort();
}

/**
 * Calculates SHA-256 hash of a file's content.
 */
function computeChecksum(content) {
    return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

async function main() {
    const isStatus = process.argv.includes("--status");
    const isDryRun = process.argv.includes("--dry-run");

    console.log("==========================================================================");
    console.log("          CDSS FAIL-CLOSED DATABASE MIGRATION ORCHESTRATOR                ");
    console.log("==========================================================================\n");

    const targetDb = validateMigrationTarget(process.env.DB_NAME);
    console.log(`► Target Database Verified Safe: '${targetDb}'`);

    const dbHost = process.env.DB_HOST || "localhost";
    const dbPort = Number(process.env.DB_PORT) || 3306;
    const dbUser = process.env.DB_USER || "root";
    const dbPassword = process.env.DB_PASSWORD || "";

    console.log(`► Connection Host: ${dbHost}:${dbPort} (User: ${dbUser}) [CREDENTIALS REDACTED]`);

    const migrationsDir = path.resolve(__dirname, "../migrations");
    const allForwardFiles = getMigrationFiles(migrationsDir);
    console.log(`► Found ${allForwardFiles.length} valid forward migration files in migrations/\n`);

    const pool = mysql.createPool({
        host: dbHost,
        user: dbUser,
        password: dbPassword,
        database: targetDb,
        port: dbPort,
        waitForConnections: true,
        connectionLimit: 2,
        multipleStatements: true
    });

    let connection;
    let lockAcquired = false;

    try {
        connection = await pool.getConnection();

        // Ensure database identity matches verified target
        const [dbCheck] = await connection.query("SELECT DATABASE() AS cur_db");
        if (!dbCheck[0] || dbCheck[0].cur_db !== targetDb) {
            throw new Error(`Connected database mismatch! Expected '${targetDb}', got '${dbCheck[0]?.cur_db}'`);
        }

        // Check if schema_migrations table exists (strictly read-only check)
        const [tableCheck] = await connection.query(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = 'schema_migrations'",
            [targetDb]
        );
        const migrationsTableExists = tableCheck.length > 0;

        let appliedMap = new Map(); // version -> { checksum, applied_at }

        if (migrationsTableExists) {
            // Check if checksum column exists
            const [colCheck] = await connection.query(
                "SELECT 1 FROM information_schema.columns WHERE table_schema = ? AND table_name = 'schema_migrations' AND column_name = 'checksum'",
                [targetDb]
            );
            const hasChecksumCol = colCheck.length > 0;

            const selectSql = hasChecksumCol
                ? "SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version ASC"
                : "SELECT version, NULL as checksum, applied_at FROM schema_migrations ORDER BY version ASC";

            const [rows] = await connection.query(selectSql);
            for (const r of rows) {
                appliedMap.set(r.version, {
                    checksum: r.checksum || null,
                    applied_at: r.applied_at
                });
            }
        }

        // ======================================================================
        // MODE 1: READ-ONLY STATUS
        // ======================================================================
        if (isStatus) {
            console.log("--------------------------------------------------------------------------");
            console.log(`MIGRATION STATUS FOR '${targetDb}':`);
            console.log(`Tracking Table: ${migrationsTableExists ? "Active ('schema_migrations')" : "Not yet created (0 applied)"}`);
            console.log("--------------------------------------------------------------------------");

            for (const file of allForwardFiles) {
                const filePath = path.join(migrationsDir, file);
                const content = fs.readFileSync(filePath, "utf8");
                const currentChecksum = computeChecksum(content);
                const appliedRecord = appliedMap.get(file);

                if (appliedRecord) {
                    let integrityTag = "";
                    if (appliedRecord.checksum) {
                        integrityTag = appliedRecord.checksum === currentChecksum
                            ? " [CHECKSUM VERIFIED]"
                            : " [CHECKSUM MISMATCH - TAMPERED]";
                    } else {
                        integrityTag = " [LEGACY RECORD - NO CHECKSUM]";
                    }
                    console.log(`  [APPLIED]  ${file.padEnd(45)} (at: ${appliedRecord.applied_at})${integrityTag}`);
                } else {
                    console.log(`  [PENDING]  ${file}`);
                }
            }
            console.log("--------------------------------------------------------------------------");
            console.log(`SUMMARY: ${appliedMap.size} applied, ${allForwardFiles.length - appliedMap.size} pending.`);
            console.log("Genuinely read-only: Zero schema mutations performed.");
            return;
        }

        // ======================================================================
        // MODE 2: READ-ONLY DRY-RUN
        // ======================================================================
        if (isDryRun) {
            console.log("--------------------------------------------------------------------------");
            console.log(`DRY-RUN MIGRATION PREVIEW FOR '${targetDb}':`);
            console.log("--------------------------------------------------------------------------");

            let pendingCount = 0;
            for (const file of allForwardFiles) {
                const filePath = path.join(migrationsDir, file);
                const content = fs.readFileSync(filePath, "utf8");
                const currentChecksum = computeChecksum(content);
                const appliedRecord = appliedMap.get(file);

                if (appliedRecord) {
                    if (appliedRecord.checksum && appliedRecord.checksum !== currentChecksum) {
                        console.warn(`  ⚠️  [INTEGRITY WARNING] ${file} is applied but current file has altered checksum!`);
                    } else {
                        console.log(`  [SKIP]     ${file} (already applied)`);
                    }
                } else {
                    pendingCount++;
                    console.log(`  [WOULD APPLY] ${file} (checksum: ${currentChecksum.substring(0, 12)}...)`);
                }
            }
            console.log("--------------------------------------------------------------------------");
            console.log(`DRY-RUN SUMMARY: ${pendingCount} migrations would be applied.`);
            console.log("Genuinely read-only: Zero schema mutations performed.");
            return;
        }

        // ======================================================================
        // MODE 3: ACTIVE MIGRATION EXECUTION
        // ======================================================================
        console.log("► Acquiring migration advisory lock ('cdss_migration_runner_lock')...");
        const [lockRes] = await connection.query("SELECT GET_LOCK('cdss_migration_runner_lock', 10) AS lock_acquired");
        if (!lockRes[0] || lockRes[0].lock_acquired !== 1) {
            throw new Error(
                "MIGRATION CONCURRENCY REFUSAL: Could not acquire advisory lock 'cdss_migration_runner_lock' within 10 seconds. " +
                "Another migration runner process is currently executing against this server."
            );
        }
        lockAcquired = true;
        console.log("  ✓ Advisory lock acquired successfully.\n");

        // Ensure schema_migrations table with checksum column exists
        await connection.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(100) PRIMARY KEY,
                checksum VARCHAR(64) NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        // Check if checksum column needs to be added to pre-existing schema_migrations table
        const [colCheck] = await connection.query(
            "SELECT 1 FROM information_schema.columns WHERE table_schema = ? AND table_name = 'schema_migrations' AND column_name = 'checksum'",
            [targetDb]
        );
        if (colCheck.length === 0) {
            await connection.query("ALTER TABLE schema_migrations ADD COLUMN checksum VARCHAR(64) NULL AFTER version");
            console.log("  ✓ Upgraded schema_migrations table with checksum audit column.");
        }

        // Refresh applied map after table setup
        const [freshRows] = await connection.query("SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version ASC");
        appliedMap = new Map();
        for (const r of freshRows) {
            appliedMap.set(r.version, { checksum: r.checksum || null, applied_at: r.applied_at });
        }

        let appliedInThisRun = 0;

        for (const file of allForwardFiles) {
            const filePath = path.join(migrationsDir, file);
            const content = fs.readFileSync(filePath, "utf8");
            const currentChecksum = computeChecksum(content);
            const appliedRecord = appliedMap.get(file);

            if (appliedRecord) {
                // Cryptographic integrity verification for already applied migrations
                if (appliedRecord.checksum && appliedRecord.checksum !== currentChecksum) {
                    throw new Error(
                        `MIGRATION INTEGRITY ERROR: Checksum mismatch for already-applied migration '${file}'!\n` +
                        `  Recorded checksum: ${appliedRecord.checksum}\n` +
                        `  Current checksum:  ${currentChecksum}\n` +
                        `The content of migration '${file}' was modified after it was applied to the database. Refusing to proceed.`
                    );
                }

                console.log(`[SKIP] Already applied: ${file} ${appliedRecord.checksum ? "(checksum verified)" : "(legacy unverified)"}`);
                continue;
            }

            console.log(`[APPLYING] ${file}...`);
            console.log(`   SHA-256: ${currentChecksum}`);

            // NOTE ON MYSQL DDL TRANSACTIONS:
            // MySQL DDL statements (CREATE TABLE, ALTER TABLE, DROP TABLE) cause an IMPLICIT COMMIT.
            // If a migration file contains multiple DDL statements and fails midway, MySQL CANNOT
            // roll back the preceding DDL statements.
            // Therefore, we record the migration in schema_migrations ONLY after all statements succeed.
            try {
                await connection.query(content);
                await connection.execute(
                    "INSERT INTO schema_migrations (version, checksum, applied_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
                    [file, currentChecksum]
                );
                appliedInThisRun++;
                console.log(`   ✓ Successfully applied and recorded: ${file}\n`);
            } catch (execErr) {
                console.error(`\n[FATAL MIGRATION FAILURE in ${file}]:`, execErr.message);
                console.error(
                    `NOTE: MySQL DDL statements commit implicitly. Any statements in '${file}' executed ` +
                    `prior to the failing statement may have been committed. The migration was NOT recorded in schema_migrations.`
                );
                throw execErr;
            }
        }

        console.log("==========================================================================");
        console.log(`MIGRATION RUN COMPLETE: ${appliedInThisRun} applied in this run (${appliedMap.size + appliedInThisRun} total applied).`);
        console.log("==========================================================================");

    } finally {
        if (lockAcquired && connection) {
            try {
                await connection.query("SELECT RELEASE_LOCK('cdss_migration_runner_lock')");
                console.log("► Released advisory lock ('cdss_migration_runner_lock').");
            } catch (lockErr) {
                console.warn("⚠️  Warning releasing advisory lock:", lockErr.message);
            }
        }

        if (connection) {
            connection.release();
        }
        await pool.end();
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error("\n[MIGRATION RUNNER TERMINATED WITH ERROR]:", err.message);
        process.exit(1);
    });
}

module.exports = {
    validateMigrationTarget,
    getMigrationFiles,
    computeChecksum,
    main
};
