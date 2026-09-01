import { buildWorkspace } from './layout.js';
import { parsePageBlocks } from './markdown.js';
import * as db from './scenarios-db.js';
import { createScenario, withUpdated, blankZone, validateScenario, searchScenarios } from './scenarios-core.js';
import { openPdf } from './pdf.js';

const zoneFiles = new Map();
let activeObjectUrl = null;

export function rememberZoneFile(id, zone, file) {
  if (file) zoneFiles.set(`${id}:${zone}`, file);
}

function mountViewer(container, zoneDesc, { onPage }) {
  container.innerHTML = '';
  const type = zoneDesc.type;
  if (type === 'url') {
    const f = document.createElement('iframe');
    f.src = zoneDesc.src;
    f.allow = 'fullscreen';
    container.appendChild(f);
  } else if (type === 'image') {
    const img = document.createElement('img');
    img.alt = '';
    if (zoneDesc.src) {
      img.src = zoneDesc.src;
    } else {
      if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null; }
      if (zoneDesc.file) {
        img.src = URL.createObjectURL(zoneDesc.file);
        activeObjectUrl = img.src;
      }
    }
    container.appendChild(img);
  } else if (type === 'pdf') {
    const file = zoneDesc.file;
    const src = file ? file : (zoneDesc.src || null);
    openPdf(container, src, { onPage }).then(({ totalPages }) => {
      if (totalPages && window.__sayWorkspace) window.__sayWorkspace.totalPages = totalPages;
    }).catch((_e) => {
      container.innerHTML = `<p class="pane-empty">Não foi possível abrir o PDF. <button class="btn ghost" data-repick>Escolher ficheiro</button></p>`;
      const b = container.querySelector('[data-repick]');
      if (b) b.onclick = () => container.dispatchEvent(new CustomEvent('repick'));
    });
  } else {
    container.innerHTML = '<p class="pane-empty">Zona vazia.</p>';
  }
}

export function mount(appEl) {
  if (!window.indexedDB) { appEl.innerHTML = '<p>O navegador não suporta IndexedDB.</p>'; return; }
  renderRoute(appEl);
  window.addEventListener('hashchange', () => renderRoute(appEl));
}

let routeSeq = 0;

async function renderRoute(appEl) {
  const seq = ++routeSeq;
  const hash = window.location.hash || '#/';
  appEl.innerHTML = '';
  await db.initDB().catch(() => {});
  if (seq !== routeSeq) return;
  if (hash.startsWith('#/workspace/')) {
    const id = hash.split('/')[2];
    const s = await db.getScenario(id);
    if (seq !== routeSeq) return;
    if (s) { renderWorkspace(appEl, s); return; }
    window.location.hash = '#/';
    return;
  }
  if (hash.startsWith('#/editor/')) {
    const id = hash.split('/')[2];
    await editFlow(appEl, id, seq);
    return;
  }
  if (hash.startsWith('#/editor')) {
    await editFlow(appEl, null, seq);
    return;
  }
  renderHome(appEl, seq);
}

async function renderWorkspace(appEl, scenario) {
  appEl.innerHTML = '';
  const leftZone = scenario.left || blankZone();
  const rightZone = scenario.rightBottom || blankZone();
  const ws = buildWorkspace(appEl, {
    left: leftZone.type !== 'none',
    rightBottom: rightZone.type !== 'none'
  });
  const statusbar = document.createElement('div');
  statusbar.className = 'statusbar';
  document.body.appendChild(statusbar);
  document.title = `${scenario.name} — Sayonara`;

  const notesPane = ws.panes.rightTop;
  notesPane.classList.add('notes');

  const blocks = parsePageBlocks(scenario.notes ? scenario.notes.content : '');
  const showBlock = (page) => {
    const block = blocks.find((b) => b.page === page) || blocks.find((b) => b.page === null) || blocks[0];
    if (!block) return;
    notesPane.innerHTML = block.html;
  };
  showBlock(null);

  if (leftZone.type === 'pdf' && leftZone.file) rememberZoneFile(scenario.id, 'left', leftZone.file);
  if (rightZone.type === 'pdf' && rightZone.file) rememberZoneFile(scenario.id, 'rightBottom', rightZone.file);
  if (rightZone.type === 'image' && rightZone.file) rememberZoneFile(scenario.id, 'rightBottom', rightZone.file);
  if (leftZone.type === 'image' && leftZone.file) rememberZoneFile(scenario.id, 'left', leftZone.file);

  const leftDesc = { ...leftZone };
  if (leftDesc.type === 'pdf' && !leftDesc.src) leftDesc.file = zoneFiles.get(`${scenario.id}:left`);
  const rightDesc = { ...rightZone };
  if (rightDesc.type === 'pdf' && !rightDesc.src) rightDesc.file = zoneFiles.get(`${scenario.id}:rightBottom`);

  const chrome = document.createElement('div');
  chrome.className = 'chrome';
  chrome.innerHTML = `
    <button class="btn ghost" data-act="home" title="Voltar ao início"><span>← Início</span></button>
    <button class="btn" data-act="present" title="Apresentar (tela cheia)"><span>▶ Apresentar</span></button>`;
  document.body.appendChild(chrome);

  const cleanup = () => {
    if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null; }
    document.removeEventListener('keydown', onEscapeExit);
    statusbar.remove();
    chrome.remove();
    document.title = 'Sayonara';
    delete window.__sayonara;
    delete window.__saySync;
    delete window.__sayWorkspace;
  };

  const present = () => {
    ws.setMode('present');
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  };
  const exit = () => {
    ws.setMode('edit');
    if (document.fullscreenElement) document.exitFullscreen();
  };

  let timeout;
  const flashStatus = (msg) => {
    statusbar.textContent = msg;
    statusbar.classList.add('show');
    clearTimeout(timeout);
    timeout = setTimeout(() => statusbar.classList.remove('show'), 1600);
  };

  const setPage = (page) => {
    showBlock(page);
    flashStatus(`Pág. ${page} / ${window.__sayWorkspace.totalPages || '?'}`);
  };
  window.__sayonara = { scenario, ws, setPage, cleanup };
  window.__saySync = { blocks, setPage };
  window.__sayWorkspace = { ws, totalPages: 0, setPage, scenario, flashStatus, present, exit, cleanup };

  chrome.querySelector('[data-act=home]').addEventListener('click', () => {
    cleanup();
    window.location.hash = '#/';
  });
  chrome.querySelector('[data-act=present]').addEventListener('click', present);
  statusbar.addEventListener('click', () => { if (ws.root.classList.contains('mode-present')) exit(); });
  document.addEventListener('keydown', onEscapeExit);
  window.addEventListener('hashchange', cleanup, { once: true });

  function onEscapeExit(e) {
    if (e.key === 'Escape' && ws.root.classList.contains('mode-present')) exit();
  }

  mountViewer(ws.panes.left, leftDesc, { onPage: (n) => window.__sayWorkspace.setPage(n) });
  mountViewer(ws.panes.rightBottom, rightDesc, {});
  if (leftDesc.type === 'pdf') setPage(1);

  ws.panes.left.addEventListener('repick', () => {
    cleanup();
    window.location.hash = `#/editor/${scenario.id}`;
  });
}

async function renderHome(appEl, seq) {
  appEl.innerHTML = '';
  const all = await db.listScenarios();
  if (typeof seq === 'number' && seq !== routeSeq) return;
  const root = document.createElement('div');
  root.className = 'home';
  root.innerHTML = `
    <div class="bar">
      <span class="brand">Sayonara</span>
      <span class="spacer"></span>
      <button class="btn primary" data-act="new">＋ Novo cenário</button>
    </div>
    <div class="search-wrap">
      <svg class="search-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input class="home-search" type="text" placeholder="Procurar cenários…" aria-label="Procurar cenários">
      <button class="search-clear" data-act="clear" type="button" aria-label="Limpar procura">×</button>
    </div>
    <div data-zone="scenarios" class="grid-scenarios"></div>`;
  const searchBox = root.querySelector('.home-search');
  const clearBtn = root.querySelector('[data-act=clear]');

  const grid = root.querySelector('[data-zone=scenarios]');
  const renderList = (list) => {
    grid.innerHTML = '';
    if (list.length === 0) {
      if (all.length === 0) {
        grid.innerHTML = `<div class="empty"><h2>Ainda não tens cenários</h2><p>Cria o primeiro para começares a apresentar.</p></div>`;
      } else {
        grid.innerHTML = `<div class="empty"><p>Nenhum resultado para a procura.</p></div>`;
      }
      return;
    }
    for (const s of list) {
      const types = [];
      if (s.left && s.left.type !== 'none') types.push(s.left.type === 'pdf' ? 'Slides PDF' : s.left.type.toUpperCase());
      if (s.rightBottom && s.rightBottom.type !== 'none') types.push('Conteúdo');
      types.push('Notas');
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <h3 class="name"></h3>
        <div class="meta"></div>
        <div class="tags"></div>
        <div class="actions">
          <button class="btn primary" data-act="open">Abrir</button>
          <button class="btn ghost" data-act="duplicate">Duplicar</button>
          <button class="btn ghost" data-act="edit">Editar</button>
          <button class="btn ghost" data-act="delete">Eliminar</button>
        </div>`;
      card.querySelector('.name').textContent = s.name;
      card.querySelector('.meta').textContent = new Date(s.updatedAt).toLocaleString('pt-PT');
      for (const t of types) {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = t;
        card.querySelector('.tags').appendChild(tag);
      }
      card.querySelector('[data-act=open]').addEventListener('click', () => { window.location.hash = `#/workspace/${s.id}`; });
      card.querySelector('[data-act=duplicate]').addEventListener('click', async () => { await db.duplicateScenario(s); await renderHome(appEl, seq); });
      card.querySelector('[data-act=edit]').addEventListener('click', () => { window.location.hash = `#/editor/${s.id}`; });
      card.querySelector('[data-act=delete]').addEventListener('click', async () => {
        if (confirm(`Eliminar o cenário "${s.name}"?`)) { await db.deleteScenario(s.id); await renderHome(appEl, seq); }
      });
      grid.appendChild(card);
    }
  };
  const searchWrap = root.querySelector('.search-wrap');
  const applySearch = () => {
    searchWrap.classList.toggle('has-query', searchBox.value.length > 0);
    renderList(searchScenarios(all, searchBox.value));
  };
  searchBox.addEventListener('input', applySearch);
  clearBtn.addEventListener('click', () => { searchBox.value = ''; searchBox.focus(); applySearch(); });
  root.querySelector('[data-act=new]').addEventListener('click', () => { window.location.hash = '#/editor'; });
  appEl.appendChild(root);
  renderList(all);
}

async function editFlow(appEl, existingId, seq) {
  const existing = existingId ? await db.getScenario(existingId) : null;
  if (typeof seq === 'number' && seq !== routeSeq) return;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="sheet">
      <h2>${existing ? 'Editar cenário' : 'Novo cenário'}</h2>
      <div class="field"><label>Nome do cenário</label><input type="text" data-f="name" placeholder="Ex.: Reunião semanal — Estado"></div>
      <div class="field"><label>Notas (.md)</label><button class="filebtn" data-f="notes">Escolher notas <span class="fname" data-fname="notes"></span></button></div>
      <div class="row">
        <div class="field"><label>Slides (PDF)</label><button class="filebtn" data-f="left">Escolher PDF <span class="fname" data-fname="left"></span></button></div>
        <div class="field"><label>Zona direita (conteúdo)</label>
          <select data-f="rtype">
            <option value="url">URL</option>
            <option value="pdf">PDF</option>
            <option value="image">Imagem</option>
            <option value="none">Nenhuma</option>
          </select>
          <input type="text" data-f="rsrc" placeholder="URL">
          <button class="filebtn" data-f="rfile">Escolher ficheiro <span class="fname" data-fname="rightBottom"></span></button>
        </div>
      </div>
      <div class="actions">
        <button class="btn ghost" data-act="cancel">Cancelar</button>
        <button class="btn primary" data-act="save">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const nameInput = overlay.querySelector('[data-f=name]');
  nameInput.value = existing ? existing.name : '';

  const draft = {
    name: existing ? existing.name : '',
    notes: { fileName: existing && existing.notes ? existing.notes.fileName : '', content: existing && existing.notes ? existing.notes.content : '' },
    left: existing && existing.left ? existing.left : blankZone(),
    rightBottom: existing && existing.rightBottom ? existing.rightBottom : blankZone()
  };

  const pickFile = (kind) => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      if (kind === 'notes') input.accept = '.md,.markdown,text/markdown,text/plain';
      else if (kind === 'left') input.accept = '.pdf,application/pdf';
      else if (kind === 'image') input.accept = 'image/*';
      else input.accept = '*/*';
      input.onchange = () => resolve(input.files[0] || null);
      input.click();
    });
  };

  const setFileBtn = (kind, file) => {
    const span = overlay.querySelector(`[data-fname=${kind}]`);
    if (file) span.textContent = file.name; else span.textContent = '';
  };

  overlay.querySelector('[data-f=notes]').addEventListener('click', async () => {
    const f = await pickFile('notes');
    if (!f) return;
    draft.notes.fileName = f.name;
    draft.notes.content = await f.text();
    setFileBtn('notes', f);
  });
  overlay.querySelector('[data-f=left]').addEventListener('click', async () => {
    const f = await pickFile('left');
    if (!f) return;
    draft.left = { type: 'pdf', src: '', fileName: f.name, file: f };
    setFileBtn('left', f);
  });

  const rsrcInput = overlay.querySelector('[data-f=rsrc]');
  if (draft.rightBottom.src) rsrcInput.value = draft.rightBottom.src;
  const rtypeSelect = overlay.querySelector('[data-f=rtype]');
  rtypeSelect.value = draft.rightBottom.type || 'none';
  overlay.querySelector('[data-f=rtype]').addEventListener('change', (e) => {
    draft.rightBottom = { ...blankZone(), type: e.target.value };
    rsrcInput.value = '';
    setFileBtn('rightBottom', null);
  });
  const rfileBtn = overlay.querySelector('[data-f=rfile]');
  rfileBtn.addEventListener('click', async () => {
    const t = rtypeSelect.value;
    const kind = t === 'image' ? 'image' : (t === 'pdf' ? 'pdf' : null);
    if (!kind) return;
    const f = await pickFile(kind);
    if (!f) return;
    draft.rightBottom = { type: t, src: '', fileName: f.name, file: f };
    rsrcInput.value = '';
    setFileBtn('rightBottom', f);
  });
  if (draft.rightBottom.fileName) setFileBtn('rightBottom', { name: draft.rightBottom.fileName });
  rsrcInput.addEventListener('input', (e) => {
    draft.rightBottom = { ...draft.rightBottom, src: e.target.value };
  });

  nameInput.addEventListener('input', (e) => { draft.name = e.target.value; });

  overlay.querySelector('[data-act=cancel]').addEventListener('click', () => { overlay.remove(); window.location.hash = '#/'; });
  overlay.querySelector('[data-act=save]').addEventListener('click', async () => {
    const scenario = existing
      ? withUpdated({ ...existing, name: draft.name, notes: draft.notes, left: draft.left, rightBottom: draft.rightBottom })
      : createScenario({ name: draft.name, notes: draft.notes, left: draft.left, rightBottom: draft.rightBottom });
    const errs = validateScenario(scenario);
    if (errs.length) { alert(errs.join('\n')); return; }
    await db.saveScenario(scenario);
    overlay.remove();
    window.location.hash = `#/workspace/${scenario.id}`;
  });
}
