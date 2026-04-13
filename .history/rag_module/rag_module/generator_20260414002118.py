"""
Healthcare RAG Module - Generator

Task:
- Load small HuggingFace model (TinyLlama)
- Use retrieved context to answer

Rules:
- Only use context
- If unsure:
  "I am not fully confident. Please consult a qualified doctor."
"""
