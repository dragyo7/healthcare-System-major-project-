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
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

model_name = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"

tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(model_name)

def generate_answer(query, context):
    prompt = f"""
You are a medical assistant.

Use ONLY the provided context to answer.

Context:
{context}

Question:
{query}

Rules:
- Do not guess
- If unsure say: "I am not fully confident. Please consult a qualified doctor."
- Keep answer short and clear
- Do not give diagnosis or dosage

Answer:
"""

    inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=120,
            do_sample=False  # deterministic (important)
        )

    response = tokenizer.decode(outputs[0], skip_special_tokens=True)

    # Extract only answer part
    answer = response.split("Answer:")[-1].strip()

    return answer 


if __name__ == "__main__":
    context = "diabetes is a chronic disease affecting blood sugar levels."
    query = "What is diabetes?"

    answer = generate_answer(query, context)

    print("\nGenerated Answer:")
    print(answer)
    
    