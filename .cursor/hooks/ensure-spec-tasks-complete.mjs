import fs from "node:fs";
import path from "node:path";

function respond(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function deny(userMessage, agentMessage) {
  respond({
    permission: "deny",
    user_message: userMessage,
    agent_message: agentMessage
  });
}

try {
  const input = fs.readFileSync(0, "utf8").trim();
  let command = "";
  if (input) {
    const event = JSON.parse(input);
    command =
      String(event?.command ?? "") ||
      String(event?.tool_input?.command ?? "") ||
      String(event?.input?.command ?? "") ||
      "";
  }

  if (!/^\s*git\s+(commit|push)\b/i.test(command)) {
    respond({ permission: "allow" });
    process.exit(0);
  }

  const repoRoot = process.cwd();
  const featureFile = path.join(repoRoot, ".specify", "feature.json");
  if (!fs.existsSync(featureFile)) {
    deny(
      "Feature file .specify/feature.json nebyl nalezen. Nejde ověřit stav úkolu.",
      "Hook blocked git commit/push because feature tracking file is missing."
    );
    process.exit(0);
  }

  const featureRaw = fs.readFileSync(featureFile, "utf8").replace(/^\uFEFF/, "");
  const featureJson = JSON.parse(featureRaw);
  const featureDir = String(featureJson.feature_directory ?? "").trim();
  if (!featureDir) {
    deny(
      "feature_directory v .specify/feature.json je prázdné. Nejde ověřit tasks.md.",
      "Hook blocked git commit/push because feature_directory is not set."
    );
    process.exit(0);
  }

  const tasksPath = path.join(repoRoot, featureDir, "tasks.md");
  if (!fs.existsSync(tasksPath)) {
    deny(
      `Soubor tasks.md pro aktivní feature nebyl nalezen: ${tasksPath}`,
      "Hook blocked git commit/push because tasks.md is missing."
    );
    process.exit(0);
  }

  const lines = fs.readFileSync(tasksPath, "utf8").split(/\r?\n/);
  const incomplete = lines.filter((line) => /^- \[ \] T\d+/.test(line));
  if (incomplete.length > 0) {
    const sample = incomplete.slice(0, 3).join("; ");
    deny(
      `Nelze commit/push: v tasks.md je ${incomplete.length} nehotových kroků. Příklad: ${sample}`,
      "Hook blocked git commit/push because the active feature has unchecked tasks."
    );
    process.exit(0);
  }

  respond({ permission: "allow" });
} catch (error) {
  deny(
    `Hook selhal při validaci tasks.md: ${error instanceof Error ? error.message : String(error)}`,
    "Hook blocked action due to validation script error."
  );
}
