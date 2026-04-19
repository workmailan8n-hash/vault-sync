import { Client } from '@notionhq/client';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const MAX_BLOCK_LEN = 1900;

// ── Config loader ───────────────────────────────────────────────────────────

export function loadConfig(cwd = process.cwd()) {
  const configPath = path.join(cwd, '.vault-sync.json');
  if (!existsSync(configPath)) {
    throw new Error('No .vault-sync.json found. Run `vault-sync init` first to create one.');
  }
  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
  const token = process.env.NOTION_TOKEN || raw.token;
  if (!token) {
    throw new Error('NOTION_TOKEN is required. Set it as env var or in .vault-sync.json.');
  }
  const vaultDir = path.resolve(cwd, raw.vault || '.');
  const projectsDir = path.resolve(vaultDir, raw.projectsDir || 'projects');
  return {
    token,
    vaultDir,
    projectsDir,
    glob: raw.glob || '**/*.md',
    frontmatterKey: raw.frontmatterKey || 'notion_id',
    dryRun: Boolean(raw.dryRun),
  };
}

// ── Discover files ──────────────────────────────────────────────────────────

export function discoverFiles(config) {
  const files = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.name.endsWith('.md')) {
        const raw = readFileSync(abs, 'utf-8');
        const parsed = matter(raw);
        const pageId = parsed.data[config.frontmatterKey];
        if (pageId) {
          files.push({
            abs,
            slug: path.basename(entry.name, '.md'),
            pageId: String(pageId),
            frontmatter: parsed.data,
            content: parsed.content,
          });
        }
      }
    }
  }
  walk(config.projectsDir);
  return files;
}

// ── Markdown → Notion blocks ────────────────────────────────────────────────

export function markdownToBlocks(markdown) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let paragraphBuffer = [];

  function flushParagraph() {
    if (paragraphBuffer.length === 0) return;
    const text = paragraphBuffer.join(' ').trim();
    if (text) blocks.push(paragraphBlock(text));
    paragraphBuffer = [];
  }

  let inCodeBlock = false;
  let codeLang = '';
  let codeBuffer = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push(codeBlock(codeBuffer.join('\n'), codeLang || 'plain text'));
        codeBuffer = [];
        codeLang = '';
        inCodeBlock = false;
      } else {
        flushParagraph();
        inCodeBlock = true;
        codeLang = line.replace(/^```/, '').trim();
      }
      continue;
    }
    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    if (/^#\s+/.test(line)) {
      flushParagraph();
      blocks.push(headingBlock(line.replace(/^#\s+/, ''), 1));
    } else if (/^##\s+/.test(line)) {
      flushParagraph();
      blocks.push(headingBlock(line.replace(/^##\s+/, ''), 2));
    } else if (/^###\s+/.test(line)) {
      flushParagraph();
      blocks.push(headingBlock(line.replace(/^###\s+/, ''), 3));
    } else if (/^[-*]\s+\[[ xX]\]\s+/.test(line)) {
      flushParagraph();
      const checked = /^[-*]\s+\[[xX]\]\s+/.test(line);
      const text = line.replace(/^[-*]\s+\[[ xX]\]\s+/, '');
      blocks.push(todoBlock(text, checked));
    } else if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      blocks.push(bulletBlock(line.replace(/^[-*]\s+/, '')));
    } else if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      blocks.push(numberedBlock(line.replace(/^\d+\.\s+/, '')));
    } else if (/^>\s?/.test(line)) {
      flushParagraph();
      blocks.push(quoteBlock(line.replace(/^>\s?/, '')));
    } else if (line.trim() === '') {
      flushParagraph();
    } else {
      paragraphBuffer.push(line);
    }
  }
  flushParagraph();
  if (inCodeBlock && codeBuffer.length) {
    blocks.push(codeBlock(codeBuffer.join('\n'), codeLang || 'plain text'));
  }
  return blocks;
}

function richText(text) {
  const truncated = text.length > MAX_BLOCK_LEN ? text.slice(0, MAX_BLOCK_LEN) + '…' : text;
  return [{ type: 'text', text: { content: truncated } }];
}

function paragraphBlock(text) {
  return { object: 'block', type: 'paragraph', paragraph: { rich_text: richText(text) } };
}
function headingBlock(text, level) {
  const key = level === 1 ? 'heading_1' : level === 2 ? 'heading_2' : 'heading_3';
  return { object: 'block', type: key, [key]: { rich_text: richText(text) } };
}
function bulletBlock(text) {
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: richText(text) },
  };
}
function numberedBlock(text) {
  return {
    object: 'block',
    type: 'numbered_list_item',
    numbered_list_item: { rich_text: richText(text) },
  };
}
function todoBlock(text, checked) {
  return {
    object: 'block',
    type: 'to_do',
    to_do: { rich_text: richText(text), checked },
  };
}
function quoteBlock(text) {
  return { object: 'block', type: 'quote', quote: { rich_text: richText(text) } };
}
function codeBlock(code, lang) {
  const safeLang = /^[a-z0-9_+-]+$/i.test(lang) ? lang.toLowerCase() : 'plain text';
  return {
    object: 'block',
    type: 'code',
    code: { rich_text: richText(code), language: safeLang },
  };
}

// ── Sync one file ───────────────────────────────────────────────────────────

export async function syncFile(notion, file, { dryRun = false } = {}) {
  const blocks = markdownToBlocks(file.content);
  if (dryRun) {
    return { slug: file.slug, pageId: file.pageId, blocks: blocks.length, dryRun: true };
  }
  // Fetch existing children → delete them → append new
  const existing = await notion.blocks.children.list({ block_id: file.pageId, page_size: 100 });
  for (const child of existing.results) {
    try {
      await notion.blocks.delete({ block_id: child.id });
    } catch {
      /* ignore already-deleted */
    }
  }
  // Append in chunks of 100
  for (let i = 0; i < blocks.length; i += 100) {
    await notion.blocks.children.append({
      block_id: file.pageId,
      children: blocks.slice(i, i + 100),
    });
  }
  return { slug: file.slug, pageId: file.pageId, blocks: blocks.length, dryRun: false };
}

// ── Orchestrator ────────────────────────────────────────────────────────────

export async function syncAll(config, { dryRun = config.dryRun, projectFilter = null } = {}) {
  const notion = new Client({ auth: config.token });
  let files = discoverFiles(config);
  if (projectFilter) {
    files = files.filter((f) => f.slug.toLowerCase().includes(projectFilter.toLowerCase()));
  }
  const results = [];
  for (const file of files) {
    try {
      const res = await syncFile(notion, file, { dryRun });
      results.push({ ok: true, ...res });
    } catch (err) {
      results.push({ ok: false, slug: file.slug, error: err.message });
    }
  }
  return results;
}
