import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const metadata: Metadata = { title: "Forgot password", description: "Request a secure Safety360 password recovery link." };
export default function ForgotPasswordPage() { return <AuthLayout variant="login"><AuthForm mode="forgot" /></AuthLayout>; }
