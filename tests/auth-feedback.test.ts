import { describe, expect, it } from "vitest";
import {
  DUPLICATE_ACCOUNT_MESSAGE,
  getAuthFeedbackMessage,
  getLoginAccessFeedback,
  getRoleMismatchDestination,
  getRoleMismatchFeedback,
  isDuplicateSignUpResponse,
} from "@/lib/auth-feedback";
import { NOTIFICATION_DISMISS_MS } from "@/lib/notifications";

describe("authentication feedback", () => {
  it("dismisses operation feedback after four seconds", () => {
    expect(NOTIFICATION_DISMISS_MS).toBe(4_000);
  });

  it("recognises Supabase's disguised duplicate sign-up response", () => {
    expect(isDuplicateSignUpResponse({ identities: [] })).toBe(true);
    expect(isDuplicateSignUpResponse({ identities: [{ provider: "email" }] })).toBe(false);
    expect(isDuplicateSignUpResponse({})).toBe(false);
  });

  it("maps duplicate account codes and messages to clear guidance", () => {
    expect(getAuthFeedbackMessage({ code: "email_exists", message: "Email exists" }))
      .toBe(DUPLICATE_ACCOUNT_MESSAGE);
    expect(getAuthFeedbackMessage(new Error("User already registered")))
      .toBe(DUPLICATE_ACCOUNT_MESSAGE);
  });

  it("replaces the raw invalid-credentials response with useful guidance", () => {
    expect(getAuthFeedbackMessage({ code: "invalid_credentials", message: "Invalid login credentials" }))
      .toBe("The email or password is incorrect. Check both fields and try again.");
  });

  it("accepts only the access area assigned to the account", () => {
    expect(getLoginAccessFeedback({ role: "admin", status: "active" }, "admin")).toBeNull();
    expect(getLoginAccessFeedback({ role: "trainee", status: "active" }, "trainee")).toBeNull();
    expect(getLoginAccessFeedback({ role: "admin", status: "active" }, "trainee"))
      .toBe("This is an administrator account. Select Admin to sign in.");
    expect(getLoginAccessFeedback({ role: "trainee", status: "active" }, "admin"))
      .toBe("This is a trainee account. Select Trainee to sign in.");
  });

  it("keeps legacy manager accounts in the administrator access area", () => {
    expect(getLoginAccessFeedback({ role: "manager", status: "active" }, "admin")).toBeNull();
    expect(getLoginAccessFeedback({ role: "manager", status: "active" }, "trainee"))
      .toBe("This is an administrator account. Select Admin to sign in.");
  });

  it("rejects missing, inactive, and unrecognised profiles", () => {
    expect(getLoginAccessFeedback(null, "trainee")).toContain("could not verify");
    expect(getLoginAccessFeedback({ role: "trainee", status: "suspended" }, "trainee"))
      .toBe("This account is not active. Contact an administrator.");
    expect(getLoginAccessFeedback({ role: "owner", status: "active" }, "admin"))
      .toContain("could not verify");
  });

  it("routes server-detected role mismatches back through a local sign-out", () => {
    expect(getRoleMismatchDestination("admin")).toBe("/auth/role-mismatch?audience=admin");
    expect(getRoleMismatchDestination("trainee")).toBe("/auth/role-mismatch?audience=trainee");
    expect(getRoleMismatchFeedback("admin"))
      .toBe("This is a trainee account. Select Trainee to sign in.");
    expect(getRoleMismatchFeedback("trainee"))
      .toBe("This is an administrator account. Select Admin to sign in.");
  });
});
