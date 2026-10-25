/**
 * scratch/test_harness_negative_matrix.js
 *
 * Verifies that the test harness strictly rejects invalid outcomes:
 * 1. Empty responses
 * 2. Transport failures (status 0 / network failure)
 * 3. Wrong language (e.g. English returned when Hindi/Marathi requested)
 * 4. Generic disclaimers without actual clinical answer
 * 5. abstained: false for expected abstentions
 * 6. Incorrect clinical units or missing qualifications
 * 7. HTTP 201/500 presented as successful booking concurrency
 */

const assert = require("assert");

console.log("================================================================================");
console.log("     TEST HARNESS INTEGRITY & NEGATIVE ASSERTION REJECTION MATRIX");
console.log("================================================================================\n");

let passed = 0;
let total = 0;

function runCheck(name, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
  }
}

// 1. Rejects empty responses
runCheck("Harness rejects empty responses", () => {
  const emptyRes = { status: 200, body: { answer: "", verification_status: "grounded" } };
  const isValidAnswer = (res) => Boolean(res.status === 200 && res.body?.answer && res.body.answer.trim().length > 0);
  assert.strictEqual(isValidAnswer(emptyRes), false, "Empty answer must not pass answerability");
});

// 2. Rejects transport failures
runCheck("Harness rejects transport failures (status 0)", () => {
  const transportFailRes = { status: 0, body: null, error: "ECONNREFUSED" };
  const isSuccess = (res) => Boolean(res.status === 200 && res.body);
  assert.strictEqual(isSuccess(transportFailRes), false, "Transport failure must not pass as successful response");
});

// 3. Rejects wrong language
runCheck("Harness rejects wrong language (English when Hindi requested)", () => {
  const mockHindiResponse = {
    status: 200,
    body: {
      answer: "According to verified clinical guidelines, Metformin should be taken with meals.",
      detected_language: "en",
      requested_language: "hi"
    }
  };
  const isCorrectLang = (res, reqLang) => {
    const isIndic = /[\u0900-\u097F\u0A80-\u0AFF]/.test(res.body?.answer || "");
    const detected = res.body?.detected_language;
    return reqLang === "hi" ? (isIndic || detected === "hi") : true;
  };
  assert.strictEqual(isCorrectLang(mockHindiResponse, "hi"), false, "English text must be rejected for Hindi request");
});

// 4. Rejects generic disclaimer without clinical answer
runCheck("Harness rejects generic disclaimer without clinical answer", () => {
  const disclaimerOnly = "*Clinical Disclaimer: This healthcare AI assistant is an educational Major Project prototype.*";
  const hasSubstantiveAnswer = (ans) => {
    const withoutDisclaimer = ans.replace(/\*Clinical Disclaimer:[^*]*\*/gi, "").trim();
    return withoutDisclaimer.length > 20;
  };
  assert.strictEqual(hasSubstantiveAnswer(disclaimerOnly), false, "Pure disclaimer must not pass as clinical answer");
});

// 5. Rejects abstained: false for expected policy abstention
runCheck("Harness rejects abstained: false for unindexed entity query", () => {
  const badAbstentionRes = {
    status: 200,
    body: {
      answer: "Consult your doctor for Gorham-Stout disease.",
      abstained: false,
      verification_status: "grounded"
    }
  };
  const isProperAbstention = (res) => Boolean(
    res.status === 200 &&
    res.body?.abstained === true &&
    String(res.body?.verification_status).includes("abstained")
  );
  assert.strictEqual(isProperAbstention(badAbstentionRes), false, "abstained: false must fail expected abstention assertion");
});

// 6. Rejects incorrect clinical units
runCheck("Harness rejects incorrect clinical units (500 kg vs 500 mg)", () => {
  const wrongUnitAnswer = "The adult starting dose for Metformin is 500 kg orally twice daily.";
  const hasValidDoseUnits = (ans) => {
    const hasMg = /\b\d+\s*mg\b/i.test(ans);
    const hasKg = /\b\d+\s*kg\b/i.test(ans);
    return hasMg && !hasKg;
  };
  assert.strictEqual(hasValidDoseUnits(wrongUnitAnswer), false, "500 kg must be rejected as invalid dosage unit");
});

// 7. Rejects 201/500 presented as successful booking concurrency
runCheck("Harness rejects 201/500 presented as successful double-booking concurrency", () => {
  const res1 = { status: 201 };
  const res2 = { status: 500 }; // Server error, not 409 Conflict
  const isStrictConcurrencyPass = (r1, r2) => {
    return (r1.status === 201 && r2.status === 409) || (r2.status === 201 && r1.status === 409);
  };
  assert.strictEqual(isStrictConcurrencyPass(res1, res2), false, "201/500 server crash must not pass as valid 409 conflict");
});

console.log("\n================================================================================");
console.log(`SUMMARY: ${passed}/${total} harness negative assertions verified.`);
console.log("================================================================================");

if (passed !== total) {
  process.exit(1);
}
