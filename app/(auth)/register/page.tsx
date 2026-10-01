import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const metadata: Metadata = { title: "Register", description: "Create an IFI Safety360 trainee account." };
export default function RegisterPage() { return <AuthLayout variant="login"><AuthForm mode="register" /></AuthLayout>; }
