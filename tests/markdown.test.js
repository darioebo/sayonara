import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, parsePageBlocks } from '../js/markdown.js';

test('renderMarkdown escapes raw HTML', () => {
  const out = renderMarkdown('# t\n<script>alert(1)</script>');
  assert.ok(!out.includes('<script>'));
  assert.ok(out.includes('&lt;script&gt;'));
});

test('renderMarkdown renders headings, lists, bold, code', () => {
  const out = renderMarkdown('## Título\n- a\n- b\n**gordo** e `code`');
  assert.ok(out.includes('<h2>Título</h2>'));
  assert.ok(out.includes('<li>a</li>'));
  assert.ok(out.includes('<strong>gordo</strong>'));
  assert.ok(out.includes('<code>code</code>'));
});

test('parsePageBlocks splits on Pág markers', () => {
  const md = '# Reunião\n---\n## Pág. 1\n- intro\n---\n## Pág. 2\n- dados';
  const blocks = parsePageBlocks(md);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].page, null);
  assert.equal(blocks[1].page, 1);
  assert.ok(blocks[1].html.includes('intro'));
  assert.equal(blocks[2].page, 2);
});

test('parsePageBlocks returns single block when no markers', () => {
  const blocks = parsePageBlocks('notas soltas');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].page, null);
});
