"""
Phase 24 Source & Data Structure Inspection Script
Analyzes current data layout, authentic document inventories, and potential chunk yield.
"""
import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

def inspect_sources():
    print("=== INSPECTING CURRENT DATA REPOSITORIES ===")
    
    # 1. DailyMed Raw
    dailymed_raw_path = ROOT_DIR / "rag_module" / "data" / "dailymed_raw.json"
    if dailymed_raw_path.exists():
        with open(dailymed_raw_path, "r", encoding="utf-8") as f:
            dm_raw = json.load(f)
        total_dm_drugs = len(dm_raw)
        total_dm_sections = sum(len(d.get("sections", {})) for d in dm_raw)
        print(f"DailyMed Raw: {total_dm_drugs} drug monographs, {total_dm_sections} total clinical sections.")
    
    # 2. Knowledge Bases Directory
    kb_dir = ROOT_DIR / "data" / "knowledge_bases"
    for kb_sub in kb_dir.iterdir():
        if kb_sub.is_dir():
            files = list(kb_sub.glob("*.json"))
            for f in files:
                with open(f, "r", encoding="utf-8") as fp:
                    try:
                        data = json.load(fp)
                        count = len(data) if isinstance(data, list) else len(data.keys())
                        print(f"KB [{kb_sub.name}] File {f.name}: {count} records, {round(f.stat().st_size/1024, 2)} KB")
                    except Exception as e:
                        print(f"KB [{kb_sub.name}] File {f.name}: Error reading: {e}")

if __name__ == "__main__":
    inspect_sources()
