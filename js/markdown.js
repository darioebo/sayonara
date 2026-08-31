function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(s) {
  let out = esc(s);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return out;
}

export function renderMarkdown(md) {
  const lines = String(md).split(/\r?\n/);
  const html = [];
  let list = null;
  let quote = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      html.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      continue;
    }
    if (/^(\s*)[-*]\s+/.test(line)) {
      const item = line.replace(/^(\s*)[-*]\s+/, '').trim();
      if (list !== 'ul') { if (list) html.push('</ul>'); html.push('<ul>'); list = 'ul'; }
      html.push(`<li>${inline(item)}</li>`);
      continue;
    }
    if (/^(\s*)\d+\.\s+/.test(line)) {
      const item = line.replace(/^(\s*)\d+\.\s+/, '').trim();
      if (list !== 'ol') { if (list) html.push('</ol>'); html.push('<ol>'); list = 'ol'; }
      html.push(`<li>${inline(item)}</li>`);
      continue;
    }
    if (list) { html.push(`</${list}>`); list = null; }
    if (/^&gt;\s?/.test(line) === false && line.startsWith('>')) {
      if (quote !== true) { html.push('<blockquote>'); quote = true; }
      html.push(`<p>${inline(line.replace(/^>\s?/, ''))}</p>`);
      continue;
    }
    if (quote) { html.push('</blockquote>'); quote = false; }
    if (/^---+$/.test(line.trim())) { html.push('<hr>'); continue; }
    if (line.trim() === '') { continue; }
    html.push(`<p>${inline(line.trim())}</p>`);
  }
  if (list) html.push(`</${list}>`);
  if (quote) html.push('</blockquote>');
  return html.join('\n');
}

export function parsePageBlocks(md) {
  const src = String(md);
  const blocks = [];
  const marker = /^##\s+Pág\.?\s*(\d+)\s*$/i;
  const lines = src.split(/\r?\n/);
  let currentPage = null;
  let buf = [];
  const flush = () => {
    const text = buf.join('\n').trim();
    if (text) blocks.push({ page: currentPage, html: renderMarkdown(text) });
    buf = [];
  };
  for (const line of lines) {
    const m = line.match(marker);
    if (m) {
      flush();
      currentPage = parseInt(m[1], 10);
      continue;
    }
    buf.push(line);
  }
  flush();
  if (blocks.length === 0 && src.trim() !== '') {
    return [{ page: null, html: renderMarkdown(src) }];
  }
  return blocks;
}
