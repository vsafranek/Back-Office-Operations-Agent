import { google } from "googleapis";
import { getGoogleAuthForUser } from "@/lib/integrations/google-user-auth";

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

export async function createEmailDraft(input: {
  userId: string;
  to: string;
  subject: string;
  body: string;
}) {
  const { auth } = await getGoogleAuthForUser({
    userId: input.userId,
    scopes: ["https://www.googleapis.com/auth/gmail.modify"]
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
