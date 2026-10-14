const fs = require('fs');
const path = require('path');
const backendDir = path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend");
require(path.join(backendDir, "node_modules/dotenv")).config({ path: path.join(backendDir, ".env") });
const mysql = require(path.join(backendDir, "node_modules/mysql2"));

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "bhumi",
    database: process.env.DB_NAME || "rag_healthcare"
}).promise();

async function applyMigration() {
    try {
        const sqlPath = path.join(__dirname, '../migrations/003_create_prescription_ocr_jobs.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        // Clean comment lines
        const cleanSql = sqlContent
            .split('\n')
            .filter(line => !line.trim().startsWith('--'))
            .join('\n');

        const statements = cleanSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const stmt of statements) {
            console.log("Executing SQL statement...");
            await db.query(stmt);
        }

        console.log("Migration 003 applied successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Migration 003 failed:", err);
        process.exit(1);
    }
}

applyMigration();
