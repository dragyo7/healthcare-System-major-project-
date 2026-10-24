import axios from "axios";
import { APP_CONFIG } from "../config/appConfig";

const API_BASE_URL =
  import.meta.env.VITE_FASTAPI_URL ||
  import.meta.env.VITE_RAG_URL ||
  APP_CONFIG.apiBaseUrl ||
  "http://127.0.0.1:8000";


export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000, // 90s to accommodate CPU model loading and cross-encoder reranking
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

export const ragApi = {
  /**
   * Check backend health and indexed chunk count.
   */
  getHealth: async () => {
    try {
      const response = await apiClient.get("/health");
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || "Unable to connect to RAG backend service.",
      };
    }
  },

  /**
   * Check service readiness probe.
   */
  getReady: async () => {
    try {
      const response = await apiClient.get("/ready");
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || "RAG backend is not ready.",
      };
    }
  },

  /**
   * Conversational Clinical Query with evidence synthesis and safety guardrails.
   * Minimal canonical request: { query: "What is metformin?" }
   * @param {Object|string} params - { query, message, mode, top_k, generate_answer, audience }
   */
  chat: async (params) => {
    try {
      let payload;
      if (typeof params === "string") {
        payload = { query: params.trim() };
      } else if (params && typeof params === "object") {
        const queryText = (params.query || params.message || "").trim();
        payload = { query: queryText };
        // Only include optional parameters if explicitly passed to respect backend centralized defaults
        if (params.mode) payload.mode = params.mode;
        if (params.top_k !== undefined && params.top_k !== null) payload.top_k = Number(params.top_k);
        if (params.generate_answer !== undefined) payload.generate_answer = Boolean(params.generate_answer);
        if (params.audience) payload.audience = params.audience;
        if (params.patient_context) payload.patient_context = params.patient_context;
        if (params.clinician_context) payload.clinician_context = params.clinician_context;
      } else {
        payload = { query: "" };
      }

      const response = await apiClient.post("/chat", payload);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.response?.data?.detail ||
          error.message ||
          "Failed to process chat query.",
        status: error.response?.status,
      };
    }
  },

  /**
   * Structured Evidence Retrieval and Grounding Policy decision.
   * @param {Object} params - { query, mode, top_k, source_filter, domain_filter, section_filter }
   */
  queryRAG: async ({
    query,
    mode = "hybrid",
    top_k = 5,
    source_filter = null,
    domain_filter = null,
    section_filter = null,
  }) => {
    try {
      const payload = {
        query: query.trim(),
        mode,
        top_k: Number(top_k),
      };
      if (source_filter && source_filter.length > 0) payload.source_filter = source_filter;
      if (domain_filter && domain_filter.length > 0) payload.domain_filter = domain_filter;
      if (section_filter && section_filter.length > 0) payload.section_filter = section_filter;

      const response = await apiClient.post("/rag/query", payload);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.response?.data?.detail ||
          error.message ||
          "Failed to retrieve clinical evidence.",
        status: error.response?.status,
      };
    }
  },

  /**
   * Forensic diagnostic trace for inspection and evaluator auditing.
   * @param {Object} params - { query, top_k }
   */
  getTrace: async ({ query, top_k = 5 }) => {
    try {
      const payload = {
        query: query.trim(),
        top_k: Number(top_k),
      };
      const response = await apiClient.post("/rag/trace", payload);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.response?.data?.detail ||
          error.message ||
          "Failed to fetch diagnostic trace.",
        status: error.response?.status,
      };
    }
  },
};

export default ragApi;
