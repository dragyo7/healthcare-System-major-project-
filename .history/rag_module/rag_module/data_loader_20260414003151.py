"""
Healthcare RAG Module - Data Loader

Task:
- Load MedQuAD dataset (XML)
- Extract question-answer pairs
- Load MedlinePlus data (text or scraped)
- Clean HTML using BeautifulSoup
- Normalize text

Output:
{
  "text": "...",
  "source": "medquad" or "medlineplus"
}

Save to:
data/clean_corpus.json

Constraints:
- Handle large data
- Skip invalid entries
- Efficient processing
"""

import os
import json
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from tqdm import tqdm

DATA_DIR = "data/medquad"
OUTPUT_FILE = "data/clean_corpus.json"


def clean_text(text):
    if not text:
        return ""

    # Remove HTML tags
    text = BeautifulSoup(text, "lxml").get_text()

    # Normalize whitespace
    text = " ".join(text.split())

    return text.lower()


def parse_medquad():
    corpus = []

    for folder in os.listdir(DATA_DIR):
        folder_path = os.path.join(DATA_DIR, folder)

        if not os.path.isdir(folder_path):
            continue

        for file in os.listdir(folder_path):
            if not file.endswith(".xml"):
                continue

            file_path = os.path.join(folder_path, file)

            try:
                tree = ET.parse(file_path)
                root = tree.getroot()

                for qa in root.findall(".//QAPair"):
                    question = qa.findtext("Question")
                    answer = qa.findtext("Answer")

                    if not question or not answer:
                        continue

                    text = clean_text(question + " " + answer)

                    corpus.append({
                        "text": text,
                        "source": "medquad"
                    })

            except Exception as e:
                print(f"Error parsing {file_path}: {e}")

    return corpus


def save_corpus(corpus):
    os.makedirs("data", exist_ok=True)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(corpus, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    print("Parsing MedQuAD dataset...")
    data = parse_medquad()

    print(f"Total records: {len(data)}")

    save_corpus(data)

    print(f"Saved to {OUTPUT_FILE}")