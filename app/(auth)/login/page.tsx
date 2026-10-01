import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const metadata: Metadata = { title: "Sign in", description: "Sign in securely to IFI Safety360." };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string; error?: string }> }) {
  const { message, error } = await searchParams;
  return <AuthLayout variant="login"><AuthForm mode="login" initialMessage={message} initialError={error} /></AuthLayout>;
}
