const mysql = require("mysql2");
const path = require("path");

require("dotenv").config();

if (process.env.NODE_ENV === "test") {
    try {
        const guardPath = path.resolve(__dirname, "../../../../../../tests/safety/databaseSafetyGuard");
        const { verifyTestDatabasePreflight } = require(guardPath);
        verifyTestDatabasePreflight(process.env.DB_NAME);
    } catch (err) {
        if (err.message && err.message.startsWith("SAFETY")) {
            throw err;
        }
    }
}

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

module.exports = db.promise();