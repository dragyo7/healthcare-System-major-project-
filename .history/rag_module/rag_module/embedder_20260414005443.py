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
from tqdm import tqdm
from sentence_transformers import SentenceTransformer

def build_index():
    # Load data
    with open("data/clean_corpus.json", "r", encoding="utf-8") as f:
        data = json.load(f)

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