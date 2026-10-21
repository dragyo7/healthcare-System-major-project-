const path = require("path");
const fs = require("fs");
const mysql = require(path.resolve(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/node_modules/mysql2/promise"));
require(path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/node_modules/dotenv")).config({
    path: path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/.env")
});

async function verify() {
  console.log("=== VERIFYING PRIMARY DATABASE UNTOUCHED & TEST DB ISOLATION ===");

  const testConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, "test_db_config.json"), "utf8"));

  // 1. Verify restricted user CANNOT read primary DB
  let accessDenied = false;
  try {
    const restrictedConn = await mysql.createConnection({
      host: testConfig.host,
      port: testConfig.port,
      user: testConfig.user,
      password: testConfig.password,
      database: "rag_healthcare"
    });
    await restrictedConn.execute("SELECT 1");
    await restrictedConn.end();
  } catch (err) {
    if (err.errno === 1044 || err.errno === 1142 || err.code === "ER_DBACCESS_DENIED_ERROR" || err.code === "ER_TABLEACCESS_DENIED_ERROR") {
      accessDenied = true;
    } else {
      console.log("Restricted user error:", err.message);
    }
  }

  console.log(`[VERIFICATION 1] Restricted test user access to 'rag_healthcare' denied: ${accessDenied ? "YES (CONFIRMED)" : "NO (FAIL)"}`);

  // 2. Query primary DB table status using admin credentials
  const rootConn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: "rag_healthcare"
  });

  const [tables] = await rootConn.execute("SHOW TABLES");
  console.log(`[VERIFICATION 2] Primary database 'rag_healthcare' contains ${tables.length} tables.`);

  const [users] = await rootConn.execute("SELECT COUNT(*) as count FROM users");
  const [patients] = await rootConn.execute("SELECT COUNT(*) as count FROM patients");
  const [rx] = await rootConn.execute("SELECT COUNT(*) as count FROM prescriptions");
  console.log(`[VERIFICATION 3] Primary database row counts: users=${users[0].count}, patients=${patients[0].count}, prescriptions=${rx[0].count}`);

  await rootConn.end();

  // 3. Query test DB
  const testConn = await mysql.createConnection(testConfig);
  const [testTables] = await testConn.execute("SHOW TABLES");
  const [testUsers] = await testConn.execute("SELECT COUNT(*) as count FROM users");
  const [testRx] = await testConn.execute("SELECT COUNT(*) as count FROM prescriptions");
  console.log(`[VERIFICATION 4] Test database 'rag_healthcare_test' contains ${testTables.length} tables, users=${testUsers[0].count}, prescriptions=${testRx[0].count}`);
  await testConn.end();

  console.log("=== VERIFICATION COMPLETE ===");
}

verify().catch(console.error);
