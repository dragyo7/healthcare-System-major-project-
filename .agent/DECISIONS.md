# ARCHITECTURAL DECISIONS RECORD (ADR)

This document records the foundational architectural decisions governing the Clinical Decision Support (CDS) System and the frozen RAG medical intelligence layer.

---

### ADR-01: DailyMed as Primary Production RAG Source
* **Decision**: Establish FDA Structured Product Labeling (SPL) drug monographs from DailyMed as the primary authoritative knowledge source for production RAG retrieval (2,176 / 2,204 chunks).
* **Reason**: Clinical decision support requires legally and pharmacologically authoritative drug information (indications, contraindications, boxed warnings, dosing) rather than crowdsourced or generic web articles.
* **Consequence**: High clinical accuracy for indexed medications; unindexed rare medications trigger safe policy abstentions.
* **Status**: **Active & Frozen**.

---

### ADR-02: RxNorm for Normalization-Only
* **Decision**: Utilize RxNorm strictly as an entity normalization resource (mapping brand aliases and spellings to canonical generic concepts), rather than indexing RxNorm concept tables into the FAISS vector index.
* **Reason**: RxNorm tables contain short ontology strings without narrative clinical context, which degrade dense embedding similarity when mixed with full text monographs.
* **Consequence**: Clean brand-to-generic resolution (e.g., *Lipitor $\to$ Atorvastatin*) before retrieval without polluting the semantic vector space.
* **Status**: **Active & Frozen**.

---

### ADR-03: Separation of DrugBank & SIDER into Dedicated Drug Safety Engine
* **Decision**: Maintain DrugBank interaction rules and SIDER adverse reaction profiles in a dedicated, deterministic rule-based engine (`drug_module`), rather than relying on RAG retrieval for interaction checks.
* **Reason**: Multi-drug interaction screening requires exhaustive $O(n^2)$ pairwise rule matching. Semantic vector retrieval cannot guarantee 100% sensitivity for drug-drug interactions.
* **Consequence**: High-reliability deterministic interaction detection in `drug_module`, complemented by RAG for deep clinical literature lookups.
* **Status**: **Active & Frozen**.

---

### ADR-04: Dual-Index Hybrid Retrieval (BGE Dense + BM25 Lexical)
* **Decision**: Pair dense semantic retrieval (`BAAI/bge-small-en`, 384D) with exact lexical inverted search (`BM25Okapi`).
* **Reason**: Dense vector search handles semantic paraphrasing (e.g., *"kidney impairment"* $\to$ *"renal failure"*), but often fails on exact drug brand names, integers, and NDC codes. BM25 provides exact keyword and numerical precision.
* **Consequence**: Robust retrieval performance across both conceptual medical inquiries and exact drug dosage queries.
* **Status**: **Active & Frozen**.

---

### ADR-05: Reciprocal Rank Fusion (RRF) Before Cross-Encoder Reranking
* **Decision**: Merge candidate lists from dense and lexical retrieval using Reciprocal Rank Fusion ($k=60$) prior to second-stage cross-encoder reranking.
* **Reason**: Cosine similarity and BM25 scores operate on entirely different numerical scales. RRF merges candidates based strictly on relative ordinal rank, preventing score skew.
* **Consequence**: Robust, scale-invariant candidate selection feeding into the cross-encoder.
* **Status**: **Active & Frozen**.

---

### ADR-06: Deterministic Grounding Verification with Fail-Closed Policy
* **Decision**: Mandate that all candidate generator outputs be deconstructed into atomic propositions and checked for token/unigram recall against retrieved DailyMed context via `AnswerGroundingVerifier`.
* **Reason**: Generative LLMs are inherently probabilistic and prone to hallucinating dosages or indications. High-stakes clinical AI cannot allow ungrounded claims into patient care.
* **Consequence**: Zero hallucination leakage (0/100 on benchmark). If a claim cannot be verified against evidence, the answer is withheld fail-closed.
* **Status**: **Active & Frozen**.

---

### ADR-07: Pre-Retrieval Emergency Triage Bypass
* **Decision**: Intercept acute, life-threatening symptoms (chest pain, acute poisoning, stroke symptoms) deterministically before retrieval or LLM execution.
* **Reason**: Patients or clinicians facing life-threatening emergencies must immediately receive urgent emergency care protocols without the latency or variability of vector search.
* **Consequence**: 100% emergency interception rate (4/4 on benchmark) with sub-10ms response times.
* **Status**: **Active & Frozen**.

---

### ADR-08: Early Prompt-Injection Neutralization
* **Decision**: Intercept adversarial prompt-injection patterns (e.g., instructions to ignore previous rules or print internal prompts) at Step 1.5 before retrieval or generation.
* **Reason**: Preventing system prompt extraction, data poisoning, and unauthorized instruction following at the earliest pipeline boundary.
* **Consequence**: Zero system prompt leakage; security block banner presented immediately without unnecessary GPU/CPU execution.
* **Status**: **Active & Frozen**.

---

### ADR-09: Frontend Independence Restriction (Zero Client-Side Clinical Decisions)
* **Decision**: Forbid the frontend from making independent clinical safety decisions, generating simulated answers, or displaying hardcoded emergency telephone numbers.
* **Reason**: The frontend is a presentation layer. Divergence between UI logic and backend clinical evidence compromises auditability and medical safety.
* **Consequence**: The frontend strictly mirrors the backend API's verified status, abstention reasons, and citation metadata.
* **Status**: **Active & Enforced**.

---

### ADR-10: Evidence-Bound Source Display Policy
* **Decision**: Render citation source cards in the UI only when the backend response is actively verified (`verified === true` and `!abstained`).
* **Reason**: Presenting source cards on abstained or withheld responses creates a false illusion of clinical grounding.
* **Consequence**: Clinicians only see source evidence cards when the claims presented have been fully verified against those specific monographs.
* **Status**: **Active & Enforced**.

---

### ADR-11: RAG Architecture Hard Freeze During CDS Platform Integration
* **Decision**: Hard freeze the `rag_module` backend at commit `497a547` (v2.10) while focusing development on platform-level CDS integration.
* **Reason**: Continuous modification of the core RAG engine during multi-module integration introduces regression risk and invalidates benchmark results.
* **Consequence**: Clear, stable interface boundary for the upcoming CDS Gateway, Drug Checker, and Prescription Module integration.
* **Status**: **Active & Enforced**.
