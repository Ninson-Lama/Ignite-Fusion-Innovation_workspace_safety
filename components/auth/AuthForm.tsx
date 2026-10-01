"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Eye, EyeOff, GraduationCap, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { AutoDismissNotice } from "@/components/ui/AutoDismissNotice";
import {
  getAuthFeedbackMessage,
  getLoginAccessFeedback,
  isDuplicateSignUpResponse,
  type LoginAudience,
} from "@/lib/auth-feedback";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured, supabaseConfigurationMessage } from "@/lib/supabase/config";

type AuthMode = "login" | "register" | "forgot" | "reset";

interface AuthFormProps { mode: AuthMode; initialMessage?: string; initialError?: string; }

const content = {
  login: { eyebrow: "Secure access", title: "Welcome back", description: "Continue your assigned training and pick up where you left off.", button: "Sign in securely" },
  register: { eyebrow: "Create trainee account", title: "Start your training", description: "Register with your work email. Every new account begins with trainee access.", button: "Create account" },
  forgot: { eyebrow: "Account recovery", title: "Reset your password", description: "Enter your account email and we’ll send a secure recovery link.", button: "Send recovery link" },
  reset: { eyebrow: "Choose a new password", title: "Secure your account", description: "Use at least eight characters and avoid a password you use elsewhere.", button: "Update password" },
} satisfies Record<AuthMode, { eyebrow: string; title: string; description: string; button: string }>;

export function AuthForm({ mode, initialMessage, initialError }: AuthFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<{ type: "error" | "success"; text: string } | null>(
    initialError
      ? { type: "error", text: initialError }
      : initialMessage
        ? { type: "success", text: initialMessage }
        : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [loginAudience, setLoginAudience] = useState<LoginAudience>("trainee");
  const copy = content[mode];
  const loginDestination = loginAudience === "admin" ? "/admin" : "/dashboard";
  const submitLabel = mode === "login"
    ? loginAudience === "admin" ? "Sign in as admin" : "Sign in to training"
    : copy.button;

  function handleAudienceKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const nextAudience = loginAudience === "admin" ? "trainee" : "admin";
    setLoginAudience(nextAudience);
    window.requestAnimationFrame(() => document.getElementById(`login-audience-${nextAudience}`)?.focus());
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const client = getBrowserSupabaseClient();
    if (!client) {
      setStatus({ type: "error", text: supabaseConfigurationMessage });
      return;
    }

    if (mode === "register" && fullName.trim().length < 2) {
      setStatus({ type: "error", text: "Enter your full name." });
      return;
    }
    if ((mode === "login" || mode === "register" || mode === "forgot") && !email.trim()) {
      setStatus({ type: "error", text: "Enter your work email address." });
      return;
    }
    if (mode === "login" && !password) {
      setStatus({ type: "error", text: "Enter your password." });
      return;
    }

    if ((mode === "register" || mode === "reset") && password.length < 8) {
      setStatus({ type: "error", text: "Use a password with at least eight characters." });
      return;
    }
    if ((mode === "register" || mode === "reset") && password !== confirmPassword) {
      setStatus({ type: "error", text: "The passwords do not match." });
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;

        const { data: profile, error: profileError } = await client
          .from("profiles")
          .select("role, status")
          .eq("id", data.user.id)
          .maybeSingle();
        const accessFeedback = profileError
          ? "Safety360 could not verify this account’s access area. Please try again."
          : getLoginAccessFeedback(profile, loginAudience);

        if (accessFeedback) {
          await client.auth.signOut({ scope: "local" });
          setPassword("");
          setStatus({ type: "error", text: accessFeedback });
          return;
        }

        router.replace(loginDestination);
        router.refresh();
        return;
      }

      if (mode === "register") {
        const normalisedEmail = email.trim();
        const { data, error } = await client.auth.signUp({
          email: normalisedEmail,
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          },
        });
        if (error) throw error;
        if (isDuplicateSignUpResponse(data.user)) {
          throw new Error("User already registered");
        }
        if (!data.user) {
          throw new Error("Safety360 could not create the account. Please try again.");
        }
        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
          return;
        }
        setConfirmationEmail(normalisedEmail);
        setPassword("");
        setConfirmPassword("");
        setStatus({
          type: "success",
          text: "Confirmation email sent. Open it and select Confirm email; Safety360 will verify the address, sign you in, and open your dashboard.",
        });
      }

      if (mode === "forgot") {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (error) throw error;
        setStatus({ type: "success", text: "If the address belongs to an account, a recovery link has been sent." });
      }

      if (mode === "reset") {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        setStatus({ type: "success", text: "Password updated. You can now continue to your dashboard." });
      }
    } catch (error) {
      setStatus({
        type: "error",
        text: getAuthFeedbackMessage(error),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function resendConfirmation() {
    const client = getBrowserSupabaseClient();
    if (!client || !confirmationEmail) return;
    setResending(true);
    setStatus(null);
    try {
      const { error } = await client.auth.resend({
        type: "signup",
        email: confirmationEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
      });
      if (error) throw error;
      setStatus({ type: "success", text: "A fresh confirmation email has been sent. You may need to check your spam folder." });
    } catch (error) {
      setStatus({ type: "error", text: getAuthFeedbackMessage(error) });
    } finally {
      setResending(false);
    }
  }

  const isFocusedAuth = mode === "login" || mode === "register" || mode === "forgot";

  return (
    <div className={`auth-form-wrap${isFocusedAuth ? " auth-form-login" : ""}${mode === "register" ? " auth-form-register" : ""}${mode === "forgot" ? " auth-form-forgot" : ""}`}>
      {isFocusedAuth && (
        <Link className="auth-back-link" href={mode === "login" ? "/" : "/login"}>
          <ArrowLeft size={17} aria-hidden="true" />
          {mode === "login" ? "Back to home" : "Back to sign in"}
        </Link>
      )}
      <p className="eyebrow auth-eyebrow"><span /> {copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <p className="auth-description">{copy.description}</p>

      {mode === "forgot" && (
        <div className="auth-recovery-guide">
          <span><ShieldCheck size={21} aria-hidden="true" /></span>
          <div><strong>Secure, one-time recovery</strong><p>We’ll email a protected link. Open it in the same browser to choose a new password.</p></div>
        </div>
      )}

      {mode === "login" && (
        <fieldset className="auth-access-fieldset">
          <legend>Choose your access area</legend>
          <div className="auth-access-options">
            <label className={loginAudience === "admin" ? "selected" : ""}>
              <input
                id="login-audience-admin"
                type="radio"
                name="login-audience"
                value="admin"
                checked={loginAudience === "admin"}
                onChange={() => setLoginAudience("admin")}
                onKeyDown={handleAudienceKeyDown}
              />
              <span className="auth-access-icon"><ShieldCheck size={21} aria-hidden="true" /></span>
              <span className="auth-access-copy">
                <strong>Admin</strong>
                <small>Users, training and reports</small>
              </span>
              <span className="auth-access-check" aria-hidden="true"><Check size={14} /></span>
            </label>
            <label className={loginAudience === "trainee" ? "selected" : ""}>
              <input
                id="login-audience-trainee"
                type="radio"
                name="login-audience"
                value="trainee"
                checked={loginAudience === "trainee"}
                onChange={() => setLoginAudience("trainee")}
                onKeyDown={handleAudienceKeyDown}
              />
              <span className="auth-access-icon"><GraduationCap size={21} aria-hidden="true" /></span>
              <span className="auth-access-copy">
                <strong>Trainee</strong>
                <small>Modules, activities and progress</small>
              </span>
              <span className="auth-access-check" aria-hidden="true"><Check size={14} /></span>
            </label>
          </div>
          <p>Your assigned account role is always verified after sign-in.</p>
        </fieldset>
      )}

      {!isSupabaseConfigured && (
        <div className="configuration-notice" role="note">
          <LockKeyhole size={18} /><div><strong>Connection required</strong><p>{supabaseConfigurationMessage}</p></div>
        </div>
      )}

      {status && (
        <AutoDismissNotice key={`${status.type}:${status.text}`} className={`form-status ${status.type}`} role={status.type === "error" ? "alert" : "status"} onDismiss={() => setStatus(null)}>
          {status.type === "success" && <CheckCircle2 size={18} />}<span>{status.text}</span>
        </AutoDismissNotice>
      )}

      {mode === "register" && confirmationEmail && (
        <div className="auth-confirmation-card">
          <span><Mail size={20} aria-hidden="true" /></span>
          <div><strong>Check your inbox</strong><p>Confirm <b>{confirmationEmail}</b> to activate your trainee account and open the training dashboard.</p></div>
        </div>
      )}

      {!(mode === "register" && confirmationEmail) && <form onSubmit={handleSubmit} noValidate>
        {mode === "register" && (
          <label className="form-field"><span>Full name</span><div><UserRound size={18} /><input autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Alex Morgan" required /></div></label>
        )}
        {(mode === "login" || mode === "register" || mode === "forgot") && (
          <label className="form-field"><span>Work email</span><div><Mail size={18} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.co.uk" required /></div></label>
        )}
        {(mode === "login" || mode === "register" || mode === "reset") && (
          <label className="form-field"><span>{mode === "reset" ? "New password" : "Password"}</span><div><LockKeyhole size={18} /><input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required /><button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
        )}
        {(mode === "register" || mode === "reset") && (
          <label className="form-field"><span>Confirm password</span><div><LockKeyhole size={18} /><input type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></div></label>
        )}

        {mode === "login" && <div className="form-options"><Link href="/forgot-password">Forgot password?</Link></div>}

        <button className="button button-primary auth-submit" disabled={submitting || !isSupabaseConfigured}>
          {submitting ? "Please wait…" : submitLabel}<ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>}

      {mode === "register" && confirmationEmail && (
        <button className="auth-resend" type="button" onClick={() => void resendConfirmation()} disabled={resending}>
          <Mail size={15} /> {resending ? "Sending another email…" : "Resend confirmation email"}
        </button>
      )}

      <p className="auth-switch">
        {mode === "login" && <>New to Safety360? <Link href="/register">Create a trainee account</Link></>}
        {mode === "register" && <>Already registered? <Link href="/login">Sign in</Link></>}
        {mode === "forgot" && <><Link href="/login">Return to sign in</Link></>}
        {mode === "reset" && <><Link href="/login">Return to sign in</Link> <span>·</span> <Link href="/dashboard">Continue to dashboard</Link></>}
      </p>
      <p className="auth-security"><LockKeyhole size={14} /> Protected by Supabase Authentication and database row-level security</p>
    </div>
  );
}
