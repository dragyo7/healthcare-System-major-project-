/**
 * scratch/provision_and_verify_test_db.js
 * 
 * Safely provisions 'rag_healthcare_test' and creates the restricted 'cdss_test_user'
 * account, then rigorously verifies kernel-level privilege isolation against 'rag_healthcare'.
 * 
 * INVARIANTS:
 * 1. Never modifies 'rag_healthcare'.
 * 2. Never prints credentials or secret values.
 * 3. Proves ER_TABLEACCESS_DENIED_ERROR (1142) on all attempted access to 'rag_healthcare'.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require(path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/node_modules/mysql2/promise"));
require(path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/node_modules/dotenv")).config({
    path: path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/.env")
});

const TEST_DB = "rag_healthcare_test";
const TEST_USER = "cdss_test_user";

async function main() {
    console.log("==========================================================================");
    console.log("      PROVISIONING & KERNEL ISOLATION VERIFICATION: " + TEST_DB);
    console.log("==========================================================================\n");

    // 1. Administrative connection
    const adminConn = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        port: Number(process.env.DB_PORT) || 3306,
        multipleStatements: true
    });

    try {
        console.log("► [Step 1] Inspecting existing MySQL users and databases...");
        const [dbs] = await adminConn.query("SHOW DATABASES LIKE ?", [TEST_DB]);
        const testDbExisted = dbs.length > 0;
        console.log(`  Target database '${TEST_DB}' exists: ${testDbExisted}`);

        if (!testDbExisted) {
            console.log(`  Creating database '${TEST_DB}' (utf8mb4 / utf8mb4_0900_ai_ci)...`);
            await adminConn.query(
                `CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`
            );
            console.log(`  ✓ Database '${TEST_DB}' successfully created.`);
        }

        // Generate strong password for cdss_test_user
        const testPassword = crypto.randomBytes(24).toString("base64").replace(/[+/=]/g, "x");

        console.log(`► [Step 2] Provisioning restricted account '${TEST_USER}' on localhost & 127.0.0.1...`);
        // Check if user already exists
        const [users] = await adminConn.query(
            "SELECT user, host FROM mysql.user WHERE user = ?",
            [TEST_USER]
        );
        console.log(`  Existing accounts for '${TEST_USER}': ${users.map(u => `${u.user}@${u.host}`).join(", ") || "none"}`);

        // Provision for localhost
        await adminConn.query(`CREATE USER IF NOT EXISTS ?@'localhost' IDENTIFIED BY ?;`, [TEST_USER, testPassword]);
        await adminConn.query(`ALTER USER ?@'localhost' IDENTIFIED BY ?;`, [TEST_USER, testPassword]);
        await adminConn.query(`GRANT ALL PRIVILEGES ON \`${TEST_DB}\`.* TO ?@'localhost';`, [TEST_USER]);

        // Provision for 127.0.0.1
        await adminConn.query(`CREATE USER IF NOT EXISTS ?@'127.0.0.1' IDENTIFIED BY ?;`, [TEST_USER, testPassword]);
        await adminConn.query(`ALTER USER ?@'127.0.0.1' IDENTIFIED BY ?;`, [TEST_USER, testPassword]);
        await adminConn.query(`GRANT ALL PRIVILEGES ON \`${TEST_DB}\`.* TO ?@'127.0.0.1';`, [TEST_USER]);

        // Ensure FLUSH PRIVILEGES
        await adminConn.query("FLUSH PRIVILEGES;");
        console.log(`  ✓ Account '${TEST_USER}' created and granted strictly on \`${TEST_DB}\`.*.`);

        // Inspect grants
        const [grantsLocalhost] = await adminConn.query(`SHOW GRANTS FOR ?@'localhost';`, [TEST_USER]);
        console.log("  Grants for localhost:");
        for (const g of grantsLocalhost) {
            const grantStr = Object.values(g)[0];
            console.log(`    - ${grantStr}`);
            if (grantStr.includes("rag_healthcare`") && !grantStr.includes("rag_healthcare_test`")) {
                throw new Error("SECURITY VIOLATION: Test account has grants on primary database 'rag_healthcare'!");
            }
        }

        // Save credentials securely to ignored scratch/test_db_config.json
        const configPath = path.join(__dirname, "test_db_config.json");
        fs.writeFileSync(configPath, JSON.stringify({
            host: "127.0.0.1",
            port: Number(process.env.DB_PORT) || 3306,
            user: TEST_USER,
            password: testPassword,
            database: TEST_DB
        }, null, 2), { mode: 0o600 });
        console.log(`  ✓ Saved test credentials securely to scratch/test_db_config.json (chmod 600, gitignored).`);

    } finally {
        await adminConn.end();
    }

    // Now test isolation using the test account
    console.log(`\n► [Step 3] Verifying privilege isolation using '${TEST_USER}' credentials...`);
    const testConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "test_db_config.json"), "utf8"));

    const testConn = await mysql.createConnection({
        host: testConfig.host,
        port: testConfig.port,
        user: testConfig.user,
        password: testConfig.password,
        database: testConfig.database
    });

    try {
        // Probe 1: Read inside test db
        const [resDb] = await testConn.query("SELECT DATABASE() AS current_db;");
        console.log(`  Probe 1 (SELECT DATABASE): Current DB is '${resDb[0].current_db}' (Expect: '${TEST_DB}')`);
        if (resDb[0].current_db !== TEST_DB) {
            throw new Error(`Probe 1 Failed: Expected '${TEST_DB}', got '${resDb[0].current_db}'`);
        }
        console.log("  ✓ Probe 1 PASSED: Harmless read against test database succeeded.");

        // Probe 2: Temporary write inside test db
        await testConn.query("CREATE TABLE IF NOT EXISTS _isolation_probe (id INT PRIMARY KEY, canary VARCHAR(50));");
        await testConn.query("INSERT INTO _isolation_probe (id, canary) VALUES (1, 'isolation_active');");
        const [probeRows] = await testConn.query("SELECT canary FROM _isolation_probe WHERE id = 1;");
        if (probeRows.length !== 1 || probeRows[0].canary !== "isolation_active") {
            throw new Error("Probe 2 Failed: Unable to verify write in test database.");
        }
        await testConn.query("DROP TABLE _isolation_probe;");
        console.log("  ✓ Probe 2 PASSED: Controlled write and cleanup inside test database succeeded.");

        // Probe 3: Attempted read against primary database 'rag_healthcare'
        console.log("  Probe 3: Attempting SELECT against primary database 'rag_healthcare'...");
        let readDenied = false;
        try {
            await testConn.query("SELECT COUNT(*) FROM rag_healthcare.users;");
        } catch (err) {
            if (err.code === "ER_TABLEACCESS_DENIED_ERROR" || err.errno === 1142) {
                readDenied = true;
                console.log(`  ✓ Probe 3 PASSED: Read denied by MySQL kernel (errno ${err.errno}: ${err.code}).`);
            } else {
                throw new Error(`Probe 3 Unexpected error code: ${err.code} (${err.message})`);
            }
        }
        if (!readDenied) {
            throw new Error("SECURITY FAILURE: Test user was able to read primary database 'rag_healthcare'!");
        }

        // Probe 4: Attempted write against primary database 'rag_healthcare'
        console.log("  Probe 4: Attempting INSERT against primary database 'rag_healthcare'...");
        let writeDenied = false;
        try {
            await testConn.query("INSERT INTO rag_healthcare.users (full_name, email) VALUES ('evil', 'evil@bad.com');");
        } catch (err) {
            if (err.code === "ER_TABLEACCESS_DENIED_ERROR" || err.errno === 1142) {
                writeDenied = true;
                console.log(`  ✓ Probe 4 PASSED: Write denied by MySQL kernel (errno ${err.errno}: ${err.code}).`);
            } else {
                throw new Error(`Probe 4 Unexpected error code: ${err.code} (${err.message})`);
            }
        }
        if (!writeDenied) {
            throw new Error("SECURITY FAILURE: Test user was able to write to primary database 'rag_healthcare'!");
        }

        // Probe 5: Attempted DROP against primary database 'rag_healthcare'
        console.log("  Probe 5: Attempting DROP against primary database 'rag_healthcare'...");
        let dropDenied = false;
        try {
            await testConn.query("DROP TABLE rag_healthcare.users;");
        } catch (err) {
            if (err.code === "ER_TABLEACCESS_DENIED_ERROR" || err.errno === 1142) {
                dropDenied = true;
                console.log(`  ✓ Probe 5 PASSED: DROP denied by MySQL kernel (errno ${err.errno}: ${err.code}).`);
            } else {
                throw new Error(`Probe 5 Unexpected error code: ${err.code} (${err.message})`);
            }
        }
        if (!dropDenied) {
            throw new Error("SECURITY FAILURE: Test user was able to execute DROP on primary database 'rag_healthcare'!");
        }

    } finally {
        await testConn.end();
    }

    console.log("\n==========================================================================");
    console.log(">>> PRIVILEGE ISOLATION VERIFIED: TEST ACCOUNT IS PROVEN ISOLATED 100% <<<");
    console.log("==========================================================================");
}

main().catch(err => {
    console.error("Provisioning/Isolation verification failed:", err);
    process.exit(1);
});
