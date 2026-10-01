import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const metadata: Metadata = { title: "Reset password", description: "Choose a new Safety360 account password." };
export default function ResetPasswordPage() { return <AuthLayout><AuthForm mode="reset" /></AuthLayout>; }
