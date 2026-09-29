(function () {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const byId = Object.fromEntries(MUSCLES.map(m => [m.id, m]));
const nameOf = m => m.short || m.ru;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- storage (per-viewer progress) ----------
const KEY = "muscle-trainer-v1";
let S = { stats: {}, box: {}, group: "all", mode: "atlas" };
try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
function record(id, ok) {
  const s = S.stats[id] || (S.stats[id] = { n: 0, ok: 0, streak: 0 });
  s.n++; if (ok) { s.ok++; s.streak++; } else s.streak = 0;
  save();
}
const acc = id => { const s = S.stats[id]; return s ? (s.ok + 1) / (s.n + 2) : 0.5; };
function mastery(id) { // 0..4
  const s = S.stats[id]; const b = (S.box[id] || {}).b || 0;
  if (!s && !b) return 0;
  const a = s ? s.ok / Math.max(1, s.n) : 0;
  let lv = 0; if (s && s.n >= 1) lv = 1; if (s && s.n >= 3 && a >= .6) lv = 2; if (s && s.n >= 5 && a >= .8) lv = 3;
  return Math.max(lv, Math.min(4, b - 1));
}
function weightedPick(list) { // weak muscles come up more often
  const w = list.map(m => 1 + 3 * (1 - acc(m.id)));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}
const pool = () => S.group === "all" ? MUSCLES : MUSCLES.filter(m => m.g === S.group);

// ---------- text helpers ----------
const ABBR_RE = new RegExp("(^|[^А-Яа-яЁё])(" + Object.keys(GLOSSARY).join("|") + ")(?=[^А-Яа-яЁё]|$)", "g");
const abbr = s => esc(s).replace(ABBR_RE, (m, p, a) => `${p}<abbr title="${GLOSSARY[a]}">${a}</abbr>`);
function norm(s) {
  return s.toLowerCase().replace(/ё/g, "е")
    .replace(/[тt](?=\s?\d)/g, "t").replace(/[сc](?=\s?\d)/g, "c").replace(/[лl](?=\s?\d)/g, "l")
    .replace(/(\b[tcl])\s(\d)/g, "$1$2").replace(/[^a-zа-я0-9]+/g, " ").trim();
}
function parseKey(k) { const [label, alts] = k.split("="); return { label, alts: (alts || label).split("|").map(norm) }; }
function checkKeys(answer, keys) {
  const a = " " + norm(answer) + " ";
  const res = keys.map(parseKey).map(k => ({ label: k.label, hit: k.alts.some(x => x && a.includes(x)) }));
  const hits = res.filter(r => r.hit).length;
  return { res, hits, total: res.length, ok: hits >= Math.ceil(res.length * 0.6) };
}

// ---------- images ----------
function schematic(kind) {
  // Posterior view of three vertebrae; highlights the small segmental muscles
  const V = [30, 110, 190], hl = kind;
  let s = `<svg viewBox="0 0 320 300" role="img" aria-label="Схема: вид сзади на три позвонка" xmlns="http://www.w3.org/2000/svg">`;
  s += `<rect width="320" height="300" fill="#FFFFFF"/>`;
  V.forEach(y => {
    s += `<path d="M120 ${y} h80 l8 22 h-96 z" fill="#E9DFC8" stroke="#8A7E66" stroke-width="1.5"/>`;
    s += `<rect x="52" y="${y + 18}" width="70" height="16" rx="7" fill="#E9DFC8" stroke="#8A7E66" stroke-width="1.5"/>`;
    s += `<rect x="198" y="${y + 18}" width="70" height="16" rx="7" fill="#E9DFC8" stroke="#8A7E66" stroke-width="1.5"/>`;
    s += `<path d="M146 ${y + 20} h28 l-4 40 q-10 8 -20 0 z" fill="#E9DFC8" stroke="#8A7E66" stroke-width="1.5"/>`;
  });
  for (let i = 0; i < 2; i++) {
    const y1 = V[i] + 58, y2 = V[i + 1] + 4;
    const on = "#C0392F", off = "#E6B7B2";
    const cI = hl === "interspinales" ? on : off, cT = hl === "intertransversarii" ? on : off;
    s += `<rect x="151" y="${y1}" width="18" height="${y2 - y1 + 18}" rx="4" fill="${cI}" opacity=".92"/>`;
    const ty1 = V[i] + 34, ty2 = V[i + 1] + 18;
    s += `<rect x="70" y="${ty1}" width="16" height="${ty2 - ty1}" rx="4" fill="${cT}" opacity=".92"/>`;
    s += `<rect x="234" y="${ty1}" width="16" height="${ty2 - ty1}" rx="4" fill="${cT}" opacity=".92"/>`;
  }
  s += `<text x="12" y="290" font-size="11" fill="#6b6f7a" font-family="Golos Text, sans-serif">вид сзади · схема</text></svg>`;
  return s;
}
const imgHTML = (im, alt) => im.svg ? schematic(im.svg) : `<img src="${im.src}" alt="${esc(alt)}" loading="lazy">`;
const firstImg = m => imgHTML(m.img[0], m.ru);
const quizImgs = m => m.img.filter(i => i.quiz !== false);

// ---------- shell ----------
const MODES = [
  ["atlas", "Атлас"], ["quiz", "Тест"], ["typed", "Вписать ответ"], ["cards", "Карточки"], ["asana", "Асаны"], ["stats", "Прогресс"]
];
const view = $("#view");
function renderTabs() {
  $("#tabs").innerHTML = MODES.map(([id, t]) => `<button class="tab" role="tab" data-mode="${id}" aria-selected="${S.mode === id}">${t}</button>`).join("");
}
function renderFilters() {
  const chips = [["all", "Все мышцы"]].concat(GROUPS.map(g => [g.id, g.name]));
  $("#filters").innerHTML = `<span class="lbl">Раздел</span>` + chips.map(([id, t]) => `<button class="chip" data-group="${id}" aria-pressed="${S.group === id}">${t}</button>`).join("");
}
$("#tabs").addEventListener("click", e => { const b = e.target.closest("[data-mode]"); if (b) go(b.dataset.mode); });
$("#filters").addEventListener("click", e => {
  const b = e.target.closest("[data-group]"); if (!b) return;
  S.group = b.dataset.group; save(); renderFilters(); go(S.mode, true);
});
let keyHandler = null;
document.addEventListener("keydown", e => {
  if (e.target.matches("textarea, input")) return;
  if (keyHandler) keyHandler(e);
});
function go(mode, keepDetail) {
  S.mode = mode; save(); renderTabs(); keyHandler = null;
  $("#filters").hidden = mode === "stats";
  ({ atlas: Atlas, quiz: Quiz, typed: Typed, cards: Cards, asana: Asana, stats: Stats })[mode].start(keepDetail);
  if (!keepDetail) window.scrollTo({ top: 0 });
}
function toast(t) { const d = document.createElement("div"); d.className = "toast"; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1600); }

// ---------- ATLAS (learning) ----------
const Atlas = {
  cur: null, imgI: 0, cover: false,
  start() { this.cur = null; this.grid(); },
  grid() {
    keyHandler = null;
    const list = pool();
    const groups = GROUPS.filter(g => list.some(m => m.g === g.id));
    view.innerHTML = `<div class="intro"><div><h2 style="font-size:24px">Атлас мышц</h2><p>Откройте карточку, чтобы посмотреть начало, прикрепление и функции. Включите режим «Прикрыть ответы», чтобы сначала вспомнить самостоятельно.</p></div>
      <span class="muted" style="font-size:13px">${list.length} карточек</span></div>` +
      groups.map(g => `<div class="eyebrow grp-h">${g.name}</div><div class="grid">` +
        list.filter(m => m.g === g.id).map(m => {
          const lv = mastery(m.id);
          return `<button class="tile" data-open="${m.id}"><div class="ph">${firstImg(m)}</div><div class="tx"><span class="nm">${esc(nameOf(m))}</span><span class="lt lat">${esc(m.lat)}</span><span class="mdot" title="Освоение: ${lv} из 4">${[1, 2, 3, 4].map(i => `<i class="${i <= lv ? "on" : ""}"></i>`).join("")}</span></div></button>`;
        }).join("") + `</div>`).join("");
    view.onclick = e => { const b = e.target.closest("[data-open]"); if (b) this.open(b.dataset.open); };
  },
  open(id) {
    this.cur = id; this.imgI = 0; this.draw(); window.scrollTo({ top: 0 });
  },
  draw() {
    const list = pool(); const i = list.findIndex(m => m.id === this.cur); const m = byId[this.cur];
    const im = m.img[this.imgI];
    const cr = im.cr ? CREDITS[im.cr] : null;
    const used = new Set(); const txt = [m.origin.t, m.insertion.t, ...m.functions.map(f => f.t), ...m.notes].join(" ");
    Object.keys(GLOSSARY).forEach(a => { if (new RegExp("(^|[^А-Яа-яЁё])" + a + "([^А-Яа-яЁё]|$)").test(txt)) used.add(a); });
    view.innerHTML = `<div class="navrow"><button class="btn ghost" data-act="back">← Все мышцы</button>
      <div class="row"><label class="row" style="gap:6px;font-size:14px;cursor:pointer"><input type="checkbox" id="cover" ${this.cover ? "checked" : ""}> Прикрыть ответы</label>
      <button class="btn" data-act="prev" ${i <= 0 ? "disabled" : ""} aria-label="Предыдущая">←</button><span class="muted" style="font-size:13px">${i + 1} / ${list.length}</span><button class="btn" data-act="next" ${i >= list.length - 1 ? "disabled" : ""} aria-label="Следующая">→</button></div></div>
      <div class="detail">
        <div class="figure"><div class="main">${imgHTML(im, m.ru)}</div>
          ${m.img.length > 1 ? `<div class="thumbs">${m.img.map((x, k) => `<button data-img="${k}" aria-pressed="${k === this.imgI}" title="${esc(x.cap || "")}">${imgHTML(x, "")}</button>`).join("")}</div>` : ""}
          <div class="cap"><span>${esc(im.cap || "")}</span>${cr ? `<a href="${cr.url}" target="_blank" rel="noopener">${esc(cr.lic)} · Wikimedia Commons</a>` : ""}</div></div>
        <div class="card ${this.cover ? "cover" : ""}">
          <div class="eyebrow">${GROUPS.find(g => g.id === m.g).name}</div>
          <h2 style="margin-top:6px">${esc(m.ru)}</h2><div class="lat">${esc(m.lat)}</div>
          <div class="fields">
            <div class="field f-origin"><div class="eyebrow">Начало</div><div class="val"><div>${abbr(m.origin.t)}</div></div></div>
            <div class="field f-insertion"><div class="eyebrow">Прикрепление</div><div class="val"><div>${abbr(m.insertion.t)}</div></div></div>
            <div class="field f-functions"><div class="eyebrow">Функции</div><div class="val"><ul>${m.functions.map(f => `<li>${abbr(f.t)}</li>`).join("")}</ul></div></div>
            ${m.notes.length ? `<div class="field f-notes"><div class="eyebrow">Важно</div><div class="val"><ul>${m.notes.map(n => `<li>${abbr(n)}</li>`).join("")}</ul></div></div>` : ""}
          </div>
          ${used.size ? `<div class="gloss">${[...used].map(a => `<span><b>${a}</b> — ${GLOSSARY[a]}</span>`).join("")}</div>` : ""}
          <div class="row" style="margin-top:18px"><button class="btn primary" data-act="drill">Проверить себя по этой мышце</button></div>
        </div></div>`;
    view.onclick = e => {
      const v = e.target.closest(".cover .val"); if (v) { v.classList.add("open"); return; }
      const t = e.target.closest("[data-img]"); if (t) { this.imgI = +t.dataset.img; this.draw(); return; }
      const b = e.target.closest("[data-act]"); if (!b) return;
      const a = b.dataset.act;
      if (a === "back") this.grid();
      if (a === "prev" && i > 0) this.open(list[i - 1].id);
      if (a === "next" && i < list.length - 1) this.open(list[i + 1].id);
      if (a === "drill") { Typed.forced = m.id; go("typed"); }
    };
    $("#cover").onchange = e => { this.cover = e.target.checked; this.draw(); };
    keyHandler = e => {
      if (e.key === "ArrowLeft" && i > 0) this.open(list[i - 1].id);
      if (e.key === "ArrowRight" && i < list.length - 1) this.open(list[i + 1].id);
      if (e.key === "Escape") this.grid();
    };
  }
};

// ---------- QUIZ (multiple choice) ----------
const QTYPES = [
  ["origin", "Начало"], ["insertion", "Прикрепление"], ["function", "Функции"], ["image", "По картинке"], ["reverse", "Обратные вопросы"]
];
const Quiz = {
  types: new Set(["origin", "insertion", "function", "image", "reverse"]), len: 10,
  start() { this.setup(); },
  setup() {
    keyHandler = null;
    view.innerHTML = `<div class="qwrap"><div class="panel settings">
      <div><h2 style="font-size:22px">Тест с вариантами ответа</h2><p class="muted" style="margin:6px 0 0">Вопросы подбираются так, чтобы чаще попадались мышцы, в которых вы ошибаетесь. Есть подсказка и «50 на 50».</p></div>
      <div class="row"><span class="lbl">Типы вопросов</span>${QTYPES.map(([id, t]) => `<button class="chip" data-t="${id}" aria-pressed="${this.types.has(id)}">${t}</button>`).join("")}</div>
      <div class="row"><span class="lbl">Вопросов</span>${[10, 20, 30].map(n => `<button class="chip" data-n="${n}" aria-pressed="${this.len === n}">${n}</button>`).join("")}</div>
      <div class="row"><button class="btn primary" data-act="go">Начать тест</button><span class="muted" style="font-size:13px">Раздел: ${S.group === "all" ? "все мышцы" : GROUPS.find(g => g.id === S.group).name.toLowerCase()}</span></div>
    </div></div>`;
    view.onclick = e => {
      const t = e.target.closest("[data-t]"); if (t) { const k = t.dataset.t; if (this.types.has(k) && this.types.size > 1) this.types.delete(k); else this.types.add(k); this.setup(); return; }
      const n = e.target.closest("[data-n]"); if (n) { this.len = +n.dataset.n; this.setup(); return; }
      if (e.target.closest('[data-act="go"]')) this.begin();
    };
  },
  begin() { this.i = 0; this.score = 0; this.wrong = []; this.last = []; this.next(); },
  make() {
    const P = pool(); const all = MUSCLES;
    for (let tries = 0; tries < 40; tries++) {
      const type = pick([...this.types]);
      let m = weightedPick(P);
      if (this.last.includes(m.id) && P.length > 3) continue;
      const others = shuffle(all.filter(x => x.id !== m.id));
      if (type === "origin" || type === "insertion") {
        const correct = m[type].t;
        const d = uniq(others.map(x => x[type].t).filter(t => t !== correct)).slice(0, 3);
        return { m, type, label: type === "origin" ? "Начало" : "Прикрепление", q: `${type === "origin" ? "Где начинается" : "Куда прикрепляется"}: <b>${esc(m.ru)}</b>?`, opts: shuffle([correct, ...d]), correct, img: m.img[0] };
      }
      if (type === "function") {
        const fs = m.functions.filter(f => f.a.length); if (!fs.length) continue;
        const f = pick(fs); const acts = actKeys(m);
        const pool2 = others.flatMap(x => x.functions.filter(g => g.a.length && !g.a.some(a => acts.has(ak(a)))).map(g => g.t));
        const d = uniq(shuffle(pool2)).filter(t => !m.functions.some(g => g.t === t)).slice(0, 3);
        if (d.length < 3) continue;
        return { m, type, label: "Функция", q: `Какая функция у мышцы <b>${esc(m.ru)}</b>?`, opts: shuffle([f.t, ...d]), correct: f.t, img: m.img[0] };
      }
      if (type === "image") {
        const ims = quizImgs(m); if (!ims.length) continue;
        const nm = x => x.ru;
        const d = uniq(others.map(nm).filter(t => t !== nm(m))).slice(0, 3);
        return { m, type, label: "По картинке", q: `Какая мышца выделена на изображении?`, opts: shuffle([nm(m), ...d]), correct: nm(m), img: pick(ims), big: true };
      }
      if (type === "reverse") {
        const field = pick(["origin", "insertion", "function"]);
        let clue, d;
        if (field === "function") {
          const fs = m.functions.filter(f => f.a.length); if (!fs.length) continue;
          const f = pick(fs); clue = f.t; const keys = new Set(f.a.map(ak));
          d = others.filter(x => ![...keys].some(k => actKeys(x).has(k)));
        } else {
          clue = m[field].t; d = others.filter(x => x[field].t !== clue);
        }
        d = d.filter(x => !sameFamily(x, m));
        if (d.length < 3) continue;
        const verb = field === "origin" ? "начинается" : field === "insertion" ? "прикрепляется" : "выполняет функцию";
        return { m, type, label: "Обратный вопрос", q: `Какая мышца ${verb}:<span class="quote">${abbr(clue)}</span>`, opts: shuffle([m.ru, ...d.slice(0, 3).map(x => x.ru)]), correct: m.ru, img: null };
      }
    }
    return null;
  },
  next() {
    if (this.i >= this.len) return this.finish();
    const q = this.make(); if (!q) { view.innerHTML = `<div class="empty">В этом разделе недостаточно мышц для такого типа вопросов. Выберите другой раздел или типы вопросов.</div>`; return; }
    this.q = q; this.answered = false; this.used5050 = false; this.usedHint = false;
    this.last.push(q.m.id); if (this.last.length > 3) this.last.shift();
    const letters = "1234";
    view.innerHTML = `<div class="qwrap"><div class="progress"><i style="width:${this.i / this.len * 100}%"></i></div>
      <div class="panel"><div class="qhead"><span class="qtype">${q.label}</span><span>Вопрос ${this.i + 1} из ${this.len} · верно ${this.score}</span></div>
      <div class="qbody ${q.img ? (q.big ? "bigimg" : "") : "noimg"}">${q.img ? `<div class="qimg">${imgHTML(q.img, "")}</div>` : ""}
      <div><div class="qtext">${q.q}</div>
      <div class="opts">${q.opts.map((o, k) => `<button class="opt" data-o="${k}"><span class="key">${letters[k]}</span><span>${abbr(o)}</span></button>`).join("")}</div>
      <div id="hint"></div><div id="fb"></div>
      <div class="qfoot"><button class="btn" data-act="hint">Подсказка</button><button class="btn" data-act="5050">50 на 50</button><span class="spacer"></span><button class="btn ghost" data-act="skip">Не знаю</button><button class="btn primary" data-act="next" hidden>Дальше →</button></div>
      </div></div></div></div>`;
    view.onclick = e => {
      const o = e.target.closest("[data-o]"); if (o && !o.disabled) return this.answer(+o.dataset.o);
      const b = e.target.closest("[data-act]"); if (!b) return;
      ({ hint: () => this.hint(), "5050": () => this.fifty(), skip: () => this.answer(-1), next: () => { this.i++; this.next(); } })[b.dataset.act]();
    };
    keyHandler = e => {
      if (!this.answered && /^[1-4]$/.test(e.key)) { const btn = view.querySelector(`[data-o="${+e.key - 1}"]`); if (btn && !btn.disabled) this.answer(+e.key - 1); }
      else if (this.answered && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); this.i++; this.next(); }
    };
  },
  hint() {
    if (this.answered || this.usedHint) return; this.usedHint = true;
    const m = this.q.m; let h;
    if (this.q.type === "reverse" || this.q.type === "image") h = `Раздел: <b>${GROUPS.find(g => g.id === m.g).name}</b>. Латинское название начинается на <span class="lat">${esc(m.lat.split(" ").slice(1).join(" ").slice(0, 4))}…</span>`;
    else if (this.q.type === "function") h = `Вспомните, на какие суставы действует мышца: ${uniq(m.functions.flatMap(f => f.a.map(a => JOINT_FULL[a.j]))).join(", ")}.`;
    else { const k = m[this.q.type].k.map(parseKey).map(x => x.label); h = `В правильном ответе есть: <b>${esc(k[0])}</b>${k[1] ? ` и ещё ${k.length - 1} ключ. ${k.length - 1 === 1 ? "понятие" : "понятия"}` : ""}.`; }
    $("#hint").innerHTML = `<div class="hintbox">${h}</div>`;
  },
  fifty() {
    if (this.answered || this.used5050) return; this.used5050 = true;
    const wrong = shuffle(this.q.opts.map((o, k) => k).filter(k => this.q.opts[k] !== this.q.correct)).slice(0, 2);
    wrong.forEach(k => { const b = view.querySelector(`[data-o="${k}"]`); b.classList.add("gone"); b.disabled = true; });
  },
  answer(k) {
    if (this.answered) return; this.answered = true;
    const q = this.q, ok = k >= 0 && q.opts[k] === q.correct;
    view.querySelectorAll(".opt").forEach((b, j) => { b.disabled = true; if (q.opts[j] === q.correct) b.classList.add("ok"); else if (j === k) b.classList.add("bad"); });
    record(q.m.id, ok);
    if (ok) this.score++; else this.wrong.push(q);
    const m = q.m;
    $("#fb").innerHTML = `<div class="fb ${ok ? "ok" : "bad"}"><b class="t">${ok ? "Верно" : k < 0 ? "Правильный ответ отмечен зелёным" : "Неверно"}</b>
      <b>${esc(m.ru)}</b> <span class="lat">${esc(m.lat)}</span><br>Начало: ${abbr(m.origin.t)}<br>Прикрепление: ${abbr(m.insertion.t)}<br>Функции: ${abbr(m.functions.map(f => f.t).join("; "))}</div>`;
    view.querySelector('[data-act="next"]').hidden = false;
    view.querySelector('[data-act="skip"]').hidden = true;
    view.querySelector('[data-act="next"]').focus();
  },
  finish() {
    keyHandler = null;
    const pct = Math.round(this.score / this.len * 100);
    view.innerHTML = `<div class="qwrap"><div class="panel result"><div class="eyebrow">Результат</div><div class="big">${this.score} / ${this.len}</div>
      <p class="muted">${pct >= 90 ? "Отлично, материал усвоен." : pct >= 70 ? "Хороший результат. Повторите ошибки ниже." : "Стоит повторить эти мышцы в атласе и на карточках."}</p>
      <div class="row" style="justify-content:center"><button class="btn primary" data-act="again">Ещё раз</button><button class="btn" data-act="setup">Настройки теста</button></div>
      ${this.wrong.length ? `<div class="mistakes"><div class="eyebrow" style="border:0;padding:0">Ошибки</div>${this.wrong.map(q => `<div><b>${esc(q.m.ru)}</b> · ${q.label.toLowerCase()}<br><span class="muted">Правильно:</span> ${abbr(q.correct)}</div>`).join("")}</div>` : ""}
    </div></div>`;
    view.onclick = e => { const b = e.target.closest("[data-act]"); if (!b) return; if (b.dataset.act === "again") this.begin(); else this.setup(); };
  }
};
function uniq(a) { return [...new Set(a)]; }
const ak = a => a.j + ":" + a.m;
const actKeys = m => new Set(m.functions.flatMap(f => f.a.map(ak)));
const sameFamily = (a, b) => a.imgName && a.imgName === b.imgName;

// ---------- TYPED (free recall) ----------
const FIELDS = [["origin", "Начало"], ["insertion", "Прикрепление"], ["functions", "Функции"]];
const Typed = {
  forced: null,
  start() { this.next(); },
  keysFor(m, f) { return f === "functions" ? m.fk : m[f].k; },
  next() {
    const P = pool();
    let m = this.forced ? byId[this.forced] : weightedPick(P);
    if (!this.forced && this.cur && P.length > 1) { let g = 0; while (m.id === this.cur && g++ < 10) m = weightedPick(P); }
    this.forced = null; this.cur = m.id; this.checked = false; this.hints = {};
    view.innerHTML = `<div class="qwrap"><div class="panel">
      <div class="qhead"><span class="qtype">Вписать ответ</span><span>Пишите своими словами — проверяются ключевые понятия</span></div>
      <div class="qbody"><div class="qimg">${firstImg(m)}</div>
      <div><div class="eyebrow">${GROUPS.find(g => g.id === m.g).name}</div><h2 style="font-size:22px;margin-top:4px">${esc(m.ru)}</h2><div class="lat">${esc(m.lat)}</div></div></div>
      ${FIELDS.map(([f, t]) => `<div class="tfield" id="tf-${f}"><label for="ta-${f}">${t}<button class="btn ghost hint-mini" data-hint="${f}" type="button">Подсказка</button></label>
        <textarea id="ta-${f}" placeholder="${f === "functions" ? "Например: сгибание в ТБС, …" : "Кость и её часть…"}"></textarea><div class="out"></div></div>`).join("")}
      <div class="qfoot"><button class="btn primary" data-act="check">Проверить</button><span class="muted" style="font-size:12.5px"><span class="kbd">Ctrl</span> + <span class="kbd">Enter</span></span><span class="spacer"></span><button class="btn ghost" data-act="skip">Показать ответ</button></div>
    </div></div>`;
    view.onclick = e => {
      const h = e.target.closest("[data-hint]"); if (h) return this.hint(h.dataset.hint);
      const b = e.target.closest("[data-act]"); if (!b) return;
      const a = b.dataset.act;
      if (a === "check" || a === "skip") this.check(a === "skip");
      if (a === "next") this.next();
      if (a === "override") { const st = S.stats[this.cur]; if (st) { st.ok++; st.streak++; save(); } toast("Засчитано как верно"); b.disabled = true; }
      if (a === "card") { Atlas.cur = this.cur; go("atlas"); Atlas.open(this.cur); }
    };
    view.onkeydown = e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.checked ? this.next() : this.check(false); } };
    $("#ta-origin").focus({ preventScroll: true });
  },
  hint(f) {
    const m = byId[this.cur]; const keys = this.keysFor(m, f).map(parseKey);
    this.hints[f] = (this.hints[f] || 0) + 1;
    const n = this.hints[f];
    const txt = keys.map((k, i) => i < n ? k.label : k.label.slice(0, 1) + "…").join(" · ");
    const out = $(`#tf-${f} .out`);
    out.innerHTML = `<div class="answer" style="background:var(--accent-soft)">Ключевых понятий: ${keys.length}. ${esc(txt)}</div>`;
  },
  check(reveal) {
    if (this.checked) return; this.checked = true;
    const m = byId[this.cur]; let good = 0;
    FIELDS.forEach(([f]) => {
      const val = $(`#ta-${f}`).value; const r = checkKeys(val, this.keysFor(m, f));
      const ok = !reveal && r.ok; if (ok) good++;
      const box = $(`#tf-${f}`); box.classList.add(ok ? "ok" : "bad");
      const full = f === "functions" ? `<ul style="margin:0;padding-left:18px">${m.functions.map(x => `<li>${abbr(x.t)}</li>`).join("")}</ul>` : abbr(m[f].t);
      box.querySelector(".out").innerHTML = `<div class="keys">${r.res.map(k => `<span class="${k.hit && !reveal ? "hit" : ""}">${k.hit && !reveal ? "✓ " : ""}${esc(k.label)}</span>`).join("")}</div><div class="answer">${full}</div>`;
    });
    const ok = good === 3; record(m.id, ok);
    const foot = view.querySelector(".qfoot");
    foot.innerHTML = `<span class="pill ${ok ? "g" : good ? "y" : "r"}">${reveal ? "Ответ показан" : `Засчитано полей: ${good} из 3`}</span>
      ${!ok && !reveal ? `<button class="btn ghost" data-act="override">Я ответила верно</button>` : ""}<span class="spacer"></span>
      <button class="btn" data-act="card">Открыть в атласе</button><button class="btn primary" data-act="next">Следующая мышца →</button>`;
    foot.querySelector('[data-act="next"]').focus({ preventScroll: true });
  }
};

// ---------- FLASHCARDS (Leitner spaced repetition) ----------
const DAY = 864e5, INTERVALS = [0, 0, 1, 3, 7, 14]; // days per box 1..5
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const Cards = {
  start() { this.queue = null; this.home(); },
  due(list) { const t = today(); return list.filter(m => { const b = S.box[m.id]; return !b || b.due <= t; }); },
  home() {
    keyHandler = null;
    const P = pool(); const due = this.due(P);
    const counts = [1, 2, 3, 4, 5].map(b => P.filter(m => ((S.box[m.id] || {}).b || 0) === b).length);
    const fresh = P.filter(m => !S.box[m.id]).length;
    view.innerHTML = `<div class="qwrap"><div class="panel">
      <h2 style="font-size:22px">Карточки с интервальным повторением</h2>
      <p class="muted" style="margin:6px 0 14px">Посмотрите на мышцу, вспомните начало, прикрепление и функции, переверните карточку и честно оцените себя. То, что вы помните, будет возвращаться всё реже (через 1, 3, 7, 14 дней), а трудные мышцы — в этот же день.</p>
      <div class="fc-stats"><div class="stat"><b>${due.length}</b>к повторению сегодня</div><div class="stat"><b>${fresh}</b>новых</div><div class="stat"><b>${counts[4]}</b>выучено</div></div>
      <div class="eyebrow">Коробки</div><div class="boxes">${counts.map((c, i) => `<i title="Коробка ${i + 1}">${i + 1}: ${c}</i>`).join("")}</div>
      <div class="row" style="margin-top:18px">${due.length ? `<button class="btn primary" data-act="go">Начать (${due.length})</button>` : `<span class="pill g">На сегодня всё повторено</span><button class="btn" data-act="all">Повторить всё равно</button>`}</div>
    </div></div>`;
    view.onclick = e => { const b = e.target.closest("[data-act]"); if (!b) return; this.begin(b.dataset.act === "all" ? P : due); };
  },
  begin(list) { this.queue = shuffle(list).sort((a, b) => ((S.box[a.id] || {}).b || 0) - ((S.box[b.id] || {}).b || 0)).map(m => m.id); this.done = 0; this.show(); },
  show() {
    if (!this.queue.length) { toast("Сессия завершена"); return this.home(); }
    const m = byId[this.queue[0]]; this.flipped = false;
    const b = (S.box[m.id] || {}).b || 0;
    view.innerHTML = `<div class="qwrap"><div class="qhead"><span class="qtype">Коробка ${b || "новая"}</span><span>Осталось: ${this.queue.length} · пройдено ${this.done}</span></div>
      <div class="flash" id="flash"><div class="inner">
        <div class="face front" data-act="flip"><div class="qimg">${firstImg(m)}</div><h2>${esc(m.ru)}</h2><div class="lat">${esc(m.lat)}</div>
          <p class="muted" style="margin:6px 0 0">Вспомните начало, прикрепление и функции. Нажмите на карточку или <span class="kbd">пробел</span>, чтобы перевернуть.</p></div>
        <div class="face back"><div class="eyebrow">${esc(m.ru)}</div>
          <div class="fields" style="margin-top:6px">
            <div class="field f-origin"><div class="eyebrow">Начало</div><div class="val">${abbr(m.origin.t)}</div></div>
            <div class="field f-insertion"><div class="eyebrow">Прикрепление</div><div class="val">${abbr(m.insertion.t)}</div></div>
            <div class="field f-functions"><div class="eyebrow">Функции</div><div class="val"><ul>${m.functions.map(f => `<li>${abbr(f.t)}</li>`).join("")}</ul></div></div>
          </div></div>
      </div></div>
      <div class="rate" id="rate" hidden><button class="btn r1" data-r="1">Не помню<small>вернётся сегодня · 1</small></button><button class="btn" data-r="2">С трудом<small>та же коробка · 2</small></button><button class="btn r3" data-r="3">Помню<small>дальше · 3</small></button></div>
      <div class="row" id="flipRow" style="margin-top:14px;justify-content:center"><button class="btn primary" data-act="flip">Перевернуть</button></div>
      <div class="row" style="margin-top:10px;justify-content:center"><button class="btn ghost" data-act="stop">Закончить сессию</button></div></div>`;
    view.onclick = e => {
      const r = e.target.closest("[data-r]"); if (r) return this.rate(+r.dataset.r);
      const a = e.target.closest("[data-act]"); if (!a) return;
      if (a.dataset.act === "flip") this.flip();
      if (a.dataset.act === "stop") this.home();
    };
    keyHandler = e => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!this.flipped) this.flip(); }
      else if (this.flipped && /^[123]$/.test(e.key)) this.rate(+e.key);
    };
  },
  flip() { this.flipped = true; $("#flash").classList.add("flipped"); $("#rate").hidden = false; $("#flipRow").hidden = true; },
  rate(r) {
    const id = this.queue.shift(); const cur = S.box[id] || { b: 1, due: 0 };
    let b = cur.b || 1;
    if (r === 1) b = 1; else if (r === 3) b = Math.min(5, b + 1);
    S.box[id] = { b, due: today() + INTERVALS[b] * DAY };
    record(id, r === 3);
    if (r === 1) this.queue.splice(Math.min(this.queue.length, 3), 0, id);
    else this.done++;
    save(); this.show();
  }
};

// ---------- ASANA (shortened / stretched) ----------
const OPP = { "сгибание": "разгибание", "отведение": "приведение", "наружная ротация": "внутренняя ротация", "горизонтальное приведение": "горизонтальное отведение", "антеверсия": "ретроверсия", "подъём": "опускание", "супинация": "пронация" };
Object.entries(OPP).forEach(([a, b]) => OPP[b] = a);
const JOINT_FULL = { "ТБС": "тазобедренный сустав", "КС": "коленный сустав", "ПС": "плечевой сустав", "ЛС": "локтевой сустав", "таз": "таз", "лопатка": "лопатка", "предплечье": "предплечье", "ПОП": "поясничный отдел", "ШОП": "шейный отдел", "позвоночник": "позвоночник" };
const JOINT_SUFFIX = { "ТБС": "в тазобедренном суставе (ТБС)", "КС": "в коленном суставе", "ПС": "в плечевом суставе", "ЛС": "в локтевом суставе", "таз": "таза", "лопатка": "лопаток", "предплечье": "предплечья", "ПОП": "в поясничном отделе (ПОП)", "ШОП": "в шейном отделе (ШОП)", "позвоночник": "позвоночника" };
function posText(j, mv, side) {
  let m = mv;
  if (j === "лопатка" && mv === "приведение") m = "приведение (ретракция)";
  if (j === "лопатка" && mv === "отведение") m = "отведение (протракция)";
  if (j === "КС" && /ротация/.test(mv)) return `${cap(mv)} голени (колено согнуто)`;
  return `${cap(m)} ${JOINT_SUFFIX[j]}${side ? (side === "L" ? " влево" : " вправо") : ""}`;
}
const Asana = {
  start() { this.n = 0; this.ok = 0; this.next(); },
  make() {
    const P = pool().filter(m => m.functions.some(f => f.a.length));
    const m = weightedPick(P);
    const acts = m.functions.flatMap(f => f.a);
    const a = pick(acts);
    if (a.side) {
      const posSide = pick(["L", "R"]), musSide = pick(["L", "R"]);
      const same = posSide === musSide;
      const short = a.side === "same" ? same : !same;
      return { m, a, pos: posText(a.j, a.m, posSide), who: `${nameOf(m)}${a.part ? ` (${a.part})` : ""} ${musSide === "L" ? "слева" : "справа"}`, short,
        why: `Функция: ${a.m} ${a.side === "same" ? "в свою сторону" : "в противоположную сторону"}. Движение ${posSide === "L" ? "влево" : "вправо"}, мышца ${musSide === "L" ? "слева" : "справа"} — это ${short ? "совпадает с её функцией, значит мышца укорочена" : "противоположно её функции, значит мышца растянута"}.` };
    }
    const same = Math.random() < .5; const mv = same ? a.m : OPP[a.m];
    if (!mv) return this.make();
    return { m, a, pos: posText(a.j, mv), who: `${nameOf(m)}${a.part ? ` (${a.part})` : ""}`, short: same,
      why: `Функция мышцы — ${a.m} ${JOINT_SUFFIX[a.j]}. Положение «${mv}» ${same ? "совпадает с функцией, мышца укорочена" : "противоположно функции, мышца растянута"}.` };
  },
  next() {
    const q = this.make(); this.q = q; this.done = false;
    view.innerHTML = `<div class="qwrap"><div class="panel">
      <div class="qhead"><span class="qtype">Анализ асаны</span><span>Верно ${this.ok} из ${this.n}</span></div>
      <div class="qbody"><div class="qimg">${firstImg(q.m)}</div><div>
        <div class="eyebrow">Положение сустава</div>
        <div class="pos"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 12 L18 7" stroke="var(--muscle)" stroke-width="2.5" stroke-linecap="round"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg><b>${abbr(q.pos)}</b></div>
        <div class="qtext">Что происходит с длиной мышцы: ${esc(q.who)}?</div></div></div>
      <div class="two"><button class="opt" data-s="1">Укорочена <span class="kbd">1</span></button><button class="opt" data-s="0">Растянута <span class="kbd">2</span></button></div>
      <div id="fb"></div>
      <div class="qfoot"><span class="spacer"></span><button class="btn primary" data-act="next" hidden>Дальше →</button></div>
      <details class="help"><summary>Алгоритм анализа асаны из курса</summary><ol class="algo">
        <li>Вспомнить и выписать основные функции мышцы.</li>
        <li>По таблице 1 определить, в каком положении находятся суставы, на которые влияет эта мышца.</li>
        <li>Соотнести функции мышцы и фактическое положение сустава: совпадает с функцией — мышца укорочена, противоположно — растянута.</li>
      </ol><p class="muted" style="margin:8px 0 0">В дипломе анализируется только длина мышцы (укорочена, растянута или в нейтрали), а не напряжение.</p></details>
    </div></div>`;
    view.onclick = e => {
      const o = e.target.closest("[data-s]"); if (o) return this.answer(o.dataset.s === "1");
      if (e.target.closest('[data-act="next"]')) this.next();
    };
    keyHandler = e => {
      if (!this.done && (e.key === "1" || e.key === "2")) this.answer(e.key === "1");
      else if (this.done && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); this.next(); }
    };
  },
  answer(saidShort) {
    if (this.done) return; this.done = true; const q = this.q; const ok = saidShort === q.short;
    this.n++; if (ok) this.ok++; record(q.m.id, ok);
    view.querySelectorAll("[data-s]").forEach(b => { b.disabled = true; const isShort = b.dataset.s === "1"; if (isShort === q.short) b.classList.add("ok"); else if (isShort === saidShort) b.classList.add("bad"); });
    $("#fb").innerHTML = `<div class="fb ${ok ? "ok" : "bad"}"><b class="t">${ok ? "Верно" : "Неверно"}: мышца ${q.short ? "укорочена" : "растянута"}</b>${abbr(q.why)}<br><span class="muted">Все функции: ${abbr(q.m.functions.map(f => f.t).join("; "))}</span></div>`;
    const n = view.querySelector('[data-act="next"]'); n.hidden = false; n.focus();
  }
};

// ---------- STATS ----------
const Stats = {
  start() { this.confirm = false; this.draw(); },
  draw() {
    const rows = MUSCLES.map(m => { const s = S.stats[m.id]; const b = (S.box[m.id] || {}).b || 0; return { m, s, b, a: s ? s.ok / s.n : null }; });
    const tried = rows.filter(r => r.s); const tot = tried.reduce((x, r) => x + r.s.n, 0), okc = tried.reduce((x, r) => x + r.s.ok, 0);
    const weak = tried.filter(r => r.a < .7).sort((a, b) => a.a - b.a).slice(0, 5);
    const pill = r => !r.s ? `<span class="pill n">не начато</span>` : r.a >= .8 && r.s.n >= 3 ? `<span class="pill g">хорошо</span>` : r.a >= .5 ? `<span class="pill y">в процессе</span>` : `<span class="pill r">слабое место</span>`;
    view.innerHTML = `<div class="intro"><div><h2 style="font-size:24px">Прогресс</h2><p>Прогресс сохраняется только в этом браузере на этом устройстве.</p></div>
      <div>${this.confirm ? `<span class="confirm">Сбросить весь прогресс? <button class="btn" data-act="yes">Да, сбросить</button><button class="btn ghost" data-act="no">Отмена</button></span>` : `<button class="btn ghost" data-act="reset">Сбросить прогресс</button>`}</div></div>
      <div class="fc-stats"><div class="stat"><b>${tried.length} / ${MUSCLES.length}</b>мышц начато</div><div class="stat"><b>${tot}</b>ответов</div><div class="stat"><b>${tot ? Math.round(okc / tot * 100) : 0}%</b>верных</div><div class="stat"><b>${rows.filter(r => r.b >= 5).length}</b>выучено на карточках</div></div>
      ${weak.length ? `<div class="panel" style="margin-bottom:14px"><div class="eyebrow">Что повторить в первую очередь</div><div class="row" style="margin-top:8px">${weak.map(r => `<button class="chip" data-open="${r.m.id}">${esc(nameOf(r.m))} · ${Math.round(r.a * 100)}%</button>`).join("")}</div></div>` : ""}
      <div class="tbl-wrap"><table><thead><tr><th>Мышца</th><th>Статус</th><th>Точность</th><th>Ответов</th><th>Коробка</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><button class="btn ghost" style="padding:2px 6px" data-open="${r.m.id}">${esc(nameOf(r.m))}</button></td><td>${pill(r)}</td><td class="num">${r.s ? `<span class="bar-acc"><i style="width:${Math.round(r.a * 100)}%"></i></span>${Math.round(r.a * 100)}%` : "—"}</td><td class="num">${r.s ? r.s.n : 0}</td><td class="num">${r.b || "—"}</td></tr>`).join("")}
      </tbody></table></div>`;
    view.onclick = e => {
      const o = e.target.closest("[data-open]"); if (o) { go("atlas"); Atlas.open(o.dataset.open); return; }
      const b = e.target.closest("[data-act]"); if (!b) return;
      const a = b.dataset.act;
      if (a === "reset") { this.confirm = true; this.draw(); }
      if (a === "no") { this.confirm = false; this.draw(); }
      if (a === "yes") { S.stats = {}; S.box = {}; save(); this.confirm = false; this.draw(); toast("Прогресс сброшен"); }
    };
  }
};

// ---------- credits ----------
$("#creditsBtn").onclick = () => {
  const box = $("#credits"); box.hidden = !box.hidden;
  if (!box.hidden && !box.innerHTML) {
    box.innerHTML = `<b>Изображения</b> — Wikimedia Commons, свободные лицензии. Часть изображений — кадры 3D-анимаций BodyParts3D/Anatomography, фон приведён к белому.<ul>${Object.values(CREDITS).map(c => `<li><a href="${c.url}" target="_blank" rel="noopener">${esc(c.file)}</a> — ${esc(c.author)}, ${esc(c.lic)}${c.note ? ` (${esc(c.note)})` : ""}</li>`).join("")}</ul>`;
  }
};

renderFilters();
go(MODES.some(x => x[0] === S.mode) ? S.mode : "atlas");
})();
