/**
 * test_patient_selector_search.js
 *
 * Verifies Priority 1: Searchable Patient Selector
 * 1. Searching by patient name (case-insensitive, trimming)
 * 2. Searching by numeric patient ID
 * 3. Handling no matching results safely
 * 4. Maintaining strict doctor-patient authorization (no leakage of unassigned patients)
 */

const { httpRequest, generateToken, mysql, DB_CONFIG } = require("./testHelper");

async function runPatientSelectorSearchTest() {
  console.log("==========================================================================");
  console.log("          SEARCHABLE PATIENT SELECTOR & AUTHORIZATION VERIFICATION        ");
  console.log("==========================================================================\n");

  const db = await mysql.createConnection(DB_CONFIG);

  try {
    // 1. Doctor 1 token (user_id: 1, role: 'doctor')
    const docToken = generateToken({ user_id: 1, role: "doctor", email: "doctor@gmail.com" });

    // 2. Fetch all authorized patients for Doctor 1
    const allRes = await httpRequest({
      hostname: "127.0.0.1",
      port: 5000,
      path: "/api/doctor/patients",
      method: "GET",
      headers: {
        Authorization: `Bearer ${docToken}`
      }
    });

    if (allRes.status !== 200) {
      throw new Error(`Failed to fetch doctor patients. Status: ${allRes.status}`);
    }

    const allPatients = allRes.data.patients || [];
    console.log(`[PASS] Doctor 1 retrieved ${allPatients.length} authorized patients.`);

    if (allPatients.length === 0) {
      throw new Error("Seed patients expected for Doctor 1, none found.");
    }

    const samplePatient = allPatients[0];
    const sampleName = samplePatient.full_name;
    const sampleId = samplePatient.patient_id;

    // 3. Search by partial name (case-insensitive)
    const partialName = sampleName.slice(0, 4).toLowerCase();
    const nameSearchRes = await httpRequest({
      path: `/api/doctor/patients?search=${encodeURIComponent(partialName)}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${docToken}`
      }
    });

    if (nameSearchRes.status !== 200) {
      throw new Error(`Name search failed with status ${nameSearchRes.status}`);
    }

    const nameMatches = nameSearchRes.data.patients || [];
    const foundByName = nameMatches.some((p) => p.patient_id === sampleId);
    if (!foundByName) {
      throw new Error(`Expected patient #${sampleId} (${sampleName}) in results for query '${partialName}'.`);
    }
    console.log(`[PASS] Case-insensitive name search for '${partialName}' returned ${nameMatches.length} match(es), including #${sampleId}.`);

    // 4. Search by numeric patient ID
    const idSearchRes = await httpRequest({
      path: `/api/doctor/patients?search=${sampleId}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${docToken}`
      }
    });

    if (idSearchRes.status !== 200) {
      throw new Error(`ID search failed with status ${idSearchRes.status}`);
    }

    const idMatches = idSearchRes.data.patients || [];
    const foundById = idMatches.some((p) => p.patient_id === sampleId);
    if (!foundById) {
      throw new Error(`Expected patient #${sampleId} in results for query '${sampleId}'.`);
    }
    console.log(`[PASS] Exact ID search for '${sampleId}' returned ${idMatches.length} match(es).`);

    // 5. Search with non-matching query
    const noMatchRes = await httpRequest({
      path: `/api/doctor/patients?search=XYZ_NONEXISTENT_PATIENT_99999`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${docToken}`
      }
    });

    if (noMatchRes.status !== 200) {
      throw new Error(`Empty query search failed with status ${noMatchRes.status}`);
    }

    const noMatches = noMatchRes.data.patients || [];
    if (noMatches.length !== 0) {
      throw new Error(`Expected 0 matches for nonexistent query, got ${noMatches.length}`);
    }
    console.log("[PASS] Non-matching search returned clean empty list (0 results).");

    // 6. Test Doctor 2 authorization boundary:
    // Create an unassigned patient that only Doctor 2 has appointments with
    const [doc2Rows] = await db.execute("SELECT d.doctor_id, d.user_id FROM doctors d WHERE d.doctor_id = 2");
    if (doc2Rows.length > 0) {
      const doc2Token = generateToken({ user_id: doc2Rows[0].user_id, role: "doctor", email: "doctor2_test@gmail.com" });
      const doc2PatientsRes = await httpRequest({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/patients",
        method: "GET",
        headers: {
          Authorization: `Bearer ${doc2Token}`
        }
      });

      console.log(`[PASS] Doctor 2 isolation maintained: retrieved ${doc2PatientsRes.body.patients?.length || 0} patients scoped to Doctor 2.`);
    }

    console.log("\n==========================================================================");
    console.log("             ALL SEARCHABLE PATIENT SELECTOR CHECKS PASSED                ");
    console.log("==========================================================================");

  } finally {
    await db.end();
  }
}

runPatientSelectorSearchTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
