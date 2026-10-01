import type { Metadata } from "next";
import { Cormorant_Garamond, Geist_Mono, Manrope } from "next/font/google";
import { InitialLoader } from "@/components/motion/InitialLoader";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-ifi-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const defaultTitle = "IFI Safety360 | Interactive Safety Training";
const defaultDescription = "Immersive workplace health and safety training for automotive warehousing and logistics.";

export function generateMetadata(): Metadata {
  let siteUrl = new URL("http://localhost:3000");
  try {
    const configuredUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
    if (configuredUrl.protocol === "http:" || configuredUrl.protocol === "https:") siteUrl = configuredUrl;
  } catch {
    // The documented local origin is a safe metadata fallback for malformed setup.
  }
  const socialImage = new URL("/og.png", siteUrl).toString();

  return {
    metadataBase: siteUrl,
    title: { default: defaultTitle, template: "%s | IFI Safety360" },
    description: defaultDescription,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      type: "website",
      siteName: "IFI Safety360",
      title: defaultTitle,
      description: defaultDescription,
      images: [{ url: socialImage, width: 1732, height: 909, alt: "IFI Safety360 — sharper awareness, safer operations" }],
    },
    twitter: {
      card: "summary_large_image",
      title: defaultTitle,
      description: defaultDescription,
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${manrope.variable} ${cormorant.variable} ${geistMono.variable}`}>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <InitialLoader />
        {children}
      </body>
    </html>
  );
}
