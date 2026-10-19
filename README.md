# OPTIMUM o'quv markazi — veb-sayt

Qora–sariq premium dizaynli o'quv markazi sayti. Frontend (bitta `index.html`) va oddiy Node.js backend, ma'lumotlar **JSON fayllarida** saqlanadi. Tashqi paketlar (Express va boshqalar) ishlatilmagan.

## Ishga tushirish

```bash
npm start        # yoki: node server.js
```

Keyin brauzerda http://localhost:3000 ni oching. Node.js 16+ kerak, `npm install` shart emas.

- **Admin panel:** manzil oxiriga `#admin` yozing (masalan `http://localhost:3000/#admin`). Boshlang'ich PIN: `2013` (admin paneldagi "PIN kod" bo'limida o'zgartiriladi).
- Port: `PORT` o'zgaruvchisidan olinadi, bo'lmasa `3000`.

## Loyiha tuzilishi

```
optimum/
├── package.json
├── server.js            # backend (http, fs, path, crypto)
├── data/                # JSON "baza"
│   ├── users.json           # ro'yxatdan o'tgan o'quvchilar
│   ├── courses.json         # kurslar
│   ├── teachers.json        # ustozlar
│   ├── announcements.json   # e'lonlar
│   ├── tests.json           # testlar (fan, daraja, savol, variantlar)
│   ├── results.json         # test natijalari
│   ├── applications.json    # kursga arizalar
│   ├── messages.json        # xabarlar (o'quvchi ↔ admin)
│   ├── progress.json        # kunlik natijalar ("Farzandim natijasi")
│   └── settings.json        # admin PIN
└── public/
    ├── index.html       # butun frontend (HTML + CSS + JS)
    ├── favicon.png
    ├── img/             # logo va ustozlar rasmlari
    └── uploads/         # admin yuklagan rasmlar
```

## Imkoniyatlar

**Foydalanuvchi tomoni**
- Birinchi kirishda ro'yxatdan o'tish (ism, familya, `+998` telefon tekshiruvi).
- **Kurslar:** kartalar, "Kursga yozilish" tugmasi (ariza adminga boradi).
- **Ustozlar:** rasm, ism, fan, daraja.
- **Mening kurslarim** va **Farzandim natijasi** (yashil / sariq / qizil belgilar, sana bilan).
- **Testlar:** fan → Oson/Qiyin → savollar. Har to'g'ri javob +10 ball.
- **O'quvchilar natijasi:** reyting, 1–3 o'rinlar podiumda.
- **E'lonlar** (rasm bilan), **Adminga xabar**, **Admindan xabar**.
- Tillar: O'zbek / Русский / English.
- Mobil, planshet va kompyuterga moslashgan, mobilda burger menyu.

**Admin panel** (PIN bilan)
- Statistika, o'quvchilar (qidiruv, o'chirish).
- Kurslar, ustozlar, e'lonlar, testlar: qo'shish / tahrirlash / o'chirish, galereyadan rasm yuklash.
- Arizalar, xabarlar (javob yozish), har bir o'quvchiga natija qo'shish, PIN o'zgartirish.

## API (qisqacha)

| Metod | Yo'l | Vazifasi |
|---|---|---|
| GET | `/api/public` | kurslar, ustozlar, e'lonlar, testlar (javobsiz), reyting |
| POST | `/api/register` | ro'yxatdan o'tish |
| GET | `/api/me/:id` | o'quvchining arizalari, xabarlari, natijalari |
| POST | `/api/apply` | kursga yozilish |
| POST | `/api/msg` | adminga xabar |
| POST | `/api/test/:id` | test javobini tekshirish |
| POST | `/api/admin/login` | PIN bilan kirish (token qaytaradi) |
| * | `/api/admin/...` | admin amallari (`x-token` sarlavhasi bilan) |

Test javoblari serverda tekshiriladi: to'g'ri javob brauzerga yuborilmaydi.

## Joylashtirish (deploy)

- **VPS (tavsiya):** `pm2 start server.js --name optimum`, oldiga `nginx` va `certbot` (HTTPS) qo'ying.
- **Render va shunga o'xshash bepul hostlar:** Build Command `npm install`, Start Command `npm start`. Bepul tarifda doimiy disk yo'q, shuning uchun `data/` va `uploads/` yangilanishda yo'qolishi mumkin.
- Zaxira uchun `data/` va `public/uploads/` papkalaridan vaqti-vaqti bilan nusxa oling.

## Xavfsizlik eslatmalari

- Admin PINni `2013` dan o'zgartiring va saytni faqat HTTPS orqali ishlating.
- O'quvchi identifikatori brauzerning `localStorage` ida saqlanadi (login/parol yo'q).
- PIN uchun urinishlar soni cheklanmagan, ochiq internetda ishlatishdan oldin buni hisobga oling.

## Aloqa

- Telegram: [@optimum_LA](https://t.me/optimum_LA)
- Instagram: [optimum.la](https://instagram.com/optimum.la)
- Telefon: +998 99 998 64 21

© OPTIMUM o'quv markazi