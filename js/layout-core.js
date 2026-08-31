export function clampFrac(f) {
  const n = Number(f);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(0.75, Math.max(0.25, n));
}

export function splitVertical(w, frac = 0.5) {
  const f = clampFrac(frac);
  const left = Math.round(w * f);
  return { left, right: w - left };
}

export function splitHorizontal(h, fracTop = 0.5) {
  const f = clampFrac(fracTop);
  const top = Math.round(h * f);
  return { top, bottom: h - top };
}
