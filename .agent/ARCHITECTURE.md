# SYSTEM ARCHITECTURE — HEALTHCARE PLATFORM

## 1. System Overview & Component Topology

The platform follows a modular, service-oriented architecture designed to separate deterministic extraction and validation from probabilistic semantic retrieval.

```mermaid
flowchart TD
    subgraph ClientLayer [Client & Gateway Layer]
        UI["Web Frontend (Vite / React / HTML)"]
        API["FastAPI Application Services (rag_module/api.py)"]
    end

    subgraph ServiceBoundary [Service Layer Boundary (V2.8)]
        SVC["RAGService (rag_module/service.py)\n- Typed Validation (RAGQueryRequest)\n- Filtering (Source, Domain, Section)\n- Error Masking (No Leaked Paths)\n- Observability & Metrics (Latency)"]
        SAFETY["QuerySafetyEngine (rag_module/safety/query_safety.py)\n- Emergency Query Intercept\n- Injection / Prompt Sanitization\n- Risk Categorization"]
        POLICY["EvidencePolicyEngine (rag_module/safety/evidence_policy.py)\n- Lexical & Semantic Grounding Validation\n- Pairwise Clinical Contradiction Detection\n- Deterministic Abstention Boundary"]
        PROV["ProvenanceValidator (rag_module/safety/provenance_validator.py)\n- 9-Field Provenance Integrity Audit\n- Zero Clinical Attribution Fabrication"]
    end

    subgraph CoreModules [Core Intelligence Modules]
        PM["prescription_module\n(Rule-based NLP & Regex Extraction)"]
        DM["drug_module\n(Standard Drug Master & Catalog)"]
        RAG["rag_module (V2.8)\n(Evidence Ingestion, Hybrid Retrieval, Grounding & Policy)"]
    end

    subgraph DataAndIndexes [Data & Index Stores]
        PKB["Pharmacology & Medical Corpus\n(DailyMed, MedQuAD, openFDA)"]
        VDB["FAISS Vector Index (BGE Dense)"]
        LDB["BM25 Inverted Lexical Index"]
    end

    UI --> API
    API --> SVC
    SVC --> SAFETY
    SVC --> RAG
    RAG --> POLICY
    POLICY --> PROV
    API --> PM
    API --> DM
    
    PM -->|Extracted Entities| SVC
    DM -->|Standardized Synonyms| SVC
    
    PKB --> RAG
    RAG --> VDB
    RAG --> LDB
```

---

## 2. Core Modules & Responsibilities

### 2.1 `prescription_module`
* **Purpose**: Parse unstructured clinical prescription text and extract standardized prescription entities.
* **Pipeline**:
  1. Input clinical text $\to$ Text normalizer.
  2. Rule-based Regex and EntityRuler matcher $\to$ Drug name, dosage strength, form, frequency, duration, route.
  3. Output structured medication payload (`drug_name`, `dosage`, `frequency`, `duration`).

### 2.2 `drug_module`
* **Purpose**: Master pharmacological reference repository and vocabulary normalizer.
* **Capabilities**: Generic-to-brand mapping, ATC classification cross-reference, formulation verification.

### 2.3 `rag_module` (V2.8 Grounding, Evidence Policy & Safety Foundation)
* **Purpose**: Modular evidence retrieval engine providing verified clinical literature and drug monographs through a decoupled service boundary, guarded by deterministic evidence policies and provenance audits.
* **Service Contract**: `RAGService.retrieve(request: RAGQueryRequest) -> RAGQueryResponse` exposing structured `EvidenceItem` objects with 100% audited provenance, explicit `GroundingDecision` contracts, and zero raw index handles.
* **Architecture**: Self-contained ingestion adapters, canonical `KnowledgeDocument`/`KnowledgeChunk` data contracts, dual-index hybrid retrieval (FAISS Dense + BM25 Lexical via RRF), deterministic `EvidencePolicyEngine` with safe abstention (`generation_allowed = False`), `ProvenanceValidator`, `QuerySafetyEngine`, and context assembly with citations.

---

## 3. Data Flow & Inter-Module Integration

### Clinical Inquiry Workflow
1. **Prescription Parsing**: User enters prescription text (e.g., *"Metformin 500mg PO BID with meals"*). `prescription_module` extracts structured dosage/drug entities.
2. **Entity Harmonization**: `drug_module` resolves the generic entity name and flags relevant interaction categories.
3. **Query Safety Triage**: `QuerySafetyEngine` screens for acute crises (e.g., severe anaphylaxis, acute overdose) and prompt injections. Emergency queries immediately return emergency protocols and block generation.
4. **Evidence Retrieval via Service**: `RAGService.retrieve()` executes hybrid retrieval (Dense + BM25) filtered by `source_filter=['DailyMed']` and `domain_filter=['pharmacology']`.
5. **Evidence Policy & Provenance Audit**: `EvidencePolicyEngine` and `ProvenanceValidator` audit the retrieved chunks for 9-field provenance completeness, lexical/semantic grounding thresholds, and pairwise contradiction markers.
6. **Grounding Decision & Abstention**: Evaluates grounding status (`GROUNDED`, `WEAK_EVIDENCE`, `INSUFFICIENT_EVIDENCE`, `CONFLICTING_EVIDENCE`) and assigns explicit machine-readable reason codes (`OK_GROUNDED`, `OUT_OF_DOMAIN`, `CONTRADICTORY_EVIDENCE`, etc.).
7. **Context Construction & Citation**: If generation is allowed, retrieved chunks are formatted into citation-bearing context strings with full provenance metadata (`source_id`, `chunk_id`, `section`, `source_url`) without raw index leakage.

---

## 4. Separation of Concerns & Safety Boundary

| Responsibility | Owning Subsystem | Rationale |
| :--- | :--- | :--- |
| **Deterministic Extraction** | `prescription_module` | Regex and exact vocabulary matching guarantee reproducible entity extraction without LLM hallucinations. |
| **Drug Vocabulary Authority** | `drug_module` | Centralized drug catalog prevents terminology divergence across modules. |
| **Service & Validation Boundary** | `rag_module/service.py` | Strict typed contracts and error hierarchy prevent internal state or index leakage. |
| **Evidence Grounding & Policy** | `rag_module/safety/` | Deterministic policy checks prevent ungrounded or contradictory clinical claims from reaching generation. |
| **Provenance Integrity** | `rag_module/safety/provenance_validator.py` | Mandates 9-field provenance audit and forbids fabrication of missing metadata. |
| **Clinical Decision Logic** | **Physician / Clinician** | The system acts as reference intelligence; human clinician remains the sole decision authority. |

---

## 5. Current Architecture vs. Planned Integration

* **Current State (V2.8)**: Production-oriented RAG foundation with deterministic evidence policy, safe abstention, provenance validation, emergency query triage, typed `GroundingDecision` contracts, thin FastAPI endpoints, and 85/85 passing tests.
* **Target State (V2.9+)**: Direct API integration where `prescription_module` output triggers automated `RAGService.retrieve()` safety and contraindication evidence lookups.

