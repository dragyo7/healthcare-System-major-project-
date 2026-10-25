"""
CDS Gateway Orchestrator: Central Coordination Service.
Coordinates the frozen RAG pipeline, deterministic drug interaction engine,
and request-scoped clinical context.
Fail-closed, strictly stateless, with zero patient vector storage in the global corpus.
"""
import logging
import re
from typing import Optional, List, Dict, Any, Union

from cds_module.models import (
    CDSEvaluateRequest,
    CDSEvaluateResponse,
    CDSCitation,
    DrugInteractionAlert,
    PatientContext,
    PrescriptionScreenRequest,
    PrescriptionScreenResponse
)

logger = logging.getLogger("cds_module.orchestrator")


class CDSOrchestrator:
    """
    Stateless clinical decision support coordinator.
    Delegates medical knowledge retrieval to MedicalRAGPipeline and drug safety
    to deterministic DrugBank rule engines.
    """

    def __init__(self, rag_pipeline=None, interaction_dict: Optional[Dict[Any, Any]] = None):
        self._rag_pipeline = rag_pipeline
        self._interaction_dict = interaction_dict

    @property
    def rag_pipeline(self):
        if self._rag_pipeline is None:
            from rag_module.api import get_legacy_pipeline
            self._rag_pipeline = get_legacy_pipeline()
        return self._rag_pipeline

    @property
    def interaction_dict(self):
        if self._interaction_dict is None:
            from drug_module.data_loader import load_drugbank
            self._interaction_dict = load_drugbank()
        return self._interaction_dict

    def _extract_drugs_from_request(self, request: CDSEvaluateRequest) -> List[str]:
        """
        Extracts medication names from candidate list, request-scoped patient context,
        and known clinical entities mentioned in the query.
        """
        drugs: List[str] = []

        # 1. Explicit candidate medications
        for cand in request.candidate_medications:
            if cand and str(cand).strip():
                drugs.append(str(cand).strip())

        # 2. Active medications from patient context
        if request.patient_context and request.patient_context.active_medications:
            for med in request.patient_context.active_medications:
                if isinstance(med, str):
                    name = med.strip()
                    if name and name not in drugs:
                        drugs.append(name)
                elif isinstance(med, dict):
                    name = med.get("name") or med.get("medicine_name") or med.get("drug")
                    if name and str(name).strip() and str(name).strip() not in drugs:
                        drugs.append(str(name).strip())

        # 3. Known drugs in the deterministic rules mentioned in the clinical query
        if request.clinical_query and self.interaction_dict:
            for known_drug in self.interaction_dict.keys():
                pattern = r'\b' + re.escape(str(known_drug)) + r'\b'
                if re.search(pattern, request.clinical_query, re.IGNORECASE):
                    if not any(d.lower() == str(known_drug).lower() for d in drugs):
                        drugs.append(str(known_drug).capitalize())

        return drugs

    def _resolve_conversational_references(
        self,
        query_text: str,
        conversation_history: List[Dict[str, str]],
        patient_context: Optional[PatientContext]
    ) -> str:
        """
        Resolves conversational pronouns and anaphora ('it', 'its', 'this drug', 'the medication', etc.)
        using previous turns and patient context, producing a self-contained query for RAG retrieval.
        Bounded to the most recent 4 turns to prevent context drift.
        """
        if not conversation_history:
            return query_text

        q_lower = query_text.lower().strip()

        # Pronoun or anaphoric reference indicators
        reference_patterns = [
            r"\b(?:it|its|this|that|these|the)\s+(?:drug|med|medication|pill|tablet|medicine|treatment)\b",
            r"\b(?:its|their)\s+(?:dosage|dose|side\s+effects?|uses?|indications?|contraindications?|interactions?|mechanism|benefits?)\b",
            r"\bwhat\s+(?:is|are)\s+(?:its|the)\s+(?:dosage|dose|side\s+effects?|uses?|indications?|contraindications?|interactions?)\b",
            r"\bcan\s+(?:i|patient|he|she)\s+take\s+(?:it|this)\b",
            r"\bhow\s+to\s+take\s+(?:it|this)\b",
            r"\b(?:is|are)\s+(?:it|this)\s+safe\b",
            r"\b(?:the\s+)?(?:second|first|other|latter|former)\s+(?:drug|med|medication|pill|tablet|medicine)\b",
            r"\b(?:summarize|summarise)\s+(?:the|those|these)\s+instructions\b",
            r"\b(?:इसके|इसकी|इस दवा|उस दवा|त्याचे|ह्या औषधाचे|તેના|આ દવાની)\b"
        ]

        has_reference = any(re.search(pat, q_lower) for pat in reference_patterns)
        if not has_reference:
            return query_text

        antecedent_drug = None

        # Look in prior turns in reverse order
        from multilingual_module.canonicalizer import CORPUS_DRUGS
        for turn in reversed(conversation_history[-4:]):
            content = turn.get("content") or turn.get("text") or ""
            if not content:
                continue

            matches = []
            for drug_name in CORPUS_DRUGS:
                if len(drug_name) >= 4:
                    for m in re.finditer(r"\b" + re.escape(drug_name) + r"\b", content, re.IGNORECASE):
                        matches.append((m.start(), drug_name.capitalize()))
            matches.sort(key=lambda x: x[0])
            ordered_drugs = []
            for _, d in matches:
                if d not in ordered_drugs:
                    ordered_drugs.append(d)

            is_second = bool(re.search(r"\b(?:second|latter)\b", q_lower))
            is_first = bool(re.search(r"\b(?:first|former)\b", q_lower))

            if is_second:
                if len(ordered_drugs) >= 2:
                    antecedent_drug = ordered_drugs[1]
                elif patient_context and patient_context.active_medications and len(patient_context.active_medications) >= 2:
                    sec_med = patient_context.active_medications[1]
                    antecedent_drug = sec_med if isinstance(sec_med, str) else (sec_med.get("medicine_name") or sec_med.get("name"))
                else:
                    # Do NOT silently fall back to first medicine when second is explicitly requested
                    antecedent_drug = None
                break
            elif is_first:
                if ordered_drugs:
                    antecedent_drug = ordered_drugs[0]
                elif patient_context and patient_context.active_medications:
                    first_med = patient_context.active_medications[0]
                    antecedent_drug = first_med if isinstance(first_med, str) else (first_med.get("medicine_name") or first_med.get("name"))
                break
            else:
                if ordered_drugs:
                    antecedent_drug = ordered_drugs[0]
                    break

            # Fallback to interaction dictionary ONLY if not explicitly requesting second drug
            if not is_second and self.interaction_dict:
                for drug_name in self.interaction_dict.keys():
                    if re.search(r"\b" + re.escape(str(drug_name)) + r"\b", content, re.IGNORECASE):
                        antecedent_drug = str(drug_name).capitalize()
                        break
            if antecedent_drug:
                break

        # If not found in history, check patient context active medications (if not requesting second drug with <2 meds)
        if not antecedent_drug and not is_second and patient_context and patient_context.active_medications:
            first_med = patient_context.active_medications[0]
            if isinstance(first_med, str):
                antecedent_drug = first_med.strip()
            elif isinstance(first_med, dict):
                antecedent_drug = first_med.get("medicine_name") or first_med.get("name")

        if antecedent_drug:
            # Reformulate cleanly
            reformulated = re.sub(
                r"\b(?:it|this drug|that drug|the drug|this medication|the medication|this medicine|the medicine)\b",
                antecedent_drug,
                query_text,
                flags=re.IGNORECASE
            )
            reformulated = re.sub(
                r"\b(?:the\s+)?(?:second|first|other|latter|former)\s+(?:drug|med|medication|pill|tablet|medicine)(?:\s+mentioned\s+above)?\b",
                antecedent_drug,
                reformulated,
                flags=re.IGNORECASE
            )
            reformulated = re.sub(r"\b(?:its|their)\b", f"{antecedent_drug}'s", reformulated, flags=re.IGNORECASE)
            reformulated = re.sub(r"\b(?:इसके|इसकी|इस दवा)\b", f"{antecedent_drug}", reformulated, flags=re.IGNORECASE)
            reformulated = re.sub(r"\b(?:त्याचे|ह्या औषधाचे)\b", f"{antecedent_drug}", reformulated, flags=re.IGNORECASE)
            reformulated = re.sub(r"\b(?:તેના|આ દવાની)\b", f"{antecedent_drug}", reformulated, flags=re.IGNORECASE)

            if antecedent_drug.lower() not in reformulated.lower():
                reformulated = f"{reformulated} for {antecedent_drug}"

            logger.info(f"Conversational reference resolved: '{query_text}' -> '{reformulated}'")
            return reformulated

        return query_text

    def _check_conversational_input(
        self,
        query_text: str,
        effective_lang: str,
        detected_lang: str,
        canon_info: Dict[str, Any],
        mode: str
    ) -> Optional[CDSEvaluateResponse]:
        """
        Detects pure social greetings and ordinary acknowledgements with zero clinical claims.
        Guarantees that pure conversational inputs receive warm, polite, and localized responses.
        Fails-closed (returns None) if any clinical, medication, symptom, or care inquiry terms are present.
        """
        clean_text = query_text.strip().lower()
        clean_text = re.sub(r'[\.\?!,;:\'\"~]+$', '', clean_text).strip()

        # Strict list of clinical or care terms. If ANY term is present, NOT a pure greeting.
        clinical_care_keywords = [
            "discharge", "instruction", "instructions", "medication", "medications", "medicine",
            "medicines", "pill", "pills", "tablet", "tablets", "drug", "drugs", "dose", "dosage",
            "timing", "schedule", "routine", "warning", "warnings", "emergency", "hospital", "clinic",
            "doctor", "physician", "appointment", "appointments", "follow-up", "followup", "test",
            "tests", "lab", "labs", "pain", "painkiller", "painkillers", "pressure", "hypertension",
            "heart", "chest", "sugar", "diabetes", "headache", "fever", "cough", "dizziness",
            "allergy", "allergies", "symptom", "symptoms", "diagnosis", "diagnoses", "condition",
            "take", "taking", "eat", "eating", "food", "water", "morning", "night", "evening",
            "amlodipine", "metformin", "lisinopril", "aspirin", "ibuprofen", "atorvastatin",
            "clarithromycin", "warfarin", "paracetamol",
            # Indic clinical markers
            "डिस्चार्ज", "निर्देश", "दवा", "दवाई", "दवाएं", "दवाओं", "खुराक", "डोस", "गोली", "गोलियां",
            "समय", "कब", "कैसे", "चेतावनी", "लक्षण", "आपातकाल", "आपातकालीन", "अस्पताल", "डॉक्टर",
            "अपॉइंटमेंट", "फॉलो-अप", "जांच", "टेस्ट", "दर्द", "रक्तचाप", "ब्लड प्रेशर", "बीपी",
            "दिल", "छाती", "शुगर", "मधुमेह", "चक्कर", "एलर्जी", "लेना", "खाना", "पानी", "सुबह", "शाम",
            "सूचना", "औषध", "औषधे", "गोळ्या", "डोस", "वेळ", "कधी", "कशी", "चेतावणी", "लक्षणे",
            "आणीबाणी", "रुग्णालय", "तपासणी", "वेदना", "रक्तदाब", "हृदय", "छातीत", "सकाळ", "संध्याकाळ",
            "ડિસ્ચાર્જ", "સૂચનાઓ", "દવા", "દવાઓ", "ગોળીઓ", "ડોઝ", "સમય", "ક્યારે", "કેવી રીતે",
            "ચેતવણી", "લક્ષણો", "કટોકટી", "હોસ્પિટલ", "દાક્તર", "એપોઇન્ટમેન્ટ", "ટેસ્ટ", "દુખાવો",
            "રક્તચાપ", "હાઈ બ્લડ પ્રેશર", "સવારે", "સાંજે"
        ]

        for kw in clinical_care_keywords:
            if kw in clean_text:
                return None

        greeting_patterns = [
            r"^(hello|hi|hey|greetings|howdy)(?:\s+(there|assistant|doctor|bot))?$",
            r"^(good\s+(morning|afternoon|evening|day))(?:\s+(there|assistant|doctor|bot))?$",
            r"^(नमस्ते|नमस्कार|हेलो|हाय|प्रणाम|शुभ\s+(प्रभात|दोपहर|संध्या))(?:\s+जी)?$",
            r"^(नमस्कार|हॅलो|हाय|शुभ\s+(प्रभात|सकाळ|संध्याकाळ))$",
            r"^(નમસ્તે|નમસ્કાર|કેમ\s+છો|હેલો|હાય|સુપ્રભાત)$"
        ]

        for pat in greeting_patterns:
            if re.match(pat, clean_text, re.IGNORECASE):
                from multilingual_module.safety_templates import get_conversational_greeting
                return CDSEvaluateResponse(
                    clinical_query=query_text,
                    answer=get_conversational_greeting(effective_lang),
                    verification_status="conversational_greeting",
                    is_grounded=True,
                    is_emergency=False,
                    abstained=False,
                    citations=[],
                    drug_interactions=[],
                    safety_alerts=[],
                    abstention_reason=None,
                    execution_mode=mode,
                    pipeline_mode="conversational_interaction",
                    language=effective_lang,
                    detected_language=detected_lang,
                    canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
                )

        ack_patterns = [
            r"^(thank\s*you|thanks|thanks\s+a\s+lot|thank\s+you\s+so\s+much|ok|okay|got\s+it|understood|fine|great|sure|all\s+right|alright|cool)$",
            r"^(धन्यवाद|शुक्रिया|बहुत\s+धन्यवाद|ठीक\s+है|समझ\s+गया|समझ\s+गई)$",
            r"^(धन्यवाद|आभार|खूप\s+धन्यवाद|ठीक\s+आहे|समजले)$",
            r"^(આભાર|ધન્યવાદ|ખૂબ\s+આભાર|ઠીક\s+છે|સમજાયું)$"
        ]

        for pat in ack_patterns:
            if re.match(pat, clean_text, re.IGNORECASE):
                from multilingual_module.safety_templates import get_conversational_acknowledgement
                return CDSEvaluateResponse(
                    clinical_query=query_text,
                    answer=get_conversational_acknowledgement(effective_lang),
                    verification_status="conversational_response",
                    is_grounded=True,
                    is_emergency=False,
                    abstained=False,
                    citations=[],
                    drug_interactions=[],
                    safety_alerts=[],
                    abstention_reason=None,
                    execution_mode=mode,
                    pipeline_mode="conversational_interaction",
                    language=effective_lang,
                    detected_language=detected_lang,
                    canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
                )

        return None

    def _resolve_discharge_care_query(
        self,
        query_text: str,
        patient_context: PatientContext,
        effective_lang: str,
        detected_lang: str,
        canon_info: Dict[str, Any],
        detected_interactions: List[DrugInteractionAlert],
        safety_alerts: List[str]
    ) -> Optional[CDSEvaluateResponse]:
        """
        Directly grounds patient post-discharge care questions in their authorized clinical records:
        1. Medication timing and administration schedule (no guessing or inventing timing)
        2. Recovery warning signs & emergency escalation (no fabricated specific symptoms)
        3. Follow-up appointments and lab test schedules (no fabricated clinics or lab orders)
        4. General discharge summary & care plan explanation (missing fields stated as Not documented)
        5. Drug interaction questions with active medications (educational guidance, ungrounded)
        6. Wound care and dietary directives (honest disclosure when unrecorded, no generic templates)
        """
        # Resolve discharge record provenance strictly
        has_discharge = False
        discharge_instructions = ""
        warning_signs = ""
        follow_up_instructions = ""
        follow_up_date = ""
        discharge_diagnosis = ""

        dr = getattr(patient_context, "discharge_record", None)
        if dr is not None:
            has_discharge = getattr(dr, "has_discharge", True)
            discharge_instructions = dr.discharge_instructions or ""
            warning_signs = dr.warning_signs or ""
            follow_up_instructions = dr.follow_up_instructions or ""
            follow_up_date = dr.follow_up_date or ""
            discharge_diagnosis = dr.discharge_diagnosis or ""
        else:
            dc = getattr(patient_context, "discharge_context", None)
            if isinstance(dc, dict):
                has_discharge = dc.get("has_discharge", True) if ("has_discharge" in dc) else bool(
                    dc.get("discharge_instructions") or dc.get("warning_signs") or dc.get("follow_up_instructions") or dc.get("diagnosis") or dc.get("discharge_diagnosis")
                )
                discharge_instructions = dc.get("discharge_instructions") or ""
                warning_signs = dc.get("warning_signs") or ""
                follow_up_instructions = dc.get("follow_up_instructions") or ""
                follow_up_date = dc.get("follow_up_date") or ""
                discharge_diagnosis = dc.get("diagnosis") or dc.get("discharge_diagnosis") or ""
            else:
                raw_ins = getattr(patient_context, "discharge_instructions", None)
                raw_ws = getattr(patient_context, "warning_signs", None)
                raw_fu = getattr(patient_context, "follow_up_instructions", None)
                raw_diag = getattr(patient_context, "discharge_diagnosis", None)
                has_discharge = bool(raw_ins or raw_ws or raw_fu or raw_diag)
                discharge_instructions = raw_ins or ""
                warning_signs = raw_ws or ""
                follow_up_instructions = raw_fu or ""
                follow_up_date = getattr(patient_context, "follow_up_date", "") or ""
                discharge_diagnosis = raw_diag or ""

        # Extract active medications
        active_meds = []
        for m in (patient_context.active_medications or []):
            if isinstance(m, str) and m.strip():
                active_meds.append(m.strip())
            elif isinstance(m, dict):
                name = m.get("name") or m.get("medicine_name") or m.get("drug")
                dose = m.get("dosage") or ""
                freq = m.get("frequency") or ""
                desc = f"{name} {dose} {freq}".strip()
                if desc:
                    active_meds.append(desc)

        meds_summary = ", ".join(active_meds) if active_meds else (discharge_instructions or "")
        orig_text = canon_info.get("original_query") or ""
        combined_query = f"{query_text} {orig_text}".strip()
        q_lower = combined_query.lower()

        discharge_citation = CDSCitation(
            source_index=1,
            title="Authorized Hospital Discharge Care Plan",
            source_name="Hospital EHR Clinical Discharge Summary",
            publisher="Treating Hospital Care Team",
            url="",
            chunk_id="DISCHARGE-CARE-PLAN",
            score=1.0
        )

        # -------------------------------------------------------------
        # TOPIC CLASSIFICATION
        # -------------------------------------------------------------
        is_med_timing = (
            any(w in q_lower for w in ["time", "when", "timing", "schedule", "routine", "morning", "evening", "night", "water", "food", "days", "day", "how long", "duration", "continue"])
            and any(w in q_lower for w in ["take", "taking", "medicine", "medication", "pill", "amlodipine", "blood pressure", "pills", "dose", "prescribed"])
        ) or any(w in combined_query for w in [
            "कब लें", "कब लेना", "कब लेनी", "लेने का समय", "पानी के साथ", "भोजन के साथ",
            "कधी घ्यावे", "कशी घ्यावी", "कधी घ्यावी", "पाण्यासोबत", "जेवणानंतर", "जेवणापूर्वी",
            "ક્યારે લેવી", "કેવી રીતે લેવી", "પાણી સાથે", "જમ્યા પછી", "જમ્યા પહેલા"
        ]) or (
            any(w in combined_query for w in ["कब", "कधी", "ક્યારે", "पानी", "पाण्या", "પાણી"])
            and any(w in combined_query for w in ["दवा", "गोली", "औषध", "गोळी", "દવા", "લેવી", "घ्यावी", "लेनी", "लें", "घ्यायचे"])
        ) or (
            len(canon_info.get("extracted_drugs", [])) > 0
            and any(w in combined_query for w in ["कब", "कधी", "ક્યારે", "समय", "वेळ", "टाइम"])
        )

        is_warning_query = (
            any(w in q_lower for w in ["warning sign", "warning signs", "danger sign", "danger signs"])
            or any(w in q_lower for w in ["watch for", "look out for", "be concerned about", "when should i worry"])
            or ("emergency" in q_lower and any(w in q_lower for w in ["seek", "go", "hospital", "care", "when", "signs"]))
            or any(w in combined_query for w in ["चेतावनी", "खतरे के लक्षण", "आपातकालीन देखभाल", "चेतावणी", "धोक्याची लक्षणे", "કટોકટી ચિહ્નો", "ચેતવણી ચિહ્નો"])
        )

        is_follow_up_query = (
            any(w in q_lower for w in ["follow-up", "follow up", "followup", "appointment", "appointments", "next visit", "doctor visit", "see the doctor", "see doctor", "doctor again", "visit the doctor"])
            or ("test" in q_lower and any(w in q_lower for w in ["lab", "need", "do i", "blood", "electrolytes"]))
            or any(w in combined_query for w in ["फॉलो-अप", "अपॉइंटमेंट", "जांच", "टेस्ट", "तपासणी", "भेट", "એપોઇન્ટમેન્ટ", "ટેસ્ટ", "डॉक्टर को दिखाएं", "डॉक्टरांना भेटा", "ડૉક્ટરને મળવું"])
        )

        is_discharge_overview = (
            ("discharge" in q_lower and any(w in q_lower for w in ["instruction", "instructions", "summary", "understand", "tell", "explain", "about"]))
            or any(w in q_lower for w in ["summarize the instructions", "summarise the instructions", "summary of instructions", "summarize instructions", "instructions you just cited"])
            or (
                any(w in q_lower for w in ["care", "recovery", "recover", "aftercare"])
                and any(w in q_lower for w in ["what", "which", "should", "need", "plan", "instruction", "do", "take"])
            )
            or any(w in q_lower for w in [
                "what should i do after going home",
                "how should i look after myself",
                "how should i care for myself",
                "what else should i do",
            ])
            or any(w in combined_query for w in ["डिस्चार्ज निर्देश", "डिस्चार्ज के बारे", "डिस्चार्ज सूचना", "डिस्चार्ज बद्दल", "ડિસ્ચાર્જ સૂચનાઓ", "ડિસ્ચાર્જ વિશે"])
        )

        is_nsaid_bp_query = (
            any(w in q_lower for w in ["ibuprofen", "painkiller", "painkillers", "nsaid", "advil", "motrin"])
            and any(w in q_lower for w in ["blood pressure", "amlodipine", "hypertension", "pills", "pill"])
        ) or any(w in combined_query for w in [
            "इबुप्रोफेन", "पेनकिलर", "दर्द की दवा", "आयबुप्रोफेन", "वेदना शामक", "આઇબુપ્રોફેન", "પેઇનકિલર"
        ])

        is_wound_care_query = (
            any(w in q_lower for w in ["wound", "incision", "dressing", "stitches", "suture", "surgical site", "bandage"])
            or any(w in combined_query for w in ["जख्म", "टाके", "ड्रेसिंग", "घाव", "પાટો"])
        )

        is_diet_query = (
            any(w in q_lower for w in ["diet", "food", "nutrition", "salt", "sodium", "eating", "meal", "ahar", "bhojan", "khorak"])
            or any(w in combined_query for w in ["आहार", "भोजन", "खाना", "मीठ", "नमक", "ખોરાક", "મીઠું"])
        )

        # -------------------------------------------------------------
        # INVARIANT: IF NO DISCHARGE EXISTS, RETURN TRUTHFUL ABSTENTION
        # (Zero citation, is_grounded=False, abstained=True)
        # -------------------------------------------------------------
        if not has_discharge and (is_discharge_overview or is_med_timing or is_warning_query or is_follow_up_query or is_wound_care_query or is_diet_query):
            if effective_lang == "hi":
                ans = "आपके इलेक्ट्रॉनिक स्वास्थ्य रिकॉर्ड में कोई अस्पताल डिस्चार्ज सारांश या देखभाल निर्देश दर्ज नहीं हैं। कृपया विशिष्ट पोस्ट-डिस्चार्ज मार्गदर्शन के लिए अपनी अस्पताल देखभाल टीम से संपर्क करें।"
            elif effective_lang == "mr":
                ans = "तुमच्या इलेक्ट्रॉनिक आरोग्य नोंदीमध्ये कोणताही रुग्णालय डिस्चार्ज सारांश किंवा काळजी सूचना नोंदवलेल्या नाहीत. कृपया डिस्चार्ज नंतरच्या मार्गदर्शनासाठी आपल्या रुग्णालय वैद्यकीय पथकाशी संपर्क साधा."
            elif effective_lang == "gu":
                ans = "તમારા ઇલેક્ટ્રોનિક હેલ્થ રેકોર્ડમાં કોઈ હોસ્પિટલ ડિસ્ચાર્જ સારાંશ અથવા સંભાળ સૂચનાઓ નોંધાયેલ નથી. ચોક્કસ માર્ગદર્શન માટે કૃપા કરીને તમારી હોસ્પિટલ કેર ટીમનો સંપર્ક કરો."
            else:
                ans = "No hospital discharge summary or post-discharge care directives are documented in your electronic health record. Please consult your treating care team for post-discharge instructions."
            return CDSEvaluateResponse(
                clinical_query=query_text,
                answer=ans,
                verification_status="abstained_policy",
                is_grounded=False,
                is_emergency=False,
                abstained=True,
                citations=[],
                drug_interactions=detected_interactions,
                safety_alerts=safety_alerts,
                abstention_reason="No hospital discharge record exists for this patient.",
                execution_mode="patient",
                pipeline_mode="discharge_care_grounding",
                language=effective_lang,
                detected_language=detected_lang,
                canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
            )

        # -------------------------------------------------------------
        # TOPIC 1: Medication Timing & Administration Schedule
        # -------------------------------------------------------------
        if is_med_timing and (discharge_instructions or active_meds):
            timing_words = [
                "morning", "evening", "night", "daily", "twice", "thrice", "bedtime",
                "after food", "before food", "with food", "meals", "water", "दिन", "सुबह", "शाम", "सकाळी", "संध्याकाळी", "સવારે", "સાંજે"
            ]
            def extract_timing_from_text(text: str) -> Optional[str]:
                if not text:
                    return None
                t_low = text.lower()
                if any(w in t_low for w in timing_words) or re.search(r"\b(?:od|bd|tid|qid|am|pm|hours?)\b", t_low):
                    return text.strip()
                return None

            # Determine if query targets a specific drug
            extracted_drugs = canon_info.get("extracted_drugs", [])
            target_drug = None
            if extracted_drugs:
                target_drug = extracted_drugs[0].lower()
            else:
                for med_str in active_meds:
                    first_token = med_str.split()[0].lower() if med_str else ""
                    if first_token and re.search(rf"\b{re.escape(first_token)}\b", q_lower):
                        target_drug = first_token
                        break

            # Handle multi-medication ambiguous query ("when should I take it?" / "when to take medicines?")
            if not target_drug and len(active_meds) > 1:
                med_lines = []
                any_timing_found = False
                for m in active_meds:
                    m_timing = extract_timing_from_text(m)
                    if m_timing:
                        med_lines.append(f"• **{m}** (Documented schedule)")
                        any_timing_found = True
                    else:
                        med_lines.append(f"• **{m}** (Administration timing not specifically documented)")
                
                joined_meds = "\n".join(med_lines)
                general_note = f"\n• **General Discharge Directives**: {discharge_instructions}" if discharge_instructions else ""
                
                if effective_lang == "hi":
                    ans = (
                        "आपकी अस्पताल डिस्चार्ज केयर योजना में कई दवाएं सूचीबद्ध हैं। प्रत्येक दवा का विवरण नीचे दिया गया है:\n\n"
                        f"{joined_meds}{general_note}\n\n"
                        "*चिकित्सीय नोट: कृपया प्रत्येक दवा के व्यक्तिगत समय के लिए अपने उपचार करने वाले चिकित्सक या फार्मासिस्ट से परामर्श लें।*"
                    )
                elif effective_lang == "mr":
                    ans = (
                        "तुमच्या डिस्चार्ज केअर प्लॅनमध्ये एकापेक्षा जास्त औषधे नोंदवलेली आहेत. तपशील खालीलप्रमाणे आहेत:\n\n"
                        f"{joined_meds}{general_note}\n\n"
                        "*वैद्यकीय सूचना: अचूक वेळेसाठी कृपया आपल्या डॉक्टरांचा किंवा औषधनिर्मात्याचा सल्ला घ्या.*"
                    )
                elif effective_lang == "gu":
                    ans = (
                        "તમારી ડિસ્ચાર્જ કેર પ્લાનમાં બહુવિધ દવાઓ નોંધાયેલ છે:\n\n"
                        f"{joined_meds}{general_note}\n\n"
                        "*તબીબી નોંધ: કૃપા કરીને દવા લેવાના ચોક્કસ સમય માટે તમારા ડૉક્ટર અથવા ફાર્માસિસ્ટનો સંપર્ક કરો.*"
                    )
                else:
                    ans = (
                        "Your discharge care record documents multiple medications. The documented administration directives are as follows:\n\n"
                        f"{joined_meds}{general_note}\n\n"
                        "*Clinical Note: Please consult your treating physician or dispensing pharmacist to confirm the exact schedule for each medication.*"
                    )
                
                return CDSEvaluateResponse(
                    clinical_query=query_text,
                    answer=ans,
                    verification_status="grounded" if any_timing_found else "abstained_policy",
                    is_grounded=any_timing_found,
                    is_emergency=False,
                    abstained=not any_timing_found,
                    citations=[discharge_citation] if any_timing_found else [],
                    drug_interactions=detected_interactions,
                    safety_alerts=safety_alerts,
                    abstention_reason=None if any_timing_found else "Specific administration timing is not documented for the prescribed medications.",
                    execution_mode="patient",
                    pipeline_mode="discharge_care_grounding",
                    language=effective_lang,
                    detected_language=detected_lang,
                    canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
                )

            # Target drug identified or single active medication
            specific_timing = None
            for m in active_meds:
                if target_drug and target_drug in m.lower():
                    specific_timing = extract_timing_from_text(m)
                    break
                elif not target_drug and len(active_meds) == 1:
                    specific_timing = extract_timing_from_text(m)
                    break

            # Also check if discharge_instructions explicitly associates timing with target_drug
            if not specific_timing and discharge_instructions:
                if target_drug and target_drug in discharge_instructions.lower():
                    for sentence in re.split(r"[.!\n;]", discharge_instructions):
                        if target_drug in sentence.lower() and extract_timing_from_text(sentence):
                            specific_timing = sentence.strip()
                            break
                elif not target_drug and len(active_meds) <= 1:
                    # Single med: ensure timing words aren't just lifestyle instructions like "walk every morning"
                    has_walk_lifestyle = bool(re.search(r"\b(?:walk|exercise|jog|breathe|diet|food|salt)\b", discharge_instructions, re.IGNORECASE))
                    has_med_words = bool(re.search(r"\b(?:tablet|capsule|pill|dose|medication|medicine|take)\b", discharge_instructions, re.IGNORECASE))
                    if has_med_words or not has_walk_lifestyle:
                        specific_timing = extract_timing_from_text(discharge_instructions)

            disp_med = target_drug.capitalize() if target_drug else (meds_summary or "Prescribed Medication")
            if specific_timing:
                ins = specific_timing
                if effective_lang == "hi":
                    ans = (
                        "आपकी अधिकृत अस्पताल डिस्चार्ज केयर योजना के अनुसार:\n\n"
                        f"• **निर्धारित दवा**: {disp_med}\n"
                        f"• **दर्ज सेवन निर्देश**: {ins}\n\n"
                        "*चिकित्सीय नोट: हमेशा अपने उपचार करने वाले डॉक्टर के निर्देशानुसार दवा लें। किसी भी बदलाव से पहले डॉक्टर से परामर्श करें।*"
                    )
                elif effective_lang == "mr":
                    ans = (
                        "तुमच्या अधिकृत रुग्णालय डिस्चार्ज केअर प्लॅननुसार:\n\n"
                        f"• **लिहून दिलेले औषध**: {disp_med}\n"
                        f"• **नोंदवलेल्या सूचना**: {ins}\n\n"
                        "*वैद्यकीय सूचना: तुमच्या डॉक्टरांचा सल्ला घेतल्याशिवाय डोस किंवा वेळेत बदल करू नका.*"
                    )
                elif effective_lang == "gu":
                    ans = (
                        "તમારી અધિકૃત હોસ્પિટલ ડિસ્ચાર્જ કેર યોજના મુજબ:\n\n"
                        f"• **સૂચવેલ દવા**: {disp_med}\n"
                        f"• **નોંધાયેલ સૂચનાઓ**: {ins}\n\n"
                        "*તબીબી નોંધ: તમારા ડૉક્ટરની સલાહ વિના ડોઝ અથવા સમયમાં ફેરફાર કરશો નહીં.*"
                    )
                else:
                    ans = (
                        "Based on your authorized hospital discharge care plan:\n\n"
                        f"• **Prescribed Medication**: {disp_med}\n"
                        f"• **Documented Administration Instructions**: {ins}\n\n"
                        "*Clinical Note: Always take your medication exactly as directed by your treating physician.*"
                    )
                return CDSEvaluateResponse(
                    clinical_query=query_text,
                    answer=ans,
                    verification_status="grounded",
                    is_grounded=True,
                    is_emergency=False,
                    abstained=False,
                    citations=[discharge_citation],
                    drug_interactions=detected_interactions,
                    safety_alerts=safety_alerts,
                    abstention_reason=None,
                    execution_mode="patient",
                    pipeline_mode="discharge_care_grounding",
                    language=effective_lang,
                    detected_language=detected_lang,
                    canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
                )
            else:
                context_quote = f" (Documented discharge notes: '{discharge_instructions}')" if discharge_instructions else ""
                if effective_lang == "hi":
                    ans = (
                        "आपके अधिकृत डिस्चार्ज सारांश के अनुसार:\n\n"
                        f"• **निर्धारित दवा**: {disp_med}\n"
                        f"• **दवा लेने का समय**: डिस्चार्ज सारांश में {disp_med} के लिए दवा लेने का कोई विशिष्ट समय दर्ज नहीं है।{context_quote}\n\n"
                        "*चिकित्सीय नोट: दवा लेने के सही समय के लिए कृपया अपने चिकित्सक या फार्मासिस्ट से परामर्श लें।*"
                    )
                elif effective_lang == "mr":
                    ans = (
                        "तुमच्या अधिकृत डिस्चार्ज सारांशानुसार:\n\n"
                        f"• **नोंदवलेले औषध**: {disp_med}\n"
                        f"• **औषध घेण्याची वेळ**: डिस्चार्ज सारांशामध्ये {disp_med} साठी औषध घेण्याची कोणतीही विशिष्ट वेळ नोंदवलेली नाही.{context_quote}\n\n"
                        "*वैद्यकीय सूचना: योग्य वेळेसाठी कृपया आपल्या डॉक्टरांचा किंवा औषधनिर्मात्याचा सल्ला घ्या.*"
                    )
                elif effective_lang == "gu":
                    ans = (
                        "તમારા અધિકૃત ડિસ્ચાર્જ સારાંશ મુજબ:\n\n"
                        f"• **નોંધાયેલ દવા**: {disp_med}\n"
                        f"• **દવા લેવાનો સમય**: ડિસ્ચાર્જ સારાંશમાં {disp_med} માટે દવા લેવાનો કોઈ ચોક્કસ સમય નોંધાયેલ નથી.{context_quote}\n\n"
                        "*તબીબી નોંધ: યોગ્ય સમય માટે કૃપા કરીને તમારા ડૉક્ટર અથવા ફાર્માસિસ્ટનો સંપર્ક કરો.*"
                    )
                else:
                    ans = (
                        "According to your authorized discharge summary:\n\n"
                        f"• **Prescribed Medication**: {disp_med}\n"
                        f"• **Medication Timing**: Specific administration timing for {disp_med} is not documented in your discharge summary.{context_quote}\n\n"
                        "*Clinical Note: Please consult your physician or dispensing pharmacist for individualized timing recommendations.*"
                    )
                return CDSEvaluateResponse(
                    clinical_query=query_text,
                    answer=ans,
                    verification_status="abstained_policy",
                    is_grounded=False,
                    is_emergency=False,
                    abstained=True,
                    citations=[],
                    drug_interactions=detected_interactions,
                    safety_alerts=safety_alerts,
                    abstention_reason=f"Specific administration timing for {disp_med} is not documented in the discharge instructions.",
                    execution_mode="patient",
                    pipeline_mode="discharge_care_grounding",
                    language=effective_lang,
                    detected_language=detected_lang,
                    canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
                )

        # -------------------------------------------------------------
        # TOPIC 2: Recovery Warning Signs & Emergency Escalation
        # -------------------------------------------------------------
        if is_warning_query:
            if warning_signs:
                if effective_lang == "hi":
                    ans = (
                        "आपकी डिस्चार्ज रिकवरी योजना के अनुसार:\n\n"
                        f"• **दर्ज चेतावनी संकेत एवं निर्देश**: {warning_signs}\n\n"
                        "🚨 **आपातकालीन सावधानी**: यदि आप गंभीर सीने में दर्द, सांस लेने में अचानक तकलीफ, या चेतना खोने जैसे गंभीर लक्षणों का अनुभव करते हैं, तो तुरंत आपातकालीन सेवाओं (**108 / 112**) पर कॉल करें या नजदीकी आपातकालीन विभाग में जाएं।"
                    )
                elif effective_lang == "mr":
                    ans = (
                        "तुमच्या डिस्चार्ज रिकव्हरी प्लॅननुसार:\n\n"
                        f"• **नोंदवलेली चेतावणी चिन्हे आणि सूचना**: {warning_signs}\n\n"
                        "🚨 **आणीबाणी दक्षता**: छातीत तीव्र वेदना, अचानक श्वास लागणे किंवा चक्कर येणे यांसारखी गंभीर लक्षणे आढळल्यास त्वरित **108 / 112** वर संपर्क साधा किंवा जवळच्या रुग्णालयात जा."
                    )
                elif effective_lang == "gu":
                    ans = (
                        "તમારી ડિસ્ચાર્જ રિકવરી યોજના મુજબ:\n\n"
                        f"• **નોંધાયેલ ચેતવણી ચિહ્નો અને સૂચનાઓ**: {warning_signs}\n\n"
                        "🚨 **કટોકટી સાવચેતી**: જો તમને છાતીમાં તીવ્ર દુખાવો અથવા શ્વાસ લેવામાં અચાનક તકલીફ જણાય, તો તરત જ **108 / 112** પર કૉલ કરો અથવા નજીકની હોસ્પિટલના ઇમરજન્સી વિભાગમાં જાઓ."
                    )
                else:
                    ans = (
                        "According to your authorized discharge recovery plan:\n\n"
                        f"• **Documented Warning Signs & Directives**: {warning_signs}\n\n"
                        "🚨 **Emergency Precaution**: Please follow the specific clinician instructions above for each symptom. If you experience acute, life-threatening symptoms such as sudden severe chest pain, severe shortness of breath, or loss of consciousness, seek immediate emergency care (**108 / 112**)."
                    )
                return CDSEvaluateResponse(
                    clinical_query=query_text,
                    answer=ans,
                    verification_status="grounded",
                    is_grounded=True,
                    is_emergency=False,
                    abstained=False,
                    citations=[discharge_citation],
                    drug_interactions=detected_interactions,
                    safety_alerts=safety_alerts,
                    abstention_reason=None,
                    execution_mode="patient",
                    pipeline_mode="discharge_care_grounding",
                    language=effective_lang,
                    detected_language=detected_lang,
                    canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
                )
            else:
                if effective_lang == "hi":
                    ans = (
                        "आपके अधिकृत अस्पताल डिस्चार्ज सारांश के अनुसार:\n\n"
                        "• **चेतावनी संकेत**: आपकी डिस्चार्ज योजना में व्यक्तिगत चेतावनी संकेत दर्ज नहीं हैं।\n\n"
                        "🚨 **आपातकालीन सावधानी**: यदि आप गंभीर सीने में दर्द, सांस लेने में अचानक तकलीफ, या चेतना खोने जैसे गंभीर लक्षणों का अनुभव करते हैं, तो तुरंत आपातकालीन सेवाओं (**108 / 112**) पर कॉल करें या नजदीकी आपातकालीन विभाग में जाएं।"
                    )
                elif effective_lang == "mr":
                    ans = (
                        "तुमच्या अधिकृत रुग्णालय डिस्चार्ज सारांशानुसार:\n\n"
                        "• **चेतावणी चिन्हे**: तुमच्या डिस्चार्ज योजनेमध्ये विशिष्ट चेतावणी चिन्हे नोंदवलेली नाहीत।\n\n"
                        "🚨 **आणीबाणी दक्षता**: छातीत तीव्र वेदना, अचानक श्वास लागणे किंवा चक्कर येणे यांसारखी गंभीर लक्षणे आढळल्यास त्वरित **108 / 112** वर संपर्क साधा किंवा जवळच्या रुग्णालयात जा."
                    )
                elif effective_lang == "gu":
                    ans = (
                        "તમારા અધિકૃત હોસ્પિટલ ડિસ્ચાર્જ સારાંશ મુજબ:\n\n"
                        "• **ચેતવણી ચિહ્નો**: તમારી ડિસ્ચાર્જ યોજનામાં કોઈ ચોક્કસ ચેતવણી ચિહ્નો નોંધાયેલ નથી।\n\n"
                        "🚨 **કટોકટી સાવચેતી**: જો તમને છાતીમાં તીવ્ર દુખાવો અથવા શ્વાસ લેવામાં અચાનક તકલીફ જણાય, તો તરત જ **108 / 112** પર કૉલ કરો અથવા નજીકની હોસ્પિટલના ઇમરજન્સી વિભાગમાં જાઓ."
                    )
                else:
                    ans = (
                        "According to your authorized hospital records:\n\n"
                        "• **Warning Signs**: No personalized recovery warning signs were documented in your discharge summary.\n\n"
                        "🚨 **Emergency Precaution**: If you experience sudden, acute symptoms such as severe chest pain, sudden difficulty breathing, or severe dizziness/confusion, seek immediate emergency care by calling **108 / 112** or visiting the nearest emergency department."
                    )
                return CDSEvaluateResponse(
                    clinical_query=query_text,
                    answer=ans,
                    verification_status="abstained_policy",
                    is_grounded=False,
                    is_emergency=False,
                    abstained=True,
                    citations=[],
                    drug_interactions=detected_interactions,
                    safety_alerts=safety_alerts,
                    abstention_reason="Personalized recovery warning signs are not documented in the discharge record.",
                    execution_mode="patient",
                    pipeline_mode="discharge_care_grounding",
                    language=effective_lang,
                    detected_language=detected_lang,
                    canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
                )

        # -------------------------------------------------------------
        # TOPIC 3: Follow-up Appointments & Laboratory Testing
        # -------------------------------------------------------------
        if is_follow_up_query:
            has_follow_up = bool(follow_up_instructions or follow_up_date)
            f_date_str = f" (Scheduled Date: {follow_up_date})" if follow_up_date else ""

            combined_raw = ((follow_up_instructions or "") + " " + (discharge_instructions or "")).strip()
            combined_text = combined_raw.lower()

            # Check explicit lab negations
            no_lab_negation = any(neg in combined_text for neg in [
                "no blood test", "no blood tests", "no lab test", "no lab tests",
                "no labs required", "no routine lab", "no routine labs", "no routine tests"
            ])

            has_positive_orders = any(w in combined_text for w in [
                "ecg", "pressure log", "record bp", "monitor bp", "glucose log", "check bp", "daily bp",
                "electrolytes", "creatinine", "panel", "blood test", "lab test", "monitoring"
            ]) and not (no_lab_negation and not any(w in combined_text for w in ["ecg", "pressure log", "record bp", "monitor bp", "glucose log", "check bp", "daily bp"]))

            # Resolve text for lab orders and monitoring:
            # Preserve BOTH positive orders and negative directives faithfully quoting clinician text
            if combined_raw and (no_lab_negation or has_positive_orders):
                lab_text = combined_raw
                is_grounded_fu = True
            elif has_follow_up:
                lab_text = "No specific laboratory tests or home monitoring orders are documented in your discharge summary."
                is_grounded_fu = True
            else:
                lab_text = "No specific laboratory tests or home monitoring orders are documented in your discharge summary."
                is_grounded_fu = False

            fu_text = (follow_up_instructions or "Follow-up appointment scheduled") + f_date_str if has_follow_up else "No follow-up appointment or calendar date is documented in your discharge record."

            is_grounded_fu = is_grounded_fu or has_follow_up

            if effective_lang == "hi":
                ans = (
                    "आपकी अधिकृत अस्पताल डिस्चार्ज योजना के अनुसार:\n\n"
                    f"• **फॉलो-अप परामर्श**: {fu_text}\n"
                    f"• **लैब जांच एवं निगरानी**: {lab_text}\n\n"
                    "*कृपया किसी भी प्रश्न के लिए अस्पताल ओपीडी डेस्क से संपर्क करें।*"
                )
            elif effective_lang == "mr":
                ans = (
                    "तुमच्या अधिकृत रुग्णालय डिस्चार्ज योजनेनुसार:\n\n"
                    f"• **फॉलो-अप भेट**: {fu_text}\n"
                    f"• **लॅब चाचण्या आणि देखरेख**: {lab_text}\n\n"
                    "*कृपया आपल्या भेटीबाबत रुग्णालयाच्या ओपीडीशी संपर्क साधा.*"
                )
            elif effective_lang == "gu":
                ans = (
                    "તમારા અધિકૃત હોસ્પિટલ ડિસ્ચાર્જ પ્લાન મુજબ:\n\n"
                    f"• **ફોલો-અપ મુલાકાત**: {fu_text}\n"
                    f"• **લેબ ટેસ્ટ અને મોનિટરિંગ**: {lab_text}\n\n"
                    "*કૃપા કરીને હોસ્પિટલ ઓપીડી સાથે તમારી મુલાકાતની પુષ્ટિ કરો.*"
                )
            else:
                ans = (
                    "Based on your authorized discharge care record:\n\n"
                    f"• **Follow-up Appointment**: {fu_text}\n"
                    f"• **Required Lab Tests & Monitoring**: {lab_text}\n\n"
                    "*Please confirm or reschedule your visit with the hospital outpatient desk.*"
                )

            return CDSEvaluateResponse(
                clinical_query=query_text,
                answer=ans,
                verification_status="grounded" if is_grounded_fu else "abstained_policy",
                is_grounded=is_grounded_fu,
                is_emergency=False,
                abstained=not is_grounded_fu,
                citations=[discharge_citation] if is_grounded_fu else [],
                drug_interactions=detected_interactions,
                safety_alerts=safety_alerts,
                abstention_reason=None if is_grounded_fu else "Follow-up instructions are not documented in the discharge record.",
                execution_mode="patient",
                pipeline_mode="discharge_care_grounding",
                language=effective_lang,
                detected_language=detected_lang,
                canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
            )

        # -------------------------------------------------------------
        # TOPIC 4: General Discharge Instructions Overview
        # -------------------------------------------------------------
        if is_discharge_overview:
            f_date_str = f" (Scheduled: {follow_up_date})" if follow_up_date else ""
            diag_display = discharge_diagnosis or "Not documented in discharge summary"
            ins_display = discharge_instructions or meds_summary or "Not documented in discharge summary"
            warn_display = warning_signs or "Not documented in discharge summary"
            follow_display = (follow_up_instructions + f_date_str) if follow_up_instructions else (f"Scheduled: {follow_up_date}" if follow_up_date else "Not documented in discharge summary")

            has_any_doc = bool(discharge_instructions or discharge_diagnosis or warning_signs or follow_up_instructions or follow_up_date)

            if effective_lang == "hi":
                ans = (
                    "यहाँ आपके अधिकृत अस्पताल डिस्चार्ज केयर निर्देशों का सारांश दिया गया है:\n\n"
                    f"• **डिस्चार्ज निदान**: {diag_display}\n"
                    f"• **दवा और सेवन निर्देश**: {ins_display}\n"
                    f"• **रिकवरी चेतावनी संकेत**: {warn_display}\n"
                    f"• **फॉलो-अप योजना**: {follow_display}\n\n"
                    "*व्यक्तिगत प्रश्नों के लिए हमेशा अपने उपचार करने वाले डॉक्टर से परामर्श लें।*"
                )
            elif effective_lang == "mr":
                ans = (
                    "येथे तुमच्या अधिकृत डिस्चार्ज सूचनांचा सारांश दिला आहे:\n\n"
                    f"• **डिस्चार्ज निदान**: {diag_display}\n"
                    f"• **औषधोपचार आणि सूचना**: {ins_display}\n"
                    f"• **रिकव्हरी चेतावणी चिन्हे**: {warn_display}\n"
                    f"• **फॉलो-अप योजना**: {follow_display}\n\n"
                    "*वैयक्तिक काळजीच्या प्रश्नांसाठी नेहमी आपल्या तपासणाऱ्या डॉक्टरांचा सल्ला घ्या.*"
                )
            elif effective_lang == "gu":
                ans = (
                    "અહીં તમારી અધિકૃત ડિસ્ચાર્જ સૂચનાઓનો સારાંશ આપેલ છે:\n\n"
                    f"• **ડિસ્ચાર્જ નિદાન**: {diag_display}\n"
                    f"• **દવા અને સૂચનાઓ**: {ins_display}\n"
                    f"• **ચેતવણી ચિહ્નો**: {warn_display}\n"
                    f"• **ફોલો-અપ યોજના**: {follow_display}\n\n"
                    "*વ્યક્તિગત સંભાળના પ્રશ્નો માટે હંમેશા તમારા ડૉક્ટરની સલાહ લો.*"
                )
            else:
                ans = (
                    "Here is a summary of your authorized post-discharge care directives:\n\n"
                    f"• **Discharge Diagnosis**: {diag_display}\n"
                    f"• **Medication Regimen**: {ins_display}\n"
                    f"• **Warning Signs**: {warn_display}\n"
                    f"• **Follow-up Plan**: {follow_display}\n\n"
                    "*For questions regarding absent items or personal care, consult your treating doctor.*"
                )

            return CDSEvaluateResponse(
                clinical_query=query_text,
                answer=ans,
                verification_status="grounded" if has_any_doc else "abstained_policy",
                is_grounded=has_any_doc,
                is_emergency=False,
                abstained=not has_any_doc,
                citations=[discharge_citation] if has_any_doc else [],
                drug_interactions=detected_interactions,
                safety_alerts=safety_alerts,
                abstention_reason=None if has_any_doc else "No discharge directives documented in record.",
                execution_mode="patient",
                pipeline_mode="discharge_care_grounding",
                language=effective_lang,
                detected_language=detected_lang,
                canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
            )

        # -------------------------------------------------------------
        # TOPIC 5: Drug Interactions with Active Medications (Educational Guidance)
        # -------------------------------------------------------------
        if is_nsaid_bp_query:
            if effective_lang == "hi":
                ans = (
                    "दर्द निवारक और रक्तचाप की दवाओं के संबंध में सामान्य चिकित्सीय मार्गदर्शन:\n\n"
                    "• **दवाओं का प्रभाव (General Guidance)**: NSAID दर्द निवारक दवाएं (जैसे इबुप्रोफेन) कुछ रक्तचाप की दवाओं के प्रभाव को कम कर सकती हैं और गुर्दे पर अतिरिक्त दबाव डाल सकती हैं।\n"
                    "• **चिकित्सीय सलाह**: अपने डॉक्टर या फार्मासिस्ट से परामर्श किए बिना ओवर-द-काउंटर दर्द निवारक दवाएं न लें। दर्द राहत के सुरक्षित विकल्प के लिए अपने चिकित्सक से संपर्क करें।\n\n"
                    "*चेतावनी: हमेशा अपने डॉक्टर से परामर्श के बाद ही कोई नई दवा लें।*"
                )
            elif effective_lang == "mr":
                ans = (
                    "वेदना शामक आणि रक्तदाबाच्या औषधांबद्दल सामान्य वैद्यकीय मार्गदर्शन:\n\n"
                    "• **औषधांचा प्रभाव (General Guidance)**: NSAID पेनकिलर (जसे की आयबुप्रोफेन) रक्तदाबाच्या गोळ्यांचा प्रभाव कमी करू शकतात आणि मूत्रपिंडावर ताण वाढवू शकतात।\n"
                    "• **वैद्यकीय सल्ला**: डॉक्टरांच्या सल्ल्याशिवाय पेनकिलर घेऊ नका. सुरक्षित पर्यायासाठी आपल्या डॉक्टरांशी चर्चा करा.\n\n"
                    "*दक्षता सूचना: डॉक्टरांच्या सल्ल्याशिवाय नवीन औषध घेऊ नका.*"
                )
            elif effective_lang == "gu":
                ans = (
                    "પેઇનકિલર અને બ્લડ પ્રેશરની દવાઓ અંગે સામાન્ય માર્ગદર્શન:\n\n"
                    "• **દવાઓની અસર (General Guidance)**: NSAID પેઇનકિલર્સ (જેમ કે આઇબુપ્રોફેન) બ્લડ પ્રેશરની દવાઓની અસરકારકતા ઘટાડી શકે છે।\n"
                    "• **તબીબી સલાહ**: ડૉક્ટરની સલાહ વિના પેઇનકિલર્સ શરૂ કરશો નહીં. યોગ્ય અને સુરક્ષિત સારવાર માટે તમારા ડૉક્ટરની સલાહ લો.\n\n"
                    "*ચેતવણી: તમારા ડૉક્ટરની સલાહ વિના કોઈ નવી દવા ન લો.*"
                )
            else:
                ans = (
                    "General Pharmacological Guidance regarding Painkillers and Blood Pressure Medication:\n\n"
                    "• **Pharmacological Consideration**: NSAID analgesics (such as Ibuprofen or Naproxen) may diminish the antihypertensive efficacy of certain blood pressure medications and can impact renal blood flow.\n"
                    "• **Educational Guidance**: Do not initiate over-the-counter NSAID painkillers without checking with your treating clinician or pharmacist. Contact your physician to discuss an analgesic regimen appropriate for your clinical profile.\n\n"
                    "*Precaution: Always consult your treating doctor or pharmacist before taking over-the-counter pain medications.*"
                )

            return CDSEvaluateResponse(
                clinical_query=query_text,
                answer=ans,
                verification_status="educational_guidance",
                is_grounded=False,
                is_emergency=False,
                abstained=False,
                citations=[],
                drug_interactions=detected_interactions,
                safety_alerts=safety_alerts,
                abstention_reason=None,
                execution_mode="patient",
                pipeline_mode="educational_guidance",
                language=effective_lang,
                detected_language=detected_lang,
                canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
            )

        # -------------------------------------------------------------
        # TOPIC 6: Specific Care Directives (Wound Care & Dietary Directives)
        # -------------------------------------------------------------
        if is_wound_care_query:
            has_wound_instructions = any(w in (discharge_instructions or "").lower() for w in [
                "wound", "incision", "dressing", "bandage", "stitches", "suture", "surgical site"
            ])
            if has_wound_instructions:
                ans = f"Based on your authorized discharge summary, your documented wound care instructions are:\n\n• {discharge_instructions}"
                return CDSEvaluateResponse(
                    clinical_query=query_text,
                    answer=ans,
                    verification_status="grounded",
                    is_grounded=True,
                    is_emergency=False,
                    abstained=False,
                    citations=[discharge_citation],
                    drug_interactions=detected_interactions,
                    safety_alerts=safety_alerts,
                    abstention_reason=None,
                    execution_mode="patient",
                    pipeline_mode="discharge_care_grounding",
                    language=effective_lang,
                    detected_language=detected_lang,
                    canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
                )
            else:
                if effective_lang == "hi":
                    ans = (
                        "आपके अधिकृत डिस्चार्ज सारांश में घाव या ड्रेसिंग (Wound Care) से संबंधित कोई विशिष्ट निर्देश दर्ज नहीं हैं। "
                        "चूंकि यह विवरण आपके चिकित्सक द्वारा दर्ज नहीं किया गया है, कृपया विशिष्ट मार्गदर्शन के लिए अपनी अस्पताल देखभाल टीम से संपर्क करें।"
                    )
                elif effective_lang == "mr":
                    ans = (
                        "तुमच्या अधिकृत डिस्चार्ज सारांशामध्ये जखमेची काळजी (Wound Care) किंवा ड्रेसिंगबाबत कोणत्याही विशिष्ट सूचना नोंदवलेल्या नाहीत. "
                        "हा तपशील डॉक्टरांनी नोंदवलेला नसल्यामुळे, कृपया पुढील मार्गदर्शनासाठी आपल्या रुग्णालयाच्या वैद्यकीय पथकाशी संपर्क साधा."
                    )
                elif effective_lang == "gu":
                    ans = (
                        "તમારા અધિકૃત ડિસ્ચાર્જ સારાંશમાં ઘા ની સંભાળ (Wound Care) અંગે કોઈ ચોક્કસ સૂચનાઓ નોંધાયેલ નથી. "
                        "આ વિગત તમારા ચિકિત્સક દ્વારા નોંધવામાં આવી ન હોવાથી, ચોક્કસ માર્ગદર્શન માટે કૃપા કરીને તમારી હોસ્પિટલ કેર ટીમનો સંપર્ક કરો."
                    )
                else:
                    ans = (
                        "The authorized hospital discharge summary for your care plan does not contain specific instructions regarding wound care or dressing changes. "
                        "Because this detail was not recorded in your post-discharge directives, please contact your hospital care team or outpatient clinic for specific guidance."
                    )
                return CDSEvaluateResponse(
                    clinical_query=query_text,
                    answer=ans,
                    verification_status="abstained_policy",
                    is_grounded=False,
                    is_emergency=False,
                    abstained=True,
                    citations=[],
                    drug_interactions=detected_interactions,
                    safety_alerts=safety_alerts,
                    abstention_reason="Specific care detail not recorded in discharge directives.",
                    execution_mode="patient",
                    pipeline_mode="discharge_care_grounding",
                    language=effective_lang,
                    detected_language=detected_lang,
                    canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
                )

        # Dietary instructions check
        if is_diet_query:
            has_diet_instructions = any(w in (discharge_instructions or "").lower() for w in ["diet", "sodium", "salt", "food", "nutrition", "fluid"])
            if has_diet_instructions:
                if effective_lang == "hi":
                    ans = f"आपकी डिस्चार्ज योजना के अनुसार आहार संबंधी निर्देश:\n\n• {discharge_instructions}\n\n*कृपया अपने डॉक्टर द्वारा सुझाए गए आहार का नियमित पालन करें।*"
                elif effective_lang == "mr":
                    ans = f"तुमच्या डिस्चार्ज योजनेनुसार आहाराबाबत सूचना:\n\n• {discharge_instructions}\n\n*कृपया डॉक्टरांनी सुचवलेल्या आहाराचे काटेकोर पालन करा.*"
                elif effective_lang == "gu":
                    ans = f"તમારી ડિસ્ચાર્જ યોજના મુજબ આહાર સંબંધિત સૂચનાઓ:\n\n• {discharge_instructions}\n\n*કૃપા કરીને ડૉક્ટર દ્વારા સૂચવેલ આહારનું પાલન કરો.*"
                else:
                    ans = f"Based on your authorized discharge plan, your dietary instructions are:\n\n• {discharge_instructions}\n\n*Please adhere to these dietary guidelines and contact your clinic if you have specific dietary questions.*"
                return CDSEvaluateResponse(
                    clinical_query=query_text,
                    answer=ans,
                    verification_status="grounded",
                    is_grounded=True,
                    is_emergency=False,
                    abstained=False,
                    citations=[discharge_citation],
                    drug_interactions=detected_interactions,
                    safety_alerts=safety_alerts,
                    abstention_reason=None,
                    execution_mode="patient",
                    pipeline_mode="discharge_care_grounding",
                    language=effective_lang,
                    detected_language=detected_lang,
                    canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
                )
            else:
                ans = "Your authorized discharge plan does not document specialized dietary restrictions. Please consult your physician for individualized dietary recommendations."
                return CDSEvaluateResponse(
                    clinical_query=query_text,
                    answer=ans,
                    verification_status="abstained_policy",
                    is_grounded=False,
                    is_emergency=False,
                    abstained=True,
                    citations=[],
                    drug_interactions=detected_interactions,
                    safety_alerts=safety_alerts,
                    abstention_reason="Dietary restrictions not documented in discharge directives.",
                    execution_mode="patient",
                    pipeline_mode="discharge_care_grounding",
                    language=effective_lang,
                    detected_language=detected_lang,
                    canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
                )

        return None

    def _resolve_doctor_patient_dossier_query(
        self,
        query_text: str,
        patient_context: PatientContext,
        effective_lang: str,
        detected_lang: str,
        canon_info: Dict[str, Any],
        detected_interactions: List[DrugInteractionAlert],
        safety_alerts: List[str]
    ) -> Optional[CDSEvaluateResponse]:
        """
        Directly grounds clinician inquiries regarding the request-scoped patient EHR dossier:
        - Primary documented diagnoses and conditions
        - Documented allergy precautions and adverse drug reaction history
        - Current active medications and regimens
        - Documented past medical history
        - Fail-closed verification for undocumented or absent clinical facts
        """
        q_lower = query_text.lower()

        # Check if the query is inquiring about the patient's record / history / dossier
        patient_reference_terms = [
            "this patient", "the patient", "patient's", "documented", "patient record",
            "dossier", "diagnos", "allerg", "patient history", "active med",
            "patient condition", "patient precaution"
        ]
        is_patient_record_query = any(term in q_lower for term in patient_reference_terms)
        if not is_patient_record_query:
            return None

        diagnoses = [str(d).strip() for d in (patient_context.diagnoses or []) if str(d).strip()]
        allergies = [str(a).strip() for a in (patient_context.allergies or []) if str(a).strip()]
        meds = []
        for m in (patient_context.active_medications or []):
            if isinstance(m, str) and m.strip():
                meds.append(m.strip())
            elif isinstance(m, dict):
                name = m.get("name") or m.get("medicine_name") or m.get("drug")
                if name:
                    meds.append(str(name).strip())
        history = [str(h).strip() for h in (patient_context.medical_history or []) if str(h).strip()]

        ehr_citation = CDSCitation(
            source_index=1,
            title="Verified Patient Electronic Health Record (EHR)",
            source_name="Hospital EHR Clinical Dossier",
            publisher="Treating Hospital Clinical System",
            url="",
            chunk_id="EHR-PATIENT-DOSSIER",
            score=1.0
        )

        # Check if query specifically inquires about an absent procedure/condition/directive not in the record
        absent_indicators = ["surgery", "procedure", "gallbladder", "appendectomy", "bypass", "fracture", "cancer", "stroke", "asthma", "cholecystectomy", "discharge", "follow-up plan"]
        is_absent_fact_query = any(term in q_lower for term in absent_indicators)
        if is_absent_fact_query:
            all_text = " ".join(diagnoses + history + allergies + meds).lower()
            matching_terms = [term for term in absent_indicators if term in q_lower and term in all_text]
            if not matching_terms:
                diag_summary = "; ".join(diagnoses) if diagnoses else "None documented"
                allergy_summary = ", ".join(allergies) if allergies else "Not documented / Unknown"
                return CDSEvaluateResponse(
                    clinical_query=query_text,
                    answer=(
                        f"Electronic Health Record Review: No documentation found in the patient's clinical history for the requested event or procedure. "
                        f"Current documented diagnoses: {diag_summary}. Documented allergies: {allergy_summary}."
                    ),
                    verification_status="abstained_policy",
                    is_grounded=False,
                    is_emergency=False,
                    abstained=True,
                    citations=[ehr_citation],
                    drug_interactions=detected_interactions,
                    safety_alerts=safety_alerts,
                    abstention_reason="Requested historical detail not present in patient electronic health record.",
                    execution_mode="doctor",
                    pipeline_mode="patient_context_evaluation",
                    language=effective_lang,
                    detected_language=detected_lang,
                    canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
                )

        # Query asking for diagnosis, allergy, or clinical summary
        is_diag_or_allergy_inquiry = (
            any(k in q_lower for k in ["diagnos", "condition", "illness", "primary"]) or
            any(k in q_lower for k in ["allerg", "precaution", "hypersensitiv"]) or
            any(k in q_lower for k in ["medication", "medicine", "history", "summary"])
        )
        if is_diag_or_allergy_inquiry and (diagnoses or allergies or history or meds):
            diag_str = "; ".join(diagnoses) if diagnoses else "No primary chronic diagnosis recorded."
            allergy_str = ", ".join(allergies) if allergies else "Not documented / Unknown"
            med_str = ", ".join(meds) if meds else "No active prescriptions recorded."
            history_str = "; ".join(history) if history else "No additional historical notes recorded."

            ans = (
                f"Patient Clinical Dossier Summary:\n\n"
                f"• **Primary Documented Diagnosis**: {diag_str}\n"
                f"• **Documented Allergy Precautions**: {allergy_str}\n"
                f"• **Active Medication Regimen**: {med_str}\n"
                f"• **Clinical History Notes**: {history_str}\n\n"
                f"*Clinical Precaution: Re-verify patient allergies and clinical status prior to modifying active pharmacological regimens.*"
            )

            return CDSEvaluateResponse(
                clinical_query=query_text,
                answer=ans,
                verification_status="verified_grounded",
                is_grounded=True,
                is_emergency=False,
                abstained=False,
                citations=[ehr_citation],
                drug_interactions=detected_interactions,
                safety_alerts=safety_alerts,
                abstention_reason=None,
                execution_mode="doctor",
                pipeline_mode="patient_context_evaluation",
                language=effective_lang,
                detected_language=detected_lang,
                canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
            )

        return None

    def evaluate(self, request: CDSEvaluateRequest) -> CDSEvaluateResponse:
        """
        Main orchestration flow:
        1. Input Validation
        2. Emergency Triage Check (Early Interception)
        3. Prompt-Injection Defense (Early Block)
        4. Deterministic Drug Safety Screening (Rule-Based, Non-LLM)
        5. Request-Scoped Clinical Context Packaging (Data-Minimization)
        6. Frozen RAG Pipeline Invocation

        7. Grounding Status Mapping & Final Assembly
        """
        query_text = request.clinical_query.strip()
        if not query_text:
            return CDSEvaluateResponse(
                clinical_query="",
                answer="Clinical query cannot be empty.",
                verification_status="abstained_policy",
                is_grounded=False,
                is_emergency=False,
                abstained=True,
                abstention_reason="Empty query provided."
            )

        # Multilingual Processing Layer
        from multilingual_module.detector import detect_language, is_indic_emergency, is_indic_prompt_injection
        from multilingual_module.canonicalizer import canonicalize_medical_query
        from multilingual_module.localizer import localize_cds_response

        detected_info = detect_language(query_text)
        req_lang = getattr(request, "language", "en")
        effective_lang = req_lang if (req_lang and req_lang != "auto") else detected_info["language"]

        # Canonicalize to English for the frozen RAG engine if input is Indic
        canon_info = canonicalize_medical_query(query_text, forced_lang=effective_lang)
        retrieval_query = canon_info["canonical_query"] if canon_info["was_canonicalized"] else query_text

        # Multi-Turn Conversational Reference Resolution (pronoun & entity continuity)
        history = getattr(request, "conversation_history", []) or []
        if history:
            retrieval_query = self._resolve_conversational_references(
                query_text=retrieval_query,
                conversation_history=history,
                patient_context=request.patient_context
            )

        # Step 2: Emergency Triage Check (evaluated on raw, canonical, and Indic patterns)
        emergency_alert = (
            self.rag_pipeline.guardrails.check_emergency(retrieval_query)
            or self.rag_pipeline.guardrails.check_emergency(query_text)
            or (is_indic_emergency(query_text) and "🚨 MEDICAL EMERGENCY DETECTED 🚨")
        )
        if emergency_alert:
            early_res = CDSEvaluateResponse(
                clinical_query=query_text,
                answer="🚨 **MEDICAL EMERGENCY DETECTED** 🚨\n\nYour description suggests symptoms that may require **immediate medical attention**.",
                verification_status="emergency_diverted",
                is_grounded=False,
                is_emergency=True,
                abstained=False,
                citations=[],
                drug_interactions=[],
                safety_alerts=["CRITICAL ALERT: Acute medical emergency detected. Diverted to emergency protocols."],
                abstention_reason="Acute emergency triage diversion.",
                execution_mode=request.mode,
                pipeline_mode="emergency_triage",
                language=effective_lang,
                detected_language=detected_info["language"],
                canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
            )
            if effective_lang != "en":
                return CDSEvaluateResponse(**localize_cds_response(early_res.model_dump(), target_lang=effective_lang))
            return early_res

        # Step 3: Prompt Injection Early Blocking
        is_inj = (
            self.rag_pipeline.guardrails.detect_injection(retrieval_query)
            or self.rag_pipeline.guardrails.detect_injection(query_text)
            or is_indic_prompt_injection(query_text)
        )
        if is_inj:
            early_res = CDSEvaluateResponse(
                clinical_query=query_text,
                answer="Security Alert: Request blocked. This system cannot process prompts attempting to override or inspect system instructions.",
                verification_status="prompt_injection_blocked",
                is_grounded=False,
                is_emergency=False,
                abstained=True,
                citations=[],
                drug_interactions=[],
                safety_alerts=["SECURITY ALERT: Prompt injection attempt intercepted and blocked."],
                abstention_reason="Prompt injection detected.",
                execution_mode=request.mode,
                pipeline_mode="prompt_injection_blocked",
                language=effective_lang,
                detected_language=detected_info["language"],
                canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
            )
            if effective_lang != "en":
                return CDSEvaluateResponse(**localize_cds_response(early_res.model_dump(), target_lang=effective_lang))
            return early_res

        # Step 3.5: Conversational Input Check (Greetings & Acknowledgements)
        # Prevents ordinary social interactions from inappropriately triggering clinical evidence refusals
        conversational_res = self._check_conversational_input(
            query_text=query_text,
            effective_lang=effective_lang,
            detected_lang=detected_info["language"],
            canon_info=canon_info,
            mode=request.mode
        )
        if conversational_res is not None:
            return conversational_res

        # Step 4: Deterministic Drug Safety Screening
        drug_list = self._extract_drugs_from_request(request)
        # Also include any extracted drugs from canonicalized query
        for d in canon_info.get("extracted_drugs", []):
            if d.capitalize() not in drug_list and d not in drug_list:
                drug_list.append(d.capitalize())
        detected_interactions: List[DrugInteractionAlert] = []
        safety_alerts: List[str] = []

        if len(drug_list) >= 2:
            try:
                from drug_module.interaction_engine import check_interactions
                raw_interactions = check_interactions(drug_list, self.interaction_dict)
                for item in raw_interactions:
                    alert = DrugInteractionAlert(
                        drug_pair=item.get("drug_pair", []),
                        severity=str(item.get("severity", "moderate")),
                        explanation=str(item.get("explanation", "")),
                        clinical_action=str(item.get("clinical_action", "")),
                        source_id=str(item.get("source_id", "DailyMed")),
                        source_url=str(item.get("source_url", "")),
                        rule_id=str(item.get("rule_id", "")),
                        provenance_status=str(item.get("provenance_status", "VERIFIED"))
                    )
                    detected_interactions.append(alert)
                    pair_str = " + ".join(alert.drug_pair)
                    safety_alerts.append(
                        f"DRUG INTERACTION ({alert.severity.upper()}): {pair_str}. {alert.clinical_action}"
                    )
            except Exception as e:
                logger.error(f"Drug safety screening error: {e}", exc_info=True)
                safety_alerts.append("Notice: Deterministic drug interaction engine encountered a lookup error.")

        # Step 4.5: Patient Authorized Post-Discharge Care Plan Grounding
        # When in patient mode with authorized discharge context, resolve post-discharge recovery questions
        # directly from the patient's verified EHR discharge instructions and medication safety rules
        if request.mode == "patient" and request.patient_context:
            discharge_res = self._resolve_discharge_care_query(
                query_text=retrieval_query or query_text,
                patient_context=request.patient_context,
                effective_lang=effective_lang,
                detected_lang=detected_info["language"],
                canon_info=canon_info,
                detected_interactions=detected_interactions,
                safety_alerts=safety_alerts
            )
            if discharge_res is not None:
                return discharge_res

        # Step 4.6: Doctor Patient EHR Dossier Context Grounding
        # When in doctor mode with patient EHR context, directly ground patient dossier questions
        # (diagnosis, documented allergies, medical history) from verified EHR data
        if request.mode == "doctor" and request.patient_context:
            doctor_dossier_res = self._resolve_doctor_patient_dossier_query(
                query_text=query_text,
                patient_context=request.patient_context,
                effective_lang=effective_lang,
                detected_lang=detected_info["language"],
                canon_info=canon_info,
                detected_interactions=detected_interactions,
                safety_alerts=safety_alerts
            )
            if doctor_dossier_res is not None:
                return doctor_dossier_res

        # Step 5: Request-Scoped Context Packaging (No PII, never indexed)
        patient_context_dict: Dict[str, Any] = {}
        if request.patient_context:
            if request.patient_context.age is not None:
                patient_context_dict["age"] = request.patient_context.age
            if request.patient_context.gender:
                patient_context_dict["gender"] = request.patient_context.gender
            if request.patient_context.symptoms:
                patient_context_dict["symptoms"] = request.patient_context.symptoms
            if request.patient_context.diagnoses:
                patient_context_dict["diagnoses"] = request.patient_context.diagnoses
            if request.patient_context.allergies:
                patient_context_dict["allergies"] = request.patient_context.allergies
            if request.patient_context.active_medications:
                patient_context_dict["active_medications"] = request.patient_context.active_medications
            if request.patient_context.medical_history:
                patient_context_dict["medical_history"] = request.patient_context.medical_history
            if request.patient_context.lab_summaries:
                patient_context_dict["lab_summaries"] = request.patient_context.lab_summaries

        # Step 6: Invoke Frozen Medical RAG Pipeline
        rag_res = self.rag_pipeline.query(
            user_query=retrieval_query,
            mode=request.retrieval_mode,
            top_k=request.top_k,
            generate_answer=True,
            verify_answer=True,
            audience=request.mode,
            patient_context=patient_context_dict
        )

        # Step 7: Grounding Status Mapping & Response Assembly
        verification = rag_res.get("verification")
        is_grounded = bool(verification.get("is_grounded", False)) if verification else (
            not rag_res.get("abstained", False) and not rag_res.get("is_emergency", False)
        )
        abstained = bool(rag_res.get("abstained", False))

        if rag_res.get("is_emergency", False):
            verification_status = "emergency_diverted"
        elif rag_res.get("grounding_status") == "prompt_injection_blocked":
            verification_status = "prompt_injection_blocked"
        elif rag_res.get("pipeline_mode") == "validation_error":
            verification_status = "validation_error"
            abstained = True
        elif rag_res.get("error") or rag_res.get("pipeline_mode") == "technical_error":
            verification_status = "technical_failure"
            abstained = True
        elif not abstained and is_grounded:
            verification_status = "grounded"
        elif not abstained and verification and verification.get("safe_for_partial", False):
            verification_status = "partially_grounded"
            is_grounded = True
        elif verification and not verification.get("is_grounded", False):
            verification_status = "withheld_verification_failure"
            abstained = True
        else:
            verification_status = "abstained_policy"
            abstained = True

        # Map Citations
        citations: List[CDSCitation] = []
        for src in rag_res.get("sources", []):
            if isinstance(src, dict):
                # Patient Mode: Omit internal system traces (chunk_ids and raw retrieval scores)
                chunk_id_val = "" if request.mode == "patient" else str(src.get("chunk_id", ""))
                score_val = None if request.mode == "patient" else (float(src.get("score")) if src.get("score") is not None else None)
                qtype_val = None if request.mode == "patient" else src.get("qtype")

                citations.append(CDSCitation(
                    source_index=src.get("source_index", len(citations) + 1),
                    title=src.get("title", "Clinical Evidence"),
                    source_name=src.get("source_name", "Authoritative Guideline"),
                    publisher=src.get("publisher", "Medical Authority"),
                    url=src.get("url", ""),
                    chunk_id=chunk_id_val,
                    qtype=qtype_val,
                    score=score_val
                ))

        answer_text = rag_res.get("answer", "")
        abstention_reason = None

        # When deterministic drug-drug interactions are verified, provide the clinical safety alert
        # if the inquiry relates to co-prescription or combination safety, even if ungrounded conversational
        # claims from the compact generative model were withheld
        if detected_interactions:
            q_lower = query_text.lower()
            canon_lower = (canon_info.get("canonical_query") or "").lower()
            
            # Check if query is explicitly an adverse effect, warning, indication, or dosage inquiry for a drug
            is_monograph_or_adverse_query = any(k in q_lower or k in canon_lower for k in [
                "adverse effect", "side effect", "adverse reaction", "warning", "black box",
                "contraindication", "dosage", "dose", "indication", "mechanism", "pharmacology",
                "how to take", "starting dose", "maintenance dose"
            ])

            # Co-prescription inquiries must explicitly inquire about multi-drug combinations or interactions
            has_interaction_terms = any(k in q_lower or k in canon_lower for k in [
                "co-prescribe", "coprescribe", "prescribe together", "take together", "taken together",
                "interaction", "interact", "combine", "combination", "concurrent", "coadminister",
                "co-administer", "safe to take with", "can i take with", "can i give with", "risk between"
            ])
            top_pair = detected_interactions[0].drug_pair if detected_interactions else []
            mentions_both_drugs = len(top_pair) >= 2 and (
                top_pair[0].lower() in q_lower and top_pair[1].lower() in q_lower
            )
            has_multi_drugs = (len(canon_info.get("extracted_drugs", [])) >= 2) or (len(request.candidate_medications) >= 2)

            is_coprescribe_query = (not is_monograph_or_adverse_query) and has_interaction_terms and (mentions_both_drugs or has_multi_drugs or "interaction" in q_lower or "interact" in q_lower)
            has_unverified_curative_claim = any(k in q_lower or k in canon_lower for k in [
                "cure", "cures", "curing", "treats cancer", "cure cancer", "prevent alzheimer", "treat alzheimer"
            ])

            if has_unverified_curative_claim:
                # Query was asserting an ungrounded therapeutic claim that happened to mention interacting drugs.
                # Strictly fail-closed: do NOT allow the ungrounded claim to inherit a grounded status!
                # The interaction alert is preserved in `drug_interactions` and `safety_alerts`,
                # but the response status remains fail-closed abstained.
                abstention_reason = "Evidence insufficient or verification threshold not met for the requested therapeutic claim."
                verification_status = "abstained_policy"
                abstained = True
                is_grounded = False
                if request.mode == "patient":
                    answer_text = (
                        "The medical guidelines do not contain sufficient verified evidence to answer this question safely for personal care. "
                        "For your health and safety, please consult your treating physician or a qualified healthcare professional."
                    )
                else:
                    answer_text = (
                        "The medical guidelines do not contain sufficient verified clinical evidence to support the requested therapeutic claim. "
                        "Please refer to peer-reviewed clinical literature or consult a specialist."
                    )
            elif is_coprescribe_query:
                top_alert = detected_interactions[0]
                pair_label = " + ".join(top_alert.drug_pair)
                safety_summary = (
                    f"**Clinical Drug Interaction Alert ({top_alert.severity.upper()}): {pair_label}**\n\n"
                    f"• **Finding**: {top_alert.explanation}\n"
                    f"• **Recommended Clinical Action**: {top_alert.clinical_action}\n\n"
                    f"*Authoritative Reference: Verified Clinical Drug Safety Rule ({top_alert.rule_id})*"
                )
                # Overwrite answer strictly with authoritative rule-engine text (dropping unverified generative claims)
                answer_text = safety_summary
                verification_status = "grounded"
                is_grounded = True
                abstained = False
                abstention_reason = None
                if not citations:
                    citations.append(CDSCitation(
                        source_index=1,
                        title=f"Verified Drug Safety Interaction: {pair_label}",
                        source_name=top_alert.source_id or "DailyMed / SIDER Clinical Interaction Engine",
                        publisher="U.S. National Library of Medicine / FDA",
                        url=top_alert.source_url or "https://dailymed.nlm.nih.gov",
                        chunk_id="",
                        qtype="Drug Interaction",
                        score=1.0
                    ))
        elif abstained:
            if request.mode == "patient":
                abstention_reason = "Evidence insufficient or verification threshold not met for safe patient guidance."
                answer_text = (
                    "The medical guidelines do not contain sufficient verified evidence to answer this question safely for personal care. "
                    "For your health and safety, please consult your treating physician or a qualified healthcare professional."
                )
            else:
                abstention_reason = "Evidence insufficient or verification threshold not met for safe clinical claim."
        elif request.mode == "patient" and not rag_res.get("is_emergency", False):
            # Patient Educational Safe Mode: Append disclaimer if not already included
            if "Note:" not in answer_text and "consult" not in answer_text.lower():
                answer_text += "\n\nNote: This information is for personal health education only and does not replace professional medical judgment from your doctor."

        assembled_response = CDSEvaluateResponse(
            clinical_query=query_text,
            answer=answer_text,
            verification_status=verification_status,
            is_grounded=is_grounded,
            is_emergency=bool(rag_res.get("is_emergency", False)),
            abstained=abstained,
            citations=citations,
            drug_interactions=detected_interactions,
            safety_alerts=safety_alerts,
            abstention_reason=abstention_reason,
            execution_mode=request.mode,
            retrieved_chunks_count=rag_res.get("retrieved_chunks_count", len(citations)),
            pipeline_mode=rag_res.get("pipeline_mode", request.retrieval_mode),
            language=effective_lang,
            detected_language=detected_info["language"],
            canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
        )

        if effective_lang != "en":
            localized_data = localize_cds_response(assembled_response.model_dump(), target_lang=effective_lang)
            return CDSEvaluateResponse(**localized_data)

        return assembled_response

    def screen_prescription(self, request: PrescriptionScreenRequest) -> PrescriptionScreenResponse:
        """
        Deterministic prescription screening endpoint (DailyMed/DrugBank + Allergy + Multi-ingredient decomposition).
        Evaluates proposed medicines against existing patient medicines and computes verified alternative candidates.
        """
        from drug_module.interaction_engine import screen_medications_detailed
        from drug_module.alternative_engine import find_candidate_alternatives
        from drug_module.normalizer import decompose_medication

        candidate_med_names = []
        for med in request.candidate_medications:
            if isinstance(med, str):
                candidate_med_names.append(med.strip())
            elif isinstance(med, dict):
                name = med.get("name") or med.get("medicine_name") or med.get("drug")
                if name:
                    candidate_med_names.append(str(name).strip())

        active_med_names = []
        for med in (request.active_medications or []):
            if isinstance(med, str):
                active_med_names.append(med.strip())
            elif isinstance(med, dict):
                name = med.get("name") or med.get("medicine_name") or med.get("drug")
                if name:
                    active_med_names.append(str(name).strip())

        all_med_names = list(candidate_med_names)
        for act in active_med_names:
            if act not in all_med_names:
                all_med_names.append(act)

        # Execute multi-ingredient decomposition and interaction screening
        detailed_screening = screen_medications_detailed(all_med_names, self.interaction_dict)
        raw_interactions = detailed_screening.get("interactions", [])
        duplicate_ingredients = detailed_screening.get("duplicate_ingredients", [])
        evaluated_drugs = detailed_screening.get("evaluated_drugs", [])
        unindexed_drugs = detailed_screening.get("unindexed_drugs", [])

        interactions: List[DrugInteractionAlert] = []
        for item in raw_interactions:
            interactions.append(DrugInteractionAlert(
                drug_pair=item.get("drug_pair", []),
                severity=str(item.get("severity", "moderate")),
                explanation=str(item.get("explanation", "")),
                clinical_action=str(item.get("clinical_action", "")),
                source_id=str(item.get("source_id", "DailyMed")),
                source_url=str(item.get("source_url", "")),
                rule_id=str(item.get("rule_id", "")),
                provenance_status=str(item.get("provenance_status", "VERIFIED"))
            ))

        ALLERGY_CROSS_REACTIONS = {
            "penicillin": ["amoxicillin", "ampicillin", "augmentin", "piperacillin", "penicillin", "penicillin v", "penicillin g", "amoxil"],
            "penicillins": ["amoxicillin", "ampicillin", "augmentin", "piperacillin", "penicillin", "penicillin v", "penicillin g", "amoxil"],
            "sulfa": ["bactrim", "septra", "sulfamethoxazole", "trimethoprim-sulfamethoxazole", "sulfasalazine"],
            "sulfonamides": ["bactrim", "septra", "sulfamethoxazole", "trimethoprim-sulfamethoxazole", "sulfasalazine"],
            "nsaid": ["aspirin", "ibuprofen", "naproxen", "diclofenac", "combiflam", "advil", "motrin", "aleve"],
            "nsaids": ["aspirin", "ibuprofen", "naproxen", "diclofenac", "combiflam", "advil", "motrin", "aleve"],
            "aspirin": ["aspirin", "ibuprofen", "naproxen", "diclofenac", "combiflam", "advil", "motrin", "aleve", "ecotrin", "bayer"],
            "ibuprofen": ["ibuprofen", "aspirin", "naproxen", "diclofenac", "combiflam", "advil", "motrin", "aleve"],
            "paracetamol": ["paracetamol", "acetaminophen", "crocin", "dolo 650", "dolo-650", "dolo", "combiflam", "tylenol", "calpol"],
            "acetaminophen": ["paracetamol", "acetaminophen", "crocin", "dolo 650", "dolo-650", "dolo", "combiflam", "tylenol", "calpol"]
        }

        contraindications = []
        cleaned_allergies = [a.lower().strip() for a in request.allergies if a and str(a).strip() and a.lower() not in ["none", "nil"]]
        for drug in candidate_med_names:
            drug_lower = drug.lower().strip()
            constituents = decompose_medication(drug)
            for allergy in cleaned_allergies:
                is_match = False
                matched_moiety = drug
                if allergy in drug_lower or drug_lower in allergy:
                    is_match = True
                else:
                    for c in constituents:
                        if allergy in c.lower() or c.lower() in allergy:
                            is_match = True
                            matched_moiety = f"{drug} (active ingredient '{c}')"
                            break
                if not is_match:
                    # Check cross-reactive classes
                    cross_meds = ALLERGY_CROSS_REACTIONS.get(allergy, [])
                    for xm in cross_meds:
                        if xm in drug_lower:
                            is_match = True
                            matched_moiety = f"{drug} (cross-reactive with '{allergy}' class)"
                            break
                        for c in constituents:
                            if xm in c.lower():
                                is_match = True
                                matched_moiety = f"{drug} (active ingredient '{c}' cross-reactive with '{allergy}' class)"
                                break
                        if is_match:
                            break

                if is_match:
                    contraindications.append(
                        f"ALLERGY CONTRAINDICATION: Patient has documented allergy to '{allergy}', matching proposed drug '{matched_moiety}'."
                    )

        # Compute evidence-backed alternative candidates if interactions detected
        candidate_alternatives = []
        if interactions:
            candidate_alternatives = find_candidate_alternatives(
                detected_interactions=raw_interactions,
                proposed_medications=candidate_med_names,
                active_medications=active_med_names,
                patient_allergies=cleaned_allergies,
                interaction_dict=self.interaction_dict
            )

        # Establish rule coverage & screening status
        rule_coverage = "FULL"
        if len(unindexed_drugs) == len(all_med_names) and len(all_med_names) > 0:
            rule_coverage = "NO_MATCHING_LOCAL_RULE"
        elif len(unindexed_drugs) > 0:
            rule_coverage = "PARTIAL"

        screen_status = "safe"
        if contraindications:
            screen_status = "critical"
        elif any(i.severity.lower() in ["high", "critical", "major"] for i in interactions):
            screen_status = "critical"
        elif interactions or duplicate_ingredients:
            screen_status = "warning"
        elif rule_coverage == "NO_MATCHING_LOCAL_RULE" or (len(interactions) == 0 and len(unindexed_drugs) > 0):
            # An unsupported drug pair returns 'no_matching_local_rule', never a silent 'safe'
            screen_status = "no_matching_local_rule"

        recommendations = [i.clinical_action for i in interactions if i.clinical_action]
        for dup in duplicate_ingredients:
            recommendations.append(dup["clinical_action"])

        return PrescriptionScreenResponse(
            screen_status=screen_status,
            rule_coverage=rule_coverage,
            interactions=interactions,
            contraindications=contraindications,
            duplicate_ingredients=duplicate_ingredients,
            candidate_alternatives=candidate_alternatives,
            evaluated_drugs=evaluated_drugs,
            unindexed_drugs=unindexed_drugs,
            recommendations=recommendations,
            clinical_disclaimer="Deterministic screening reflects verified DailyMed SPL rules in local CDSS database. This screening does not replace clinician evaluation and does not guarantee complete absence of unindexed interactions."
        )


_global_orchestrator: Optional[CDSOrchestrator] = None


def get_cds_orchestrator() -> CDSOrchestrator:
    global _global_orchestrator
    if _global_orchestrator is None:
        _global_orchestrator = CDSOrchestrator()
    return _global_orchestrator
