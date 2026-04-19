#!/usr/bin/env node
import { Command } from 'commander';
import { writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, syncAll, discoverFiles } from '../src/index.js';

const program = new Command();

program
  .name('vault-sync')
  .description('Sync a markdown vault (Obsidian) to Notion. Frontmatter is the contract.')
  .version('0.1.0');

program
  .command('init')
  .description('Create .vault-sync.json in the current directory')
  .action(() => {
    const target = path.join(process.cwd(), '.vault-sync.json');
    if (existsSync(target)) {
      console.error(`✖ ${target} already exists.`);
      process.exit(1);
    }
    const template = {
      vault: '.',
      projectsDir: 'projects',
      frontmatterKey: 'notion_id',
      glob: '**/*.md',
      dryRun: false,
    };
    writeFileSync(target, JSON.stringify(template, null, 2) + '\n');
    console.log(`✓ Wrote ${target}`);
    console.log('  Set NOTION_TOKEN env var or add { "token": "..." } to config.');
    console.log('  Add `notion_id: <page-id>` to frontmatter of each project file.');
  });

program
  .command('push')
  .description('Sync all project files with notion_id frontmatter to Notion')
  .option('--dry-run', 'List changes without writing to Notion')
  .option('--project <slug>', 'Only sync files whose slug contains this substring')
  .action(async (opts) => {
    try {
      const config = loadConfig();
      const results = await syncAll(config, {
        dryRun: Boolean(opts.dryRun) || config.dryRun,
        projectFilter: opts.project ?? null,
      });
      if (results.length === 0) {
        console.log('No files with notion_id found. Nothing to sync.');
        return;
      }
      for (const r of results) {
        if (r.ok) {
          console.log(`${r.dryRun ? '[dry]' : '✓'} ${r.slug} → ${r.pageId} · ${r.blocks} blocks`);
        } else {
          console.error(`✖ ${r.slug}: ${r.error}`);
        }
      }
      const failed = results.filter((r) => !r.ok).length;
      process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
      console.error('✖', err.message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List files that would be synced (frontmatter with notion_id)')
  .action(() => {
    try {
      const config = loadConfig();
      const files = discoverFiles(config);
      if (files.length === 0) {
        console.log('No files with notion_id found.');
        return;
      }
      for (const f of files) {
        console.log(`${f.slug} → ${f.pageId}`);
      }
      console.log(`\n${files.length} file(s) ready to sync.`);
    } catch (err) {
      console.error('✖', err.message);
      process.exit(1);
    }
  });

program.parse();
