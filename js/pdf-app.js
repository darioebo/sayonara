import { buildWorkspace } from './layout.js';
import { parsePageBlocks } from './markdown.js';
import * as db from './scenarios-db.js';
import { createScenario, withUpdated, blankZone, validateScenario, searchScenarios } from './scenarios-core.js';

let totalPages = 0;

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
    await editFlow(appEl, id);
    return;
  }
  if (hash.startsWith('#/editor')) {
    await editFlow(appEl, null);
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
  const all = await db.listScenarios();
  const searchBox = document.createElement('input');
  searchBox.type = 'text';
  searchBox.placeholder = 'Procurar cenários…';
  searchBox.className = 'home-search';

  const root = document.createElement('div');
  root.className = 'home';
  root.innerHTML = `
    <div class="bar">
      <span class="brand">Sayonara</span>
      <span class="spacer"></span>
      <button class="btn primary" data-act="new">＋ Novo cenário</button>
    </div>
    <div class="search-wrap"></div>
    <div data-zone="scenarios" class="grid-scenarios"></div>`;
  root.querySelector('.search-wrap').appendChild(searchBox);

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
      card.querySelector('[data-act=duplicate]').addEventListener('click', async () => { await db.duplicateScenario(s); await renderHome(appEl); });
      card.querySelector('[data-act=edit]').addEventListener('click', () => { window.location.hash = `#/editor/${s.id}`; });
      card.querySelector('[data-act=delete]').addEventListener('click', async () => {
        if (confirm(`Eliminar o cenário "${s.name}"?`)) { await db.deleteScenario(s.id); await renderHome(appEl); }
      });
      grid.appendChild(card);
    }
  };
  searchBox.addEventListener('input', () => renderList(searchScenarios(all, searchBox.value)));
  appEl.appendChild(root);
  renderList(all);
}

async function editFlow(appEl, existingId) {
  const existing = existingId ? await db.getScenario(existingId) : null;
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
          <input type="text" data-f="rsrc" placeholder="URL ou escolher ficheiro">
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
  overlay.querySelector('[data-f=rtype]').addEventListener('change', (e) => {
    draft.rightBottom = { ...draft.rightBottom, type: e.target.value };
  });
  rsrcInput.addEventListener('input', (e) => { draft.rightBottom.src = e.target.value; });

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
