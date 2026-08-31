import { clampFrac } from './layout-core.js';

export function buildWorkspace(appEl) {
  const root = document.createElement('div');
  root.className = 'workspace';
  root.innerHTML = `
    <section class="pane pane-left" data-pane="left"></section>
    <div class="splitter splitter-v" data-axis="v"></div>
    <section class="pane-col">
      <section class="pane pane-right-top" data-pane="rightTop"></section>
      <div class="splitter splitter-h" data-axis="h"></div>
      <section class="pane pane-right-bottom" data-pane="rightBottom"></section>
    </section>`;
  appEl.appendChild(root);

  const panes = {
    left: root.querySelector('[data-pane="left"]'),
    rightTop: root.querySelector('[data-pane="rightTop"]'),
    rightBottom: root.querySelector('[data-pane="rightBottom"]')
  };

  root.classList.add('mode-edit');

  let fracV = 0.5;
  let fracH = 0.5;
  const listeners = [];
  const onResize = (cb) => listeners.push(cb);
  const emit = () => listeners.forEach((cb) => cb({ fracV, fracH }));

  const apply = () => {
    root.style.setProperty('--frac-v', fracV);
    root.style.setProperty('--frac-h', fracH);
  };
  apply();

  const setMode = (mode) => {
    if (mode === 'present') root.classList.add('mode-present');
    else root.classList.remove('mode-present');
  };

  const bindDrag = (splitter, axis) => {
    splitter.addEventListener('pointerdown', (e) => {
      splitter.setPointerCapture(e.pointerId);
      splitter.classList.add('dragging');
      const start = axis === 'v' ? e.clientX : e.clientY;
      const rect = root.getBoundingClientRect();
      const size = axis === 'v' ? rect.width : rect.height;
      const startFrac = axis === 'v' ? fracV : fracH;
      const move = (ev) => {
        const delta = axis === 'v' ? ev.clientX - start : ev.clientY - start;
        const next = clampFrac(startFrac + delta / size);
        if (axis === 'v') fracV = next; else fracH = next;
        apply();
        emit();
      };
      const up = () => {
        splitter.classList.remove('dragging');
        splitter.removeEventListener('pointermove', move);
        splitter.removeEventListener('pointerup', up);
        splitter.removeEventListener('pointercancel', up);
      };
      splitter.addEventListener('pointermove', move);
      splitter.addEventListener('pointerup', up);
      splitter.addEventListener('pointercancel', up);
    });
  };

  bindDrag(root.querySelector('.splitter-v'), 'v');
  bindDrag(root.querySelector('.splitter-h'), 'h');

  return { root, panes, setMode, onResize };
}
