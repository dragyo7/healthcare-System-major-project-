"""
Healthcare RAG Module - Embedding + FAISS

Task:
- Load clean_corpus.json
- Chunk text (200–400 words, overlap)
- Use SentenceTransformers (BAAI/bge-small-en)
- Create FAISS index
- Save index + metadata

Functions:
- build_index()
- save_index()
- load_index()
"""
