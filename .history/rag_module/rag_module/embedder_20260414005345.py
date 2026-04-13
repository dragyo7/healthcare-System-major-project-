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


def chunk_text(text, chunk_size=300, overlap=30):
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = ' '.join(words[i:i + chunk_size])
        chunks.append(chunk)
    return chunks

def build_index():
    # Load data
    with open("data/clean_corpus.json", "r") as f:
        data = json.load(f)

    # Initialize model
    model = SentenceTransformer("BAAI/bge-small-en")

    # Prepare lists for embeddings and metadata
    embeddings = []
    metadata = []

    # Process each record
    for record in tqdm(data, desc="Processing records"):
        text = record["text"]
        chunks = chunk_text(text)

        for chunk in chunks:
            embedding = model.encode(chunk)
            embeddings.append(embedding)
            metadata.append({"text": chunk})

    # Convert to numpy array
    embeddings = np.array(embeddings).astype('float32')

    # Create FAISS index
    index = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(embeddings)

    return index, metadata