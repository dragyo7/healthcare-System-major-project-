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
Context:
{context}

Question:
{query}

Give a short medical answer (1-3 sentences).
Use only the context.

Answer:
"""

    inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)

    with torch.no_grad():
        outputs = model.generate(
    **inputs,
    max_new_tokens=80,
    do_sample=False,
    eos_token_id=tokenizer.eos_token_id,
)

    response = tokenizer.decode(outputs[0], skip_special_tokens=True)

    # Extract only answer part
    if "Answer:" in response:
      answer = response.split("Answer:")[-1].strip()
    else:
      answer = response.strip()

    # remove prompt leakage
    answer = answer.replace("You are a medical assistant.", "").strip()

    # remove extra lines if model adds more
    answer = answer.split("\n")[0]

    return answer


if __name__ == "__main__":
    context = "diabetes is a chronic disease affecting blood sugar levels."
    query = "What is diabetes?"

    answer = generate_answer(query, context)

    print("\nGenerated Answer:")
    print(answer)
    
    