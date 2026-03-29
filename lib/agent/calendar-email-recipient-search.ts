import { extractEmailFromText } from "@/lib/agent/calendar-email-slots-params";
import type { ViewingEmailRecipientCandidate } from "@/lib/agent/types";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export type EmailRecipientCandidate = {
  kind: "client" | "lead";
  id: string;
  fullName: string | null;
  email: string;
};

const STOP = new Set([
  "napiste",
  "napis",
  "email",
  "e",
  "mail",
  "pro",
  "prohlidku",
  "prohlidky",
  "termin",
  "termín",
  "kalendare",
  "kalendář",
  "vasi",
  "vase",
  "moji",
  "moje",
  "nemovitost",
  "nemovitosti",
  "zajemce",
  "zájemce",
  "doporuc",
  "doporuč",
  "dobry",
  "dobrý",
  "den",
  "dekuji",
  "děkuji"
]);

export function normalizeSearchKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Skóre shody jména/e-mailu s tokeny; obě strany bez diakritiky — obchází neúspěch ilike na ř/á v DB. */
export function scoreClientAgainstTokens(fullName: string | null, email: string, tokens: string[]): number {
  const nameN = fullName ? normalizeSearchKey(fullName) : "";
  const emailN = normalizeSearchKey(email);
  const hay = `${nameN} ${emailN}`.trim();
  let score = 0;
  for (const raw of tokens) {
    if (raw.length < 3) continue;
    const tn = normalizeSearchKey(raw);
    if (!tn) continue;
    if (hay.includes(tn)) {
      score += nameN.includes(tn) ? 4 : emailN.includes(tn) ? 2 : 1;
      continue;
    }
    if (tn.length >= 4) {
      const pref = tn.slice(0, Math.min(5, tn.length));
      if (pref.length >= 4 && hay.includes(pref)) {
        score += nameN.includes(pref) ? 3 : 1;
      }
    }
  }
  return score;
}

function tokensFromQuestion(q: string): string[] {
  const n = q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return n
    .split(/[^a-z0-9@.+]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

function emailsInText(text: string): string[] {
  const re = /\b[A-Za-z0-9][\w.+-]*@[\w.-]+\.[A-Za-z]{2,}\b/g;
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const s = text;
  re.lastIndex = 0;
  while ((m = re.exec(s)) != null) {
    const e = m[0]!.trim();
    const low = e.toLowerCase();
    if (seen.has(low)) continue;
    seen.add(low);
    out.push(e);
    if (out.length >= 12) break;
  }
  return out;
}

/**
 * Rozšíří výrazy z LLM (lookup) o dílčí slova pro ilike / skórování — bez ručních stop-listů.
 */
export function expandAgentSearchTermsForDb(terms: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of terms) {
    const t = raw.trim();
    if (!t) continue;
    const parts = t.split(/\s+/).filter((w) => w.length >= 2);
    const chunks = parts.length > 1 ? [...new Set([t, ...parts])] : [t];
    for (const c of chunks) {
      const key = normalizeSearchKey(c);
      if (key.length < 2) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
      if (out.length >= 14) return out;
    }
  }
  return out;
}

function orIlikeClauses(tokens: string[], columns: readonly string[]): string {
  const parts: string[] = [];
  for (const raw of tokens.slice(0, 5)) {
    const esc = raw.replace(/%/g, "").replace(/,/g, "");
    if (esc.length < 2) continue;
    for (const col of columns) {
      parts.push(`${col}.ilike.%${esc}%`);
    }
  }
  return parts.join(",");
}

const FALLBACK_SCAN_LIMIT = 1000;
const FALLBACK_MIN_SCORE = 3;

/** Když PostgREST ilike selže (odlišné skloňování / diakritika vs. ASCII token), načti klienty a porovnej v JS. */
async function fallbackScanClientsByNormalizedTokens(
  tokens: string[],
  limit: number,
  alreadyEmails: Set<string>
): Promise<EmailRecipientCandidate[]> {
  if (tokens.length === 0) return [];
  const supabase = getSupabaseAdminClient();
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, full_name, email")
    .not("email", "is", null)
    .order("created_at", { ascending: false })
    .limit(FALLBACK_SCAN_LIMIT);
  if (error || !clients?.length) return [];

  const scored = clients
    .map((c) => {
      const fullName = typeof c.full_name === "string" ? c.full_name : null;
      const email = typeof c.email === "string" ? c.email.trim() : "";
      return {
        id: c.id as string,
        fullName,
        email,
        score: scoreClientAgainstTokens(fullName, email, tokens)
      };
    })
    .filter((r) => r.score >= FALLBACK_MIN_SCORE && r.email && !alreadyEmails.has(r.email.toLowerCase()))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];

  const clientIds = scored.map((r) => r.id);
  const { data: leadsRows } = await supabase
    .from("leads")
    .select("id, client_id, created_at")
    .in("client_id", clientIds)
    .order("created_at", { ascending: false });

  const leadByClient = new Map<string, string>();
  for (const row of leadsRows ?? []) {
    const cid = row.client_id as string;
    const lid = row.id as string;
    if (cid && lid && !leadByClient.has(cid)) leadByClient.set(cid, lid);
  }

  const out: EmailRecipientCandidate[] = [];
  for (const r of scored) {
    const lid = leadByClient.get(r.id);
    if (lid) {
      out.push({ kind: "lead", id: lid, fullName: r.fullName, email: r.email });
    } else {
      out.push({ kind: "client", id: r.id, fullName: r.fullName, email: r.email });
    }
    if (out.length >= limit) break;
  }
  return out;
}

async function lookupRecipientsByEmails(
  emails: string[],
  limit: number
): Promise<EmailRecipientCandidate[]> {
  if (emails.length === 0) return [];
  const supabase = getSupabaseAdminClient();
  const out: EmailRecipientCandidate[] = [];
  const uniq = [...new Set(emails.map((e) => e.trim().toLowerCase()))].filter(Boolean);
  for (const emailLower of uniq) {
    if (out.length >= limit) break;
    const { data: clients } = await supabase
      .from("clients")
      .select("id, full_name, email")
      .eq("email", emailLower)
      .limit(1);
    const c = clients?.[0];
    if (!c || typeof c.email !== "string") continue;
    const email = c.email.trim();
    const fullName = typeof c.full_name === "string" ? c.full_name : null;
    const { data: leadPick } = await supabase
      .from("leads")
      .select("id")
      .eq("client_id", c.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const leadId = leadPick?.[0]?.id;
    if (leadId) {
      out.push({ kind: "lead", id: leadId, fullName, email });
    } else {
      out.push({ kind: "client", id: c.id, fullName, email });
    }
  }
  return out.slice(0, limit);
}

export type SearchEmailRecipientOptions = {
  /** Výrazy z LLM kroku extractRecipientCrmSearchTerms — preferované pro DB dotaz. */
  agentSearchTerms?: string[];
};

/**
 * Najde klienty a leady s e-mailem (ilike + fallback sken). E-mail v textu bere z `question`.
 * Pro výrazy k vyhledání preferujte `options.agentSearchTerms` z LLM; jinak nouzově tokenizace z `question`.
 */
export async function searchEmailRecipientCandidates(
  question: string,
  limit = 8,
  options?: SearchEmailRecipientOptions
): Promise<EmailRecipientCandidate[]> {
  const fromAgent =
    options?.agentSearchTerms && options.agentSearchTerms.length > 0
      ? expandAgentSearchTermsForDb(options.agentSearchTerms)
      : [];
  let tokens = fromAgent.length > 0 ? fromAgent : tokensFromQuestion(question);
  if (tokens.length === 0) {
    tokens = tokensFromQuestion(question.replace(/\b[A-Za-z0-9][\w.+-]*@[\w.-]+\.[A-Za-z]{2,}\b/g, " "));
  }

  const emailHits = emailsInText(question);
  if (tokens.length === 0 && emailHits.length > 0) {
    return lookupRecipientsByEmails(emailHits, limit);
  }
  if (tokens.length === 0) return [];

  const supabase = getSupabaseAdminClient();
  const out: EmailRecipientCandidate[] = [];
  const seen = new Set<string>();

  const clientOr = orIlikeClauses(tokens, ["full_name", "email"] as const);
  if (clientOr.length > 0) {
    const { data: clients, error } = await supabase
      .from("clients")
      .select("id, full_name, email")
      .not("email", "is", null)
      .or(clientOr)
      .limit(Math.min(limit, 12));
    if (!error && clients) {
      for (const c of clients) {
        const email = typeof c.email === "string" ? c.email.trim() : "";
        if (!email || seen.has(email.toLowerCase())) continue;
        seen.add(email.toLowerCase());
        out.push({
          kind: "client",
          id: c.id,
          fullName: typeof c.full_name === "string" ? c.full_name : null,
          email
        });
      }
    }
  }

  if (out.length >= limit) return out.slice(0, limit);

  const { data: leads, error: leadErr } = await supabase
    .from("leads")
    .select("id, clients!inner(full_name, email)")
    .not("clients.email", "is", null)
    .order("created_at", { ascending: false })
    .limit(60);

  if (!leadErr && leads) {
    const norm = normalizeSearchKey;
    const tokenNorms = tokens.map(norm);
    for (const row of leads as unknown as {
      id: string;
      clients: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[];
    }[]) {
      const cl = Array.isArray(row.clients) ? row.clients[0] ?? null : row.clients;
      const email = cl?.email?.trim() ?? "";
      const name = (cl?.full_name ?? "").trim();
      if (!email || seen.has(email.toLowerCase())) continue;
      const hay = norm(`${name} ${email}`);
      const hit = tokenNorms.some((t) => hay.includes(t));
      if (!hit) continue;
      seen.add(email.toLowerCase());
      out.push({
        kind: "lead",
        id: row.id,
        fullName: cl?.full_name ?? null,
        email
      });
      if (out.length >= limit) break;
    }
  }

  if (out.length === 0) {
    const fallback = await fallbackScanClientsByNormalizedTokens(tokens, limit, seen);
    for (const c of fallback) {
      if (out.length >= limit) break;
      const low = c.email.toLowerCase();
      if (seen.has(low)) continue;
      seen.add(low);
      out.push(c);
    }
  }

  return out.slice(0, limit);
}

function parseOrdinalIndex(question: string): number | null {
  const q = question
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/^(1\.|#?1\b|prvni|1\s*\)|prvn)/.test(q)) return 0;
  if (/^(2\.|#?2\b|druhy|druhou|2\s*\)|druh)/.test(q)) return 1;
  if (/^(3\.|#?3\b|treti|třeti|3\s*\)|tret)/.test(q)) return 2;
  if (/^(4\.|#?4\b|ctvrt|ctvrtý|ctvrty|čtvrt)/.test(q)) return 3;
  if (/^(5\.|#?5\b|paty)/.test(q)) return 4;
  if (/\b(ten|ta|to)\s+prvn(i|í)\b/.test(q)) return 0;
  if (/\b(ten|ta|to)\s+druh(y|ou|ý)\b/.test(q)) return 1;
  return null;
}

/**
 * Doplnění příjemce z follow-up zprávy (e-mail, pořadí v seznamu kandidátů).
 */
export function resolveRecipientFromFollowUp(
  question: string,
  candidates: EmailRecipientCandidate[]
): EmailRecipientCandidate | null {
  if (candidates.length === 0) return null;
  const q = question.trim();
  const email = extractEmailFromText(q);
  if (email) {
    const hit = candidates.find((c) => c.email.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
  }
  const n = q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const patterns: { re: RegExp; index: number }[] = [
    { re: /\b(prvni|první|1\.|1\)|#1)\b/, index: 0 },
    { re: /\b(druhy|druhý|2\.|2\)|#2)\b/, index: 1 },
    { re: /\b(treti|třeti|3\.|3\)|#3)\b/, index: 2 },
    { re: /\b(ctvrty|ctvrt|ctvrtý|čtvrtý|4\.|4\)|#4)\b/, index: 3 },
    { re: /\b(paty|5\.|5\)|#5)\b/, index: 4 }
  ];
  for (const { re, index } of patterns) {
    if (re.test(n) && candidates[index]) return candidates[index]!;
  }

  const ord = parseOrdinalIndex(question);
  if (ord != null && ord >= 0 && ord < candidates.length) return candidates[ord] ?? null;
  return null;
}

export function toViewingRecipientCandidates(rows: EmailRecipientCandidate[]): ViewingEmailRecipientCandidate[] {
  return rows.map((r) => ({
    kind: r.kind,
    id: r.id,
    fullName: r.fullName,
    email: r.email
  }));
}

export function relatedLeadIdsFromRecipient(
  toEmail: string,
  chosen: EmailRecipientCandidate | null,
  candidates: EmailRecipientCandidate[]
): string[] {
  const norm = toEmail.trim().toLowerCase();
  if (!norm) return [];
  const ids: string[] = [];
  const add = (c: EmailRecipientCandidate | undefined | null) => {
    if (c?.kind === "lead" && c.id && !ids.includes(c.id)) ids.push(c.id);
  };
  add(chosen);
  if (!chosen || chosen.email.toLowerCase() !== norm) {
    add(candidates.find((c) => c.email.toLowerCase() === norm));
  }
  return ids;
}

/** Krátká odpověď typu „první“, „druhý“ nebo jen e-mail — doplnění příjemce z předchozího kroku. */
export function isFollowUpRecipientChoice(question: string): boolean {
  const q = question.trim();
  if (!q) return false;
  if (extractEmailFromText(q)) return true;
  const n = q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /\b(prvni|první|druhy|druhý|treti|třeti|ctvrty|ctvrt|ctvrtý|čtvrtý|paty|1\.|2\.|3\.|4\.|5\.|#1|#2|#3)\b/.test(n);
}

export function buildCalendarEmailRecipientSearchHay(question: string, contextText: string): string {
  const q = question.trim();
  const ctx = contextText.trim();
  if (isFollowUpRecipientChoice(q) && ctx) {
    return `${ctx}\n${q}`.slice(-3000);
  }
  return `${q}\n${ctx}`.slice(-3000);
}
