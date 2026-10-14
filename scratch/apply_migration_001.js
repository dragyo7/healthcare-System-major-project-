const path = require("path");
const backendDir = path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend");
require(path.join(backendDir, "node_modules/dotenv")).config({ path: path.join(backendDir, ".env") });
const mysql = require(path.join(backendDir, "node_modules/mysql2"));
const bcrypt = require(path.join(backendDir, "node_modules/bcrypt"));

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "bhumi",
    database: process.env.DB_NAME || "rag_healthcare"
}).promise();

async function run() {
    try {
        console.log("Altering users role ENUM...");
        await db.query("ALTER TABLE users MODIFY COLUMN role ENUM('doctor', 'patient', 'receptionist') NOT NULL");
        
        const [existing] = await db.query("SELECT * FROM users WHERE email = 'receptionist@gmail.com'");
        if (existing.length === 0) {
            const hash = await bcrypt.hash("receptionist123", 10);
            await db.execute(
                "INSERT INTO users (full_name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)",
                ["Pooja Verma", "receptionist@gmail.com", hash, "receptionist", "9876500001"]
            );
            console.log("Default receptionist account seeded: receptionist@gmail.com / receptionist123");
        } else {
            console.log("Receptionist account already exists.");
        }
        
        const [users] = await db.query("SELECT user_id, full_name, email, role FROM users");
        console.log("Current users in rag_healthcare:", users);
        console.log("Migration 001 successful!");
    } catch (err) {
        console.error("Migration 001 error:", err);
    } finally {
        process.exit(0);
    }
}

run();
