const path = require("path");
const fs = require("fs");
// Load backend's db pool directly
const db = require("../Portal Major P/Bhumi/Doctor portal/backend/src/config/db");

async function run() {
    try {
        console.log("Connected to MySQL via backend db pool. Reading migration 004...");
        const sql = fs.readFileSync(path.join(__dirname, "../migrations/004_create_account_activations.sql"), "utf8");
        await db.query(sql);
        console.log("Migration 004 applied successfully!");

        const [tables] = await db.query("SHOW TABLES LIKE 'account_activations'");
        console.log("Verified table:", tables);

        const [desc] = await db.query("DESCRIBE account_activations");
        console.log("Table structure:\n" + desc.map(c => `  ${c.Field}: ${c.Type} (${c.Null === 'YES' ? 'NULL' : 'NOT NULL'})`).join("\n"));
    } finally {
        process.exit(0);
    }
}

run().catch(err => {
    console.error("Migration error:", err);
    process.exit(1);
});
