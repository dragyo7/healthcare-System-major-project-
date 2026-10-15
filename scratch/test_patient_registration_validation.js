const http = require("http");

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const req = http.request({
            hostname: "127.0.0.1",
            port: 5000,
            path,
            method,
            headers: {
                "Content-Type": "application/json",
                ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
                ...headers
            }
        }, (res) => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => {
                let parsed = null;
                try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
                resolve({ status: res.statusCode, body: parsed });
            });
        });
        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function run() {
    console.log("=== TARGETED TEST: PATIENT REGISTRATION VALIDATION & TRANSACTION INTEGRITY ===");

    // 1. Login as receptionist
    const loginRes = await request("POST", "/api/auth/receptionist/login", {
        email: "receptionist@gmail.com",
        password: "receptionist123"
    });
    if (loginRes.status !== 200 || !loginRes.body.token) {
        throw new Error(`Receptionist login failed: status ${loginRes.status}`);
    }
    const token = loginRes.body.token;
    const authHeaders = { "Authorization": `Bearer ${token}` };
    console.log("[PASS] 1. Receptionist logged in successfully.");

    // 2. Test impossible year in date_of_birth (e.g. year 80720)
    const futureYearRes = await request("POST", "/api/receptionist/patients", {
        full_name: "Test Impossible Year",
        email: `test_year_${Date.now()}@example.com`,
        phone: "+91 99999 11111",
        date_of_birth: "80720-09-19"
    }, authHeaders);

    if (futureYearRes.status === 400 && futureYearRes.body.field === "date_of_birth") {
        console.log(`[PASS] 2. Year 80720 correctly rejected with HTTP 400: ${futureYearRes.body.message}`);
    } else {
        throw new Error(`Expected HTTP 400 for year 80720, got ${futureYearRes.status}: ${JSON.stringify(futureYearRes.body)}`);
    }

    // 3. Test future date in current year (e.g. tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const futureDateRes = await request("POST", "/api/receptionist/patients", {
        full_name: "Test Future Date",
        email: `test_future_${Date.now()}@example.com`,
        phone: "+91 99999 22222",
        date_of_birth: tomorrowStr
    }, authHeaders);

    if (futureDateRes.status === 400 && futureDateRes.body.field === "date_of_birth") {
        console.log(`[PASS] 3. Future date (${tomorrowStr}) correctly rejected with HTTP 400: ${futureDateRes.body.message}`);
    } else {
        throw new Error(`Expected HTTP 400 for future date, got ${futureDateRes.status}: ${JSON.stringify(futureDateRes.body)}`);
    }

    // 4. Test invalid calendar date (e.g. Feb 31)
    const invalidCalendarRes = await request("POST", "/api/receptionist/patients", {
        full_name: "Test Invalid Date",
        email: `test_feb31_${Date.now()}@example.com`,
        phone: "+91 99999 33333",
        date_of_birth: "2000-02-31"
    }, authHeaders);

    if (invalidCalendarRes.status === 400 && invalidCalendarRes.body.field === "date_of_birth") {
        console.log(`[PASS] 4. Invalid calendar date (Feb 31) correctly rejected with HTTP 400: ${invalidCalendarRes.body.message}`);
    } else {
        throw new Error(`Expected HTTP 400 for Feb 31, got ${invalidCalendarRes.status}: ${JSON.stringify(invalidCalendarRes.body)}`);
    }

    // 5. Test valid registration succeeds and activation link is provided
    const validEmail = `maya_verma_${Date.now()}@example.com`;
    const validRes = await request("POST", "/api/receptionist/patients", {
        full_name: "Maya Verma",
        email: validEmail,
        phone: "+91 98765 43210",
        date_of_birth: "1992-05-14",
        gender: "Female",
        blood_group: "B+",
        address: "74 Park Avenue, Pune",
        emergency_contact: "Rajesh Verma (Father) +91 98765 00000",
        allergies: "Penicillin"
    }, authHeaders);

    if (validRes.status === 201 && validRes.body.patient_id) {
        console.log(`[PASS] 5. Valid patient registration succeeded: Patient ID ${validRes.body.patient_id}, Status: ${validRes.body.patient.account_status}`);
    } else {
        throw new Error(`Expected HTTP 201 for valid registration, got ${validRes.status}: ${JSON.stringify(validRes.body)}`);
    }

    // 6. Test duplicate email rejected with HTTP 409
    const dupRes = await request("POST", "/api/receptionist/patients", {
        full_name: "Maya Verma Duplicate",
        email: validEmail,
        phone: "+91 98765 43211",
        date_of_birth: "1992-05-14"
    }, authHeaders);

    if (dupRes.status === 409) {
        console.log(`[PASS] 6. Duplicate email correctly rejected with HTTP 409: ${dupRes.body.message}`);
    } else {
        throw new Error(`Expected HTTP 409 for duplicate email, got ${dupRes.status}: ${JSON.stringify(dupRes.body)}`);
    }

    // 7. Verify activation workflow works with the generated activation token
    const tokenStr = validRes.body.activation_token;
    if (!tokenStr) {
        throw new Error("Missing activation_token in registration response");
    }

    const activateRes = await request("POST", "/api/auth/patient/activate", {
        token: tokenStr,
        password: "MayaStrongPassword123!"
    });
    if (activateRes.status === 200) {
        console.log(`[PASS] 7. Account activated successfully with single-use token.`);
    } else {
        throw new Error(`Expected HTTP 200 for activation, got ${activateRes.status}: ${JSON.stringify(activateRes.body)}`);
    }

    // 8. Verify reusing the activation token fails with HTTP 400
    const reuseRes = await request("POST", "/api/auth/patient/activate", {
        token: tokenStr,
        password: "AnotherPassword123!"
    });
    if (reuseRes.status === 400) {
        console.log(`[PASS] 8. Reusing activation token rejected with HTTP 400: ${reuseRes.body.message}`);
    } else {
        throw new Error(`Expected HTTP 400 for token reuse, got ${reuseRes.status}: ${JSON.stringify(reuseRes.body)}`);
    }

    // 9. Verify patient can log in with new password
    const patLogin = await request("POST", "/api/auth/patient/login", {
        email: validEmail,
        password: "MayaStrongPassword123!"
    });
    if (patLogin.status === 200 && patLogin.body.token) {
        console.log(`[PASS] 9. Newly activated patient can log in successfully. Token: ${patLogin.body.token.slice(0, 15)}...`);
    } else {
        throw new Error(`Expected HTTP 200 for patient login, got ${patLogin.status}: ${JSON.stringify(patLogin.body)}`);
    }

    console.log("=== ALL 9 TARGETED REGISTRATION & ACTIVATION TESTS PASSED ===");
}

run().catch(err => {
    console.error("[FAIL]", err.message);
    process.exit(1);
});
