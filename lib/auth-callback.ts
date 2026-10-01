import type { EmailOtpType } from "@supabase/supabase-js";

const supportedEmailOtpTypes = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export function parseEmailOtpType(value: string | null): EmailOtpType | null {
  return value && supportedEmailOtpTypes.has(value) ? value : null;
}

export function getSafeAuthDestination(
  origin: string,
  requestedNext: string | null,
  fallback: string,
) {
  if (
    !requestedNext
    || !requestedNext.startsWith("/")
    || requestedNext.startsWith("//")
    || requestedNext.includes("\\")
  ) {
    return fallback;
  }

  try {
    const candidate = new URL(requestedNext, origin);
    return candidate.origin === origin
      ? `${candidate.pathname}${candidate.search}${candidate.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}
