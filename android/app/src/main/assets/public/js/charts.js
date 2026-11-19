/* ===== charts.js — tiny dependency-free canvas chart engine (bars & lines) =====
   Uses only saved data. Handles negative values with a zero baseline. */
'use strict';

const Charts = (function () {

  function cssVar(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';
  }
  function palette() {
    return {
      pri: cssVar('--pri'), pos: cssVar('--pos'), neg: cssVar('--neg'),
      res: cssVar('--res'), sub: cssVar('--sub'), line: cssVar('--line'), txt: cssVar('--txt')
    };
  }

  function prep(cv) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 300;
    const h = cv.clientHeight || 190;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const x = cv.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    return { x, w, h };
  }

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return m * p;
  }

  function empty(x, w, h) {
    x.fillStyle = cssVar('--sub');
    x.font = '13px sans-serif';
    x.textAlign = 'center';
    x.fillText('لا توجد بيانات محفوظة بعد', w / 2, h / 2);
  }

  /* shared axis frame; returns scales */
  function frame(x, w, h, allVals, pad) {
    const padL = pad || 46, padR = 10, padT = 12, padB = 24;
    const iw = w - padL - padR, ih = h - padT - padB;
    let max = 0, min = 0;
    for (const v of allVals) { if (v > max) max = v; if (v < min) min = v; }
    if (max === 0 && min === 0) max = 1;
    max = niceMax(max);
    if (min < 0) min = -niceMax(-min);
    const range = max - min || 1;
    const y = v => padT + ih * (1 - (v - min) / range);
    /* gridlines */
    x.font = '10px sans-serif';
    x.textAlign = 'right';
    x.strokeStyle = cssVar('--line');
    x.fillStyle = cssVar('--sub');
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const v = min + range * i / steps;
      const yy = y(v);
      x.beginPath();
      x.moveTo(padL, yy);
      x.lineTo(w - padR, yy);
      x.globalAlpha = 0.6;
      x.stroke();
      x.globalAlpha = 1;
      x.fillText(NF.format(Math.round(v * 10) / 10), padL - 4, yy + 3);
    }
    /* zero baseline emphasized */
    if (min < 0 && max > 0) {
      x.strokeStyle = cssVar('--sub');
      x.beginPath();
      x.moveTo(padL, y(0));
      x.lineTo(w - padR, y(0));
      x.stroke();
    }
    return { y, padL, padR, padT, padB, iw, ih, min, max, range };
  }

  function xLabels(x, labels, n, iw, padL, padB, h) {
    x.fillStyle = cssVar('--sub');
    x.font = '10px sans-serif';
    x.textAlign = 'center';
    const skip = Math.ceil(n / 8);
    for (let i = 0; i < n; i++) {
      if (i % skip !== 0 && i !== n - 1) continue;
      x.fillText(labels[i], padL + iw * (i + 0.5) / n, h - 8);
    }
  }

  function bar(cv, labels, series) {
    if (!cv || !labels || !labels.length) return;
    const P = palette();
    const { x, w, h } = prep(cv);
    if (!labels.length) return empty(x, w, h);
    const all = series.flatMap(s => s.data);
    if (!all.some(v => isFinite(v) && v !== 0)) return empty(x, w, h);
    const f = frame(x, w, h, all);
    const n = labels.length;
    const groupW = f.iw / n;
    const bw = Math.max(2, (groupW * 0.62) / series.length);
    series.forEach((s, si) => {
      x.fillStyle = s.color;
      s.data.forEach((v, i) => {
        if (!isFinite(v) || v === 0) return;
        const cx0 = f.padL + groupW * i + (groupW - bw * series.length) / 2 + bw * si;
        const y0 = f.y(Math.max(0, v));
        const y1 = f.y(Math.min(0, v));
        x.fillRect(cx0, y0, bw, Math.max(1, y1 - y0));
      });
    });
    xLabels(x, labels, n, f.iw, f.padL, f.padB, h);
  }

  function line(cv, labels, series) {
    if (!cv || !labels || !labels.length) return;
    const P = palette();
    const { x, w, h } = prep(cv);
    const all = series.flatMap(s => s.data).filter(v => isFinite(v));
    if (!all.length) return empty(x, w, h);
    const f = frame(x, w, h, all);
    const n = labels.length;
    const px = i => f.padL + f.iw * (i + 0.5) / n;
    series.forEach(s => {
      x.strokeStyle = s.color;
      x.lineWidth = 2;
      x.beginPath();
      let started = false;
      s.data.forEach((v, i) => {
        if (!isFinite(v)) return;
        if (!started) { x.moveTo(px(i), f.y(v)); started = true; }
        else x.lineTo(px(i), f.y(v));
      });
      x.stroke();
      /* dots */
      s.data.forEach((v, i) => {
        if (!isFinite(v)) return;
        x.fillStyle = s.color;
        x.beginPath();
        x.arc(px(i), f.y(v), 2.6, 0, Math.PI * 2);
        x.fill();
      });
    });
    xLabels(x, labels, n, f.iw, f.padL, f.padB, h);
  }

  function legend(el, series) {
    if (!el) return;
    el.innerHTML = series.map(s =>
      '<span class="lg"><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>'
    ).join('');
  }

  return { bar, line, legend, palette };
})();
