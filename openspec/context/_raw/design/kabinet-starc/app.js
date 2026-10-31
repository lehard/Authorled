// Макет v2: порядок работы STARC (стартовый экран, навигатор проекта, редактор, карточки,
// рецензирование, драфты, корзина) в дизайн-системе Authorled; справа всегда чат с соавтором.
"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const strip = (h) => { const d = document.createElement("div"); d.innerHTML = h || ""; return d.textContent.replace(/ /g, " "); };
const clone = (o) => JSON.parse(JSON.stringify(o));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const words = (s) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, l) => a + l.toUpperCase());

// Темы и настройки есть в коде, но скрыты на время MVP (решение 2026-10-31)
const FLAGS = { settings: false };
const THEMES = ["light", "sepia", "dark"];
(() => {
  const t = new URLSearchParams(location.search).get("theme");
  if (t === null) return;
  if (!THEMES.includes(t)) throw new Error(`Неизвестная тема в ?theme=: ${t}. Есть: ${THEMES.join(", ")}`);
  document.documentElement.dataset.theme = t;
})();

const ICONS = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  pin: '<path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>',
  clap: '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9M12.4 3.4l3.1 4M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  marker: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  focus: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  align: '<path d="M15 12H3M17 18H3M21 6H3"/>',
  list: '<path d="M3 6h.01M3 12h.01M3 18h.01M8 6h13M8 12h13M8 18h13"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3-3a2 2 0 0 0-2.8 0L6 21"/>',
  type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  drop: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  columns: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/>',
  restore: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  max: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  spark: '<path d="M9.9 15.5a2 2 0 0 0-1.4-1.4l-6.1-1.6a.5.5 0 0 1 0-1l6.1-1.6a2 2 0 0 0 1.4-1.4l1.6-6.1a.5.5 0 0 1 1 0l1.6 6.1a2 2 0 0 0 1.4 1.4l6.1 1.6a.5.5 0 0 1 0 1l-6.1 1.6a2 2 0 0 0-1.4 1.4l-1.6 6.1a.5.5 0 0 1-1 0z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
const ico = (n, cls = "") => {
  if (!ICONS[n]) throw new Error(`Нет иконки «${n}»`);
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
};

// ——— Состояние ———
const S = {
  user: { name: "", email: "" },
  au: { step: "email", email: "", known: false, hasPass: false, err: "", left: 5, wait: 0, show: false },
  route: { r: "auth" },
  projects: clone(DATA.projects),
  ptrash: clone(DATA.projectTrash),
  chats: clone(DATA.chats),
  pid: null,
  ui: { tree: new Set(["chars", "sp", "text"]), navMode: "tree", view: { text: "text", treatment: "text" }, review: false, beats: false, isolate: false, find: null, thread: null, markCol: 0, curScene: null, card: null, binSel: 0, selText: "", lastBlock: null, chatCur: null, chatView: "msgs", typing: false },
};
for (const p of S.projects) for (const bl of p.sp.blocks) bl.id = uid("b");
const P = () => S.projects.find((p) => p.id === S.pid);
const me = () => "Вы";

function toast(t) {
  const d = document.createElement("div");
  d.textContent = t;
  $("#toast").append(d);
  setTimeout(() => d.remove(), 4200);
}

// ——— Маршруты: #auth, #projects, #ptrash, #p/<проект>/<документ> ———
function parseHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h || h === "auth") return { r: "auth" };
  if (h === "projects") return { r: "projects" };
  if (h === "ptrash") return { r: "ptrash" };
  const m = h.match(/^p\/([^/]+)\/(.+)$/);
  if (m) return { r: "project", pid: m[1], doc: m[2] };
  throw new Error(`Неизвестный адрес экрана: #${h}`);
}
const go = (h) => { if (location.hash === h) route(); else location.hash = h; };
const openDoc = (doc) => go(`#p/${S.pid}/${encodeURIComponent(doc)}`);

function route() {
  flushEditor();
  const prev = S.route;
  if (prev.r === "project" && P()) harvest();
  S.route = parseHash();
  closeLayers();
  if (S.route.r === "project") {
    const p = S.projects.find((x) => x.id === S.route.pid);
    if (!p) throw new Error(`Нет истории с id «${S.route.pid}»`);
    if (S.pid !== p.id) { S.pid = p.id; S.ui.navMode = "tree"; S.ui.chatCur = null; S.ui.chatView = "msgs"; S.ui.card = null; S.ui.find = null; S.ui.isolate = false; }
    p.lastDoc = S.route.doc;
    if (!docExists(p, S.route.doc)) throw new Error(`В истории «${p.title}» нет документа «${S.route.doc}»`);
    if (prev.doc !== S.route.doc) { S.ui.thread = null; S.ui.card = null; }
  } else S.pid = null;
  render();
}
addEventListener("hashchange", route);

function docExists(p, d) {
  const [k, id, id2] = d.split(":");
  if (["info", "sp", "title", "synopsis", "treatment", "text", "chars", "locs", "worlds", "trash"].includes(k)) return true;
  if (k === "char") return p.chars.some((x) => x.id === id);
  if (k === "loc") return p.locs.some((x) => x.id === id);
  if (k === "world") return p.worlds.some((x) => x.id === id);
  if (k === "draft") return p.sp.drafts.some((x) => x.id === id);
  if (k === "compare") return [id, id2].every((x) => x === "current" || p.sp.drafts.some((d2) => d2.id === x));
  return false;
}

function render() {
  const r = S.route.r;
  if (r === "auth") { $("#root").innerHTML = authView(); focusAuth(); return; }
  if (r === "projects") { $("#root").innerHTML = shelfView(); return; }
  if (r === "ptrash") { $("#root").innerHTML = ptrashView(); return; }
  renderProject();
}

// ——— Вход и регистрация (из макета v1: код из письма при каждом входе, пароль по желанию) ———
let auTimer = null;
function authView() {
  const a = S.au, who = `<div class="au-who"><span class="av">${esc((a.email[0] || "?").toUpperCase())}</span>${esc(a.email)}<button class="linkbtn" data-act="au-back">Изменить</button></div>`;
  const err = a.err ? `<p class="err">${a.err}</p>` : "";
  const steps = (n) => (a.known ? "" : `<div class="au-steps">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</div>`);
  const pass = (id, ph, ac) => `<div class="au-pass"><input class="field ${a.err ? "bad" : ""}" id="${id}" type="${a.show ? "text" : "password"}" autocomplete="${ac}" placeholder="${ph}" /><button data-act="au-show">${a.show ? "Скрыть" : "Показать"}</button></div>`;
  const card = {
    email: `<h1>Вход в Authorled</h1><p class="lede">Введите почту. Если аккаунта ещё нет, создадим его — пароль не нужен.</p>
      <label class="lbl" for="auemail">Почта</label><input class="field ${a.err ? "bad" : ""}" id="auemail" type="email" autocomplete="email" inputmode="email" placeholder="name@example.com" value="${esc(a.email)}" />${err}
      <button class="au-go" data-act="au-email">Продолжить ${ico("arrow")}</button>`,
    password: `<h1>Пароль</h1>${who}<label class="lbl" for="aupass">Пароль</label>${pass("aupass", "", "current-password")}${err}
      <button class="au-go" data-act="au-pass">Дальше ${ico("arrow")}</button>
      <div class="au-links"><button class="linkbtn" data-act="au-forgot">Забыли пароль?</button><span>Потом — код из письма</span></div>`,
    code: `${steps(1)}<h1>${a.known ? "Код из письма" : "Подтвердите почту"}</h1><p class="lede">Отправили 6 цифр на <b>${esc(a.email)}</b>. Код действует 10 минут.</p>
      <div class="au-code ${a.err ? "bad" : ""}" role="group" aria-label="Код из письма">${[0, 1, 2, 3, 4, 5].map((i) => `<input data-code="${i}" inputmode="numeric" autocomplete="${i ? "off" : "one-time-code"}" maxlength="1" aria-label="Цифра ${i + 1}" />`).join("")}</div>${err}
      <button class="au-go" data-act="au-code" id="aucodego" disabled>${a.known ? "Войти" : "Подтвердить"} ${ico("arrow")}</button>
      <div class="au-links"><span id="auwait">${a.wait ? `Отправить ещё раз через 0:${String(a.wait).padStart(2, "0")}` : `<button class="linkbtn" data-act="au-resend">Отправить ещё раз</button>`}</span><button class="linkbtn" data-act="au-back">Другая почта</button></div>
      <div class="au-note">${ico("clock", "sm")}<span>Письма нет? Проверьте «Спам» и «Промоакции». Отправитель — no-reply@authorled.ru.</span></div>`,
    name: `${steps(2)}<h1>Как вас зовут?</h1><p class="lede">Имя видно на титульной странице и в комментариях.</p>
      <label class="lbl" for="auname">Имя и фамилия</label><input class="field" id="auname" autocomplete="name" placeholder="Например, Анна Северова" />
      <button class="au-go" data-act="au-name">Дальше ${ico("arrow")}</button>`,
    offer: `${steps(3)}<h1>Пароль — по желанию</h1><p class="lede">Код из письма нужен при каждом входе. Пароль добавит вторую защиту: без него войти не сможет даже тот, у кого есть доступ к вашей почте.</p>
      <label class="lbl" for="aunew">Новый пароль</label>${pass("aunew", "Не короче 10 символов", "new-password")}<div class="au-meter" id="aumeter"><i></i><i></i><i></i><i></i></div>${err}
      <button class="au-go" data-act="au-setpass">Сохранить и войти</button><button class="au-alt" data-act="au-skip">Позже</button>`,
    reset: `<h1>Новый пароль</h1>${who}<p class="lede">Почта подтверждена кодом. Задайте новый пароль или войдите без него — тогда пароль будет снят.</p>
      <label class="lbl" for="aunew">Новый пароль</label>${pass("aunew", "Не короче 10 символов", "new-password")}<div class="au-meter" id="aumeter"><i></i><i></i><i></i><i></i></div>${err}
      <button class="au-go" data-act="au-setpass">Сохранить и войти</button><button class="au-alt" data-act="au-skip">Войти без пароля</button>`,
  }[a.step];
  const demo = { email: "В макете <b>author@example.com</b> — аккаунт с паролем, <b>vera@example.com</b> — без пароля, другая почта — новый аккаунт.", code: "В макете подходит любой код, кроме <b>000000</b>.", password: "В макете подходит любой пароль, кроме <b>неверный</b>." }[a.step];
  return `<div class="signin"><div class="auth"><div class="brand"><i></i>Authorled</div><div class="au-card">${card}</div>
    <p class="au-foot">Продолжая, вы принимаете <button class="linkbtn">условия</button> и <button class="linkbtn">политику конфиденциальности</button>. Ваши тексты не используются для обучения моделей.</p>
    ${demo ? `<p class="au-demo">${demo}</p>` : ""}</div></div>`;
}
function focusAuth() { requestAnimationFrame(() => { const f = $(".au-card input"); if (f) f.focus(); }); }
function auGo(step, extra = {}) {
  Object.assign(S.au, { step, err: "", show: false }, extra);
  clearInterval(auTimer);
  if (step === "code") {
    S.au.wait = 60;
    auTimer = setInterval(() => {
      S.au.wait = Math.max(0, S.au.wait - 1);
      const w = $("#auwait");
      if (!w) return clearInterval(auTimer);
      if (!S.au.wait) { clearInterval(auTimer); w.innerHTML = `<button class="linkbtn" data-act="au-resend">Отправить ещё раз</button>`; }
      else w.textContent = `Отправить ещё раз через 0:${String(S.au.wait).padStart(2, "0")}`;
    }, 1000);
  }
  render();
}
function auIn() {
  clearInterval(auTimer);
  S.user.email = S.au.email;
  S.au = { step: "email", email: "", known: false, hasPass: false, err: "", left: 5, wait: 0, show: false };
  go("#projects");
  toast("Вы вошли. Сеанс держится 30 дней на этом устройстве.");
}
const auErr = (t) => { S.au.err = t; render(); focusAuth(); };

// ——— Истории (стартовая страница): только истории и «Создать историю» ———
function shelfView() {
  const ps = S.projects;
  const cards = ps.map((p) => `<div class="pcard" data-act="open-project" data-pid="${p.id}" role="button" tabindex="0">
      <div class="cover ${p.cover ? "art" : ""}"><span>${esc(p.title)}</span><button class="ibtn more" data-act="project-menu" data-pid="${p.id}" aria-label="Действия с историей">${ico("more")}</button></div>
      <div class="meta"><b>${esc(p.title)}</b><small>Полный метр · изменено ${esc(p.updated)}</small>${p.desc ? `<p>${esc(p.desc)}</p>` : ""}</div></div>`).join("");
  return `<div class="shelf">${topbar()}<main>
    <h1>Истории</h1>
    ${ps.length ? `<div class="pgrid">${cards}<button class="pcard new" data-act="new-project"><span class="cover">${ico("plus")}</span><span class="meta"><b>Новая история</b><small>С чистого листа или из файла</small></span></button></div>`
      : `<div class="empty-state"><b>Историй пока нет</b><button class="btn primary" data-act="new-project">${ico("plus")}Создать историю</button></div>`}
    ${S.ptrash.length ? `<div class="shelf-foot"><button class="btn ghost" data-act="go-ptrash">${ico("trash")}Корзина · ${S.ptrash.length}</button></div>` : ""}
  </main></div>`;
}
function topbar() {
  const n = S.user.name || S.user.email || "Автор";
  return `<header class="topbar"><div class="brand"><i></i>Authorled</div><span class="sp"></span>
    <button class="btn ghost" data-act="account-menu"><span class="av">${esc(n[0].toUpperCase())}</span>${esc(n)}</button></header>`;
}
function ptrashView() {
  const rows = S.ptrash.map((t, i) => `<div class="trow"><div class="tt"><b>${esc(t.title)}</b><small>Удалена ${esc(t.when)} · удалится навсегда через ${t.left} дн.</small></div>
    <button class="btn outline" data-act="ptrash-restore" data-i="${i}">${ico("restore")}Восстановить</button>
    <button class="btn ghost" data-act="ptrash-del" data-i="${i}">Удалить навсегда</button></div>`).join("");
  return `<div class="shelf">${topbar()}<main>
    <button class="backlink" data-act="go" data-h="#projects">${ico("left", "sm")}Истории</button>
    <div class="head-row"><h1>Корзина историй</h1><button class="btn outline" data-act="ptrash-empty" ${S.ptrash.length ? "" : "disabled"}>Очистить корзину</button></div>
    ${S.ptrash.length ? `<p class="muted">Удалённые истории хранятся 30 дней, потом удаляются навсегда.</p><div class="trash-list">${rows}</div>` : `<div class="empty-state"><b>Корзина пуста</b>Сюда попадают удалённые истории.</div>`}
  </main></div>`;
}

function blankProject(title) {
  const id = uid("p");
  return {
    id, title, desc: "", cover: false, updated: "только что", lastDoc: "text",
    sp: { name: title, tagline: "", logline: "", show: { title: true, synopsis: true, treatment: true, text: true }, titlePage: { title, genre: "Полнометражный сценарий", author: S.user.name, contacts: S.user.email, place: "" }, synopsis: "", params: {}, drafts: [], blocks: [{ id: uid("b"), t: "sh", h: "" }] },
    chars: [], locs: [], worlds: [], comments: {}, trash: [],
  };
}
function importedBlocks() {
  return [["sh", "ИНТ. КВАРТИРА — НОЧЬ"], ["ac", "Текст из файла: в макете разбор не выполняется, подставлен пример."], ["ch", "Герой"], ["dl", "Это первая реплика из импортированного сценария."]].map(([t, h]) => ({ id: uid("b"), t, h }));
}

// ——— Окно проекта ———
function renderProject() {
  const p = P();
  if (!$("#app") || $("#app").dataset.pid !== p.id) {
    $("#root").innerHTML = `<div class="app" id="app" data-pid="${p.id}"><nav class="nav" id="nav" aria-label="Навигатор проекта"></nav><section class="ws" id="ws"></section><aside class="chat" id="chat" aria-label="Чат с соавтором"></aside></div>`;
    renderChat();
  }
  renderNav();
  renderWs();
  updateChatCtx();
}
const doc = () => S.route.doc;
const kindOf = (d) => d.split(":")[0];
function docTitle(p, d) {
  const [k, id] = d.split(":");
  const f = (arr) => (arr.find((x) => x.id === id) || {}).name;
  return { info: p.title, sp: p.sp.name, title: "Титульная страница", synopsis: "Синопсис", treatment: "Поэпизодник", text: "Сценарий", chars: "Персонажи", locs: "Локации", worlds: "Миры", trash: "Корзина",
    char: f(p.chars), loc: f(p.locs), world: f(p.worlds), draft: `Драфт «${(p.sp.drafts.find((x) => x.id === id) || {}).name}»`, compare: "Сравнение драфтов" }[k];
}

// Навигатор: дерево проекта или сцены сценария (как «второй уровень» в STARC)
function treeNodes(p) {
  const sp = p.sp, kids = [];
  if (sp.show.title) kids.push({ id: "title", icon: "book", label: "Титульная страница" });
  if (sp.show.synopsis) kids.push({ id: "synopsis", icon: "align", label: "Синопсис" });
  if (sp.show.treatment) kids.push({ id: "treatment", icon: "list", label: "Поэпизодник", drill: true });
  if (sp.show.text) kids.push({ id: "text", icon: "file", label: "Сценарий", drill: true, kids: sp.drafts.map((d) => ({ id: "draft:" + d.id, icon: "copy", label: d.name, lock: d.locked, drag: true })) });
  return [
    { id: "info", icon: "home", label: p.title },
    { id: "chars", icon: "users", label: "Персонажи", kids: p.chars.map((c) => ({ id: "char:" + c.id, icon: "user", label: c.name, drag: true })) },
    { id: "locs", icon: "pin", label: "Локации", kids: p.locs.map((c) => ({ id: "loc:" + c.id, icon: "pin", label: c.name, drag: true })) },
    { id: "worlds", icon: "globe", label: "Миры", kids: p.worlds.map((c) => ({ id: "world:" + c.id, icon: "globe", label: c.name, drag: true })) },
    { id: "sp", icon: "clap", label: sp.name, kids },
    { id: "trash", icon: "trash", label: "Корзина", cnt: p.trash.length },
  ];
}
function treeHTML(nodes, depth) {
  return nodes.map((n) => {
    const open = S.ui.tree.has(n.id), has = n.kids && n.kids.length;
    const row = `<div class="ti ${doc() === n.id ? "cur" : ""}" role="treeitem" tabindex="0" data-act="open" data-doc="${n.id}" ${has ? `aria-expanded="${open}"` : ""} ${n.drag ? 'draggable="true"' : ""} style="padding-left:${6 + depth * 18}px">
      <span class="car ${open ? "open" : ""}" ${has ? `data-act="tog" data-node="${n.id}"` : ""}>${has ? ico("right") : ""}</span>${ico(n.icon)}<span class="lab">${esc(n.label || "Без названия")}</span>
      ${n.lock ? ico("lock", "sm lock") : ""}${n.cnt ? `<span class="cnt">${n.cnt}</span>` : ""}${n.drill ? `<span class="drill ibtn" data-act="drill" data-doc="${n.id}" title="Сцены" aria-label="Показать сцены">${ico("right", "sm")}</span>` : ""}</div>`;
    return row + (has && open ? treeHTML(n.kids, depth + 1) : "");
  }).join("");
}
function renderNav() {
  const p = P(), d = doc(), k = kindOf(d);
  const views = ["text", "treatment"].includes(k) ? `<div class="views">${[["text", "align", "Текст"], ["cards", "grid", "Карточки"]].map(([v, i, l]) => `<button class="ibtn ${S.ui.view[k] === v ? "on" : ""}" data-act="view" data-v="${v}" title="${l}" aria-label="${l}">${ico(i)}</button>`).join("")}</div>` : "";
  let body;
  if (S.ui.navMode === "scenes") {
    const which = k === "treatment" ? "treatment" : "text";
    const items = scenesOf(p.sp.blocks);
    body = `<div class="scn-head"><button data-act="undrill">${ico("left", "sm")}${which === "treatment" ? "Поэпизодник" : "Сценарий"}</button><span>| ${esc(p.sp.name)}</span></div><div role="list">${items.map((s) => {
      if (s.kind !== "scene") return `<div class="act-row" data-drop="${s.id}" data-dk="act">${esc(s.name || (s.kind === "act" ? "Акт" : "Группа"))}</div>`;
      const prm = p.sp.params[s.id] || {};
      return `<button class="scn ${S.ui.curScene === s.id ? "cur" : ""}" data-act="goscene" data-sc="${s.id}" draggable="true" data-drop="${s.id}" data-dk="scene" role="listitem">
        ${prm.color != null ? `<i class="stripe" style="background:var(${MARK_COLORS[prm.color]})"></i>` : ""}
        <div class="l1"><span>${s.num}. ${esc(prm.alt || s.head || "Без заголовка")}</span><time>${dur(s.chars)}</time></div>
        ${which === "treatment" ? s.beats.map((bt) => `<div class="bt">${esc(bt.text)}</div>`).join("") : `<div class="l2">${esc(s.text || "—")}</div>`}</button>`;
    }).join("")}</div>`;
  } else body = `<div role="tree">${treeHTML(treeNodes(p), 0)}</div>`;
  $("#nav").innerHTML = `<button class="nav-cover" data-act="open" data-doc="info"><span class="mini ${p.cover ? "art" : ""}"></span><span><b>${esc(p.title)}</b><small>полный метр</small></span></button><div class="nav-top"><button class="ibtn" data-act="main-menu" aria-label="Главное меню">${ico("menu")}</button>${views}<span class="sp"></span>
    <button class="ibtn" data-act="nav-menu" aria-label="Действия">${ico("more")}</button></div>
    <div class="tree" id="tree">${body}</div>
    <button class="nav-add" data-act="add-doc">${ico("plus")}Добавить документ</button>`;
}

// Сцены из блоков: сцена — от заголовка до следующего заголовка, группы или акта
function scenesOf(blocks) {
  const out = [];
  let cur = null, n = 0;
  blocks.forEach((bl, i) => {
    const t = strip(bl.h).trim();
    if (bl.t === "act" || bl.t === "seq") { cur = null; out.push({ kind: bl.t, id: bl.id, name: t, i }); return; }
    if (bl.t === "sh") { n += 1; cur = { kind: "scene", id: bl.id, num: n, head: t, i, end: i + 1, text: "", beats: [], chars: t.length }; out.push(cur); return; }
    if (!cur) return;
    cur.end = i + 1;
    if (bl.t === "beat") cur.beats.push({ id: bl.id, text: t });
    else { if (!cur.text) cur.text = t; cur.chars += t.length; }
  });
  return out;
}
const dur = (chars) => { const s = Math.max(5, Math.round(chars / 12)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
function moveScene(id, target) {
  const bl = P().sp.blocks, sc = scenesOf(bl).find((s) => s.id === id);
  const chunk = bl.splice(sc.i, sc.end - sc.i);
  let idx = bl.length;
  if (target) {
    idx = bl.findIndex((x) => x.id === target.id);
    if (idx < 0) throw new Error(`Нет блока ${target.id} для перестановки сцены`);
    if (target.kind === "act") idx += 1;
  }
  bl.splice(idx, 0, ...chunk);
}

// ——— Рабочее поле ———
function renderWs() {
  const p = P(), d = doc(), [k, id, id2] = d.split(":");
  closeAc();
  let tb = "", inner = "", after = null;
  const mob = `<div class="ws-mob"><button class="ibtn" data-act="nav-open" aria-label="Навигатор">${ico("menu")}</button><b>${esc(docTitle(p, d))}</b></div>`;
  if (k === "text" || k === "treatment") {
    if (S.ui.view[k] === "cards") { tb = cardsBar(); inner = cardsHTML(k); }
    else { tb = edBar(k); inner = `<div class="page script"><div id="edmount"></div></div>`; after = () => mountEditor(k, p.sp.blocks, true); }
  } else if (k === "synopsis") { tb = edBar("prose"); inner = `<div class="page prose"><div id="edmount"></div></div>`; after = () => mountEditor("prose", proseBlocks(p.sp.synopsis), true); }
  else if (k === "draft") {
    const dr = p.sp.drafts.find((x) => x.id === id);
    tb = edBar("draft", dr.locked);
    inner = `<div class="banner">${ico(dr.locked ? "lock" : "copy")}<span>Драфт <b>«${esc(dr.name)}»</b> · создан ${esc(dr.created)}${dr.locked ? " · правка запрещена" : ""}</span><span class="sp"></span>
      <button class="btn outline" data-act="compare-with" data-a="current" data-b="${dr.id}">${ico("columns")}Сравнить с текущим</button>
      <button class="btn ghost" data-act="draft-lock" data-id="${dr.id}">${dr.locked ? "Разрешить правку" : "Запретить правку"}</button></div>
      <div class="page script"><div id="edmount"></div></div>`;
    after = () => mountEditor("draft", dr.blocks, !dr.locked, dr.id);
  } else if (k === "compare") inner = compareHTML(p, id, id2);
  else if (k === "title") inner = titleHTML(p);
  else if (k === "info") inner = infoHTML(p);
  else if (k === "sp") inner = spHTML(p);
  else if (["chars", "locs", "worlds"].includes(k)) inner = groupHTML(p, k);
  else if (["char", "loc", "world"].includes(k)) inner = entityHTML(p, k, id);
  else if (k === "trash") inner = binHTML(p);
  $("#ws").innerHTML = `${mob}${tb}<div class="ws-scroll" id="wscroll"><div class="ws-inner" id="wsin">${inner}</div></div>${S.ui.card && k !== "compare" ? sheetHTML(p) : ""}`;
  if (!tb) $("#wsin").style.paddingTop = "32px";
  if (after) after();
  if (S.ui.find) renderFind();
}

function saveSt() { return `<span class="save-st" data-save>Сохранено</span>`; }
let saveT = null;
function dirty() {
  $$("[data-save]").forEach((x) => (x.textContent = "Сохраняю…"));
  clearTimeout(saveT);
  saveT = setTimeout(() => $$("[data-save]").forEach((x) => (x.textContent = "Сохранено")), 700);
  const p = P();
  if (p) p.updated = "только что";
}
function edBar(mode, locked = false) {
  const p = P(), editable = !locked;
  const types = mode === "treatment" ? [...OUTLINE] : Object.keys(TYPES);
  const typeSel = mode !== "prose" && editable ? `<span class="ibtn" aria-hidden="true">${ico("type")}</span><select id="tsel" aria-label="Тип абзаца">${types.map((t) => `<option value="${t}">${TYPES[t].label}</option>`).join("")}</select><span class="sep"></span>` : "";
  const n = Object.values(p.comments).filter((c) => !c.resolved).length;
  return `<div class="tbar" role="toolbar" aria-label="Инструменты текста">
    <button class="ibtn" data-act="undo" title="Отменить (⌘Z)" aria-label="Отменить">${ico("undo")}</button><button class="ibtn" data-act="redo" title="Повторить (⇧⌘Z)" aria-label="Повторить">${ico("redo")}</button><span class="sep"></span>
    ${typeSel}
    ${mode === "text" ? `<button class="ibtn ${S.ui.beats ? "on" : ""}" data-act="beats" title="Показать биты" aria-label="Показать биты" aria-pressed="${S.ui.beats}">${ico("layers")}</button>` : ""}
    <button class="ibtn ${S.ui.find ? "on" : ""}" data-act="find" title="Найти и заменить (⌘F)" aria-label="Найти">${ico("search")}</button>
    ${editable ? `<button class="ibtn ${S.ui.review ? "on" : ""}" data-act="review" title="Режим рецензирования" aria-label="Режим рецензирования" aria-pressed="${S.ui.review}">${ico("marker")}</button>` : ""}
    ${mode === "text" || mode === "treatment" ? `<button class="ibtn ${S.ui.isolate ? "on" : ""}" data-act="isolate" title="Только текущая сцена" aria-label="Только текущая сцена" aria-pressed="${S.ui.isolate}">${ico("focus")}</button>` : ""}
    <span class="sep"></span><button class="cbtn" data-act="clist" title="Комментарии">${ico("msg", "sm")}<b>${n}</b></button>${saveSt()}</div>`;
}
function cardsBar() {
  return `<div class="tbar" role="toolbar" aria-label="Инструменты карточек"><button class="cbtn" data-act="card-add" data-t="sh">${ico("plus", "sm")}Сцена</button><button class="cbtn" data-act="card-add" data-t="act">${ico("plus", "sm")}Акт</button><span class="sep"></span>${saveSt()}</div>`;
}

// ——— Редактор ———
const proseBlocks = (html) => {
  const d = document.createElement("div");
  d.innerHTML = html || "";
  const ps = [...d.children].map((x) => ({ id: uid("b"), t: "pr", h: x.innerHTML }));
  return ps.length ? ps : [{ id: uid("b"), t: "pr", h: "" }];
};
const labelOf = (t) => (t === "pr" ? "Начните синопсис" : TYPES[t].label);
function blockHTML(bl) {
  const empty = !strip(bl.h).trim();
  return `<p class="b b-${bl.t}${empty ? " empty" : ""}" data-t="${bl.t}" data-id="${bl.id}" data-label="${labelOf(bl.t)}">${bl.h || "<br>"}</p>`;
}
let UNDO = { stack: [], i: -1 };
function mountEditor(mode, blocks, editable, draftId = "") {
  const list = mode === "treatment" ? blocks.filter((x) => OUTLINE.has(x.t)) : blocks;
  const cls = mode === "draft" ? "text" : mode;
  $("#edmount").outerHTML = `<div class="ed ${cls}${S.ui.beats || mode !== "text" ? "" : " hide-beats"}" id="ed" data-mode="${mode}" data-draft="${draftId}" contenteditable="${editable}" spellcheck="true" lang="ru" role="textbox" aria-multiline="true" aria-label="${mode === "prose" ? "Синопсис" : "Текст сценария"}">${list.length ? list.map(blockHTML).join("") : blockHTML({ id: uid("b"), t: "sh", h: "" })}</div>`;
  const ed = $("#ed");
  UNDO = { stack: [], i: -1 };
  snap();
  ed.addEventListener("keydown", onEdKey);
  ed.addEventListener("input", onEdInput);
  ed.addEventListener("paste", onPaste);
  if (S.ui.isolate) applyIso();
  if (S.ui.thread) renderThread();
  if (S.ui.curScene && mode !== "prose") {
    const el = ed.querySelector(`[data-id="${S.ui.curScene}"]`);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "center" }));
  }
  if (editable && list.length === 1 && !strip(list[0].h).trim()) requestAnimationFrame(() => { placeCaret(ed.firstElementChild, true); });
}
function cleanHTML(el) {
  const h = el.innerHTML.replace(/<br\s*\/?>$/i, "");
  return strip(h).trim() || /data-c=/.test(h) ? h : "";
}
function flushEditor() {
  const ed = $("#ed"), p = P();
  if (!ed || !p || ed.getAttribute("contenteditable") !== "true") return;
  normalize(ed);
  const paras = $$(".b", ed).map((el) => ({ el, id: el.dataset.id, t: el.dataset.t, h: cleanHTML(el) }));
  const mode = ed.dataset.mode;
  if (mode === "text") p.sp.blocks = paras.map(({ id, t, h }) => ({ id, t, h }));
  else if (mode === "prose") p.sp.synopsis = paras.filter((x) => x.h).map((x) => `<p>${x.h}</p>`).join("");
  else if (mode === "draft") p.sp.drafts.find((x) => x.id === ed.dataset.draft).blocks = paras.map(({ id, t, h }) => ({ id, t, h }));
  else if (mode === "treatment") mergeTreatment(p, paras);
}
// Поэпизодник — проекция того же текста: правим заголовки и биты, остальной текст остаётся на месте
function mergeTreatment(p, paras) {
  const old = p.sp.blocks, byId = new Map(old.map((x) => [x.id, x]));
  const keep = new Set(paras.map((x) => x.id));
  const blocks = old.filter((x) => !OUTLINE.has(x.t) || keep.has(x.id));
  paras.forEach((x, i) => {
    const ex = byId.get(x.id);
    if (ex) { ex.t = x.t; ex.h = x.h; return; }
    const nb = { id: x.id, t: x.t, h: x.h };
    const prev = paras[i - 1];
    if (!prev) { blocks.unshift(nb); return; }
    let at = blocks.findIndex((y) => y.id === prev.id) + 1;
    const stop = nb.t === "beat" ? OUTLINE : new Set(["sh", "act", "seq"]);
    while (at < blocks.length && !stop.has(blocks[at].t)) at += 1;
    blocks.splice(at, 0, nb);
  });
  p.sp.blocks = blocks;
}
// Чужие узлы после удаления и вставки заворачиваем в абзацы
function normalize(ed) {
  const mode = ed.dataset.mode, def = mode === "prose" ? "pr" : mode === "treatment" ? "beat" : "ac";
  [...ed.childNodes].forEach((n) => {
    if (n.nodeType === 1 && n.classList.contains("b")) { if (!n.dataset.id) n.dataset.id = uid("b"); return; }
    if (n.nodeType === 3 && !n.textContent.trim()) { n.remove(); return; }
    const p = document.createElement("p");
    p.className = `b b-${def}`; p.dataset.t = def; p.dataset.id = uid("b"); p.dataset.label = labelOf(def);
    n.replaceWith(p);
    p.append(n.nodeType === 1 ? n.textContent : n);
  });
  if (!ed.querySelector(".b")) ed.innerHTML = blockHTML({ id: uid("b"), t: mode === "prose" ? "pr" : "sh", h: "" });
  // Браузер копирует data-id при разбиении абзаца — дубли получают новый id
  const seen = new Set();
  $$(".b", ed).forEach((x) => { if (seen.has(x.dataset.id)) x.dataset.id = uid("b"); seen.add(x.dataset.id); });
}
const isEmpty = (el) => !el.textContent.replace(/ /g, " ").trim();
function syncEmpty(el) { el.classList.toggle("empty", isEmpty(el)); }
function caretBlock() {
  const s = getSelection();
  if (!s.rangeCount) return null;
  let n = s.anchorNode;
  if (!n) return null;
  if (n.nodeType === 3) n = n.parentNode;
  return n.closest ? n.closest("#ed .b") : null;
}
function caretInfo(el) {
  const s = getSelection(), r = s.getRangeAt(0), pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  return { before: pre.toString().length, total: el.textContent.length, collapsed: r.collapsed };
}
function placeCaret(el, atEnd = true) {
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(!atEnd);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
  el.closest("#ed")?.focus({ preventScroll: true });
}
function setCaretAt(el, off) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n, left = off;
  while ((n = w.nextNode())) {
    if (left <= n.length) { const r = document.createRange(); r.setStart(n, left); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; }
    left -= n.length;
  }
  placeCaret(el, true);
}
function makeBlock(t) {
  const p = document.createElement("p");
  p.className = `b b-${t} empty`; p.dataset.t = t; p.dataset.id = uid("b"); p.dataset.label = labelOf(t); p.innerHTML = "<br>";
  return p;
}
function setType(el, t) {
  el.dataset.t = t;
  el.dataset.label = labelOf(t);
  el.className = `b b-${t}${isEmpty(el) ? " empty" : ""}`;
  const sel = $("#tsel");
  if (sel) sel.value = t;
}
function splitBlock(el, newType) {
  const s = getSelection(), r = s.getRangeAt(0), tail = document.createRange();
  tail.setStart(r.startContainer, r.startOffset);
  tail.setEnd(el, el.childNodes.length);
  const frag = tail.extractContents();
  const nb = makeBlock(newType);
  nb.innerHTML = "";
  nb.append(frag);
  if (isEmpty(nb)) nb.innerHTML = "<br>";
  if (isEmpty(el)) el.innerHTML = "<br>";
  el.after(nb);
  syncEmpty(el); syncEmpty(nb);
  placeCaret(nb, false);
}
function onEdKey(e) {
  const ed = e.currentTarget, mode = ed.dataset.mode;
  if (AC && acKey(e)) return;
  const mod = e.metaKey || e.ctrlKey, key = e.key.toLowerCase();
  if (mod && !e.altKey && (key === "z" || key === "я")) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && (key === "y" || key === "н")) { e.preventDefault(); redo(); return; }
  if (mod && (key === "f" || key === "а")) { e.preventDefault(); openFind(); return; }
  const el = caretBlock();
  if (!el) return;
  if (mode === "prose") {
    if (e.key === "Enter") { e.preventDefault(); splitBlock(el, "pr"); changed(true); }
    if (e.key === "Tab") e.preventDefault();
    return;
  }
  // Типы абзацев — Ctrl+цифра, как в STARC (на Mac Ctrl свободен, ⌘+цифра занята вкладками браузера)
  if (e.ctrlKey && !e.metaKey && !e.altKey) {
    let t = null;
    if (e.code.startsWith("Digit")) t = (e.shiftKey ? SHIFT_HOTKEYS : HOTKEYS)[e.code.slice(5)];
    if (e.code === "Space") t = e.shiftKey ? "act" : "seq";
    if (t) { e.preventDefault(); if (mode !== "treatment" || OUTLINE.has(t)) { setType(el, t); changed(true); } return; }
  }
  const rule = (mode === "treatment" ? TREAT : TYPES)[el.dataset.t];
  if (!rule) throw new Error(`Нет правил Tab/Enter для типа «${el.dataset.t}» в режиме ${mode}`);
  if (e.key === "Enter") {
    e.preventDefault();
    if (e.shiftKey) return;
    const { before, total } = caretInfo(el);
    if (isEmpty(el)) { if (rule.ce !== el.dataset.t) setType(el, rule.ce); else return; }
    else if (before >= total) { const nb = makeBlock(rule.je); el.after(nb); placeCaret(nb, false); }
    else splitBlock(el, el.dataset.t);
    changed(true);
    return;
  }
  if (e.key === "Tab") {
    e.preventDefault();
    if (e.shiftKey) return;
    const { before, total } = caretInfo(el);
    if (isEmpty(el)) setType(el, rule.ct);
    else if (before >= total) { const nb = makeBlock(rule.jt); el.after(nb); placeCaret(nb, false); }
    else return;
    changed(true);
  }
}
function onEdInput() {
  const ed = $("#ed");
  normalize(ed);
  const el = caretBlock();
  if (el) { syncEmpty(el); acUpdate(el); }
  changed(false);
}
function onPaste(e) {
  e.preventDefault();
  const lines = e.clipboardData.getData("text/plain").split(/\r?\n/).filter((x, i, a) => x.trim() || i === 0);
  if (!lines.length) return;
  document.execCommand("insertText", false, lines[0]);
  let el = caretBlock();
  const t = $("#ed").dataset.mode === "prose" ? "pr" : "ac";
  lines.slice(1).forEach((ln) => { const nb = makeBlock(t); nb.textContent = ln; syncEmpty(nb); el.after(nb); el = nb; });
  if (lines.length > 1) placeCaret(el, true);
  changed(true);
}
let snapT = null, navT = null;
function changed(structural) {
  dirty();
  clearTimeout(snapT);
  if (structural) snap(); else snapT = setTimeout(snap, 450);
  clearTimeout(navT);
  navT = setTimeout(() => { if (S.ui.navMode === "scenes") { flushEditor(); renderNav(); } }, 500);
  if (S.ui.find) findRun();
  const el = caretBlock();
  if (el) $("#tsel") && ($("#tsel").value = el.dataset.t);
}
function snap() {
  const ed = $("#ed");
  if (!ed) return;
  const el = caretBlock();
  const st = { html: ed.innerHTML, caret: el ? { id: el.dataset.id, off: caretInfo(el).before } : null };
  if (UNDO.stack[UNDO.i] && UNDO.stack[UNDO.i].html === st.html) { UNDO.stack[UNDO.i] = st; return; }
  UNDO.stack = UNDO.stack.slice(0, UNDO.i + 1);
  UNDO.stack.push(st);
  UNDO.i = UNDO.stack.length - 1;
}
function restore(st) {
  const ed = $("#ed");
  ed.innerHTML = st.html;
  const el = st.caret && ed.querySelector(`[data-id="${st.caret.id}"]`);
  if (el) { ed.focus({ preventScroll: true }); setCaretAt(el, st.caret.off); }
  dirty();
  if (S.ui.isolate) applyIso();
}
function undo() { clearTimeout(snapT); snap(); if (UNDO.i > 0) { UNDO.i -= 1; restore(UNDO.stack[UNDO.i]); } }
function redo() { if (UNDO.i < UNDO.stack.length - 1) { UNDO.i += 1; restore(UNDO.stack[UNDO.i]); } }

// Только текущая сцена (режим изоляции сцены)
function applyIso() {
  const ed = $("#ed");
  if (!ed) return;
  const bs = $$(".b", ed);
  bs.forEach((x) => x.classList.remove("iso-hide"));
  if (!S.ui.isolate) return;
  const el = caretBlock();
  let target = S.ui.curScene;
  if (el) { let i = bs.indexOf(el); while (i >= 0 && bs[i].dataset.t !== "sh") i -= 1; if (i >= 0) target = bs[i].dataset.id; }
  if (!target || !ed.querySelector(`[data-id="${target}"]`)) target = (bs.find((x) => x.dataset.t === "sh") || {}).dataset?.id;
  S.ui.curScene = target;
  let inScene = false;
  bs.forEach((x) => {
    if (["sh", "act", "seq"].includes(x.dataset.t)) inScene = x.dataset.id === target;
    if (!inScene) x.classList.add("iso-hide");
  });
}

// Автодополнение: персонажи, ИНТ./НАТ., локации, время суток
let AC = null;
function acUpdate(el) {
  const t = el.dataset.t, txt = el.textContent.replace(/ /g, " "), p = P();
  const { before, total } = caretInfo(el);
  let items = [], head = "";
  if (before < total) return closeAc();
  if (t === "ch") {
    const q = txt.trim().toUpperCase();
    items = p.chars.map((c) => c.name.toUpperCase()).filter((n) => n.startsWith(q) && n !== q).map((n) => ({ text: n, label: words(n) }));
    head = "Персонажи";
  } else if (t === "sh") {
    const up = txt.toUpperCase(), m = up.match(/^(ИНТ\.\/НАТ\.|ИНТ\.|НАТ\.)\s*(.*)$/);
    if (!m) {
      const q = up.trim();
      items = [["ИНТ.", "в помещении"], ["НАТ.", "на улице"], ["ИНТ./НАТ.", "и там и там"]].filter(([x]) => x.startsWith(q) && x !== q).map(([x, h]) => ({ text: x + " ", label: x, hint: h }));
      head = "Где";
    } else if (!/\s[—-](\s|$)/.test(m[2])) {
      const q = m[2].trim();
      items = p.locs.map((l) => l.name.toUpperCase()).filter((n) => n.startsWith(q) && n !== q).map((n) => ({ text: `${m[1]} ${n} — `, label: words(n) }));
      head = "Локации";
    } else {
      const base = up.replace(/[^—-]*$/, ""), q = up.slice(base.length).trim();
      items = ["ДЕНЬ", "НОЧЬ", "УТРО", "ВЕЧЕР", "РАССВЕТ", "СУМЕРКИ"].filter((x) => x.startsWith(q) && x !== q).map((x) => ({ text: `${base.trimEnd()} ${x}`, label: x }));
      head = "Время";
    }
  }
  if (!items.length) return closeAc();
  AC = { el, items: items.slice(0, 8), i: 0, head };
  drawAc();
}
function drawAc() {
  $(".ac-pop")?.remove();
  const box = relRect(AC.el), pop = document.createElement("div");
  pop.className = "ac-pop";
  pop.setAttribute("role", "listbox");
  pop.innerHTML = `<div class="ah">${AC.head} · Enter или Tab — выбрать</div>${AC.items.map((x, i) => `<button role="option" class="${i === AC.i ? "on" : ""}" data-ac="${i}">${esc(x.label)}${x.hint ? `<small>${x.hint}</small>` : ""}</button>`).join("")}`;
  pop.style.left = `${box.left}px`;
  pop.style.top = `${box.top + box.height + 4}px`;
  pop.addEventListener("mousedown", (e) => { e.preventDefault(); const b2 = e.target.closest("[data-ac]"); if (b2) acPick(Number(b2.dataset.ac)); });
  $("#wsin").append(pop);
}
function acKey(e) {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); AC.i = (AC.i + (e.key === "ArrowDown" ? 1 : -1) + AC.items.length) % AC.items.length; drawAc(); return true; }
  if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); acPick(AC.i); return true; }
  if (e.key === "Escape") { closeAc(); return true; }
  return false;
}
function acPick(i) {
  const { el, items } = AC;
  el.textContent = items[i].text;
  syncEmpty(el);
  placeCaret(el, true);
  closeAc();
  acUpdate(el);
  changed(true);
}
function closeAc() { AC = null; $(".ac-pop")?.remove(); }
function relRect(el) {
  const c = $("#wsin").getBoundingClientRect(), r = el.getBoundingClientRect();
  return { left: r.left - c.left, top: r.top - c.top, width: r.width, height: r.height, right: r.right - c.left };
}

// Персонажи и локации из текста попадают в проект (как «сохранять элементы из текста» в STARC)
function harvest() {
  const p = P(), added = [];
  for (const bl of p.sp.blocks) {
    const txt = strip(bl.h).trim();
    if (!txt) continue;
    if (bl.t === "ch") {
      const name = txt.replace(/\s*\(.*?\)\s*$/, "").trim();
      if (name.length > 1 && !p.chars.some((c) => c.name.toUpperCase() === name.toUpperCase())) {
        p.chars.push({ id: uid("c"), name: words(name), role: "episodic", age: "", gender: "", one: "", long: "", ext: {} });
        added.push(`персонаж «${words(name)}»`);
      }
    }
    if (bl.t === "sh") {
      const m = txt.toUpperCase().match(/^(?:ИНТ\.\/НАТ\.|ИНТ\.|НАТ\.)\s+(.+?)(?:\s+[—-](?:\s+.*)?)?$/);
      const place = m && m[1].trim();
      if (place && !p.locs.some((l) => l.name.toUpperCase() === place)) {
        p.locs.push({ id: uid("l"), name: cap(place), role: "episodic", one: "", long: "", ext: {} });
        added.push(`локация «${cap(place)}»`);
      }
    }
  }
  if (added.length) toast(`Добавлено из текста: ${added.join(", ")}`);
}

// ——— Поиск и замена ———
function openFind() {
  if (!S.ui.find) S.ui.find = { q: "", scope: "all", rep: "", showRep: false, i: 0, n: 0 };
  renderFind();
  $("#findq").focus();
  $("#findq").select();
}
function renderFind() {
  $(".findbar")?.remove();
  const f = S.ui.find, scoped = ["text", "draft"].includes(kindOf(doc()));
  const bar = document.createElement("div");
  bar.className = "findbar";
  bar.innerHTML = `<input class="field" id="findq" placeholder="Найти" value="${esc(f.q)}" aria-label="Найти" />
    ${scoped ? `<select class="field" id="finds" aria-label="Где искать">${[["all", "Во всём тексте"], ["sh", "В заголовках сцен"], ["ac", "В описании действия"], ["ch", "В персонажах"], ["dl", "В репликах"]].map(([v, l]) => `<option value="${v}" ${f.scope === v ? "selected" : ""}>${l}</option>`).join("")}</select>` : ""}
    <span class="n" id="findn"></span>
    <button class="ibtn" data-act="find-step" data-d="-1" aria-label="Предыдущее">${ico("left")}</button><button class="ibtn" data-act="find-step" data-d="1" aria-label="Следующее">${ico("right")}</button>
    <button class="ibtn ${f.showRep ? "on" : ""}" data-act="find-rep" title="Заменить" aria-label="Заменить">${ico("edit")}</button>
    <button class="ibtn" data-act="find-close" aria-label="Закрыть поиск">${ico("x")}</button>
    ${f.showRep ? `<div class="rep"><input class="field" id="findr" placeholder="Заменить на" value="${esc(f.rep)}" aria-label="Заменить на" /><button class="btn outline" data-act="find-one">Заменить</button><button class="btn outline" data-act="find-all">Заменить все</button></div>` : ""}`;
  $("#ws").append(bar);
  findRun();
}
let FIND = [];
function findRun() {
  const f = S.ui.find, ed = $("#ed");
  if (!("highlights" in CSS)) { toast("Подсветка поиска требует CSS Custom Highlight API (Chrome, Edge, Safari 17.2+)."); throw new Error("CSS.highlights недоступен"); }
  CSS.highlights.delete("find"); CSS.highlights.delete("find-cur");
  FIND = [];
  if (!ed || !f.q) { $("#findn") && ($("#findn").textContent = ""); return; }
  const q = f.q.toLowerCase();
  $$(".b", ed).filter((x) => !x.classList.contains("iso-hide") && (f.scope === "all" || x.dataset.t === f.scope || (f.scope === "dl" && x.dataset.t === "pa"))).forEach((el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const t = n.textContent.toLowerCase();
      let at = t.indexOf(q);
      while (at >= 0) { const r = new Range(); r.setStart(n, at); r.setEnd(n, at + q.length); FIND.push(r); at = t.indexOf(q, at + q.length); }
    }
  });
  f.n = FIND.length;
  if (f.i >= f.n) f.i = 0;
  if (FIND.length) {
    CSS.highlights.set("find", new Highlight(...FIND));
    CSS.highlights.set("find-cur", new Highlight(FIND[f.i]));
  }
  $("#findn").textContent = f.n ? `${f.i + 1} из ${f.n}` : "нет";
}
function findShow() {
  const r = FIND[S.ui.find.i];
  if (!r) return;
  CSS.highlights.set("find-cur", new Highlight(r));
  $("#findn").textContent = `${S.ui.find.i + 1} из ${S.ui.find.n}`;
  r.startContainer.parentElement.scrollIntoView({ block: "center" });
}

// ——— Рецензирование: цвет текста, заливка, комментарии ———
function selInBlock() {
  const s = getSelection();
  if (!s.rangeCount || s.isCollapsed) return null;
  const r = s.getRangeAt(0);
  const a = (r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer).closest("#ed .b");
  const z = (r.endContainer.nodeType === 3 ? r.endContainer.parentNode : r.endContainer).closest("#ed .b");
  if (!a || !z) return null;
  return { r, a, z, same: a === z };
}
function showRvbar() {
  $(".rvbar")?.remove();
  const ed = $("#ed");
  if (!S.ui.review || !ed || ed.getAttribute("contenteditable") !== "true") return;
  const s = selInBlock();
  if (!s) return;
  const page = ed.closest(".page"), c = $("#wsin").getBoundingClientRect(), rr = s.r.getBoundingClientRect(), pr = page.getBoundingClientRect();
  const bar = document.createElement("div");
  bar.className = "rvbar";
  bar.innerHTML = `<button class="dot" data-act="mark" data-kind="color" title="Цвет текста" aria-label="Цвет текста">${ico("type")}</button>
    <button class="dot" data-act="mark" data-kind="fill" title="Выделить фон" aria-label="Выделить фон">${ico("drop")}</button>
    <button class="dot" data-act="mark" data-kind="comment" title="Добавить комментарий" aria-label="Добавить комментарий">${ico("msg")}</button><hr>
    <button class="dot" data-act="mark-col" title="Цвет пометки" aria-label="Сменить цвет пометки"><i style="--sw:var(${MARK_COLORS[S.ui.markCol]})"></i></button>`;
  bar.style.top = `${rr.top - c.top - 8}px`;
  bar.style.left = `${Math.min(pr.right - c.left - 22, c.width - 56)}px`;
  bar.addEventListener("mousedown", (e) => e.preventDefault());
  $("#wsin").append(bar);
}
function addMark(kind) {
  const s = selInBlock();
  if (!s) return;
  if (!s.same) { toast("Выделите фрагмент внутри одного абзаца."); return; }
  const id = uid("c"), col = S.ui.markCol, span = document.createElement("span");
  span.className = `mk mk-${kind}`;
  span.dataset.c = id;
  span.style.setProperty("--mk", `var(${MARK_COLORS[col]})`);
  span.append(s.r.extractContents());
  s.r.insertNode(span);
  getSelection().removeAllRanges();
  P().comments[id] = { kind, col, author: me(), at: "только что", text: "", replies: [], resolved: false, fresh: kind === "comment" };
  $(".rvbar")?.remove();
  changed(true);
  flushEditor();
  S.ui.thread = id;
  renderThread();
  refreshCcount();
}
function refreshCcount() {
  const b2 = $('[data-act="clist"] b');
  if (b2) b2.textContent = Object.values(P().comments).filter((c) => !c.resolved).length;
}
function renderThread() {
  $(".cthread")?.remove();
  $$(".mk.active").forEach((x) => x.classList.remove("active"));
  const id = S.ui.thread, p = P(), c = p.comments[id], span = $(`#ed [data-c="${id}"]`);
  if (!c || !span) return;
  span.classList.add("active");
  const page = span.closest(".page"), box = relRect(span), pr = relRect(page), wsW = $("#wsin").clientWidth;
  const el = document.createElement("div");
  el.className = "cthread";
  el.style.setProperty("--mk", `var(${MARK_COLORS[c.col]})`);
  const own = c.author === me();
  const head = c.kind === "comment" ? "Комментарий" : c.kind === "fill" ? "Выделение фоном" : "Цвет текста";
  const body = c.fresh
    ? `<div class="reply"><textarea class="field" id="cnew" placeholder="Комментарий" aria-label="Текст комментария"></textarea><div class="row-acts"><button class="btn ghost" data-act="c-cancel">Отмена</button><button class="btn primary" data-act="c-save">Комментировать</button></div></div>`
    : `${c.text ? cmHTML(c, own, -1) : ""}${c.replies.map((r, i) => cmHTML(r, r.author === me(), i)).join("")}
       ${c.resolved ? `<p class="resolved-tag">Решено</p>` : ""}
       <div class="reply"><textarea class="field" id="creply" placeholder="${c.kind === "comment" ? "Ответить" : "Добавить комментарий"}" aria-label="Ответ"></textarea><div class="row-acts"><button class="btn primary" data-act="c-reply">Отправить</button></div></div>`;
  el.innerHTML = `<div class="ch-head">${ico(c.kind === "comment" ? "msg" : c.kind === "fill" ? "drop" : "type", "sm")}<span>${head}</span><span class="sp"></span>
    ${c.fresh ? "" : `<button class="ibtn" data-act="${c.resolved ? "c-reopen" : "c-resolve"}" title="${c.resolved ? "Вернуть в открытые" : "Решено"}" aria-label="${c.resolved ? "Вернуть в открытые" : "Отметить решённым"}">${ico(c.resolved ? "restore" : "check")}</button>
    <button class="ibtn" data-act="c-menu" aria-label="Ещё">${ico("more")}</button>`}<button class="ibtn" data-act="c-close" aria-label="Закрыть">${ico("x")}</button></div>
    <div class="quote">${esc(span.textContent)}</div>${body}`;
  const w = Math.min(300, wsW - 24);
  let left = pr.right + 16;
  if (left + w > wsW - 8) left = wsW - w - 12;
  el.style.left = `${left}px`;
  el.style.top = `${Math.max(8, box.top - 10)}px`;
  $("#wsin").append(el);
  requestAnimationFrame(() => (c.fresh ? $("#cnew") : null)?.focus());
}
const cmHTML = (c, own, i) => `<div class="cm"><div class="who"><span class="av">${esc(c.author[0])}</span><span><b>${esc(c.author)}</b>${c.role ? ` <small>· ${esc(c.role)}</small>` : ""}<br><small>${esc(c.at)}</small></span>${own ? `<button class="ibtn" data-act="cm-menu" data-i="${i}" aria-label="Действия">${ico("more", "sm")}</button>` : ""}</div><p>${esc(c.text)}</p></div>`;
function unwrapMark(id) {
  const span = $(`#ed [data-c="${id}"]`);
  if (span) span.replaceWith(...span.childNodes);
  delete P().comments[id];
  S.ui.thread = null;
  $(".cthread")?.remove();
  changed(true);
  flushEditor();
  refreshCcount();
}

// ——— Карточки сцен (вид сценария и поэпизодника) ———
function cardsHTML(k) {
  const p = P(), items = scenesOf(p.sp.blocks);
  const groups = [];
  let g = { id: null, name: "Без акта", cards: [] };
  items.forEach((s) => {
    if (s.kind === "act") { if (g.cards.length || g.id) groups.push(g); g = { id: s.id, name: s.name || "Акт", cards: [] }; }
    else if (s.kind === "scene") g.cards.push(s);
  });
  groups.push(g);
  if (!items.some((s) => s.kind === "scene")) return `<div class="empty-state"><b>Сцен пока нет</b>Добавьте сцену кнопкой сверху или начните писать в виде «Текст».</div>`;
  return `<div class="cards">${groups.map((gr) => `<section class="cact"><h3 data-drop="${gr.id || ""}" data-dk="act">${esc(gr.name)}</h3>
    <div class="cgrid">${gr.cards.map((s) => {
      const prm = p.sp.params[s.id] || {};
      return `<button class="card ${S.ui.card === s.id ? "cur" : ""}" data-act="card" data-sc="${s.id}" draggable="true" data-drop="${s.id}" data-dk="scene">
        ${prm.color != null ? `<i class="stripe" style="background:var(${MARK_COLORS[prm.color]})"></i>` : ""}
        ${prm.alt ? `<span class="alt">${esc(prm.alt)}</span>` : ""}<span class="h">${s.num}. ${esc(s.head || "Без заголовка")}</span>
        ${k === "treatment" || !s.text ? (s.beats.length ? `<ul>${s.beats.map((bt) => `<li>${esc(bt.text)}</li>`).join("")}</ul>` : "") : `<span class="tx">${esc(s.text)}</span>`}
        <span class="ft">${(prm.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}${prm.day ? `<span>${esc(prm.day)}</span>` : ""}<time>${dur(s.chars)}</time></span></button>`;
    }).join("")}</div></section>`).join("")}
    <p class="muted" style="text-align:center">Перетащите карточку, чтобы переставить сцену. Двойной клик открывает текст сцены.</p></div>`;
}
function sheetHTML(p) {
  const s = scenesOf(p.sp.blocks).find((x) => x.id === S.ui.card);
  if (!s) { S.ui.card = null; return ""; }
  const prm = p.sp.params[s.id] || {};
  return `<aside class="sheet" aria-label="Параметры сцены"><header><b>Сцена ${s.num}</b><button class="ibtn" data-act="sheet-close" aria-label="Закрыть">${ico("x")}</button></header>
    <div class="body">
      <div><label class="lbl" for="pmalt">Название</label><input class="field" id="pmalt" data-pm="alt" value="${esc(prm.alt || "")}" /><p class="hint">Смысловое название — видно в навигаторе и на карточке, в тексте скрыто.</p></div>
      <div><label class="lbl" for="pmhead">Заголовок</label><input class="field" id="pmhead" data-pm="head" value="${esc(s.head)}" /></div>
      <div><label class="lbl" for="pmbeats">Описание</label><textarea class="field" id="pmbeats" data-pm="beats" rows="4">${esc(s.beats.map((x) => x.text).join("\n"))}</textarea><p class="hint">Каждая строка — отдельный бит.</p></div>
      <div><label class="lbl" for="pmday">День истории</label><input class="field" id="pmday" data-pm="day" value="${esc(prm.day || "")}" placeholder="Например, 3-й день" /></div>
      <div><span class="lbl">Цвет</span><div class="swatches"><button class="none ${prm.color == null ? "on" : ""}" data-act="pm-color" data-c="" aria-label="Без цвета">${ico("x", "sm")}</button>${MARK_COLORS.map((c, i) => `<button class="${prm.color === i ? "on" : ""}" style="--sw:var(${c})" data-act="pm-color" data-c="${i}" aria-label="Цвет ${i + 1}"></button>`).join("")}</div></div>
      <div><span class="lbl">Теги</span><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${(prm.tags || []).map((t, i) => `<span class="tag">${esc(t)}<button data-act="pm-untag" data-i="${i}" aria-label="Убрать тег">×</button></span>`).join("")}</div><input class="field" id="pmtag" placeholder="Новый тег и Enter" /></div>
      <p class="facts">Длительность ≈ ${dur(s.chars)} · ${s.beats.length} бит.</p>
      <button class="btn outline" data-act="card-open" data-sc="${s.id}">${ico("align")}Открыть текст сцены</button>
      <button class="btn ghost" data-act="card-del" data-sc="${s.id}" style="color:var(--destructive)">${ico("trash")}Удалить сцену</button>
    </div></aside>`;
}
function setBeats(p, s, lines) {
  const bl = p.sp.blocks;
  const beatIds = s.beats.map((x) => x.id);
  lines.forEach((t, i) => { if (beatIds[i]) bl.find((x) => x.id === beatIds[i]).h = esc(t); });
  beatIds.slice(lines.length).forEach((id) => bl.splice(bl.findIndex((x) => x.id === id), 1));
  const extra = lines.slice(beatIds.length);
  if (extra.length) {
    const sc = scenesOf(bl).find((x) => x.id === s.id);
    bl.splice(sc.end, 0, ...extra.map((t) => ({ id: uid("b"), t: "beat", h: esc(t) })));
  }
}

// ——— Формы: история, сценарий, титульная страница, сущности ———
function infoHTML(p) {
  return `<div class="form-head"><h1>История</h1>${saveSt()}</div><div class="form-wrap">
    <div class="fcard"><div><label class="lbl" for="pft">Название истории</label><input class="field" id="pft" data-pf="title" value="${esc(p.title)}" /></div>
    <div><label class="lbl" for="pfd">Короткое описание</label><input class="field" id="pfd" data-pf="desc" value="${esc(p.desc)}" /><p class="hint">Тэглайн, логлайн или пара слов о том, про что история.</p></div></div>
    <button class="cover-box ${p.cover ? "has" : ""}" data-act="cover">${p.cover ? esc(p.title) : `${ico("image")}Добавить обложку`}</button></div>`;
}
function spHTML(p) {
  const sp = p.sp;
  return `<div class="form-head"><h1>Сценарий</h1>${saveSt()}</div><div class="form-wrap one"><div class="fcard">
    <div><label class="lbl" for="sfn">Название сценария</label><input class="field" id="sfn" data-sf="name" value="${esc(sp.name)}" /></div>
    <div><label class="lbl" for="sft">Тэглайн</label><input class="field" id="sft" data-sf="tagline" value="${esc(sp.tagline)}" /></div>
    <div><label class="lbl" for="sfl">Логлайн</label><textarea class="field" id="sfl" data-sf="logline" rows="3">${esc(sp.logline)}</textarea></div>
    <div><span class="lbl">Части сценария в навигаторе</span>${[["title", "Титульная страница"], ["synopsis", "Синопсис"], ["treatment", "Поэпизодник"], ["text", "Сценарий"]].map(([k2, l]) => `<label class="chk"><input type="checkbox" data-act="show" data-k="${k2}" ${sp.show[k2] ? "checked" : ""} />${l}</label>`).join("")}</div>
    <p class="facts">${scenesOf(sp.blocks).filter((s) => s.kind === "scene").length} сцен · ≈ ${dur(scenesOf(sp.blocks).reduce((n, s) => n + (s.chars || 0), 0))}</p></div></div>`;
}
function titleHTML(p) {
  const t = p.sp.titlePage, f = (k2, ph, cls = "") => `<div contenteditable="true" class="${cls}" data-tf="${k2}" data-ph="${ph}" spellcheck="true">${esc(t[k2])}</div>`;
  return `<div class="form-head" style="max-width:640px"><h1>Титульная страница</h1>${saveSt()}</div>
    <div class="page title"><div class="tmid">${f("title", "Название", "t1")}${f("genre", "Жанр или формат")}${f("author", "Автор")}</div>
    <div class="tbot">${f("contacts", "Контакты")}${f("place", "Город, год")}</div></div>`;
}
function groupHTML(p, k) {
  const conf = { chars: ["Персонажи", "char", p.chars, "Добавить персонажа"], locs: ["Локации", "loc", p.locs, "Добавить локацию"], worlds: ["Миры", "world", p.worlds, "Добавить мир"] }[k];
  const [title, kind, list, add] = conf;
  const sc = scenesOf(p.sp.blocks);
  const rows = list.map((x) => {
    const role = ROLES[kind] ? (ROLES[kind].find((r) => r[0] === x.role) || ["", ""])[1] : "";
    const n = kind === "world" ? null : usage(p, kind, x).scenes.length;
    return `<button class="erow" data-act="open" data-doc="${kind}:${x.id}"><span class="av">${esc((x.name || "?")[0])}</span><span class="tt"><b>${esc(x.name)}</b><small>${esc(x.one || "Без описания")}</small></span>
      ${n != null ? `<span class="role">${n ? `${n} сц.` : "нет в тексте"}</span>` : ""}${role ? `<span class="role">${role}</span>` : ""}</button>`;
  }).join("");
  void sc;
  return `<div class="form-head"><h1>${title}</h1><button class="btn primary" data-act="add-entity" data-kind="${kind}">${ico("plus")}${add}</button></div>
    <div class="elist">${rows || `<div class="empty-state"><b>Пока пусто</b>${kind === "char" ? "Персонажи появляются и сами, когда вы пишете имя в тексте сценария." : kind === "loc" ? "Локации появляются и сами из заголовков сцен." : "Миры описывают правила и устройство вашей истории."}</div>`}</div>`;
}
function usage(p, kind, x) {
  const scenes = [], up = x.name.toUpperCase();
  let lines = 0, cur = null;
  scenesOf(p.sp.blocks);
  let n = 0;
  for (const bl of p.sp.blocks) {
    const t = strip(bl.h).trim().toUpperCase();
    if (bl.t === "sh") { n += 1; cur = n; if (kind === "loc" && t.includes(up)) scenes.push(n); }
    if (kind === "char" && bl.t === "ch" && t.replace(/\s*\(.*?\)\s*$/, "") === up) { lines += 1; if (cur && !scenes.includes(cur)) scenes.push(cur); }
  }
  return { scenes, lines };
}
function entityHTML(p, k, id) {
  const list = { char: p.chars, loc: p.locs, world: p.worlds }[k], x = list.find((y) => y.id === id);
  const fld = (f, l, val, area = false) => `<div><label class="lbl" for="f-${f}">${l}</label>${area ? `<textarea class="field" id="f-${f}" data-f="${f}" rows="4">${esc(val)}</textarea>` : `<input class="field" id="f-${f}" data-f="${f}" value="${esc(val)}" />`}</div>`;
  const u = k === "world" ? null : usage(p, k, x);
  const facts = u ? `<p class="facts">${u.scenes.length ? `В сценах: ${u.scenes.join(", ")}${k === "char" ? ` · реплик: ${u.lines}` : ""}` : "В тексте сценария пока не встречается"}</p>` : "";
  const roles = ROLES[k] ? `<div><span class="lbl">Роль в истории</span><div class="seg" role="radiogroup">${ROLES[k].map(([v, l]) => `<button role="radio" aria-checked="${x.role === v}" class="${x.role === v ? "on" : ""}" data-act="role" data-v="${v}">${l}</button>`).join("")}</div></div>` : "";
  const extra = k === "char" ? `<div class="two">${fld("age", "Возраст", x.age)}<div><label class="lbl" for="f-gender">Пол</label><select class="field" id="f-gender" data-f="gender">${[["", "Не указан"], ["f", "Женский"], ["m", "Мужской"], ["o", "Другой"]].map(([v, l]) => `<option value="${v}" ${x.gender === v ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>` : "";
  const sections = PROFILE[k].map(([title, fields]) => {
    const filled = fields.filter(([f]) => (x.ext[f] || "").trim()).length;
    return `<details class="sect"><summary>${ico("right")}${title}<small>${filled ? `заполнено ${filled} из ${fields.length}` : ""}</small></summary><div class="in">${fields.map(([f, l]) => fld(`ext.${f}`, l, x.ext[f] || "", true)).join("")}</div></details>`;
  }).join("");
  return `<div class="form-head"><h1 id="ent-h">${esc(x.name)}</h1>${saveSt()}<button class="ibtn" data-act="ent-menu" aria-label="Действия">${ico("more")}</button></div>
    <div class="form-wrap"><div class="stack"><div class="fcard">${fld("name", k === "char" ? "Имя" : "Название", x.name)}${roles}${extra}
      ${fld("one", "Одной фразой", x.one)}${fld("long", "Подробное описание", x.long, true)}${k === "world" ? fld("overview", "Обзор мира", x.overview || "", true) : ""}${facts}</div>${sections}</div>
    <button class="cover-box photo ${x.photo ? "has" : ""}" data-act="photo">${x.photo ? esc(x.name) : `${ico("image")}Добавить фото`}</button></div>`;
}
function binHTML(p) {
  const kinds = { char: ["user", "Персонаж"], loc: ["pin", "Локация"], world: ["globe", "Мир"], draft: ["copy", "Драфт"] };
  if (!p.trash.length) return `<div class="form-head"><h1>Корзина</h1></div><div class="empty-state"><b>Корзина пуста</b>Сюда попадают удалённые персонажи, локации, миры и драфты.<br>Удалить можно из меню документа или перетащив его на «Корзину».</div>`;
  const i = Math.min(S.ui.binSel, p.trash.length - 1), t = p.trash[i];
  return `<div class="form-head" style="max-width:1000px"><h1>Корзина</h1><button class="btn outline" data-act="bin-empty">Очистить корзину</button></div>
    <div class="bin"><div class="list">${p.trash.map((x, j) => `<button class="it ${j === i ? "cur" : ""}" data-act="bin-sel" data-i="${j}">${ico(kinds[x.kind][0])}<span><b>${esc(x.item.name)}</b><small>${kinds[x.kind][1]} · удалён ${esc(x.when)}</small></span></button>`).join("")}</div>
    <div class="pv"><span class="muted">${kinds[t.kind][1]}</span><h2 style="margin:0">${esc(t.item.name)}</h2><p style="margin:0">${esc(t.item.one || (t.kind === "draft" ? `${t.item.blocks.length} абзацев текста` : "Без описания"))}</p>
      <div class="acts"><button class="btn primary" data-act="bin-restore" data-i="${i}">${ico("restore")}Восстановить</button><button class="btn ghost" data-act="bin-del" data-i="${i}" style="color:var(--destructive)">Удалить навсегда</button></div></div></div>`;
}

// ——— Драфты: сравнение по абзацам ———
function compareHTML(p, a, bId) {
  const side = (id) => (id === "current" ? { name: "Текущий текст", blocks: p.sp.blocks } : (() => { const d = p.sp.drafts.find((x) => x.id === id); return { name: `Драфт «${d.name}»`, blocks: d.blocks }; })());
  const A = side(a), B = side(bId);
  const key = (x) => `${x.t}|${strip(x.h).trim()}`;
  const ka = A.blocks.map(key), kb = B.blocks.map(key);
  const L = Array.from({ length: ka.length + 1 }, () => new Array(kb.length + 1).fill(0));
  for (let i = ka.length - 1; i >= 0; i -= 1) for (let j = kb.length - 1; j >= 0; j -= 1) L[i][j] = ka[i] === kb[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const inA = new Set(), inB = new Set();
  for (let i = 0, j = 0; i < ka.length && j < kb.length;) { if (ka[i] === kb[j]) { inA.add(i); inB.add(j); i += 1; j += 1; } else if (L[i + 1][j] >= L[i][j + 1]) i += 1; else j += 1; }
  const col = (S2, inSet, cls) => S2.blocks.map((x, i) => `<p class="b b-${x.t} ${inSet.has(i) ? "" : cls}">${esc(strip(x.h)) || "&nbsp;"}</p>`).join("");
  return `<div class="form-head" style="max-width:1400px"><h1>Сравнение</h1><button class="btn outline" data-act="open" data-doc="text">${ico("x")}Закрыть сравнение</button></div>
    <p class="muted" style="max-width:1400px;margin:0 auto 14px">Слева убранное — зачёркнуто, справа добавленное — подчёркнуто.</p>
    <div class="cmp"><div><h3>${esc(A.name)}</h3><div class="page script"><div class="ed text">${col(A, inA, "del")}</div></div></div>
    <div><h3>${esc(B.name)}</h3><div class="page script"><div class="ed text">${col(B, inB, "add")}</div></div></div></div>`;
}

// ——— Чат с соавтором ———
function chatList() { return S.chats[S.pid] || (S.chats[S.pid] = []); }
function renderChat() {
  const list = chatList(), cur = list.find((c) => c.id === S.ui.chatCur);
  let body;
  if (S.ui.chatView === "hist") {
    body = `<div class="hist"><div class="hh">Беседы по этой истории</div>${list.length ? list.slice().reverse().map((c) => `<button class="hi ${c.id === S.ui.chatCur ? "cur" : ""}" data-act="chat-open" data-id="${c.id}">${esc(c.title)}<small>${esc(c.when)} · ${c.msgs.length} сообщ.</small></button>`).join("") : `<p class="muted" style="padding:8px">Бесед ещё не было.</p>`}</div>`;
  } else if (!cur || !cur.msgs.length) {
    body = `<div class="msgs"><div class="chat-empty"><b>Спросите соавтора</b>Он видит открытый документ и всю историю: сцены, персонажей, локации.
      <div class="sugg">${["Что можно сократить в этой сцене?", "Проверь, не противоречит ли сцена профилям персонажей", "Предложи название для сцены"].map((s) => `<button data-act="chat-sugg">${s}</button>`).join("")}</div></div></div>`;
  } else {
    body = `<div class="msgs" id="msgs">${cur.msgs.map((m) => m.who === "me"
      ? `<div class="msg me">${m.ctx ? `<span class="ctxq">«${esc(m.ctx)}»</span>` : ""}${esc(m.text)}</div>`
      : `<div class="msg ai"><div class="who">${ico("spark", "sm")}Соавтор</div>${esc(m.text)}<div class="macts"><button data-act="chat-copy">Скопировать</button></div></div>`).join("")}${S.ui.typing ? `<div class="typing">Соавтор пишет…</div>` : ""}</div>`;
  }
  $("#chat").innerHTML = `<div class="chat-head" data-act="chat-toggle"><div class="t"><b>${ico("spark", "sm")}Соавтор</b><small id="chatctx"></small></div>
    <button class="ibtn ${S.ui.chatView === "hist" ? "on" : ""}" data-act="chat-hist" title="История бесед" aria-label="История бесед">${ico("history")}</button>
    <button class="ibtn" data-act="chat-new" title="Новая беседа" aria-label="Новая беседа">${ico("plus")}</button></div>
    ${body}
    <div class="composer"><div id="chip"></div><div class="box"><textarea id="chatin" rows="1" placeholder="Напишите соавтору" aria-label="Сообщение соавтору"></textarea><button class="send" data-act="chat-send" aria-label="Отправить">${ico("send", "sm")}</button></div></div>`;
  const m = $("#msgs");
  if (m) m.scrollTop = m.scrollHeight;
  updateChatCtx();
  drawChip();
}
function updateChatCtx() {
  const el = $("#chatctx"), p = P();
  if (!el || !p) return;
  const sc = S.ui.curScene && scenesOf(p.sp.blocks).find((s) => s.id === S.ui.curScene);
  el.textContent = `Видит: ${docTitle(p, doc())}${sc && ["text", "treatment"].includes(kindOf(doc())) ? ` · сцена ${sc.num}` : ""}`;
}
function drawChip() {
  const c = $("#chip");
  if (!c) return;
  c.innerHTML = S.ui.selText ? `<span class="chip"><span>Выделено: «${esc(S.ui.selText.slice(0, 60))}${S.ui.selText.length > 60 ? "…" : ""}»</span><button data-act="chip-x" aria-label="Убрать выделенное">${ico("x", "sm")}</button></span>` : "";
}
function chatSend(text) {
  text = text.trim();
  if (!text) return;
  const list = chatList();
  let cur = list.find((c) => c.id === S.ui.chatCur);
  if (!cur) { cur = { id: uid("h"), title: text.slice(0, 48), when: "сегодня", msgs: [] }; list.push(cur); S.ui.chatCur = cur.id; }
  const ctx = S.ui.selText;
  cur.msgs.push({ who: "me", text, ctx });
  S.ui.selText = "";
  S.ui.chatView = "msgs";
  S.ui.typing = true;
  renderChat();
  setTimeout(() => {
    const p = P(), d = doc();
    const reply = ctx
      ? `Про «${ctx.slice(0, 40)}${ctx.length > 40 ? "…" : ""}»: могу предложить три варианта, сократить или проверить, как это звучит в голосе персонажа. В макете ответы заготовлены — в продукте здесь будет ответ модели по тексту.`
      : `Смотрю на «${docTitle(p, d)}». В макете ответ заготовлен: в продукте соавтор ответит по открытому документу и всей истории — сценам, персонажам и локациям.`;
    cur.msgs.push({ who: "ai", text: reply });
    S.ui.typing = false;
    if (S.pid === p.id) renderChat();
  }, 900);
}

// ——— Меню и диалоги ———
function closeLayers() { $("#layer").innerHTML = ""; }
function openMenu(anchor, items) {
  closeLayers();
  const m = document.createElement("div");
  m.className = "menu";
  m.setAttribute("role", "menu");
  m.innerHTML = items.map((it, i) => it === "sep" ? "<hr>" : it.head ? `<div class="mh">${esc(it.head)}</div>` : `<button role="menuitem" data-mi="${i}" class="${it.danger ? "danger" : ""}" ${it.disabled ? "disabled" : ""}>${it.icon ? ico(it.icon, "sm") : ""}${esc(it.label)}${it.hint ? `<small>${esc(it.hint)}</small>` : ""}</button>`).join("");
  $("#layer").append(m);
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
  m.style.top = `${r.bottom + 4 + h > innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4}px`;
  m.addEventListener("click", (e) => {
    const b2 = e.target.closest("[data-mi]");
    if (!b2) return;
    const it = items[Number(b2.dataset.mi)];
    closeLayers();
    flushEditor();
    it.run();
  });
  m.querySelector("button")?.focus();
}
function openDialog(html, cls = "") {
  closeLayers();
  $("#layer").innerHTML = `<div class="scrim" data-act="dlg-scrim"><div class="dialog ${cls}" role="dialog" aria-modal="true">${html}</div></div>`;
  requestAnimationFrame(() => $(".dialog input:not([type=checkbox]), .dialog textarea, .dialog select, .dialog button.primary")?.focus());
}
function confirmDlg(title, text, label, run) {
  openDialog(`<h2>${esc(title)}</h2><p class="lede">${esc(text)}</p><div class="acts"><button class="btn ghost" data-act="dlg-close">Отмена</button><button class="btn danger" id="dlgok">${esc(label)}</button></div>`);
  $("#dlgok").addEventListener("click", () => { closeLayers(); run(); });
}
function newProjectDlg() {
  openDialog(`<h2>Новая история</h2><p class="lede">Полнометражный сценарий. Откроется пустой текст сценария — можно сразу писать.</p>
    <div class="row"><label class="lbl" for="npt">Название</label><input class="field" id="npt" placeholder="Например, Тихая вода" /><p class="err" id="npterr" hidden>Название не может быть пустым.</p></div>
    <details><summary class="linkbtn" style="cursor:pointer">Импортировать из файла</summary><div class="row" style="margin-top:10px"><input type="file" id="npf" accept=".fountain,.fdx,.starc,.docx,.txt" /><p class="hint">Fountain, Final Draft (FDX), STARC, DOCX или TXT. Персонажи, локации и сцены найдутся сами.</p></div></details>
    <div class="acts"><button class="btn ghost" data-act="dlg-close">Отмена</button><button class="btn primary" data-act="np-create">Создать</button></div>`);
}
function renameDlg(title, value, run) {
  openDialog(`<h2>${esc(title)}</h2><div class="row"><input class="field" id="rnv" value="${esc(value)}" /><p class="err" id="rnerr" hidden>Название не может быть пустым.</p></div>
    <div class="acts"><button class="btn ghost" data-act="dlg-close">Отмена</button><button class="btn primary" id="rnok">Сохранить</button></div>`);
  $("#rnok").addEventListener("click", () => { const v = $("#rnv").value.trim(); if (!v) { $("#rnerr").hidden = false; return; } closeLayers(); run(v); });
}
const ADD = {
  char: { icon: "user", label: "Персонаж", title: "Добавить персонажа", text: "Профиль персонажа: кто он, чего хочет и как меняется.", field: "Имя", empty: "Укажите имя персонажа.", dup: "Персонаж с таким именем уже есть." },
  loc: { icon: "pin", label: "Локация", title: "Добавить локацию", text: "Описание места и ощущений, которые оно даёт.", field: "Название", empty: "Укажите название локации.", dup: "Локация с таким названием уже есть." },
  world: { icon: "globe", label: "Мир", title: "Добавить мир", text: "Правила и устройство мира истории.", field: "Название", empty: "Укажите название мира.", dup: "Мир с таким названием уже есть." },
};
function addDocDlg(kind = "char") {
  const a = ADD[kind];
  openDialog(`<div class="types"><h3>Мир истории</h3><div class="tgrid">${Object.entries(ADD).map(([k2, x]) => `<button class="topt ${k2 === kind ? "on" : ""}" data-act="add-type" data-kind="${k2}">${ico(x.icon)}${x.label}</button>`).join("")}</div>
    <p class="hint" style="margin-top:16px">Сценарий у истории один. Документы — только персонажи, локации и миры: так соавтору проще находить нужное.</p></div>
    <div class="form"><h2>${a.title}</h2><p class="lede">${a.text}</p><label class="lbl" for="adn">${a.field}</label><input class="field" id="adn" /><p class="err" id="aderr" hidden></p>
    <div class="acts"><button class="btn ghost" data-act="dlg-close">Отмена</button><button class="btn primary" data-act="add-create" data-kind="${kind}">Создать</button></div></div>`, "wide");
}
function createEntity(kind, name) {
  const p = P(), list = { char: p.chars, loc: p.locs, world: p.worlds }[kind];
  const x = kind === "world" ? { id: uid("w"), name, one: "", long: "", overview: "", ext: {} } : { id: uid(kind[0]), name, role: kind === "char" ? "secondary" : "secondary", age: "", gender: "", one: "", long: "", ext: {} };
  list.push(x);
  S.ui.tree.add({ char: "chars", loc: "locs", world: "worlds" }[kind]);
  openDoc(`${kind}:${x.id}`);
}
function deleteDoc(d) {
  const p = P(), [k, id] = d.split(":");
  const lists = { char: p.chars, loc: p.locs, world: p.worlds, draft: p.sp.drafts };
  const list = lists[k];
  if (!list) throw new Error(`Документ «${d}» нельзя удалить`);
  const i = list.findIndex((x) => x.id === id);
  const [item] = list.splice(i, 1);
  p.trash.unshift({ kind: k, item, when: "только что" });
  toast(`«${item.name}» в корзине проекта.`);
  if (doc() === d || (k === "draft" && doc().startsWith("compare"))) openDoc({ char: "chars", loc: "locs", world: "worlds", draft: "text" }[k]);
  else renderProject();
}
function createDraftDlg() {
  const p = P();
  openDialog(`<h2>Создать драфт</h2><p class="lede">Сохраните текущий текст отдельным драфтом, чтобы не потерять этап работы.</p>
    <div class="row"><label class="lbl" for="drn">Название драфта</label><input class="field" id="drn" placeholder="Например, После читки" /><p class="err" id="drerr" hidden>Назовите драфт.</p></div>
    <div class="row"><label class="lbl" for="drb">На основе</label><select class="field" id="drb"><option value="current">Текущий текст</option>${p.sp.drafts.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</select></div>
    <label class="chk"><input type="checkbox" id="drl" checked />Запретить правку текста драфта</label>
    <div class="acts"><button class="btn ghost" data-act="dlg-close">Отмена</button><button class="btn primary" data-act="draft-create">Создать</button></div>`);
}
function compareDlg() {
  const p = P(), opts = (sel) => `<option value="current" ${sel === "current" ? "selected" : ""}>Текущий текст</option>${p.sp.drafts.map((d, i) => `<option value="${d.id}" ${sel === i ? "selected" : ""}>${esc(d.name)}</option>`).join("")}`;
  openDialog(`<h2>Сравнить драфты</h2><div class="row"><label class="lbl" for="cma">Было</label><select class="field" id="cma">${opts(0)}</select></div>
    <div class="row"><label class="lbl" for="cmb">Стало</label><select class="field" id="cmb">${opts("current")}</select></div><p class="err" id="cmerr" hidden>Выберите два разных текста.</p>
    <div class="acts"><button class="btn ghost" data-act="dlg-close">Отмена</button><button class="btn primary" data-act="compare-go">Сравнить</button></div>`);
}
function exportDlg() {
  const p = P(), d = doc(), k = kindOf(d);
  const what = ["text", "treatment", "synopsis", "title", "draft"].includes(k) ? docTitle(p, d) : "Сценарий";
  openDialog(`<h2>Экспорт</h2><p class="lede">${esc(what)} · ${esc(p.sp.name)}</p>
    <div class="row"><span class="lbl">Формат</span><div class="seg" id="exf">${["PDF", "DOCX", "FDX", "Fountain"].map((f, i) => `<button class="${i ? "" : "on"}" data-act="seg" data-v="${f}">${f}</button>`).join("")}</div></div>
    <label class="chk"><input type="checkbox" checked />Титульная страница</label><label class="chk"><input type="checkbox" />Номера сцен</label><label class="chk"><input type="checkbox" />Пометки рецензирования</label>
    <div class="row two" style="margin-top:8px"><div><label class="lbl" for="exs">Сцены с</label><input class="field" id="exs" placeholder="1" /></div><div><label class="lbl" for="exe">по</label><input class="field" id="exe" placeholder="последней" /></div></div>
    <div class="row"><label class="lbl" for="exw">Водяной знак (PDF)</label><input class="field" id="exw" placeholder="Например, Черновик" /></div>
    <div class="acts"><button class="btn ghost" data-act="dlg-close">Отмена</button><button class="btn primary" data-act="export-go">${ico("download", "sm")}Экспортировать</button></div>`);
}
function importDlg() {
  openDialog(`<h2>Импорт документов</h2><p class="lede">Загрузите сценарий из другой программы. Текст придёт отдельным драфтом, персонажи и локации — в проект.</p>
    <div class="row"><input type="file" id="imf" accept=".fountain,.fdx,.starc,.docx,.txt" /><p class="err" id="imerr" hidden>Выберите файл.</p></div>
    <label class="chk"><input type="checkbox" checked />Персонажи</label><label class="chk"><input type="checkbox" checked />Локации</label><label class="chk"><input type="checkbox" checked />Текст сценария — отдельным драфтом</label>
    <div class="acts"><button class="btn ghost" data-act="dlg-close">Отмена</button><button class="btn primary" data-act="import-go">${ico("upload", "sm")}Импортировать</button></div>`);
}
function settingsDlg() {
  const cur = document.documentElement.dataset.theme;
  openDialog(`<h2>Настройки</h2><div class="row"><span class="lbl">Тема</span><div class="seg">${[["light", "Светлая"], ["sepia", "Сепия"], ["dark", "Тёмная"]].map(([v, l]) => `<button class="${cur === v ? "on" : ""}" data-act="theme" data-v="${v}">${l}</button>`).join("")}</div></div><div class="acts"><button class="btn primary" data-act="dlg-close">Готово</button></div>`);
}

// Меню узлов навигатора (правый клик или ⋮)
function nodeMenu(d) {
  const p = P(), [k, id] = d.split(":");
  const all = [{ label: "Развернуть всё", run: () => { ["chars", "locs", "worlds", "sp", "text"].forEach((x) => S.ui.tree.add(x)); renderNav(); } }, { label: "Свернуть всё", run: () => { S.ui.tree.clear(); renderNav(); } }];
  const sortBy = (list) => () => { list.sort((a, b2) => a.name.localeCompare(b2.name, "ru")); renderNav(); if (["chars", "locs", "worlds"].includes(doc())) renderWs(); };
  if (k === "chars") return [{ label: "Добавить персонажа", icon: "plus", run: () => addDocDlg("char") }, { label: "Найти всех персонажей в тексте", icon: "search", run: () => { harvest(); renderProject(); } }, { label: "Сортировать по алфавиту", run: sortBy(p.chars) }, "sep", ...all];
  if (k === "locs") return [{ label: "Добавить локацию", icon: "plus", run: () => addDocDlg("loc") }, { label: "Найти все локации в тексте", icon: "search", run: () => { harvest(); renderProject(); } }, { label: "Сортировать по алфавиту", run: sortBy(p.locs) }, "sep", ...all];
  if (k === "worlds") return [{ label: "Добавить мир", icon: "plus", run: () => addDocDlg("world") }, "sep", ...all];
  if (["char", "loc", "world"].includes(k)) return [{ label: "Открыть", run: () => openDoc(d) }, { label: "Удалить", icon: "trash", danger: true, run: () => deleteDoc(d) }];
  if (k === "text") return [{ label: "Создать драфт", icon: "copy", run: createDraftDlg }, { label: "Сравнить драфты", icon: "columns", disabled: !p.sp.drafts.length, run: compareDlg }, { label: "Экспорт…", icon: "download", run: exportDlg }];
  if (k === "draft") return [{ label: "Открыть", run: () => openDoc(d) }, { label: "Сравнить с текущим текстом", icon: "columns", run: () => openDoc(`compare:current:${id}`) }, { label: "Переименовать", run: () => { const dr = p.sp.drafts.find((x) => x.id === id); renameDlg("Переименовать драфт", dr.name, (v) => { dr.name = v; renderProject(); }); } }, { label: "Удалить драфт", icon: "trash", danger: true, run: () => deleteDoc(d) }];
  if (k === "trash") return [{ label: "Очистить корзину", danger: true, disabled: !p.trash.length, run: binEmpty }];
  if (["treatment", "synopsis", "title"].includes(k)) return [{ label: "Экспорт…", icon: "download", run: exportDlg }, "sep", ...all];
  return all;
}
function binEmpty() {
  confirmDlg("Очистить корзину?", "Все документы из корзины проекта будут удалены навсегда.", "Удалить навсегда", () => { P().trash = []; S.ui.binSel = 0; renderProject(); toast("Корзина очищена."); });
}

// ——— Действия по клику ———
const ACT = {
  go: (el) => go(el.dataset.h),
  // вход
  "au-email"() {
    const v = $("#auemail").value.trim().toLowerCase();
    S.au.email = v;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return auErr("Похоже, в адресе ошибка. Пример: name@example.com");
    const known = ["author@example.com", "vera@example.com"].includes(v), hasPass = v === "author@example.com";
    auGo(hasPass ? "password" : "code", { known, hasPass, left: 5 });
  },
  "au-pass"() { const v = $("#aupass").value; if (!v) return auErr("Введите пароль."); if (v === "неверный") return auErr("Пароль не подошёл."); auGo("code"); },
  "au-forgot"() { S.au.forgot = true; auGo("code"); toast("Отправили код. После него можно задать новый пароль."); },
  "au-code"() {
    const v = $$("[data-code]").map((x) => x.value).join("");
    if (v === "000000") { S.au.left -= 1; return S.au.left ? auErr(`Неверный код. Осталось попыток: ${S.au.left}.`) : auGo("email", { err: "Слишком много попыток. Запросите новый код." }); }
    if (S.au.forgot) return auGo("reset", { forgot: false });
    S.au.known ? auIn() : auGo("name");
  },
  "au-resend"() { S.au.left = 5; auGo("code"); toast(`Новый код отправлен на ${S.au.email}. Прежний больше не действует.`); },
  "au-back"() { auGo("email", { known: false, hasPass: false, forgot: false }); },
  "au-name"() { const v = $("#auname").value.trim(); if (v) S.user.name = v; auGo("offer"); },
  "au-show"() { const f = $(".au-pass input"), v = f.value; S.au.show = !S.au.show; f.type = S.au.show ? "text" : "password"; $(".au-pass button").textContent = S.au.show ? "Скрыть" : "Показать"; f.value = v; f.focus(); },
  "au-setpass"() { const v = $("#aunew").value; if (v.length < 10) return auErr("Нужно не короче 10 символов."); auIn(); },
  "au-skip": auIn,
  // истории
  "open-project"(el, e) { if (e.target.closest(".more")) return; const p = S.projects.find((x) => x.id === el.dataset.pid); go(`#p/${p.id}/${encodeURIComponent(p.lastDoc)}`); },
  "project-menu"(el, e) {
    e.stopPropagation();
    const p = S.projects.find((x) => x.id === el.dataset.pid);
    openMenu(el, [
      { label: "Открыть", run: () => go(`#p/${p.id}/${encodeURIComponent(p.lastDoc)}`) },
      { label: "Переименовать", icon: "edit", run: () => renameDlg("Переименовать историю", p.title, (v) => { p.title = v; render(); }) },
      "sep",
      { label: "Удалить в корзину", icon: "trash", danger: true, run: () => { S.projects.splice(S.projects.indexOf(p), 1); S.ptrash.unshift({ id: p.id, title: p.title, desc: p.desc, when: "только что", left: 30, proj: p }); render(); toast(`«${p.title}» в корзине. Восстановить можно 30 дней.`); } },
    ]);
  },
  "new-project": newProjectDlg,
  "np-create"() {
    const t = $("#npt").value.trim();
    if (!t) { $("#npterr").hidden = false; $("#npt").classList.add("bad"); $("#npt").focus(); return; }
    const f = $("#npf").files[0], p = blankProject(t);
    if (f) { p.sp.blocks = importedBlocks(); p.chars.push({ id: uid("c"), name: "Герой", role: "main", age: "", gender: "", one: "", long: "", ext: {} }); p.locs.push({ id: uid("l"), name: "Квартира", role: "main", one: "", long: "", ext: {} }); }
    S.projects.unshift(p);
    closeLayers();
    go(`#p/${p.id}/text`);
    toast(f ? `Импортирован «${f.name}». В макете разбор не выполняется — подставлен пример.` : "История создана. Пишите — заголовок сцены уже ждёт.");
  },
  "account-menu"(el) { openMenu(el, [{ head: S.user.email || "author@example.com" }, ...(FLAGS.settings ? [{ label: "Настройки", icon: "gear", run: settingsDlg }] : []), { label: "Выйти", icon: "logout", run: () => { go("#auth"); toast("Вы вышли на этом устройстве."); } }]); },
  "go-ptrash": () => go("#ptrash"),
  "ptrash-restore"(el) { const [t] = S.ptrash.splice(Number(el.dataset.i), 1); S.projects.unshift(t.proj || { ...blankProject(t.title), id: t.id }); render(); toast(`«${t.title}» восстановлена.`); },
  "ptrash-del"(el) { const i = Number(el.dataset.i), t = S.ptrash[i]; confirmDlg(`Удалить «${t.title}» навсегда?`, "Историю нельзя будет восстановить.", "Удалить навсегда", () => { S.ptrash.splice(i, 1); render(); }); },
  "ptrash-empty"() { confirmDlg("Очистить корзину?", "Все истории из корзины будут удалены навсегда.", "Удалить навсегда", () => { S.ptrash = []; render(); }); },
  // навигатор
  open(el, e) { if (e.type === "keydown" || !e.target.closest("[data-act=tog],[data-act=drill]")) { openDoc(el.dataset.doc); closeNavMob(); } },
  tog(el, e) { e.stopPropagation(); const n = el.dataset.node; S.ui.tree.has(n) ? S.ui.tree.delete(n) : S.ui.tree.add(n); renderNav(); },
  drill(el, e) { e.stopPropagation(); S.ui.navMode = "scenes"; if (doc() !== el.dataset.doc) openDoc(el.dataset.doc); else renderNav(); },
  undrill() { S.ui.navMode = "tree"; renderNav(); },
  goscene(el) {
    S.ui.curScene = el.dataset.sc;
    const k = kindOf(doc());
    closeNavMob();
    if (!["text", "treatment"].includes(k) || S.ui.view[k] !== "text") { S.ui.view[k === "treatment" ? "treatment" : "text"] = "text"; openDoc(k === "treatment" ? "treatment" : "text"); return; }
    renderNav();
    const t = $(`#ed [data-id="${el.dataset.sc}"]`);
    if (S.ui.isolate) applyIso();
    if (t) { t.scrollIntoView({ block: "center", behavior: "smooth" }); placeCaret(t, true); }
    updateChatCtx();
  },
  view(el) { const k = kindOf(doc()); S.ui.view[k] = el.dataset.v; S.ui.card = null; renderNav(); renderWs(); },
  "main-menu"(el) {
    openMenu(el, [
      { label: "Истории", icon: "left", run: () => go("#projects") },
      { label: "Создать историю…", icon: "plus", run: () => { go("#projects"); setTimeout(newProjectDlg, 0); } },
      "sep",
      { label: "Импорт документов…", icon: "upload", run: importDlg },
      { label: "Экспорт текущего документа…", icon: "download", run: exportDlg },
      "sep",
      { label: "Полноэкранный режим", icon: "max", run: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()) },
      ...(FLAGS.settings ? [{ label: "Настройки", icon: "gear", run: settingsDlg }] : []),
      "sep",
      { label: "Выйти", icon: "logout", run: () => { go("#auth"); toast("Вы вышли на этом устройстве."); } },
    ]);
  },
  "nav-menu"(el) { openMenu(el, nodeMenu(S.ui.navMode === "scenes" ? "text" : doc())); },
  "add-doc": () => addDocDlg("char"),
  "add-type"(el) { addDocDlg(el.dataset.kind); },
  "add-entity"(el) { addDocDlg(el.dataset.kind); },
  "add-create"(el) {
    const kind = el.dataset.kind, v = $("#adn").value.trim(), p = P(), list = { char: p.chars, loc: p.locs, world: p.worlds }[kind];
    const errEl = $("#aderr");
    if (!v) { errEl.textContent = ADD[kind].empty; errEl.hidden = false; $("#adn").focus(); return; }
    if (list.some((x) => x.name.toLowerCase() === v.toLowerCase())) { errEl.textContent = ADD[kind].dup; errEl.hidden = false; $("#adn").focus(); return; }
    closeLayers();
    createEntity(kind, v);
  },
  "nav-open"() { $("#app").classList.add("nav-open"); },
  // редактор
  undo, redo,
  beats() { S.ui.beats = !S.ui.beats; $("#ed")?.classList.toggle("hide-beats", !S.ui.beats); $('[data-act="beats"]').classList.toggle("on", S.ui.beats); },
  isolate() { S.ui.isolate = !S.ui.isolate; applyIso(); $('[data-act="isolate"]').classList.toggle("on", S.ui.isolate); toast(S.ui.isolate ? "Видна только текущая сцена. Другие — через навигатор." : "Виден весь текст."); },
  review() { S.ui.review = !S.ui.review; $('[data-act="review"]').classList.toggle("on", S.ui.review); toast(S.ui.review ? "Рецензирование: выделите текст — рядом появятся цвет, заливка и комментарий." : "Рецензирование выключено. Пометки остаются в тексте."); showRvbar(); },
  find() { if (S.ui.find) ACT["find-close"](); else openFind(); },
  "find-close"() { S.ui.find = null; $(".findbar")?.remove(); CSS.highlights?.delete("find"); CSS.highlights?.delete("find-cur"); $('[data-act="find"]')?.classList.remove("on"); },
  "find-step"(el) { const f = S.ui.find; if (!f.n) return; f.i = (f.i + Number(el.dataset.d) + f.n) % f.n; findShow(); },
  "find-rep"() { S.ui.find.showRep = !S.ui.find.showRep; renderFind(); },
  "find-one"() {
    const r = FIND[S.ui.find.i];
    if (!r) return;
    if ($("#ed").getAttribute("contenteditable") !== "true") { toast("Этот драфт закрыт для правки."); return; }
    r.deleteContents(); r.insertNode(document.createTextNode(S.ui.find.rep));
    changed(true);
  },
  "find-all"() {
    if ($("#ed").getAttribute("contenteditable") !== "true") { toast("Этот драфт закрыт для правки."); return; }
    const n = FIND.length;
    FIND.slice().reverse().forEach((r) => { r.deleteContents(); r.insertNode(document.createTextNode(S.ui.find.rep)); });
    changed(true);
    toast(`Заменено: ${n}.`);
  },
  mark(el) { addMark(el.dataset.kind); },
  "mark-col"() { S.ui.markCol = (S.ui.markCol + 1) % MARK_COLORS.length; showRvbar(); },
  clist(el) {
    const p = P(), all = Object.entries(p.comments), show = (mode) => {
      const items = all.filter(([, c]) => mode === "all" || !c.resolved);
      const m = $(".menu.clist");
      m.innerHTML = `<div class="tabs"><button class="${mode === "open" ? "on" : ""}" data-cl="open">Открытые</button><button class="${mode === "all" ? "on" : ""}" data-cl="all">Все</button></div>${items.length ? items.map(([id, c]) => {
        const span = document.querySelector(`#ed [data-c="${id}"]`);
        return `<button class="ci ${c.resolved ? "done" : ""}" data-cid="${id}" style="--mk:var(${MARK_COLORS[c.col]})"><q>${esc(span ? span.textContent : "в другом документе")}</q><span>${esc(c.text || (c.kind === "comment" ? "Без текста" : c.kind === "fill" ? "Выделение фоном" : "Цвет текста"))}</span><small>${esc(c.author)} · ${esc(c.at)}${c.replies.length ? ` · ответов: ${c.replies.length}` : ""}${c.resolved ? " · решено" : ""}</small></button>`;
      }).join("") : `<p class="muted" style="padding:10px">${mode === "open" ? "Открытых комментариев нет." : "Комментариев нет."}</p>`}`;
    };
    closeLayers();
    const m = document.createElement("div");
    m.className = "menu clist";
    $("#layer").append(m);
    show("open");
    const r = el.getBoundingClientRect();
    m.style.top = `${r.bottom + 6}px`;
    m.style.left = `${Math.max(8, Math.min(r.right - 340, innerWidth - 348))}px`;
    m.addEventListener("click", (e) => {
      const t = e.target.closest("[data-cl]");
      if (t) { show(t.dataset.cl); return; }
      const c = e.target.closest("[data-cid]");
      if (!c) return;
      const span = $(`#ed [data-c="${c.dataset.cid}"]`);
      closeLayers();
      if (!span) { toast("Этот комментарий в другом документе."); return; }
      if (S.ui.isolate) { S.ui.isolate = false; applyIso(); $('[data-act="isolate"]')?.classList.remove("on"); }
      span.scrollIntoView({ block: "center" });
      S.ui.thread = c.dataset.cid;
      renderThread();
    });
  },
  "c-close"() { S.ui.thread = null; $(".cthread")?.remove(); $$(".mk.active").forEach((x) => x.classList.remove("active")); },
  "c-cancel"() { unwrapMark(S.ui.thread); },
  "c-save"() { const v = $("#cnew").value.trim(); if (!v) { $("#cnew").focus(); return; } const c = P().comments[S.ui.thread]; c.text = v; c.fresh = false; renderThread(); dirty(); toast("Комментарий добавлен."); },
  "c-reply"() {
    const v = $("#creply").value.trim(), c = P().comments[S.ui.thread];
    if (!v) { $("#creply").focus(); return; }
    if (!c.text && c.author === me()) c.text = v; else c.replies.push({ author: me(), at: "только что", text: v });
    if (c.kind !== "comment") { c.kind = "comment"; const span = $(`#ed [data-c="${S.ui.thread}"]`); span.className = "mk mk-comment active"; changed(true); flushEditor(); }
    renderThread(); dirty(); refreshCcount();
  },
  "c-resolve"() { const c = P().comments[S.ui.thread]; c.resolved = true; $(`#ed [data-c="${S.ui.thread}"]`)?.classList.add("resolved"); changed(true); flushEditor(); ACT["c-close"](); refreshCcount(); toast("Отмечено решённым. Найти можно в списке комментариев → «Все»."); },
  "c-reopen"() { const c = P().comments[S.ui.thread]; c.resolved = false; $(`#ed [data-c="${S.ui.thread}"]`)?.classList.remove("resolved"); changed(true); flushEditor(); renderThread(); refreshCcount(); },
  "c-menu"(el) { openMenu(el, [{ label: "Удалить пометку", icon: "trash", danger: true, run: () => unwrapMark(S.ui.thread) }]); },
  "cm-menu"(el) {
    const c = P().comments[S.ui.thread], i = Number(el.dataset.i), target = i < 0 ? c : c.replies[i];
    openMenu(el, [
      { label: "Изменить", icon: "edit", run: () => renameDlg("Изменить комментарий", target.text, (v) => { target.text = v; renderThread(); dirty(); }) },
      { label: "Удалить", icon: "trash", danger: true, run: () => { if (i < 0) unwrapMark(S.ui.thread); else { c.replies.splice(i, 1); renderThread(); } } },
    ]);
  },
  // карточки
  card(el, e) { if (e.detail === 2) { ACT["card-open"](el); return; } S.ui.card = el.dataset.sc; S.ui.curScene = el.dataset.sc; renderWs(); updateChatCtx(); },
  "card-open"(el) { S.ui.curScene = el.dataset.sc; S.ui.card = null; S.ui.view[kindOf(doc())] = "text"; renderNav(); renderWs(); },
  "sheet-close"() { S.ui.card = null; renderWs(); },
  "card-add"(el) {
    const p = P(), t = el.dataset.t, nb = { id: uid("b"), t, h: t === "sh" ? "НАТ. НОВАЯ СЦЕНА — ДЕНЬ" : "Новый акт" };
    p.sp.blocks.push(nb);
    if (t === "sh") S.ui.card = nb.id;
    dirty(); renderNav(); renderWs();
  },
  "card-del"(el) {
    const p = P(), s = scenesOf(p.sp.blocks).find((x) => x.id === el.dataset.sc);
    confirmDlg(`Удалить сцену ${s.num}?`, "Сцена и весь её текст будут удалены. Отменить можно через историю правок в тексте.", "Удалить сцену", () => { p.sp.blocks.splice(s.i, s.end - s.i); S.ui.card = null; dirty(); renderNav(); renderWs(); });
  },
  "pm-color"(el) { const p = P(), prm = (p.sp.params[S.ui.card] ||= {}); prm.color = el.dataset.c === "" ? null : Number(el.dataset.c); dirty(); renderNav(); renderWs(); },
  "pm-untag"(el) { const prm = P().sp.params[S.ui.card]; prm.tags.splice(Number(el.dataset.i), 1); dirty(); renderWs(); },
  // формы
  cover() { const p = P(); p.cover = !p.cover; renderWs(); toast(p.cover ? "Обложка добавлена (в макете — заглушка)." : "Обложка убрана."); },
  photo() { const [k, id] = doc().split(":"), p = P(), x = { char: p.chars, loc: p.locs, world: p.worlds }[k].find((y) => y.id === id); x.photo = !x.photo; renderWs(); },
  role(el) { const [k, id] = doc().split(":"), p = P(), x = { char: p.chars, loc: p.locs }[k].find((y) => y.id === id); x.role = el.dataset.v; dirty(); renderWs(); },
  show(el) { const p = P(); p.sp.show[el.dataset.k] = el.checked; dirty(); renderNav(); },
  "ent-menu"(el) { openMenu(el, nodeMenu(doc())); },
  "bin-sel"(el) { S.ui.binSel = Number(el.dataset.i); renderWs(); },
  "bin-restore"(el) {
    const p = P(), [t] = p.trash.splice(Number(el.dataset.i), 1);
    ({ char: p.chars, loc: p.locs, world: p.worlds, draft: p.sp.drafts })[t.kind].push(t.item);
    S.ui.binSel = 0; renderProject(); toast(`«${t.item.name}» восстановлен.`);
  },
  "bin-del"(el) { const p = P(), i = Number(el.dataset.i), t = p.trash[i]; confirmDlg(`Удалить «${t.item.name}» навсегда?`, "Документ нельзя будет восстановить.", "Удалить навсегда", () => { p.trash.splice(i, 1); S.ui.binSel = 0; renderProject(); }); },
  "bin-empty": binEmpty,
  // драфты
  "draft-create"() {
    const p = P(), name = $("#drn").value.trim();
    if (!name) { $("#drerr").hidden = false; $("#drn").focus(); return; }
    const base = $("#drb").value, src = base === "current" ? p.sp.blocks : p.sp.drafts.find((d) => d.id === base).blocks;
    const dr = { id: uid("d"), name, locked: $("#drl").checked, created: "сегодня", blocks: clone(src) };
    p.sp.drafts.push(dr);
    S.ui.tree.add("sp"); S.ui.tree.add("text");
    closeLayers(); renderNav(); toast(`Драфт «${name}» сохранён. Он в навигаторе под «Сценарием».`);
  },
  "draft-lock"(el) { const dr = P().sp.drafts.find((d) => d.id === el.dataset.id); dr.locked = !dr.locked; renderProject(); },
  "compare-with"(el) { openDoc(`compare:${el.dataset.a}:${el.dataset.b}`); },
  "compare-go"() { const a = $("#cma").value, b2 = $("#cmb").value; if (a === b2) { $("#cmerr").hidden = false; return; } closeLayers(); openDoc(`compare:${a}:${b2}`); },
  // экспорт и импорт
  seg(el) { $$("button", el.parentElement).forEach((x) => x.classList.toggle("on", x === el)); },
  "export-go"() { const f = $("#exf .on").dataset.v, p = P(); closeLayers(); toast(`Готово: «${p.sp.name}.${f.toLowerCase()}». В макете файл не создаётся.`); },
  "import-go"() {
    const f = $("#imf").files[0];
    if (!f) { $("#imerr").hidden = false; return; }
    const p = P(), dr = { id: uid("d"), name: `Импорт: ${f.name}`, locked: false, created: "сегодня", blocks: importedBlocks() };
    p.sp.drafts.push(dr); S.ui.tree.add("sp"); S.ui.tree.add("text");
    closeLayers(); openDoc(`draft:${dr.id}`); toast("Файл загружен отдельным драфтом. В макете разбор не выполняется — подставлен пример.");
  },
  theme(el) { document.documentElement.dataset.theme = el.dataset.v; settingsDlg(); },
  // чат
  "chat-toggle"(el, e) { if (e.target.closest(".ibtn") || !matchMedia("(max-width: 900px)").matches) return; $("#app").classList.toggle("chat-open"); },
  "chat-hist"() { S.ui.chatView = S.ui.chatView === "hist" ? "msgs" : "hist"; renderChat(); },
  "chat-new"() { S.ui.chatCur = null; S.ui.chatView = "msgs"; renderChat(); $("#chatin").focus(); },
  "chat-open"(el) { S.ui.chatCur = el.dataset.id; S.ui.chatView = "msgs"; renderChat(); },
  "chat-send"() { const t = $("#chatin"); chatSend(t.value); },
  "chat-sugg"(el) { chatSend(el.textContent); },
  "chat-copy"(el) { navigator.clipboard.writeText(el.closest(".msg").firstChild.nextSibling.textContent).then(() => toast("Скопировано.")); },
  "chip-x"() { S.ui.selText = ""; drawChip(); },
  "dlg-close": closeLayers,
  "dlg-scrim"(el, e) { if (e.target === el) closeLayers(); },
};
function closeNavMob() { $("#app")?.classList.remove("nav-open"); }

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if ($("#app.nav-open") && !e.target.closest(".nav")) { closeNavMob(); if (!el) return; }
  if (!e.target.closest(".menu") && !e.target.closest(".scrim") && $(".menu")) closeLayers();
  // клик по пометке в тексте открывает её ветку
  const mk = e.target.closest("#ed .mk:not(.resolved)");
  if (mk) { S.ui.thread = mk.dataset.c; renderThread(); return; }
  if (!el && S.ui.thread && !e.target.closest(".cthread")) ACT["c-close"]();
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (!fn) throw new Error(`Нет действия «${el.dataset.act}»`);
  if (el.dataset.act !== "dlg-scrim") flushEditor();
  fn(el, e);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if ($("#layer").children.length) { closeLayers(); return; }
    if (AC) { closeAc(); return; }
    if (S.ui.thread) { ACT["c-close"](); return; }
    if (S.ui.find) { ACT["find-close"](); return; }
    if (S.ui.card) { ACT["sheet-close"](); return; }
  }
  const ti = e.target.closest?.(".ti, .pcard");
  if (ti && (e.key === "Enter" || e.key === " ") && e.target === ti) { e.preventDefault(); ACT[ti.dataset.act](ti, e); }
  if ((e.metaKey || e.ctrlKey) && (e.key === "f" || e.key === "а") && $("#ed") && !e.target.closest("#ed")) { e.preventDefault(); openFind(); }
  if (e.target.id === "chatin" && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); chatSend(e.target.value); }
  if (e.target.id === "pmtag" && e.key === "Enter") { const v = e.target.value.trim(); if (!v) return; const prm = (P().sp.params[S.ui.card] ||= {}); (prm.tags ||= []).push(v); dirty(); renderWs(); $("#pmtag")?.focus(); }
  if (S.route.r === "auth") {
    const c = e.target.dataset?.code;
    if (c !== undefined && e.key === "Backspace" && !e.target.value && Number(c) > 0) { const prev = $(`[data-code="${Number(c) - 1}"]`); prev.value = ""; prev.focus(); return; }
    if (e.key === "Enter" && e.target.closest(".au-card")) { e.preventDefault(); const g = $(".au-go"); if (g && !g.disabled) g.click(); }
  }
  if (e.target.closest(".dialog") && e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "file") { e.preventDefault(); $(".dialog .btn.primary")?.click(); }
});
document.addEventListener("contextmenu", (e) => {
  const ti = e.target.closest(".ti");
  if (!ti) return;
  e.preventDefault();
  flushEditor();
  openMenu({ x: e.clientX, y: e.clientY }, nodeMenu(ti.dataset.doc));
});
document.addEventListener("input", (e) => {
  const t = e.target;
  if (S.route.r === "auth") {
    if (t.id === "aunew") { const v = t.value, n = (v.length >= 10) + (v.length >= 14) + /\d/.test(v) + /[^\p{L}\d]/u.test(v); $$("#aumeter i").forEach((x, i) => x.classList.toggle("on", i < n)); return; }
    const c = t.dataset.code;
    if (c === undefined) return;
    const boxes = $$("[data-code]"), i = Number(c), digits = t.value.replace(/\D/g, "");
    if (digits.length > 1) { digits.slice(0, 6 - i).split("").forEach((d, k) => (boxes[i + k].value = d)); boxes[Math.min(5, i + digits.length - 1)].focus(); }
    else { t.value = digits; if (digits && i < 5) boxes[i + 1].focus(); }
    const full = boxes.every((x) => x.value);
    $("#aucodego").disabled = !full;
    if (full) ACT["au-code"]();
    return;
  }
  const p = P();
  if (!p) return;
  if (t.id === "findq") { S.ui.find.q = t.value; S.ui.find.i = 0; findRun(); return; }
  if (t.id === "findr") { S.ui.find.rep = t.value; return; }
  if (t.id === "chatin") { t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; return; }
  if (t.dataset.pf) { p[t.dataset.pf] = t.value; if (t.dataset.pf === "title") renderNav(); dirty(); return; }
  if (t.dataset.sf) { p.sp[t.dataset.sf] = t.value; if (t.dataset.sf === "name") renderNav(); dirty(); return; }
  if (t.dataset.tf) { p.sp.titlePage[t.dataset.tf] = t.textContent; dirty(); return; }
  if (t.dataset.f) {
    const [k, id] = doc().split(":"), x = { char: p.chars, loc: p.locs, world: p.worlds }[k].find((y) => y.id === id);
    const f = t.dataset.f;
    if (f.startsWith("ext.")) x.ext[f.slice(4)] = t.value; else x[f] = t.value;
    if (f === "name") { $("#ent-h").textContent = t.value || "Без названия"; renderNav(); }
    dirty();
    return;
  }
  if (t.dataset.pm) {
    const s = scenesOf(p.sp.blocks).find((x) => x.id === S.ui.card), prm = (p.sp.params[s.id] ||= {});
    if (t.dataset.pm === "head") p.sp.blocks.find((x) => x.id === s.id).h = esc(t.value);
    else if (t.dataset.pm === "beats") setBeats(p, s, t.value.split("\n").map((x) => x.trim()).filter(Boolean));
    else prm[t.dataset.pm] = t.value;
    dirty();
    clearTimeout(navT);
    navT = setTimeout(() => { renderNav(); const keep = document.activeElement?.id; const pos = document.activeElement?.selectionStart; $(".cards") && ($("#wsin").innerHTML = cardsHTML(kindOf(doc()))); if (keep) { const f2 = $(`#${keep}`); f2?.focus(); f2?.setSelectionRange?.(pos, pos); } }, 400);
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "tsel") {
    const el = S.ui.lastBlock && $(`#ed [data-id="${S.ui.lastBlock}"]`);
    if (!el) return;
    setType(el, e.target.value);
    placeCaret(el, true);
    changed(true);
  }
  if (e.target.id === "finds") { S.ui.find.scope = e.target.value; S.ui.find.i = 0; findRun(); }
  if (e.target.dataset?.f === "gender") { const p = P(), [, id] = doc().split(":"); p.chars.find((y) => y.id === id).gender = e.target.value; dirty(); }
});
document.addEventListener("selectionchange", () => {
  const ed = $("#ed");
  if (!ed) return;
  const el = caretBlock();
  if (el) {
    S.ui.lastBlock = el.dataset.id;
    const sel = $("#tsel");
    if (sel && sel.value !== el.dataset.t) sel.value = el.dataset.t;
    const bs = $$(".b", ed);
    let i = bs.indexOf(el);
    while (i >= 0 && bs[i].dataset.t !== "sh") i -= 1;
    const sc = i >= 0 ? bs[i].dataset.id : null;
    if (sc !== S.ui.curScene && kindOf(doc()) !== "synopsis") {
      S.ui.curScene = sc;
      updateChatCtx();
      $$(".scn").forEach((x) => x.classList.toggle("cur", x.dataset.sc === sc));
    }
    const s = getSelection();
    if (!s.isCollapsed) { S.ui.selText = s.toString().trim().slice(0, 400); drawChip(); }
  }
  showRvbar();
});

// Перетаскивание: сцены в навигаторе и на карточках, документы — в корзину
let DRAG = null;
document.addEventListener("dragstart", (e) => {
  const sc = e.target.closest?.("[data-dk=scene]"), ti = e.target.closest?.(".ti[draggable]");
  if (sc) { flushEditor(); DRAG = { kind: "scene", id: sc.dataset.drop }; sc.classList.add("dragging"); }
  else if (ti) DRAG = { kind: "doc", id: ti.dataset.doc };
  else return;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", DRAG.id);
});
document.addEventListener("dragover", (e) => {
  if (!DRAG) return;
  $$(".drop-before, .ti.drop").forEach((x) => x.classList.remove("drop-before", "drop"));
  if (DRAG.kind === "doc") { const t = e.target.closest?.('.ti[data-doc="trash"]'); if (t) { e.preventDefault(); t.classList.add("drop"); } return; }
  const t = e.target.closest?.("[data-dk]");
  if (t && t.dataset.drop !== DRAG.id) { e.preventDefault(); t.classList.add("drop-before"); }
});
document.addEventListener("drop", (e) => {
  if (!DRAG) return;
  e.preventDefault();
  const d = DRAG;
  DRAG = null;
  if (d.kind === "doc") { if (e.target.closest('.ti[data-doc="trash"]')) deleteDoc(d.id); return; }
  const t = e.target.closest("[data-dk]");
  if (!t || t.dataset.drop === d.id) return;
  const target = t.dataset.drop ? { id: t.dataset.drop, kind: t.dataset.dk } : null;
  if (target && target.kind === "act" && !target.id) { const first = scenesOf(P().sp.blocks).find((s) => s.kind === "scene"); moveScene(d.id, first && first.id !== d.id ? { id: first.id, kind: "scene" } : null); }
  else moveScene(d.id, target);
  dirty();
  renderNav();
  renderWs();
  toast("Сцена переставлена — текст переехал вместе с ней.");
});
document.addEventListener("dragend", () => { DRAG = null; $$(".dragging, .drop-before, .ti.drop").forEach((x) => x.classList.remove("dragging", "drop-before", "drop")); });
addEventListener("resize", () => { if (S.ui.thread && $("#ed")) renderThread(); $(".rvbar") && showRvbar(); });

if (!location.hash) location.replace("#auth");
route();
