# dsh-bhky-medical-device-skills

Package the [MedXpert](https://github.com/zhaoxinghua09-cell/medxpert-skills) agent-skill
collection (21 skills for NMPA / FDA / EU MDR / PMDA medical-device regulatory work) as a
**DeepSeek Harness (dsh)** profile bundle.

## What it does

- One Cordis plugin (`inject: ["skills"]`) that registers the `medxpert-skills` provider on `ctx.skills`.
- Scans `skills/*/SKILL.md`, parses the YAML frontmatter (`name`, `description`, optional `invocation`)
  and advertises every skill to the host catalog.
- Bodies load on demand only: the catalog carries names and descriptions, nothing more.
- No MCP server, no runtime dependencies, no writes outside the package.

## Layout

```
package.json       # dsh.bundle.patch → cordis.patch.yml
cordis.patch.yml   # bundle layer: inserts this package
lib/index.js       # zero-dependency provider
skills/            # 21 skill directories, each with SKILL.md
test/smoke.mjs     # host-free self-check
NOTICE             # upstream attribution
LICENSE            # Apache-2.0, inherited from upstream
```

## Install into dsh

The plugin page accepts registry names, git hosts, tarballs and `file:` / `link:` paths:

```
dsh-bhky-medical-device-skills                                     # once published to npm
github:Liao199/dsh-bhky-medical-device-skills                      # straight from GitHub
file:C:\path\to\dsh-bhky-medical-device-skills                     # local development
```

Because the package declares `dsh.bundle.patch`, dsh loads it as a profile layer. A package
without that declaration is installed as a plain dependency and never mounted.

Manual alternative: add the dependency to `~/.dsh/profiles/desktop/package.json`, append the
package name to `dsh.profile.bundles`, run `pnpm install`, restart dsh.

## Verify

```bash
node test/smoke.mjs
# ok: 21 skills, provider=medxpert-skills
```

In the host: ask a medical-device regulatory question, or name a skill explicitly
(e.g. `jim-device-reg-hub`); it appearing in the catalog means the bundle is mounted.

## Plugin vs. copying into `~/.dsh/skills`

| | Bundle (this repo) | Loose directory |
|---|---|---|
| Distribution | npm / GitHub / tarball, one spec | unzip into `~/.dsh/skills` |
| Upgrade | bump version, reinstall | overwrite directories |
| Scope | every workspace of that profile | every workspace of that user |
| Source tag | `custom`, provider `medxpert-skills` | `user-dsh` |
| Collision | same-name skills duplicate → remove the loose copies when switching | — |

## License

Skill content © SynomosAI & MedXpert, Apache-2.0 (see `NOTICE`). The wrapper ships under the
same license. Output is methodology and source navigation, not regulatory advice.
