/**
 * frontend/src/api/client.js
 *
 * Explicit, secure HTTP client for CareUnity CDSS.
 *
 * Strictly adheres to DEC-002, DEC-003, and Environment Isolation Invariants:
 * - Uses ONLY the explicitly configured API base URL for the active environment.
 * - ZERO automatic port-swapping or silent database/environment switching.
 * - Distinct, honest technical error classification (isNetworkError, isTimeout, isAuthError).
 * - Never labels network/transport failures as clinical safety abstentions.
 */

const getInitialBase = () => {
  const envUrl =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_EXPRESS_URL ||
    import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === "string") {
    return envUrl.replace(/\/api\/?$/, "") + "/api";
  }
  return "http://127.0.0.1:5000/api";
};

let currentApiBase = getInitialBase();

export function getApiBase() {
  return currentApiBase;
}

export function setApiBase(newBase) {
  if (!newBase || typeof newBase !== "string") return;
  currentApiBase = newBase.replace(/\/api\/?$/, "") + "/api";
}

export function getAuthHeaders() {
  const token =
    localStorage.getItem("cdss_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("patient_token") ||
    localStorage.getItem("receptionist_token");

  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Resilient fetch wrapper targeting strictly the configured environment backend.
 *
 * @param {string} endpoint e.g. "/patient/cds" or full URL
 * @param {RequestInit} [options]
 * @returns {Promise<any>} Parsed JSON response
 */
export async function resilientFetch(endpoint, options = {}) {
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const targetUrl = endpoint.startsWith("http") ? endpoint : `${currentApiBase}${path}`;

  const timeoutMs = options.timeoutMs || 60000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const fetchOptions = {
    ...options,
    signal: options.signal || controller.signal,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  };

  try {
    const res = await fetch(targetUrl, fetchOptions);
    clearTimeout(timeoutId);

    // Parse response body safely
    let data = null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await res.json().catch(() => null);
    } else {
      const text = await res.text().catch(() => "");
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = { message: text || `HTTP ${res.status}` };
      }
    }

    if (!res.ok) {
      const err = new Error(data?.message || `Request failed with HTTP status ${res.status}`);
      err.status = res.status;
      err.data = data;
      err.isAuthError = res.status === 401 || res.status === 403;
      err.isTimeout = res.status === 504;
      err.isGatewayError = res.status === 502 || res.status === 503;
      throw err;
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    // Classify error precisely without any silent port-switching
    if (error.name === "AbortError") {
      const timeoutErr = new Error("Gateway request timed out after 60 seconds. The clinical inference engine is taking longer than usual.");
      timeoutErr.status = 504;
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }

    const isNetworkErr =
      error.name === "TypeError" &&
      (error.message.includes("fetch") || error.message.includes("network") || error.message.includes("Failed"));

    if (isNetworkErr) {
      const netErr = new Error(`EHR API Gateway unavailable: Connection to clinical backend failed at ${currentApiBase}. Please ensure the configured backend server is running.`);
      netErr.status = 0;
      netErr.isNetworkError = true;
      throw netErr;
    }

    throw error;
  }
}
