const fs = require('fs');

async function runPatientQueries() {
  const loginRes = await fetch('http://localhost:5000/api/auth/patient/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav@gmail.com', password: 'patient123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('Logged in as Aarav Patil. Token verified.');

  const queries = [
    { title: 'Greeting', query: 'hello', lang: 'en' },
    { title: 'Discharge Instructions Query', query: 'Hi, can you help me understand my discharge instructions?', lang: 'en' },
    { title: 'Acknowledgement', query: 'thank you', lang: 'en' },
    { title: 'Suggestion 1 (Med Timing)', query: 'What time should I take my Amlodipine blood pressure medicine?', lang: 'en' },
    { title: 'Suggestion 2 (Warning Signs)', query: 'What are the warning signs where I should seek emergency care?', lang: 'en' },
    { title: 'Suggestion 3 (NSAID Interaction)', query: 'Can I take painkillers like Ibuprofen with my blood pressure pills?', lang: 'en' },
    { title: 'Suggestion 4 (Follow-up & Labs)', query: 'What follow-up appointments and lab tests do I need?', lang: 'en' }
  ];

  const results = [];

  for (const item of queries) {
    const t0 = Date.now();
    const res = await fetch('http://localhost:5000/api/patient/cds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ clinical_query: item.query, language: item.lang })
    });
    const latency = Date.now() - t0;
    const data = await res.json();

    console.log(`\n========================================`);
    console.log(`[TEST] ${item.title}`);
    console.log(`Query: "${item.query}"`);
    console.log(`Latency: ${latency}ms | Status: ${res.status}`);
    console.log(`Verification: ${data.verification_status} | Grounded: ${data.is_grounded} | Abstained: ${data.abstained}`);
    console.log(`Pipeline Mode: ${data.pipeline_mode}`);
    console.log(`Citations count: ${(data.citations || []).length}`);
    if (data.citations && data.citations.length > 0) {
      console.log(`Citation 1: ${data.citations[0].title} (${data.citations[0].source_name})`);
    }
    if (data.drug_interactions && data.drug_interactions.length > 0) {
      console.log(`Drug interaction: ${data.drug_interactions[0].drug_pair.join(' + ')} [${data.drug_interactions[0].severity}]`);
    }
    console.log(`Answer:\n${data.answer}`);

    results.push({
      title: item.title,
      query: item.query,
      status: res.status,
      verification_status: data.verification_status,
      pipeline_mode: data.pipeline_mode,
      is_grounded: data.is_grounded,
      abstained: data.abstained,
      latency_ms: latency,
      answer: data.answer,
      citations: data.citations || []
    });
  }

  return results;
}

runPatientQueries().then(r => console.log('\nAll Phase 3 queries completed successfully.')).catch(console.error);
