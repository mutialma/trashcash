"""
app.py - Entry point Flask untuk EcoBank Sampah Backend API
"""

import os
from flask import Flask, jsonify, request, send_from_directory
from database import init_db
from routes.auth_routes import auth_bp
from routes.user_routes import user_bp
from routes.admin_routes import admin_bp
from routes.pemasok_routes import pemasok_bp

# ─── Inisialisasi Flask ───────────────────────────────────────────────────────
app = Flask(__name__, static_folder='static', static_url_path='')

app.config['JSON_SORT_KEYS'] = False
app.config['SECRET_KEY'] = os.environ.get('JWT_SECRET', 'ecobank-sampah-secret-key-2025')


# ─── CORS Manual (tanpa flask-cors) ──────────────────────────────────────────
ALLOWED_ORIGINS = ['http://localhost:5500', 'http://127.0.0.1:5500',
                   'http://localhost:3000', 'http://127.0.0.1:3000',
                   'http://localhost:8080', 'null', '*']

@app.after_request
def add_cors(response):
    origin = request.headers.get('Origin', '*')
    response.headers['Access-Control-Allow-Origin']  = origin
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response

@app.before_request
def handle_preflight():
    if request.method == 'OPTIONS':
        from flask import Response
        res = Response()
        res.headers['Access-Control-Allow-Origin']  = request.headers.get('Origin', '*')
        res.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        res.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        return res, 204


# ─── Register Blueprints ──────────────────────────────────────────────────────
app.register_blueprint(auth_bp)
app.register_blueprint(user_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(pemasok_bp)


# ─── Root & Health ────────────────────────────────────────────────────────────
@app.route('/')
def index():
    """Sajikan frontend jika ada di folder static/."""
    static_index = os.path.join(app.static_folder or 'static', 'index.html')
    if os.path.exists(static_index):
        return send_from_directory(app.static_folder, 'index.html')
    return jsonify({
        'app': 'EcoBank Sampah API',
        'version': '1.0.0',
        'status': 'running',
        'endpoints': {
            'auth':    '/api/auth/login | /api/auth/register | /api/auth/me',
            'user':    '/api/user/profile | /api/user/balance | /api/user/deposits | /api/user/withdrawals | ...',
            'admin':   '/api/admin/dashboard | /api/admin/nasabah | /api/admin/deposits | ...',
            'pemasok': '/api/pemasok/dashboard | /api/pemasok/sembako | /api/pemasok/requests | ...',
        }
    }), 200


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'message': 'EcoBank Sampah API berjalan normal.'}), 200


# ─── Error Handlers ───────────────────────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Endpoint tidak ditemukan.'}), 404

@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({'error': 'Method tidak diizinkan.'}), 405

@app.errorhandler(500)
def internal_error(e):
    return jsonify({'error': 'Terjadi kesalahan server.', 'detail': str(e)}), 500


# ─── Jalankan Server ──────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("=" * 55)
    print("  🌿  EcoBank Sampah Backend API")
    print("=" * 55)
    init_db()
    port = int(os.environ.get('PORT', 5000))
    print(f"\n🚀  Server berjalan di http://localhost:{port}")
    print(f"📋  API Docs: http://localhost:{port}/\n")
    app.run(host='0.0.0.0', port=port, debug=True)
