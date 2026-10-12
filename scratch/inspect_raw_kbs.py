import json
import os

files = [
    'data/knowledge_bases/dailymed/dailymed_essential_spl.json',
    'data/knowledge_bases/icmr/icmr_guidelines.json',
    'data/knowledge_bases/medlineplus/medlineplus_topics.json',
    'data/knowledge_bases/mohfw_stg/mohfw_stgs.json',
    'data/knowledge_bases/rxnorm/rxnorm_prescribable.json',
    'rag_module/data/dailymed_raw.json',
    'rag_module/data/dailymed_pilot_raw.json'
]

for fp in files:
    if os.path.exists(fp):
        with open(fp, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f'=== {fp} ===')
        if isinstance(data, list):
            print(f'Type: List of {len(data)} items')
            if data and isinstance(data[0], dict):
                print(f'Keys of item 0: {list(data[0].keys())}')
                print(f'Sample title/name: {data[0].get("title") or data[0].get("name") or data[0].get("drug_name")}')
        elif isinstance(data, dict):
            print(f'Type: Dict with {len(data)} keys: {list(data.keys())[:5]}')
            for k in list(data.keys())[:3]:
                val = data[k]
                if isinstance(val, list):
                    print(f'  key "{k}": list of {len(val)} items')
                elif isinstance(val, dict):
                    print(f'  key "{k}": dict of {len(val)} entries')
