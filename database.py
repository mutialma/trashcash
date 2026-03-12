"""
database.py - Inisialisasi dan koneksi database SQLite untuk EcoBank Sampah
"""

import sqlite3
import os
from werkzeug.security import generate_password_hash

DB_PATH = os.path.join(os.path.dirname(__file__), 'banksampah.db')


def get_db():
    """Buat koneksi database baru per request."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Hasil query bisa diakses seperti dict
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Buat tabel dan isi data awal jika belum ada."""
    conn = get_db()
    cur = conn.cursor()

    # ─── TABEL USERS (Nasabah) ────────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            email       TEXT    NOT NULL UNIQUE,
            password    TEXT    NOT NULL,
            phone       TEXT,
            address     TEXT,
            balance     REAL    NOT NULL DEFAULT 0,
            role        TEXT    NOT NULL DEFAULT 'user',
            active      INTEGER NOT NULL DEFAULT 1,
            join_date   TEXT    NOT NULL DEFAULT (date('now','localtime')),
            created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
        )
    """)

    # ─── TABEL ADMINS ────────────────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            email       TEXT    NOT NULL UNIQUE,
            password    TEXT    NOT NULL,
            role        TEXT    NOT NULL DEFAULT 'admin',
            created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
        )
    """)

    # ─── TABEL PEMASOK ───────────────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS pemasok (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            email       TEXT    NOT NULL UNIQUE,
            password    TEXT    NOT NULL,
            phone       TEXT,
            address     TEXT,
            role        TEXT    NOT NULL DEFAULT 'pemasok',
            active      INTEGER NOT NULL DEFAULT 1,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
        )
    """)

    # ─── TABEL JENIS SAMPAH ──────────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS trash_types (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT    NOT NULL,
            icon          TEXT    NOT NULL DEFAULT '♻️',
            price_per_kg  REAL    NOT NULL,
            unit          TEXT    NOT NULL DEFAULT 'kg',
            active        INTEGER NOT NULL DEFAULT 1,
            created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
        )
    """)

    # ─── TABEL SEMBAKO ───────────────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sembako (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            icon        TEXT    NOT NULL DEFAULT '🛒',
            price       REAL    NOT NULL,
            unit        TEXT    NOT NULL DEFAULT 'kg',
            stock       REAL    NOT NULL DEFAULT 0,
            pemasok_id  INTEGER REFERENCES pemasok(id),
            created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
        )
    """)

    # ─── TABEL SETORAN ───────────────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS deposits (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id       INTEGER NOT NULL REFERENCES users(id),
            trash_type_id INTEGER NOT NULL REFERENCES trash_types(id),
            weight        REAL    NOT NULL,
            amount        REAL    NOT NULL,
            note          TEXT,
            deposit_date  TEXT    NOT NULL DEFAULT (date('now','localtime')),
            created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
        )
    """)

    # ─── TABEL PENARIKAN / PENUKARAN ─────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS withdrawals (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER NOT NULL REFERENCES users(id),
            type            TEXT    NOT NULL CHECK(type IN ('cash','sembako')),
            amount          REAL    NOT NULL,
            status          TEXT    NOT NULL DEFAULT 'pending'
                                    CHECK(status IN ('pending','approved','rejected')),
            note            TEXT,
            sembako_id      INTEGER REFERENCES sembako(id),
            sembako_name    TEXT,
            qty             REAL,
            request_date    TEXT    NOT NULL DEFAULT (date('now','localtime')),
            approved_date   TEXT,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
        )
    """)

    # ─── SEED DATA (hanya jika tabel kosong) ─────────────────────────────────
    _seed(cur)

    conn.commit()
    conn.close()
    print("✅  Database siap:", DB_PATH)


def _seed(cur):
    """Isi data awal."""

    # Admin
    if not cur.execute("SELECT 1 FROM admins WHERE email='admin@eco.com'").fetchone():
        cur.execute(
            "INSERT INTO admins (name, email, password) VALUES (?,?,?)",
            ('Admin Utama', 'admin@eco.com', generate_password_hash('admin123'))
        )

    # Pemasok
    if not cur.execute("SELECT 1 FROM pemasok WHERE email='pemasok@mail.com'").fetchone():
        cur.execute(
            "INSERT INTO pemasok (name, email, password, phone, address) VALUES (?,?,?,?,?)",
            ('Toko Makmur Jaya', 'pemasok@mail.com',
             generate_password_hash('123456'), '084567890123', 'Jl. Industri No.7')
        )

    # Nasabah contoh
    sample_users = [
        ('Budi Santoso',  'budi@mail.com',  '123456', '081234567890', 'Jl. Merdeka No.10', 85000),
        ('Siti Rahayu',   'siti@mail.com',  '123456', '082345678901', 'Jl. Pahlawan No.5', 42500),
        ('Ahmad Fauzi',   'ahmad@mail.com', '123456', '083456789012', 'Jl. Sudirman No.3', 120000),
    ]
    for name, email, pwd, phone, addr, bal in sample_users:
        if not cur.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
            cur.execute(
                "INSERT INTO users (name,email,password,phone,address,balance,join_date) VALUES (?,?,?,?,?,?,?)",
                (name, email, generate_password_hash(pwd), phone, addr, bal, '2024-01-15')
            )

    # Jenis sampah
    trash_seed = [
        ('Plastik PET',      '🧴', 3000,  'kg'),
        ('Kardus/Karton',    '📦', 1500,  'kg'),
        ('Kertas HVS',       '📄', 2000,  'kg'),
        ('Kaleng Aluminium', '🥫', 8000,  'kg'),
        ('Besi/Logam',       '🔩', 4000,  'kg'),
        ('Kaca/Botol',       '🍶', 500,   'kg'),
        ('Minyak Jelantah',  '🛢️', 4500,  'liter'),
        ('Elektronik Bekas', '📱', 10000, 'kg'),
    ]
    if not cur.execute("SELECT 1 FROM trash_types").fetchone():
        cur.executemany(
            "INSERT INTO trash_types (name,icon,price_per_kg,unit) VALUES (?,?,?,?)",
            trash_seed
        )

    # Sembako
    if not cur.execute("SELECT 1 FROM sembako").fetchone():
        pemasok = cur.execute("SELECT id FROM pemasok LIMIT 1").fetchone()
        pid = pemasok['id'] if pemasok else None
        sembako_seed = [
            ('Beras Premium', '🌾', 15000, 'kg',    250, pid),
            ('Gula Pasir',    '🍚', 18000, 'kg',    100, pid),
            ('Minyak Goreng', '🫙', 20000, 'liter',  80, pid),
            ('Telur Ayam',    '🥚', 30000, 'kg',     60, pid),
        ]
        cur.executemany(
            "INSERT INTO sembako (name,icon,price,unit,stock,pemasok_id) VALUES (?,?,?,?,?,?)",
            sembako_seed
        )

    # Setoran contoh
    if not cur.execute("SELECT 1 FROM deposits").fetchone():
        user1 = cur.execute("SELECT id FROM users WHERE email='budi@mail.com'").fetchone()
        user2 = cur.execute("SELECT id FROM users WHERE email='siti@mail.com'").fetchone()
        user3 = cur.execute("SELECT id FROM users WHERE email='ahmad@mail.com'").fetchone()
        tt = {r['name']: r['id'] for r in cur.execute("SELECT id,name FROM trash_types").fetchall()}
        if user1 and user2 and user3 and tt:
            deposits = [
                (user1['id'], tt.get('Plastik PET',1),      3.5, 10500, '2024-06-01', 'Botol plastik'),
                (user1['id'], tt.get('Kardus/Karton',2),    5.0,  7500, '2024-06-05', 'Kardus bekas'),
                (user2['id'], tt.get('Kaleng Aluminium',4), 2.0, 16000, '2024-06-08', 'Kaleng minuman'),
                (user3['id'], tt.get('Besi/Logam',5),      10.0, 40000, '2024-06-10', 'Besi tua'),
                (user1['id'], tt.get('Minyak Jelantah',7),  5.0, 22500, '2024-06-12', 'Minyak jelantah'),
                (user2['id'], tt.get('Kertas HVS',3),       3.0,  6000, '2024-06-14', 'Kertas koran'),
            ]
            cur.executemany(
                "INSERT INTO deposits (user_id,trash_type_id,weight,amount,deposit_date,note) VALUES (?,?,?,?,?,?)",
                deposits
            )

    # Penarikan contoh
    if not cur.execute("SELECT 1 FROM withdrawals").fetchone():
        user1 = cur.execute("SELECT id FROM users WHERE email='budi@mail.com'").fetchone()
        user2 = cur.execute("SELECT id FROM users WHERE email='siti@mail.com'").fetchone()
        user3 = cur.execute("SELECT id FROM users WHERE email='ahmad@mail.com'").fetchone()
        sk = {r['name']: r for r in cur.execute("SELECT id,name,price FROM sembako").fetchall()}
        if user1 and user2 and user3:
            cur.execute(
                "INSERT INTO withdrawals (user_id,type,amount,status,note,request_date,approved_date) VALUES (?,?,?,?,?,?,?)",
                (user1['id'], 'cash', 50000, 'approved', 'Penarikan tunai', '2024-06-03', '2024-06-04')
            )
            if 'Gula Pasir' in sk:
                cur.execute(
                    "INSERT INTO withdrawals (user_id,type,amount,status,note,sembako_id,sembako_name,qty,request_date) VALUES (?,?,?,?,?,?,?,?,?)",
                    (user2['id'],'sembako',30000,'pending','Sembako rutin',sk['Gula Pasir']['id'],'Gula Pasir',1,'2024-06-09')
                )
            if 'Minyak Goreng' in sk:
                cur.execute(
                    "INSERT INTO withdrawals (user_id,type,amount,status,note,sembako_id,sembako_name,qty,request_date,approved_date) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (user3['id'],'sembako',60000,'approved','Minyak goreng',sk['Minyak Goreng']['id'],'Minyak Goreng',3,'2024-06-11','2024-06-12')
                )


if __name__ == '__main__':
    init_db()
