/**
 * test_prescription_ocr_pipeline.js
 * 
 * Comprehensive Verification Suite for Phase 4: Prescription Image Upload,
 * Local OCR Extraction, Candidate Parsing, Human Review & Explicit Confirmation.
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = "http://localhost:5000";

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = "") {
    if (condition) {
        console.log(`[PASS] ${testName} ${detail}`);
        passed++;
    } else {
        console.error(`[FAIL] ${testName} ${detail}`);
        failed++;
    }
}

async function runTests() {
    console.log("=================================================");
    console.log("  PHASE 4: PRESCRIPTION OCR & EXTRACTION SUITE   ");
    console.log("=================================================\n");

    try {
        // 1. Authenticate Doctor
        const docLoginRes = await fetch(`${BASE_URL}/api/auth/doctor/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "doctor@gmail.com", password: "doctor123" })
        });
        const docLoginData = await docLoginRes.json();
        const doctorToken = docLoginData.token;

        // 2. Authenticate Patient
        const patLoginRes = await fetch(`${BASE_URL}/api/auth/patient/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "aarav@gmail.com", password: "patient123" })
        });
        const patLoginData = await patLoginRes.json();
        const patientToken = patLoginData.token;

        // 3. Authenticate Receptionist
        const recLoginRes = await fetch(`${BASE_URL}/api/auth/receptionist/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "receptionist@gmail.com", password: "receptionist123" })
        });
        const recLoginData = await recLoginRes.json();
        const receptionistToken = recLoginData.token;

        // Test 1: Unauthenticated request blocked (401)
        const unauthRes = await fetch(`${BASE_URL}/api/doctor/prescriptions/upload-ocr`, {
            method: "POST"
        });
        assert(unauthRes.status === 401, "1. Unauthenticated request to OCR upload blocked (401)");

        // Test 2: Receptionist role blocked from OCR upload (403)
        const recRes = await fetch(`${BASE_URL}/api/doctor/prescriptions/upload-ocr`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${receptionistToken}` }
        });
        assert(recRes.status === 403, "2. Receptionist blocked from doctor OCR upload (403)");

        // Test 3: Patient role blocked from doctor OCR upload (403)
        const patRes = await fetch(`${BASE_URL}/api/doctor/prescriptions/upload-ocr`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${patientToken}` }
        });
        assert(patRes.status === 403, "3. Patient blocked from doctor OCR upload (403)");

        // Test 4: Doctor upload with corrupted/fake image (magic bytes mismatch)
        const fakeFilePath = path.join(__dirname, 'fake_image_test.png');
        fs.writeFileSync(fakeFilePath, 'THIS IS JUST PLAIN TEXT, NOT A PNG FILE');

        const fakeForm = new FormData();
        fakeForm.append('patient_id', '1');
        const fakeBlob = new Blob([fs.readFileSync(fakeFilePath)], { type: 'image/png' });
        fakeForm.append('prescription_image', fakeBlob, 'fake_image_test.png');

        const corruptRes = await fetch(`${BASE_URL}/api/doctor/prescriptions/upload-ocr`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${doctorToken}` },
            body: fakeForm
        });
        assert(corruptRes.status === 400, "4. Magic byte signature validation blocks spoofed/corrupted image (400)");
        try { fs.unlinkSync(fakeFilePath); } catch (_) {}

        // Test 5: Valid synthetic prescription upload & OCR extraction
        const validImagePath = path.join(__dirname, 'synthetic_prescription_test.png');
        if (!fs.existsSync(validImagePath)) {
            throw new Error("Synthetic test image not found at " + validImagePath);
        }

        const validForm = new FormData();
        validForm.append('patient_id', '1');
        const validBlob = new Blob([fs.readFileSync(validImagePath)], { type: 'image/png' });
        validForm.append('prescription_image', validBlob, 'synthetic_prescription_test.png');

        console.log("[INFO] Uploading and performing local OCR on synthetic prescription...");
        const uploadRes = await fetch(`${BASE_URL}/api/doctor/prescriptions/upload-ocr`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${doctorToken}` },
            body: validForm
        });
        const uploadData = await uploadRes.json();

        assert(uploadRes.status === 201 && uploadData.job_id, "5. Valid prescription image upload and OCR extraction succeeds", `-> Job ID: ${uploadData.job_id}`);
        const jobId = uploadData.job_id;

        // Test 6: Verify pending_review status and candidate fields
        assert(
            uploadData.review_status === "pending_review" && uploadData.requires_human_confirmation === true,
            "6. OCR Job correctly defaults to pending_review (requires human confirmation)"
        );

        // Test 7: Verify candidate extracted fields
        const candidates = uploadData.candidate_fields || [];
        const hasAmlodipine = candidates.some(c => c.medicine_name.toLowerCase().includes("amlodipine"));
        const hasAtorvastatin = candidates.some(c => c.medicine_name.toLowerCase().includes("atorvastatin"));
        assert(
            hasAmlodipine && hasAtorvastatin,
            "7. Regex rule engine successfully extracted candidate medications",
            `-> Found: ${candidates.map(c => c.medicine_name + ' ' + c.dosage).join(', ')}`
        );

        // Test 8: Non-negotiable safety invariant: No prescription auto-created
        const checkRxRes = await fetch(`${BASE_URL}/api/doctor/patients/1/prescriptions`, {
            headers: { "Authorization": `Bearer ${doctorToken}` }
        });
        const checkRxData = await checkRxRes.json();
        const rxList = checkRxData.prescriptions || [];
        const autoCreated = rxList.some(rx => rx.notes && rx.notes.includes("job #" + jobId));
        assert(!autoCreated, "8. SAFETY INVARIANT: No prescription is silently or automatically confirmed from OCR alone");

        // Test 9: Doctor retrieves pending OCR job
        const getJobRes = await fetch(`${BASE_URL}/api/doctor/prescriptions/ocr-jobs/${jobId}`, {
            headers: { "Authorization": `Bearer ${doctorToken}` }
        });
        const getJobData = await getJobRes.json();
        assert(getJobRes.status === 200 && getJobData.job?.job_id === jobId, "9. Doctor retrieves OCR job details for clinician review");

        // Test 10: Explicit Clinician Review & Confirmation
        console.log("[INFO] Clinician reviewing candidates and explicitly confirming prescription...");
        const confirmRes = await fetch(`${BASE_URL}/api/doctor/prescriptions/confirm-ocr`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${doctorToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                job_id: jobId,
                diagnosis: "Essential Hypertension & Dyslipidemia (Post-OCR Review)",
                notes: "Clinically reviewed and verified from prescription image scan",
                confirmed_medicines: [
                    {
                        medicine_name: "Amlodipine",
                        dosage: "5mg",
                        frequency: "OD",
                        duration: "30 days",
                        instructions: "Oral once daily with water"
                    },
                    {
                        medicine_name: "Atorvastatin",
                        dosage: "20mg",
                        frequency: "Daily",
                        duration: "30 days",
                        instructions: "Oral daily at bedtime"
                    }
                ]
            })
        });
        const confirmData = await confirmRes.json();
        assert(confirmRes.status === 201 && confirmData.prescription_id, "10. Clinician explicitly confirms OCR candidates -> Creates Authoritative Prescription", `-> Rx ID: ${confirmData.prescription_id}`);

        // Test 11: Re-confirmation blocked (job already confirmed)
        const reconfirmRes = await fetch(`${BASE_URL}/api/doctor/prescriptions/confirm-ocr`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${doctorToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                job_id: jobId,
                confirmed_medicines: [{ medicine_name: "Amlodipine" }]
            })
        });
        assert(reconfirmRes.status === 400, "11. Already confirmed OCR job cannot be re-confirmed (400)");

        // Test 12: Patient can now view the newly confirmed prescription in their portal
        const patRxRes = await fetch(`${BASE_URL}/api/patient/prescriptions`, {
            headers: { "Authorization": `Bearer ${patientToken}` }
        });
        const patRxData = await patRxRes.json();
        const latestRx = patRxData.prescriptions?.[0];
        assert(
            latestRx && latestRx.prescription_id === confirmData.prescription_id,
            "12. Patient Portal immediately reflects newly clinician-confirmed prescription",
            `-> Diagnosis: ${latestRx?.diagnosis}`
        );

    } catch (err) {
        console.error("Test execution failed:", err);
        failed++;
    }

    console.log("\n=================================================");
    console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log("=================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
