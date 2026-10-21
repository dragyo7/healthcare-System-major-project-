/**
 * test_jwt_security_configuration.js
 *
 * Verifies fail-closed JWT configuration and token security:
 * 1. Missing secret in production throws Error
 * 2. Default weak secret ('rag_healthcare_secret') in production throws Error
 * 3. Prohibited pattern ('password', '123456', 'changeme') in production throws Error
 * 4. Short secret (< 32 chars) in production throws Error
 * 5. Secret value is never leaked in error messages
 * 6. Strong secret (>= 32 chars) in production succeeds
 * 7. Development fallback applies only when NODE_ENV !== 'production'
 * 8. Direct validateSecurityConfig() invocation can be tested without server side-effects
 * 9. Expired token is rejected
 * 10. Tampered token signature is rejected
 * 11. Secret mismatch is rejected
 */

const assert = require("assert");
const path = require("path");

const backendDir = path.resolve(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend");
const backendModules = path.join(backendDir, "node_modules");
const jwt = require(path.join(backendModules, "jsonwebtoken"));
const { validateSecurityConfig } = require(path.join(backendDir, "src/app"));

console.log("==========================================================================");
console.log("       TEST: JWT SECURITY CONFIGURATION & FAIL-CLOSED GUARDS              ");
console.log("==========================================================================\n");

function testProductionFailClosed() {
    const originalEnv = { ...process.env };

    try {
        // Test 1: Production with missing secret
        delete process.env.JWT_SECRET;
        process.env.NODE_ENV = "production";

        let threw = false;
        try {
            delete require.cache[require.resolve(path.join(backendDir, "src/app"))];
            require(path.join(backendDir, "src/app"));
        } catch (err) {
            threw = true;
            assert(err.message.includes("CRITICAL SECURITY CONFIGURATION ERROR"), "Must throw critical security error on missing secret");
        }
        assert(threw, "App must refuse to load in production without JWT_SECRET");
        console.log("✔ [PASS] 1. Production startup fails when JWT_SECRET is missing");

        // Test 2: Production with weak default secret
        process.env.JWT_SECRET = "rag_healthcare_secret";
        process.env.NODE_ENV = "production";
        threw = false;
        try {
            delete require.cache[require.resolve(path.join(backendDir, "src/app"))];
            require(path.join(backendDir, "src/app"));
        } catch (err) {
            threw = true;
            assert(err.message.includes("CRITICAL SECURITY CONFIGURATION ERROR"), "Must reject default weak secret");
        }
        assert(threw, "App must refuse to load in production with 'rag_healthcare_secret'");
        console.log("✔ [PASS] 2. Production startup fails when JWT_SECRET is default weak secret");

        // Test 3: Production with short secret (< 32 chars)
        process.env.JWT_SECRET = "short_insecure_key_12345";
        process.env.NODE_ENV = "production";
        threw = false;
        try {
            delete require.cache[require.resolve(path.join(backendDir, "src/app"))];
            require(path.join(backendDir, "src/app"));
        } catch (err) {
            threw = true;
            assert(err.message.includes("minimum 32 characters"), "Must enforce minimum length");
        }
        assert(threw, "App must refuse to load in production with short secret");
        console.log("✔ [PASS] 3. Production startup fails when JWT_SECRET is shorter than 32 characters");

        // Test 4: Secret value is NEVER leaked in error messages
        const testLeakedSecret = "sensitive_secret_value_not_to_leak_123456!";
        try {
            validateSecurityConfig({ NODE_ENV: "production", JWT_SECRET: testLeakedSecret });
            assert.fail("Should have thrown error");
        } catch (err) {
            assert(!err.message.includes(testLeakedSecret), "Security error must never print the secret value in logs or errors");
        }
        console.log("✔ [PASS] 4. Secret value is never leaked in error messages");

        // Test 5: Production with prohibited dictionary passwords
        assert.throws(() => {
            validateSecurityConfig({ NODE_ENV: "production", JWT_SECRET: "my_hospital_admin_password_which_is_over_32_chars_long" });
        }, /CRITICAL SECURITY CONFIGURATION ERROR/);
        console.log("✔ [PASS] 5. Production startup rejects prohibited dictionary words (password, changeme, etc.)");

        // Test 6: Development fallback applies only when NODE_ENV !== 'production'
        const devEnv = { NODE_ENV: "development" };
        validateSecurityConfig(devEnv);
        assert(devEnv.JWT_SECRET && devEnv.JWT_SECRET.startsWith("dev_"), "Development mode must set dev-only fallback secret");
        console.log("✔ [PASS] 6. Development fallback explicitly limited to non-production environments");

        // Test 7: Production with strong secret (>= 32 chars) succeeds
        const strongSecret = "production_super_strong_cryptographic_jwt_signing_key_2026_pallotti!";
        assert.doesNotThrow(() => {
            validateSecurityConfig({ NODE_ENV: "production", JWT_SECRET: strongSecret });
        });
        console.log("✔ [PASS] 7. Production validation succeeds with strong >=32 char secret");

    } finally {
        process.env = originalEnv;
        delete require.cache[require.resolve(path.join(backendDir, "src/app"))];
    }
}

function testTokenVerificationIntegrity() {
    const testSecret = "test_cryptographic_signing_key_32_characters_long!";

    // Test 8: Expired token rejection
    const expiredToken = jwt.sign(
        { user_id: 1, role: "doctor", email: "doctor@hospital.org" },
        testSecret,
        { expiresIn: "-1s" }
    );
    let expiredRejected = false;
    try {
        jwt.verify(expiredToken, testSecret);
    } catch (err) {
        if (err.name === "TokenExpiredError") expiredRejected = true;
    }
    assert(expiredRejected, "Expired token must be rejected with TokenExpiredError");
    console.log("✔ [PASS] 8. Expired token strictly rejected with TokenExpiredError");

    // Test 9: Tampered signature rejection
    const validToken = jwt.sign(
        { user_id: 1, role: "doctor", email: "doctor@hospital.org" },
        testSecret,
        { expiresIn: "1h" }
    );
    const tamperedToken = validToken.slice(0, -5) + "abcde";
    let tamperedRejected = false;
    try {
        jwt.verify(tamperedToken, testSecret);
    } catch (err) {
        if (err.name === "JsonWebTokenError") tamperedRejected = true;
    }
    assert(tamperedRejected, "Tampered signature must be rejected with JsonWebTokenError");
    console.log("✔ [PASS] 9. Tampered signature strictly rejected with JsonWebTokenError");

    // Test 10: Secret mismatch rejection
    let mismatchRejected = false;
    try {
        jwt.verify(validToken, "completely_different_signing_key_for_tampering!");
    } catch (err) {
        if (err.name === "JsonWebTokenError") mismatchRejected = true;
    }
    assert(mismatchRejected, "Token signed with different secret must be rejected");
    console.log("✔ [PASS] 10. Secret mismatch strictly rejected");
}

try {
    testProductionFailClosed();
    testTokenVerificationIntegrity();
    console.log("\n==========================================================================");
    console.log("  ALL 10 JWT SECURITY & FAIL-CLOSED CHECKS PASSED SUCCESSFULLY!");
    console.log("==========================================================================\n");
    process.exit(0);
} catch (err) {
    console.error("\n❌ JWT SECURITY TEST FAILED:", err);
    process.exit(1);
}
