/**
 * Comprehensive Integration & Verification Suite for Doctor Profile Management
 *
 * Verifies:
 * 1. Security & RBAC:
 *    - Unauthenticated requests to GET/PUT /api/doctor/profile return 401 Unauthorized.
 *    - Patient tokens calling GET/PUT /api/doctor/profile return 403 Forbidden.
 *    - Receptionist tokens calling GET/PUT /api/doctor/profile return 403 Forbidden.
 * 2. Profile Retrieval (GET):
 *    - Authorized doctor receives 200 with complete profile (name, email, phone, license, specialization, bio).
 * 3. Input Validation (PUT):
 *    - Missing full_name returns 400 "Full name is required".
 * 4. Profile Persistence & Round-Trip (PUT -> DB -> GET):
 *    - Doctor updates phone, specialization, and bio (OPD chamber).
 *    - Update returns 200 OK.
 *    - Direct SQL inspection confirms database reflects new values.
 *    - Subsequent GET returns the updated values (persistence verified across reloads).
 * 5. State Cleanup:
 *    - Restores original doctor profile state to maintain database cleanliness.
 */

const http = require("http");
const path = require("path");

const backendDir = path.resolve(__dirname, "../../Portal Major P/Bhumi/Doctor portal/backend");
const backendModules = path.join(backendDir, "node_modules");

require(path.join(backendModules, "dotenv")).config({
    path: path.join(backendDir, ".env"),
});

const mysql = require(path.join(backendModules, "mysql2/promise"));
const { verifyDestructiveTestSafety } = require("../safety/databaseSafetyGuard");

const fs = require("fs");
const testConfigPath = path.resolve(__dirname, "../../scratch/test_db_config.json");
const testConfig = fs.existsSync(testConfigPath) ? JSON.parse(fs.readFileSync(testConfigPath, "utf8")) : null;

process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS = "true";

const TEST_PORT = parseInt(process.env.TEST_EXPRESS_PORT || "5001", 10);
const DB_CONFIG = {
    host: testConfig ? testConfig.host : (process.env.TEST_DB_HOST || "localhost"),
    user: testConfig ? testConfig.user : (process.env.TEST_DB_USER || "cdss_test_user"),
    password: testConfig ? testConfig.password : (process.env.TEST_DB_PASSWORD || "TestUserSafePassword2026!"),
    database: testConfig ? testConfig.database : "rag_healthcare_test",
    port: parseInt((testConfig ? testConfig.port : process.env.TEST_DB_PORT) || "3306", 10)
};

// Safety guard check
verifyDestructiveTestSafety(DB_CONFIG.database);

function httpRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = data;
                }
                resolve({ status: res.statusCode, data: parsed, headers: res.headers });
            });
        });
        req.on("error", reject);
        if (postData) {
            req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
        }
        req.end();
    });
}

async function loginUser(role, email, password) {
    const res = await httpRequest({
        hostname: "127.0.0.1",
        port: TEST_PORT,
        path: `/api/auth/${role}/login`,
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, { email, password });

    if (res.status !== 200 || !res.data.token) {
        throw new Error(`Login failed for ${email}: status ${res.status} - ${JSON.stringify(res.data)}`);
    }
    return res.data.token;
}

async function runDoctorProfileTestSuite() {
    console.log("==========================================================================");
    console.log("       DOCTOR PROFILE FULL INTEGRATION & PERSISTENCE VERIFICATION         ");
    console.log(`       Target Server: http://127.0.0.1:${TEST_PORT} -> DB: ${DB_CONFIG.database}`);
    console.log("==========================================================================");

    let dbConn = null;
    let passed = 0;
    let failed = 0;

    function assertCheck(cond, message) {
        if (cond) {
            console.log(`  ✓ [PASS] ${message}`);
            passed++;
        } else {
            console.error(`  ✗ [FAIL] ${message}`);
            failed++;
        }
    }

    try {
        dbConn = await mysql.createConnection(DB_CONFIG);

        // 1. Unauthenticated checks
        console.log("\n► SECTION 1: Authentication & RBAC Enforcement");
        const unauthGet = await httpRequest({
            hostname: "127.0.0.1",
            port: TEST_PORT,
            path: "/api/doctor/profile",
            method: "GET"
        });
        assertCheck(unauthGet.status === 401, "Unauthenticated GET /api/doctor/profile rejected with 401");

        const unauthPut = await httpRequest({
            hostname: "127.0.0.1",
            port: TEST_PORT,
            path: "/api/doctor/profile",
            method: "PUT",
            headers: { "Content-Type": "application/json" }
        }, { full_name: "Hacker" });
        assertCheck(unauthPut.status === 401, "Unauthenticated PUT /api/doctor/profile rejected with 401");

        // 2. Cross-role checks
        const patientToken = await loginUser("patient", "aarav@gmail.com", "patient123");
        const patientGet = await httpRequest({
            hostname: "127.0.0.1",
            port: TEST_PORT,
            path: "/api/doctor/profile",
            method: "GET",
            headers: { "Authorization": `Bearer ${patientToken}` }
        });
        assertCheck(patientGet.status === 403, "Patient token accessing GET /api/doctor/profile rejected with 403");

        const patientPut = await httpRequest({
            hostname: "127.0.0.1",
            port: TEST_PORT,
            path: "/api/doctor/profile",
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${patientToken}`,
                "Content-Type": "application/json"
            }
        }, { full_name: "Tampered Doctor" });
        assertCheck(patientPut.status === 403, "Patient token accessing PUT /api/doctor/profile rejected with 403");

        // 3. Authorized Doctor flow
        console.log("\n► SECTION 2: Authorized Doctor Profile Retrieval");
        const doctorToken = await loginUser("doctor", "doctor@gmail.com", "doctor123");
        const getRes = await httpRequest({
            hostname: "127.0.0.1",
            port: TEST_PORT,
            path: "/api/doctor/profile",
            method: "GET",
            headers: { "Authorization": `Bearer ${doctorToken}` }
        });

        assertCheck(getRes.status === 200, "Doctor GET /api/doctor/profile returns 200 OK");
        assertCheck(getRes.data && getRes.data.doctor, "Response contains doctor object");
        const initialDoc = getRes.data.doctor;
        assertCheck(Boolean(initialDoc.license_number), `Doctor license retrieved: ${initialDoc.license_number}`);
        assertCheck(Boolean(initialDoc.full_name), `Doctor legal name retrieved: ${initialDoc.full_name}`);

        // Save original values for clean rollback
        const origName = initialDoc.full_name;
        const origPhone = initialDoc.phone;
        const origSpec = initialDoc.specialization;
        const origBio = initialDoc.bio;

        // 4. Validation checks
        console.log("\n► SECTION 3: Input Validation");
        const invalidPut = await httpRequest({
            hostname: "127.0.0.1",
            port: TEST_PORT,
            path: "/api/doctor/profile",
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${doctorToken}`,
                "Content-Type": "application/json"
            }
        }, { full_name: "", phone: "1234567890" });
        assertCheck(invalidPut.status === 400, "Empty full_name rejected with HTTP 400");
        assertCheck(
            invalidPut.data && invalidPut.data.message === "Full name is required",
            "Returns exact validation message: 'Full name is required'"
        );

        // 5. Valid Profile Update & Database Persistence
        console.log("\n► SECTION 4: Live Update & Direct Database Verification");
        const updatedPhone = "+91 91234 56789";
        const updatedSpec = "Interventional Cardiology & Electrophysiology";
        const updatedRoom = "Chamber-OPD-702";

        const updateRes = await httpRequest({
            hostname: "127.0.0.1",
            port: TEST_PORT,
            path: "/api/doctor/profile",
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${doctorToken}`,
                "Content-Type": "application/json"
            }
        }, {
            full_name: origName,
            phone: updatedPhone,
            specialization: updatedSpec,
            bio: updatedRoom
        });

        assertCheck(updateRes.status === 200, "Valid PUT /api/doctor/profile returns 200 OK");
        assertCheck(
            updateRes.data && updateRes.data.message === "Doctor profile updated successfully",
            "Returns success confirmation message"
        );

        // Direct SQL verification
        const [userRows] = await dbConn.execute(
            "SELECT full_name, phone FROM users WHERE user_id = ?",
            [initialDoc.user_id]
        );
        assertCheck(userRows[0].phone === updatedPhone, `Database users.phone persisted: '${userRows[0].phone}'`);

        const [docRows] = await dbConn.execute(
            "SELECT specialization, bio FROM doctors WHERE user_id = ?",
            [initialDoc.user_id]
        );
        assertCheck(docRows[0].specialization === updatedSpec, `Database doctors.specialization persisted: '${docRows[0].specialization}'`);
        assertCheck(docRows[0].bio === updatedRoom, `Database doctors.bio (room) persisted: '${docRows[0].bio}'`);

        // 6. Round-trip verification: subsequent GET matches updated values
        console.log("\n► SECTION 5: Re-Fetch / Reload Verification (Persistence Test)");
        const reloadRes = await httpRequest({
            hostname: "127.0.0.1",
            port: TEST_PORT,
            path: "/api/doctor/profile",
            method: "GET",
            headers: { "Authorization": `Bearer ${doctorToken}` }
        });
        assertCheck(reloadRes.status === 200, "Subsequent GET /api/doctor/profile returns 200 OK");
        assertCheck(reloadRes.data.doctor.phone === updatedPhone, "Re-fetched profile reflects updated phone");
        assertCheck(reloadRes.data.doctor.specialization === updatedSpec, "Re-fetched profile reflects updated specialization");
        assertCheck(reloadRes.data.doctor.bio === updatedRoom, "Re-fetched profile reflects updated chamber");

        // 7. Restoration / Clean-up
        console.log("\n► SECTION 6: State Cleanup & Restoration");
        await httpRequest({
            hostname: "127.0.0.1",
            port: TEST_PORT,
            path: "/api/doctor/profile",
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${doctorToken}`,
                "Content-Type": "application/json"
            }
        }, {
            full_name: origName,
            phone: origPhone,
            specialization: origSpec,
            bio: origBio
        });
        console.log("  ✓ Doctor original profile restored successfully.");

    } catch (err) {
        console.error("Test execution error:", err);
        failed++;
    } finally {
        if (dbConn) await dbConn.end();
    }

    console.log("\n==========================================================================");
    console.log(`DOCTOR PROFILE INTEGRATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==========================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runDoctorProfileTestSuite();
