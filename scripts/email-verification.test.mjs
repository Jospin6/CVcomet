import test from "node:test";
import assert from "node:assert/strict";
import {
  generateVerificationCode,
  hashVerificationCode,
  matchesVerificationCode,
  normalizeVerificationEmail,
  isValidVerificationCode,
} from "../src/lib/auth/email-verification-code.ts";

process.env.EMAIL_VERIFICATION_SECRET = "test-only-separate-secret-at-least-32-characters-long";

test("email normalization and validation", () => {
  assert.equal(normalizeVerificationEmail("  TEST@Example.com "), "test@example.com");
  assert.equal(normalizeVerificationEmail("invalid-email"), null);
  assert.equal(normalizeVerificationEmail({ email: "x@y.com" }), null);
});

test("verification codes always contain six digits, including leading zeroes", () => {
  for (let i = 0; i < 100; i++) {
    const code = generateVerificationCode();
    assert.match(code, /^\d{6}$/);
    assert.ok(isValidVerificationCode(code));
  }
  assert.equal(isValidVerificationCode("012345"), true);
  assert.equal(isValidVerificationCode(123456), false);
  assert.equal(isValidVerificationCode("12345"), false);
});

test("code hashes are keyed, email-scoped, and do not reveal codes", () => {
  const email = "test@example.com";
  const hash = hashVerificationCode(email, "012345");
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash.includes("012345"), false);
  assert.equal(matchesVerificationCode(hash, email, "012345"), true);
  assert.equal(matchesVerificationCode(hash, email, "543210"), false);
  assert.equal(matchesVerificationCode(hash, "other@example.com", "012345"), false);
  assert.equal(matchesVerificationCode("012345", email, "012345"), false);
});


test("hashing fails closed if the verification secret is missing or weak", () => {
  const existing = process.env.EMAIL_VERIFICATION_SECRET;
  const fallback = process.env.BETTER_AUTH_SECRET;
  try {
    delete process.env.EMAIL_VERIFICATION_SECRET;
    delete process.env.BETTER_AUTH_SECRET;
    assert.throws(() => hashVerificationCode("test@example.com", "012345"), /EMAIL_VERIFICATION_SECRET/);
    process.env.EMAIL_VERIFICATION_SECRET = "weak";
    assert.throws(() => hashVerificationCode("test@example.com", "012345"), /EMAIL_VERIFICATION_SECRET/);
  } finally {
    if (existing === undefined) delete process.env.EMAIL_VERIFICATION_SECRET;
    else process.env.EMAIL_VERIFICATION_SECRET = existing;
    if (fallback === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = fallback;
  }
});
