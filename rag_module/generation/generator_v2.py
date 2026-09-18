"""
Modular LLM Generation Layer.
Provides clean system/evidence/user prompt boundaries, lazy model loading,
and fallback capabilities for medical answer generation.
"""
import re
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

    @classmethod
    def clean_generation_output(cls, text: str, context: str) -> str:
        """
        Cleans conversational filler, formatting artifacts, and resolves leading anaphoric
        pronouns to the verified primary clinical entity from accepted context passages.
        Preserves all clinical facts, numeric values, units, and qualifiers unchanged.
        """
        if not text or not text.strip():
            return ""

        cleaned = text.strip()

        # 1. Clean conversational filler, affirmations, list numbers, and boilerplate
        filler_patterns = [
            r"^(?:Sure!|Certainly!|Yes,\s*|No,\s*|Here (?:is|are)[^:\n]*:?|Based on the provided (?:passages|evidence)[^:\n]*:?|The passage states that\s*)\s*",
            r"^(?:\d+\.\s*|\*\s*|- \s*)",
        ]
        for pat in filler_patterns:
            cleaned = re.sub(pat, "", cleaned, flags=re.IGNORECASE).strip()

        # 2. Extract primary entity from context Doc 1 header if present
        primary_entity = None
        if context:
            doc1_match = re.search(r"\[Doc 1:\s*([^:|\]]+)", context)
            if doc1_match:
                raw_title = doc1_match.group(1).strip()
                cleaned_entity = re.sub(
                    r"\s+(?:Oral|Tablet|Capsule|Injection|Solution|Topical|Suspension|Syrup|Inhaler|Cream|Ointment|Patch|Uses|Side Effects|Interactions|Warnings|Dosage|Dosing|Boxed Warning).*$",
                    "",
                    raw_title,
                    flags=re.IGNORECASE
                ).strip()
                if cleaned_entity and len(cleaned_entity) <= 50:
                    primary_entity = cleaned_entity

        # 3. Dynamic anaphora resolution for leading pronouns
        if primary_entity:
            verbs = (
                r"(?:is|are|was|were|works|acts|lowers|reduces|decreases|increases|inhibits|"
                r"blocks|treats|prevents|helps|causes|has|have|can|may|should|must|will|does|did|"
                r"cannot|improves|binds|contains|provides|functions|requires|stimulates|produces)"
            )
            anaphora_pattern = rf"^(?:It|This|The drug|This drug|The medication|This medication)\s+({verbs})\b"
            cleaned = re.sub(anaphora_pattern, rf"{primary_entity} \1", cleaned, flags=re.IGNORECASE)

            def replace_sent_pronoun(m):
                sep = m.group(1)
                verb = m.group(2)
                return f"{sep}{primary_entity} {verb}"

            cleaned = re.sub(
                rf"(\.\s+)(?:It|This|The drug|This drug|The medication|This medication)\s+({verbs})\b",
                replace_sent_pronoun,
                cleaned,
                flags=re.IGNORECASE
            )

        return cleaned

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
            "2. Always repeat the specific medication or medical condition name (e.g. 'Lisinopril', 'Metformin'); NEVER use ambiguous pronouns such as 'It' or 'This drug'.\n"
            "3. Do not include conversational filler (such as 'Sure!', 'Certainly!', or 'Here is...').\n"
            "4. Do not output numbered lists or fragments; output concise, complete factual sentences.\n"
            "5. Preserve numerical values, units, and qualifiers exactly as stated in the evidence.\n"
            "6. Never extrapolate, speculate, or introduce unverified medical claims.\n"
            "7. If the evidence does not directly answer the question, state: 'The provided medical evidence does not contain sufficient details to answer this question.'\n"
            "8. Maximum 2 to 3 sentences."
        )

        sys_prompt = system_prompt or default_system_prompt

        user_content = (
            f"<evidence_passages>\n{context}\n</evidence_passages>\n\n"
            f"<patient_question>\n{query}\n</patient_question>\n\n"
            f"Please provide a clear, concise, evidence-grounded medical summary answering the patient question.\n"
            f"Explicitly name the subject medication or condition in each sentence instead of using pronouns. Do not use conversational filler."
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
        raw_answer = self._tokenizer.decode(
            generated_tokens,
            skip_special_tokens=True
        ).strip()

        # Apply deterministic output cleaning and dynamic anaphora resolution
        answer = self.clean_generation_output(raw_answer, context)

        return answer


class MockGenerator(MedicalGenerator):
    """
    Lightweight deterministic generator for testing and CI/CD pipelines.
    """
    def generate(self, query: str, context: str, system_prompt: Optional[str] = None) -> str:
        if not context or context.startswith("No relevant"):
            return "I am not able to find sufficient verified medical evidence to answer this question."
        lines = [
            line.strip() for line in context.split("\n")
            if line.strip() and not line.strip().startswith("[") and not line.strip().startswith("---")
        ]
        if lines:
            raw = lines[0]
        else:
            raw = f"Based on the verified medical reference: {context[:150]}..."
        return self.clean_generation_output(raw, context)
