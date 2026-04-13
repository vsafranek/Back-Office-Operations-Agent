import { getAuthenticatedUserFromRequest, type AuthenticatedUser } from "@/lib/auth/server-auth";

export async function requireOperatorAccess(request: Request): Promise<AuthenticatedUser | { id: "operator-key" }> {
  const headerValue = request.headers.get("x-operator-key")?.trim();
  const configuredKey = process.env.OPERATOR_INGEST_KEY?.trim();

  if (configuredKey && headerValue && headerValue === configuredKey) {
    return { id: "operator-key" };
  }

  const user = await getAuthenticatedUserFromRequest(request);
  if (user) {
    return user;
  }

  throw new Error("Forbidden. Operator credentials required.");
}
