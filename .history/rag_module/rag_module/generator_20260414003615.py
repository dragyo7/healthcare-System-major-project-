"""
Generate medical response using retrieved context.

Steps:
- Load HuggingFace model (TinyLlama or Gemma)
- Create prompt:

Context:
{context}

Question:
{query}

Instructions:
- Use ONLY context
- Do NOT guess
- If insufficient:
  "I am not fully confident. Please consult a qualified doctor."

Safety:
- No diagnosis
- No dosage unless explicitly in context

Function:
- generate_answer(query, context)
"""