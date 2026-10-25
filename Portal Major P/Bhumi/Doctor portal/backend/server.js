require("dotenv").config();
const db = require("./src/config/db");
const app = require("./src/app");

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "127.0.0.1";

async function verifySchemaPreflight() {
    try {
        const [dbCheck] = await db.query("SELECT DATABASE() AS cur_db");
        const curDb = dbCheck[0]?.cur_db;
        if (!curDb) {
            throw new Error("Unable to determine active database connection.");
        }

        const missing = [];

        // Check required tables
        const requiredTables = [
            "users",
            "patients",
            "doctors",
            "prescriptions",
            "discharges",
            "prescription_ocr_jobs",
            "schema_migrations"
        ];
        const [tableRows] = await db.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = ?",
            [curDb]
        );
        const existingTables = new Set(tableRows.map((r) => r.table_name || r.TABLE_NAME));
        for (const t of requiredTables) {
            if (!existingTables.has(t)) {
                missing.push(`Table '${t}'`);
            }
        }

        // Check required columns
        if (existingTables.has("users")) {
            const [uCols] = await db.query(
                "SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = 'users' AND column_name = 'staff_status'",
                [curDb]
            );
            if (uCols.length === 0) {
                missing.push("Column 'users.staff_status'");
            }
        }

        if (existingTables.has("prescription_ocr_jobs")) {
            const [ocrCols] = await db.query(
                "SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = 'prescription_ocr_jobs' AND column_name = 'confirmed_by_doctor_id'",
                [curDb]
            );
            if (ocrCols.length === 0) {
                missing.push("Column 'prescription_ocr_jobs.confirmed_by_doctor_id'");
            }
        }

        if (missing.length > 0) {
            console.error("\n==========================================================================");
            console.error("  FATAL STARTUP REFUSAL: INCOMPATIBLE DATABASE SCHEMA");
            console.error("==========================================================================");
            console.error(`  Active Database: ${curDb}`);
            console.error(`  Missing required schema components:\n    - ${missing.join("\n    - ")}`);
            console.error("\n  ACTION REQUIRED:");
            console.error("  Run the migration orchestrator to apply all pending forward migrations:");
            console.error("    node scripts/run_migrations.js");
            console.error("==========================================================================\n");
            process.exit(1);
        }

        console.log(`✓ Schema preflight passed for database '${curDb}'.`);
    } catch (err) {
        console.error("FATAL: Failed database schema preflight check:", err.message);
        process.exit(1);
    }
}

async function startServer() {
    await verifySchemaPreflight();
    app.listen(PORT, HOST, () => {
        console.log(`Server running on http://${HOST}:${PORT}`);
    });
}

startServer();