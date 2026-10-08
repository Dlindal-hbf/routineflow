import test from "node:test";
import assert from "node:assert/strict";
import { validateAuthForm } from "../../src/auth/validation.ts";

const form = (overrides = {}) => {
  const result = new FormData();
  for (const [key, value] of Object.entries({ fullName: "Test Person", email: "person@example.test", password: "a long password here", confirmPassword: "a long password here", ...overrides })) result.set(key, value);
  return result;
};

test("registration validates and normalizes identity without trimming the password", () => {
  const data = validateAuthForm("register", form({ email: "  PERSON@example.test  ", password: " long password ", confirmPassword: " long password " }));
  assert.equal(data.valid, true);
  assert.equal(data.email, "person@example.test");
  assert.equal(data.password, " long password ");
});
test("registration rejects missing name, invalid email, short and mismatched passwords", () => {
  const data = validateAuthForm("register", form({ fullName: " ", email: "bad", password: "short", confirmPassword: "different" }));
  assert.equal(data.valid, false);
  assert.deepEqual(Object.keys(data.fieldErrors).sort(), ["confirmPassword", "email", "fullName", "password"]);
});
test("existing login passwords are not subject to new-account minimum length", () => {
  assert.equal(validateAuthForm("login", form({ password: "old" })).valid, true);
});
test("reset requires matching strong passwords but no email or name", () => {
  assert.equal(validateAuthForm("reset", form({ email: "", fullName: "" })).valid, true);
  assert.equal(validateAuthForm("reset", form({ password: "short", confirmPassword: "short" })).valid, false);
});
test("forgot password only validates email", () => {
  assert.equal(validateAuthForm("forgot", form({ password: "", confirmPassword: "", fullName: "" })).valid, true);
});
test("upgrade uses registration validation, and oversized values are rejected", () => {
  assert.equal(validateAuthForm("upgrade", form()).valid, true);
  assert.equal(validateAuthForm("upgrade", form({ fullName: "a".repeat(101), password: "x".repeat(129) })).valid, false);
});
