import { spawn } from "child_process";
import * as os from "os";
import * as path from "path";

export interface Critique {
  grade: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  revised: string;
}

export interface CritiqueRequest {
  selection: string;
  noteTitle: string;
  noteContext: string | null;
  extraInstructions: string;
  includeRevisedDraft: boolean;
}

const SCHEMA = {
  type: "object",
  properties: {
    grade: { type: "string", description: "Letter grade from A+ to F." },
    summary: { type: "string", description: "One warm, honest sentence on the passage overall." },
    strengths: { type: "array", items: { type: "string" }, description: "One to three specific things that work." },
    improvements: {
      type: "array",
      items: { type: "string" },
      description: "Two to five specific, kind, actionable suggestions. Quote the original where it helps.",
    },
    revised: {
      type: "string",
      description: "A revised draft of the passage that applies the suggestions. Keep the author's voice, meaning, and markdown. Empty string if not requested.",
    },
  },
  required: ["grade", "summary", "strengths", "improvements", "revised"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a writing tutor. You are kind, specific, and honest. You grade a passage the author highlighted and help them improve it.

Rules:
- Grade on clarity, flow, concision, word choice, and whether the passage does its job. Use a letter grade from A+ to F.
- Be encouraging without being empty. Name what works before what does not.
- Make every suggestion concrete. Point to the exact words or sentence and say what to do instead and why.
- Never rewrite the author's meaning or voice. Fix the writing, not the ideas.
- Preserve markdown formatting (links, emphasis, lists) in the revised draft.
- Do not comment on spelling of proper nouns or on the note's topic.
- Keep the summary to one sentence. Keep each suggestion to one or two sentences.`;

const EXTRA_PATH_DIRS = [
  path.join(os.homedir(), ".npm-global", "bin"),
  path.join(os.homedir(), ".local", "bin"),
  path.join(os.homedir(), ".claude", "local"),
  "/opt/homebrew/bin",
  "/usr/local/bin",
];

function buildPrompt(req: CritiqueRequest): string {
  const parts: string[] = [];
  if (req.extraInstructions.trim()) {
    parts.push(`Author's notes for the tutor:\n${req.extraInstructions.trim()}`);
  }
  parts.push(`Note title: ${req.noteTitle}`);
  if (req.noteContext) {
    parts.push(`Surrounding note, for context only. Do not grade this part:\n<context>\n${req.noteContext}\n</context>`);
  }
  parts.push(`Grade this passage:\n<passage>\n${req.selection}\n</passage>`);
  parts.push(
    req.includeRevisedDraft
      ? "Return a revised draft in the 'revised' field."
      : "Leave the 'revised' field as an empty string."
  );
  return parts.join("\n\n");
}

export function requestCritique(
  claudePath: string,
  model: string,
  timeoutSeconds: number,
  req: CritiqueRequest
): Promise<Critique> {
  const args = [
    "-p",
    "--output-format", "json",
    "--no-session-persistence",
    "--tools", "",
    "--setting-sources", "",
    "--model", model,
    "--system-prompt", SYSTEM_PROMPT,
    "--json-schema", JSON.stringify(SCHEMA),
  ];

  const env = { ...process.env };
  env.PATH = [...EXTRA_PATH_DIRS, env.PATH ?? ""].join(path.delimiter);

  return new Promise((resolve, reject) => {
    const child = spawn(claudePath, args, { cwd: os.tmpdir(), env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let done = false;

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      child.kill("SIGKILL");
      reject(new Error(`Claude did not answer within ${timeoutSeconds}s.`));
    }, timeoutSeconds * 1000);

    child.on("error", (err: NodeJS.ErrnoException) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (err.code === "ENOENT") {
        reject(new Error(`Could not find '${claudePath}'. Set the full path in Writing Tutor settings.`));
      } else {
        reject(err);
      }
    });

    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

    child.on("close", (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude exited with code ${code}: ${stderr.trim() || stdout.trim() || "no output"}`));
        return;
      }
      try {
        resolve(parseResponse(stdout));
      } catch (e) {
        reject(e);
      }
    });

    child.stdin.end(buildPrompt(req));
  });
}

function parseResponse(raw: string): Critique {
  let outer: Record<string, unknown>;
  try {
    outer = JSON.parse(raw);
  } catch {
    throw new Error(`claude returned non-JSON output: ${raw.slice(0, 200)}`);
  }
  if (outer.is_error) {
    throw new Error(`claude reported an error: ${String(outer.result ?? "").slice(0, 300)}`);
  }
  let payload: unknown = outer.structured_output;
  if (payload == null && typeof outer.result === "string") {
    payload = JSON.parse(outer.result);
  }
  const c = payload as Partial<Critique> | undefined;
  if (!c || typeof c.grade !== "string" || !Array.isArray(c.improvements)) {
    throw new Error("claude's answer did not match the expected shape.");
  }
  return {
    grade: c.grade.trim(),
    summary: (c.summary ?? "").trim(),
    strengths: (c.strengths ?? []).map((s) => String(s).trim()).filter(Boolean),
    improvements: c.improvements.map((s) => String(s).trim()).filter(Boolean),
    revised: (c.revised ?? "").trim(),
  };
}
