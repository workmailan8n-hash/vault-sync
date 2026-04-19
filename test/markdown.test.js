import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownToBlocks } from '../src/index.js';

test('heading levels', () => {
  const blocks = markdownToBlocks('# One\n## Two\n### Three\n');
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].type, 'heading_1');
  assert.equal(blocks[1].type, 'heading_2');
  assert.equal(blocks[2].type, 'heading_3');
});

test('bulleted list', () => {
  const blocks = markdownToBlocks('- one\n- two\n- three\n');
  assert.equal(blocks.length, 3);
  blocks.forEach((b) => assert.equal(b.type, 'bulleted_list_item'));
});

test('numbered list', () => {
  const blocks = markdownToBlocks('1. a\n2. b\n');
  assert.equal(blocks.length, 2);
  blocks.forEach((b) => assert.equal(b.type, 'numbered_list_item'));
});

test('to-do items', () => {
  const blocks = markdownToBlocks('- [ ] pending\n- [x] done\n');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, 'to_do');
  assert.equal(blocks[0].to_do.checked, false);
  assert.equal(blocks[1].to_do.checked, true);
});

test('quote block', () => {
  const blocks = markdownToBlocks('> wisdom\n');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'quote');
});

test('fenced code block with language', () => {
  const blocks = markdownToBlocks('```js\nconsole.log(1);\n```\n');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'code');
  assert.equal(blocks[0].code.language, 'js');
});

test('paragraph with multiple lines joins with space', () => {
  const blocks = markdownToBlocks('line one\nline two\n');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[0].paragraph.rich_text[0].text.content, 'line one line two');
});

test('blank line separates paragraphs', () => {
  const blocks = markdownToBlocks('first para\n\nsecond para\n');
  assert.equal(blocks.length, 2);
  blocks.forEach((b) => assert.equal(b.type, 'paragraph'));
});

test('truncates content over 1900 chars', () => {
  const long = 'a'.repeat(3000);
  const blocks = markdownToBlocks(long);
  assert.equal(blocks[0].paragraph.rich_text[0].text.content.length, 1901); // 1900 + ellipsis
});
