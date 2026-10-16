# SYSTEM ARCHITECTURE — HEALTHCARE CDS PLATFORM

## 1. End-to-End System Topology

The platform separates client presentation, API gateway services, and the frozen RAG medical intelligence pipeline into clearly bounded, audit-traceable boundaries.

```mermaid
flowchart TD
    subgraph FrontendBoundary [1. Frontend Presentation Layer (React + Vite)]
        UI["Doctor UI / CDS Assistant (CDSAssistant.jsx)"]
        CLIENT["Frontend API Client (ragApi.js)"]
        UI --> CLIENT
    end

    subgraph APIBoundary [2. API Gateway Layer (FastAPI on Port 8000)]
        GATEWAY["FastAPI Application (rag_module/api.py)"]
        CHAT_EP["POST /chat (Minimal { query } & Full Payloads)"]
        CLIENT -->|HTTP / JSON| GATEWAY
        GATEWAY --> CHAT_EP
    end

    subgraph RAGBoundary [3. Medical RAG Pipeline (rag_pipeline.py)]
        PIPELINE["MedicalRAGPipeline.query()"]
        CHAT_EP --> PIPELINE

        subgraph SafetyBoundary [4. Pre-Retrieval Safety Interceptors (guardrails.py)]
            EMERGENCY{"Emergency Triage Intercept?"}
            INJECTION{"Prompt Injection Intercept?"}
            NORMALIZER["Clinical Entity Normalizer (e.g. Lipitor → Atorvastatin)"]
            
            PIPELINE --> EMERGENCY
            EMERGENCY -->|Yes: Acute Crisis| EM_RESP["Emergency Protocol Response\n(Bypasses Retrieval & LLM)"]
            EMERGENCY -->|No| INJECTION
            INJECTION -->|Yes: System Prompt Attack| SEC_RESP["Security Block Response\n(Bypasses Retrieval & LLM)"]
            INJECTION -->|No| NORMALIZER
        end

        subgraph RetrievalBoundary [5. Multi-Source Hybrid Retrieval]
            DENSE["Dense Search (FAISS IndexFlatIP, 384D BGE)"]
            SPARSE["Lexical Search (BM25Okapi)"]
            RRF["Reciprocal Rank Fusion (k=60)"]
            RERANK["Cross-Encoder Reranker\n(ms-marco-MiniLM-L-6-v2 / Pass-Through)"]

            NORMALIZER --> DENSE & SPARSE
            DENSE & SPARSE --> RRF --> RERANK
        end

        subgraph EvidenceBoundary [6. Evidence Policy & Entity Isolation (evidence_policy.py)]
            POLICY{"Evidence Policy Engine\n(Entity Match & Thresholds)"}
            RERANK --> POLICY
            POLICY -->|Entity Unknown / OOD| ABSTAIN_RESP["Fail-Closed Policy Abstention\n(generation_allowed = False)"]
        end

        subgraph GenerationBoundary [7. Generation & Grounding Verification]
            CTX["Context Builder (Formatted Monograph Chunks)"]
            GEN["Local LLM Generator (TinyLlama-1.1B-Chat)"]
            VERIFIER{"Answer Grounding Verifier\n(Claim Extraction & N-Gram Grounding)"}

            POLICY -->|Evidence Sufficient| CTX --> GEN --> VERIFIER
            VERIFIER -->|Unverified Claims / Hallucination| WITHHELD_RESP["Withheld Answer (Fail-Closed)"]
            VERIFIER -->|Verified Claims| VERIFIED_RESP["Verified Attributed Response"]
        end
    end

    subgraph ClientRendering [8. UI Response Rendering]
        RENDER["React State & UI Badges\n(Verified, Abstention, Emergency, or Security)"]
        EM_RESP & SEC_RESP & ABSTAIN_RESP & WITHHELD_RESP & VERIFIED_RESP -->|JSON Response| GATEWAY
        GATEWAY -->|HTTP 200 OK| CLIENT --> RENDER
    end
```

---

## 2. System Architectural Boundaries

### 2.1 Frontend Boundary (`frontend/`)
* **Technology**: React 19, Vite 8, Tailwind CSS v4.
* **Component Focus**:
  * `CDSAssistant.jsx`: Interactive clinical chat interface with Markdown rendering, dynamic safety badge display, and citation evidence cards.
  * `ragApi.js`: Typed API client with 90-second timeout to handle local CPU model cold starts and error interceptors.
* **Invariant**: The frontend makes **zero independent clinical safety decisions** and contains **no mock or hardcoded medical answers**. All statuses, badges, and texts derive directly from backend API responses.

### 2.2 API Gateway Boundary (`rag_module/api.py`)
* **Technology**: FastAPI 0.110+, Pydantic v2.
* **Endpoints**:
  * `POST /chat`: Unified entry point accepting minimal `{ "query": "..." }` or full legacy configuration payloads.
  * `GET /health` & `GET /ready`: Health check and model readiness monitoring.
  * `POST /rag/query`: Advanced programmatic retrieval and generation endpoint.
* **Invariant**: Standardizes pipeline exceptions into clean HTTP responses, shielding internal filesystem paths and model weights.

### 2.3 Safety Boundary (`rag_module/safety/guardrails.py`)
* **Components**:
  * `EmergencyTriageInterceptor`: Pattern-matches acute, life-threatening symptoms (e.g., chest pain, poison ingestion, breathing arrest). If matched, bypasses retrieval and generation immediately.
  * `PromptInjectionDefense`: Identifies prompt manipulation, system prompt extraction, and instruction overriding, neutralizing the request early.
  * `EntityNormalizer`: Standardizes common commercial brand names to canonical generic entities (e.g., *Lipitor $\to$ Atorvastatin*) before retrieval.

### 2.4 Evidence & Policy Boundary (`rag_module/safety/evidence_policy.py`)
* **Components**:
  * `EvidencePolicyEngine`: Evaluates whether retrieved chunks actually ground the target clinical entities.
  * Deterministic reason codes (`OK_GROUNDED`, `OUT_OF_DOMAIN`, `UNKNOWN_ENTITY`, `INSUFFICIENT_EVIDENCE`).
* **Invariant**: Strictly fail-closed. If an entity is not indexed in the production corpus, `generation_allowed` is set to `False` and an explicit abstention response is returned.

### 2.5 Generation & Grounding Boundary (`rag_module/safety/grounding_verifier.py`)
* **Components**:
  * `TinyLlama-1.1B-Chat-v1.0`: Local compact generator invoked with temperature 0.1.
  * `AnswerGroundingVerifier`: Deconstructs generated answers into atomic factual claims, verifying each proposition against retrieved DailyMed chunks.
* **Invariant**: If any candidate claim lacks lexical grounding or unigram support in the retrieved context, the answer is safely withheld (`withheld_verification_failure`).

---

## 3. Separation of Modules in Repository

The repository houses three independent modules that will be unified under a CDS Gateway in the upcoming phase:
1. **`rag_module/`**: Evidence retrieval and grounding (Frozen at v2.10).
2. **`drug_module/`**: Deterministic drug-drug interaction and adverse effect screening (DrugBank & SIDER).
3. **`prescription_module/`**: Deterministic regex and rule-based prescription information extraction.
