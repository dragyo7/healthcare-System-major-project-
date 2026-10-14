const path = require("path");
const backendDir = path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend");
require(path.join(backendDir, "node_modules/dotenv")).config({ path: path.join(backendDir, ".env") });
const mysql = require(path.join(backendDir, "node_modules/mysql2"));
const fs = require("fs");

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "bhumi",
    database: process.env.DB_NAME || "rag_healthcare"
}).promise();

async function run() {
    try {
        console.log("Applying Migration 002: create discharges table...");
        const rawSql = fs.readFileSync(path.join(__dirname, "../migrations/002_create_discharges_table.sql"), "utf-8");
        // Strip comment lines
        const cleanSql = rawSql
            .split("\n")
            .filter(l => !l.trim().startsWith("--"))
            .join("\n");

        const statements = cleanSql
            .split(";")
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const stmt of statements) {
            console.log("Executing SQL:\n", stmt.substring(0, 60), "...");
            await db.query(stmt);
        }

        const [tables] = await db.query("SHOW TABLES LIKE 'discharges'");
        console.log("Discharges table verified:", tables);

        const [rows] = await db.query("SELECT * FROM discharges");
        console.log("Seeded discharge rows count:", rows.length);
        console.log("Migration 002 applied successfully!");
    } catch (err) {
        console.error("Migration 002 failed:", err);
    } finally {
        process.exit(0);
    }
}

run();
