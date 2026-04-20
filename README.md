# obsidian-notion-cli

**One-way sync from a markdown vault (Obsidian) to Notion pages. Frontmatter is the contract.**

Your vault is source of truth. Notion is an auto-generated dashboard. No drift, no manual copy-paste.

Built at [BTW Studio](https://btw-studio.fly.dev). Extracted from our internal `notion-sync.js` pipeline that runs daily against our private vault.

## Why

- You write in **Obsidian** (fast, local, markdown).
- Your team / clients / dashboard lives in **Notion** (shareable, structured, linkable).
- Most sync tools try to be bidirectional and end up corrupting both. **vault-sync is one-way**: vault → Notion. Simple to reason about. Never surprises you.

## Install

```bash
npm install -g obsidian-notion-cli
# or use with npx (no install):
npx obsidian-notion-cli@latest push
```

Requires Node ≥ 20.

## Setup (2 minutes)

### 1. Add a Notion integration

Go to **notion.so/profile/integrations** → create an internal integration → copy the token. Share the pages you want synced *with* your integration (Notion → page → Connections → add integration).

### 2. Initialize config

```bash
cd /path/to/your/vault
npx obsidian-notion-cli init
```

Creates `.vault-sync.json`:

```json
{
  "vault": ".",
  "projectsDir": "projects",
  "frontmatterKey": "notion_id",
  "glob": "**/*.md",
  "dryRun": false
}
```

### 3. Set `notion_id` in your markdown frontmatter

For each markdown file you want synced, add the Notion page ID to its frontmatter:

```markdown
---
notion_id: 345002d3-0d68-812b-ad1d-ca822eee4fce
title: My Project
status: active
---

# My Project

## Description
...
```

### 4. Set the token

```bash
export NOTION_TOKEN="secret_..."
```

Or add it to `.vault-sync.json` under `"token"` (not recommended for shared repos).

### 5. Sync

```bash
npx obsidian-notion-cli push
```

Output:

```
✓ my-project → 345002d3-0d68-812b-ad1d-ca822eee4fce · 14 blocks
✓ other-project → 345002d3-0d68-81d5-a1b2-ff14a77dc9c4 · 22 blocks

2 file(s) synced.
```

## Commands

| Command | What it does |
|---------|---------------|
| `vault-sync init` | Create `.vault-sync.json` in current directory |
| `vault-sync list` | List all markdown files with `notion_id` frontmatter (preview what would sync) |
| `vault-sync push` | Sync all files — replaces existing page content with rendered markdown |
| `vault-sync push --dry-run` | Show what would be synced without writing to Notion |
| `vault-sync push --project <slug>` | Only sync files whose slug contains `<slug>` |

## What markdown features are supported

| Markdown | → Notion block |
|---|---|
| `# H1` / `## H2` / `### H3` | heading_1 / heading_2 / heading_3 |
| `- item` / `* item` | bulleted_list_item |
| `1. item` | numbered_list_item |
| `- [ ] task` / `- [x] done` | to_do block |
| `> quote` | quote block |
| ` ```lang\ncode\n``` ` | code block (language detected) |
| Plain paragraphs | paragraph block |

Inline formatting (bold/italic/links) is rendered as plain text in v0.1 — improvements coming in v0.2. PRs welcome.

## Architecture

`vault-sync` is deliberately tiny:

```
vault/
  projects/
    my-project.md         ← has notion_id: xxx in frontmatter
  .vault-sync.json        ← config: vault path + projectsDir
  
$ vault-sync push

├─ discoverFiles()        walks projectsDir, filters by frontmatter.notion_id
├─ markdownToBlocks()     parses markdown, emits Notion block JSON
└─ syncFile()             wipes existing children, appends new blocks

=> Notion page is now a mirror of the markdown file.
```

## Limitations (v0.1)

- **One-way only**: vault → Notion. Changes in Notion are *not* reflected back — they get overwritten on next push. This is a feature, not a bug.
- **Inline formatting** (bold, italic, links, code): rendered as plain text. v0.2 will parse them.
- **No incremental diff**: every push deletes all existing page blocks and re-appends. Fine for ≤ 50 project pages. If you have hundreds, the API call count will matter.
- **No images / attachments** handling in v0.1.
- **Node ≥ 20** required (ESM, fs/promises).

## Roadmap

- v0.2 — Inline formatting (bold/italic/links), better error messages, TS rewrite.
- v0.3 — Watch mode (`vault-sync watch` with Chokidar).
- v0.4 — GitHub Action starter (sync vault on push).
- v1.0 — Cloud SaaS with continuous sync + webhook triggers (if demand is there).

## License

MIT — see [LICENSE](./LICENSE).

## Contributing

PRs welcome. Keep scope tight: no bidirectional sync, no database mirrors, no "also syncs X". The point is to be small and predictable.

---

Built with ❤ by [BTW Studio](https://btw-studio.fly.dev). Sister projects: [Claude Agents Marketplace](https://agents-btw-studio.fly.dev) · [btw-agents-pack](https://github.com/workmailan8n-hash/btw-agents-pack).
