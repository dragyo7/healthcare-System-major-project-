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

Answer ONLY using the given context.
Do NOT add any external knowledge.

Context:
{context}

Question:
{query}

Instructions:
- Answer in 1-2 sentences only
- Use ONLY the context
- Do NOT add extra information
- If answer is not clearly in context, say:
  "I am not fully confident. Please consult a qualified doctor."

Answer:
"""

    inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)

    with torch.no_grad():
        outputs = model.generate(
        **inputs,
        max_new_tokens=80,
        do_sample=False
)

    response = tokenizer.decode(outputs[0], skip_special_tokens=True)

    # Extract only answer part
    answer = response.split("Answer:")[-1].strip()

# remove extra lines if model adds more
    answer = answer.split("\n")[0]

    return answer


if __name__ == "__main__":
    context = "diabetes is a chronic disease affecting blood sugar levels."
    query = "What is diabetes?"

    answer = generate_answer(query, context)

    print("\nGenerated Answer:")
    print(answer)
    
    