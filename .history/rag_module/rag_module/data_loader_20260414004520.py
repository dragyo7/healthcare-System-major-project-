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