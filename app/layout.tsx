import type { Metadata } from "next";
import { Geist_Mono, Montserrat } from "next/font/google";
import { AppProviders } from "@/components/providers";
import { getAuthSessionSnapshot } from "@/lib/auth/session-snapshot";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Auravo",
    template: "%s · Auravo",
  },
  description:
    "Voice-first communication coaching for interviews, meetings, and high-stakes conversations—with clear, actionable feedback.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialAuthSession = await getAuthSessionSnapshot();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${montserrat.variable} ${geistMono.variable} min-h-dvh font-sans antialiased`}
      >
        <AppProviders initialAuthSession={initialAuthSession}>{children}</AppProviders>
      </body>
    </html>
  );
}
