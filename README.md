# 🌿 EcoBank Sampah — Backend API

Sistem manajemen bank sampah dengan backend **Flask + SQLite** dan frontend terintegrasi.

---

## 📁 Struktur Folder

```
banksampah-be/
├── run.py              ← Jalankan ini!
├── app.py              ← Flask app utama
├── auth.py             ← Middleware JWT
├── database.py         ← Schema & seed data SQLite
├── requirements.txt    ← Dependensi Python
├── banksampah.db       ← Database SQLite (auto-dibuat)
├── routes/
│   ├── auth_routes.py      ← /api/auth/*
│   ├── user_routes.py      ← /api/user/*
│   ├── admin_routes.py     ← /api/admin/*
│   └── pemasok_routes.py   ← /api/pemasok/*
└── static/
    ├── index.html      ← Frontend (auto-disajikan)
    ├── style.css
    └── app.js
```

---

## 🚀 Cara Menjalankan

### 1. Install dependensi
```bash
pip install flask pyjwt werkzeug
```

### 2. Jalankan server
```bash
python3 run.py
```

### 3. Buka browser
```
http://localhost:5000
```

---

## 🔑 Akun Demo

| Role    | Email                | Password  |
|---------|----------------------|-----------|
| Nasabah | budi@mail.com        | 123456    |
| Admin   | admin@eco.com        | admin123  |
| Pemasok | pemasok@mail.com     | 123456    |

---

## 📡 API Endpoints

### Auth
| Method | Endpoint            | Deskripsi              |
|--------|---------------------|------------------------|
| POST   | /api/auth/login     | Login (semua role)     |
| POST   | /api/auth/register  | Daftar nasabah baru    |
| GET    | /api/auth/me        | Cek token aktif        |

**Body Login:**
```json
{
  "email": "budi@mail.com",
  "password": "123456",
  "role": "user"
}
```

### Nasabah (Bearer Token required)
| Method | Endpoint                  | Deskripsi               |
|--------|---------------------------|-------------------------|
| GET    | /api/user/profile         | Data profil             |
| PUT    | /api/user/profile         | Update profil           |
| GET    | /api/user/balance         | Cek saldo               |
| GET    | /api/user/deposits        | Riwayat setoran         |
| GET    | /api/user/withdrawals     | Riwayat penarikan       |
| POST   | /api/user/withdrawals     | Ajukan penarikan        |
| GET    | /api/user/trash-prices    | Harga sampah aktif      |
| GET    | /api/user/sembako         | Daftar sembako          |

### Admin
| Method | Endpoint                           | Deskripsi               |
|--------|------------------------------------|-------------------------|
| GET    | /api/admin/dashboard               | Statistik dashboard     |
| GET    | /api/admin/nasabah                 | List semua nasabah      |
| POST   | /api/admin/nasabah                 | Tambah nasabah          |
| PUT    | /api/admin/nasabah/:id             | Edit nasabah            |
| PATCH  | /api/admin/nasabah/:id/toggle      | Aktif/nonaktif          |
| DELETE | /api/admin/nasabah/:id             | Hapus nasabah           |
| GET    | /api/admin/trash-types             | List jenis sampah       |
| POST   | /api/admin/trash-types             | Tambah jenis sampah     |
| PUT    | /api/admin/trash-types/:id         | Edit jenis sampah       |
| PATCH  | /api/admin/trash-types/:id/toggle  | Aktif/nonaktif          |
| DELETE | /api/admin/trash-types/:id         | Hapus jenis sampah      |
| GET    | /api/admin/deposits                | List semua setoran      |
| POST   | /api/admin/deposits                | Input setoran baru      |
| GET    | /api/admin/withdrawals             | List semua penarikan    |
| PATCH  | /api/admin/withdrawals/:id/approve | Setujui penarikan       |
| PATCH  | /api/admin/withdrawals/:id/reject  | Tolak penarikan         |
| GET    | /api/admin/sembako                 | List sembako            |
| PUT    | /api/admin/sembako/:id             | Edit sembako            |
| GET    | /api/admin/transactions            | Semua transaksi         |
| GET    | /api/admin/pemasok                 | List pemasok            |
| POST   | /api/admin/pemasok                 | Tambah pemasok          |
| PUT    | /api/admin/pemasok/:id             | Edit pemasok            |
| PATCH  | /api/admin/pemasok/:id/toggle      | Aktif/nonaktif          |

### Pemasok
| Method | Endpoint                            | Deskripsi               |
|--------|-------------------------------------|-------------------------|
| GET    | /api/pemasok/dashboard              | Dashboard pemasok       |
| GET    | /api/pemasok/sembako                | List produk milik sendiri|
| PUT    | /api/pemasok/sembako/:id            | Edit nama & harga       |
| PATCH  | /api/pemasok/sembako/:id/stock      | Update stok             |
| PATCH  | /api/pemasok/sembako/:id/price      | Update harga            |
| GET    | /api/pemasok/requests               | Semua permintaan        |
| PATCH  | /api/pemasok/requests/:id/approve   | Setujui permintaan      |
| PATCH  | /api/pemasok/requests/:id/reject    | Tolak permintaan        |

---

## 🔐 Autentikasi

Semua endpoint (kecuali `/api/auth/*`) memerlukan header:
```
Authorization: Bearer <token>
```

Token JWT berlaku **24 jam** sejak login.

---

## 💾 Database

- Engine: **SQLite** (file `banksampah.db`)
- Auto-dibuat saat pertama kali dijalankan
- Data seed otomatis diisi jika database kosong
- Password di-hash menggunakan **Werkzeug PBKDF2-SHA256**

---

## ⚙️ Environment Variables

| Variable    | Default              | Deskripsi         |
|-------------|----------------------|-------------------|
| PORT        | 5000                 | Port server       |
| JWT_SECRET  | ecobank-sampah-...   | Secret key JWT    |

```bash
PORT=8080 python3 run.py
```
