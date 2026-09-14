# SYSTEM ARCHITECTURE — HEALTHCARE PLATFORM

## 1. System Overview & Component Topology

The platform follows a modular, service-oriented architecture designed to separate deterministic extraction and validation from probabilistic semantic retrieval.

```mermaid
flowchart TD
    subgraph ClientLayer [Client & Gateway Layer]
        UI["Web Frontend (Vite / React / HTML)"]
        API["FastAPI Application Services (rag_module/api.py)"]
    end

    subgraph ServiceBoundary [Service Layer Boundary (V2.7)]
        SVC["RAGService (rag_module/service.py)\n- Typed Validation (RAGQueryRequest)\n- Filtering (Source, Domain, Section)\n- Error Masking (No Leaked Paths)\n- Observability & Metrics (Latency)"]
    end

    subgraph CoreModules [Core Intelligence Modules]
        PM["prescription_module\n(Rule-based NLP & Regex Extraction)"]
        DM["drug_module\n(Standard Drug Master & Catalog)"]
        RAG["rag_module (V2.7)\n(Evidence Ingestion, Hybrid Retrieval & Grounding)"]
    end

    subgraph DataAndIndexes [Data & Index Stores]
        PKB["Pharmacology & Medical Corpus\n(DailyMed, MedQuAD, openFDA)"]
        VDB["FAISS Vector Index (BGE Dense)"]
        LDB["BM25 Inverted Lexical Index"]
    end

    UI --> API
    API --> SVC
    SVC --> RAG
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

### 2.3 `rag_module` (V2.7 Service & Backend Foundation)
* **Purpose**: Modular evidence retrieval engine providing verified clinical literature and drug monographs through a decoupled service boundary.
* **Service Contract**: `RAGService.retrieve(request: RAGQueryRequest) -> RAGQueryResponse` exposing structured `EvidenceItem` objects with 100% provenance and 0 raw index handles.
* **Architecture**: Self-contained ingestion adapters, canonical `KnowledgeDocument`/`KnowledgeChunk` data contracts, dual-index hybrid retrieval (FAISS Dense + BM25 Lexical via RRF), context assembly with citations, safety guardrails, and LLM synthesis.

---

## 3. Data Flow & Inter-Module Integration

### Clinical Inquiry Workflow
1. **Prescription Parsing**: User enters prescription text (e.g., *"Metformin 500mg PO BID with meals"*). `prescription_module` extracts:
   ```json
   {
     "drug": "Metformin",
     "strength": "500mg",
     "route": "Oral",
     "frequency": "Twice daily"
   }
   ```
2. **Entity Harmonization**: `drug_module` resolves the generic entity name and flags relevant interaction categories.
3. **Evidence Retrieval via Service**: `RAGService.retrieve()` executes hybrid retrieval (Dense + BM25) filtered by `source_filter=['DailyMed']` and `domain_filter=['pharmacology']`.
4. **Context Construction & Citation**: Retrieved chunks (e.g., *Boxed Warning: Lactic Acidosis*, *Dosage & Administration*) are formatted into citation-bearing context strings with full provenance metadata (`source_id`, `chunk_id`, `section`, `source_url`).
5. **Safety Verification**: Response provides grounded clinical evidence with clickable provenance URLs and section tags without raw index leakage.

---

## 4. Separation of Concerns & Safety Boundary

| Responsibility | Owning Subsystem | Rationale |
| :--- | :--- | :--- |
| **Deterministic Extraction** | `prescription_module` | Regex and exact vocabulary matching guarantee reproducible entity extraction without LLM hallucinations. |
| **Drug Vocabulary Authority** | `drug_module` | Centralized drug catalog prevents terminology divergence across modules. |
| **Service & Validation Boundary** | `rag_module/service.py` | Strict typed contracts and error hierarchy prevent internal state or index leakage. |
| **Evidence Grounding** | `rag_module` | Dual-retrieval indexes official FDA/NIH sources to supply verified text citations. |
| **Clinical Decision Logic** | **Physician / Clinician** | The system acts as reference intelligence; human clinician remains the sole decision authority. |

---

## 5. Current Architecture vs. Planned Integration

* **Current State (V2.7)**: Decoupled `RAGService` boundary with `RAGQueryRequest`/`RAGQueryResponse`, thin FastAPI endpoints, health/readiness probes, and 70/70 passing tests.
* **Target State (V2.8+)**: Direct API integration where `prescription_module` output triggers automated `RAGService.retrieve()` safety and contraindication evidence lookups.

