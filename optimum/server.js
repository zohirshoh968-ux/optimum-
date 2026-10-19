// OPTIMUM o'quv markazi — zero-dependency Node.js server. Ma'lumotlar data/*.json fayllarida.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 3000;
const IS_VERCEL = !!process.env.VERCEL;

// Vercel serverless muhitida /tmp papkasi yozish uchun ruxsat etilgan yagona papka
const DATA = IS_VERCEL ? path.join('/tmp', 'optimum_data') : path.join(__dirname, 'data');
const PUB = path.join(__dirname, 'public');
const UPLOADS = IS_VERCEL ? path.join('/tmp', 'optimum_uploads') : path.join(PUB, 'uploads');

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

// Agar Vercelda ishlayotgan bo'lsa, loyihadagi data/*.json fayllarini /tmp ga ko'chirib olamiz
const SEED_DATA = path.join(__dirname, 'data');
if (IS_VERCEL && fs.existsSync(SEED_DATA)) {
  try {
    fs.readdirSync(SEED_DATA).forEach(f => {
      const dest = path.join(DATA, f);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(path.join(SEED_DATA, f), dest);
      }
    });
  } catch (err) {
    console.warn('Seed data nusxalashda ogohlantirish:', err.message);
  }
}

const uid = () => crypto.randomBytes(6).toString('hex'), now = () => new Date().toISOString();

// ---- Boshlang'ich ma'lumotlar (fayl yo'q bo'lsa yaratiladi) ----
const C = (icon, uz, ru, en, d) => ({ id: uid(), icon, name_uz: uz, name_ru: ru, name_en: en, desc: d });
const T = (name, subject, exp, photo) => ({ id: uid(), name, subject, exp, photo });
const seed = {
  courses: [
    C('fa-brands fa-python', 'IT dasturlash (Python)', 'IT программирование (Python)', 'IT programming (Python)', 'Noldan professional dasturchigacha.'),
    C('fa-code', 'Frontend', 'Фронтенд', 'Frontend', 'HTML, CSS, JavaScript va zamonaviy veb.'),
    C('fa-palette', 'Grafik dizayn', 'Графический дизайн', 'Graphic design', 'Photoshop, Figma va ijodiy dizayn.'),
    C('fa-language', 'Ingliz tili', 'Английский язык', 'English', 'IELTS va CEFR darajalariga tayyorlov.'),
    C('fa-comments', 'Rus tili', 'Русский язык', 'Russian', 'Gaplashuv va grammatika, CEFR tayyorlov.'),
    C('fa-moon', 'Arab tili', 'Арабский язык', 'Arabic', 'Arab tilini bosqichma-bosqich o\'rganing.'),
    C('fa-square-root-variable', 'Matematika', 'Математика', 'Mathematics', 'Chuqur bilim va xalqaro imtihonlar.'),
    C('fa-dna', 'Biologiya', 'Биология', 'Biology', 'Test va olimpiadalarga tayyorlov.')
  ],
  teachers: [
    T('Mardonaliyev Olloyor', 'Ingliz tili', 'Mentor · IELTS 7+ · CEFR C1', '/img/olloyor.jpg'),
    T('Xolbotayev Xudoybergan', 'Ingliz tili', 'Mentor · IELTS 7+', '/img/xudoybergan.jpg'),
    T('Hasanboyev Husniddin', 'Matematika', 'Mentor · GRE xalqaro sertifikat', '/img/husniddin.jpg'),
    T('Qilichbek Abduolimov', 'Rus tili', 'Mentor · CEFR C1', '/img/qilichbek.jpg'),
    T('Turdaliyev Ahmadullo', 'Arab tili', 'Mentor · CEFR B1', '/img/ahmadullo.jpg'),
    T("Ne'matov Isfandiyor", 'Biologiya', 'Mentor', '/img/isfandiyor.jpg'),
    T('Ergashov Feruzbek', 'Dasturlash', 'Junior', '/img/feruzbek.jpg')
  ],
  announcements: [{ id: uid(), title: "OPTIMUM'ga xush kelibsiz!", text: "Yangi guruhlarga qabul boshlandi. Kursga yoziling!", date: now() }],
  tests: [{ id: uid(), question: "2 + 2 × 2 = ?", options: ['4', '6', '8', '10'], correct: 1, level: 'easy', subject: '' }],
  users: [], applications: [], messages: [], progress: [], results: [],
  settings: { pin: '2013' }
};
seed.tests[0].subject = seed.courses[6].id; // namunaviy test: Matematika

const file = n => path.join(DATA, n + '.json');
const memoryCache = {};

const load = n => {
  if (memoryCache[n]) return memoryCache[n];
  const fp = file(n);
  if (!fs.existsSync(fp)) {
    // Agar fayl /tmp da bo'lmasa, seed_data dan tekshiramiz
    const origFp = path.join(__dirname, 'data', n + '.json');
    if (fs.existsSync(origFp)) {
      try {
        const d = JSON.parse(fs.readFileSync(origFp, 'utf8'));
        memoryCache[n] = d;
        save(n, d);
        return d;
      } catch (e) {}
    }
    save(n, seed[n]);
    memoryCache[n] = seed[n];
    return seed[n];
  }
  try {
    const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
    memoryCache[n] = d;
    return d;
  } catch (e) {
    return seed[n] || [];
  }
};

const save = (n, d) => {
  memoryCache[n] = d;
  try {
    fs.writeFileSync(file(n), JSON.stringify(d, null, 2));
  } catch (err) {
    console.warn(`[SAVE WARN] ${n}.json fayliga yozishda xatolik:`, err.message);
  }
};

Object.keys(seed).forEach(load);

const tokens = new Set();
const send = (res, code, obj) => {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-token'
  });
  res.end(JSON.stringify(obj));
};

const body = req => new Promise(r => {
  let b = '';
  req.on('data', c => { b += c; if (b.length > 8e6) req.destroy(); });
  req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } });
});

const phoneOk = p => /^\+998\d{9}$/.test(String(p).replace(/\s/g, ''));
const EDIT = ['courses', 'teachers', 'announcements', 'tests'], DEL = [...EDIT, 'users', 'applications', 'messages', 'progress'];

function ranking() {
  const best = {};
  load('results').forEach(r => { const k = r.userId + '|' + r.testId; if (!best[k] || r.points > best[k].points) best[k] = r; });
  const sum = {}; Object.values(best).forEach(r => sum[r.userId] = (sum[r.userId] || 0) + r.points);
  const users = load('users');
  return Object.entries(sum).map(([id, points]) => {
    const u = users.find(x => x.id === id);
    return u && { name: u.name + ' ' + u.surname, points };
  }).filter(Boolean).sort((a, b) => b.points - a.points);
}

async function api(req, res, url) {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-token'
    });
    return res.end();
  }

  const m = req.method, p = url.split('/').filter(Boolean).slice(1), b = m === 'GET' ? {} : await body(req);

  if (m === 'GET' && p[0] === 'public') {
    return send(res, 200, {
      courses: load('courses'),
      teachers: load('teachers'),
      announcements: load('announcements'),
      tests: load('tests').map(t => ({ id: t.id, question: t.question, options: t.options, subject: t.subject || '', level: t.level || 'easy' })),
      ranking: ranking()
    });
  }

  if (m === 'POST' && p[0] === 'register') {
    if (!b.name || !b.surname || !phoneOk(b.phone)) return send(res, 400, { error: "Ma'lumot noto'g'ri (+998XXXXXXXXX formatida bo'lsin)" });
    const us = load('users'), phone = b.phone.replace(/\s/g, '');
    let u = us.find(x => x.phone === phone);
    if (!u) {
      u = { id: uid(), name: b.name.trim(), surname: b.surname.trim(), phone, date: now() };
      us.push(u);
      save('users', us);
    }
    return send(res, 200, u);
  }

  if (m === 'GET' && p[0] === 'me') {
    const id = p[1], u = load('users').find(x => x.id === id);
    if (!u) return send(res, 404, { error: 'topilmadi' });
    const f = n => load(n).filter(x => x.userId === id);
    return send(res, 200, { user: u, applications: f('applications'), messages: f('messages'), progress: f('progress'), results: f('results') });
  }

  if (m === 'POST' && p[0] === 'apply') {
    const u = load('users').find(x => x.id === b.userId), c = load('courses').find(x => x.id === b.courseId);
    if (!u || !c) return send(res, 400, { error: 'xato' });
    const as = load('applications');
    if (as.some(a => a.userId === u.id && a.courseId === c.id)) return send(res, 409, { error: 'already' });
    as.push({ id: uid(), userId: u.id, courseId: c.id, course: c.name_uz, name: u.name, surname: u.surname, phone: u.phone, date: now() });
    save('applications', as);
    return send(res, 200, { ok: 1 });
  }

  if (m === 'POST' && p[0] === 'msg') {
    if (!load('users').some(x => x.id === b.userId) || !String(b.text || '').trim()) return send(res, 400, { error: 'xato' });
    const ms = load('messages');
    ms.push({ id: uid(), userId: b.userId, from: 'user', text: b.text.trim(), date: now() });
    save('messages', ms);
    return send(res, 200, { ok: 1 });
  }

  if (m === 'POST' && p[0] === 'test') {
    const t = load('tests').find(x => x.id === p[1]);
    if (!t || !load('users').some(x => x.id === b.userId)) return send(res, 400, { error: 'xato' });
    const ok = Number(b.answer) === t.correct, rs = load('results');
    rs.push({ id: uid(), userId: b.userId, testId: t.id, points: ok ? 10 : 0, date: now() });
    save('results', rs);
    return send(res, 200, { correct: ok, right: t.correct, ranking: ranking() });
  }

  // ---- Admin ----
  if (m === 'POST' && p[1] === 'login' && p[0] === 'admin') {
    if (b.pin !== load('settings').pin) return send(res, 401, { error: "PIN noto'g'ri" });
    const t = uid() + uid();
    tokens.add(t);
    return send(res, 200, { token: t });
  }

  if (p[0] !== 'admin' || !tokens.has(req.headers['x-token'])) return send(res, 401, { error: 'auth' });

  if (m === 'GET' && p[1] === 'all') {
    const o = {};
    Object.keys(seed).filter(k => k !== 'settings').forEach(k => o[k] = load(k));
    return send(res, 200, o);
  }

  if (m === 'POST' && p[1] === 'pin') {
    const s = load('settings');
    if (b.old !== s.pin || !/^\d{4,8}$/.test(b.new || '')) return send(res, 400, { error: "Eski PIN xato yoki yangi PIN 4-8 raqam bo'lishi kerak" });
    s.pin = b.new;
    save('settings', s);
    tokens.clear();
    return send(res, 200, { ok: 1 });
  }

  if (m === 'POST' && p[1] === 'upload') {
    const mt = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(b.dataUrl || '');
    if (!mt) return send(res, 400, { error: 'rasm xato' });
    const name = 'uploads/' + uid() + '.' + (mt[1] === 'jpeg' ? 'jpg' : mt[1]);
    try {
      fs.writeFileSync(path.join(UPLOADS, path.basename(name)), Buffer.from(mt[2], 'base64'));
    } catch (e) {
      console.warn('Upload error:', e.message);
    }
    return send(res, 200, { url: '/' + name });
  }

  if (m === 'POST' && p[1] === 'progress') {
    const ps = load('progress');
    ps.push({ id: uid(), userId: b.userId, status: b.status, date: now() });
    save('progress', ps);
    return send(res, 200, { ok: 1 });
  }

  if (m === 'POST' && p[1] === 'reply') {
    const ms = load('messages');
    ms.push({ id: uid(), userId: b.userId, from: 'admin', text: b.text, date: now() });
    save('messages', ms);
    return send(res, 200, { ok: 1 });
  }

  if (m === 'POST' && EDIT.includes(p[1])) {
    const list = load(p[1]), item = b;
    const i = list.findIndex(x => x.id === item.id);
    if (i >= 0) list[i] = { ...list[i], ...item };
    else { item.id = uid(); if (p[1] === 'announcements') item.date = now(); list.push(item); }
    save(p[1], list);
    return send(res, 200, item);
  }

  if (m === 'DELETE' && DEL.includes(p[1])) {
    save(p[1], load(p[1]).filter(x => x.id !== p[2]));
    if (p[1] === 'users') ['applications', 'messages', 'progress', 'results'].forEach(n => save(n, load(n).filter(x => x.userId !== p[2])));
    return send(res, 200, { ok: 1 });
  }

  send(res, 404, { error: 'yo\'q' });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

const handler = (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  
  if (url.startsWith('/api/')) {
    return api(req, res, url).catch(e => send(res, 500, { error: String(e) }));
  }

  // Handle uploaded images in /uploads/...
  if (url.startsWith('/uploads/')) {
    const fn = path.basename(url);
    const fpTmp = path.join(UPLOADS, fn);
    const fpPub = path.join(PUB, 'uploads', fn);
    const fp = fs.existsSync(fpTmp) ? fpTmp : fpPub;
    if (fs.existsSync(fp)) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
      return fs.createReadStream(fp).pipe(res);
    }
  }

  // Handle direct /admin URL
  if (url === '/admin' || url === '/admin/') {
    const indexFp = path.join(PUB, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(indexFp).pipe(res);
  }

  const fp = path.join(PUB, url === '/' ? 'index.html' : url);
  if (!fp.startsWith(PUB) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    // SPA fallback
    const indexFp = path.join(PUB, 'index.html');
    if (fs.existsSync(indexFp)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(indexFp).pipe(res);
    }
    res.writeHead(404);
    return res.end('404');
  }

  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
};

if (require.main === module || !process.env.VERCEL) {
  http.createServer(handler).listen(PORT, () => console.log('OPTIMUM sayti: http://localhost:' + PORT));
}

module.exports = handler;
