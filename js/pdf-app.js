import { buildWorkspace } from './layout.js';
import { parsePageBlocks } from './markdown.js';
import * as db from './scenarios-db.js';
import { createScenario, withUpdated, blankZone } from './scenarios-core.js';

let totalPages = 0;

export function mount(appEl) {
  if (!window.indexedDB) { appEl.innerHTML = '<p>O navegador não suporta IndexedDB.</p>'; return; }
  renderRoute(appEl);
  window.addEventListener('hashchange', () => renderRoute(appEl));
}

async function renderRoute(appEl) {
  const hash = window.location.hash || '#/';
  db.initDB().catch(() => {});
  if (hash.startsWith('#/workspace/')) {
    const id = hash.split('/')[2];
    const s = await db.getScenario(id);
    if (s) { renderWorkspace(appEl, s); return; }
  }
  if (hash.startsWith('#/editor/')) {
    const id = hash.split('/')[2];
    const s = await db.getScenario(decodeURIComponent(id)).catch(() => null);
    renderEditor(appEl, s ? s.id : null);
    return;
  }
  if (hash.startsWith('#/editor')) {
    renderEditor(appEl, null);
    return;
  }
  renderHome(appEl);
}

async function renderWorkspace(appEl, scenario) {
  appEl.innerHTML = '';
  const ws = buildWorkspace(appEl);
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

  const chrome = document.createElement('div');
  chrome.className = 'chrome';
  chrome.innerHTML = `
    <button class="btn ghost" data-act="home" title="Voltar ao início"><span>← Início</span></button>
    <button class="btn" data-act="present" title="Apresentar (tela cheia)"><span>▶ Apresentar</span></button>`;
  document.body.appendChild(chrome);

  const cleanup = () => {
    statusbar.remove();
    chrome.remove();
    document.title = 'Sayonara';
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
    flashStatus(`Pág. ${page} / ${totalPages}`);
  };
  window.__sayonara = { scenario, ws, setPage, cleanup };
  window.__saySync = { blocks, setPage };
  window.__sayWorkspace = { ws, setPage, scenario, flashStatus, present, exit, cleanup };

  chrome.querySelector('[data-act=home]').addEventListener('click', () => {
    cleanup();
    window.location.hash = '#/';
  });
  chrome.querySelector('[data-act=present]').addEventListener('click', present);
  statusbar.addEventListener('click', () => { if (ws.root.classList.contains('mode-present')) exit(); });

  window.addEventListener('hashchange', cleanup, { once: true });
}

async function renderHome(appEl) {
  appEl.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'home';
  root.innerHTML = `
    <div class="bar">
      <span class="brand">Sayonara</span>
      <span class="spacer"></span>
      <button class="btn primary" data-act="new">＋ Novo cenário</button>
    </div>
    <div data-zone="scenarios"></div>`;
  root.querySelector('[data-act=new]').addEventListener('click', () => { window.location.hash = '#/editor'; });
  const zone = root.querySelector('[data-zone=scenarios]');
  const list = await db.listScenarios();
  if (list.length === 0) {
    zone.innerHTML = `<div class="empty"><h2>Ainda não tens cenários</h2><p>Cria o primeiro para começares a apresentar.</p></div>`;
  } else {
    for (const s of list) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = s.name;
      b.style.margin = '6px';
      b.addEventListener('click', () => { window.location.hash = `#/workspace/${s.id}`; });
      zone.appendChild(b);
    }
  }
  appEl.appendChild(root);
}

async function renderEditor(appEl, existingId) {
  const existing = existingId ? await db.getScenario(existingId) : null;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const draft = { name: existing ? existing.name : '' };
  overlay.innerHTML = `
    <div class="sheet">
      <h2>${existing ? 'Editar cenário' : 'Novo cenário'}</h2>
      <div class="field"><label>Nome do cenário</label><input type="text" data-f="name" placeholder="Ex.: Reunião semanal — Estado"></div>
      <div class="actions">
        <button class="btn ghost" data-act="cancel">Cancelar</button>
        <button class="btn primary" data-act="save">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const nameInput = overlay.querySelector('[data-f=name]');
  nameInput.value = existing ? existing.name : '';
  nameInput.addEventListener('input', (e) => { draft.name = e.target.value; });
  overlay.querySelector('[data-act=cancel]').addEventListener('click', () => { overlay.remove(); window.location.hash = '#/'; });
  overlay.querySelector('[data-act=save]').addEventListener('click', async () => {
    if (!draft.name.trim()) { alert('O cenário precisa de um nome.'); return; }
    const scenario = existing
      ? withUpdated({ ...existing, name: draft.name })
      : createScenario({ name: draft.name, notes: { fileName: '', content: '' }, left: blankZone(), rightBottom: blankZone() });
    await db.saveScenario(scenario);
    overlay.remove();
    window.location.hash = `#/workspace/${scenario.id}`;
  });
}
