import { describe, expect, it } from "vitest";
import { getSafeAuthDestination, parseEmailOtpType } from "@/lib/auth-callback";

describe("auth callback boundaries", () => {
  const origin = "https://safety360.example";

  it("keeps valid callback destinations on the current application origin", () => {
    expect(getSafeAuthDestination(origin, "/dashboard?welcome=1", "/dashboard"))
      .toBe("/dashboard?welcome=1");
  });

  it("rejects external, protocol-relative and backslash redirect attempts", () => {
    expect(getSafeAuthDestination(origin, "https://evil.example", "/dashboard")).toBe("/dashboard");
    expect(getSafeAuthDestination(origin, "//evil.example", "/dashboard")).toBe("/dashboard");
    expect(getSafeAuthDestination(origin, "/\\evil.example", "/dashboard")).toBe("/dashboard");
  });

  it("accepts only supported Supabase email verification types", () => {
    expect(parseEmailOtpType("signup")).toBe("signup");
    expect(parseEmailOtpType("recovery")).toBe("recovery");
    expect(parseEmailOtpType("sms")).toBeNull();
    expect(parseEmailOtpType(null)).toBeNull();
  });
});
