/* ===== ui.js — formatting, dialogs, toasts, modals, exports ===== */
'use strict';

/* Views registry */
window.Views = {};

/* ---------- escaping & formatting ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
const NF = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
function fmtN(n) {
  n = +n;
  if (!isFinite(n)) return '—';
  return NF.format(Math.round(n * 100) / 100);
}
/* money as HTML — number kept LTR inside RTL text */
function money(n) {
  return '<bdi dir="ltr">' + fmtN(n) + '</bdi> <small>ج.م</small>';
}
function fmtPct(n, dec) {
  if (n === null || n === undefined || !isFinite(n)) return '<bdi dir="ltr">—</bdi>';
  return '<bdi dir="ltr">' + NF.format(Math.round(n * 10) / 10) + '%' + '</bdi>';
}
function plainPct(n) {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return NF.format(Math.round(n * 10) / 10) + '%';
}

/* safe percent change cell for comparisons (returns null => '—') */
function changeBadge(ch, opts) {
  opts = opts || {};
  if (ch === null || ch === undefined || !isFinite(ch)) return '<span class="chg na">—</span>';
  const r = Math.round(ch * 10) / 10;
  if (Math.abs(r) < 0.05) return '<span class="chg flat">● ثابت</span>';
  const up = r > 0;
  const good = opts.goodWhenUp === false ? !up : up;
  const cls = good ? 'chg up' : 'chg down';
  const sym = up ? '▲' : '▼';
  return '<span class="' + cls + '">' + sym + ' <bdi dir="ltr">' + NF.format(Math.abs(r)) + '%</bdi></span>';
}

/* ---------- toasts ---------- */
function toast(msg, opts) {
  opts = opts || {};
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = '<span>' + msg + '</span>';
  let timer;
  if (opts.actionLabel) {
    const b = document.createElement('button');
    b.textContent = opts.actionLabel;
    b.onclick = () => { clearTimeout(timer); t.remove(); if (opts.onAction) opts.onAction(); };
    t.appendChild(b);
  }
  document.getElementById('toasts').appendChild(t);
  timer = setTimeout(() => t.remove(), opts.duration || (opts.actionLabel ? 7000 : 3200));
}

/* ---------- modal ---------- */
function openModal(html, opts) {
  opts = opts || {};
  const root = document.getElementById('modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = '<div class="modal ' + (opts.cls || '') + '">' +
    '<div class="modal-grip"></div>' + html + '</div>';
  wrap.addEventListener('click', e => {
    if (e.target === wrap && !opts.sticky) closeModal();
  });
  root.appendChild(wrap);
  document.body.classList.add('no-scroll');
  if (opts.onMount) opts.onMount(wrap);
  return wrap;
}
function closeModal() {
  const root = document.getElementById('modal-root');
  Array.from(root.children).forEach(c => c.remove());
  document.body.classList.remove('no-scroll');
}

/* confirmation dialog — returns Promise<boolean>; supports double-confirm for permanent deletes */
function confirmDlg(opts) {
  return new Promise(resolve => {
    const danger = opts.danger ? ' btn-danger' : ' btn-pri';
    let armed = false;
    const wrap = openModal(
      '<div class="modal-title">' + esc(opts.title || 'تأكيد') + '</div>' +
      '<div style="font-size:.9rem;line-height:1.7;color:var(--sub)">' + (opts.body || '') + '</div>' +
      '<div class="modal-actions">' +
      '<button class="btn" id="cd-cancel">إلغاء</button>' +
      '<button class="btn' + danger + '" id="cd-ok">' + esc(opts.okText || 'تأكيد') + '</button>' +
      '</div>', { sticky: true, onMount: w => {
        w.querySelector('#cd-cancel').onclick = () => { closeModal(); resolve(false); };
        const ok = w.querySelector('#cd-ok');
        ok.onclick = () => {
          if (opts.requireDouble && !armed) {
            armed = true;
            ok.textContent = opts.doubleText || 'متأكد؟ اضغط مرة أخرى';
            return;
          }
          closeModal(); resolve(true);
        };
      } }
    );
    return wrap;
  });
}

/* formula explainer modal */
function showFormula(title, lines) {
  openModal(
    '<div class="modal-title">' + esc(title) + '</div>' +
    '<div class="formula">' + lines.map(l => '<div>' + l + '</div>').join('') + '</div>' +
    '<div class="modal-actions"><button class="btn btn-pri" onclick="closeModal()">فهمت</button></div>'
  );
}
function fInfo(title, lines) {
  return '<button class="info-i" onclick=\'showFormula(' + JSON.stringify(title) + ',' + JSON.stringify(lines).replace(/'/g, '&#39;') + ')\'>i</button>';
}

/* ---------- image picker (compressed dataURL) ---------- */
function pickImage(cb, maxDim) {
  maxDim = maxDim || 900;
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * sc);
        c.height = Math.round(img.height * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.72));
      };
      img.src = r.result;
    };
    r.readAsDataURL(f);
  };
  inp.click();
}

/* ---------- exports ---------- */
function download(name, content, mime) {
  const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 600);
}

function csvCell(v) {
  v = String(v == null ? '' : v);
  if (/[",\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
  return v;
}
function toCSV(rows) {
  return '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}

/* "Excel" export: HTML table saved as .xls (opens directly in Excel) */
function xlsDoc(title, headers, rows) {
  const th = headers.map(h => '<th>' + esc(h) + '</th>').join('');
  const tr = rows.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('');
  return '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head>' +
    '<body><h3>' + esc(title) + '</h3><table border="1" dir="rtl">' + '<tr>' + th + '</tr>' + tr + '</table></body></html>';
}

/* PDF via print dialog (user chooses "Save as PDF") */
function printHTML(title, bodyHtml) {
  const w = window.open('', '_blank');
  if (!w) { toast('المتصفح منع فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة', { duration: 5000 }); return; }
  w.document.write(
    '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
    '<style>' +
    'body{font-family:"Segoe UI",Tahoma,sans-serif;color:#111;padding:18px;font-size:12px}' +
    'h1{font-size:19px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 8px;color:#1d4ed8}' +
    'table{width:100%;border-collapse:collapse;margin:8px 0}' +
    'th,td{border:1px solid #ccc;padding:6px 8px;text-align:right;font-size:11px}' +
    'th{background:#eef2ff}.pos{color:#16a34a}.neg{color:#dc2626}.res{color:#b45309}' +
    '.meta{color:#666;font-size:11px;margin-bottom:10px}' +
    '.cards{display:flex;gap:8px;flex-wrap:wrap}.c{border:1px solid #ddd;border-radius:8px;padding:8px 12px;min-width:120px}' +
    '.c .k{font-size:10px;color:#666}.c .v{font-size:15px;font-weight:800}' +
    '</style></head><body>' + bodyHtml + '</body></html>'
  );
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 400);
}

/* small helpers for building selects */
function options(list, selected) {
  return list.map(o => {
    const v = o.v !== undefined ? o.v : o;
    const l = o.l !== undefined ? o.l : o;
    return '<option value="' + esc(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + '>' + esc(l) + '</option>';
  }).join('');
}
function field(label, inner, cls) {
  return '<div class="field' + (cls ? ' ' + cls : '') + '"><label>' + label + '</label>' + inner + '</div>';
}
function numInput(name, val, placeholder, lg) {
  return '<input class="input' + (lg ? ' input-lg' : '') + '" type="number" step="any" inputmode="decimal" data-f="' + name + '" value="' + esc(val == null ? '' : val) + '" placeholder="' + esc(placeholder || '') + '">';
}
function txtInput(name, val, placeholder) {
  return '<input class="input" type="text" data-f="' + name + '" value="' + esc(val || '') + '" placeholder="' + esc(placeholder || '') + '">';
}
function dateInput(name, val) {
  return '<input class="input" type="date" data-f="' + name + '" value="' + esc(val || '') + '">';
}
function vBtn(store, id) {
  return '<button class="btn btn-sm" data-act="view-rec" data-store="' + store + '" data-id="' + id + '" title="سجل التعديلات">🕘</button>';
}
function eBtn(fn) {
  return '<button class="btn btn-sm" data-act="' + fn + '">✏️</button>';
}
function dBtn(fn, id) {
  return '<button class="btn btn-sm btn-danger" data-act="' + fn + '" data-id="' + id + '">🗑️</button>';
}
