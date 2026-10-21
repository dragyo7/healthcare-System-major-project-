# Prescription Safety, DDI & Dialogue Workflow Specification

> **Module**: Doctor Prescription Safety & Clinical Decision Support
> **Status**: Verified in Production Runtime
> **Integration Baseline**: Hardened Doctor Portal + FastAPI CDS Gateway + Multi-Ingredient Engine
> **Date**: October 2026

---

## 1. Overview & Architectural Boundaries

The Doctor Prescription Safety Workflow provides deterministic, fail-closed clinical safety screening for proposed prescriptions. It intercepts potential adverse drug-drug interactions (DDIs), duplicate active ingredients, and allergy contraindications before prescription records are committed to the electronic health record (EHR).

```text
  ┌────────────────────────────────────────────────────────┐
  │                 React / Vite Frontend                  │
  │     (Prescriptions.jsx + SafetyAnalysisModal.jsx)      │
  └──────────────────────────┬─────────────────────────────┘
                             │
            HTTP POST /api/doctor/prescriptions/screen
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │             Express EHR Gateway (Port 5000)            │
  │      (doctorController.js + cdsBridgeService.js)       │
  │    • Resolves patient context & active medications     │
  │    • Resolves documented patient allergies             │
  └──────────────────────────┬─────────────────────────────┘
                             │
              HTTP POST /cds/screen-prescription
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │             FastAPI CDS Gateway (Port 8000)            │
  │       (cds_module/orchestrator.py + drug_module)       │
  │    • Multi-ingredient decomposition (Combiflam, etc.)  │
  │    • Verified DailyMed SPL interaction rules (RUL-001) │
  │    • Class-level allergy cross-sensitivity check       │
  │    • Deterministic candidate alternative suggestion    │
  └────────────────────────────────────────────────────────┘
```

---

## 2. End-to-End Clinical Lifecycle Trace

1. **Patient Selection & Context Loading**:
   - The clinician selects an authorized patient using the searchable patient selector (`SelectPatient`).
   - The frontend automatically loads the patient's verified EHR context:
     - Documented Allergies (e.g. `Penicillin`, `Aspirin`, `Sulfa`).
     - Active Prescription History (e.g. `Warfarin`, `Metformin`, `Amlodipine`).
   - The `Patient Clinical Context Card` renders these critical records immediately above the prescription form.

2. **Prescription Authoring**:
   - The clinician inputs candidate medications with dosage, frequency, duration, and instructions.
   - Any modification to candidate medicines or the selected patient immediately sets `staleAnalysis = true`, disabling direct prescription submission until safety analysis is re-run.

3. **Explicit "Run Safety Analysis"**:
   - The clinician triggers analysis via the **Run Safety Analysis** button.
   - The Express backend gathers candidate medicines along with all active patient medications from MySQL and forwards the payload to FastAPI `/cds/screen-prescription`.

4. **Multi-Ingredient Decomposition & DDI Screening**:
   - Combination brand names are decomposed into active pharmaceutical ingredients:
     - `Combiflam` $\rightarrow$ `['ibuprofen', 'paracetamol']`
     - `Augmentin` $\rightarrow$ `['amoxicillin', 'clavulanate']`
     - `Bactrim` / `Septra` $\rightarrow$ `['trimethoprim', 'sulfamethoxazole']`
   - Pairwise screening matches constituent ingredients against active medications using verified DailyMed SPL rules (`RUL-INT-001` through `RUL-INT-008`).
   - Co-prescribed or active duplicate ingredients are flagged (e.g. `Combiflam` + `Crocin` both delivering `paracetamol`).

5. **Allergy & Cross-Reactivity Screening**:
   - Evaluates candidate moieties against documented allergies.
   - Applies class-level cross-sensitivity rules:
     - `Penicillin` $\rightarrow$ Contraindicates `Amoxicillin`, `Ampicillin`, `Augmentin`.
     - `Sulfa` $\rightarrow$ Contraindicates `Bactrim`, `Septra`, `Sulfamethoxazole`.
     - `NSAID` / `Aspirin` $\rightarrow$ Contraindicates `Ibuprofen`, `Combiflam`, `Naproxen`.

6. **Interactive Dialogue (`SafetyAnalysisModal.jsx`)**:
   - WCAG-accessible dialogue with ARIA attributes (`role="dialog"`, `aria-modal="true"`).
   - Displays:
     - Evaluated candidate vs existing active medications.
     - Severity badges (`CRITICAL`, `WARNING`, `SAFE`, `NO MATCHING RULE`).
     - DailyMed rule IDs, clinical mechanism explanations, and official SPL citations.
     - Evidence-backed alternative recommendations with 1-click **Apply Alternative** buttons.
     - Clinician override input requiring a justification reason ($\ge 5$ characters) for major findings.

7. **Server-Side Revalidation & Persistence Invariant**:
   - On submission to `POST /api/doctor/prescriptions`, the Express backend re-executes safety screening against fresh database records inside the database transaction boundary.
   - Bypassing the frontend modal with direct API requests without a valid `safety_override: true` and `safety_override_reason` is rejected with `HTTP 422 Unprocessable Entity` (`rule_id: "ALLERGY_RULE"` or `rule_id: "SEVERE_DDI_RULE"`).
   - Approved overrides are permanently stamped into clinical notes: `[CLINICIAN OVERRIDE: ...]`.
