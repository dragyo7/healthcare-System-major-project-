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