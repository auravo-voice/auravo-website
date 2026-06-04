import "server-only";

import nodemailer from "nodemailer";

import type { SixDimensionScores } from "@/lib/assessment/heuristics";

export type QuickAnalysisLead = {
  name: string;
  email: string;
  phone: string | null;
  scores: SixDimensionScores;
  at: string;
};

function smtpTransportOptions(): {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
} {
  const host =
    process.env.SMTP_HOST?.trim() ||
    (process.env.NODE_ENV === "production" ? "stalwart" : "127.0.0.1");
  const defaultPort = process.env.NODE_ENV === "production" ? "25" : "587";
  const portRaw = process.env.SMTP_PORT?.trim() ?? defaultPort;
  const port = Number.parseInt(portRaw, 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const resolvedPort = Number.isFinite(port) ? port : Number.parseInt(defaultPort, 10);
  const opts: {
    host: string;
    port: number;
    secure: boolean;
    ignoreTLS?: boolean;
    auth?: { user: string; pass: string };
    tls?: { servername?: string; rejectUnauthorized?: boolean };
  } = {
    host,
    port: resolvedPort,
    secure,
  };
  if (user && pass) {
    opts.auth = { user, pass };
  }
  // Internal relay on port 25 — stay plain; avoid STARTTLS cert mismatch on hostname "stalwart".
  if (!secure && resolvedPort === 25) {
    opts.ignoreTLS = true;
  }
  // Submission (587) presents a cert for mail.auravo.ai; internal hostname is often "stalwart".
  if (!secure && resolvedPort === 587) {
    const servername = process.env.SMTP_TLS_SERVERNAME?.trim() || "mail.auravo.ai";
    opts.tls = {
      servername,
      rejectUnauthorized: process.env.SMTP_TLS_INSECURE === "true",
    };
  }
  return opts;
}

function formatScores(scores: SixDimensionScores): string {
  return Object.entries(scores)
    .map(([dim, score]) => `${dim.replace(/_/g, " ")}: ${score}/100`)
    .join("\n");
}

/** Notify the team via Stalwart SMTP (submission relay on the host or `stalwart` container). */
export async function sendQuickAnalysisLeadEmail(lead: QuickAnalysisLead): Promise<void> {
  const from = process.env.QUICK_ANALYSIS_LEAD_FROM?.trim() || "support@auravo.ai";
  const to = process.env.QUICK_ANALYSIS_LEAD_TO?.trim() || "support@auravo.ai";

  const transporter = nodemailer.createTransport(smtpTransportOptions());

  await transporter.sendMail({
    from,
    to,
    replyTo: lead.email,
    subject: `New Quick Analysis Lead — ${lead.name}`,
    text: [
      "New demo lead from Quick Analysis:",
      "",
      `Name: ${lead.name}`,
      `Email: ${lead.email}`,
      `Phone: ${lead.phone || "not provided"}`,
      `Submitted: ${lead.at}`,
      "",
      "Analysis snapshot:",
      formatScores(lead.scores),
    ].join("\n"),
  });
}
