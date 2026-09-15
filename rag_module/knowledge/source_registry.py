"""
Authoritative Medical Knowledge Source Registry.
Provides structured provenance, license, authority level, citation templates,
and adapter mappings for all active and planned medical knowledge sources.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional


class SourceType:
    """Standardized knowledge source types."""
    FEDERAL_RESEARCH_INSTITUTE = "federal_research_institute"
    PUBLIC_HEALTH_AGENCY = "public_health_agency"
    REGULATORY_AGENCY = "regulatory_agency"
    REGULATORY_DRUG_REPOSITORY = "regulatory_drug_repository"
    GUIDELINE_CLEARINGHOUSE = "guideline_clearinghouse"
    QA_COLLECTION = "qa_collection"
    GENERAL_REFERENCE = "general_reference"


class AuthorityLevel:
    """
    Application-level taxonomy of source authority.
    NOTE: This represents application data provenance ranking, not clinical certification.
    """
    TIER_1_FEDERAL_RESEARCH = "tier_1_federal_research"
    TIER_1_REGULATORY = "tier_1_regulatory"
    TIER_1_PUBLIC_HEALTH = "tier_1_public_health"
    TIER_2_CLINICAL_CONSENSUS = "tier_2_clinical_consensus"
    TIER_3_GENERAL_REFERENCE = "tier_3_general_reference"


@dataclass(frozen=True)
class SourceMetadata:
    """
    Centralized metadata definition for a medical knowledge source.
    """
    source_id: str
    display_name: str
    publisher: str
    source_type: str        # "federal_research_institute", "regulatory_agency", "guideline_clearinghouse"
    authority_level: str = AuthorityLevel.TIER_1_FEDERAL_RESEARCH
    document_types: List[str] = field(default_factory=list)
    domains: List[str] = field(default_factory=list)
    adapter_class: Optional[str] = None
    license_notes: str = ""
    base_url: str = ""
    enabled: bool = True
    version: str = "2.3"
    description: str = ""


# Central source registry supporting active NIH institutes and future planned sources
SOURCE_REGISTRY: Dict[str, SourceMetadata] = {
    # Active MedQuAD NIH Subsets
    "CancerGov": SourceMetadata(
        source_id="CancerGov",
        display_name="National Cancer Institute (NCI)",
        publisher="National Institutes of Health (NIH)",
        source_type="federal_research_institute",
        authority_level="tier_1_federal_research",
        document_types=["qa_pair", "disease_summary"],
        domains=["oncology", "cancer_biology", "chemotherapy"],
        adapter_class="MedQuADAdapter",
        license_notes="US Government Public Domain / CC BY 4.0 (via MedQuAD)",
        base_url="https://www.cancer.gov",
        enabled=True,
        description="Comprehensive clinical and patient summaries on cancer biology, diagnosis, stages, and treatments."
    ),
    "GARD": SourceMetadata(
        source_id="GARD",
        display_name="Genetic and Rare Diseases Information Center (GARD)",
        publisher="National Center for Advancing Translational Sciences (NCATS/NIH)",
        source_type="federal_research_institute",
        authority_level="tier_1_federal_research",
        document_types=["qa_pair", "rare_disease_summary"],
        domains=["rare_diseases", "genetics", "phenotypes"],
        adapter_class="MedQuADAdapter",
        license_notes="US Government Public Domain / CC BY 4.0",
        base_url="https://rarediseases.info.nih.gov",
        enabled=True,
        description="Curated information on rare genetic disorders, inheritance patterns, diagnostic phenotypes, and clinical organizations."
    ),
    "GHR": SourceMetadata(
        source_id="GHR",
        display_name="Genetics Home Reference (MedlinePlus Genetics)",
        publisher="National Library of Medicine (NLM/NIH)",
        source_type="federal_research_institute",
        authority_level="tier_1_federal_research",
        document_types=["qa_pair", "genetic_condition_overview"],
        domains=["genetics", "genomic_medicine", "hereditary_disorders"],
        adapter_class="MedQuADAdapter",
        license_notes="US Government Public Domain / CC BY 4.0",
        base_url="https://medlineplus.gov/genetics/",
        enabled=True,
        description="Descriptions of genetic conditions, responsible genes, chromosomes, and inheritance mechanisms."
    ),
    "MPlus_Health_Topics": SourceMetadata(
        source_id="MPlus_Health_Topics",
        display_name="MedlinePlus Health Topics",
        publisher="National Library of Medicine (NLM/NIH)",
        source_type="federal_research_institute",
        authority_level="tier_1_federal_research",
        document_types=["qa_pair", "health_topic_summary"],
        domains=["general_medicine", "internal_medicine", "public_health"],
        adapter_class="MedQuADAdapter",
        license_notes="US Government Public Domain / CC BY 4.0",
        base_url="https://medlineplus.gov",
        enabled=True,
        description="Consumer health information on hundreds of diseases, conditions, wellness issues, and diagnostic tests."
    ),
    "NIDDK": SourceMetadata(
        source_id="NIDDK",
        display_name="National Institute of Diabetes and Digestive and Kidney Diseases",
        publisher="National Institutes of Health (NIH)",
        source_type="federal_research_institute",
        authority_level="tier_1_federal_research",
        document_types=["qa_pair", "chronic_disease_guide"],
        domains=["endocrinology", "diabetes", "nephrology", "gastroenterology"],
        adapter_class="MedQuADAdapter",
        license_notes="US Government Public Domain / CC BY 4.0",
        base_url="https://www.niddk.nih.gov",
        enabled=True,
        description="Authoritative clinical guides on diabetes, kidney disease, urologic conditions, and digestive disorders."
    ),
    "NINDS": SourceMetadata(
        source_id="NINDS",
        display_name="National Institute of Neurological Disorders and Stroke",
        publisher="National Institutes of Health (NIH)",
        source_type="federal_research_institute",
        authority_level="tier_1_federal_research",
        document_types=["qa_pair", "neurology_summary"],
        domains=["neurology", "neuroscience", "stroke", "brain_disorders"],
        adapter_class="MedQuADAdapter",
        license_notes="US Government Public Domain / CC BY 4.0",
        base_url="https://www.ninds.nih.gov",
        enabled=True,
        description="Clinical overviews of stroke, traumatic brain injury, neurodegenerative diseases, and neurological disorders."
    ),
    "SeniorHealth": SourceMetadata(
        source_id="SeniorHealth",
        display_name="NIHSeniorHealth (National Institute on Aging)",
        publisher="National Institute on Aging (NIA/NIH)",
        source_type="federal_research_institute",
        authority_level="tier_1_federal_research",
        document_types=["qa_pair", "geriatrics_guide"],
        domains=["geriatrics", "aging_health", "dementia"],
        adapter_class="MedQuADAdapter",
        license_notes="US Government Public Domain / CC BY 4.0",
        base_url="https://www.nia.nih.gov",
        enabled=True,
        description="Health and wellness information tailored for older adults, cognitive health, and age-related chronic conditions."
    ),
    "NHLBI": SourceMetadata(
        source_id="NHLBI",
        display_name="National Heart, Lung, and Blood Institute",
        publisher="National Institutes of Health (NIH)",
        source_type="federal_research_institute",
        authority_level="tier_1_federal_research",
        document_types=["qa_pair", "cardiopulmonary_summary"],
        domains=["cardiology", "pulmonology", "hematology"],
        adapter_class="MedQuADAdapter",
        license_notes="US Government Public Domain / CC BY 4.0",
        base_url="https://www.nhlbi.nih.gov",
        enabled=True,
        description="Information on cardiovascular disease, lung disorders (COPD, asthma), blood disorders, and sleep medicine."
    ),
    "CDC": SourceMetadata(
        source_id="CDC",
        display_name="Centers for Disease Control and Prevention",
        publisher="U.S. Department of Health and Human Services (HHS)",
        source_type="public_health_agency",
        authority_level="tier_1_public_health",
        document_types=["qa_pair", "public_health_advisory"],
        domains=["infectious_disease", "immunization", "epidemiology"],
        adapter_class="MedQuADAdapter",
        license_notes="US Government Public Domain / CC BY 4.0",
        base_url="https://www.cdc.gov",
        enabled=True,
        description="Public health guidelines on infectious diseases, prevention, outbreak response, and vaccinations."
    ),
    "MedQuAD": SourceMetadata(
        source_id="MedQuAD",
        display_name="MedQuAD Composite NIH Knowledge Base",
        publisher="National Institutes of Health (NIH)",
        source_type="federal_research_institute",
        authority_level="tier_1_federal_research",
        document_types=["qa_pair"],
        domains=["comprehensive_pathology", "disease_overviews"],
        adapter_class="MedQuADAdapter",
        license_notes="US Government Public Domain / CC BY 4.0",
        base_url="https://github.com/abachaa/MedQuAD",
        enabled=True,
        description="Unified 16,406-record dataset compiled from 9 NIH institutes covering diseases, symptoms, and genetics."
    ),

    # Future / Planned Sources & New Approved Knowledge Bases
    "DailyMed": SourceMetadata(
        source_id="DailyMed",
        display_name="National Library of Medicine DailyMed (FDA SPL)",
        publisher="U.S. National Library of Medicine / FDA",
        source_type="regulatory_drug_repository",
        authority_level="tier_1_regulatory",
        document_types=["drug_monograph", "spl_package_insert"],
        domains=["pharmacology", "dosage_titration", "contraindications", "warnings"],
        adapter_class="DailyMedAdapter",
        license_notes="US Government Public Domain / Open Data",
        base_url="https://dailymed.nlm.nih.gov",
        enabled=True,
        version="2.9",
        description="Comprehensive FDA-approved drug package inserts with complete dosing schedules, black-box warnings, and interactions."
    ),
    "MedlinePlus": SourceMetadata(
        source_id="MedlinePlus",
        display_name="MedlinePlus Health Topics (NLM / NIH)",
        publisher="National Library of Medicine (NLM/NIH)",
        source_type="federal_research_institute",
        authority_level="tier_1_federal_research",
        document_types=["qa_pair", "health_topic_summary", "disease_summary"],
        domains=["general_medicine", "internal_medicine", "public_health"],
        adapter_class="MedlinePlusAdapter",
        license_notes="US Government Public Domain",
        base_url="https://medlineplus.gov",
        enabled=True,
        version="2.9",
        description="Official consumer health and clinical topic summaries on diseases, diagnostics, and prevention."
    ),
    "ICMR": SourceMetadata(
        source_id="ICMR",
        display_name="Indian Council of Medical Research Clinical Guidelines",
        publisher="Indian Council of Medical Research (ICMR, Govt of India)",
        source_type="guideline_clearinghouse",
        authority_level="tier_1_public_health",
        document_types=["clinical_guideline", "consensus_statement"],
        domains=["endocrinology", "cardiology", "infectious_disease", "antimicrobial_stewardship"],
        adapter_class="ICMRAdapter",
        license_notes="Government of India Open Access / Public Health Guidance",
        base_url="https://main.icmr.nic.in",
        enabled=True,
        version="2.9",
        description="Official national clinical practice guidelines, diagnostic thresholds, and treatment protocols for India."
    ),
    "MoHFW_STG": SourceMetadata(
        source_id="MoHFW_STG",
        display_name="Ministry of Health & Family Welfare Standard Treatment Guidelines",
        publisher="Ministry of Health and Family Welfare (Govt of India)",
        source_type="guideline_clearinghouse",
        authority_level="tier_1_public_health",
        document_types=["clinical_guideline", "standard_treatment_workflow"],
        domains=["primary_care", "internal_medicine", "hypertension", "diabetes"],
        adapter_class="MoHFWAdapter",
        license_notes="Government of India Public Document",
        base_url="https://clinicalestablishments.gov.in",
        enabled=True,
        version="2.9",
        description="Standardized treatment guidelines (STGs) for primary and secondary healthcare facilities under the Clinical Establishments Act."
    ),
    "RxNorm": SourceMetadata(
        source_id="RxNorm",
        display_name="RxNorm Normalized Prescribable Clinical Terminology",
        publisher="National Library of Medicine (NLM/NIH)",
        source_type="regulatory_drug_repository",
        authority_level="tier_1_regulatory",
        document_types=["terminology_concept"],
        domains=["pharmacology", "terminology_mapping", "clinical_drugs"],
        adapter_class="RxNormAdapter",
        license_notes="NLM / UMLS Open Terms (Prescribable subset)",
        base_url="https://www.nlm.nih.gov/research/umls/rxnorm/",
        enabled=True,
        version="2026-02",
        description="Standardized nomenclature and relational identifiers (RxCUI, ingredient, strength, form) for clinical drugs."
    ),
    "openFDA": SourceMetadata(
        source_id="openFDA",
        display_name="FDA Drug Product Labeling API",
        publisher="U.S. Food and Drug Administration",
        source_type="regulatory_agency",
        authority_level="tier_1_regulatory",
        document_types=["drug_monograph", "adverse_event_record"],
        domains=["pharmacology", "adverse_reactions", "drug_safety"],
        adapter_class="OpenFDAAdapter",
        license_notes="Public Domain (CC0 Equivalent)",
        base_url="https://open.fda.gov",
        enabled=True,
        version="2.9",
        description="Structured JSON API for FDA prescription and OTC drug labels, boxed warnings, and indications."
    ),
    "ClinicalGuidelines": SourceMetadata(
        source_id="ClinicalGuidelines",
        display_name="Clinical Practice Guidelines (PMC / WHO / Societies)",
        publisher="Medical Professional Societies & WHO",
        source_type="guideline_clearinghouse",
        authority_level="tier_2_clinical_consensus",
        document_types=["clinical_guideline", "consensus_statement"],
        domains=["evidence_based_medicine", "clinical_protocols"],
        adapter_class="GuidelineAdapter",
        license_notes="Open Access / CC-BY",
        base_url="https://www.ncbi.nlm.nih.gov/pmc/",
        enabled=False,
        description="Evidence-graded practice guidelines for disease management and treatment algorithms."
    )
}


class SourceRegistry:
    """
    Manager and registry for all medical knowledge sources.
    """
    @staticmethod
    def get_source(source_id: str) -> Optional[SourceMetadata]:
        """Looks up a source by its unique ID (case-insensitive and alias fallback)."""
        if not source_id:
            return None
        if source_id in SOURCE_REGISTRY:
            return SOURCE_REGISTRY[source_id]
        
        # Check case-insensitive exact match
        for sid, meta in SOURCE_REGISTRY.items():
            if sid.lower() == source_id.lower():
                return meta
                
        # Check alias / normalized prefix matches
        normalized_id = source_id.lower().replace("-", "_")
        alias_map = {
            "medquad_gard": "GARD",
            "medquad_cancer": "CancerGov",
            "medquad_cancergov": "CancerGov",
            "medquad_ghr": "GHR",
            "medquad_mplus": "MPlus_Health_Topics",
            "medquad_niddk": "NIDDK",
            "medquad_ninds": "NINDS",
            "medquad_seniorhealth": "SeniorHealth",
            "medquad_nhlbi": "NHLBI",
            "medquad_cdc": "CDC",
            "dailymed_spl": "DailyMed",
            "dailymed_fda": "DailyMed",
            "medlineplus_topics": "MedlinePlus",
            "medlineplus_gov": "MedlinePlus",
            "icmr_guidelines": "ICMR",
            "icmr_clinical": "ICMR",
            "mohfw": "MoHFW_STG",
            "mohfw_guidelines": "MoHFW_STG",
            "mohfw_stgs": "MoHFW_STG",
            "rxnorm_prescribable": "RxNorm",
            "rxnorm_cui": "RxNorm",
            "openfda_drug_labels": "openFDA",
            "clinical_guidelines": "ClinicalGuidelines",
            "clinicalguidelines": "ClinicalGuidelines"
        }
        if normalized_id in alias_map:
            return SOURCE_REGISTRY.get(alias_map[normalized_id])
            
        for sid, meta in SOURCE_REGISTRY.items():
            if sid.lower() in normalized_id or normalized_id in sid.lower():
                return meta
        return None

    @staticmethod
    def list_sources(enabled_only: bool = False) -> List[SourceMetadata]:
        """Returns all registered knowledge sources."""
        if enabled_only:
            return [meta for meta in SOURCE_REGISTRY.values() if meta.enabled]
        return list(SOURCE_REGISTRY.values())

    @staticmethod
    def register_source(meta: SourceMetadata) -> None:
        """Registers or updates a source definition."""
        SOURCE_REGISTRY[meta.source_id] = meta


def get_source_info(source_id: str) -> Optional[SourceMetadata]:
    """Backward-compatible helper function."""
    return SourceRegistry.get_source(source_id)
