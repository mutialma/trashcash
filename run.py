#!/usr/bin/env python3
"""
run.py - Script untuk menjalankan EcoBank Sampah Backend
Jalankan: python3 run.py
"""

import os
import sys

# Pastikan working directory benar
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from database import init_db
from app import app

if __name__ == '__main__':
    print("=" * 55)
    print("  🌿  EcoBank Sampah - Backend API + Frontend")
    print("=" * 55)

    # Inisialisasi database
    init_db()

    port = int(os.environ.get('PORT', 5000))

    print(f"\n🚀  Server  : http://localhost:{port}")
    print(f"🌐  Frontend: http://localhost:{port}/")
    print(f"📡  API Base: http://localhost:{port}/api")
    print(f"❤️   Health  : http://localhost:{port}/api/health")
    print(f"\n🔑  Akun Demo:")
    print(f"    👤 Nasabah : budi@mail.com     / 123456")
    print(f"    🛡️  Admin   : admin@eco.com    / admin123")
    print(f"    🏪 Pemasok : pemasok@mail.com  / 123456")
    print(f"\n⏹   Tekan CTRL+C untuk menghentikan server\n")

    app.run(host='0.0.0.0', port=port, debug=False)
