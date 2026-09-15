# PHASE 24 — OPEN ISSUES & FUTURE CONSIDERATIONS

## 1. Resolved in Phase 24
- **Real Corpus Expansion**: Increased authentic production chunks from 236 to 2,204 chunks across 231 DailyMed monographs, 8 ICMR guidelines, 4 MoHFW STGs, and 16 MedlinePlus topics.
- **Directory Structure Cleaned**: Established clear separation across `sources/`, `raw/`, `normalized/`, `manifests/`, `registry/`, `indexes/`, `quarantine/`, and `evaluation/`.
- **Machine-Readable Registry**: Created `data/registry/knowledge_base_registry.json` for 17 sources.
- **Provenance Integrity**: Verified 100.0% valid provenance on all 2,204 chunks (0 invalid).
- **Dynamic Incremental Updates**: Validated ADD, MODIFY, and DELETE operations with zero re-embedding of unchanged chunks (0.376s for 10 modified chunks).

---

## 2. Open Items for Future Post-Major Project Phases
1. **Real-Time DailyMed Daily Sync Service**:
   - Currently, DailyMed updates are ingested in batch via `DailyMedAdapter`. A scheduled cron or webhook listener can be added in production to poll the NLM DailyMed RSS feed.
2. **Indian Pharmacopoeia Commission (IPC) National Formulary Integration**:
   - Further expansion into Indian generic brand names (e.g. Glycomet for Metformin, Ciplox for Ciprofloxacin) using an IPC vocabulary adapter.
3. **Frontend Integration Ready**:
   - The backend API contract is frozen and verified (110 unit/integration tests passing). The upcoming phase can connect the React/Vite clinical web interface directly to `/api/v1/cds/query` and `/chat`.
