# Deep System-Level Assessment: Healthcare RAG / CDS Classification

**Assessor**: Independent Senior Systems Auditor
**Date**: September 16, 2026
**Scope**: Complete `rag_module/`, `drug_module/`, `prescription_module/`, `frontend/`, `data/`, `scripts/`
**Method**: Source-code tracing, data corpus forensics, architectural analysis, evaluation audit, live component inspection

---

## 1. Executive Finding

**What have we actually built?**

This system is an **evidence-grounded medical information retrieval and question-answering prototype** — NOT a Clinical Decision Support System in any standard definition of that term.

It retrieves drug label information (primarily FDA DailyMed package inserts) from a 2,204-chunk indexed corpus, applies quality-of-evidence gating (provenance validation, entity verification, score thresholds, contradiction scanning), and feeds accepted evidence passages to a small local LLM (TinyLlama 1.1B) for summarization. It includes safety guardrails for emergency triage, prompt injection defense, out-of-domain abstention, and mandatory clinical disclaimers.

It does NOT accept patient-specific data. It does NOT process clinical context (labs, vitals, medications, diagnoses). It does NOT make decisions. It does NOT integrate with EHRs. It does NOT perform medication reconciliation, dosing calculations, or guideline-driven clinical reasoning. It retrieves and summarizes published drug label content from authoritative sources.

This is a **well-engineered medical evidence retrieval research prototype** — a meaningful achievement for a 4th-year major project — but the "CDS" label is not defensible without significant qualification.

---

## 2. System Reality vs Project Claims

| # | Claim (from docs/code/reports) | Evidence from Code | Verified? | Correction |
|---|---|---|---|---|
| 1 | "Clinical Decision Support System" | No patient data input, no clinical reasoning, no decision logic | **❌ NOT VERIFIED** | Medical information retrieval prototype with evidence-grounding policies |
| 2 | "Production-grade" / "production-ready" | Singleton globals, no auth, no rate limiting, no audit logging, TinyLlama 1.1B as generator | **❌ NOT VERIFIED** | Research prototype with clean engineering patterns |
| 3 | "100% provenance" | `ProvenanceValidator` checks 9 metadata fields exist; does NOT verify content accuracy | **⚠️ PARTIALLY** | Metadata completeness checking, not content-level provenance |
| 4 | "Hallucination resistant" | TinyLlama 1.1B can hallucinate within context window; no post-generation claim verification | **❌ NOT VERIFIED** | Has pre-generation guardrails; no post-generation grounding check |
| 5 | "Recall@5 = 90%" (Hybrid+Reranker) | Measured on a self-constructed benchmark, dataset unknown size | **⚠️ CONTEXT NEEDED** | Retrieval recall measured on N queries; does not prove answer correctness |
| 6 | "Safe abstention" | Entity verification + OOD detection implemented and tested | **✅ VERIFIED** | Working abstention for fictional entities and OOD queries |
| 7 | "Emergency triage" | Regex-based pattern matching on ~6 emergency categories | **✅ VERIFIED** | Pattern-based interception, not clinical triage |
| 8 | "Prompt injection defense" | Regex sanitization of 7 injection patterns | **✅ VERIFIED** | Basic regex defense; not adversarially robust |
| 9 | "Evidence policy enforcement" | `EvidencePolicyEngine` with score thresholds, entity checks, conflict detection | **✅ VERIFIED** | Deterministic policy layer is implemented and tested |
| 10 | "Multi-source authoritative knowledge base" | 2,204 chunks: 2,176 DailyMed + 16 MedlinePlus + 8 ICMR + 4 MoHFW | **⚠️ PARTIALLY** | ~98.7% DailyMed. Calling it "multi-source" is technically true but misleading |
| 11 | "Conflict detection" | Regex pairs for pregnancy/renal/toxicity contradictions between same-entity chunks | **✅ VERIFIED** | Narrow-scope pattern matching (3 contradiction types), not semantic conflict detection |
| 12 | "Grounding audit — 100% PASS" | `ANSWER_GROUNDING_AUDIT.md` shows "atomic claims" that are actually raw chunk text, not LLM-generated claims | **❌ NOT VERIFIED** | The audit verified evidence retrieval, NOT that LLM-generated answers are grounded |

---

## 3. Actual Architecture (Code-Level)

### Complete Request Path

```
USER QUERY
   |
   v
FastAPI endpoint (api.py: /chat, /rag/query)
   |
   v
RAGQueryRequest (Pydantic validation: 1-2000 chars, mode, filters)
   |
   v
QuerySafetyEngine.assess_query()  [query_safety.py]
   |- Emergency regex scan (6 patterns) -> intercept if match
   |- Prompt injection regex scan (7 patterns) -> sanitize
   '- Risk categorization (informational / medication_safety / emergency / OOD / injection)
   |
   v
DenseRetriever.search()  [dense_retriever.py]
   |- BGEEmbedder encodes query with instruction prefix
   |- FAISS IndexFlatIP search (top-20)
   '- Optional source/domain post-filtering
   |
   v
BM25Retriever.search()  [bm25_retriever.py]
   |- Tokenized query against BM25Okapi index
   '- Top-20 candidates with optional filtering
   |
   v
HybridRetriever.search()  [hybrid_retriever.py]
   |- RRF fusion: score(idx) = Sum 1/(k+rank) for k=60
   '- Merged, deduplicated, sorted candidates
   |
   v
CrossEncoderReranker.rerank()  [cross_encoder_reranker.py]
   |- ms-marco-MiniLM-L-6-v2 cross-attention scoring
   '- Sort by cross-encoder score, return top-K
   |
   v
EvidencePolicyEngine.evaluate_evidence()  [evidence_policy.py]
   |- ProvenanceValidator: 9 mandatory metadata fields
   |- Text length check (min 5 words)
   |- Subject entity extraction (remove stopwords + clinical terms)
   |- Entity presence verification in top-3 evidence text
   |- Lexical overlap ratio calculation
   |- Score threshold evaluation (dense/bm25/hybrid)
   |- Contradiction regex scan (3 patterns, same-entity only)
   '- GroundingDecision: GROUNDED / WEAK / INSUFFICIENT / CONFLICTING
   |
   v
ContextBuilder.build_context()  [context_builder.py]
   |- Jaccard deduplication (0.85 threshold)
   |- Token budget enforcement (~1500 tokens)
   '- XML-delimited evidence blocks with source headers
   |
   v
MedicalGenerator.generate()  [generator_v2.py]
   |- TinyLlama/TinyLlama-1.1B-Chat-v1.0
   |- System prompt: "ONLY use evidence provided"
   |- Max 200 new tokens, temperature=0.2
   '- Raw text output (no structured verification)
   |
   v
SafetyGuardrails.append_disclaimer()  [guardrails.py]
   '- Appends mandatory clinical disclaimer
   |
   v
FINAL RESPONSE (question, answer, is_emergency, abstained, sources, citations)
```

### Critical Architectural Observation

The system has **two parallel pipeline paths** that diverge:

1. **`/rag/query`** -> `RAGService.retrieve()` -> Returns evidence + grounding decision. **No generation.**
2. **`/chat`** -> `RAGService.retrieve()` -> If grounding passes -> `MedicalRAGPipeline.generator.generate()` -> Answer.

The `/rag/query` path is retrieval-only. The `/chat` path adds generation. The `/debug/rag/trace` endpoint exposes the full pipeline stages for diagnostics.

---

## 4. Knowledge Base Reality

### Corpus Composition

| Source | Chunks | Percentage | Content Type |
|---|---|---|---|
| **DailyMed (FDA SPL)** | 2,176 | 98.7% | Drug package inserts (9 sections per drug x ~231 drugs + 97 boxed warnings) |
| **MedlinePlus (NIH)** | 16 | 0.7% | Consumer health topic summaries (4 topics x 4 sections) |
| **ICMR (India)** | 8 | 0.4% | Clinical guidelines (diabetes, antimicrobial) |
| **MoHFW STG (India)** | 4 | 0.2% | Standard treatment guidelines (hypertension, emergency) |
| **Total** | **2,204** | **100%** | |

### What This Corpus Actually Contains

The DailyMed content provides 9 structured sections per drug:
- Indications and Usage
- Dosage and Administration
- Contraindications
- Warnings and Precautions
- Adverse Reactions
- Drug Interactions
- Use in Specific Populations
- Overdosage
- Clinical Pharmacology

Plus Boxed Warnings where applicable (~97 drugs).

### Coverage Assessment (Drug Entities)

~240 unique drug entities indexed. These appear to be common prescription medications (metformin, lisinopril, amlodipine, atorvastatin, warfarin, ciprofloxacin, etc.).

### Capability Matrix

| Clinical Information Domain | Evidence Present? | Coverage | Suitable for QA? | Suitable for Decision Support? |
|---|---|---|---|---|
| **Drug indications** | Yes | ~240 drugs | Yes | No (no patient context) |
| **Contraindications** | Yes | ~240 drugs | Yes | No (no patient matching) |
| **Adverse reactions** | Yes | ~240 drugs | Yes | No |
| **Drug interactions** | Yes | ~240 drugs | Yes (label-level) | No (no medication list) |
| **Dosage information** | Yes | ~240 drugs | Informational only | No (no weight/renal calc) |
| **Boxed warnings** | Yes | ~97 drugs | Yes | No |
| **Clinical pharmacology** | Yes | ~240 drugs | Yes | No |
| **Disease overviews** | Minimal | 4 topics | Very limited | No |
| **Clinical guidelines** | Minimal | 2 ICMR + 1 MoHFW | Very limited | No |
| **Diagnosis** | No | None | No | No |
| **Differential diagnosis** | No | None | No | No |
| **Treatment selection** | No | None | No | No |
| **Lab interpretation** | No | None | No | No |
| **Emergency protocols** | No (regex intercept only) | None | No | No |
| **Patient education (broad)** | Nearly absent | 16 chunks | No | No |

### Honest Assessment

This is a **drug label information retrieval system** covering ~240 medications. It is NOT a "general medical knowledge base." The 28 non-DailyMed chunks (1.3%) are insufficient to make claims about disease knowledge, guideline coverage, or clinical reasoning capability.

---

## 5. RAG Retrieval Capability

### What Retrieval Actually Provides

The two-stage hybrid retrieval (dense+BM25 -> RRF -> cross-encoder reranking) is **well-engineered for its scope**:

- Dense retrieval captures semantic similarity (e.g., "kidney problems" -> renal impairment)
- BM25 provides exact keyword matching (critical for drug names, dosages)
- RRF fusion combines both rank lists
- Cross-encoder provides token-level query-passage attention scoring

### Reported Metrics

| Mode | Recall@1 | Recall@3 | Recall@5 | MRR |
|---|---|---|---|---|
| Dense | 85% | 85% | 85% | 0.850 |
| BM25 | 80% | 85% | 90% | 0.838 |
| Hybrid RRF | 85% | 85% | 85% | 0.850 |
| Hybrid + Reranker | 85% | 90% | 90% | 0.875 |

### What These Metrics Actually Prove

1. **These measure retrieval recall, NOT answer correctness.** Recall@5=90% means that in 90% of test queries, the expected document appeared in the top-5 candidates.
2. **The benchmark queries are self-constructed.** From `expanded_evaluation_queries.json`: 50 queries, mostly of the form "What are the contraindications of [drug]?" These are synthetic queries written to match the corpus.
3. **The benchmark does not test adversarial, ambiguous, or complex queries.** All queries are direct drug-label lookups. No multi-hop reasoning, no disambiguation, no questions requiring synthesis across sources.
4. **Recall@K = 85-90% on a self-constructed benchmark is adequate for a research prototype but does not constitute clinical validation.**

> **IMPORTANT:** These metrics prove the retrieval pipeline can find relevant drug label sections for straightforward drug-name queries. They do NOT prove that the generated answers are medically correct, clinically safe, or properly grounded.

---

## 6. Evidence and Safety Layer

### What Policy Enforcement Actually Provides

The `EvidencePolicyEngine` is the strongest architectural component. It provides:

| Capability | Implementation | Effectiveness |
|---|---|---|
| **Provenance validation** | 9 mandatory metadata fields checked | Catches corrupted/incomplete evidence |
| **Entity verification** | Subject entity tokens checked against evidence text | Catches fabricated drug names (Cardioregulin fix) |
| **Out-of-domain detection** | Less than 35% word overlap -> blocked | Blocks non-medical queries |
| **Score thresholding** | Dense >=0.50 (strong), >=0.35 (weak) | Heuristic, not calibrated |
| **Contradiction detection** | 3 regex pairs (pregnancy, renal, toxicity) | Extremely narrow scope |
| **Abstention** | generation_allowed=False when insufficient | Fail-closed behavior |

### What It Does NOT Provide

- **Semantic relevance filtering**: A provenance-valid chunk about metoprolol could enter the context for a metformin query if it scores high enough.
- **Cross-drug contamination prevention**: Query "metformin dosage" could retrieve empagliflozin or glimepiride dosage chunks if they score high. The grounding audit (Query 3) actually shows this happening -- Empagliflozin and Glimepiride chunks appear in an Amlodipine query response.
- **Claim-level grounding**: There is no verification that individual sentences in the LLM output are supported by the evidence. The system trusts the LLM prompt instruction.
- **Post-generation safety check**: Once the LLM generates text, it is appended with a disclaimer and returned. No content validation occurs.

---

## 7. Generation / Grounding Audit

### The Generator

**TinyLlama 1.1B** is a 1.1-billion parameter language model. This is an extremely small model by current standards. Its capabilities:

- Can echo/paraphrase short passages from context
- Has limited reasoning, synthesis, and instruction-following ability
- Is prone to hallucination, repetition, and incoherence for complex queries
- Was NOT designed or fine-tuned for medical text generation
- Context window: 2048 tokens (hard truncation)

### The "Grounding Audit" Problem

The `ANSWER_GROUNDING_AUDIT.md` claims 100% grounding across 10 queries. However, careful examination reveals:

**The "atomic clinical claims" in the audit are the raw evidence chunks themselves -- NOT the LLM-generated answer text.**

Evidence from the audit table rows:
- "Drug: Metformin Section: Contraindications Severe renal impairment (eGFR < 30 m..."
- "Drug: Lisinopril Section: Boxed Warning WARNING: FETAL TOXICITY..."

These are the **input evidence passages**, not the output claims. The "overlap ratio = 1.0" is trivially true because the audit is comparing evidence text to itself.

**This means the grounding audit has never actually verified that the LLM's generated text matches the evidence.**

### The Metformin "Increases Intestinal Absorption" Issue

The corpus contains (in `clinical_pharmacology` chunk):

> "Metformin **decreases** hepatic glucose production, **decreases** intestinal absorption of glucose, and improves insulin sensitivity."

If the LLM previously generated "increases intestinal absorption of glucose," this would be a **direct hallucination** where the LLM reversed the pharmacological mechanism while citing the same source.

**Root cause analysis:**

1. **Retrieval**: Likely correct -- the Clinical Pharmacology chunk would be retrieved.
2. **Reranking**: Not the issue -- the right chunk enters the context.
3. **Context assembly**: Correct -- the XML-delimited text passes the evidence verbatim.
4. **Generation**: TinyLlama 1.1B may hallucinate "increases" when the evidence says "decreases," especially when summarizing pharmacology passages. Small LLMs are particularly susceptible to semantic reversals.
5. **Post-generation verification**: **ABSENT**. No system exists to check whether the generated answer contradicts the evidence.

**This is the single most important safety gap in the system.**

### Smallest Robust Fix

Add a **post-generation claim-evidence consistency check**. This does NOT require redesigning the pipeline:

1. Extract key assertions from the generated text (can use simple heuristics: drug-action pairs)
2. Check for semantic reversals (increases/decreases, safe/contraindicated, recommended/avoided)
3. If a reversal is detected, suppress the generated answer and return the raw evidence with a disclaimer

Alternatively, for the prototype scope: **Do not generate free-text answers. Return the evidence passages directly with citations.** This eliminates the hallucination vector entirely.

---

## 8. Doctor Use Case

### What a Clinician Can Reasonably Use This For

| Capability | Assessment | Safety |
|---|---|---|
| Ask factual drug label questions | Yes -- "What are the contraindications of metformin?" | GREEN: Acceptable for information retrieval |
| Retrieve specific drug sections | Yes -- section filtering by type | GREEN: Acceptable |
| Inspect underlying source | Yes -- URLs to DailyMed pages provided | GREEN: Good traceability |
| Get boxed warnings | Yes -- 97 drugs covered | GREEN: Acceptable |
| Drug interaction lookup (label-level) | Yes -- from Drug Interactions section | YELLOW: Label-level only, not exhaustive |
| Get dosage information | Informational only | YELLOW: No patient-specific calculation |

### What a Clinician Cannot Safely Use This For

| Capability | Reason | Risk |
|---|---|---|
| Patient-specific decisions | No patient data input mechanism exists | RED |
| Medication reconciliation | No medication list processing | RED |
| Dosing calculations | No weight/renal/hepatic adjustments | RED |
| Differential diagnosis | No diagnostic knowledge | RED |
| Guideline-based treatment selection | 12 guideline chunks total | RED |
| Lab interpretation | No lab knowledge | RED |
| Drug-drug interaction checking (comprehensive) | Limited to ~240 drugs' label text | RED |
| Conflicting evidence resolution | 3 regex patterns only | RED |

### Verdict

**Useful as a drug label information retrieval assistant.** NOT safe to use as clinical decision support.

A clinician could use this the same way they would use DailyMed search -- to quickly look up package insert sections. The RAG system adds semantic search capability on top of that, which is genuinely useful. But the generated answers from TinyLlama introduce an unverified transformation layer that could introduce errors.

---

## 9. Patient Use Case

### What a Patient Can Reasonably Use This For

- General information about what a medication is used for
- Reading about common side effects (with understanding these come from drug labels)
- Understanding what a boxed warning means
- Learning about basic contraindications

### What a Patient MUST NOT Use This For

- Self-diagnosis
- Treatment decisions
- Dosage changes
- Medication substitution
- Emergency guidance (the system correctly intercepts this, but the interception is regex-based)
- Any form of personalized medical advice

### Technical Safety Boundary for Patient Use

The mandatory clinical disclaimer is appropriate:

> *"This healthcare AI assistant is an educational Major Project prototype and does not provide formal medical diagnoses, prescriptive orders, or emergency clinical advice."*

However, the disclaimer alone is insufficient safety. The actual safety boundary is:

1. The system correctly refuses fabricated drugs
2. The system correctly intercepts emergency keywords
3. The system may generate paraphrased drug label content that contains semantic reversals (increases vs decreases)
4. Cross-drug contamination in retrieved evidence can lead to answers citing the wrong drug's information
5. No mechanism exists to prevent a patient from acting on hallucinated medical information

---

## 10. CDS Classification

### Definitions

| Level | Definition |
|---|---|
| **A. Medical Information Retrieval** | Finding relevant medical documents/passages based on a query |
| **B. Evidence-Grounded Medical QA** | Retrieving evidence AND generating an answer constrained to that evidence |
| **C. Clinical Decision Support (Generic)** | Using clinical knowledge + patient context to assist clinical decisions |
| **D. Patient-Specific CDS** | Processing individual patient data (labs, meds, vitals) to generate recommendations |
| **E. Autonomous Diagnosis/Treatment** | Making independent clinical decisions without human oversight |

### Where This System Falls

**This system operates at Level A-B: Medical Information Retrieval with attempted evidence-grounded QA.**

- **Level A**: FULLY IMPLEMENTED. The retrieval pipeline is functional and returns ranked, provenance-validated evidence.
- **Level B**: PARTIALLY IMPLEMENTED. Evidence grounding policies exist, but the LLM generation step lacks post-generation verification. The system *attempts* evidence-grounded QA but cannot *guarantee* it.
- **Level C**: NOT IMPLEMENTED. No clinical reasoning, no patient context, no decision logic.
- **Level D**: NOT IMPLEMENTED. No patient data input at all.
- **Level E**: NOT IMPLEMENTED and should never be.

### The "CDS" Label

**"Clinical Decision Support System" is NOT a defensible description** of the current implementation. The term "CDS" has a specific meaning in health informatics (see HL7 CDS Hooks, CPOE integration, alert systems, guideline engines). This system has none of those characteristics.

**Defensible descriptions:**
- "Evidence-grounded medical information retrieval system"
- "Drug label QA research prototype with RAG architecture"
- "Medical evidence retrieval system with safety guardrails"
- "Healthcare RAG prototype for drug information lookup"

---

## 11. Capability Boundary Table

### GREEN -- System Can Reasonably Perform

| Capability | Notes |
|---|---|
| Drug label section retrieval | Core strength; ~240 drugs |
| Factual drug information lookup | Indications, contraindications, adverse reactions |
| Boxed warning retrieval | 97 drugs with boxed warnings |
| Drug interaction information (label-level) | From package insert Drug Interactions sections |
| Source attribution / citation | URLs to DailyMed provided |
| Fictional drug rejection | Entity verification working |
| Out-of-domain query rejection | Word overlap ratio check working |
| Emergency keyword interception | Regex-based, deterministic |
| Prompt injection sanitization | Basic regex defense |
| Multi-modal retrieval (dense + lexical) | Hybrid RRF fusion working |

### YELLOW -- Potentially Useful But Requires Validation

| Capability | Missing Safeguard |
|---|---|
| LLM-generated drug information summaries | No post-generation claim verification |
| Dosage information display | Informational only; no calculation; risk of misinterpretation |
| Cross-drug information queries | Risk of cross-entity contamination in retrieved evidence |
| ICMR/MoHFW guideline retrieval | Only 12 chunks; inadequate coverage |
| MedlinePlus disease information | Only 16 chunks; inadequate coverage |
| Contradiction detection | Only 3 narrow regex patterns |
| Weak-evidence generation | Allowed by default (configurable); may produce unreliable answers |

### RED -- System Should NOT Claim This

| Capability | Reason |
|---|---|
| Clinical decision support | No patient context, no decision logic |
| Patient-specific recommendations | No patient data input |
| Diagnosis or differential diagnosis | No diagnostic knowledge base |
| Treatment selection or modification | No clinical reasoning |
| Dosing recommendations | No patient-specific calculation |
| Medication change guidance | No medication reconciliation |
| Emergency triage (clinical) | Regex interception is not clinical triage |
| Drug interaction checking (comprehensive) | Label text is not an interaction database |
| Longitudinal patient monitoring | No temporal data model |
| Guideline-based clinical reasoning | 12 guideline chunks insufficient |
| Medical-grade accuracy | TinyLlama 1.1B is not clinically validated |

---

## 12. Evaluation Audit

### Metric: Recall@K (Retrieval Benchmark)

| What was measured | Whether a known-correct document appears in top-K retrieved candidates |
|---|---|
| Dataset size | ~50 queries (from `expanded_evaluation_queries.json`) |
| Query composition | Synthetic, directly mapped to corpus drugs. 30 drug queries + 5 guideline + 5 health topic + 5 OOD + 3 unsupported entity + 2 emergency |
| What counts as correct | Drug name + source match |
| What this proves | The retrieval pipeline can find the right drug label section for simple drug-name queries |
| What this does NOT prove | That generated answers are correct, safe, or properly grounded |

### Metric: Source Accuracy@1

| What was measured | Whether the top-1 result comes from the expected source (DailyMed, ICMR, etc.) |
|---|---|
| What this proves | Source filtering and ranking work for direct queries |
| What this does NOT prove | Clinical accuracy of the retrieved content or generated answer |

### Metric: Answer Grounding Audit (ANSWER_GROUNDING_AUDIT.md)

| What was measured | Word overlap between evidence passages and... the same evidence passages |
|---|---|
| **Critical finding** | The "atomic claims" are the raw evidence text, not LLM output |
| What this proves | Evidence retrieval returns relevant passages |
| What this does NOT prove | That LLM-generated answers match the evidence. **This metric is fundamentally flawed.** |

### Metric: Abstention Accuracy

| What was measured | Whether fictional drugs and OOD queries are correctly refused |
|---|---|
| Dataset | 5 fictional entities + 3 OOD queries |
| What this proves | Entity verification and OOD detection work for the tested cases |
| Limitation | 8 test cases is insufficient for statistical confidence |

### Metric: Emergency Interception

| What was measured | Whether emergency keywords trigger the triage response |
|---|---|
| Dataset | 2 emergency queries |
| What this proves | Regex pattern matching works for tested patterns |
| Limitation | Only 2 test cases; no adversarial bypass testing |

> **WARNING:** No metric in the current evaluation suite measures **answer-level correctness**. All metrics measure retrieval quality. The gap between "retrieved the right document" and "generated a correct answer" is the primary unvalidated risk.

---

## 13. Safety Gaps

### P0 -- Safety-Critical

| # | Gap | Risk | Impact |
|---|---|---|---|
| **S1** | **No post-generation grounding verification.** The LLM can hallucinate claims that contradict the evidence (e.g., "increases" vs "decreases"). | An answer could reverse the pharmacological mechanism of a drug. | Patient or clinician acts on inverted medical information. |
| **S2** | **TinyLlama 1.1B is not clinically validated.** It is a general-purpose small language model with no medical fine-tuning. | Unpredictable behavior on medical text. | Generated text may be incoherent, incomplete, or subtly wrong. |
| **S3** | **Cross-drug contamination.** Query about Drug A can return evidence about Drug B if they share semantic similarity. No strict drug-entity scoping on context assembly. | A user asking about amlodipine dosage receives empagliflozin dosage in the answer (documented in existing grounding audit). | Clinically dangerous information mixing. |

### P1 -- Necessary for Defensible Architecture

| # | Gap | Risk |
|---|---|---|
| **S4** | **Answer grounding audit methodology is flawed.** Compares evidence to evidence, not generated answers to evidence. | False confidence in answer quality. |
| **S5** | **Contradiction detection covers only 3 patterns.** Real clinical contradictions are far more diverse. | Conflicting evidence can pass undetected. |
| **S6** | **No rate limiting or authentication on API.** | Abuse potential in any non-local deployment. |
| **S7** | **Evaluation dataset is tiny and self-constructed.** 50 queries with no external validation. | Metrics may not generalize. |

### P2 -- Useful But Not Blocking

| # | Gap | Notes |
|---|---|---|
| **S8** | No audit logging of queries and responses | Required for any deployment but acceptable for prototype |
| **S9** | No user feedback mechanism | Cannot learn from errors |
| **S10** | Disease/guideline coverage is minimal | 28 non-drug chunks |

---

## 14. Minimum Required Improvements

### P0 -- Must Fix Before Any Use

| # | Change | Effort | Rationale |
|---|---|---|---|
| **P0-1** | **Add post-generation claim-evidence consistency check** OR **remove free-text generation and return evidence passages directly** | Medium / Low | Eliminates the primary hallucination vector. Returning raw evidence with citations is safer and simpler. |
| **P0-2** | **Add drug-entity scoping to context assembly.** Only pass evidence chunks whose drug entity matches the query drug to the generator. | Low | Prevents cross-drug contamination. |
| **P0-3** | **Fix the grounding audit to actually verify LLM output.** Compare generated answer sentences against evidence text, not evidence against itself. | Medium | Current audit provides false assurance. |

### P1 -- Necessary for Defensible Claims

| # | Change | Effort | Rationale |
|---|---|---|---|
| **P1-1** | **Replace TinyLlama with a more capable model** (e.g., Gemma 2B, Phi-3-mini) or use API-based generation (Gemini, GPT-4o-mini) | Low-Medium | TinyLlama 1.1B is below the minimum capability for reliable medical text summarization. |
| **P1-2** | **Expand evaluation to 200+ queries** with external validation or clinician review | Medium | 50 self-constructed queries is insufficient. |
| **P1-3** | **Add basic API authentication and rate limiting** | Low | Required for any non-localhost deployment. |

### P2 -- Useful But Optional

| # | Change | Effort |
|---|---|---|
| **P2-1** | Expand contradiction detection to semantic similarity-based comparison | Medium |
| **P2-2** | Add query audit logging | Low |
| **P2-3** | Expand disease/guideline coverage | Medium |

### P3 -- Feature Creep / Do NOT Build

| # | Feature | Reason to Reject |
|---|---|---|
| **P3-1** | Knowledge graphs | Not needed for drug label retrieval |
| **P3-2** | Multi-agent orchestration | Unnecessary complexity for current scope |
| **P3-3** | Multimodal RAG (see section 15) | Not justified by current data |
| **P3-4** | EHR integration | Far beyond major project scope |
| **P3-5** | Real-time drug interaction database | Requires licensed databases (DrugBank, etc.) |
| **P3-6** | Custom medical model fine-tuning | Resource and scope infeasible |

---

## 15. Multimodal RAG Assessment

### Is Multimodal RAG Needed?

**No.** Multimodal RAG is NOT justified for the current scope.

**Reasoning:**

1. **Current data sources are structured text.** DailyMed SPL labels are XML/text. MedlinePlus topics are text. ICMR/MoHFW guidelines are text. No medical images, scanned documents, or visual charts are in the corpus.

2. **Drug label sections (indications, contraindications, dosage) are inherently textual.** There are no clinically meaningful visual structures that the text pipeline cannot represent.

3. **The prescription module** (`prescription_module/`) uses regex-based text extraction, not OCR. It processes typed text, not scanned images.

4. **Adding multimodal RAG would introduce:**
   - OCR/vision model complexity
   - Table extraction challenges
   - Image embedding storage
   - Significantly increased latency
   - New failure modes

5. **None of the current clinical use cases require visual understanding.**

**Verdict: Do NOT add multimodal RAG.** It would be scope creep with no benefit to the current system's primary use case (drug label information retrieval).

---

## 16. Recommended Final Scope

### What the Project Should Claim to Be

> **"A Retrieval-Augmented Generation (RAG) research prototype for evidence-grounded medical drug information retrieval, built as a 4th-year engineering major project."**

### What This Accurately Encompasses

1. **Hybrid retrieval architecture** (dense semantic + BM25 lexical + RRF fusion + cross-encoder reranking)
2. **Authoritative corpus** (~240 FDA-approved drug labels from DailyMed + Indian clinical guidelines)
3. **Safety guardrails** (emergency interception, prompt injection defense, entity verification, abstention)
4. **Evidence policy engine** (provenance validation, score thresholding, conflict detection)
5. **Provenance tracking** (full metadata lineage from source to chunk to citation)
6. **API layer** (FastAPI with structured request/response contracts)
7. **Diagnostic tooling** (trace endpoint, benchmark suite, forensic scripts)

### What This Does NOT Encompass

1. Clinical decision support
2. Patient-specific recommendations
3. Diagnosis
4. Treatment planning
5. Clinical deployment readiness

---

## 17. Final Verdict

### Precise Statement for Project Report / Viva / Presentation

> **"This project implements a Retrieval-Augmented Generation (RAG) system for evidence-grounded medical drug information retrieval. The system indexes ~2,200 chunks from authoritative sources (primarily U.S. FDA DailyMed drug labels, supplemented by Indian clinical guidelines and NIH health topics) and provides hybrid semantic-lexical retrieval with cross-encoder reranking, provenance validation, evidence policy enforcement, and safety guardrails including emergency interception, prompt injection defense, and domain-boundary abstention. The architecture demonstrates research-grade principles in medical information retrieval: source provenance tracking, deterministic evidence gating, unsupported entity rejection, and fail-closed abstention. It is a research prototype suitable for demonstrating RAG architecture in a healthcare domain, not a clinical decision support system."**

### What the System Genuinely Does Well

1. **Retrieval engineering is solid.** Dense + BM25 + RRF + cross-encoder is a well-designed pipeline.
2. **Evidence policy engine is thoughtful.** Entity verification, provenance validation, and deterministic grounding decisions are genuinely valuable safety features.
3. **Abstention behavior is correct.** The system correctly refuses fictional drugs, OOD queries, and emergency situations.
4. **Source provenance is maintained end-to-end.** Every chunk links back to its source URL.
5. **Code quality is high.** Clean separation of concerns, Pydantic contracts, structured error handling, type annotations.
6. **The scope of drug label coverage (~240 drugs) is meaningful** for a major project prototype.

### What the System Does NOT Do

1. Accept or process patient-specific clinical data
2. Make clinical decisions or recommendations
3. Guarantee that generated answers are medically correct
4. Provide comprehensive drug interaction checking
5. Replace or augment clinical judgment
6. Integrate with clinical workflows or EHR systems

### The 3-5 Most Important Changes Before Frontend Integration

1. **Either remove free-text LLM generation or add post-generation verification.** The safest option is to return evidence passages directly with citations, without LLM paraphrasing.
2. **Add drug-entity scoping to context assembly** to prevent cross-drug contamination.
3. **Fix the grounding evaluation** to actually test LLM output against evidence.
4. **Update all documentation** to replace "CDS" with accurate terminology.
5. **Consider upgrading from TinyLlama** if generation is retained (Phi-3-mini or API-based model).

### What Should NOT Be Built

- Knowledge graphs
- Multi-agent systems
- Multimodal RAG
- EHR integration
- Custom model training
- Additional microservices
- Complex orchestration frameworks

These would be feature creep that does not improve the core value proposition and would jeopardize completion of the major project.

---

> **CAUTION: The most dangerous thing this project could do is NOT building more features -- it is overstating what the current system does.** An honest, well-scoped "medical evidence retrieval RAG prototype" is a strong major project. An inaccurate claim of "Clinical Decision Support System" invites legitimate criticism in a viva and misrepresents the system's safety properties.

---

*End of assessment.*
