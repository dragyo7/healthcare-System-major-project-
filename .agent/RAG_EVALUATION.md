# RAG EVALUATION & BENCHMARKING — HISTORICAL CHRONOLOGY & VERIFIED RESULTS

## 1. Executive Evaluation Summary

This document records the quantitative evaluation history, forensic discoveries, benchmark methodologies, and verified retrieval results of the RAG module from initial baseline through V2.5.1.

---

## 2. Engineering Chronology & Forensic Evolution

```
Legacy V1.0 (Baseline)
 └── Unnormalized embeddings, hardcoded paths, missing 65% of MedQuAD, no keyword matching.
RAG V2.0 (Foundation Upgrade)
 └── Integrated BGE-small-en (384-d), FAISS IndexFlatIP, BM25Okapi, RRF, and full MedQuAD ingestion.
RAG V2.2 (Forensic Benchmark Audit)
 └── CRITICAL DISCOVERY: Exposed that early 100% Recall claims were artifacts of a loose topic/keyword
     substring heuristic. Established strict evidence mapping and uncovered the complete absence of pharmacology monographs.
RAG V2.3 & V2.4 (Source Architecture & Real Data Validation)
 └── Introduced BaseSourceAdapter, SourceRegistry, and validated parsing of authentic FDA DailyMed XML labels.
RAG V2.5 (DailyMed Controlled Pilot)
 └── Ingested 25 authentic drug labels (159 documents/chunks), established 45-query pharmacology benchmark.
RAG V2.5.1 (Forensic Hardening & Reproducibility Audit)
 └── Verified chunking distributions, verified 0.0% leakage, independently cross-checked metrics, profiled latency,
     enforced 42/42 passing tests, and confirmed CrossEncoder fallback status.
```

---

## 3. The V2.2 Benchmark Integrity Discovery (Historical Turning Point)

During the V2.2 audit, an adversarial inspection of the legacy benchmark (`benchmark_dataset.json`) revealed that relevance was determined via `check_hit()` using broad keyword substring matching:
```python
# Legacy loose heuristic (V2.0/V2.1 - DEPRECATED)
if expected_topic.lower() in combined or matching_keywords >= 2:
    return True
```
This loose rule counted any chunk mentioning general disease keywords as a "hit", resulting in artificial 100% Recall@1 scores.

**Remediation Applied in V2.5**:
Replaced the heuristic with an exact, unambiguous ground truth contract (`expected_document_id`, `expected_drug`, `expected_sections`) in `pharmacology_benchmark.json`.

---

## 4. Benchmark Metric Definitions & Mathematical Formulation

Evaluated across $N=45$ clinical queries across 25 drugs in `rag_module/evaluation/pharmacology_benchmark.json`:

1. **Section / Drug Recall@K**:
   $$\text{Recall@}K = \frac{1}{N} \sum_{i=1}^{N} \mathbb{I}\left(\exists \text{ chunk } c \in \text{Top-}K_i \text{ s.t. } \text{drug}(c) = \text{drug}^*_i \land \text{sec}(c) \in \text{secs}^*_i\right)$$
2. **Strict Document Recall@K**:
   $$\text{StrictDocRecall@}K = \frac{1}{N} \sum_{i=1}^{N} \mathbb{I}\left(\exists \text{ chunk } c \in \text{Top-}K_i \text{ s.t. } \text{doc\_id}(c) = \text{doc\_id}^*_i\right)$$
3. **Mean Reciprocal Rank (MRR)**:
   $$\text{MRR} = \frac{1}{N} \sum_{i=1}^{N} \frac{1}{\text{rank}_i^*}, \quad \text{where } \text{rank}_i^* = \min \{ r \in [1, K] \mid \text{chunk}_r \text{ matches Section/Drug} \}$$

---

## 5. Verified Benchmark Results Across Retrieval Regimes

*Evaluated on the DailyMed Pharmacology Benchmark ($N=45$ queries)*:

| Retrieval Regime | Recall@1 | Recall@3 | Recall@5 | Recall@10 | Strict Doc Recall@1 | Strict Doc Recall@5 | MRR | Mean Latency | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **A. DailyMed Dense (BGE + FAISS)** | **86.67%** | **95.56%** | **95.56%** | **95.56%** | **82.22%** | **93.33%** | **0.9111** | 17.12 ms | **Verified [✓]** |
| **B. DailyMed BM25 (Lexical)** | 84.44% | 91.11% | 93.33% | 93.33% | 80.00% | 91.11% | 0.8796 | **0.38 ms** | **Verified [✓]** |
| **C. DailyMed Hybrid (RRF $k=60$)** | 84.44% | 93.33% | 93.33% | **95.56%** | 80.00% | 91.11% | 0.8926 | 17.17 ms | **Verified [✓]** |
| **D. Combined Dense (Filtered)** | 84.44% | 95.56% | 95.56% | 95.56% | 82.22% | 93.33% | 0.9000 | 22.30 ms | **Verified [✓]** |
| **E. Combined BM25 (Filtered)** | 84.44% | 95.56% | 95.56% | 95.56% | 80.00% | 93.33% | 0.8926 | 104.66 ms | **Verified [✓]** |
| **F. Combined Hybrid (Filtered)** | 84.44% | 95.56% | 95.56% | 95.56% | 80.00% | 93.33% | 0.9000 | 150.28 ms | **Verified [✓]** |
| **G. Combined Hybrid + Reranker** | 84.44% | 95.56% | 95.56% | 95.56% | 80.00% | 93.33% | 0.9000 | 146.81 ms | **Fallback Mode** |

---

## 6. Representative Clinical Query Audit Traces

| Query Category | Example Query | Target Drug & Section | Top-1 Retrieved Chunk | Match Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **1. Exact Terminology** | `"warfarin inr target indications"` | Warfarin $\to$ Indications | Pantoprazole (Drug Interactions) | Miss at Rank 1, **Hit at Rank 3** |
| **2. Dosage & Titration** | `"What is the recommended pediatric dosage of amoxicillin for acute otitis media?"` | Amoxicillin $\to$ Dosage | Amoxicillin (Indications) | Miss at Rank 1, **Hit at Rank 2** |
| **3. Drug-Drug Interaction**| `"Can citalopram be taken with MAO inhibitors or is there serotonin syndrome risk?"` | Citalopram $\to$ Interactions | Duloxetine (Interactions) | Miss at Rank 1, **Hit at Rank 2** |
| **4. Paraphrased Warning** | `"Are there safety warnings regarding lactic acidosis when prescribing metformin?"` | Metformin $\to$ Boxed Warning | Metformin (Boxed Warning) | **Direct Hit [✓] at Rank 1** |
| **5. Difficult Precaution** | `"What precautions should be taken when using ciprofloxacin in patients with myasthenia gravis?"` | Ciprofloxacin $\to$ Boxed Warning | Ciprofloxacin (Boxed Warning) | **Direct Hit [✓] at Rank 1** |

---

## 7. Latency Decomposition Breakdown

*Timing measured across 50 repeated query executions on CPU*:

| Component / Subsystem | DailyMed Index ($N=159$) Mean | DailyMed Index ($N=159$) p95 | Combined Index ($N=23,708$) Mean | Combined Index ($N=23,708$) p95 |
| :--- | :--- | :--- | :--- | :--- |
| **BGE Embedding (CPU)** | 17.12 ms | 19.34 ms | 20.19 ms | 28.14 ms |
| **FAISS Vector Search** | 0.05 ms | 0.06 ms | 22.30 ms | 30.03 ms |
| **BM25 Inverted Search** | 0.38 ms | 0.56 ms | 104.66 ms | 128.40 ms |
| **End-to-End Hybrid Search** | **17.17 ms** | **18.77 ms** | **150.28 ms** | **178.50 ms** |

---

## 8. Leakage & Test Suite Verification

* **Data Leakage Check**: 0 verbatim query matches and 0 full-string matches in corpus chunks (**0.0% leakage**).
* **Test Suite Status**: **42 / 42 tests passing (100%) in 6.2s** covering document models, ingestion adapters, provenance preservation, source isolation, metric calculation math, and sliding-window chunk boundaries.
* **Cross-Encoder Status**: Verified fallback pass-through mode (`FALLBACK / NOT EXECUTED`).
