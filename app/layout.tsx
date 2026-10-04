import type { Metadata } from "next";
import { Doto, Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Dot-matrix display face for the mark and big numbers.
const doto = Doto({
  variable: "--font-doto",
  subsets: ["latin"],
  weight: ["700", "900"],
});

const siteUrl =
  process.env.AUTH_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

const description =
  "Open-source testing for voice AI agents: synthetic callers, realistic speech-to-text noise, and a rubric judge that quotes its evidence.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Gauntlet", template: "%s · Gauntlet" },
  description,
  openGraph: {
    title: "Gauntlet: break your voice agent before your customers do",
    description,
    siteName: "Gauntlet",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Gauntlet", description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${doto.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
