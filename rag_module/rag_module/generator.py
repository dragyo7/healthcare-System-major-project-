import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

MODEL_NAME = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"

print("Loading TinyLlama...")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)

device = "cuda" if torch.cuda.is_available() else "cpu"

model.to(device)
model.eval()


def generate_answer(query, context):

    messages = [
        {
            "role": "system",
            "content":
            """
You are a medical AI assistant.

Rules:

1. Answer ONLY using the provided medical context.

2. Never invent medical information.

3. Summarize naturally.

4. Use complete sentences.

5. Maximum 4 sentences.

6. If context is insufficient say:

'I am not fully confident. Please consult a qualified doctor.'
"""
        },
        {
            "role":"user",
            "content":f"""
Medical Context:

{context}

Question:

{query}
"""
        }
    ]

    prompt = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )

    inputs = tokenizer(
        prompt,
        return_tensors="pt",
        truncation=True,
        max_length=2048
    )

    inputs = {k:v.to(device) for k,v in inputs.items()}

    with torch.no_grad():

        outputs = model.generate(
            **inputs,
            max_new_tokens=180,
            do_sample=True,
            temperature=0.3,
            top_p=0.9,
            repetition_penalty=1.15,
            pad_token_id=tokenizer.eos_token_id
        )

    generated = outputs[0][inputs["input_ids"].shape[1]:]

    answer = tokenizer.decode(
        generated,
        skip_special_tokens=True
    ).strip()

    return answer