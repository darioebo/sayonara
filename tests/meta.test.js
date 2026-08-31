import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

test('required files exist', () => {
  for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'css/base.css', 'css/app.css', 'js/main.js']) {
    assert.ok(existsSync(path.join(root, f)), `missing ${f}`);
  }
});

test('manifest declares required fields and icons', () => {
  const m = JSON.parse(readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.name, 'Sayonara');
  assert.equal(m.display, 'standalone');
  const icons = m.icons.map(i => i.src);
  for (const s of ['icons/icon-512.png', 'icons/icon-192.png', 'icons/maskable-512.png']) {
    assert.ok(icons.includes(s), `missing icon ${s}`);
  }
});
