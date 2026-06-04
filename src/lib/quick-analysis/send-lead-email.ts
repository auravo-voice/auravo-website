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
  const host = process.env.SMTP_HOST?.trim() || "127.0.0.1";
  const portRaw = process.env.SMTP_PORT?.trim() ?? "587";
  const port = Number.parseInt(portRaw, 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const opts = {
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
  };
  if (user && pass) {
    return { ...opts, auth: { user, pass } };
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
