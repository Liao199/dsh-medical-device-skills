/**
 * Smoke test: exercises the plugin without a host.
 *   node test/smoke.mjs
 */
import assert from "node:assert/strict";
import { apply, discover, name, inject, parseSkillSource } from "../lib/index.js";

const skills = await discover();
assert.equal(skills.length, 21, `expected 21 skills, parsed ${skills.length}`);
assert.ok(skills.every((skill) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name)), "a name is not kebab-case");
assert.ok(skills.every((skill) => skill.description.length > 20), "a description is too short");
assert.equal(new Set(skills.map((skill) => skill.name)).size, skills.length, "duplicate skill names");

// A provider registered the same way the host does it.
let registered;
apply({
  skills: {
    registerProvider(factory) {
      registered = factory();
    },
  },
});
assert.equal(name, "medxpert-skills");
assert.deepEqual(inject, ["skills"]);

const listed = await registered.list();
assert.equal(listed.length, 21);
const candidate = listed.find((entry) => entry.name === "medical-device-reg-hub");
assert.ok(candidate, "medical-device-reg-hub missing from list()");
assert.equal(candidate.provider, "medxpert-skills");
assert.equal(candidate.source, "custom");
assert.ok(candidate.resourceBase.path.endsWith("medical-device-reg-hub"));

const loaded = await registered.get(candidate);
assert.ok(loaded.content.length > 500, "body not returned");
assert.ok(!loaded.content.startsWith("---"), "body still carries frontmatter");
assert.ok(loaded.content.includes("注册工程师"), "body looks truncated");

// Block scalar and quoted-value handling.
const block = parseSkillSource("---\nname: demo-skill\ndescription: >\n  line one\n  line two\n---\nbody\n");
assert.equal(block.name, "demo-skill");
assert.equal(block.description, "line one line two");
assert.equal(block.body, "body");
const quoted = parseSkillSource('---\nname: demo-quoted\ndescription: "带引号 的描述"\n---\nx\n');
assert.equal(quoted.description, "带引号 的描述");

console.log(`ok: ${listed.length} skills, provider=${registered.name}`);
console.log(`ok: first five → ${listed.slice(0, 5).map((entry) => entry.name).join(", ")}`);
console.log(`ok: body bytes for medical-device-reg-hub = ${loaded.content.length}`);
