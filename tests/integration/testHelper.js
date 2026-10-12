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

const JWT_SECRET = process.env.JWT_SECRET || "rag_healthcare_secret";
const GATEWAY_PORT = parseInt(process.env.EXPRESS_PORT || process.env.PORT || "5000");
const GATEWAY_HOST = process.env.EXPRESS_HOST || "127.0.0.1";

const DB_CONFIG = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "rag_healthcare",
};

function httpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: GATEWAY_HOST,
      port: GATEWAY_PORT,
      ...options,
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
    if (postData) {
      if (typeof postData === "object" && !Buffer.isBuffer(postData)) {
        req.write(JSON.stringify(postData));
      } else {
        req.write(postData);
      }
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
};
