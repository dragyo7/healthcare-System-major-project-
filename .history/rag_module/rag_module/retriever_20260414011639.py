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

def retrieve(query, k=3):
    # Load index and metadata
    index, metadata = load_index()
    
    # Encode query using the same embedding model
    model = SentenceTransformer('all-MiniLM-L6-v2')
    query_embedding = model.encode([query])
    
    # Retrieve top-k results
    D, I = index.search(np.array(query_embedding).astype('float32'), k)
    
    # Filter results using similarity threshold (e.g., 0.5)
    threshold = 0.5
    relevant_chunks = []
    sources = []
    
    for i in range(k):
        if D[0][i] >= threshold:
            relevant_chunks.append(metadata[I[0][i]]['text'])
            sources.append(metadata[I[0][i]]['source'])
    
    return relevant_chunks, sources

if __name__ == "__main__":
    results, sources = retrieve("What is diabetes?")

    for i, res in enumerate(results):
        print(f"\nResult {i+1}:")
        print(res[:300])
        print("Source:", sources[i])