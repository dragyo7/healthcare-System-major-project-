"""
Build embedding pipeline using SentenceTransformers and FAISS.

Steps:
- Load data from data/clean_corpus.json
- Chunk text into 200–400 words with 30-word overlap
- Use model: BAAI/bge-small-en
- Batch encode text
- Create FAISS index (IndexFlatL2)
- Store:
    index → data/faiss_index/index.bin
    metadata → data/faiss_index/meta.pkl

Functions:
- chunk_text(text)
- build_index()
- save_index()
- load_index()

Constraints:
- Memory efficient batching
- Avoid recomputing index if already exists
"""
import json
import os
import pickle
import faiss
import numpy as np
from tqdm import tqdm
from sentence_transformers import SentenceTransformer

def chunk_text(text, chunk_size=300, overlap=30):
    words = text.split()
    chunks = []

    for i in range(0, len(words), chunk_size - overlap):
        chunk = words[i:i + chunk_size]
        chunks.append(" ".join(chunk))

    return chunks
def build_index():
    # Load data
    with open("data/clean_corpus.json", "r", encoding="utf-8") as f:
        data = json.load(f)
        
        # TEMP: limit data for fast testing
        data = data[:5000]

    model = SentenceTransformer("BAAI/bge-small-en")

    all_chunks = []
    metadata = []

    print("Chunking data...")

    for record in tqdm(data):
        text = record["text"]
        source = record.get("source", "unknown")

        chunks = chunk_text(text)

        for chunk in chunks:
            all_chunks.append(chunk)
            metadata.append({
                "text": chunk,
                "source": source
            })

    print(f"Total chunks: {len(all_chunks)}")

    print("Encoding embeddings (batch)...")

    embeddings = model.encode(
        all_chunks,
        batch_size=32,
        show_progress_bar=True
    )

    embeddings = np.array(embeddings).astype("float32")

    print("Building FAISS index...")

    index = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(embeddings)

    return index, metadata

def save_index(index, metadata):
    os.makedirs("data/faiss_index", exist_ok=True)

    faiss.write_index(index, "data/faiss_index/index.bin")

    with open("data/faiss_index/meta.pkl", "wb") as f:
        pickle.dump(metadata, f)
        
def load_index():
    index = faiss.read_index("data/faiss_index/index.bin")

    with open("data/faiss_index/meta.pkl", "rb") as f:
        metadata = pickle.load(f)

    return index, metadata      

if __name__ == "__main__":
    index, metadata = build_index()
    save_index(index, metadata)

    print("FAISS index created successfully")