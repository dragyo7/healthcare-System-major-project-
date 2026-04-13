"""
Implement retrieval using FAISS.

Steps:
- Load FAISS index and metadata
- Encode query using same embedding model
- Retrieve top-k results (k=3–5)
- Filter using similarity threshold
- Return:
    - relevant text chunks
    - source list

Function:
- retrieve(query: str)

Constraints:
- Fast retrieval
- Deterministic output
"""

import faiss
import pickle
import numpy as np
from sentence_transformers import SentenceTransformer

def load_index():
    # Load FAISS index
    index = faiss.read_index("faiss_index.bin")
    
    # Load metadata (mapping from index to source)
    with open("metadata.pkl", "rb") as f:
        metadata = pickle.load(f)
    
    return index, metadata

def load_index():
    # Load FAISS index
    index = faiss.read_index("faiss_index.bin")
    
    # Load metadata (mapping from index to source)
    with open("metadata.pkl", "rb") as f:
        metadata = pickle.load(f)
    
    return index, metadata
