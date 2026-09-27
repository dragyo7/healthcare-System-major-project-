/**
 * Multimodal / OCR Ingestion Adapter Interface.
 * 
 * Provides a standard contract for processing medical prescription images,
 * lab reports, or PDF scans and feeding extracted text into the CDS RAG pipeline.
 */

export const MultimodalAdapter = {
  /**
   * Process uploaded document or camera capture and extract structured text.
   * @param {File | Blob | string} file - Document file or image data URL
   * @returns {Promise<{ extractedText: string, confidence: number, documentType: string }>}
   */
  extractTextFromDocument: async (file) => {
    // Contract definition for future OCR module integration (e.g. Tesseract / Vision API)
    return {
      extractedText: "",
      confidence: 0.0,
      documentType: "prescription_or_report",
      status: "ready_for_ocr_module",
      note: "Multimodal OCR adapter interface established. Ready for OCR engine integration.",
    };
  },

  /**
   * Format OCR extracted text into a query suitable for CDS RAG verification.
   * @param {string} rawText - OCR extracted text
   * @returns {string} Clean query for RAG retrieval
   */
  formatForRAGQuery: (rawText) => {
    if (!rawText) return "";
    return rawText
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500); // Bounded query window
  },
};

export default MultimodalAdapter;
