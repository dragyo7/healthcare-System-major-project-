/**
 * scripts/run_rollback.js
 *
 * Controlled, Fail-Closed Database Rollback Executor for CDSS.
 * Executes rollback scripts in reverse order on explicitly verified disposable test databases.
 *
 * STRICT SAFETY INVARIANTS:
 * 1. Requires explicit environment opt-in: ALLOW_DESTRUCTIVE_DATABASE_TESTS=true
 * 2. Requires explicit command-line confirmation flag: --confirm-destructive-rollback
 * 3. Primary database 'rag_healthcare' and production targets are unconditionally REFUSED.
 * 4. Target database MUST end with '_test' or '_disposable'.
 * 5. Forward migration runner (run_migrations.js) NEVER automatically invokes rollbacks.
 * 6. Concurrency protected via MySQL advisory lock ('cdss_migration_runner_lock').
 * 7. Genuinely records / removes applied migration versions from schema_migrations history.
 *
 * Usage:
 *   node scripts/run_rollback.js --confirm-destructive-rollback            # Rolls back latest applied migration
 *   node scripts/run_rollback.js --step 2 --confirm-destructive-rollback   # Rolls back latest 2 applied migrations
 *   node scripts/run_rollback.js --all --confirm-destructive-rollback      # Rolls back all applied migrations
 */

const fs = require("fs");
const path = require("path");
const mysql = require(path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/node_modules/mysql2/promise"));

// Load environment configuration if available
const envPath = path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/.env");
if (fs.existsSync(envPath)) {
    require(path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/node_modules/dotenv")).config({
        path: envPath
    });
}

const { verifyDestructiveTestSafety } = require("../tests/safety/databaseSafetyGuard");
const { validateMigrationTarget } = require("./run_migrations");

async function main() {
    const hasConfirmation = process.argv.includes("--confirm-destructive-rollback");
    const isAll = process.argv.includes("--all");
    const stepIdx = process.argv.indexOf("--step");
    const stepCount = stepIdx !== -1 && process.argv[stepIdx + 1] ? parseInt(process.argv[stepIdx + 1], 10) : (isAll ? 999 : 1);

    console.log("==========================================================================");
    console.log("          CDSS CONTROLLED DESTRUCTIVE DATABASE ROLLBACK EXECUTOR           ");
    console.log("==========================================================================\n");

    if (!hasConfirmation) {
        throw new Error(
            "ROLLBACK SAFETY REFUSAL: Destructive rollback blocked! Execution requires explicit confirmation flag: " +
            "--confirm-destructive-rollback. Rollback scripts drop tables and columns; they must never run unintentionally."
        );
    }

    const targetDb = validateMigrationTarget(process.env.DB_NAME);
    console.log(`► Target Database Verified Safe for Rollback: '${targetDb}'`);

    const dbHost = process.env.DB_HOST || "localhost";
    const dbPort = Number(process.env.DB_PORT) || 3306;
    const dbUser = process.env.DB_USER || "root";
    const dbPassword = process.env.DB_PASSWORD || "";

    const migrationsDir = path.resolve(__dirname, "../migrations");

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

        console.log("► Acquiring migration advisory lock ('cdss_migration_runner_lock')...");
        const [lockRes] = await connection.query("SELECT GET_LOCK('cdss_migration_runner_lock', 10) AS lock_acquired");
        if (!lockRes[0] || lockRes[0].lock_acquired !== 1) {
            throw new Error(
                "ROLLBACK CONCURRENCY REFUSAL: Could not acquire advisory lock 'cdss_migration_runner_lock' within 10 seconds. " +
                "Another migration or rollback process is currently active."
            );
        }
        lockAcquired = true;
        console.log("  ✓ Advisory lock acquired successfully.\n");

        // Check if schema_migrations exists
        const [tableCheck] = await connection.query(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = 'schema_migrations'",
            [targetDb]
        );
        if (tableCheck.length === 0) {
            console.log(`Table 'schema_migrations' does not exist in '${targetDb}'. Nothing to roll back.`);
            return;
        }

        // Fetch applied migrations ordered descending
        const [appliedRows] = await connection.query(
            "SELECT version FROM schema_migrations ORDER BY version DESC"
        );

        if (appliedRows.length === 0) {
            console.log(`No applied migrations found in '${targetDb}'. Nothing to roll back.`);
            return;
        }

        const toRollback = appliedRows.slice(0, stepCount);
        console.log(`Found ${appliedRows.length} applied migrations. Selected ${toRollback.length} for rollback:`);
        for (const r of toRollback) {
            console.log(`  - ${r.version}`);
        }
        console.log("");

        for (const row of toRollback) {
            const versionFile = row.version;
            const prefix = versionFile.substring(0, 3); // e.g. "001"
            const rollbackFile = `${prefix}_rollback.sql`;
            const rollbackPath = path.join(migrationsDir, rollbackFile);

            if (!fs.existsSync(rollbackPath)) {
                throw new Error(
                    `ROLLBACK ERROR: Corresponding rollback file '${rollbackFile}' for migration '${versionFile}' was not found at '${rollbackPath}'!`
                );
            }

            console.log(`[ROLLING BACK] ${versionFile} using ${rollbackFile}...`);
            const sqlContent = fs.readFileSync(rollbackPath, "utf8");

            try {
                await connection.query(sqlContent);
                await connection.execute("DELETE FROM schema_migrations WHERE version = ?", [versionFile]);
                console.log(`   ✓ Rolled back and deregistered: ${versionFile}\n`);
            } catch (rbErr) {
                console.error(`   [FATAL ERROR in ${rollbackFile}]:`, rbErr.message);
                throw rbErr;
            }
        }

        console.log("==========================================================================");
        console.log(`ROLLBACK COMPLETE: ${toRollback.length} migrations rolled back successfully.`);
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
        console.error("\n[ROLLBACK EXECUTOR TERMINATED WITH ERROR]:", err.message);
        process.exit(1);
    });
}

module.exports = {
    main
};
