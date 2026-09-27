# Multimodal Extension Roadmap & Boundary Decisions

## Current Scope Decision (Phase 1)
**Multimodal RAG (e.g. direct medical image diagnosis for Chest X-Ray, CT, MRI, Dermatology, or Histopathology) is explicitly excluded from the current validated scope of this Healthcare Clinical Decision Support System.**

### Clinical & Architectural Rationale
1. **Clinical Decision Support Focus**: The primary academic contribution and engineering strength of this project is **multi-source, provenance-aware, hybrid textual retrieval over regulatory monographs, national clinical guidelines (ICMR/MoHFW), and structured medication safety rules**.
2. **Safety & Hallucination Risks in Diagnostic Imaging**: Autonomous diagnostic image classification requires specialized vision-language foundation models (e.g. Med-PaLM M, BioViL, LLaVA-Med), dedicated pixel-level bounding box annotations, and clinical validation protocols far beyond the bounded scope of CDS evidence retrieval.
3. **Traceability Guarantee**: In textual CDS, every recommendation is traced directly to an exact paragraph, LOINC section, or guideline page number. Direct image diagnosis does not provide equivalent deterministic paragraph-level provenance without specialized visual attention grounding.

---

## Future Direction (Phase 2 Roadmap)

If multimodal functionality is introduced in future iterations, it will follow an **OCR / Document Vision Intake Pattern**, rather than autonomous diagnostic imaging:

```
Patient Document / Prescription Image
                 │
                 ▼
[OCR / Document Layout Transformer (Donut / PaddleOCR / Tesseract)]
                 │
                 ▼
[Extracted Prescription & Clinical Text]
                 │
                 ▼
[User / Clinician Verification Modal (Human-in-the-Loop)]
                 │
                 ▼
[Existing CDS-RAG Pipeline (RxNorm Normalization -> Rule Check -> DailyMed/Guideline RAG)]
```

### Excluded Capabilities (Permanently Outside Scope)
- Direct image-to-diagnosis classification.
- Autonomous radiological image reading.
- Unverified image embeddings in the text FAISS vector index.
