import urllib.request, json, zlib, re

# 1. Login as patient Aarav Patil
req = urllib.request.Request(
    'http://127.0.0.1:5001/api/auth/patient/login',
    data=json.dumps({'email': 'aarav@gmail.com', 'password': 'patient123'}).encode(),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req) as r:
    auth_data = json.loads(r.read().decode())
    token = auth_data['token']

# 2. Fetch prescriptions list
req2 = urllib.request.Request(
    'http://127.0.0.1:5001/api/patient/prescriptions',
    headers={'Authorization': f'Bearer {token}'}
)
with urllib.request.urlopen(req2) as r:
    res_data = json.loads(r.read().decode())
    rx_list = res_data.get('prescriptions') if isinstance(res_data, dict) else res_data
    print(f'Total prescriptions found: {len(rx_list)}')
    latest = rx_list[0]
    rx_id = latest['prescription_id']
    med = latest['medicines'][0]['medicine_name'] if latest.get('medicines') else 'N/A'
    dose = latest['medicines'][0]['dosage'] if latest.get('medicines') else 'N/A'
    freq = latest['medicines'][0]['frequency'] if latest.get('medicines') else 'N/A'
    dur = latest['medicines'][0]['duration'] if latest.get('medicines') else 'N/A'
    print(f'Latest Prescription ID: {rx_id} | Medication: {med} | Dosage: {dose} | Frequency: {freq} | Duration: {dur}')

# 3. Download PDF
req3 = urllib.request.Request(
    f'http://127.0.0.1:5001/api/patient/prescriptions/{rx_id}/pdf',
    headers={'Authorization': f'Bearer {token}'}
)
with urllib.request.urlopen(req3) as r:
    pdf_bytes = r.read()
    print(f'PDF Downloaded successfully: {len(pdf_bytes)} bytes')

# Save bytes to audit evidence
import os
ev_dir = 'audit_evidence/presentation_stabilization_20261025'
os.makedirs(ev_dir, exist_ok=True)
pdf_path = os.path.join(ev_dir, f'downloaded_prescription_{rx_id}.pdf')
with open(pdf_path, 'wb') as f:
    f.write(pdf_bytes)
print(f'Saved PDF to: {pdf_path}')

# 4. Decompress PDF streams to inspect truthful text
decompressed_chunks = []
for m in re.finditer(rb'stream[\r\n]+(.*?)[\r\n]+endstream', pdf_bytes, re.DOTALL):
    raw_stream = m.group(1)
    try:
        decompressed_chunks.append(zlib.decompress(raw_stream).decode('latin1', errors='ignore'))
    except Exception:
        decompressed_chunks.append(raw_stream.decode('latin1', errors='ignore'))

full_text = '\n'.join(decompressed_chunks)
print('--- PDF CONTENT INSPECTION ---')
print('Mentions ISO 9001?', 'ISO 9001' in full_text)
print('Mentions DIGITALLY CONFIRMED AND AUTHORIZED?', 'DIGITALLY CONFIRMED AND AUTHORIZED' in full_text)
print('Mentions Academic Prototype?', 'Academic Clinical Decision Support Prototype' in full_text)
print('Mentions Clinician Authorization?', 'Clinician Authorization' in full_text)
print('Mentions Deterministic DDI Screen?', 'Deterministic DDI Screen' in full_text)
print('Mentions Azithromycin?', 'Azithromycin' in full_text)
print('Mentions Duration 5 days?', '5 days' in full_text)
