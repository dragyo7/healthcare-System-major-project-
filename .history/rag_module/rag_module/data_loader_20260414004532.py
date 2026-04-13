# Implement full MedQuAD loader based on above requirements.
# Use:
# - os for directory traversal
# - xml.etree.ElementTree for XML parsing
# - BeautifulSoup for cleaning HTML
# - json for saving output
#
# Steps:
# 1. Define clean_text(text):
#    - remove HTML using BeautifulSoup
#    - normalize whitespace
#    - convert to lowercase
#
# 2. Define load_medquad():
#    - iterate through all folders inside data/medquad/
#    - iterate through all XML files
#    - parse XML safely
#    - extract Question and Answer from QAPair
#    - combine them into one cleaned string
#    - append to list in required format
#
# 3. Add main execution block:
#    - call load_medquad()
#    - save output to data/clean_corpus.json
#    - print total records
#
# Ensure:
# - skip invalid entries
# - handle exceptions
# - efficient looping

def clean_text(text):
    from bs4 import BeautifulSoup
    import re

    # Remove HTML tags
    soup = BeautifulSoup(text, "html.parser")
    cleaned = soup.get_text()

    # Normalize whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    # Convert to lowercase
    cleaned = cleaned.lower()

    return cleaned  

if __name__ == "__main__":
    import os
    import json
    import xml.etree.ElementTree as ET

    def load_medquad():
        data_dir = "data/medquad/"
        records = []

        for root, dirs, files in os.walk(data_dir):
            for file in files:
                if file.endswith(".xml"):
                    file_path = os.path.join(root, file)
                    try:
                        tree = ET.parse(file_path)
                        root_elem = tree.getroot()

                        for qapair in root_elem.findall(".//QAPair"):
                            question = qapair.find("Question")
                            answer = qapair.find("Answer")

                            if question is not None and answer is not None:
                                combined_text = f"Question: {question.text} Answer: {answer.text}"
                                cleaned_text = clean_text(combined_text)
                                records.append(cleaned_text)
                    except Exception as e:
                        print(f"Error processing {file_path}: {e}")

        return records

    cleaned_records = load_medquad()
    with open("data/clean_corpus.json", "w") as f:
        json.dump(cleaned_records, f, indent=2)

    print(f"Total records loaded: {len(cleaned_records)}")