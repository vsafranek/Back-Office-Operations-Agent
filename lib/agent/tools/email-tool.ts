import { google } from "googleapis";
import { getGoogleAuthForUser } from "@/lib/integrations/google-user-auth";

type GmailPartHeader = { name?: string | null; value?: string | null };
type GmailMessagePart = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailMessagePart[] | null;
};

const GMAIL_MODIFY = "https://www.googleapis.com/auth/gmail.modify";

export function toRawEmail(input: { to: string; subject: string; body: string }) {
  const email = [
    `To: ${input.to}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${input.subject}`,
    "",
    input.body
  ].join("\n");

  return Buffer.from(email).toString("base64url");
}

function decodeGmailBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function headersToRecord(headers: GmailPartHeader[] | undefined): Record<string, string> {
  const r: Record<string, string> = {};
  for (const h of headers ?? []) {
    if (h.name && h.value) {
      r[h.name.toLowerCase()] = h.value;
    }
  }
  return r;
}

function extractPlainFromPart(part: GmailMessagePart | undefined | null): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeGmailBase64Url(part.body.data);
  }
  if (part.mimeType?.startsWith("multipart/") && part.parts) {
    for (const p of part.parts) {
      const t = extractPlainFromPart(p);
      if (t.trim()) return t;
    }
  }
  return "";
}

export async function createEmailDraft(input: {
  userId: string;
  to: string;
  subject: string;
  body: string;
}) {
  const { auth } = await getGoogleAuthForUser({
    userId: input.userId,
    scopes: [GMAIL_MODIFY]
  });
  const gmail = google.gmail({ version: "v1", auth });
  const raw = toRawEmail(input);

  const result = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: { raw }
    }
  });

  return {
    draftId: result.data.id,
    messageId: result.data.message?.id
  };
}

/** Odešle existující Gmail draft (druhý krok po schválení uživatele). */
export async function sendGmailDraft(input: { userId: string; draftId: string }) {
  const { auth } = await getGoogleAuthForUser({
    userId: input.userId,
    scopes: [GMAIL_MODIFY]
  });
  const gmail = google.gmail({ version: "v1", auth });
  const result = await gmail.users.drafts.send({
    userId: "me",
    requestBody: { id: input.draftId }
  });
  return {
    messageId: result.data.id ?? null,
    threadId: result.data.threadId ?? null
  };
}

/**
 * Přímé odeslání zprávy (bez uložení jako draft) — Gmail users.messages.send.
 */
export async function sendGmailMessageNow(input: { userId: string; to: string; subject: string; body: string }) {
  const { auth } = await getGoogleAuthForUser({
    userId: input.userId,
    scopes: [GMAIL_MODIFY]
  });
  const gmail = google.gmail({ version: "v1", auth });
  const raw = toRawEmail(input);
  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw }
  });
  return {
    messageId: result.data.id ?? null,
    threadId: result.data.threadId ?? null
  };
}

export type GmailListItem = {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  date: string;
  labelIds: string[];
};

/**
 * Seznam zpráv (výchozí štítek INBOX). Podporuje Gmail search query (`q`).
 */
export async function listGmailMessages(input: {
  userId: string;
  maxResults?: number;
  q?: string;
  labelIds?: string[];
}): Promise<{ messages: GmailListItem[] }> {
  const max = Math.min(Math.max(input.maxResults ?? 10, 1), 50);
  const { auth } = await getGoogleAuthForUser({
    userId: input.userId,
    scopes: [GMAIL_MODIFY]
  });
  const gmail = google.gmail({ version: "v1", auth });

  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: max,
    q: input.q?.trim() || undefined,
    labelIds: input.labelIds != null && input.labelIds.length > 0 ? input.labelIds : ["INBOX"]
  });

  const refs = list.data.messages ?? [];
  const messages: GmailListItem[] = [];

  for (const ref of refs) {
    if (!ref.id) continue;
    const msg = await gmail.users.messages.get({
      userId: "me",
      id: ref.id,
      format: "metadata",
      metadataHeaders: ["From", "To", "Subject", "Date"]
    });
    const headers = headersToRecord(msg.data.payload?.headers);
    messages.push({
      id: ref.id,
      threadId: ref.threadId ?? msg.data.threadId ?? "",
      snippet: msg.data.snippet ?? "",
      from: headers.from ?? "",
      subject: headers.subject ?? "",
      date: headers.date ?? "",
      labelIds: msg.data.labelIds ?? []
    });
  }

  return { messages };
}

export type GmailMessageDetail = {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  labelIds: string[];
  bodyText: string;
};

/**
 * Načte jednu zprávu včetně pokusu o text/plain tělo (zkrácené).
 */
export async function getGmailMessage(input: {
  userId: string;
  messageId: string;
  maxBodyChars?: number;
}): Promise<GmailMessageDetail> {
  const maxBody = Math.min(Math.max(input.maxBodyChars ?? 20_000, 500), 100_000);
  const { auth } = await getGoogleAuthForUser({
    userId: input.userId,
    scopes: [GMAIL_MODIFY]
  });
  const gmail = google.gmail({ version: "v1", auth });

  const msg = await gmail.users.messages.get({
    userId: "me",
    id: input.messageId,
    format: "full"
  });

  const headers = headersToRecord(msg.data.payload?.headers);
  let bodyText = extractPlainFromPart((msg.data.payload ?? undefined) as GmailMessagePart | undefined);
  if (bodyText.length > maxBody) {
    bodyText = `${bodyText.slice(0, maxBody)}…`;
  }

  return {
    id: msg.data.id ?? input.messageId,
    threadId: msg.data.threadId ?? "",
    snippet: msg.data.snippet ?? "",
    from: headers.from ?? "",
    to: headers.to ?? "",
    subject: headers.subject ?? "",
    date: headers.date ?? "",
    labelIds: msg.data.labelIds ?? [],
    bodyText
  };
}
