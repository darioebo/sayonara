let pdfjs;

async function ensurePdfjs() {
  if (pdfjs) return pdfjs;
  pdfjs = await import('../vendor/pdfjs/pdf.min.mjs');
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.min.mjs';
  }
  return pdfjs;
}

export async function openPdf(container, source, { onPage } = {}) {
  container.innerHTML = '';
  container.classList.add('pdf-wrap');
  const lib = await ensurePdfjs();
  let pdf;
  if (source instanceof File || (source && source.name && typeof source.arrayBuffer === 'function')) {
    const buf = await source.arrayBuffer();
    pdf = await lib.getDocument({ data: buf }).promise;
  } else if (typeof source === 'string' && source.startsWith('http')) {
    pdf = await lib.getDocument(source).promise;
  } else if (source && source.url) {
    pdf = await lib.getDocument(source.url).promise;
  } else {
    container.innerHTML = '<p class="pane-empty">PDF indisponível.</p>';
    return { totalPages: 0, destroy() {} };
  }

  const wrap = document.createElement('div');
  wrap.className = 'pdf-scroll';
  container.appendChild(wrap);

  let currentPage = 1;
  const totalPages = pdf.numPages;
  const pages = [];
  const renderPage = async (n) => {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages[n] = canvas;
    wrap.appendChild(canvas);
  };

  const nearestPage = () => {
    let best = 1, bestDist = Infinity;
    for (let n = 1; n <= totalPages; n++) {
      const el = pages[n];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const wrapTop = wrap.getBoundingClientRect().top;
      const dist = Math.abs(rect.top - wrapTop);
      if (dist < bestDist) { bestDist = dist; best = n; }
    }
    return best;
  };

  for (let n = 1; n <= totalPages; n++) await renderPage(n);

  wrap.addEventListener('scroll', () => {
    const n = nearestPage();
    if (n !== currentPage) { currentPage = n; if (onPage) onPage(n); }
  });

  const destroy = () => { container.innerHTML = ''; try { pdf.destroy(); } catch (_) {} };
  return { totalPages, destroy };
}
