// OPTIMUM o'quv markazi — Vercel + in-memory persistent store
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 3000;

const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR  = IS_VERCEL ? '/tmp/optimum_data' : path.join(__dirname, 'data');
const PUB       = path.join(__dirname, 'public');
const UPLOADS   = IS_VERCEL ? '/tmp/optimum_uploads' : path.join(PUB, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS,  { recursive: true });

const uid = () => crypto.randomBytes(6).toString('hex');
const now = () => new Date().toISOString();

// ─── Seed ma'lumotlar ───────────────────────────────────────────────────────
const C = (icon, uz, ru, en, d) => ({ id: uid(), icon, name_uz: uz, name_ru: ru, name_en: en, desc: d });
const T = (name, subject, exp, photo) => ({ id: uid(), name, subject, exp, photo });
const SEED = {
  courses: [
    C('fa-brands fa-python','IT dasturlash (Python)','IT программирование (Python)','IT programming (Python)','Noldan professional dasturchigacha.'),
    C('fa-code','Frontend','Фронтенд','Frontend','HTML, CSS, JavaScript va zamonaviy veb.'),
    C('fa-palette','Grafik dizayn','Графический дизайн','Graphic design','Photoshop, Figma va ijodiy dizayn.'),
    C('fa-language','Ingliz tili','Английский язык','English','IELTS va CEFR darajalariga tayyorlov.'),
    C('fa-comments','Rus tili','Русский язык','Russian','Gaplashuv va grammatika, CEFR tayyorlov.'),
    C('fa-moon','Arab tili','Арабский язык','Arabic','Arab tilini bosqichma-bosqich o\'rganing.'),
    C('fa-square-root-variable','Matematika','Математика','Mathematics','Chuqur bilim va xalqaro imtihonlar.'),
    C('fa-dna','Biologiya','Биология','Biology','Test va olimpiadalarga tayyorlov.')
  ],
  teachers: [
    T('Mardonaliyev Olloyor','Ingliz tili','Mentor · IELTS 7+ · CEFR C1','/img/olloyor.jpg'),
    T('Xolbotayev Xudoybergan','Ingliz tili','Mentor · IELTS 7+','/img/xudoybergan.jpg'),
    T('Hasanboyev Husniddin','Matematika','Mentor · GRE xalqaro sertifikat','/img/husniddin.jpg'),
    T('Qilichbek Abduolimov','Rus tili','Mentor · CEFR C1','/img/qilichbek.jpg'),
    T('Turdaliyev Ahmadullo','Arab tili','Mentor · CEFR B1','/img/ahmadullo.jpg'),
    T("Ne'matov Isfandiyor",'Biologiya','Mentor','/img/isfandiyor.jpg'),
    T('Ergashov Feruzbek','Dasturlash','Junior','/img/feruzbek.jpg')
  ],
  announcements:[{id:uid(),title:"OPTIMUM'ga xush kelibsiz!",text:"Yangi guruhlarga qabul boshlandi. Kursga yoziling!",date:now()}],
  tests:[{id:uid(),question:"2 + 2 × 2 = ?",options:['4','6','8','10'],correct:1,level:'easy',subject:''}],
  users:[],applications:[],messages:[],progress:[],results:[],
  settings:{pin:'2013'}
};

// ─── GLOBAL MEMORY STORE (Vercel'da issiq instancelar orasida yashaydi) ──────
// Fayl o'qilganda memoryCACHE ga yuklanadi; faylga ham yoziladi (qo'shimcha backup)
const GLOBAL_KEY = '__OPTIMUM_STORE__';
if (!global[GLOBAL_KEY]) {
  global[GLOBAL_KEY] = {};
}
const MEM = global[GLOBAL_KEY];

// Seed JSON fayllarini /tmp ga ko'chirish (birinchi ishga tushganda)
const SEED_SRC = path.join(__dirname, 'data');
if (IS_VERCEL && fs.existsSync(SEED_SRC)) {
  try {
    fs.readdirSync(SEED_SRC).forEach(f => {
      const dest = path.join(DATA_DIR, f);
      if (!fs.existsSync(dest)) fs.copyFileSync(path.join(SEED_SRC, f), dest);
    });
  } catch {}
}

const file = n => path.join(DATA_DIR, n + '.json');

const load = n => {
  if (MEM[n]) return MEM[n];                          // 1) xotiradan
  const fp = file(n);
  if (fs.existsSync(fp)) {
    try { MEM[n] = JSON.parse(fs.readFileSync(fp,'utf8')); return MEM[n]; } catch {}
  }
  MEM[n] = JSON.parse(JSON.stringify(SEED[n]));       // 3) seed
  save(n, MEM[n]);
  return MEM[n];
};

const save = (n, d) => {
  MEM[n] = d;
  try { fs.writeFileSync(file(n), JSON.stringify(d, null, 2)); } catch {}
};

// Barcha collectionlarni yuklash
Object.keys(SEED).forEach(load);

// ─── Yordamchi ───────────────────────────────────────────────────────────────
const tokens  = new Set();
const phoneOk = p => /^\+998\d{9}$/.test(String(p).replace(/\s/g,''));
const EDIT    = ['courses','teachers','announcements','tests'];
const DEL     = [...EDIT,'users','applications','messages','progress'];

const send = (res, code, obj) => {
  res.writeHead(code, {
    'Content-Type':'application/json; charset=utf-8',
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type,x-token'
  });
  res.end(JSON.stringify(obj));
};
const body = req => new Promise(r => {
  let b='';
  req.on('data',c=>{b+=c;if(b.length>8e6)req.destroy();});
  req.on('end',()=>{try{r(JSON.parse(b||'{}'));}catch{r({});}});
});

function ranking() {
  const best={};
  load('results').forEach(r=>{const k=r.userId+'|'+r.testId;if(!best[k]||r.points>best[k].points)best[k]=r;});
  const sum={};Object.values(best).forEach(r=>sum[r.userId]=(sum[r.userId]||0)+r.points);
  const users=load('users');
  return Object.entries(sum).map(([id,points])=>{
    const u=users.find(x=>x.id===id);return u&&{name:u.name+' '+u.surname,points};
  }).filter(Boolean).sort((a,b)=>b.points-a.points);
}

// ─── API ─────────────────────────────────────────────────────────────────────
async function api(req, res, url) {
  if (req.method==='OPTIONS') {
    res.writeHead(200,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,x-token'});
    return res.end();
  }
  const m=req.method, p=url.split('/').filter(Boolean).slice(1), b=m==='GET'?{}:await body(req);

  // Public
  if (m==='GET'&&p[0]==='public') return send(res,200,{
    courses:load('courses'),teachers:load('teachers'),announcements:load('announcements'),
    tests:load('tests').map(t=>({id:t.id,question:t.question,options:t.options,subject:t.subject||'',level:t.level||'easy'})),
    ranking:ranking()
  });

  // Ro'yxat — BIR MARTA (telefon bo'yicha)
  if (m==='POST'&&p[0]==='register') {
    if (!b.name||!b.surname||!phoneOk(b.phone)) return send(res,400,{error:"Ma'lumot noto'g'ri (+998XXXXXXXXX)"});
    const us=load('users'), phone=b.phone.replace(/\s/g,'');
    let u=us.find(x=>x.phone===phone);
    if (!u) { u={id:uid(),name:b.name.trim(),surname:b.surname.trim(),phone,date:now()};us.push(u);save('users',us); }
    return send(res,200,u);
  }

  // Foydalanuvchi ma'lumotlari
  if (m==='GET'&&p[0]==='me') {
    const u=load('users').find(x=>x.id===p[1]);
    if (!u) return send(res,404,{error:'topilmadi'});
    const f=n=>load(n).filter(x=>x.userId===p[1]);
    return send(res,200,{user:u,applications:f('applications'),messages:f('messages'),progress:f('progress'),results:f('results')});
  }

  // Kursga yozilish
  if (m==='POST'&&p[0]==='apply') {
    const u=load('users').find(x=>x.id===b.userId),c=load('courses').find(x=>x.id===b.courseId);
    if (!u||!c) return send(res,400,{error:'xato'});
    const as=load('applications');
    if (as.some(a=>a.userId===u.id&&a.courseId===c.id)) return send(res,409,{error:'already'});
    as.push({id:uid(),userId:u.id,courseId:c.id,course:c.name_uz,name:u.name,surname:u.surname,phone:u.phone,date:now()});
    save('applications',as);return send(res,200,{ok:1});
  }

  // Xabar
  if (m==='POST'&&p[0]==='msg') {
    if (!load('users').some(x=>x.id===b.userId)||!String(b.text||'').trim()) return send(res,400,{error:'xato'});
    const ms=load('messages');ms.push({id:uid(),userId:b.userId,from:'user',text:b.text.trim(),date:now()});
    save('messages',ms);return send(res,200,{ok:1});
  }

  // Test
  if (m==='POST'&&p[0]==='test') {
    const t=load('tests').find(x=>x.id===p[1]);
    if (!t||!load('users').some(x=>x.id===b.userId)) return send(res,400,{error:'xato'});
    const ok=Number(b.answer)===t.correct,rs=load('results');
    rs.push({id:uid(),userId:b.userId,testId:t.id,points:ok?10:0,date:now()});
    save('results',rs);return send(res,200,{correct:ok,right:t.correct,ranking:ranking()});
  }

  // Admin login
  if (m==='POST'&&p[1]==='login'&&p[0]==='admin') {
    if (b.pin!==load('settings').pin) return send(res,401,{error:"PIN noto'g'ri"});
    const t=uid()+uid();tokens.add(t);return send(res,200,{token:t});
  }

  if (p[0]!=='admin'||!tokens.has(req.headers['x-token'])) return send(res,401,{error:'auth'});

  // Admin: barchasi
  if (m==='GET'&&p[1]==='all') {
    const o={};Object.keys(SEED).filter(k=>k!=='settings').forEach(k=>o[k]=load(k));return send(res,200,o);
  }

  // Admin: PIN
  if (m==='POST'&&p[1]==='pin') {
    const s=load('settings');
    if (b.old!==s.pin||!/^\d{4,8}$/.test(b.new||'')) return send(res,400,{error:"Eski PIN xato yoki yangi PIN 4-8 raqam"});
    s.pin=b.new;save('settings',s);tokens.clear();return send(res,200,{ok:1});
  }

  // Admin: Rasm yuklash
  if (m==='POST'&&p[1]==='upload') {
    const mt=/^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(b.dataUrl||'');
    if (!mt) return send(res,400,{error:'rasm xato'});
    const name=uid()+'.'+(mt[1]==='jpeg'?'jpg':mt[1]);
    try{fs.writeFileSync(path.join(UPLOADS,name),Buffer.from(mt[2],'base64'));}catch{}
    return send(res,200,{url:'/uploads/'+name});
  }

  // Admin: Natija
  if (m==='POST'&&p[1]==='progress') {
    const ps=load('progress');ps.push({id:uid(),userId:b.userId,status:b.status,date:now()});
    save('progress',ps);return send(res,200,{ok:1});
  }

  // Admin: Javob
  if (m==='POST'&&p[1]==='reply') {
    const ms=load('messages');ms.push({id:uid(),userId:b.userId,from:'admin',text:b.text,date:now()});
    save('messages',ms);return send(res,200,{ok:1});
  }

  // Admin: CRUD
  if (m==='POST'&&EDIT.includes(p[1])) {
    const list=load(p[1]),item=b,i=list.findIndex(x=>x.id===item.id);
    if (i>=0) list[i]={...list[i],...item};
    else{item.id=uid();if(p[1]==='announcements')item.date=now();list.push(item);}
    save(p[1],list);return send(res,200,item);
  }

  // Admin: O'chirish
  if (m==='DELETE'&&DEL.includes(p[1])) {
    save(p[1],load(p[1]).filter(x=>x.id!==p[2]));
    if (p[1]==='users') ['applications','messages','progress','results'].forEach(n=>save(n,load(n).filter(x=>x.userId!==p[2])));
    return send(res,200,{ok:1});
  }

  send(res,404,{error:"yo'q"});
}

// ─── Static fayl + SPA ───────────────────────────────────────────────────────
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
  '.svg':'image/svg+xml','.json':'application/json'};

const handler = (req,res) => {
  const url=decodeURIComponent(req.url.split('?')[0]);
  if (url.startsWith('/api/')) return api(req,res,url).catch(e=>send(res,500,{error:String(e)}));

  if (url.startsWith('/uploads/')) {
    const fn=path.basename(url);
    const fp=[path.join(UPLOADS,fn),path.join(PUB,'uploads',fn)].find(f=>fs.existsSync(f));
    if (fp){res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'application/octet-stream'});return fs.createReadStream(fp).pipe(res);}
  }

  const staticFp=path.join(PUB, url==='/'?'index.html':url.replace(/^\//,''));
  if (staticFp.startsWith(PUB)&&fs.existsSync(staticFp)&&!fs.statSync(staticFp).isDirectory()) {
    res.writeHead(200,{'Content-Type':MIME[path.extname(staticFp)]||'application/octet-stream'});
    return fs.createReadStream(staticFp).pipe(res);
  }

  // SPA fallback
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  fs.createReadStream(path.join(PUB,'index.html')).pipe(res);
};

http.createServer(handler).listen(PORT,()=>console.log('✅ OPTIMUM: http://localhost:'+PORT));
module.exports=handler;
