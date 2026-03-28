import { getMicrosoftAccessTokenForUser } from "@/lib/integrations/microsoft-user-auth";

async function graphFetchJson<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Microsoft Graph ${path} failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const t = text.trim();
  if (!t) return {} as T;
  return JSON.parse(t) as T;
}

export async function createOutlookDraft(input: {
  userId: string;
  to: string;
  subject: string;
  body: string;
}): Promise<{ draftId: string; messageId: string | undefined }> {
  const accessToken = await getMicrosoftAccessTokenForUser({ userId: input.userId });
  const created = await graphFetchJson<{ id?: string }>(accessToken, "/me/messages", {
    method: "POST",
    body: JSON.stringify({
      subject: input.subject,
      body: { contentType: "Text", content: input.body },
      toRecipients: [{ emailAddress: { address: input.to } }],
      isDraft: true
    })
  });
  if (!created.id) {
    throw new Error("Microsoft Graph: draft created without id.");
  }
  return { draftId: created.id, messageId: created.id };
}

export async function sendOutlookDraft(input: { userId: string; draftId: string }) {
  const accessToken = await getMicrosoftAccessTokenForUser({ userId: input.userId });
  await graphFetchJson<unknown>(accessToken, `/me/messages/${encodeURIComponent(input.draftId)}/send`, {
    method: "POST",
    body: "{}"
  });
  return { messageId: input.draftId, threadId: null as string | null };
}

export async function sendOutlookMessageNow(input: {
  userId: string;
  to: string;
  subject: string;
  body: string;
}) {
  const accessToken = await getMicrosoftAccessTokenForUser({ userId: input.userId });
  await graphFetchJson<unknown>(accessToken, "/me/sendMail", {
    method: "POST",
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: { contentType: "Text", content: input.body },
        toRecipients: [{ emailAddress: { address: input.to } }]
      },
      saveToSentItems: true
    })
  });
  return { messageId: null as string | null, threadId: null as string | null };
}

export type OutlookListItem = {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  date: string;
  labelIds: string[];
};

export async function listOutlookMessages(input: {
  userId: string;
  maxResults?: number;
  q?: string;
}): Promise<{ messages: OutlookListItem[] }> {
  const max = Math.min(Math.max(input.maxResults ?? 10, 1), 50);
  const accessToken = await getMicrosoftAccessTokenForUser({ userId: input.userId });
  const q = input.q?.trim();
  const select =
    "$select=id,conversationId,bodyPreview,subject,receivedDateTime,from&$orderby=receivedDateTime desc";
  const path = q
    ? `/me/messages?$top=${max}&${select}&$search=${encodeURIComponent(`"${q.replace(/"/g, "")}"`)}`
    : `/me/mailFolders/inbox/messages?$top=${max}&${select}`;
  const list = await graphFetchJson<{ value?: Array<{ id?: string; conversationId?: string; bodyPreview?: string; subject?: string; receivedDateTime?: string; from?: { emailAddress?: { address?: string; name?: string } } }> }>(
    accessToken,
    path,
    q ? { headers: { ConsistencyLevel: "eventual" } } : undefined
  );

  const refs = list.value ?? [];
  const messages: OutlookListItem[] = [];
  for (const ref of refs) {
    if (!ref.id) continue;
    const fromAddr = ref.from?.emailAddress?.address ?? ref.from?.emailAddress?.name ?? "";
    messages.push({
      id: ref.id,
      threadId: ref.conversationId ?? "",
      snippet: ref.bodyPreview ?? "",
      from: fromAddr,
      subject: ref.subject ?? "",
      date: ref.receivedDateTime ?? "",
      labelIds: ["INBOX"]
    });
  }
  return { messages };
}

export type OutlookMessageDetail = {
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

export async function getOutlookMessage(input: {
  userId: string;
  messageId: string;
  maxBodyChars?: number;
}): Promise<OutlookMessageDetail> {
  const maxBody = Math.min(Math.max(input.maxBodyChars ?? 20_000, 500), 100_000);
  const accessToken = await getMicrosoftAccessTokenForUser({ userId: input.userId });
  const msg = await graphFetchJson<{
    id?: string;
    conversationId?: string;
    bodyPreview?: string;
    subject?: string;
    receivedDateTime?: string;
    from?: { emailAddress?: { address?: string } };
    toRecipients?: Array<{ emailAddress?: { address?: string } }>;
    body?: { contentType?: string; content?: string };
  }>(accessToken, `/me/messages/${encodeURIComponent(input.messageId)}?$select=id,conversationId,bodyPreview,subject,receivedDateTime,from,toRecipients,body`);

  let bodyText = msg.body?.content ?? "";
  if (msg.body?.contentType === "html") {
    bodyText = bodyText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  if (bodyText.length > maxBody) {
    bodyText = `${bodyText.slice(0, maxBody)}…`;
  }

  const toList = (msg.toRecipients ?? []).map((r) => r.emailAddress?.address).filter(Boolean);
  return {
    id: msg.id ?? input.messageId,
    threadId: msg.conversationId ?? "",
    snippet: msg.bodyPreview ?? "",
    from: msg.from?.emailAddress?.address ?? "",
    to: toList.join(", "),
    subject: msg.subject ?? "",
    date: msg.receivedDateTime ?? "",
    labelIds: [],
    bodyText
  };
}
