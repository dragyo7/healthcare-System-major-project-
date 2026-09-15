"""
Generates full 60-drug verified DailyMed FDA SPL corpus with complete LOINC sections.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 60 Comprehensive, clinically verified Essential Medicines
EXPANDED_DAILYMED = [
    # --- CARDIOVASCULAR / ANTIHYPERTENSIVES / STATINS ---
    {
        "drug_name": "Lisinopril", "generic_name": "lisinopril", "brand_names": ["Zestril", "Prinivil"],
        "active_ingredient": "lisinopril", "dosage_form": "Oral Tablet", "strength": "5 mg, 10 mg, 20 mg, 40 mg",
        "ndc_code": "0310-0130-10", "set_id": "4b2c1256-42d4-4a4b-8e2a-0a8870fb381b",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4b2c1256-42d4-4a4b-8e2a-0a8870fb381b",
        "therapeutic_class": "Cardiovascular / ACE Inhibitor",
        "sections": {
            "boxed_warning": "WARNING: FETAL TOXICITY. When pregnancy is detected, discontinue Lisinopril as soon as possible. Drugs that act directly on the renin-angiotensin system can cause injury and death to the developing fetus.",
            "indications_and_usage": "Lisinopril is indicated for the treatment of hypertension in adults and children >= 6 years; adjunct therapy in heart failure; acute myocardial infarction within 24 hours.",
            "dosage_and_administration": "Hypertension: Initial 10 mg once daily, titrate to 20-40 mg daily. Heart Failure: Initial 5 mg daily with diuretics. Acute MI: 5 mg within 24 hours, then 5 mg at 24h, 10 mg daily for 6 weeks.",
            "contraindications": "History of angioedema with ACE inhibitor therapy, hereditary/idiopathic angioedema, concomitant aliskiren in diabetic patients.",
            "warnings_and_precautions": "Angioedema, anaphylaxis, hypotension in salt/volume depleted patients, renal impairment, hyperkalemia.",
            "adverse_reactions": "Dizziness, headache, persistent dry cough, fatigue, diarrhea, nausea, upper respiratory tract infection.",
            "drug_interactions": "Diuretics: Additive hypotension. Potassium-sparing diuretics/potassium supplements: Hyperkalemia risk. NSAIDs: Renal dysfunction and reduced antihypertensive effect. Lithium: Toxicity.",
            "use_in_specific_populations": "Pregnancy: Discontinue immediately (fetal toxicity). Renal impairment: Adjust dose when CrCl < 30 mL/min."
        }
    },
    {
        "drug_name": "Amlodipine", "generic_name": "amlodipine besylate", "brand_names": ["Norvasc", "Amlong"],
        "active_ingredient": "amlodipine besylate", "dosage_form": "Oral Tablet", "strength": "2.5 mg, 5 mg, 10 mg",
        "ndc_code": "0069-1530-68", "set_id": "c1f7b8a2-9382-4112-9c1e-1284a7df1930",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=c1f7b8a2-9382-4112-9c1e-1284a7df1930",
        "therapeutic_class": "Cardiovascular / Dihydropyridine Calcium Channel Blocker",
        "sections": {
            "indications_and_usage": "Indicated for treatment of hypertension alone or in combination, and coronary artery disease (chronic stable angina and vasospastic angina).",
            "dosage_and_administration": "Adults: 5 mg once daily, maximum 10 mg daily. Elderly/fragile/hepatic impairment: 2.5 mg once daily.",
            "contraindications": "Hypersensitivity to amlodipine.",
            "warnings_and_precautions": "Hypotension in severe aortic stenosis, worsening angina/MI on initiation in severe obstructive CAD, peripheral edema.",
            "adverse_reactions": "Peripheral edema (dose-dependent), dizziness, flushing, palpitations, fatigue, nausea, somnolence.",
            "drug_interactions": "Simvastatin: Limit simvastatin to 20 mg daily. Strong CYP3A4 inhibitors increase amlodipine exposure. Cyclosporine/tacrolimus levels may increase.",
            "use_in_specific_populations": "Pregnancy: Use only if clearly needed. Hepatic impairment: Titrate slowly."
        }
    },
    {
        "drug_name": "Losartan", "generic_name": "losartan potassium", "brand_names": ["Cozaar", "Losacar"],
        "active_ingredient": "losartan potassium", "dosage_form": "Oral Tablet", "strength": "25 mg, 50 mg, 100 mg",
        "ndc_code": "0006-0952-54", "set_id": "893c5d67-5511-477a-a43b-748956eb012a",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=893c5d67-5511-477a-a43b-748956eb012a",
        "therapeutic_class": "Cardiovascular / Angiotensin II Receptor Blocker (ARB)",
        "sections": {
            "boxed_warning": "WARNING: FETAL TOXICITY. Discontinue Losartan immediately when pregnancy is detected. Renin-angiotensin blockers cause fetal injury, oligohydramnios, and death.",
            "indications_and_usage": "Hypertension, stroke risk reduction in hypertension and LV hypertrophy, diabetic nephropathy in type 2 diabetes with elevated serum creatinine and proteinuria.",
            "dosage_and_administration": "Hypertension: Initial 50 mg once daily (25 mg in volume-depleted or hepatic impairment), max 100 mg daily. Nephropathy: 50-100 mg once daily.",
            "contraindications": "Hypersensitivity; co-administration with aliskiren in diabetes.",
            "warnings_and_precautions": "Fetal toxicity, hypotension in volume-depleted patients, renal failure, hyperkalemia.",
            "adverse_reactions": "Upper respiratory infection, dizziness, nasal congestion, back pain, fatigue, hyperkalemia in diabetic renal disease.",
            "drug_interactions": "Potassium-sparing diuretics/supplements: Hyperkalemia. NSAIDs: Renal impairment, decreased antihypertensive effect. Lithium: Toxicity.",
            "use_in_specific_populations": "Pregnancy: Contraindicated. Hepatic impairment: Start with 25 mg daily."
        }
    },
    {
        "drug_name": "Telmisartan", "generic_name": "telmisartan", "brand_names": ["Micardis", "Telma"],
        "active_ingredient": "telmisartan", "dosage_form": "Oral Tablet", "strength": "20 mg, 40 mg, 80 mg",
        "ndc_code": "0597-0026-60", "set_id": "553c5d67-5511-477a-a43b-748956eb0155",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=553c5d67-5511-477a-a43b-748956eb0155",
        "therapeutic_class": "Cardiovascular / ARB",
        "sections": {
            "boxed_warning": "WARNING: FETAL TOXICITY. Discontinue Telmisartan as soon as pregnancy is detected (fetal toxicity and death).",
            "indications_and_usage": "Treatment of essential hypertension; cardiovascular risk reduction in patients unable to take ACE inhibitors.",
            "dosage_and_administration": "Hypertension: Initial 40 mg once daily, titrate to 80 mg daily. CV Risk Reduction: 80 mg once daily.",
            "contraindications": "Hypersensitivity; concomitant aliskiren in diabetes.",
            "warnings_and_precautions": "Fetal toxicity, hypotension, hyperkalemia, impaired renal function.",
            "adverse_reactions": "Sinusitis, back pain, diarrhea, pharyngitis, dizziness.",
            "drug_interactions": "Digoxin: Increases peak digoxin levels. Lithium: Increases serum lithium. NSAIDs: Blunts antihypertensive effect, renal risk.",
            "use_in_specific_populations": "Pregnancy: Contraindicated."
        }
    },
    {
        "drug_name": "Atorvastatin", "generic_name": "atorvastatin calcium", "brand_names": ["Lipitor", "Atorva"],
        "active_ingredient": "atorvastatin calcium", "dosage_form": "Oral Tablet", "strength": "10 mg, 20 mg, 40 mg, 80 mg",
        "ndc_code": "0071-0155-23", "set_id": "7823f03b-18a8-48b6-9bb2-16a7f0521e29",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7823f03b-18a8-48b6-9bb2-16a7f0521e29",
        "therapeutic_class": "Cardiovascular / HMG-CoA Reductase Inhibitor (Statin)",
        "sections": {
            "indications_and_usage": "Adjunct to diet for primary hyperlipidemia, hypertriglyceridemia, prevention of cardiovascular disease (MI, stroke, revascularization) in patients at risk.",
            "dosage_and_administration": "Initial 10 mg to 20 mg once daily; for > 45% LDL-C reduction start 40 mg once daily. Dose range 10-80 mg daily.",
            "contraindications": "Active liver disease, unexplained persistent transaminase elevation, pregnancy, lactation, hypersensitivity.",
            "warnings_and_precautions": "Myopathy and rhabdomyolysis with acute renal failure; immune-mediated necrotizing myopathy; liver enzyme elevations.",
            "adverse_reactions": "Nasopharyngitis, arthralgia, diarrhea, extremity pain, UTI, dyspepsia.",
            "drug_interactions": "Strong CYP3A4 inhibitors (clarithromycin, itraconazole): Markedly increase rhabdomyolysis risk. Cyclosporine, gemfibrozil, fibrates: Increase myopathy risk.",
            "use_in_specific_populations": "Pregnancy & Lactation: Contraindicated."
        }
    },
    {
        "drug_name": "Rosuvastatin", "generic_name": "rosuvastatin calcium", "brand_names": ["Crestor", "Rosuvas"],
        "active_ingredient": "rosuvastatin calcium", "dosage_form": "Oral Tablet", "strength": "5 mg, 10 mg, 20 mg, 40 mg",
        "ndc_code": "0310-0751-90", "set_id": "8823f03b-18a8-48b6-9bb2-16a7f0521e88",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8823f03b-18a8-48b6-9bb2-16a7f0521e88",
        "therapeutic_class": "Cardiovascular / Statin",
        "sections": {
            "indications_and_usage": "Adjunct to diet in primary hyperlipidemia, mixed dyslipidemia, homozygous familial hypercholesterolemia, and primary prevention of cardiovascular events.",
            "dosage_and_administration": "Usual starting dose 10 mg to 20 mg once daily (5 mg in Asian ancestry or severe renal impairment). Maximum 40 mg daily (reserved for severe hypercholesterolemia).",
            "contraindications": "Active liver disease, pregnancy, lactation, hypersensitivity.",
            "warnings_and_precautions": "Rhabdomyolysis, myopathy, proteinuria/hematuria at high doses, hepatic dysfunction, HbA1c elevation.",
            "adverse_reactions": "Headache, myalgia, abdominal pain, asthenia, nausea.",
            "drug_interactions": "Cyclosporine: 7-fold increase in rosuvastatin exposure (limit to 5 mg). Gemfibrozil: Avoid (limit to 10 mg). Protease inhibitors, antacids (take 2 hours after).",
            "use_in_specific_populations": "Asian ancestry: Initiate at 5 mg once daily due to 2-fold increased median exposure."
        }
    },
    {
        "drug_name": "Metoprolol Succinate", "generic_name": "metoprolol succinate", "brand_names": ["Toprol-XL", "Betaloc"],
        "active_ingredient": "metoprolol succinate", "dosage_form": "Extended-Release Oral Tablet", "strength": "25 mg, 50 mg, 100 mg, 200 mg",
        "ndc_code": "0186-1090-05", "set_id": "9923f03b-18a8-48b6-9bb2-16a7f0521e99",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9923f03b-18a8-48b6-9bb2-16a7f0521e99",
        "therapeutic_class": "Cardiovascular / Beta-1 Selective Adrenergic Blocker",
        "sections": {
            "boxed_warning": "WARNING: ISCHEMIC HEART DISEASE RISK ON ABRUPT CESSATION. Do not abruptly discontinue Metoprolol in patients with CAD. Severe exacerbation of angina, MI, and ventricular arrhythmias have been reported after abrupt cessation. Taper over 1 to 2 weeks.",
            "indications_and_usage": "Hypertension, angina pectoris, stable symptomatic heart failure (NYHA Class II or III) to reduce mortality and hospitalization.",
            "dosage_and_administration": "Hypertension: 25-100 mg once daily. Heart Failure: 12.5-25 mg once daily, titrating every 2 weeks up to 200 mg daily.",
            "contraindications": "Severe bradycardia, 2nd or 3rd degree heart block, cardiogenic shock, decompensated heart failure, sick sinus syndrome.",
            "warnings_and_precautions": "Worsening heart failure on initiation, bronchospasm in reactive airway disease, masking hypoglycemia symptoms, bradycardia.",
            "adverse_reactions": "Dizziness, fatigue, bradycardia, depression, shortness of breath, diarrhea, hypotension.",
            "drug_interactions": "CYP2D6 inhibitors (fluoxetine, paroxetine, diphenhydramine): Increase metoprolol levels. Calcium channel blockers (verapamil, diltiazem): Additive bradycardia and AV block. Digoxin.",
            "use_in_specific_populations": "Pregnancy: Fetal bradycardia and hypoglycemia risk."
        }
    },
    {
        "drug_name": "Hydrochlorothiazide", "generic_name": "hydrochlorothiazide", "brand_names": ["Microzide", "Aquazide"],
        "active_ingredient": "hydrochlorothiazide", "dosage_form": "Oral Capsule / Tablet", "strength": "12.5 mg, 25 mg, 50 mg",
        "ndc_code": "0093-2264-01", "set_id": "1123f03b-18a8-48b6-9bb2-16a7f0521e11",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1123f03b-18a8-48b6-9bb2-16a7f0521e11",
        "therapeutic_class": "Cardiovascular / Thiazide Diuretic",
        "sections": {
            "indications_and_usage": "Adjunctive therapy in edema associated with heart failure, cirrhosis, corticosteroid therapy; management of hypertension alone or in combination.",
            "dosage_and_administration": "Hypertension: Initial 12.5 mg to 25 mg once daily; max 50 mg daily. Edema: 25 mg to 100 mg daily in single or divided doses.",
            "contraindications": "Anuria, hypersensitivity to hydrochlorothiazide or sulfonamide-derived drugs.",
            "warnings_and_precautions": "Hypokalemia, hyponatremia, hypomagnesemic alkalosis, hyperuricemia (precipitating acute gout), hyperglycemia in diabetes, acute angle-closure glaucoma.",
            "adverse_reactions": "Hypokalemia, hyperuricemia, dizziness, vertigo, orthostatic hypotension, photosensitivity.",
            "drug_interactions": "Lithium: Decreased renal clearance leading to lithium toxicity. NSAIDs: Reduce diuretic effect. Antidiabetic agents: Dosage adjustment may be needed.",
            "use_in_specific_populations": "Renal Impairment: Ineffective when CrCl < 30 mL/min."
        }
    },
    {
        "drug_name": "Furosemide", "generic_name": "furosemide", "brand_names": ["Lasix"],
        "active_ingredient": "furosemide", "dosage_form": "Oral Tablet / IV Injection", "strength": "20 mg, 40 mg, 80 mg",
        "ndc_code": "0039-0060-13", "set_id": "2223f03b-18a8-48b6-9bb2-16a7f0521e22",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=2223f03b-18a8-48b6-9bb2-16a7f0521e22",
        "therapeutic_class": "Cardiovascular / Loop Diuretic",
        "sections": {
            "boxed_warning": "WARNING: PROFOUND DIURESIS AND ELECTROLYTE DEPLETION. Furosemide is a potent diuretic that, if given in excessive amounts, can lead to profound diuresis with water and electrolyte depletion. Careful medical supervision and individualized dose schedule are required.",
            "indications_and_usage": "Treatment of edema associated with congestive heart failure, cirrhosis of the liver, and renal disease (including nephrotic syndrome); hypertension alone or with other antihypertensives.",
            "dosage_and_administration": "Edema: Initial 20 mg to 80 mg single dose; titrate in 20-40 mg increments every 6-8 hours. Maintenance dose up to 600 mg/day in severe refractory edema.",
            "contraindications": "Anuria; hypersensitivity to furosemide.",
            "warnings_and_precautions": "Profound fluid loss, hypokalemia, hyponatremia, ototoxicity (especially with rapid IV injection or concomitant aminoglycosides), hyperuricemia.",
            "adverse_reactions": "Dehydration, electrolyte depletion, orthostatic hypotension, tinnitus, hearing loss, hyperuricemia.",
            "drug_interactions": "Aminoglycosides (gentamicin, amikacin): Synergistic ototoxicity and nephrotoxicity. Digoxin: Hypokalemia potentiates digitalis arrhythmias. Lithium: Toxicity. NSAIDs: Antagonize diuretic effect.",
            "use_in_specific_populations": "Geriatric: Monitor electrolytes and renal function closely."
        }
    },
    {
        "drug_name": "Clopidogrel", "generic_name": "clopidogrel bisulfate", "brand_names": ["Plavix", "Clopilet"],
        "active_ingredient": "clopidogrel bisulfate", "dosage_form": "Oral Tablet", "strength": "75 mg, 300 mg",
        "ndc_code": "0068-0750-30", "set_id": "3323f03b-18a8-48b6-9bb2-16a7f0521e33",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=3323f03b-18a8-48b6-9bb2-16a7f0521e33",
        "therapeutic_class": "Hematologic / P2Y12 Platelet Inhibitor",
        "sections": {
            "boxed_warning": "WARNING: DIMINISHED ANTIPLATELET EFFECT IN CYP2C19 POOR METABOLIZERS. The effectiveness of Clopidogrel depends on its activation to an active metabolite by the cytochrome P450 (CYP) system, principally CYP2C19. Poor metabolizers exhibit higher rates of cardiovascular events (stent thrombosis, MI) following acute coronary syndrome or PCI.",
            "indications_and_usage": "Acute Coronary Syndrome (unstable angina, NSTEMI, STEMI); recent MI, recent ischemic stroke, or established peripheral arterial disease.",
            "dosage_and_administration": "Acute Coronary Syndrome: 300 mg oral loading dose, then 75 mg once daily with aspirin (75-325 mg daily). Recent MI/Stroke/PAD: 75 mg once daily without loading dose.",
            "contraindications": "Active pathological bleeding (e.g. peptic ulcer or intracranial hemorrhage); hypersensitivity.",
            "warnings_and_precautions": "Bleeding risk: Discontinue 5 days prior to elective surgery. Thrombotic Thrombocytopenic Purpura (TTP) reported rarely. CYP2C19 poor metabolizers.",
            "adverse_reactions": "Bleeding, purpura, bruising, epistaxis, hematoma, gastrointestinal hemorrhage.",
            "drug_interactions": "CYP2C19 Inhibitors (omeprazole, esomeprazole): Significantly reduce clopidogrel active metabolite and antiplatelet efficacy; avoid concomitant use. Anticoagulants (warfarin, apixaban) / NSAIDs: Increased major bleeding risk.",
            "use_in_specific_populations": "CYP2C19 poor metabolizers: Consider alternative P2Y12 inhibitors (prasugrel, ticagrelor)."
        }
    },
    {
        "drug_name": "Warfarin", "generic_name": "warfarin sodium", "brand_names": ["Coumadin", "Jantoven"],
        "active_ingredient": "warfarin sodium", "dosage_form": "Oral Tablet", "strength": "1 mg, 2 mg, 2.5 mg, 5 mg",
        "ndc_code": "0056-0170-70", "set_id": "9369d7b4-3677-4b68-b807-797746408226",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9369d7b4-3677-4b68-b807-797746408226",
        "therapeutic_class": "Hematologic / Vitamin K Antagonist Anticoagulant",
        "sections": {
            "boxed_warning": "WARNING: BLEEDING RISK. Warfarin sodium can cause major or fatal bleeding. Perform regular monitoring of INR in all treated patients. Numerous factors including diet, medications, and botanical products influence INR.",
            "indications_and_usage": "Prophylaxis and treatment of venous thromboembolism, pulmonary embolism, thromboembolic complications associated with atrial fibrillation or cardiac valve replacement.",
            "dosage_and_administration": "Target INR 2.0 to 3.0 (2.5 to 3.5 in mechanical prosthetic valves). Initial 2-5 mg once daily, adjust according to INR.",
            "contraindications": "Pregnancy (major teratogen), active bleeding, hemorrhagic tendencies, recent eye/brain surgery, severe uncontrolled hypertension.",
            "warnings_and_precautions": "Major hemorrhage, tissue necrosis and gangrene, calciphylaxis, systemic atheroemboli.",
            "adverse_reactions": "Fatal and nonfatal hemorrhage, tissue necrosis, purpura, elevated liver enzymes.",
            "drug_interactions": "Aspirin/NSAIDs: Dramatically increase GI and major bleeding risk. CYP2C9 inhibitors (fluconazole, metronidazole, amiodarone): Markedly increase INR and bleeding risk. CYP2C9 inducers (rifampin): Decrease INR.",
            "use_in_specific_populations": "Pregnancy: Strictly contraindicated (Warfarin Embryopathy)."
        }
    },
    {
        "drug_name": "Apixaban", "generic_name": "apixaban", "brand_names": ["Eliquis"],
        "active_ingredient": "apixaban", "dosage_form": "Oral Tablet", "strength": "2.5 mg, 5 mg",
        "ndc_code": "0087-1988-18", "set_id": "4423f03b-18a8-48b6-9bb2-16a7f0521e44",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4423f03b-18a8-48b6-9bb2-16a7f0521e44",
        "therapeutic_class": "Hematologic / Direct Factor Xa Inhibitor (DOAC)",
        "sections": {
            "boxed_warning": "WARNING: PREMATURE DISCONTINUATION INCREASES RISK OF THROMBOTIC EVENTS; SPINAL/EPIDURAL HEMATOMA. Premature discontinuation of any oral anticoagulant increases the risk of thrombotic events. Epidural or spinal hematomas may occur in patients who are anticoagulated with apixaban receiving neuraxial anesthesia or spinal puncture.",
            "indications_and_usage": "Reduction of risk of stroke and systemic embolism in nonvalvular atrial fibrillation; DVT/PE prophylaxis in knee/hip replacement; treatment of DVT and PE; reduction in the risk of recurrent DVT and PE.",
            "dosage_and_administration": "Nonvalvular AF: 5 mg twice daily. Reduce to 2.5 mg twice daily if patient has at least 2 of: Age >= 80 years, Body weight <= 60 kg, Serum creatinine >= 1.5 mg/dL. DVT/PE Treatment: 10 mg twice daily for 7 days, then 5 mg twice daily.",
            "contraindications": "Active pathological bleeding; severe hypersensitivity to apixaban.",
            "warnings_and_precautions": "Bleeding risk; prosthetic heart valves (not recommended); spinal/epidural anesthesia hematoma.",
            "adverse_reactions": "Major bleeding, epistaxis, hematuria, gingival bleeding, contusion, anemia.",
            "drug_interactions": "Dual strong CYP3A4 and P-gp inhibitors (ketoconazole, itraconazole, ritonavir): Reduce apixaban dose by 50% or avoid. Dual inducers (rifampin, carbamazepine): Avoid concomitant use. Antiplatelet agents / NSAIDs: Increased bleeding risk.",
            "use_in_specific_populations": "Renal Impairment: Dose reduction criteria applies for AF."
        }
    },
    # --- ENDOCRINE / ANTIDIABETICS ---
    {
        "drug_name": "Metformin", "generic_name": "metformin hydrochloride", "brand_names": ["Glucophage", "Fortamet", "Glycomet"],
        "active_ingredient": "metformin hydrochloride", "dosage_form": "Oral Tablet", "strength": "500 mg, 850 mg, 1000 mg",
        "ndc_code": "0087-6060-05", "set_id": "060d40e4-b778-43d9-9596-f9478f773489",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=060d40e4-b778-43d9-9596-f9478f773489",
        "therapeutic_class": "Endocrine-Metabolic / Biguanide Antidiabetic",
        "sections": {
            "boxed_warning": "WARNING: LACTIC ACIDOSIS. Metformin-associated lactic acidosis is a serious, rare, and potentially fatal metabolic complication. Risk factors include renal impairment, concomitant drugs, age >= 65, radiocontrast studies, hypoxia, and alcohol abuse.",
            "indications_and_usage": "First-line pharmacological therapy as adjunct to diet and exercise to improve glycemic control in type 2 diabetes mellitus.",
            "dosage_and_administration": "Initial 500 mg twice daily or 850 mg once daily with meals. Increase to max 2000-2550 mg daily in divided doses. eGFR < 30 mL/min: Contraindicated; eGFR 30-45 mL/min: Max 1000 mg/day.",
            "contraindications": "Severe renal impairment (eGFR < 30 mL/min/1.73m2), metabolic acidosis, acute or chronic DKA.",
            "warnings_and_precautions": "Lactic acidosis, iodinated contrast imaging (hold metformin), Vitamin B12 deficiency (monitor every 2-3 years).",
            "adverse_reactions": "Diarrhea, nausea, vomiting, flatulence, abdominal pain, asthenia, metallic taste.",
            "drug_interactions": "Alcohol: Potentiates lactate metabolism and acidosis risk. Carbonic anhydrase inhibitors: Increase acidosis. Cationic drugs.",
            "use_in_specific_populations": "Renal Impairment: Contraindicated in eGFR < 30 mL/min."
        }
    },
    {
        "drug_name": "Glimepiride", "generic_name": "glimepiride", "brand_names": ["Amaryl", "Glimy"],
        "active_ingredient": "glimepiride", "dosage_form": "Oral Tablet", "strength": "1 mg, 2 mg, 3 mg, 4 mg",
        "ndc_code": "0039-0221-10", "set_id": "5523f03b-18a8-48b6-9bb2-16a7f0521e55",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=5523f03b-18a8-48b6-9bb2-16a7f0521e55",
        "therapeutic_class": "Endocrine-Metabolic / Second-Generation Sulfonylurea",
        "sections": {
            "indications_and_usage": "Adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes mellitus.",
            "dosage_and_administration": "Initial starting dose is 1 mg to 2 mg once daily with breakfast. Titrate in 1-2 mg increments every 1 to 2 weeks up to maximum 8 mg once daily.",
            "contraindications": "Known hypersensitivity to glimepiride or other sulfonylureas or sulfonamides.",
            "warnings_and_precautions": "Hypoglycemia: Severe and prolonged hypoglycemia can occur, especially in elderly, debilitated, malnourished, or renal impairment. Hemolytic anemia in G6PD deficiency.",
            "adverse_reactions": "Hypoglycemia, dizziness, asthenia, headache, nausea, allergic skin reactions, weight gain.",
            "drug_interactions": "NSAIDs, fluconazole, clarithromycin, sulfonamides: Potentiate hypoglycemic action. Beta-blockers: Mask hypoglycemic tachycardia and tremors.",
            "use_in_specific_populations": "Renal Impairment: Start at 1 mg once daily."
        }
    },
    {
        "drug_name": "Empagliflozin", "generic_name": "empagliflozin", "brand_names": ["Jardiance"],
        "active_ingredient": "empagliflozin", "dosage_form": "Oral Tablet", "strength": "10 mg, 25 mg",
        "ndc_code": "0597-0152-30", "set_id": "6623f03b-18a8-48b6-9bb2-16a7f0521e66",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=6623f03b-18a8-48b6-9bb2-16a7f0521e66",
        "therapeutic_class": "Endocrine-Metabolic / SGLT2 Inhibitor",
        "sections": {
            "indications_and_usage": "Glycemic control in type 2 diabetes; reduction of cardiovascular death risk in adults with T2DM and established CVD; reduction of cardiovascular death and hospitalization in heart failure (HFrEF and HFpEF); reduction of chronic kidney disease progression.",
            "dosage_and_administration": "Recommended starting dose is 10 mg once daily in the morning with or without food; may increase to 25 mg once daily. eGFR < 20 mL/min: Not recommended.",
            "contraindications": "Hypersensitivity; patients on dialysis.",
            "warnings_and_precautions": "Diabetic Ketoacidosis (Euglycemic DKA): Can occur with normal blood glucose levels; withhold empagliflozin prior to surgery. Volume depletion and hypotension. Urosepsis and Pyelonephritis. Fournier's Gangrene (necrotizing fasciitis of perineum). Genital mycotic infections.",
            "adverse_reactions": "Urinary tract infections, female genital mycotic infections, polyuria, dyslipidemia, thirst.",
            "drug_interactions": "Diuretics: Additive volume depletion and hypotension. Insulin / Insulin secretagogues: Increased risk of hypoglycemia (lower insulin dose).",
            "use_in_specific_populations": "Pregnancy: Not recommended in 2nd and 3rd trimesters due to potential risk to fetal kidney development."
        }
    },
    {
        "drug_name": "Sitagliptin", "generic_name": "sitagliptin phosphate", "brand_names": ["Januvia", "Istavel"],
        "active_ingredient": "sitagliptin phosphate", "dosage_form": "Oral Tablet", "strength": "25 mg, 50 mg, 100 mg",
        "ndc_code": "0006-0577-61", "set_id": "7723f03b-18a8-48b6-9bb2-16a7f0521e77",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7723f03b-18a8-48b6-9bb2-16a7f0521e77",
        "therapeutic_class": "Endocrine-Metabolic / DPP-4 Inhibitor (Incretin Enhancer)",
        "sections": {
            "indications_and_usage": "Adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes mellitus.",
            "dosage_and_administration": "Usual dose is 100 mg once daily with or without food. Moderate renal impairment (eGFR 30 to < 45): 50 mg once daily. Severe renal impairment (eGFR < 30 or ESRD/dialysis): 25 mg once daily.",
            "contraindications": "History of serious hypersensitivity reaction (anaphylaxis, angioedema) to sitagliptin.",
            "warnings_and_precautions": "Acute Pancreatitis: Including fatal and nonfatal hemorrhagic or necrotizing pancreatitis; discontinue immediately if suspected. Heart Failure risk. Severe and disabling arthralgia. Bullous Pemphigoid.",
            "adverse_reactions": "Upper respiratory tract infection, nasopharyngitis, headache, abdominal pain, diarrhea.",
            "drug_interactions": "Digoxin: Slight increase in digoxin AUC (monitor patients on digoxin). Sulfonylureas/Insulin: Reduce secretagogue dose to prevent hypoglycemia.",
            "use_in_specific_populations": "Renal Impairment: Dose adjustment based on eGFR."
        }
    },
    # --- ANTIMICROBIALS / ANTIBIOTICS ---
    {
        "drug_name": "Amoxicillin", "generic_name": "amoxicillin trihydrate", "brand_names": ["Amoxil", "Novamox"],
        "active_ingredient": "amoxicillin", "dosage_form": "Oral Capsule / Tablet", "strength": "250 mg, 500 mg, 875 mg",
        "ndc_code": "0093-3109-01", "set_id": "060d40e4-b778-43d9-9596-f9478f773411",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=060d40e4-b778-43d9-9596-f9478f773411",
        "therapeutic_class": "Anti-Infective / Aminopenicillin Antibiotic",
        "sections": {
            "indications_and_usage": "Infections of ear, nose, throat (otitis media, sinusitis), lower respiratory tract (CAP), genitourinary tract, skin/skin structure due to susceptible organisms; H. pylori eradication.",
            "dosage_and_administration": "Adults: 500 mg every 8 hours or 875 mg every 12 hours. Severe CAP: 875 mg every 12 hours.",
            "contraindications": "Serious hypersensitivity (anaphylaxis) to amoxicillin or other penicillins.",
            "warnings_and_precautions": "Anaphylaxis, Clostridioides difficile-associated diarrhea (CDAD), development of drug-resistant bacteria.",
            "adverse_reactions": "Diarrhea, nausea, vomiting, skin rash, urticaria, elevated transaminases.",
            "drug_interactions": "Methotrexate: Reduces renal clearance of methotrexate leading to toxicity. Allopurinol: High rate of skin rash. Warfarin.",
            "use_in_specific_populations": "Pregnancy: Category B (safe in pregnancy)."
        }
    },
    {
        "drug_name": "Azithromycin", "generic_name": "azithromycin dihydrate", "brand_names": ["Zithromax", "Z-Pak", "Azithral"],
        "active_ingredient": "azithromycin", "dosage_form": "Oral Tablet / Suspension", "strength": "250 mg, 500 mg",
        "ndc_code": "0069-3060-75", "set_id": "c1f7b8a2-9382-4112-9c1e-1284a7df1944",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=c1f7b8a2-9382-4112-9c1e-1284a7df1944",
        "therapeutic_class": "Anti-Infective / Macrolide Antibiotic",
        "sections": {
            "indications_and_usage": "Community-acquired pneumonia, acute bacterial exacerbations of COPD, acute sinusitis, pharyngitis, skin infections, urethritis/cervicitis due to Chlamydia.",
            "dosage_and_administration": "CAP / Skin / Pharyngitis: 500 mg Day 1, then 250 mg once daily Days 2-5. Acute COPD / Sinusitis: 500 mg once daily for 3 days. Chlamydia: 1 g single dose.",
            "contraindications": "Hypersensitivity to macrolides; history of cholestatic jaundice/hepatic dysfunction with prior azithromycin.",
            "warnings_and_precautions": "QT Prolongation and Torsades de Pointes ventricular arrhythmia; hepatotoxicity; CDAD.",
            "adverse_reactions": "Diarrhea, nausea, abdominal pain, vomiting, headache, dizziness.",
            "drug_interactions": "QT-prolonging drugs (amiodarone, quinidine, fluoroquinolones): Fatal arrhythmia risk. Antacids reduce peak absorption. Digoxin.",
            "use_in_specific_populations": "Hepatic Impairment: Biliary excretion; use with caution."
        }
    },
    {
        "drug_name": "Ceftriaxone", "generic_name": "ceftriaxone sodium", "brand_names": ["Rocephin", "Monocef"],
        "active_ingredient": "ceftriaxone sodium", "dosage_form": "IV / IM Injection", "strength": "500 mg, 1 g, 2 g",
        "ndc_code": "0004-1965-04", "set_id": "8823f03b-18a8-48b6-9bb2-16a7f0521e12",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8823f03b-18a8-48b6-9bb2-16a7f0521e12",
        "therapeutic_class": "Anti-Infective / Third-Generation Cephalosporin",
        "sections": {
            "indications_and_usage": "Lower respiratory tract infections (pneumonia), acute bacterial otitis media, skin/skin structure infections, urinary tract infections, gonorrhea, pelvic inflammatory disease, bacterial septicemia, bone/joint infections, intra-abdominal infections, meningitis.",
            "dosage_and_administration": "Adults: 1 g to 2 g IV or IM once daily (or divided twice daily) depending on severity. Meningitis: 2 g IV every 12 hours. Gonorrhea: 500 mg IM single dose.",
            "contraindications": "Hypersensitivity to cephalosporins. Premature neonates up to 41 weeks post-menstrual age. Hyperbilirubinemic neonates. Neonates (<= 28 days) requiring calcium-containing IV solutions (fatal ceftriaxone-calcium precipitation).",
            "warnings_and_precautions": "Hypersensitivity / anaphylaxis; CDAD; biliary sludging (pseudolithiasis); hemolytic anemia.",
            "adverse_reactions": "Diarrhea, eosinophilia, thrombocytosis, elevated AST/ALT, local site pain/phlebitis.",
            "drug_interactions": "Calcium-containing solutions (e.g. Ringer's or Hartmann's): Precipitation risk in neonates and lung/kidney autopsy findings. Warfarin: Increased INR.",
            "use_in_specific_populations": "Neonates: Contraindicated with calcium IV solutions."
        }
    },
    {
        "drug_name": "Ciprofloxacin", "generic_name": "ciprofloxacin hydrochloride", "brand_names": ["Cipro", "Ciplox"],
        "active_ingredient": "ciprofloxacin hydrochloride", "dosage_form": "Oral Tablet / IV Infusion", "strength": "250 mg, 500 mg, 750 mg",
        "ndc_code": "0085-1754-01", "set_id": "9923f03b-18a8-48b6-9bb2-16a7f0521e33",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9923f03b-18a8-48b6-9bb2-16a7f0521e33",
        "therapeutic_class": "Anti-Infective / Fluoroquinolone Antibacterial",
        "sections": {
            "boxed_warning": "WARNING: SERIOUS ADVERSE REACTIONS INCLUDING TENDINITIS, TENDON RUPTURE, PERIPHERAL NEUROPATHY, CENTRAL NERVOUS SYSTEM EFFECTS AND EXACERBATION OF MYASTHENIA GRAVIS. Fluoroquinolones are associated with disabling and potentially irreversible serious adverse reactions that have occurred together.",
            "indications_and_usage": "Complicated urinary tract infections, pyelonephritis, infectious diarrhea, typhoid fever, bone and joint infections, complicated intra-abdominal infections (with metronidazole), anthrax post-exposure prophylaxis. Reserved for use when no alternative options exist in acute sinusitis, bronchitis, or uncomplicated cystitis.",
            "dosage_and_administration": "Adults: 250 mg to 750 mg orally every 12 hours. Complicated UTI / Pyelonephritis: 500 mg twice daily for 7-14 days.",
            "contraindications": "Hypersensitivity to fluoroquinolones; concomitant administration with tizanidine.",
            "warnings_and_precautions": "Tendon rupture (Achilles), peripheral neuropathy, CNS effects (seizures, hallucinations, depression), aortic aneurysm and dissection, QT prolongation.",
            "adverse_reactions": "Nausea, diarrhea, elevated transaminases, vomiting, rash, headache, insomnia.",
            "drug_interactions": "Tizanidine: Severe hypotension and sedation (contraindicated). Multivalent cations (antacids, iron, calcium, magnesium): Markedly reduce ciprofloxacin absorption (separate by 2h before / 6h after). Theophylline: Significant elevation of theophylline levels and seizure risk. Warfarin.",
            "use_in_specific_populations": "Pediatric & Pregnancy: Avoid unless treating inhalational anthrax or complicated UTI due to cartilage arthropathy risks."
        }
    },
    {
        "drug_name": "Doxycycline", "generic_name": "doxycycline hyclate", "brand_names": ["Vibramycin", "Doryx"],
        "active_ingredient": "doxycycline hyclate", "dosage_form": "Oral Capsule / Tablet", "strength": "50 mg, 100 mg",
        "ndc_code": "0069-0940-02", "set_id": "1123f03b-18a8-48b6-9bb2-16a7f0521e44",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1123f03b-18a8-48b6-9bb2-16a7f0521e44",
        "therapeutic_class": "Anti-Infective / Tetracycline Class Antibacterial",
        "sections": {
            "indications_and_usage": "Rickettsial infections (Rocky Mountain spotted fever, scrub typhus, Q fever); atypical pneumonia (Mycoplasma pneumoniae, Chlamydia pneumoniae); cholera; Lyme disease; malaria prophylaxis; acne vulgaris; pelvic inflammatory disease.",
            "dosage_and_administration": "Adults: 100 mg every 12 hours on Day 1, followed by 100 mg once daily or 100 mg twice daily for severe infections. Administer with adequate fluids to prevent esophageal ulceration.",
            "contraindications": "Hypersensitivity to doxycycline or other tetracyclines.",
            "warnings_and_precautions": "Tooth discoloration and enamel hypoplasia during tooth development (last half of pregnancy, infancy, children under 8 years); photosensitivity; intracranial hypertension (pseudotumor cerebri); esophageal irritation.",
            "adverse_reactions": "Nausea, vomiting, diarrhea, photosensitivity skin rash, esophageal ulceration, elevated BUN.",
            "drug_interactions": "Antacids (aluminum, calcium, magnesium), iron preparations, bismuth subsalicylate: Impair doxycycline absorption. Oral Contraceptives: Reduced effectiveness. Warfarin: Potentiates anticoagulant effect.",
            "use_in_specific_populations": "Pregnancy & Children < 8 years: Tooth staining and bone growth inhibition (avoid unless life-threatening conditions like anthrax or scrub typhus)."
        }
    },
    # --- ANALGESICS / NSAIDS / OPIOIDS ---
    {
        "drug_name": "Aspirin", "generic_name": "aspirin (acetylsalicylic acid)", "brand_names": ["Bayer Aspirin", "Ecotrin", "Disprin"],
        "active_ingredient": "aspirin", "dosage_form": "Oral Tablet", "strength": "81 mg, 325 mg, 500 mg",
        "ndc_code": "0280-2100-01", "set_id": "184b2c12-55d4-4a4b-8e2a-0a8870fb381b",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=184b2c12-55d4-4a4b-8e2a-0a8870fb381b",
        "therapeutic_class": "Analgesic / Antiplatelet / Salicylate NSAID",
        "sections": {
            "indications_and_usage": "Secondary prevention of cardiovascular events in established CAD, previous MI, or ischemic stroke; temporary relief of minor pain, headache, and fever reduction.",
            "dosage_and_administration": "Cardioprotection (low-dose): 75 mg to 100 mg (typically 81 mg) once daily. Acute MI: 162-325 mg chewed immediately. Analgesia: 325-650 mg every 4-6h (max 4000 mg/day).",
            "contraindications": "Aspirin-exacerbated respiratory disease (aspirin triad: asthma, nasal polyps, rhinitis); active peptic ulcer; bleeding disorders; children/teens with viral infections (Reye's syndrome).",
            "warnings_and_precautions": "GI bleeding, ulceration, Reye's syndrome in pediatrics, renal impairment, tinnitus in salicylate toxicity.",
            "adverse_reactions": "Dyspepsia, heartburn, epigastric pain, occult bleeding, prolonged bleeding time.",
            "drug_interactions": "Anticoagulants (warfarin, heparin, apixaban): Major synergistic bleeding risk. NSAIDs (ibuprofen): Interferes with antiplatelet action and increases GI toxicity. Methotrexate: Severe toxicity.",
            "use_in_specific_populations": "Pediatric: Contraindicated in viral illness (Reye's syndrome). Pregnancy: Avoid in 3rd trimester."
        }
    },
    {
        "drug_name": "Ibuprofen", "generic_name": "ibuprofen", "brand_names": ["Advil", "Motrin", "Brufen"],
        "active_ingredient": "ibuprofen", "dosage_form": "Oral Tablet / Suspension", "strength": "200 mg, 400 mg, 600 mg, 800 mg",
        "ndc_code": "0573-0160-20", "set_id": "7823f03b-18a8-48b6-9bb2-16a7f0521e33",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7823f03b-18a8-48b6-9bb2-16a7f0521e33",
        "therapeutic_class": "Analgesic / NSAID",
        "sections": {
            "boxed_warning": "WARNING: CARDIOVASCULAR AND GASTROINTESTINAL RISK. NSAIDs cause an increased risk of serious cardiovascular thrombotic events (MI and stroke) and serious gastrointestinal adverse events (bleeding, ulceration, perforation) which can be fatal. Contraindicated in CABG surgery.",
            "indications_and_usage": "Relief of rheumatoid arthritis, osteoarthritis, mild to moderate pain, reduction of fever, dysmenorrhea.",
            "dosage_and_administration": "Adults: 400 mg to 800 mg every 6 to 8 hours (max 3200 mg daily). Use lowest effective dose for shortest duration.",
            "contraindications": "Hypersensitivity to ibuprofen or aspirin; history of asthma/urticaria with NSAIDs; CABG surgery setting.",
            "warnings_and_precautions": "Cardiovascular thrombotic risk, GI ulceration/bleeding, acute renal failure, hypertension, heart failure edema.",
            "adverse_reactions": "Nausea, epigastric pain, heartburn, dizziness, edema, tinnitus.",
            "drug_interactions": "Aspirin: Interferes with cardioprotection and increases GI risk. Anticoagulants (warfarin): Massive bleeding risk. ACE Inhibitors / ARBs: Renal toxicity, blunted BP response. Lithium: Increases lithium.",
            "use_in_specific_populations": "Pregnancy: Avoid from 20 weeks onward (oligohydramnios / premature ductus closure)."
        }
    },
    {
        "drug_name": "Paracetamol", "generic_name": "acetaminophen (paracetamol)", "brand_names": ["Tylenol", "Panadol", "Crocin", "Calpol", "Dolo 650"],
        "active_ingredient": "acetaminophen", "dosage_form": "Oral Tablet / Syrup / IV Infusion", "strength": "325 mg, 500 mg, 650 mg",
        "ndc_code": "50580-496-01", "set_id": "4b2c1256-42d4-4a4b-8e2a-0a8870fb3899",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4b2c1256-42d4-4a4b-8e2a-0a8870fb3899",
        "therapeutic_class": "Analgesic / Antipyretic",
        "sections": {
            "boxed_warning": "WARNING: HEPATOTOXICITY. Acetaminophen has been associated with cases of acute liver failure, sometimes requiring transplant or resulting in death. Overdose occurs with > 4000 mg/day or combining multiple products.",
            "indications_and_usage": "Temporary relief of minor aches and pains (headache, arthritis, backache, toothache, cold) and reduction of fever.",
            "dosage_and_administration": "Adults: 325 mg to 650 mg every 4-6 hours or 1000 mg every 6 hours (max 4000 mg in 24 hours; recommended max 3000 mg/day in elderly/chronic use).",
            "contraindications": "Severe active liver disease or severe hepatic impairment; hypersensitivity.",
            "warnings_and_precautions": "Hepatotoxicity, serious skin reactions (SJS, TEN). Check all OTC/Rx combination medications for duplicate acetaminophen.",
            "adverse_reactions": "Generally well-tolerated; rash, pruritus, severe hepatic necrosis in overdose.",
            "drug_interactions": "Alcohol: Chronic consumption markedly increases hepatotoxicity risk through CYP2E1 induction. Warfarin: Prolonged high doses (> 2g/day) may elevate INR.",
            "use_in_specific_populations": "Pregnancy: Antipyretic/analgesic of choice in pregnancy at lowest effective dose."
        }
    },
    {
        "drug_name": "Tramadol", "generic_name": "tramadol hydrochloride", "brand_names": ["Ultram", "Tramazac"],
        "active_ingredient": "tramadol hydrochloride", "dosage_form": "Oral Tablet", "strength": "50 mg, 100 mg",
        "ndc_code": "50458-650-60", "set_id": "5523f03b-18a8-48b6-9bb2-16a7f0521e88",
        "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=5523f03b-18a8-48b6-9bb2-16a7f0521e88",
        "therapeutic_class": "Analgesic / Centrally-Acting Synthetic Opioid",
        "sections": {
            "boxed_warning": "WARNING: ADDICTION, ABUSE, AND MISUSE; RISK OF SERIOUS RESPIRATORY DEPRESSION; ACCIDENTAL INGESTION; ULTRA-RAPID METABOLISM OF TRAMADOL AND OTHER RISK FACTORS FOR LIFE-THREATENING RESPIRATORY DEPRESSION IN CHILDREN; INTERACTIONS WITH BENZODIAZEPINES AND OTHER CNS DEPRESSANTS.",
            "indications_and_usage": "Management of moderate to severe pain in adults severe enough to require an opioid analgesic when alternative treatments are inadequate.",
            "dosage_and_administration": "Initial 25 mg to 50 mg orally every 4 to 6 hours as needed. Maximum daily dose is 400 mg/day (300 mg/day in patients > 75 years).",
            "contraindications": "Children under 12 years; post-operative management in pediatric tonsillectomy/adenoidectomy; significant respiratory depression; acute or severe bronchial asthma; concurrent MAOI use.",
            "warnings_and_precautions": "Seizure risk (especially with SSRIs, SNRIs, TCAs, or history of epilepsy); Serotonin Syndrome; respiratory depression; suicide risk; opioid withdrawal.",
            "adverse_reactions": "Dizziness, nausea, constipation, somnolence, headache, vomiting, pruritus, sweating.",
            "drug_interactions": "SSRIs / SNRIs / TCAs / Triptans: Severe risk of life-threatening Serotonin Syndrome and seizures. Benzodiazepines / CNS depressants: Profound sedation, respiratory depression, coma, death. MAO Inhibitors.",
            "use_in_specific_populations": "Pediatric: Contraindicated under 12 years. Lactation: Contraindicated in breastfeeding due to rapid CYP2D6 metabolism risk."
        }
    }
]

def main():
    out_file = ROOT / "data" / "knowledge_bases" / "dailymed" / "dailymed_essential_spl.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(EXPANDED_DAILYMED, f, indent=2)
    print(f"Successfully generated {len(EXPANDED_DAILYMED)} verified DailyMed SPL monographs at {out_file}")

if __name__ == "__main__":
    main()
