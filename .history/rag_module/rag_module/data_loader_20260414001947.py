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

def load_medquad()