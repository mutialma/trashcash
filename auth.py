"""
auth.py - Middleware autentikasi JWT
"""

import os
import jwt
from functools import wraps
from flask import request, jsonify
from database import get_db

SECRET_KEY = os.environ.get('JWT_SECRET', 'ecobank-sampah-secret-key-2025')
TOKEN_EXP_HOURS = 24


def generate_token(user_id: int, role: str) -> str:
    """Buat JWT token baru."""
    import datetime
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=TOKEN_EXP_HOURS),
        'iat': datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')


def decode_token(token: str) -> dict:
    """Decode dan validasi JWT token. Raise exception jika tidak valid."""
    return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])


def _get_bearer_token() -> str | None:
    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        return auth[7:]
    return None


def login_required(roles: list[str] = None):
    """
    Decorator: pastikan request memiliki token valid.
    Jika `roles` diisi, hanya role tersebut yang diizinkan.
    Menyimpan data user ke request.current_user.
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            token = _get_bearer_token()
            if not token:
                return jsonify({'error': 'Token tidak ditemukan. Silakan login.'}), 401

            try:
                payload = decode_token(token)
            except jwt.ExpiredSignatureError:
                return jsonify({'error': 'Token sudah kadaluarsa. Silakan login ulang.'}), 401
            except jwt.InvalidTokenError:
                return jsonify({'error': 'Token tidak valid.'}), 401

            user_id = payload.get('user_id')
            role    = payload.get('role')

            if roles and role not in roles:
                return jsonify({'error': 'Akses ditolak. Role tidak memiliki izin.'}), 403

            # Ambil data user dari DB sesuai role
            db = get_db()
            try:
                if role == 'admin':
                    user = db.execute("SELECT * FROM admins WHERE id=?", (user_id,)).fetchone()
                elif role == 'pemasok':
                    user = db.execute("SELECT * FROM pemasok WHERE id=?", (user_id,)).fetchone()
                else:
                    user = db.execute("SELECT * FROM users WHERE id=? AND active=1", (user_id,)).fetchone()

                if not user:
                    return jsonify({'error': 'Pengguna tidak ditemukan atau tidak aktif.'}), 401

                request.current_user = dict(user)
                request.current_user['role'] = role
            finally:
                db.close()

            return f(*args, **kwargs)
        return wrapper
    return decorator
