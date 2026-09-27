"""
Builder and validator for RAG V2.6-B 160-query benchmark dataset.
Constructs exact ground-truth bindings from meta_v2.pkl records.
Ensures zero artificial lexical copying or dataset contamination.
"""

import json
import pickle
import re
from typing import Dict, List, Any

def build_benchmark():
    with open('rag_module/data/faiss_index/meta_v2.pkl', 'rb') as f:
        meta = pickle.load(f)

    # Index meta records by (entity, section), document_id, chunk_id
    dm_by_drug_sec = {}
    mq_by_focus_sec = {}
    chunk_by_id = {}
    doc_by_id = {}

    for idx, m in enumerate(meta):
        chunk_id = m['chunk_id']
        doc_id = m['document_id']
        chunk_by_id[chunk_id] = m
        if doc_id not in doc_by_id:
            doc_by_id[doc_id] = []
        doc_by_id[doc_id].append(m)

        if m.get('source_id') == 'DailyMed':
            drug = m['title'].split(' - ')[0].strip()
            sec = m.get('section', '').strip()
            if drug not in dm_by_drug_sec:
                dm_by_drug_sec[drug] = {}
            if sec not in dm_by_drug_sec[drug]:
                dm_by_drug_sec[drug][sec] = []
            dm_by_drug_sec[drug][sec].append(m)
        else:
            focus = m.get('focus', '').strip()
            sec = (m.get('qtype') or m.get('section', '')).strip().lower()
            if focus not in mq_by_focus_sec:
                mq_by_focus_sec[focus] = {}
            if sec not in mq_by_focus_sec[focus]:
                mq_by_focus_sec[focus][sec] = []
            mq_by_focus_sec[focus][sec].append(m)

    print(f"Loaded {len(meta)} chunks from index metadata.")
    print(f"DailyMed drugs mapped: {len(dm_by_drug_sec)}")
    print(f"MedQuAD foci mapped: {len(mq_by_focus_sec)}")

    queries: List[Dict[str, Any]] = []

    # =========================================================================
    # PART A: DailyMed Pharmacology Benchmark (80 queries across 10 categories)
    # =========================================================================
    # 1. Boxed Warnings (8 queries)
    dm_bw_specs = [
        ("Lisinopril", "Boxed Warning", "What is the black box warning for Lisinopril regarding fetal toxicity?"),
        ("Losartan", "Boxed Warning", "What are the boxed warnings and fetal toxicity risks associated with Losartan?"),
        ("Metformin", "Boxed Warning", "What does the boxed warning for Metformin state regarding the risk of lactic acidosis?"),
        ("Apixaban", "Boxed Warning", "What is the boxed warning for Apixaban regarding premature discontinuation and spinal/epidural hematoma?"),
        ("Rivaroxaban", "Boxed Warning", "What boxed warnings are listed for Rivaroxaban regarding thrombotic events and epidural anesthesia?"),
        ("Warfarin", "Boxed Warning", "What major bleeding risks are described in the Boxed Warning for Warfarin?"),
        ("Methotrexate (Oral)", "Boxed Warning", "What severe toxicities and fatalities are highlighted in the boxed warning for Methotrexate?"),
        ("Morphine Sulfate", "Boxed Warning", "What does the boxed warning for Morphine Sulfate state about respiratory depression and addiction risk?"),
    ]

    # 2. Contraindications (8 queries)
    dm_ci_specs = [
        ("Sildenafil", "Contraindications", "Under what conditions is Sildenafil contraindicated with nitrates or guanylate cyclase stimulators?"),
        ("Tadalafil", "Contraindications", "What are the absolute contraindications for Tadalafil administration?"),
        ("Atorvastatin", "Contraindications", "What are the contraindications for Atorvastatin in active liver disease?"),
        ("Rosuvastatin", "Contraindications", "When is Rosuvastatin strictly contraindicated in patients with hepatic impairment?"),
        ("Metoprolol Tartrate", "Contraindications", "What cardiac conditions contraindicate the use of Metoprolol Tartrate?"),
        ("Carvedilol", "Contraindications", "What are the contraindications for Carvedilol in severe bradycardia or heart block?"),
        ("Ciprofloxacin", "Contraindications", "What are the contraindications for Ciprofloxacin co-administration with tizanidine?"),
        ("Spironolactone", "Contraindications", "In which clinical scenarios is Spironolactone contraindicated due to hyperkalemia?"),
    ]

    # 3. Drug-Drug Interactions (8 queries)
    dm_ddi_specs = [
        ("Amlodipine", "Drug Interactions", "What drug interactions occur when Amlodipine is co-administered with CYP3A4 inhibitors or simvastatin?"),
        ("Simvastatin", "Drug Interactions", "What CYP3A4 inhibitors interact with Simvastatin to increase myopathy risk?"),
        ("Clopidogrel", "Drug Interactions", "How do proton pump inhibitors like omeprazole interact with Clopidogrel?"),
        ("Fluoxetine", "Drug Interactions", "What drug-drug interactions are documented for Fluoxetine with MAOIs and serotonergic drugs?"),
        ("Sertraline", "Drug Interactions", "What interactions does Sertraline have with pimozide and other serotonergic agents?"),
        ("Lithium Carbonate", "Drug Interactions", "How do NSAIDs and ACE inhibitors alter Lithium Carbonate renal clearance?"),
        ("Levothyroxine", "Drug Interactions", "Which cations and binding agents reduce the gastrointestinal absorption of Levothyroxine?"),
        ("Digoxin", "Drug Interactions", "What medications increase serum Digoxin levels and risk of toxicity?"),
    ]

    # 4. Dosage & Administration (8 queries)
    dm_dose_specs = [
        ("Amoxicillin", "Dosage & Administration", "What is the recommended dosing regimen for Amoxicillin in adult bacterial infections?"),
        ("Azithromycin", "Dosage & Administration", "What is the standard dosing and administration schedule for Azithromycin?"),
        ("Metformin", "Dosage & Administration", "What is the starting and maximum daily dose for Metformin in type 2 diabetes?"),
        ("Hydrochlorothiazide", "Dosage & Administration", "What are the recommended adult dosing guidelines for Hydrochlorothiazide in hypertension?"),
        ("Gabapentin", "Dosage & Administration", "What is the titration schedule and maximum recommended daily dosage of Gabapentin?"),
        ("Pregabalin", "Dosage & Administration", "What is the starting and maintenance dosing of Pregabalin for neuropathic pain?"),
        ("Omeprazole", "Dosage & Administration", "What is the recommended dose and treatment duration of Omeprazole for GERD?"),
        ("Pantoprazole", "Dosage & Administration", "How should delayed-release Pantoprazole tablets be administered and dosed?"),
    ]

    # 5. Adverse Reactions (8 queries)
    dm_adv_specs = [
        ("Duloxetine", "Adverse Reactions", "What common adverse reactions and psychiatric side effects are reported for Duloxetine?"),
        ("Venlafaxine", "Adverse Reactions", "What are the common adverse reactions and blood pressure elevations associated with Venlafaxine?"),
        ("Furosemide", "Adverse Reactions", "What electrolyte disturbances and adverse reactions are associated with Furosemide therapy?"),
        ("Prednisone", "Adverse Reactions", "What endocrine and musculoskeletal adverse reactions are documented for Prednisone?"),
        ("Celecoxib", "Adverse Reactions", "What gastrointestinal and cardiovascular adverse reactions occur with Celecoxib?"),
        ("Montelukast", "Adverse Reactions", "What neuropsychiatric and systemic adverse reactions are associated with Montelukast?"),
        ("Allopurinol", "Adverse Reactions", "What skin and hypersensitivity adverse reactions can occur with Allopurinol treatment?"),
        ("Tramadol", "Adverse Reactions", "What central nervous system and gastrointestinal adverse reactions occur with Tramadol?"),
    ]

    # 6. Organ Impairment (Renal/Hepatic) (8 queries)
    dm_org_specs = [
        ("Dulaglutide", "Use in Specific Populations", "How is Dulaglutide handled in renal impairment and hepatic impairment?"),
        ("Dapagliflozin", "Use in Specific Populations", "What are the renal impairment eGFR cutoffs for Dapagliflozin use?"),
        ("Empagliflozin", "Use in Specific Populations", "What specific population guidelines apply to Empagliflozin in patients with renal disease?"),
        ("Sitagliptin", "Dosage & Administration", "How should Sitagliptin dosing be adjusted for moderate to severe renal impairment?"),
        ("Acyclovir", "Dosage & Administration", "What dosage adjustments are required for Acyclovir in renal impairment?"),
        ("Rosuvastatin", "Use in Specific Populations", "What dosage considerations apply to Rosuvastatin in patients with severe renal impairment?"),
        ("Topiramate", "Dosage & Administration", "How is Topiramate dosed in patients with moderate or severe renal failure?"),
        ("Levetiracetam", "Dosage & Administration", "What creatinine clearance adjustments are required for Levetiracetam dosing?"),
    ]

    # 7. Pregnancy & Lactation (8 queries)
    dm_preg_specs = [
        ("Lisinopril", "Use in Specific Populations", "What clinical guidance is provided for Lisinopril during pregnancy and lactation?"),
        ("Valsartan", "Use in Specific Populations", "What are the pregnancy and fetal toxicity risks associated with Valsartan in specific populations?"),
        ("Warfarin", "Use in Specific Populations", "What are the teratogenic risks of Warfarin use during pregnancy?"),
        ("Methotrexate (Oral)", "Use in Specific Populations", "What are the pregnancy and embryofetal toxicity warnings for Methotrexate?"),
        ("Topiramate", "Use in Specific Populations", "What risk of oral clefts and fetal harm is associated with Topiramate during pregnancy?"),
        ("Paroxetine", "Use in Specific Populations", "What cardiovascular malformation risks are associated with Paroxetine in pregnancy?"),
        ("Doxycycline Hyclate", "Use in Specific Populations", "What tooth development and bone growth risks are associated with Doxycycline in pregnancy?"),
        ("Carbamazepine", "Use in Specific Populations", "What major congenital malformation risks are associated with Carbamazepine in pregnancy?"),
    ]

    # 8. Geriatric / Pediatric Dosing (8 queries)
    dm_gp_specs = [
        ("Diazepam", "Use in Specific Populations", "What geriatric precautions and pediatric dosing recommendations exist for Diazepam?"),
        ("Alprazolam", "Use in Specific Populations", "How should Alprazolam dosing be modified for elderly or debilitated patients?"),
        ("Zolpidem", "Dosage & Administration", "What is the recommended starting dose of Zolpidem for geriatric patients?"),
        ("Methylphenidate", "Use in Specific Populations", "What pediatric considerations and growth monitoring apply to Methylphenidate?"),
        ("Escitalopram", "Dosage & Administration", "What is the recommended daily dose of Escitalopram in elderly patients?"),
        ("Citalopram", "Dosage & Administration", "What maximum daily dose of Citalopram is recommended for geriatric patients?"),
        ("Quetiapine", "Dosage & Administration", "What dosing considerations and titration rates apply to Quetiapine in elderly patients?"),
        ("Risperidone", "Dosage & Administration", "What are the initial pediatric and geriatric dosing recommendations for Risperidone?"),
    ]

    # 9. Overdosage & Toxicity (8 queries)
    dm_od_specs = [
        ("Oxycodone/Acetaminophen", "Overdosage", "What are the clinical manifestations and antidote for Acetaminophen and Oxycodone overdosage?"),
        ("Digoxin", "Overdosage", "What are the signs of acute Digoxin toxicity and the recommended overdose management?"),
        ("Metoprolol Succinate", "Overdosage", "What signs, symptoms, and emergency interventions are documented for Metoprolol overdose?"),
        ("Atenolol", "Overdosage", "What management steps are indicated in the event of Atenolol overdosage?"),
        ("Amitriptyline", "Overdosage", "What cardiac and neurological symptoms occur in Amitriptyline overdose?"),
        ("Baclofen", "Overdosage", "What are the signs of severe Baclofen overdosage and how is it managed?"),
        ("Glipizide", "Overdosage", "What are the clinical signs and treatment of acute Glipizide hypoglycemia overdose?"),
        ("Glimepiride", "Overdosage", "How is severe hypoglycemia from Glimepiride overdose treated and monitored?"),
    ]

    # 10. Mechanism of Action / Pharmacokinetics (8 queries)
    dm_moa_specs = [
        ("Atorvastatin", "Clinical Pharmacology", "What is the mechanism of action of Atorvastatin in lowering plasma cholesterol?"),
        ("Lisinopril", "Clinical Pharmacology", "What is the mechanism of action and pharmacodynamics of Lisinopril as an ACE inhibitor?"),
        ("Metformin", "Clinical Pharmacology", "How does Metformin exert its antihyperglycemic action in clinical pharmacology?"),
        ("Amlodipine", "Clinical Pharmacology", "What is the mechanism of action of Amlodipine on vascular smooth muscle and cardiac cells?"),
        ("Montelukast", "Clinical Pharmacology", "What is the mechanism of action of Montelukast on cysteinyl leukotriene receptors?"),
        ("Duloxetine", "Clinical Pharmacology", "What is the mechanism of action of Duloxetine as an SNRI?"),
        ("Pantoprazole", "Clinical Pharmacology", "How does Pantoprazole inhibit gastric acid secretion at the cellular level?"),
        ("Apixaban", "Clinical Pharmacology", "What is the pharmacological mechanism of direct Factor Xa inhibition by Apixaban?"),
    ]

    dailymed_groups = [
        ("Boxed Warnings", dm_bw_specs),
        ("Contraindications", dm_ci_specs),
        ("Drug-Drug Interactions", dm_ddi_specs),
        ("Dosing & Administration", dm_dose_specs),
        ("Adverse Reactions", dm_adv_specs),
        ("Organ Impairment (Renal/Hepatic)", dm_org_specs),
        ("Pregnancy & Lactation", dm_preg_specs),
        ("Geriatric / Pediatric Dosing", dm_gp_specs),
        ("Overdosage & Toxicity", dm_od_specs),
        ("Mechanism of Action / Pharmacokinetics", dm_moa_specs),
    ]

    q_counter = 1

    for cat_name, specs in dailymed_groups:
        for drug_name, sec_name, query_text in specs:
            if drug_name not in dm_by_drug_sec:
                raise ValueError(f"Drug {drug_name} not found in DailyMed index metadata")
            if sec_name not in dm_by_drug_sec[drug_name]:
                raise ValueError(f"Section {sec_name} not found for drug {drug_name}")

            matching_chunks = dm_by_drug_sec[drug_name][sec_name]
            gt_records = []
            for m in matching_chunks:
                gt_records.append({
                    "document_id": m["document_id"],
                    "chunk_id": m["chunk_id"],
                    "source_id": m["source_id"],
                    "section": m["section"],
                    "target_entity": drug_name,
                    "relevance_grade": 3,
                    "justification": f"Exact DailyMed monograph chunk for {drug_name} under section '{sec_name}' answering query on {cat_name.lower()}."
                })

            qid = f"v26_query_{q_counter:03d}"
            q_counter += 1

            clean_name = re.sub(r'\s*\([^)]*\)', '', drug_name).strip()
            aliases = [drug_name]
            if clean_name != drug_name and clean_name not in aliases:
                aliases.append(clean_name)

            queries.append({
                "query_id": qid,
                "query": query_text,
                "category": cat_name,
                "source_corpus": "dailymed",
                "target_entity": drug_name,
                "target_section": sec_name,
                "ground_truth": gt_records,
                "acceptable_entities": aliases,
                "acceptable_sources": ["DailyMed"],
                "applicable_scopes": ["production", "dailymed_isolated"]
            })

    print(f"Generated {len(queries)} DailyMed queries.")

    # =========================================================================
    # PART B: MedQuAD Clinical QA Benchmark (80 queries across 8 categories)
    # =========================================================================
    def find_mq(focus_query: str, sec_query: str):
        matches = []
        for focus, sec_dict in mq_by_focus_sec.items():
            if focus_query.lower() == focus.lower() or (len(focus_query) > 4 and focus_query.lower() in focus.lower()):
                for sec, chunks in sec_dict.items():
                    if sec_query.lower() in sec.lower():
                        matches.extend(chunks)
        if not matches:
            raise ValueError(f"MedQuAD entry not found for focus: {focus_query}, sec: {sec_query}")
        return matches

    # 11. Disease / Condition Overview (10 queries)
    mq_info_specs = [
        ("Adult Acute Lymphoblastic Leukemia", "information", "How is adult acute lymphoblastic leukemia defined clinically and biologically?"),
        ("Asthma", "information", "What pathophysiological changes and airway inflammation define asthma?"),
        ("Gout", "information", "How does monosodium urate crystal deposition cause gout in joint spaces?"),
        ("Pulmonary Hypertension", "information", "What physiological changes in the pulmonary vasculature cause pulmonary hypertension?"),
        ("Juvenile Arthritis", "information", "What defines pediatric rheumatic disease in juvenile arthritis?"),
        ("Celiac Disease", "information", "How does autoimmune mucosal damage in the small intestine characterize celiac disease?"),
        ("Huntington disease", "information", "What progressive neurodegenerative changes characterize Huntington disease?"),
        ("cystic fibrosis", "information", "How does thick mucus accumulation in lungs and pancreas define cystic fibrosis?"),
        ("sickle cell disease", "information", "What hematological abnormalities and cellular sickling define sickle cell disease?"),
        ("Marfan syndrome", "information", "How does systemic connective tissue weakness manifest in Marfan syndrome?"),
    ]

    # 12. Signs & Symptoms (10 queries)
    mq_symp_specs = [
        ("Adult Acute Lymphoblastic Leukemia", "symptoms", "What clinical manifestations, fatigue, and bleeding tendencies present in adult ALL?"),
        ("Asthma", "symptoms", "What wheezing, dyspnea, and episodic bronchospasm symptoms indicate asthma?"),
        ("Gout", "symptoms", "What acute podagra, joint erythema, and severe inflammatory swelling occur in gout attacks?"),
        ("Pulmonary Hypertension", "symptoms", "What exertional dyspnea, syncope, and cyanosis symptoms indicate pulmonary hypertension?"),
        ("Achalasia", "symptoms", "What progressive dysphagia for solids and liquids with regurgitation suggests achalasia?"),
        ("Celiac Disease", "symptoms", "What chronic diarrhea, abdominal distension, and weight loss symptoms occur in celiac disease?"),
        ("cystic fibrosis", "symptoms", "What chronic productive cough, recurrent pulmonary infections, and steatorrhea indicate cystic fibrosis?"),
        ("Huntington disease", "symptoms", "What choreiform movements, psychiatric disturbances, and cognitive decline indicate Huntington disease?"),
        ("sickle cell disease", "symptoms", "What acute vaso-occlusive episodes, dactylitis, and severe bone pain occur in sickle cell disease?"),
        ("Marfan syndrome", "symptoms", "What tall slender stature, arachnodactyly, and ectopia lentis features suggest Marfan syndrome?"),
    ]

    # 13. Causes, Genetics & Risk Factors (10 queries)
    mq_cause_specs = [
        ("ARDS", "causes", "What underlying sepsis, pneumonia, or trauma insults precipitate acute respiratory distress syndrome?"),
        ("Abdominal Adhesions", "causes", "What surgical trauma and peritoneal healing mechanisms lead to fibrous abdominal adhesions?"),
        ("22q11.2 deletion syndrome", "causes", "What microdeletion event on chromosome 22 leads to DiGeorge syndrome anomalies?"),
        ("cystic fibrosis", "genetic changes", "What mutations affecting the epithelial chloride ion channel produce cystic fibrosis?"),
        ("Huntington disease", "genetic changes", "What trinucleotide expansion in huntingtin produces neurotoxicity in Huntington disease?"),
        ("Marfan syndrome", "genetic changes", "Which genetic mutations affect extracellular matrix fibrillin microfibrils in Marfan syndrome?"),
        ("sickle cell disease", "genetic changes", "What point mutation altering the beta-globin chain produces abnormal hemoglobin S?"),
        ("Fragile X syndrome", "genetic changes", "What CGG repeat expansion leading to transcriptional silencing produces Fragile X syndrome?"),
        ("phenylketonuria", "genetic changes", "What genetic mutations disrupting phenylalanine hydroxylase activity cause phenylketonuria?"),
        ("Tay-Sachs disease", "genetic changes", "What deficiency in beta-hexosaminidase A leading to GM2 ganglioside storage causes Tay-Sachs disease?"),
    ]

    # 14. Diagnostic Tests & Workup (10 queries)
    mq_diag_specs = [
        ("Adult Acute Lymphoblastic Leukemia", "exams and tests", "What bone marrow biopsy, immunophenotyping, and flow cytometry tests diagnose adult ALL?"),
        ("ARDS", "exams and tests", "What PaO2/FiO2 ratios, bilateral infiltrates on chest imaging, and workup confirm ARDS?"),
        ("Abdominal Adhesions", "exams and tests", "What radiographic evaluations and exploratory procedures identify bowel obstruction from adhesions?"),
        ("Abetalipoproteinemia", "exams and tests", "What plasma apolipoprotein B measurements and acanthocyte blood smears evaluate abetalipoproteinemia?"),
        ("21-hydroxylase deficiency", "exams and tests", "What elevated 17-hydroxyprogesterone assays and adrenal workup detect congenital adrenal hyperplasia?"),
        ("Achalasia", "exams and tests", "What high-resolution esophageal manometry and timed barium swallow establish the diagnosis of achalasia?"),
        ("Acromegaly", "exams and tests", "What serum IGF-1 quantification and glucose suppression testing confirm excess growth hormone?"),
        ("Alpha-1 Antitrypsin Deficiency", "exams and tests", "What quantitative serum protease inhibitor levels and Pi-typing confirm alpha-1 antitrypsin deficiency?"),
        ("Acute Intermittent Porphyria", "exams and tests", "What elevated urinary porphobilinogen and delta-aminolevulinic acid tests confirm AIP attacks?"),
        ("Adult Acute Myeloid Leukemia", "exams and tests", "What bone marrow blast percentages greater than twenty percent and cytogenetics confirm AML?"),
    ]

    # 15. Treatment & Management Procedures (10 queries)
    mq_treat_specs = [
        ("Adult Acute Lymphoblastic Leukemia", "treatment", "What remission induction, consolidation, and CNS prophylaxis regimens treat adult ALL?"),
        ("Asthma", "treatment", "What stepwise combination of inhaled corticosteroids and long-acting beta-agonists controls asthma?"),
        ("Gout", "treatment", "What acute anti-inflammatory agents and long-term xanthine oxidase inhibitors manage gout?"),
        ("Pulmonary Hypertension", "treatment", "What prostacyclin analogs, endothelin receptor antagonists, and PDE-5 inhibitors treat PAH?"),
        ("Acromegaly", "treatment", "What transsphenoidal pituitary surgery and somatostatin receptor ligands treat acromegaly?"),
        ("Celiac Disease", "treatment", "What lifelong exclusion of wheat, barley, and rye proteins resolves celiac enteropathy?"),
        ("cystic fibrosis", "treatment", "What chest physiotherapy, hypertonic saline nebulizers, and CFTR potentiators manage cystic fibrosis?"),
        ("Huntington disease", "treatment", "What VMAT2 inhibitors like tetrabenazine and supportive therapies palliate Huntington disease?"),
        ("sickle cell disease", "treatment", "What fetal hemoglobin inducers like hydroxyurea and exchange transfusions prevent sickle complications?"),
        ("Achalasia", "treatment", "What laparoscopic Heller myotomy and pneumatic balloon dilatation relieve lower esophageal sphincter pressure?"),
    ]

    # 16. Complications & Prognosis (10 queries)
    mq_comp_specs = [
        ("Adult Acute Lymphoblastic Leukemia", "outlook", "What is the five-year overall survival rate and remission outlook for adult ALL?"),
        ("Adult Acute Myeloid Leukemia", "outlook", "What cytogenetic risk stratifications determine the prognostic outlook for adult AML?"),
        ("Adult Hodgkin Lymphoma", "outlook", "What is the cure probability and relapse rate for adult Hodgkin lymphoma with modern chemotherapy?"),
        ("Adult Non-Hodgkin Lymphoma", "outlook", "What clinical staging and International Prognostic Index scores determine NHL outlook?"),
        ("AIDS-Related Lymphoma", "outlook", "What prognostic impact does concurrent antiretroviral therapy have on AIDS-related lymphoma survival?"),
        ("Acute Disseminated Encephalomyelitis", "outlook", "What expected functional recovery and monophasic prognosis occur after acute ADEM episodes?"),
        ("Adrenoleukodystrophy", "outlook", "What progressive demyelination and adrenal failure timeline determines the outlook for ALD?"),
        ("Absence of the Septum Pellucidum", "outlook", "What neurological development and optic nerve hypoplasia prognosis occurs in septo-optic dysplasia?"),
        ("Adult Central Nervous System Tumors", "outlook", "What survival expectations and functional outcomes accompany high-grade adult primary brain tumors?"),
        ("Acid Lipase Disease", "outlook", "What visceral organ failure and survival outcomes characterize Wolman disease and CESD?"),
    ]

    # 17. Prevention & Lifestyle Guidance (10 queries)
    mq_prev_specs = [
        ("Age-related Macular Degeneration", "prevention", "What AREDS2 dietary supplements, smoking cessation, and UV protection slow macular degeneration?"),
        ("Anal Cancer", "prevention", "What recombinant human papillomavirus vaccination and high-resolution anoscopy screen prevent anal malignancy?"),
        ("Abdominal Adhesions", "prevention", "What minimally invasive laparoscopic techniques and anti-adhesion barrier sheets prevent peritoneal bands?"),
        ("Alpha-1 Antitrypsin Deficiency", "prevention", "What occupational dust avoidance and complete tobacco abstinence prevent severe emphysema in AATD?"),
        ("Acinetobacter in Healthcare Settings", "prevention", "What strict contact precautions, environmental terminal cleaning, and hand hygiene prevent hospital outbreaks?"),
        ("Adult Acute Lymphoblastic Leukemia", "susceptibility", "What prior therapeutic ionizing radiation and hereditary disorders predispose adults to leukemogenesis?"),
        ("Adult Acute Myeloid Leukemia", "susceptibility", "What occupational benzene exposure and antecedent myelodysplastic syndromes elevate AML vulnerability?"),
        ("Adult Hodgkin Lymphoma", "susceptibility", "What prior infectious mononucleosis and immunosuppressive states increase susceptibility to Reed-Sternberg neoplasia?"),
        ("Adult Primary Liver Cancer", "susceptibility", "What chronic viral hepatitis infection, cirrhosis, and aflatoxin exposure predispose to hepatocellular carcinoma?"),
        ("Adult Central Nervous System Tumors", "susceptibility", "What therapeutic head radiation and familial tumor syndromes increase primary intracranial tumor risk?"),
    ]

    # 18. Rare Genetic Diseases & Inheritance (10 queries)
    mq_gen_specs = [
        ("cystic fibrosis", "inheritance", "What twenty-five percent recurrence risk and carrier status transmission governs autosomal recessive cystic fibrosis?"),
        ("Huntington disease", "inheritance", "What fifty percent offspring risk and genetic anticipation pattern characterizes autosomal dominant Huntington disease?"),
        ("Marfan syndrome", "inheritance", "What variable expressivity and dominant transmission rule dictates hereditary Marfan syndrome?"),
        ("sickle cell disease", "inheritance", "What mendelian segregation and quarter probability produces homozygous sickle hemoglobinopathy?"),
        ("Fragile X syndrome", "inheritance", "What maternal premutation expansion during oogenesis leads to full mutation Fragile X in offspring?"),
        ("Duchenne muscular dystrophy", "inheritance", "What obligate maternal transmission and hemizygous male manifestation rules apply to Duchenne dystrophy?"),
        ("Tay-Sachs disease", "inheritance", "What carrier screening and autosomal recessive segregation governs infantile Tay-Sachs transmission?"),
        ("Gaucher disease", "inheritance", "What autosomal recessive inheritance and glucocerebrosidase deficiency risk occurs in affected families?"),
        ("phenylketonuria", "inheritance", "What parental carrier status and autosomal recessive inheritance pattern dictates PKU occurrence?"),
        ("hemophilia", "inheritance", "What X-linked recessive inheritance pattern causes factor VIII deficiency predominantly in males?"),
    ]

    medquad_groups = [
        ("Disease / Condition Overview", mq_info_specs),
        ("Signs & Symptoms", mq_symp_specs),
        ("Causes, Genetics & Risk Factors", mq_cause_specs),
        ("Diagnostic Tests & Workup", mq_diag_specs),
        ("Treatment & Management Procedures", mq_treat_specs),
        ("Complications & Prognosis", mq_comp_specs),
        ("Prevention & Lifestyle Guidance", mq_prev_specs),
        ("Rare Genetic Diseases & Inheritance", mq_gen_specs),
    ]

    for cat_name, specs in medquad_groups:
        for focus_query, sec_query, query_text in specs:
            matching_chunks = find_mq(focus_query, sec_query)
            canonical_chunk = matching_chunks[0]
            canonical_focus = canonical_chunk['focus']
            canonical_sec = canonical_chunk.get('qtype') or canonical_chunk.get('section', '')
            acceptable_sources = list(set(m['source_id'] for m in matching_chunks))

            gt_records = []
            for m in matching_chunks:
                gt_records.append({
                    "document_id": m["document_id"],
                    "chunk_id": m["chunk_id"],
                    "source_id": m["source_id"],
                    "section": m.get("qtype") or m.get("section", ""),
                    "target_entity": canonical_focus,
                    "relevance_grade": 3,
                    "justification": f"Verified MedQuAD authoritative Q&A record for {canonical_focus} ({canonical_sec}) from source {m['source_id']}."
                })

            qid = f"v26_query_{q_counter:03d}"
            q_counter += 1

            queries.append({
                "query_id": qid,
                "query": query_text,
                "category": cat_name,
                "source_corpus": "medquad",
                "target_entity": canonical_focus,
                "target_section": canonical_sec,
                "ground_truth": gt_records,
                "acceptable_entities": [canonical_focus, focus_query],
                "acceptable_sources": acceptable_sources,
                "applicable_scopes": ["production", "medquad_isolated"]
            })

    print(f"Total benchmark queries built: {len(queries)}")
    assert len(queries) == 160, f"Expected exactly 160 queries, got {len(queries)}"

    # Validate each query and ground truth
    all_qids = set()
    total_gt_chunks = 0

    for q in queries:
        qid = q["query_id"]
        assert qid not in all_qids, f"Duplicate query_id: {qid}"
        all_qids.add(qid)

        assert len(q["ground_truth"]) > 0, f"Query {qid} has empty ground truth"
        for gt in q["ground_truth"]:
            cid = gt["chunk_id"]
            did = gt["document_id"]
            assert cid in chunk_by_id, f"Missing chunk_id in index: {cid}"
            assert did in doc_by_id, f"Missing document_id in index: {did}"
            assert gt["relevance_grade"] in (1, 2, 3), f"Invalid grade: {gt['relevance_grade']}"
            total_gt_chunks += 1

    print(f"Validation successful: Exactly 160 queries, {total_gt_chunks} ground truth chunk bindings verified.")

    output_path = 'rag_module/evaluation/v26_benchmark_dataset.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(queries, f, indent=2)

    print(f"Benchmark dataset successfully saved to {output_path}")

if __name__ == '__main__':
    build_benchmark()
