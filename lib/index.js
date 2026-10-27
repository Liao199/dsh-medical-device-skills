/**
 * dsh-bhky-medical-device-skills — expose the MedXpert agent-skill collection as a dsh
 * profile bundle.
 *
 * The package ships every skill as `skills/<name>/SKILL.md` and registers one
 * `skills` provider on the host. Bodies are read lazily, so a 21-skill
 * collection costs one directory scan per catalog rebuild and nothing else.
 *
 * @module dsh-bhky-medical-device-skills
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Provider name shown by the host's skill diagnostics. */
export const PROVIDER_NAME = "medxpert-skills";

/** Absolute path of the bundled skill collection. */
export const SKILLS_DIR = fileURLToPath(new URL("../skills/", import.meta.url));

/** Rank used by packaged skill providers (matches dsh's BUNDLED_SKILL_RANK). */
const PACKED_RANK = 600;

/** dsh requires kebab-case skill names. */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Invocation policy used when a SKILL.md declares none. */
const DEFAULT_INVOCATION = { modelInvocable: true, userInvocable: true };

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function unquote(value) {
  const text = value.trim();
  if (text.length >= 2) {
    const quote = text[0];
    if ((quote === '"' || quote === "'") && text[text.length - 1] === quote) {
      return text.slice(1, -1).replace(/\\(["'\\])/g, "$1");
    }
  }
  return text;
}

function parseInvocation(lines) {
  const read = (key) => {
    const hit = lines.find((line) => new RegExp(`^\\s*${key}\\s*:\\s*(true|false)\\s*$`, "i").test(line));
    if (hit === undefined) return undefined;
    return /true/i.test(hit.slice(hit.indexOf(":") + 1));
  };
  const modelInvocable = read("modelInvocable");
  const userInvocable = read("userInvocable");
  if (modelInvocable === undefined && userInvocable === undefined) return DEFAULT_INVOCATION;
  return {
    modelInvocable: modelInvocable ?? DEFAULT_INVOCATION.modelInvocable,
    userInvocable: userInvocable ?? DEFAULT_INVOCATION.userInvocable,
  };
}

/**
 * Read one SKILL.md: YAML frontmatter plus body.
 *
 * Supports single-line values (quoted or bare) and the `>` / `|` block scalars
 * the MedXpert collection mixes. Unknown keys are ignored on purpose; dsh only
 * routes on `name` and `description`.
 *
 * @param raw - Full text of a SKILL.md file.
 * @returns Parsed fields and body, or `undefined` when the file has no frontmatter.
 */
export function parseSkillSource(raw) {
  const text = stripBom(raw).replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  if ((lines[0] ?? "").trim() !== "---") return undefined;
  let close = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") {
      close = i;
      break;
    }
  }
  if (close < 0) return undefined;
  const head = lines.slice(1, close);
  const fields = {};
  for (let i = 0; i < head.length; i += 1) {
    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(head[i]);
    if (!match) continue;
    const key = match[1];
    const inline = match[2].trim();
    const indented = [];
    let j = i + 1;
    while (j < head.length && (head[j].trim() === "" || /^\s+/.test(head[j]))) {
      indented.push(head[j]);
      j += 1;
    }
    let value;
    if (/^[>|][+-]?$/.test(inline)) {
      const body = indented.map((line) => line.trim());
      value = inline.startsWith(">") ? body.join(" ").trim() : body.join("\n").trim();
    } else if (inline === "") {
      value = indented.map((line) => line.trim()).filter(Boolean).join(" ").trim();
    } else {
      value = unquote(inline);
    }
    fields[key] = value;
    i = j - 1;
  }
  const name = typeof fields.name === "string" ? fields.name : "";
  const description = typeof fields.description === "string" ? fields.description : "";
  return {
    name,
    description,
    invocation: parseInvocation(head),
    body: lines.slice(close + 1).join("\n").trim(),
  };
}

/** Rejected sources, surfaced by the smoke test and the host log. */
export const diagnostics = [];

/**
 * Scan `skills/` and parse every directory bundle.
 *
 * @returns Skill records sorted by name.
 */
export async function discover() {
  diagnostics.length = 0;
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(SKILLS_DIR, entry.name);
    const file = path.join(dir, "SKILL.md");
    let raw;
    try {
      raw = await readFile(file, "utf8");
    } catch {
      continue;
    }
    const parsed = parseSkillSource(raw);
    if (!parsed) {
      diagnostics.push({ dir, reason: "missing YAML frontmatter" });
      continue;
    }
    if (!SKILL_NAME.test(parsed.name)) {
      diagnostics.push({ dir, reason: `invalid skill name ${JSON.stringify(parsed.name)}` });
      continue;
    }
    if (parsed.description.length === 0) {
      diagnostics.push({ dir, reason: "empty description" });
      continue;
    }
    found.push({ ...parsed, dir, file });
  }
  found.sort((left, right) => left.name.localeCompare(right.name));
  return found;
}

function toCandidate(skill) {
  return {
    name: skill.name,
    description: skill.description,
    invocation: skill.invocation,
    provider: PROVIDER_NAME,
    source: "custom",
    rank: PACKED_RANK,
    resourceBase: { kind: "directory", path: skill.dir },
    locator: pathToFileURL(skill.file),
  };
}

const provider = {
  name: PROVIDER_NAME,
  async list() {
    return (await discover()).map(toCandidate);
  },
  async get(candidate) {
    const dir = candidate?.resourceBase?.path;
    if (typeof dir !== "string" || dir.length === 0) {
      throw new Error(`skill ${PROVIDER_NAME}: candidate has no resource directory`);
    }
    const parsed = parseSkillSource(await readFile(path.join(dir, "SKILL.md"), "utf8"));
    if (!parsed || !SKILL_NAME.test(parsed.name)) {
      throw new Error(`skill ${PROVIDER_NAME}: ${dir} is no longer a valid skill`);
    }
    return {
      name: parsed.name,
      description: parsed.description,
      invocation: parsed.invocation,
      provider: PROVIDER_NAME,
      source: "custom",
      resourceBase: { kind: "directory", path: dir },
      content: parsed.body,
    };
  },
};

/** Cordis plugin name. */
export const name = "medxpert-skills";

/** Service this plugin needs before it can register skills. */
export const inject = ["skills"];

/**
 * Register the MedXpert provider on the host's skill registry.
 *
 * @param ctx - Cordis context carrying the `skills` service.
 */
export function apply(ctx) {
  ctx.skills.registerProvider(() => provider);
}
