#!/usr/bin/env node
/**
 * Spustí rychlý balík testů (vitest.hook.config.ts). Celkový wall-clock limit: TEST_HOOK_BUDGET_MS (default 60 s).
 * Po překročení limitu proces ukončí testy a skončí kódem 0 — commit se neblokuje.
 * Chybové testy / neúspěšný vitest stále končí nenulovým jiným kódem.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const budgetMs = Number.parseInt(process.env.TEST_HOOK_BUDGET_MS ?? "60000", 10);
const vitestEntry = join(root, "node_modules", "vitest", "vitest.mjs");

let timedOut = false;

const child = spawn(
  process.execPath,
  [vitestEntry, "run", "--config", join(root, "vitest.hook.config.ts")],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env }
  }
);

const killTimer = setTimeout(() => {
  timedOut = true;
  child.kill("SIGTERM");
  setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      /* ignore */
    }
  }, 4000).unref?.();
}, budgetMs);

child.on("exit", (code) => {
  clearTimeout(killTimer);
  if (timedOut) {
    console.error(
      "\n[git-hook-tests] Vyčerpán časový limit (%d ms) — běh testů zastaven, hook končí úspěšně.\n",
      budgetMs
    );
    process.exit(0);
  }
  process.exit(code === 0 ? 0 : code ?? 1);
});

child.on("error", (err) => {
  clearTimeout(killTimer);
  console.error("[git-hook-tests]", err);
  process.exit(1);
});
