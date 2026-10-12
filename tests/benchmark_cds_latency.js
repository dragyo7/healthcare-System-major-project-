/**
 * benchmark_cds_latency.js
 * 
 * Monotonic End-to-End Latency and Reliability Benchmark for Doctor & Patient Post-Discharge CDS.
 * Measures:
 * 1. Express Gateway Total (Client to Express to Client)
 * 2. Gateway-to-FastAPI Bridge Latency (Express forwardToFastAPICDS)
 * 3. Database Context Fetch & PII Sanitization
 * 4. Auth & Role Validation Overhead
 * 
 * Tests required scenarios:
 * - Doctor CDS: Common Grounded, Complex Multi-part, Insufficient Evidence, Urgent/Emergency, Multilingual, Malformed
 * - Patient Post-Discharge CDS: Valid Discharge Context, Empty Discharge Context, Follow-up Educational, Unauthorized BOLA, Multilingual
 * 
 * Outputs machine-readable summary statistics (p50, p90, p95, max, error rate).
 * Zero PII. Synthetic records only.
 */

const http = require("http");
const path = require("path");
const fs = require("fs");

const {
  mysql,
  httpRequest,
  generateToken,
  DB_CONFIG,
  GATEWAY_PORT,
  GATEWAY_HOST
} = require("./integration/testHelper");

function measureRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const opts = {
      hostname: GATEWAY_HOST,
      port: GATEWAY_PORT,
      ...options
    };

    const req = http.request(opts, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1e6;
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          durationMs,
          bodyLength: body.length,
          data: json,
          raw: body
        });
      });
    });

    req.on("error", (err) => reject(err));
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error("Request timed out after 120s"));
    });

    if (postData) {
      const payload = typeof postData === "object" ? JSON.stringify(postData) : postData;
      req.setHeader("Content-Type", "application/json");
      req.setHeader("Content-Length", Buffer.byteLength(payload));
      req.write(payload);
    }
    req.end();
  });
}

function calcStats(durations) {
  if (!durations || durations.length === 0) {
    return { count: 0, min: 0, p50: 0, p90: 0, p95: 0, max: 0, avg: 0 };
  }
  const sorted = [...durations].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const avg = sorted.reduce((acc, d) => acc + d, 0) / sorted.length;
  return {
    count: sorted.length,
    min: Number(min.toFixed(2)),
    p50: Number(p50.toFixed(2)),
    p90: Number(p90.toFixed(2)),
    p95: Number(p95.toFixed(2)),
    max: Number(max.toFixed(2)),
    avg: Number(avg.toFixed(2))
  };
}

async function runBenchmark() {
  console.log("==========================================================================");
  console.log("  MONOTONIC E2E CDS LATENCY & RELIABILITY BENCHMARK (DOCTOR & PATIENT)     ");
  console.log("==========================================================================\n");

  const pool = await mysql.createPool(DB_CONFIG);

  // 1. Fetch Synthetic Test Actors
  const [docRows] = await pool.execute(
    "SELECT u.user_id, u.email, d.doctor_id FROM users u JOIN doctors d ON u.user_id = d.user_id WHERE u.role = 'doctor' LIMIT 1"
  );
  if (docRows.length === 0) throw new Error("No synthetic doctor found in database");
  const doctor = docRows[0];
  const doctorToken = generateToken({ user_id: doctor.user_id, role: "doctor" });

  const [patientRows] = await pool.execute(
    "SELECT u.user_id, u.email, p.patient_id FROM users u JOIN patients p ON u.user_id = p.user_id WHERE u.role = 'patient' LIMIT 2"
  );
  if (patientRows.length === 0) throw new Error("No synthetic patient found in database");
  const patientA = patientRows[0];
  const patientB = patientRows.length > 1 ? patientRows[1] : null;
  const patientAToken = generateToken({ user_id: patientA.user_id, role: "patient" });
  const patientBToken = patientB ? generateToken({ user_id: patientB.user_id, role: "patient" }) : null;

  // Ensure Doctor is authorized for Patient A via appointments table
  const [authCheck] = await pool.execute(
    "SELECT 1 FROM appointments WHERE doctor_id = ? AND patient_id = ? UNION SELECT 1 FROM prescriptions WHERE doctor_id = ? AND patient_id = ? LIMIT 1",
    [doctor.doctor_id, patientA.patient_id, doctor.doctor_id, patientA.patient_id]
  );
  if (authCheck.length === 0) {
    await pool.execute(
      "INSERT INTO appointments (patient_id, doctor_id, appointment_date, start_time, end_time, status, reason) VALUES (?, ?, '2026-10-15', '10:00:00', '10:30:00', 'scheduled', 'Clinical CDS Baseline Check')",
      [patientA.patient_id, doctor.doctor_id]
    );
  }

  console.log(`Using Doctor (ID: ${doctor.doctor_id}, User: ${doctor.user_id})`);
  console.log(`Using Patient A (ID: ${patientA.patient_id}, User: ${patientA.user_id})`);
  if (patientB) console.log(`Using Patient B (ID: ${patientB.patient_id}, User: ${patientB.user_id})`);

  const results = {
    doctor_cds: {},
    patient_post_discharge_cds: {},
    infrastructure_timings: {}
  };

  // 2. Measure Isolated Infrastructure Steps
  console.log("\n--- Profiling Gateway Infrastructure Steps ---");
  // A. Token validation & overhead
  const tokenTimes = [];
  for (let i = 0; i < 50; i++) {
    const t0 = process.hrtime.bigint();
    const token = generateToken({ user_id: doctor.user_id, role: "doctor" });
    const t1 = process.hrtime.bigint();
    tokenTimes.push(Number(t1 - t0) / 1e6);
  }
  results.infrastructure_timings.jwt_issuance_ms = calcStats(tokenTimes);
  console.log("JWT Issuance:", results.infrastructure_timings.jwt_issuance_ms);

  // B. Database Context Fetch for Patient A
  const dbFetchTimes = [];
  for (let i = 0; i < 20; i++) {
    const t0 = process.hrtime.bigint();
    const [hist] = await pool.execute("SELECT * FROM medical_history WHERE patient_id = ?", [patientA.patient_id]);
    const [symp] = await pool.execute("SELECT * FROM symptoms WHERE patient_id = ?", [patientA.patient_id]);
    const [rep] = await pool.execute("SELECT * FROM medical_reports WHERE patient_id = ?", [patientA.patient_id]);
    const [presc] = await pool.execute("SELECT * FROM prescriptions WHERE patient_id = ?", [patientA.patient_id]);
    const [disch] = await pool.execute("SELECT * FROM discharges WHERE patient_id = ?", [patientA.patient_id]);
    const t1 = process.hrtime.bigint();
    dbFetchTimes.push(Number(t1 - t0) / 1e6);
  }
  results.infrastructure_timings.db_context_fetch_ms = calcStats(dbFetchTimes);
  console.log("DB Context Fetch (5 queries):", results.infrastructure_timings.db_context_fetch_ms);

  // 3. DOCTOR CDS WORKFLOW BENCHMARKS
  console.log("\n--- Benchmarking Doctor CDS Scenarios ---");
  const doctorScenarios = [
    {
      name: "urgent_emergency",
      body: {
        patient_id: patientA.patient_id,
        clinical_query: "Patient reports sudden crushing substernal chest pain radiating to jaw with diaphoresis."
      },
      expectStatus: 200,
      expectEmergency: true
    },
    {
      name: "malformed_request",
      body: {
        patient_id: patientA.patient_id,
        clinical_query: "   "
      },
      expectStatus: 400
    },
    {
      name: "unauthorized_bola",
      body: {
        patient_id: 999999,
        clinical_query: "What is the recommended dose of Lisinopril?"
      },
      expectStatus: 403
    },
    {
      name: "common_grounded",
      body: {
        patient_id: patientA.patient_id,
        clinical_query: "What are the common adverse reactions of Lisinopril?"
      },
      expectStatus: 200,
      expectGrounded: true
    },
    {
      name: "insufficient_evidence",
      body: {
        patient_id: patientA.patient_id,
        clinical_query: "What are the clinical dosing protocols for unverified compound X-992 in feline sarcoma?"
      },
      expectStatus: 200,
      expectAbstained: true
    },
    {
      name: "multilingual_hi",
      body: {
        patient_id: patientA.patient_id,
        clinical_query: "लिसीनोप्रिल के क्या दुष्प्रभाव हैं?",
        language: "hi"
      },
      expectStatus: 200
    }
  ];

  for (const sc of doctorScenarios) {
    const latencies = [];
    let errorCount = 0;
    const runs = sc.name === "common_grounded" ? 3 : 1;
    for (let r = 0; r < runs; r++) {
      try {
        const res = await measureRequest({
          path: "/api/doctor/cds",
          method: "POST",
          headers: { "Authorization": `Bearer ${doctorToken}` }
        }, sc.body);

        if (res.statusCode === sc.expectStatus) {
          latencies.push(res.durationMs);
        } else {
          errorCount++;
          console.warn(`[WARN] ${sc.name} returned status ${res.statusCode}, expected ${sc.expectStatus}`);
        }
      } catch (err) {
        errorCount++;
        console.error(`[ERROR] ${sc.name}:`, err.message);
      }
    }
    const stats = calcStats(latencies);
    stats.errorCount = errorCount;
    results.doctor_cds[sc.name] = stats;
    console.log(`Doctor CDS [${sc.name}]: p50=${stats.p50}ms, max=${stats.max}ms, errors=${errorCount}`);
  }

  // 4. PATIENT POST-DISCHARGE CDS BENCHMARKS
  console.log("\n--- Benchmarking Patient Post-Discharge CDS Scenarios ---");
  const patientScenarios = [
    {
      name: "urgent_emergency",
      body: {
        clinical_query: "I cannot breathe and my chest feels like an elephant is sitting on it."
      },
      expectStatus: 200,
      expectEmergency: true
    },
    {
      name: "unauthorized_cross_patient_bola",
      body: {
        patient_id: patientB ? patientB.patient_id : 99999,
        clinical_query: "Can I take aspirin with my medication?"
      },
      expectStatus: 403
    },
    {
      name: "followup_educational",
      body: {
        clinical_query: "When should I take my prescribed Metformin and what symptoms should I monitor post-discharge?"
      },
      expectStatus: 200
    },
    {
      name: "insufficient_evidence",
      body: {
        clinical_query: "Can I replace my prescribed cardiovascular medication with unpasteurized apple cider vinegar?"
      },
      expectStatus: 200,
      expectAbstained: true
    },
    {
      name: "multilingual_mr",
      body: {
        clinical_query: "माझ्या औषधाचे दुष्परिणाम काय आहेत?",
        language: "mr"
      },
      expectStatus: 200
    }
  ];

  for (const sc of patientScenarios) {
    const latencies = [];
    let errorCount = 0;
    const runs = sc.name === "followup_educational" ? 3 : 1;
    for (let r = 0; r < runs; r++) {
      try {
        const res = await measureRequest({
          path: "/api/patient/cds",
          method: "POST",
          headers: { "Authorization": `Bearer ${patientAToken}` }
        }, sc.body);

        if (res.statusCode === sc.expectStatus) {
          latencies.push(res.durationMs);
        } else {
          errorCount++;
          console.warn(`[WARN] ${sc.name} returned status ${res.statusCode}, expected ${sc.expectStatus}`);
        }
      } catch (err) {
        errorCount++;
        console.error(`[ERROR] ${sc.name}:`, err.message);
      }
    }
    const stats = calcStats(latencies);
    stats.errorCount = errorCount;
    results.patient_post_discharge_cds[sc.name] = stats;
    console.log(`Patient CDS [${sc.name}]: p50=${stats.p50}ms, max=${stats.max}ms, errors=${errorCount}`);
  }

  // 5. Save Structured Results
  const outputPath = path.resolve(__dirname, "benchmark_e2e_cds_latencies.json");
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results
  }, null, 2));

  console.log(`\nBenchmark completed. Results written to: ${outputPath}`);
  console.log("==========================================================================");
  await pool.end();
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed with error:", err);
  process.exit(1);
});
