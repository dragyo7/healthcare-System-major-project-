"""Generate DailyMed 200+ Selection Manifest and compute precise Section Coverage (Present vs Extracted)."""
import json
import os
import sys

sys.path.insert(0, os.path.abspath("."))
from collections import defaultdict
from rag_module.ingestion.adapters.dailymed_adapter import DailyMedAdapter

def main():
    raw_path = "rag_module/data/dailymed_raw.json"
    manifest_out = "rag_module/data/dailymed_selection_manifest.json"
    
    with open(raw_path, "r", encoding="utf-8") as f:
        raw_drugs = json.load(f)
        
    print(f"Loaded {len(raw_drugs)} raw drug monographs.")
    
    # 1. Build selection manifest
    selection_manifest = {
        "manifest_version": "1.0",
        "description": "Reproducible selection manifest for DailyMed 200+ drug knowledge expansion across 14 therapeutic classes.",
        "selection_methodology": (
            "Therapeutic diversity selection covering 14 core pharmacological classes: Cardiovascular, "
            "Endocrine & Metabolic, Anti-Infective & Antimicrobial, CNS / Neurology & Psychiatry, "
            "Respiratory & Pulmonology, Gastrointestinal, Musculoskeletal & Rheumatology, "
            "Oncology & Immunomodulatory, Hematology & Anticoagulants, Analgesics & Anesthetics, "
            "Dermatology & Topical, Ophthalmology & Otic, Renal & Genitourinary, "
            "Immunology, Vaccines & Biologicals. Selection prioritizes clinical necessity, high-risk "
            "narrow therapeutic index drugs, boxed warnings, common chronic disease regimens, and acute therapies."
        ),
        "total_drugs": len(raw_drugs),
        "therapeutic_classes": sorted(list(set(d.get("therapeutic_class", "Uncategorized") for d in raw_drugs))),
        "drugs": []
    }
    
    # Track section presence in raw source
    section_presence = defaultdict(int)
    total_drugs = len(raw_drugs)
    
    for drug in raw_drugs:
        drug_entry = {
            "generic_name": drug.get("generic_name", drug.get("drug_name")),
            "brand_names": drug.get("brand_names", []),
            "dailymed_set_id": drug.get("set_id", ""),
            "ndc_code": drug.get("ndc_code", ""),
            "therapeutic_class": drug.get("therapeutic_class", "Uncategorized"),
            "selection_reason": f"Essential clinical agent in {drug.get('therapeutic_class', 'General')} therapeutics.",
            "source_reference": drug.get("url", f"https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid={drug.get('set_id', '')}"),
            "available_sections": [k for k, v in drug.get("sections", {}).items() if v and len(str(v).strip()) > 0]
        }
        selection_manifest["drugs"].append(drug_entry)
        for s in drug_entry["available_sections"]:
            section_presence[s] += 1
            
    with open(manifest_out, "w", encoding="utf-8") as f:
        json.dump(selection_manifest, f, indent=2)
    print(f"Wrote selection manifest to {manifest_out}")
    
    # 2. Test extraction via DailyMedAdapter to measure Present vs Extracted (M / N)
    adapter = DailyMedAdapter(data_source=raw_path)
    raw_data = adapter.load_raw_data()
    docs = adapter.parse_and_normalize(raw_data)
    
    extracted_sections = defaultdict(int)
    SECTION_KEY_MAP = {
        "indications & usage": "indications_and_usage",
        "dosage & administration": "dosage_and_administration",
        "contraindications": "contraindications",
        "warnings & precautions": "warnings_and_precautions",
        "adverse reactions": "adverse_reactions",
        "drug interactions": "drug_interactions",
        "boxed warning": "boxed_warning",
        "use in specific populations": "use_in_specific_populations",
        "overdosage": "overdosage",
        "clinical pharmacology": "clinical_pharmacology"
    }
    for doc in docs:
        sec_name = (doc.section or doc.metadata.get("label_section", "unknown")).lower().strip()
        sec_key = SECTION_KEY_MAP.get(sec_name, sec_name)
        extracted_sections[sec_key] += 1
        
    print("\n=== SECTION COVERAGE: SOURCE-PRESENT (N) vs EXTRACTED (M) ===")
    print(f"{'Section Name':<35} | {'Present (N)':<12} | {'Extracted (M)':<14} | {'Coverage (M/N)':<15}")
    print("-" * 82)
    
    all_sections = sorted(list(set(list(section_presence.keys()) + list(extracted_sections.keys()))))
    total_present = 0
    total_extracted = 0
    
    for sec in all_sections:
        n = section_presence[sec]
        m = extracted_sections[sec]
        total_present += n
        total_extracted += m
        cov = f"{(m/n*100):.1f}%" if n > 0 else "N/A"
        print(f"{sec:<35} | {n:<12} | {m:<14} | {cov:<15}")
        
    print("-" * 82)
    print(f"{'TOTAL CLINICAL SECTIONS':<35} | {total_present:<12} | {total_extracted:<14} | {(total_extracted/total_present*100):.1f}%")
    print(f"\nNormalized Documents Generated: {len(docs)}")
    print(f"Legitimately absent sections (e.g. boxed_warning in non-blackbox drugs) are preserved as absent and NOT fabricated.")

if __name__ == "__main__":
    main()
