/**
 * Knowledge Base Registry Adapter.
 * 
 * Exposes active authoritative knowledge sources registered in the backend
 * and provides metadata schemas for future multi-corpus extensions.
 */

export const KnowledgeBaseRegistry = {
  activeSources: [
    {
      id: "DailyMed",
      name: "FDA DailyMed Drug Labels",
      publisher: "National Library of Medicine (NLM)",
      domain: "Pharmacology & Drug Labels",
      type: "official_monograph",
      chunkCount: 2176,
      trusted: true,
      baseUrl: "https://dailymed.nlm.nih.gov",
    },
    {
      id: "MedlinePlus",
      name: "MedlinePlus Health Topics",
      publisher: "National Library of Medicine (NLM)",
      domain: "General Clinical & Patient Education",
      type: "patient_guideline",
      chunkCount: 16,
      trusted: true,
      baseUrl: "https://medlineplus.gov",
    },
    {
      id: "ICMR",
      name: "ICMR Standard Treatment Workflows",
      publisher: "Indian Council of Medical Research (ICMR)",
      domain: "Evidence-Based Treatment Workflows",
      type: "clinical_workflow",
      chunkCount: 8,
      trusted: true,
      baseUrl: "https://icmr.nic.in",
    },
    {
      id: "MoHFW_STG",
      name: "MoHFW National Treatment Guidelines",
      publisher: "Ministry of Health & Family Welfare, India",
      domain: "National Clinical Practice Guidelines",
      type: "national_guideline",
      chunkCount: 4,
      trusted: true,
      baseUrl: "https://main.mohfw.gov.in",
    },
  ],

  /**
   * Return list of active sources for frontend filter chips.
   */
  getActiveSources: () => KnowledgeBaseRegistry.activeSources,

  /**
   * Return clinical section options for filtering.
   */
  getSectionFilters: () => [
    "Indications and Usage",
    "Dosage and Administration",
    "Contraindications",
    "Warnings and Precautions",
    "Boxed Warnings",
    "Adverse Reactions",
    "Drug Interactions",
    "Clinical Pharmacology",
    "Overdosage",
    "Pregnancy and Lactation",
    "Storage and Handling",
  ],
};

export default KnowledgeBaseRegistry;
