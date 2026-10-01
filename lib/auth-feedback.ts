export const DUPLICATE_ACCOUNT_MESSAGE =
  "This email is already in use. Sign in with it, or use Forgot password if you cannot access the account.";

export type LoginAudience = "admin" | "trainee";

type LoginProfile = {
  role?: unknown;
  status?: unknown;
};

type SignUpUser = {
  identities?: readonly unknown[] | null;
};

type AuthErrorDetails = {
  code?: unknown;
  message?: unknown;
};

export function isDuplicateSignUpResponse(user: SignUpUser | null | undefined) {
  return Array.isArray(user?.identities) && user.identities.length === 0;
}

export function getLoginAccessFeedback(
  profile: LoginProfile | null | undefined,
  selectedAudience: LoginAudience,
) {
  if (!profile) {
    return "Safety360 could not verify this account’s access area. Please try again or contact an administrator.";
  }

  if (profile.status !== "active") {
    return "This account is not active. Contact an administrator.";
  }

  const profileAudience = profile.role === "admin" || profile.role === "manager"
    ? "admin"
    : profile.role === "trainee"
      ? "trainee"
      : null;

  if (!profileAudience) {
    return "Safety360 could not verify this account’s access area. Please contact an administrator.";
  }

  if (profileAudience === selectedAudience) return null;

  return profileAudience === "admin"
    ? "This is an administrator account. Select Admin to sign in."
    : "This is a trainee account. Select Trainee to sign in.";
}

export function getRoleMismatchDestination(selectedAudience: LoginAudience) {
  return `/auth/role-mismatch?audience=${selectedAudience}`;
}

export function getRoleMismatchFeedback(selectedAudience: LoginAudience) {
  return selectedAudience === "admin"
    ? "This is a trainee account. Select Trainee to sign in."
    : "This is an administrator account. Select Admin to sign in.";
}

export function getAuthFeedbackMessage(error: unknown) {
  const details = error && typeof error === "object" ? error as AuthErrorDetails : null;
  const code = typeof details?.code === "string" ? details.code.toLowerCase() : "";
  const message = error instanceof Error
    ? error.message
    : typeof details?.message === "string"
      ? details.message
      : "The request could not be completed. Please try again.";
  const normalisedMessage = message.toLowerCase();

  if (
    code === "email_exists"
    || code === "user_already_exists"
    || normalisedMessage.includes("already registered")
    || normalisedMessage.includes("email already exists")
    || normalisedMessage.includes("email is already in use")
  ) {
    return DUPLICATE_ACCOUNT_MESSAGE;
  }

  if (code === "invalid_credentials" || normalisedMessage.includes("invalid login credentials")) {
    return "The email or password is incorrect. Check both fields and try again.";
  }

  if (code === "email_not_confirmed" || normalisedMessage.includes("email not confirmed")) {
    return "Confirm your email address first, then sign in. If the link expired, create the account again to request a fresh email.";
  }

  return message;
}
