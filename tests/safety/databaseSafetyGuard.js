/**
 * tests/safety/databaseSafetyGuard.js
 *
 * Centralized fail-closed database safety guard and preflight verifier for CDSS.
 * Prevents integration and mutating tests from accidentally connecting to,
 * creating records in, or mutating the primary application database ('rag_healthcare').
 *
 * INVARIANTS:
 * 1. Primary database 'rag_healthcare' is strictly forbidden in test mode.
 * 2. Production or production-like database names (containing 'prod') are strictly forbidden.
 * 3. Test databases MUST end with '_test' or '_disposable'.
 * 4. Execution requires explicit opt-in via ALLOW_DESTRUCTIVE_DATABASE_TESTS='true'.
 * 5. Silent fallback to 'rag_healthcare' is strictly prohibited.
 * 6. Test HTTP requests must target a dedicated test backend, not the default dev port (5000)
 *    unless explicitly authorized with ALLOW_DEFAULT_DEV_PORT='true'.
 */

const http = require("http");

/**
 * Validates a database name against strict destructive test safety rules.
 * Throws a descriptive Error if the database is unsafe.
 *
 * @param {string} dbName - Target database name
 */
function verifyDestructiveTestSafety(dbName) {
  if (process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS !== "true") {
    throw new Error(
      "SAFETY REFUSAL: Destructive test blocked! Execution requires explicit opt-in via environment variable ALLOW_DESTRUCTIVE_DATABASE_TESTS=true."
    );
  }
  if (!dbName || typeof dbName !== "string" || dbName.trim().length === 0) {
    throw new Error(
      "SAFETY REFUSAL: Destructive test blocked! Database name must be explicitly configured."
    );
  }

  const normalized = dbName.trim().toLowerCase();

  if (normalized === "rag_healthcare" || normalized === "production" || normalized.includes("prod")) {
    throw new Error(
      `SAFETY REFUSAL: Destructive test blocked! Target database '${dbName}' is the primary application or production database. Destructive tests are strictly forbidden against '${dbName}'.`
    );
  }

  if (!normalized.endsWith("_test") && !normalized.endsWith("_disposable")) {
    throw new Error(
      `SAFETY REFUSAL: Destructive test blocked! Target database '${dbName}' must end with '_test' or '_disposable'.`
    );
  }

  return true;
}

/**
 * Performs synchronous preflight verification on the environment configuration
 * before any database pool, connection, or test runner suite is initialized.
 *
 * @param {string} [configuredDbName] - Optional database name to verify, defaults to process.env.DB_NAME
 */
function verifyTestDatabasePreflight(configuredDbName) {
  const targetDb = (configuredDbName || process.env.DB_NAME || "").trim();

  if (!targetDb) {
    throw new Error(
      "SAFETY PREFLIGHT FAILED: Missing required DB_NAME environment variable. The test runner strictly refuses to default to 'rag_healthcare'. Please define DB_NAME ending in '_test' or '_disposable'."
    );
  }

  verifyDestructiveTestSafety(targetDb);
  return targetDb;
}

/**
 * Probes the target Express gateway to ensure it is not an already-running
 * development server connected to the primary application database.
 *
 * @param {number} port - Gateway port
 * @param {string} expectedDbName - Expected test database name
 * @param {string} [host="127.0.0.1"] - Gateway host
 * @returns {Promise<{ active: boolean, serverDbName?: string }>}
 */
/**
 * Probes the target Express gateway to ensure it is active, healthy, and verified
 * to be connected to the approved test database.
 *
 * Fails closed on:
 * - Unreachable service (ECONNREFUSED / network errors)
 * - Timeouts (> 2000ms)
 * - Non-200 HTTP responses
 * - Non-JSON or malformed responses
 * - Missing database identity in /health
 * - Target database connected to 'rag_healthcare' or 'prod'
 * - Target database mismatch with expectedDbName
 * - Port 5000 conflict without ALLOW_DEFAULT_DEV_PORT='true'
 *
 * @param {number} port - Gateway port
 * @param {string} expectedDbName - Expected test database name
 * @param {string} [host="127.0.0.1"] - Gateway host
 * @param {object} [options={}] - Options (e.g. { allowInactive: false })
 * @returns {Promise<{ active: boolean, serverDbName: string }>}
 */
async function probeGatewaySafety(port, expectedDbName, host = "127.0.0.1", options = {}) {
  const allowInactive = options.allowInactive === true;

  // Guard 1: Port conflict guard
  if (Number(port) === 5000 && process.env.ALLOW_DEFAULT_DEV_PORT !== "true") {
    throw new Error(
      `SAFETY PREFLIGHT FAILED: Test suite is targeting port 5000 (default development port). ` +
      `This risks sending mutating test requests to an already-running development backend. ` +
      `Please start a dedicated test backend on port 5001 (e.g. TEST_EXPRESS_PORT=5001) or set ALLOW_DEFAULT_DEV_PORT=true if port 5000 is verified isolated.`
    );
  }

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: host,
      port: Number(port),
      path: "/health",
      method: "GET",
      timeout: 2000
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        if (res.statusCode !== 200) {
          return reject(new Error(
            `SAFETY REFUSAL: Health check on port ${port} returned non-200 status (${res.statusCode}). Gateway is degraded or unready.`
          ));
        }

        let data;
        try {
          data = JSON.parse(body);
        } catch (parseErr) {
          return reject(new Error(
            `SAFETY REFUSAL: Health check on port ${port} returned malformed/non-JSON response. Unable to verify database identity.`
          ));
        }

        const serverDb = data?.services?.database_name;
        if (!serverDb || typeof serverDb !== "string" || serverDb.trim().length === 0) {
          return reject(new Error(
            `SAFETY REFUSAL: Health check on port ${port} did not report its database identity ('services.database_name'). ` +
            `Refusing to send test requests to an unverified or production-configured server.`
          ));
        }

        const normalizedServerDb = serverDb.toLowerCase().trim();
        if (normalizedServerDb === "rag_healthcare" || normalizedServerDb.includes("prod")) {
          return reject(new Error(
            `SAFETY REFUSAL: The server on port ${port} is connected to primary/production database '${serverDb}'! ` +
            `Refusing to send test requests that could mutate production data.`
          ));
        }

        if (expectedDbName && normalizedServerDb !== expectedDbName.toLowerCase().trim()) {
          return reject(new Error(
            `SAFETY REFUSAL: Database mismatch! Server on port ${port} is connected to '${serverDb}', but test runner expects '${expectedDbName}'.`
          ));
        }

        resolve({ active: true, serverDbName: serverDb });
      });
    });

    req.on("error", (err) => {
      if (allowInactive) {
        return resolve({ active: false, error: err.code });
      }
      reject(new Error(
        `SAFETY REFUSAL: Test gateway on port ${port} is unreachable (${err.code}). ` +
        `Tests require an active test backend connected to '${expectedDbName}'.`
      ));
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(
        `SAFETY REFUSAL: Health check probe on port ${port} timed out after 2000ms. Service is unresponsive.`
      ));
    });

    req.end();
  });
}

module.exports = {
  verifyDestructiveTestSafety,
  verifyTestDatabasePreflight,
  probeGatewaySafety
};
