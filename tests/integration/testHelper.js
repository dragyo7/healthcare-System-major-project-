/**
 * testHelper.js
 *
 * Centralized test infrastructure helper for integration & E2E tests.
 * Resolves database connections, JWT generation, HTTP client requests,
 * and backend dependencies cleanly without ad-hoc path manipulation.
 */

const http = require("http");
const path = require("path");

const backendDir = path.resolve(
  __dirname,
  "../../Portal Major P/Bhumi/Doctor portal/backend"
);
const backendModules = path.join(backendDir, "node_modules");

require(path.join(backendModules, "dotenv")).config({
  path: path.join(backendDir, ".env"),
});

const mysql = require(path.join(backendModules, "mysql2/promise"));
const jwt = require(path.join(backendModules, "jsonwebtoken"));
const bcrypt = require(path.join(backendModules, "bcrypt"));

const fs = require("fs");

const {
  verifyDestructiveTestSafety,
  verifyTestDatabasePreflight,
  probeGatewaySafety
} = require("../safety/databaseSafetyGuard");

const JWT_SECRET = process.env.JWT_SECRET || "rag_healthcare_secret";
const GATEWAY_PORT = parseInt(process.env.TEST_EXPRESS_PORT || process.env.EXPRESS_PORT || process.env.PORT || "5001");
const GATEWAY_HOST = process.env.EXPRESS_HOST || "127.0.0.1";

let testDbFileConfig = {};
try {
  const cfgPath = path.resolve(__dirname, "../../scratch/test_db_config.json");
  if (fs.existsSync(cfgPath)) {
    testDbFileConfig = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  }
} catch (_) {}

const DB_CONFIG = {
  host: process.env.DB_HOST || testDbFileConfig.host || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || testDbFileConfig.port || "3306"),
  user: process.env.DB_USER || testDbFileConfig.user || "root",
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (testDbFileConfig.password !== undefined ? testDbFileConfig.password : ""),
  get database() {
    const dbToVerify = this._overrideDb || process.env.DB_NAME;
    return verifyTestDatabasePreflight(dbToVerify);
  },
  set database(val) {
    this._overrideDb = val;
  }
};
Object.defineProperty(DB_CONFIG, "_overrideDb", {
  value: null,
  writable: true,
  enumerable: false,
  configurable: true
});

function httpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const targetPort = options && options.port !== undefined
      ? (Number(options.port) === 5000 && process.env.TEST_EXPRESS_PORT ? parseInt(process.env.TEST_EXPRESS_PORT) : options.port)
      : GATEWAY_PORT;

    if (Number(targetPort) === 5000 && process.env.ALLOW_DEFAULT_DEV_PORT !== "true") {
      return reject(new Error(
        "SAFETY REFUSAL: httpRequest is targeting port 5000 (default development port). " +
        "Tests must target a dedicated test backend (e.g. TEST_EXPRESS_PORT=5001) to avoid mutating development data. " +
        "Set ALLOW_DEFAULT_DEV_PORT=true only if port 5000 is verified to be an isolated test server."
      ));
    }

    const headers = { ...(options && options.headers ? options.headers : {}) };
    let payload = null;
    if (postData) {
      if (typeof postData === "object" && !Buffer.isBuffer(postData)) {
        payload = JSON.stringify(postData);
        if (!headers["Content-Type"] && !headers["content-type"]) {
          headers["Content-Type"] = "application/json";
        }
      } else {
        payload = postData;
      }
      if (!headers["Content-Length"] && !headers["content-length"]) {
        headers["Content-Length"] = Buffer.byteLength(payload);
      }
    }

    const opts = {
      hostname: GATEWAY_HOST,
      ...options,
      port: targetPort,
      headers
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json || data,
          raw: data,
        });
      });
    });
    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function generateToken(payload, expiresIn = "1h") {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

module.exports = {
  mysql,
  jwt,
  bcrypt,
  JWT_SECRET,
  GATEWAY_HOST,
  GATEWAY_PORT,
  DB_CONFIG,
  httpRequest,
  generateToken,
  verifyDestructiveTestSafety,
  verifyTestDatabasePreflight,
  probeGatewaySafety
};
