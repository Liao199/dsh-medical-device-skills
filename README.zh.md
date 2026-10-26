# dsh-medical-device-skills

把 [MedXpert](https://github.com/zhaoxinghua09-cell/medxpert-skills) 的 21 个 Agent Skill（医疗器械法规：NMPA / FDA / MDR / PMDA）打包成 **DeepSeek Harness（dsh）插件**，装一次，所有工作区的会话都能按需调用。

## 它做了什么

- 一个 Cordis 插件，`inject: ["skills"]`，在 `ctx.skills` 上注册 provider `medxpert-skills`。
- 扫描包内 `skills/*/SKILL.md`，解析 YAML frontmatter（`name` / `description` / 可选 `invocation`），把每条技能登记进 dsh 的技能目录。
- 正文懒加载：只有模型命中或用户点名时才读 `SKILL.md`，常驻上下文里只有名称与描述。
- 无需 MCP、无运行时依赖、不写用户目录。

## 目录结构

```
dsh-medical-device-skills/
├─ package.json          # dsh.bundle.patch 指向 cordis.patch.yml
├─ cordis.patch.yml      # bundle 层：insert 本包
├─ lib/index.js          # provider 实现（零依赖）
├─ skills/               # 21 个技能，每个一个目录 + SKILL.md
├─ test/smoke.mjs        # 无宿主自检
├─ NOTICE                # 上游署名
└─ LICENSE               # Apache-2.0（继承上游）
```

## 安装到 dsh

**方式一：插件页（推荐）**

打开 dsh 的插件页，安装规格支持 registry 名、git 主机、tarball、`file:`/`link:` 路径：

```
dsh-medical-device-skills                                    # 已发布到 npm 时
github:Liao199/dsh-medical-device-skills                     # 直接吃 GitHub
https://github.com/Liao199/dsh-medical-device-skills/archive/refs/heads/main.tar.gz
file:C:\path\to\dsh-medical-device-skills                    # 本地开发
```

安装后 dsh 会把它作为 profile 层加载（因为包内声明了 `dsh.bundle.patch`）；未声明的包只会被当成普通依赖。

**方式二：手动写 profile**

```jsonc
// ~/.dsh/profiles/desktop/package.json
{
  "dependencies": { "dsh-medical-device-skills": "^0.1.0" },
  "dsh": { "profile": { "bundles": [ /* …原有… */, "dsh-medical-device-skills" ] } }
}
```
然后在 profile 目录执行 `pnpm install`，重启 dsh。

## 验证

```bash
node test/smoke.mjs
# ok: 21 skills, provider=medxpert-skills
# ok: first five → med-reg-category-page, medical-device-clinical-evaluation, …
```

宿主内验证：新开一个会话，问「关节镜钳出口美国要 510(k) 吗」或直接说「用 medical-device-reg-hub」，技能出现在目录里即装配成功。

## 与「手工放进 ~/.dsh/skills」的区别

| | 插件（本仓库） | 手工目录 |
|---|---|---|
| 分发 | npm / GitHub / tarball，一条 spec | 解压到 `~/.dsh/skills` |
| 升级 | 改版本号重装 | 覆盖目录 |
| 生效范围 | 该 profile 的所有工作区 | 该用户所有工作区 |
| 目录来源标记 | `source: custom`，provider 名为 `medxpert-skills` | `source: user-dsh` |
| 冲突 | 同名技能可能与手工目录重复 → **切换时先删掉 `~/.dsh/skills` 下的 21 个目录** | — |

## 迁移到插件时清掉手工副本

```powershell
Get-ChildItem "$env:USERPROFILE\.dsh\skills" -Directory |
  Where-Object { $_.Name -match '^(medical-device-|medxpert-|med-reg-)' } |
  Remove-Item -Recurse -Force
```

## 许可

技能内容来自 [zhaoxinghua09-cell/medxpert-skills](https://github.com/zhaoxinghua09-cell/medxpert-skills)，逐字保留，许可沿用上游：

| 范围 | 许可 | 文本 |
|---|---|---|
| 15 个在 frontmatter 声明 `license: MIT` 的技能 | MIT | `LICENSES/MIT.txt` |
| 6 个未声明单技能许可的技能 | Apache-2.0（仓库级） | `LICENSE` |
| 外壳代码（package.json / cordis.patch.yml / lib / test） | Apache-2.0 | `LICENSE` |

`NOTICE` 记录了来源、快照日期、逐技能许可归属、改动清单与商标说明。上游 README 末尾另有一句“禁止商用转载”，与 Apache-2.0 条款冲突；本包按许可文件条款分发，商用前请先向上游取得书面确认。

本包是**非官方打包**：不使用作者名称或标识暗示背书，也不分发上游的 logo / 图标等二进制资产。

技能输出为方法论与资料导航，不构成法规意见。
