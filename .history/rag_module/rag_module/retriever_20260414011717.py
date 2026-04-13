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

# Load model ONCE
model = SentenceTransformer("BAAI/bge-small-en")


def load_index():
    index = faiss.read_index("data/faiss_index/index.bin")

    with open("data/faiss_index/meta.pkl", "rb") as f:
        metadata = pickle.load(f)

    return index, metadata


def retrieve(query, k=3):
    index, metadata = load_index()

    # Encode query
    query_embedding = model.encode([query])
    query_embedding = np.array(query_embedding).astype("float32")

    # Search
    distances, indices = index.search(query_embedding, k)

    results = []
    sources = []

    for i, idx in enumerate(indices[0]):
        if idx < len(metadata):
            # OPTIONAL: filter (lower distance = better)
            if distances[0][i] < 1.5:  # tune later
                results.append(metadata[idx]["text"])
                sources.append(metadata[idx]["source"])

    return results, sources


if __name__ == "__main__":
    results, sources = retrieve("What is diabetes?")

    for i, res in enumerate(results):
        print(f"\nResult {i+1}:")
        print(res[:300])
        print("Source:", sources[i])