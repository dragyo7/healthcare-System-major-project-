"""
Implement functions for loading and preprocessing MedQuAD dataset.

Requirements:
- Traverse all folders inside data/medquad/
- Each folder contains XML files
- Parse XML using xml.etree.ElementTree
- Extract <Question> and <Answer> from each <QAPair>
- Combine question + answer into one string
- Clean text using BeautifulSoup (remove HTML)
- Normalize text (lowercase, remove extra spaces)

Output format:
{
  "text": "...",
  "source": "medquad"
}

Also:
- Skip invalid or empty entries
- Handle parsing errors safely
- Efficient looping through files

Implement:
- load_medquad()
- clean_text(text)
"""
  