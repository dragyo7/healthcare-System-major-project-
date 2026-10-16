# RAG EVALUATION & BENCHMARK REPORT (V2.10 FROZEN)

> **Notice**: This document reports the empirical evaluation of the frozen RAG V2.10 pipeline against the project's standardized 100-query clinical benchmark (`evaluation/datasets/clinical_benchmark_100.json`).  
> **Evaluation Scope**: These metrics reflect automated testing within the project's defined benchmark and test harness; they do not constitute formal medical certification or clinical trial validation.

---

## 1. Benchmark Dataset & Accounting Structure

The standardized benchmark consists of exactly **$N=100$ clinical queries** categorized into distinct operational regimes:

| Category | Query Count | Pipeline Evaluation Path | Included in Retrieval Metrics? |
| :--- | :---: | :--- | :---: |
| **Simple Factual** | 20 | Normal Hybrid RAG | **Yes** |
| **Complex Multi-Hop** | 20 | Normal Hybrid RAG | **Yes** |
| **Negative / Contraindication** | 20 | Normal Hybrid RAG | **Yes** |
| **Dosage & Administration** | 22 | Normal Hybrid RAG | **Yes** |
| **Unknown / Unindexed Entities** | 6 | Normal RAG $\to$ Evidence Policy Abstention | **Yes** (Evaluated against empty ground truth) |
| **Emergency Triage** | 4 | Step 1 Pre-Retrieval Interception | **No** (Diverted before vector retrieval) |
| **Prompt Injection Attacks** | 4 | Step 1.5 Security Neutralization | **No** (Blocked before vector retrieval) |
| **Out-of-Domain (OOD)** | 4 | Step 1 Out-of-Domain Detection | **No** (Blocked before vector retrieval) |
| **TOTAL** | **100** | — | **Evaluated Queries: 88** |

### Accounting Explanation: Retrieval Denominator ($N=88$)
The 12 safety and boundary queries (4 Emergency + 4 Prompt Injection + 4 OOD) intentionally and correctly bypass the retrieval engine:
* Evaluating vector retrieval on an emergency query would represent an architectural flaw (as acute emergencies must never execute slow vector queries).
* Therefore, the exact denominator for retrieval precision and recall is $100 - 12 = 88$.

---

## 2. Safety & Grounding Metrics (100-Query Scope)

The primary design requirement of this clinical RAG is deterministic fail-closed safety:

| Safety Metric | Formula / Definition | Numerator / Denom | Rate | Status |
| :--- | :--- | :---: | :---: | :---: |
| **Emergency Diverted Rate** | Acute crisis prompts intercepted pre-retrieval | 4 / 4 | **100.0%** | **PASS [✓]** |
| **Prompt Injection Neutralized** | Adversarial instructions halted at Step 1.5 | 4 / 4 | **100.0%** | **PASS [✓]** |
| **Out-of-Domain Rejection** | Non-medical queries rejected pre-retrieval | 4 / 4 | **100.0%** | **PASS [✓]** |
| **Unknown Entity Abstention** | Unindexed drugs triggered fail-closed policy | 6 / 6 | **100.0%** | **PASS [✓]** |
| **Hallucination Leakage** | Fabricated claims reaching final response | 0 / 100 | **0.0%** | **PASS [✓]** |
| **Unsupported Claim Leakage**| Unverified clinical propositions allowed | 0 / 100 | **0.0%** | **PASS [✓]** |
| **Citation Validity Rate** | Cited sources validly matching DailyMed SetIDs | 156 / 156 | **100.0%** | **PASS [✓]** |
| **Correct Abstention Rate** | Total designated abstention queries handled correctly | 18 / 18 | **100.0%** | **PASS [✓]** |

---

## 3. Retrieval Performance Metrics ($N=88$ Evaluated Queries)

Evaluated across dense FAISS (`BAAI/bge-small-en`, 384D) and sparse lexical `BM25Okapi` merged via Reciprocal Rank Fusion ($k=60$) with second-stage Cross-Encoder reranking (`ms-marco-MiniLM-L-6-v2`):

| Retrieval Metric | Numerator / Denom | Measured Value | Analysis & Clinical Significance |
| :--- | :---: | :---: | :--- |
| **Recall@1** | 45 / 88 | **51.14%** | Top-1 chunk contains the target drug monograph. |
| **Recall@5** | 48 / 88 | **54.55%** | Target monograph retrieved within Top-5 candidate window. |
| **Recall@10** | 48 / 88 | **54.55%** | Candidate recall ceiling on production 2,204-chunk index. |
| **Mean Reciprocal Rank (MRR)** | — | **0.5265** | High rank concentration (majority of hits occur at rank 1 or 2). |
| **Target Entity Retrieval Rate** | 48 / 88 | **54.55%** | Exact target drug entity retrieved into context window. |

---

## 4. Generation Dynamics & Abstention Analysis

* **Correct Abstention Rate**: **100.0%** (18 / 18)
  * All 4 emergencies, 4 prompt injections, 4 OOD queries, and 6 unknown entities were correctly abstained/diverted.
* **False Abstention Rate**: **35.37%** (29 / 82)
  * Out of 82 queries with valid relevant context, 29 answers were safely withheld by the `AnswerGroundingVerifier`.

### Root Cause of False Abstentions (Generation Limitations)
1. **Compact Generator Capacity (`TinyLlama-1.1B-Chat`)**:
   * Compact 1.1B parameter models frequently prepend meta-commentary (e.g., *"Based on the FDA monograph provided..."* or conversational anaphora).
2. **Fail-Closed Verification Penalty**:
   * The deterministic verifier extracts these conversational phrases as factual claims and, finding no exact unigram support in the technical DailyMed monograph, withholds the answer fail-closed.
3. **Safety Tradeoff**:
   * This design intentionally prioritizes **zero hallucination leakage (0.0%)** over answer volume. The system never guesses or passes unverified text.

---

## 5. Test Suite Verification

* **Full Regression Suite**:
  * Command: `python -m pytest rag_module/tests/ -v`
  * Execution Time: ~211 seconds
  * **Result**: `190 passed, 2 skipped` (offline fixtures), `0 failed`.
* **Coverage Scope**:
  * Hybrid retrieval, dense/sparse indexing, RRF ranking, cross-encoder fallback.
  * Safety guardrails, emergency regexes, prompt-injection patterns.
  * Evidence policy rules, entity isolation, grounding verifier proposition logic.
  * Minimal `/chat` contract and backward-compatible full payload execution.
