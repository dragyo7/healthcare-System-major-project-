"""
Modular LLM Generation Layer.
Provides clean system/evidence/user prompt boundaries, lazy model loading,
and fallback capabilities for medical answer generation.
"""
from typing import Optional, Dict, Any
from rag_module.config.rag_config import DEFAULT_CONFIG


class MedicalGenerator:
    """
    Modular Generator supporting local transformers and mock inference for testing.
    """
    _instance: Optional["MedicalGenerator"] = None
    _model = None
    _tokenizer = None
    _device = None

    def __init__(
        self,
        model_name: str = DEFAULT_CONFIG.GENERATOR_MODEL_NAME,
        max_new_tokens: int = DEFAULT_CONFIG.MAX_NEW_TOKENS,
        temperature: float = DEFAULT_CONFIG.TEMPERATURE,
        top_p: float = DEFAULT_CONFIG.TOP_P,
        repetition_penalty: float = DEFAULT_CONFIG.REPETITION_PENALTY
    ):
        self.model_name = model_name
        self.max_new_tokens = max_new_tokens
        self.temperature = temperature
        self.top_p = top_p
        self.repetition_penalty = repetition_penalty

    @classmethod
    def get_instance(cls) -> "MedicalGenerator":
        """Singleton accessor."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _lazy_load_model(self):
        """Loads TinyLlama model and tokenizer on first generation request."""
        if self._model is None:
            import torch
            from transformers import AutoTokenizer, AutoModelForCausalLM
            
            print(f"Loading Generation Model: {self.model_name}...")
            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self._model = AutoModelForCausalLM.from_pretrained(self.model_name)
            self._device = "cuda" if torch.cuda.is_available() else "cpu"
            self._model.to(self._device)
            self._model.eval()

    def generate(
        self,
        query: str,
        context: str,
        system_prompt: Optional[str] = None
    ) -> str:
        """
        Generates a concise, evidence-grounded medical answer using retrieved context.
        """
        if not context or context.startswith("No relevant medical context"):
            return "I am not able to find sufficient verified medical evidence to answer this question. Please consult a qualified doctor."

        self._lazy_load_model()
        import torch

        default_system_prompt = (
            "You are an authoritative, evidence-grounded medical AI assistant.\n\n"
            "STRICT CLINICAL RULES:\n"
            "1. Answer the question using ONLY the factual medical evidence provided in <evidence_passages>.\n"
            "2. Never extrapolate, speculate, or introduce unverified medical claims.\n"
            "3. If the evidence does not directly answer the question, state: 'The provided medical evidence does not contain sufficient details to answer this question.'\n"
            "4. Summarize clearly, concisely, and use professional clinical terminology.\n"
            "5. Maximum 3 to 4 sentences."
        )

        sys_prompt = system_prompt or default_system_prompt

        user_content = (
            f"<evidence_passages>\n{context}\n</evidence_passages>\n\n"
            f"<patient_question>\n{query}\n</patient_question>\n\n"
            f"Please provide a clear, concise, evidence-grounded medical summary answering the patient question."
        )

        messages = [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_content}
        ]

        prompt = self._tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )

        inputs = self._tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=2048
        )
        inputs = {k: v.to(self._device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self._model.generate(
                **inputs,
                max_new_tokens=self.max_new_tokens,
                do_sample=(self.temperature > 0),
                temperature=self.temperature,
                top_p=self.top_p,
                repetition_penalty=self.repetition_penalty,
                pad_token_id=self._tokenizer.eos_token_id
            )

        generated_tokens = outputs[0][inputs["input_ids"].shape[1]:]
        answer = self._tokenizer.decode(
            generated_tokens,
            skip_special_tokens=True
        ).strip()

        return answer


class MockGenerator(MedicalGenerator):
    """
    Lightweight deterministic generator for testing and CI/CD pipelines.
    """
    def generate(self, query: str, context: str, system_prompt: Optional[str] = None) -> str:
        if not context or context.startswith("No relevant"):
            return "I am not able to find sufficient verified medical evidence to answer this question."
        return f"Based on the verified medical reference: {context[:150]}..."
