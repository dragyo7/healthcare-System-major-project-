/**
 * Multilingual Module Adapter Interface.
 * 
 * Provides an extensible translation layer for multi-language CDS queries.
 * Flow:
 *   User Query (Non-English)
 *       ↓
 *   Language Identification & Translation
 *       ↓
 *   Canonical English Query → Core RAG Retrieval (FAISS/BM25)
 *       ↓
 *   Grounded Response Synthesis
 *       ↓
 *   Target Language Localized Output
 */

export const MultilingualAdapter = {
  supportedLanguages: [
    { code: "en", name: "English", isCanonical: true },
    { code: "hi", name: "Hindi (हिंदी)", isCanonical: false },
    { code: "bn", name: "Bengali (বাংলা)", isCanonical: false },
    { code: "ta", name: "Tamil (தமிழ்)", isCanonical: false },
    { code: "te", name: "Telugu (తెలుగు)", isCanonical: false },
    { code: "mr", name: "Marathi (मराठी)", isCanonical: false },
  ],

  /**
   * Detect language and normalize query to canonical English if necessary.
   * @param {string} query - Raw input text
   * @param {string} sourceLang - Detected or user-selected language code
   * @returns {Promise<{ canonicalQuery: string, originalQuery: string, sourceLang: string, wasTranslated: boolean }>}
   */
  translateToCanonical: async (query, sourceLang = "en") => {
    if (!query || sourceLang === "en") {
      return { canonicalQuery: query, originalQuery: query, sourceLang: "en", wasTranslated: false };
    }
    // Future integration point: call neural machine translation service
    return {
      canonicalQuery: query,
      originalQuery: query,
      sourceLang,
      wasTranslated: false,
      note: "Multilingual translation adapter registered. Ready for NMT backend module.",
    };
  },

  /**
   * Translate synthesized answer back to target language if requested.
   * @param {string} text - Synthesized response in English
   * @param {string} targetLang - Target language code
   * @returns {Promise<{ localizedText: string, targetLang: string }>}
   */
  translateFromCanonical: async (text, targetLang = "en") => {
    if (!text || targetLang === "en") {
      return { localizedText: text, targetLang: "en" };
    }
    return {
      localizedText: text,
      targetLang,
      note: "Multilingual translation adapter registered. Ready for NMT backend module.",
    };
  },
};

export default MultilingualAdapter;
