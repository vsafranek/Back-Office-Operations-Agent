import { z } from "zod";

const optionalEmail = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}, z.string().email().optional());

const optionalString = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}, z.string().optional());

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: z.string().min(1).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("agent-artifacts"),
  AZURE_PROXY_BASE_URL: z.string().url(),
  AZURE_PROXY_API_KEY: z.string().min(1),
  AZURE_PROXY_API_VERSION: z.string().default("2024-12-01-preview"),
  AZURE_PROXY_DEPLOYMENT_ID: z.string().min(1),
  AZURE_PROXY_MODEL_DEFAULT: z.string().min(1),
  AZURE_PROXY_MODEL_FALLBACK: z.string().optional(),
  AZURE_PROXY_TIMEOUT_MS: z.coerce.number().default(30_000),
  AZURE_PROXY_MAX_TOKENS_PER_REQUEST: z.coerce.number().default(3_000),
  GOOGLE_CLIENT_EMAIL: optionalEmail,
  GOOGLE_PRIVATE_KEY: optionalString,
  GOOGLE_IMPERSONATED_USER: optionalEmail,
  GOOGLE_OAUTH_CLIENT_ID: optionalString,
  GOOGLE_OAUTH_CLIENT_SECRET: optionalString,
  GOOGLE_CALENDAR_ID: z.string().default("primary"),
  AGENT_MAX_QUERY_ROWS: z.coerce.number().default(500),
  AGENT_QUERY_TIMEOUT_MS: z.coerce.number().default(15_000),
  TOKEN_ENCRYPTION_KEY: z.string().min(16),
  CRON_SECRET: z.string().optional(),
  /** Relative to cwd or absolute; default blue-white deck in assets/. */
  PRESENTATION_TEMPLATE_PATH: optionalString,
  /** When unset, template is used if the resolved file exists. */
  PRESENTATION_USE_TEMPLATE: optionalString,
  /** 1-based slide in template cloned per SlideSpec (see presentation-template-blue-white.md). */
  PRESENTATION_TEMPLATE_CONTENT_SLIDE_INDEX: z.coerce.number().int().min(1).max(200).default(13),
  /** 1-based title slide; set 0 to omit. */
  PRESENTATION_TEMPLATE_TITLE_SLIDE_INDEX: z.coerce.number().int().min(0).max(200).default(1),
  /** Skip pdf-lib PDF (PPTX may still be branded; PDF does not match template). */
  PRESENTATION_SKIP_PDF: z
    .preprocess((value) => {
      if (value === undefined || value === "") return false;
      if (typeof value === "boolean") return value;
      const s = String(value).toLowerCase().trim();
      return ["1", "true", "yes", "on"].includes(s);
    }, z.boolean())
    .default(false),
  /** Subtitle on template title slide (slide 1); default Back Office · report */
  PRESENTATION_DECK_SUBTITLE: optionalString
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const resolvedEnv = {
    ...process.env,
    SUPABASE_URL: process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    SUPABASE_ANON_KEY:
      process.env.SUPABASE_ANON_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim()
  };

  const result = envSchema.safeParse(resolvedEnv);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment variables: ${details}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}
