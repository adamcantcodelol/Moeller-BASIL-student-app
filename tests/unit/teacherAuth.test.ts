import { describe, expect, it } from "vitest";
import {
  TEACHER_SESSION_MS,
  clearLoginFailures,
  loginBlockedFor,
  recordLoginFailure,
  signTeacherToken,
  verifyTeacherPassword,
  verifyTeacherToken,
} from "@/lib/auth/teacherToken";

const PW = "correct horse battery";

describe("teacher auth", () => {
  it("checks the password", async () => {
    expect(await verifyTeacherPassword(PW, PW)).toBe(true);
    expect(await verifyTeacherPassword("wrong", PW)).toBe(false);
    expect(await verifyTeacherPassword(PW, undefined)).toBe(false);
  });

  it("signs and verifies session tokens with expiry", async () => {
    const now = 1_700_000_000_000;
    const token = await signTeacherToken(PW, now);
    expect(await verifyTeacherToken(token, PW, now + 1000)).toBe(true);
    expect(await verifyTeacherToken(token, "other-password", now)).toBe(false);
    expect(await verifyTeacherToken(token, PW, now + TEACHER_SESSION_MS + 1)).toBe(false);
    const [exp, sig] = token.split(".");
    expect(await verifyTeacherToken(`${Number(exp) + 1}.${sig}`, PW, now)).toBe(false);
    expect(await verifyTeacherToken("garbage", PW, now)).toBe(false);
    expect(await verifyTeacherToken(undefined, PW, now)).toBe(false);
    expect(await verifyTeacherToken(token, undefined, now)).toBe(false);
  });

  it("locks out after repeated failures", () => {
    const ip = "203.0.113.9";
    const now = 1_700_000_000_000;
    for (let i = 0; i < 4; i += 1) recordLoginFailure(ip, now);
    expect(loginBlockedFor(ip, now)).toBe(0);
    recordLoginFailure(ip, now);
    expect(loginBlockedFor(ip, now)).toBeGreaterThan(0);
    expect(loginBlockedFor(ip, now + 6 * 60 * 1000)).toBe(0);
    clearLoginFailures(ip);
    expect(loginBlockedFor(ip, now)).toBe(0);
  });
});
