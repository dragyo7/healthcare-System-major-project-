const http = require("http");

async function request(options, postData) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = "";
            res.on("data", (chunk) => body += chunk);
            res.on("end", () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(body);
                } catch (e) {
                    parsed = body;
                }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });
        req.on("error", reject);
        if (postData) {
            req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
        }
        req.end();
    });
}

async function runPhase3Tests() {
    console.log("=================================================================");
    console.log("  PHASE 3: EXPRESS -> FASTAPI CDS BRIDGE VERIFICATION SUITE");
    console.log("=================================================================\n");

    // 1. Doctor Login
    const loginRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/auth/doctor/login",
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, {
        email: "doctor@gmail.com",
        password: "doctor123"
    });

    if (loginRes.status !== 200 || !loginRes.body.token) {
        console.error("FAIL: Doctor login failed", loginRes);
        process.exit(1);
    }
    const token = loginRes.body.token;
    console.log("PASS: Doctor logged in successfully. Token acquired.\n");

    const authHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };

    // 2. Test Malformed Request (Missing clinical_query)
    console.log("--- TEST 1: Missing clinical_query (Expected: 400 Bad Request) ---");
    const badReqRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/cds",
        method: "POST",
        headers: authHeaders
    }, {
        patient_id: 1,
        clinical_query: ""
    });
    console.log(`Status: ${badReqRes.status}, Message: ${JSON.stringify(badReqRes.body)}`);
    if (badReqRes.status === 400) {
        console.log("PASS: Rejected malformed request with 400 Bad Request.\n");
    } else {
        console.error(`FAIL: Expected 400, got ${badReqRes.status}\n`);
    }

    // 3. Test Missing patient_id
    console.log("--- TEST 2: Missing patient_id (Expected: 400 Bad Request) ---");
    const missingPatientRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/cds",
        method: "POST",
        headers: authHeaders
    }, {
        clinical_query: "What is Metformin?"
    });
    console.log(`Status: ${missingPatientRes.status}, Message: ${JSON.stringify(missingPatientRes.body)}`);
    if (missingPatientRes.status === 400) {
        console.log("PASS: Rejected missing patient_id with 400 Bad Request.\n");
    } else {
        console.error(`FAIL: Expected 400, got ${missingPatientRes.status}\n`);
    }

    // 4. Test Unauthorized Patient (Patient 99999 or unlinked patient)
    console.log("--- TEST 3: Unauthorized / Unlinked Patient (Expected: 403 Forbidden) ---");
    const unauthPatientRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/cds",
        method: "POST",
        headers: authHeaders
    }, {
        patient_id: 99999,
        clinical_query: "What is Metformin?"
    });
    console.log(`Status: ${unauthPatientRes.status}, Message: ${JSON.stringify(unauthPatientRes.body)}`);
    if (unauthPatientRes.status === 403) {
        console.log("PASS: Phase 1 BOLA authorization blocked unlinked patient with 403 Forbidden.\n");
    } else {
        console.error(`FAIL: Expected 403, got ${unauthPatientRes.status}\n`);
    }

    // 5. Test Valid Authorized CDS Evaluation (Patient 1)
    console.log("--- TEST 4: Valid Clinical Query for Authorized Patient 1 ---");
    console.log("Query: 'What are the recommended dosing adjustments for Metformin in patients with renal impairment?'");
    const validRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/cds",
        method: "POST",
        headers: authHeaders
    }, {
        patient_id: 1,
        clinical_query: "What are the recommended dosing adjustments for Metformin in patients with renal impairment?"
    });
    console.log(`Status: ${validRes.status}`);
    console.log(`Verification Status: ${validRes.body.verification_status}`);
    console.log(`Is Grounded: ${validRes.body.is_grounded}`);
    console.log(`Citations Count: ${validRes.body.citations?.length || 0}`);
    console.log(`Answer Snippet: ${validRes.body.answer?.substring(0, 150)}...`);
    if (validRes.status === 200 && validRes.body.verification_status && validRes.body.citations) {
        console.log("PASS: Express successfully sanitized patient context and received verified RAG response.\n");
    } else {
        console.error("FAIL: Valid CDS evaluation failed\n", validRes);
    }

    // 6. Test Emergency Triage Interception via Express Bridge
    console.log("--- TEST 5: Emergency Triage Interception via Express Bridge ---");
    const emergencyRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/cds",
        method: "POST",
        headers: authHeaders
    }, {
        patient_id: 1,
        clinical_query: "I have crushing chest pain radiating to my left arm and jaw and I am sweating heavily."
    });
    console.log(`Status: ${emergencyRes.status}`);
    console.log(`Is Emergency: ${emergencyRes.body.is_emergency}`);
    console.log(`Verification Status: ${emergencyRes.body.verification_status}`);
    if (emergencyRes.status === 200 && emergencyRes.body.is_emergency === true && emergencyRes.body.verification_status === "emergency_diverted") {
        console.log("PASS: Emergency query diverted safely through Express bridge.\n");
    } else {
        console.error("FAIL: Emergency diversion failed\n", emergencyRes);
    }

    // 7. Test Unknown Drug Abstention via Express Bridge
    console.log("--- TEST 6: Unknown Drug Abstention / Fail-Closed via Express Bridge ---");
    const unknownRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/cds",
        method: "POST",
        headers: authHeaders
    }, {
        patient_id: 1,
        clinical_query: "What is the standard adult dose of Flurbyglop 900mg?"
    });
    console.log(`Status: ${unknownRes.status}`);
    console.log(`Abstained: ${unknownRes.body.abstained}`);
    console.log(`Verification Status: ${unknownRes.body.verification_status}`);
    if (unknownRes.status === 200 && unknownRes.body.abstained === true && unknownRes.body.is_grounded === false) {
        console.log("PASS: Unknown entity safely abstained through Express bridge.\n");
    } else {
        console.error("FAIL: Unknown drug abstention failed\n", unknownRes);
    }

    // 8. Test Deterministic Drug Interaction via Express Bridge
    console.log("--- TEST 7: Deterministic Drug Interaction via Express Bridge ---");
    const interactionRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/cds",
        method: "POST",
        headers: authHeaders
    }, {
        patient_id: 1,
        clinical_query: "Check interaction between Aspirin and Warfarin for this patient.",
        candidate_medications: ["Aspirin", "Warfarin"]
    });
    console.log(`Status: ${interactionRes.status}`);
    console.log(`Interactions Count: ${interactionRes.body.drug_interactions?.length || 0}`);
    if (interactionRes.body.drug_interactions && interactionRes.body.drug_interactions.length > 0) {
        console.log("Detected Interaction:", interactionRes.body.drug_interactions[0]);
        console.log("PASS: Deterministic DrugBank interaction alert returned through Express bridge.\n");
    } else {
        console.error("FAIL: Drug interaction check failed\n", interactionRes);
    }

    console.log("=================================================================");
    console.log("  ALL PHASE 3 EXPRESS BRIDGE TESTS COMPLETE");
    console.log("=================================================================");
}

runPhase3Tests().catch(console.error);
