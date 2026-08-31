export function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function blankZone() {
  return { type: 'none', src: '', fileName: '' };
}

export function createScenario({ name, notes, left, rightBottom }) {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    name: String(name || '').trim(),
    createdAt: now,
    updatedAt: now,
    notes: notes || { fileName: '', content: '' },
    left: left || blankZone(),
    rightBottom: rightBottom || blankZone()
  };
}

export function validateScenario(s) {
  const errs = [];
  if (!s.name || !String(s.name).trim()) errs.push('O cenário precisa de um nome.');
  for (const zone of ['left', 'rightBottom']) {
    const z = s[zone];
    if (z && z.type !== 'none' && !String(z.src || '').trim()) {
      errs.push(`A zona "${zone}" está preenchida mas sem origem (src).`);
    }
  }
  return errs;
}

export function withUpdated(s) {
  return { ...s, updatedAt: new Date().toISOString() };
}

export function searchScenarios(list, q) {
  const query = String(q || '').trim().toLowerCase();
  if (!query) return list;
  return list.filter((s) => String(s.name || '').toLowerCase().includes(query));
}
