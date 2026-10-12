/**
 * Measure Operational Latencies and Health Metrics
 */
const http = require('http');

function measureUrl(options, postData = null) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1e6;
        resolve({
          statusCode: res.statusCode,
          durationMs,
          bodyLength: body.length
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function calcStats(durations) {
  durations.sort((a, b) => a - b);
  const min = durations[0];
  const max = durations[durations.length - 1];
  const median = durations[Math.floor(durations.length / 2)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const avg = durations.reduce((acc, d) => acc + d, 0) / durations.length;
  return { min: min.toFixed(2), max: max.toFixed(2), median: median.toFixed(2), p95: p95.toFixed(2), avg: avg.toFixed(2) };
}

async function run() {
  console.log('=== OPERATIONAL PERFORMANCE & LATENCY MEASUREMENTS ===\n');

  // 1. Express Health Check (port 5000)
  const health5000 = [];
  for (let i = 0; i < 10; i++) {
    const res = await measureUrl({
      hostname: 'localhost',
      port: 5000,
      path: '/api/health',
      method: 'GET'
    });
    health5000.push(res.durationMs);
  }
  console.log('Express /api/health (N=10):', calcStats(health5000), 'ms');

  // 2. FastAPI Health Check (port 8000)
  const health8000 = [];
  for (let i = 0; i < 10; i++) {
    const res = await measureUrl({
      hostname: 'localhost',
      port: 8000,
      path: '/health',
      method: 'GET'
    });
    health8000.push(res.durationMs);
  }
  console.log('FastAPI /health (N=10):', calcStats(health8000), 'ms');

  // 3. Central Hub Root (port 5000 /)
  const hubRoot = [];
  for (let i = 0; i < 10; i++) {
    const res = await measureUrl({
      hostname: 'localhost',
      port: 5000,
      path: '/',
      method: 'GET'
    });
    hubRoot.push(res.durationMs);
  }
  console.log('Central Hub / (N=10):', calcStats(hubRoot), 'ms');

  // 4. FastAPI /cds/evaluate - Direct CDS Gateway (Medical safety query)
  const queries = [
    { lang: 'en', query: 'What are the adverse effects of Lisinopril?' },
    { lang: 'hi', query: 'लिसीनोप्रिल के क्या दुष्प्रभाव हैं?' },
    { lang: 'mr', query: 'लिसिनोप्रिलचे दुष्परिणाम काय आहेत?' },
    { lang: 'gu', query: 'લિસિનોપ્રિલ ની આડ અસરો શું છે?' }
  ];

  for (const q of queries) {
    const cdsTimes = [];
    for (let i = 0; i < 3; i++) {
      const payload = JSON.stringify({
        query: q.query,
        patient_context: null,
        language: q.lang
      });
      const res = await measureUrl({
        hostname: 'localhost',
        port: 8000,
        path: '/cds/evaluate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, payload);
      cdsTimes.push(res.durationMs);
    }
    console.log(`FastAPI /cds/evaluate [${q.lang}] (N=3):`, calcStats(cdsTimes), 'ms');
  }

  console.log('\n=== MEASUREMENT COMPLETE ===');
}

run().catch(err => {
  console.error('Error during measurements:', err);
  process.exit(1);
});
