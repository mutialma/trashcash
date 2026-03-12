// ===================== KONFIGURASI API =====================
const API_BASE = 'http://localhost:5000/api';

// Helper: ambil token dari localStorage
const getToken = () => localStorage.getItem('token');
const setToken = (t) => localStorage.setItem('token', t);
const clearToken = () => localStorage.removeItem('token');

// Helper: HTTP request ke API
async function api(method, endpoint, body = null, requiresAuth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (requiresAuth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      throw new Error('Tidak dapat terhubung ke server. Pastikan backend berjalan di http://localhost:5000');
    }
    throw err;
  }
}

// ===================== DATA STORE (fallback sementara) =====================
// Data lokal hanya dipakai setelah login untuk render UI; sumber kebenaran = API
let DB = {
  trashTypes: [],
  sembako: [],
  deposits: [],
  withdrawals: [],
};

let currentUser = null;
let currentPage = '';
let loginRole = 'user';

// ===================== HELPERS =====================
const fmt = n => 'Rp ' + Number(n).toLocaleString('id-ID');
const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '-';
const today = () => new Date().toISOString().split('T')[0];

function showToast(type, title, msg) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast${type === 'error' ? ' error' : type === 'warning' ? ' warning' : ''}`;
  t.innerHTML = `<div class="toast-icon">${icons[type]||'ℹ️'}</div><div class="toast-content"><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function showModal(title, body, footer) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modalFooter').innerHTML = footer || '<button class="btn btn-secondary" onclick="closeModal()">Tutup</button>';
  document.getElementById('modalOverlay').classList.remove('hidden');
}
function closeModal() { document.getElementById('modalOverlay').classList.add('hidden'); }
function closeModalOutside(e) { if(e.target === document.getElementById('modalOverlay')) closeModal(); }

function showScreen(id) {
  ['loginScreen','registerScreen'].forEach(s => document.getElementById(s).classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function setLoginRole(role) {
  loginRole = role;
  document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('loginSwitch').style.display = role === 'user' ? '' : 'none';
}

// ===================== AUTH =====================
async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  if (!email || !pass) { showToast('error','Error','Email dan password wajib diisi'); return; }

  const btn = document.querySelector('#loginScreen .btn-primary');
  btn.textContent = '⏳ Memproses...';
  btn.disabled = true;

  try {
    const data = await api('POST', '/auth/login', { email, password: pass, role: loginRole }, false);
    setToken(data.token);
    currentUser = data.user;
    currentUser.role = loginRole;

    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
    await initApp();
  } catch (err) {
    showToast('error', 'Login Gagal', err.message);
  } finally {
    btn.textContent = '🔐 Masuk';
    btn.disabled = false;
  }
}

async function doRegister() {
  const name    = document.getElementById('regName').value.trim();
  const email   = document.getElementById('regEmail').value.trim();
  const pass    = document.getElementById('regPass').value;
  const phone   = document.getElementById('regPhone').value.trim();
  const address = document.getElementById('regAddress').value.trim();

  if (!name || !email || !pass || !phone) { showToast('error','Error','Semua field wajib diisi'); return; }
  if (pass.length < 6) { showToast('error','Error','Password minimal 6 karakter'); return; }

  const btn = document.querySelector('#registerScreen .btn-primary');
  btn.textContent = '⏳ Mendaftar...';
  btn.disabled = true;

  try {
    const data = await api('POST', '/auth/register', { name, email, password: pass, phone, address }, false);
    setToken(data.token);
    currentUser = data.user;
    currentUser.role = 'user';

    showToast('success','Berhasil','Akun berhasil dibuat!');
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
    await initApp();
  } catch (err) {
    showToast('error','Registrasi Gagal', err.message);
  } finally {
    btn.textContent = '✅ Daftar Sekarang';
    btn.disabled = false;
  }
}

function doLogout() {
  clearToken();
  currentUser = null;
  DB = { trashTypes: [], sembako: [], deposits: [], withdrawals: [] };
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
  showScreen('loginScreen');
}

// ===================== APP INIT =====================
async function initApp() {
  document.getElementById('topbarDate').textContent = new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  
  const avatarText = currentUser.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
  document.getElementById('sidebarAvatarText').textContent = avatarText;
  document.getElementById('sidebarUserName').textContent = currentUser.name;

  const role = currentUser.role;
  if (role === 'admin') {
    document.getElementById('sidebarUserRole').textContent = 'Administrator';
    document.getElementById('roleLabel').textContent = 'Panel Admin';
    renderAdminNav();
    navigateTo('adminDashboard');
  } else if (role === 'pemasok') {
    document.getElementById('sidebarUserRole').textContent = 'Pemasok Sembako';
    document.getElementById('roleLabel').textContent = 'Panel Pemasok';
    renderPemasokNav();
    navigateTo('pemasokDashboard');
  } else {
    document.getElementById('sidebarUserRole').textContent = 'Nasabah';
    document.getElementById('roleLabel').textContent = 'Panel Nasabah';
    renderUserNav();
    navigateTo('userDashboard');
  }

  // Cek apakah sudah login saat refresh halaman
  const savedToken = getToken();
  if (savedToken && !currentUser) {
    try {
      const data = await api('GET', '/auth/me');
      currentUser = data.user;
      await initApp();
    } catch { clearToken(); }
  }
}

function renderUserNav() {
  renderNav([
    { id: 'userDashboard',   icon: '🏠', label: 'Dashboard' },
    { id: 'userSaldo',       icon: '💰', label: 'Saldo & Tarik' },
    { id: 'userDeposits',    icon: '📥', label: 'Riwayat Setoran' },
    { id: 'userWithdrawals', icon: '📤', label: 'Riwayat Penarikan' },
    { id: 'userPrices',      icon: '💹', label: 'Harga Sampah' },
    { id: 'userProfile',     icon: '👤', label: 'Profil Saya' },
  ]);
}

function renderAdminNav() {
  renderNav([
    { id: 'adminDashboard',  icon: '🏠', label: 'Dashboard' },
    { id: 'adminNasabah',    icon: '👥', label: 'Data Nasabah' },
    { id: 'adminSetoran',    icon: '📥', label: 'Input Setoran' },
    { id: 'adminTrash',      icon: '♻️', label: 'Jenis Sampah' },
    { id: 'adminPenarikan',  icon: '💸', label: 'Kelola Penarikan' },
    { id: 'adminSembako',    icon: '🛒', label: 'Kelola Sembako' },
    { id: 'adminTransaksi',  icon: '📊', label: 'Riwayat Transaksi' },
    { id: 'adminPemasok',    icon: '🏪', label: 'Data Pemasok' },
  ]);
}

function renderPemasokNav() {
  renderNav([
    { id: 'pemasokDashboard',   icon: '🏠', label: 'Dashboard' },
    { id: 'pemasokSembako',     icon: '🛒', label: 'Kelola Sembako' },
    { id: 'pemasokStok',        icon: '📦', label: 'Update Stok & Harga' },
    { id: 'pemasokPermintaan',  icon: '📋', label: 'Permintaan Sembako' },
  ]);
}

function renderNav(items) {
  document.getElementById('sidebarNav').innerHTML = items.map(item => `
    <div class="nav-item" id="nav-${item.id}" onclick="navigateTo('${item.id}')">
      <span class="nav-icon">${item.icon}</span>
      <span>${item.label}</span>
      ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
    </div>
  `).join('');
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById(`nav-${page}`);
  if (navEl) navEl.classList.add('active');
  closeSidebar();
  const renders = {
    userDashboard, userSaldo, userDeposits, userWithdrawals, userPrices, userProfile,
    adminDashboard, adminNasabah, adminSetoran, adminTrash, adminPenarikan, adminSembako, adminTransaksi, adminPemasok,
    pemasokDashboard, pemasokSembako, pemasokStok, pemasokPermintaan
  };
  if (renders[page]) renders[page]();
}

function setTitle(t) { document.getElementById('topbarTitle').textContent = t; }
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

function showLoading(msg = 'Memuat data...') {
  document.getElementById('pageContent').innerHTML = `
    <div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-text">${msg}</div></div>`;
}

function showError(msg) {
  document.getElementById('pageContent').innerHTML = `
    <div class="empty-state" style="color:var(--red-500)"><div class="empty-state-icon">❌</div><div class="empty-state-text">${msg}</div></div>`;
}

// ===================== USER PAGES =====================
async function userDashboard() {
  setTitle('Dashboard Nasabah');
  showLoading();
  try {
    const [profileRes, depositRes, withdrawRes] = await Promise.all([
      api('GET', '/user/profile'),
      api('GET', '/user/deposits'),
      api('GET', '/user/withdrawals'),
    ]);
    currentUser = { ...currentUser, ...profileRes.user };
    const deps = depositRes.deposits;
    const wds  = withdrawRes.withdrawals;
    const totalDeposit  = deps.reduce((s,d)=>s+d.amount,0);
    const totalWithdraw = wds.filter(w=>w.status==='approved').reduce((s,w)=>s+w.amount,0);
    const pendingW      = wds.filter(w=>w.status==='pending').length;

    document.getElementById('pageContent').innerHTML = `
      <div class="saldo-card">
        <div class="saldo-label">💰 Saldo Aktif Anda</div>
        <div class="saldo-amount">${fmt(currentUser.balance)}</div>
        <div class="saldo-actions">
          <button class="saldo-action-btn primary" onclick="navigateTo('userSaldo')">💸 Tarik Saldo</button>
          <button class="saldo-action-btn secondary" onclick="navigateTo('userDeposits')">📋 Riwayat</button>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon green">📥</div><div class="stat-label">Total Setoran</div><div class="stat-value">${fmt(totalDeposit)}</div><div class="stat-change up">↑ ${deps.length} transaksi</div></div>
        <div class="stat-card"><div class="stat-icon blue">📤</div><div class="stat-label">Total Penarikan</div><div class="stat-value">${fmt(totalWithdraw)}</div></div>
        <div class="stat-card"><div class="stat-icon yellow">⏳</div><div class="stat-label">Menunggu Approval</div><div class="stat-value">${pendingW}</div><div class="stat-change">permintaan</div></div>
        <div class="stat-card"><div class="stat-icon green">♻️</div><div class="stat-label">Total Sampah</div><div class="stat-value">${deps.reduce((s,d)=>s+d.weight,0).toFixed(1)} kg</div></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">📋 Setoran Terakhir</span><button class="btn btn-secondary btn-sm" onclick="navigateTo('userDeposits')">Lihat Semua</button></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Tanggal</th><th>Jenis Sampah</th><th>Berat</th><th>Nilai</th></tr></thead>
          <tbody>${deps.slice(0,5).map(d=>`<tr>
            <td>${fmtDate(d.deposit_date)}</td>
            <td>${d.trash_icon||''} ${d.trash_name||'-'}</td>
            <td>${d.weight} ${d.unit||'kg'}</td>
            <td class="text-green fw-bold">${fmt(d.amount)}</td>
          </tr>`).join('') || '<tr><td colspan="4" class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">Belum ada setoran</div></td></tr>'}
          </tbody>
        </table></div>
      </div>`;
  } catch(err) { showError(err.message); showToast('error','Error', err.message); }
}

async function userSaldo() {
  setTitle('Saldo & Penarikan');
  showLoading();
  try {
    const [balRes, sembRes, wdRes] = await Promise.all([
      api('GET', '/user/balance'),
      api('GET', '/user/sembako'),
      api('GET', '/user/withdrawals'),
    ]);
    const balance  = balRes.balance;
    const sembakos = sembRes.sembako;
    const pendingW = wdRes.withdrawals.filter(w=>w.status==='pending');
    currentUser.balance = balance;

    document.getElementById('pageContent').innerHTML = `
      <div class="saldo-card">
        <div class="saldo-label">💰 Saldo Anda Saat Ini</div>
        <div class="saldo-amount">${fmt(balance)}</div>
      </div>
      <div class="page-header"><div><div class="page-header-title">Ajukan Penarikan</div><div class="page-header-sub">Pilih metode penarikan saldo Anda</div></div></div>
      <div class="card mb-3">
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Metode Penarikan</label>
            <div class="method-cards">
              <div class="method-card selected" id="methodCash" onclick="selectMethod('cash')">
                <div class="method-card-icon">💵</div><div class="method-card-name">Tunai (Cash)</div>
              </div>
              <div class="method-card" id="methodSembako" onclick="selectMethod('sembako')">
                <div class="method-card-icon">🛒</div><div class="method-card-name">Tukar Sembako</div>
              </div>
            </div>
          </div>
          <div id="cashForm">
            <div class="form-group"><label class="form-label">Jumlah Penarikan (Rp)</label><input type="number" class="form-control" id="withdrawAmount" placeholder="Masukkan jumlah" min="10000" step="5000"></div>
            <div class="form-group"><label class="form-label">Catatan (opsional)</label><input type="text" class="form-control" id="withdrawNote" placeholder="Catatan penarikan"></div>
            <button class="btn btn-primary" onclick="submitWithdrawal('cash')">💸 Ajukan Penarikan Tunai</button>
          </div>
          <div id="sembakoForm" class="hidden">
            <div class="form-group"><label class="form-label">Pilih Sembako</label>
              <select class="form-control form-select" id="sembakoSelect" onchange="updateSembakoTotal()">
                <option value="">-- Pilih Sembako --</option>
                ${sembakos.map(s=>`<option value="${s.id}" data-price="${s.price}" data-stock="${s.stock}" data-unit="${s.unit}">${s.icon} ${s.name} - ${fmt(s.price)}/${s.unit} (Stok: ${s.stock})</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label class="form-label">Jumlah</label><input type="number" class="form-control" id="sembakoQty" value="1" min="1" oninput="updateSembakoTotal()"></div>
            <div id="sembakoTotal" style="background:var(--green-50);border:1px solid var(--green-200);margin-bottom:16px;padding:14px 16px;border-radius:12px;display:none">
              <div class="flex justify-between"><span class="text-sm text-muted">Total Biaya:</span><span class="fw-bold text-green" id="sembakoTotalVal">Rp 0</span></div>
            </div>
            <button class="btn btn-primary" onclick="submitWithdrawal('sembako')">🛒 Ajukan Tukar Sembako</button>
          </div>
        </div>
      </div>
      ${pendingW.length > 0 ? `
      <div class="card">
        <div class="card-header"><span class="card-title">⏳ Permintaan Menunggu Approval</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Tanggal</th><th>Tipe</th><th>Jumlah</th><th>Status</th></tr></thead>
          <tbody>${pendingW.map(w=>`<tr>
            <td>${fmtDate(w.request_date)}</td>
            <td>${w.type==='cash'?'💵 Tunai':'🛒 '+w.sembako_name}</td>
            <td class="fw-bold">${fmt(w.amount)}</td>
            <td><span class="badge badge-yellow">⏳ Menunggu</span></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>` : ''}`;
  } catch(err) { showError(err.message); }
}

let selectedMethod = 'cash';
function selectMethod(m) {
  selectedMethod = m;
  document.getElementById('methodCash').classList.toggle('selected', m==='cash');
  document.getElementById('methodSembako').classList.toggle('selected', m==='sembako');
  document.getElementById('cashForm').classList.toggle('hidden', m!=='cash');
  document.getElementById('sembakoForm').classList.toggle('hidden', m!=='sembako');
}

function updateSembakoTotal() {
  const sel = document.getElementById('sembakoSelect');
  const opt = sel.options[sel.selectedIndex];
  const qty = parseInt(document.getElementById('sembakoQty').value)||0;
  const totalEl = document.getElementById('sembakoTotal');
  if (opt && opt.value && qty > 0) {
    const price = parseFloat(opt.dataset.price);
    document.getElementById('sembakoTotalVal').textContent = fmt(price * qty);
    totalEl.style.display = 'block';
  } else {
    totalEl.style.display = 'none';
  }
}

async function submitWithdrawal(type) {
  const btn = document.querySelector('#cashForm .btn-primary, #sembakoForm .btn-primary');
  try {
    let body = { type };
    if (type === 'cash') {
      const amount = parseInt(document.getElementById('withdrawAmount').value);
      const note   = document.getElementById('withdrawNote').value;
      if (!amount || amount < 10000) { showToast('error','Error','Minimum penarikan Rp 10.000'); return; }
      body = { type: 'cash', amount, note };
    } else {
      const sel = document.getElementById('sembakoSelect');
      const sembako_id = parseInt(sel.value);
      const qty = parseFloat(document.getElementById('sembakoQty').value);
      if (!sembako_id) { showToast('error','Error','Pilih jenis sembako'); return; }
      if (!qty || qty < 1) { showToast('error','Error','Jumlah tidak valid'); return; }
      body = { type: 'sembako', sembako_id, qty };
    }
    await api('POST', '/user/withdrawals', body);
    showToast('success','Berhasil','Permintaan penarikan diajukan, menunggu approval');
    userSaldo();
  } catch(err) { showToast('error','Gagal', err.message); }
}

async function userDeposits() {
  setTitle('Riwayat Setoran');
  showLoading();
  try {
    const { deposits } = await api('GET', '/user/deposits');
    document.getElementById('pageContent').innerHTML = `
      <div class="card">
        <div class="card-header"><span class="card-title">📥 Semua Setoran Sampah</span><span class="badge badge-green">${deposits.length} transaksi</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Tanggal</th><th>Jenis Sampah</th><th>Berat</th><th>Harga/Satuan</th><th>Total</th></tr></thead>
          <tbody>${deposits.length ? deposits.map(d=>`<tr>
            <td>${fmtDate(d.deposit_date)}</td>
            <td>${d.trash_icon||''} ${d.trash_name||'-'}</td>
            <td>${d.weight} ${d.unit||'kg'}</td>
            <td>${fmt(d.price_per_kg||0)}</td>
            <td class="text-green fw-bold">${fmt(d.amount)}</td>
          </tr>`).join('') : '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">Belum ada setoran</div></div></td></tr>'}</tbody>
        </table></div>
      </div>`;
  } catch(err) { showError(err.message); }
}

async function userWithdrawals() {
  setTitle('Riwayat Penarikan');
  showLoading();
  try {
    const { withdrawals } = await api('GET', '/user/withdrawals');
    const statusBadge = s => s==='approved'?'<span class="badge badge-green">✅ Disetujui</span>':s==='rejected'?'<span class="badge badge-red">❌ Ditolak</span>':'<span class="badge badge-yellow">⏳ Menunggu</span>';
    document.getElementById('pageContent').innerHTML = `
      <div class="card">
        <div class="card-header"><span class="card-title">📤 Semua Penarikan</span><span class="badge badge-blue">${withdrawals.length} transaksi</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Tanggal</th><th>Tipe</th><th>Detail</th><th>Jumlah</th><th>Status</th></tr></thead>
          <tbody>${withdrawals.length ? withdrawals.map(w=>`<tr>
            <td>${fmtDate(w.request_date)}</td>
            <td>${w.type==='cash'?'💵 Tunai':'🛒 Sembako'}</td>
            <td class="text-sm text-muted">${w.type==='sembako'?`${w.sembako_name} x${w.qty}`:w.note||'-'}</td>
            <td class="fw-bold ${w.status==='approved'?'text-red':''}">${fmt(w.amount)}</td>
            <td>${statusBadge(w.status)}</td>
          </tr>`).join('') : '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">Belum ada penarikan</div></div></td></tr>'}</tbody>
        </table></div>
      </div>`;
  } catch(err) { showError(err.message); }
}

async function userPrices() {
  setTitle('Harga Sampah');
  showLoading();
  try {
    const { trash_types } = await api('GET', '/user/trash-prices');
    document.getElementById('pageContent').innerHTML = `
      <div class="page-header"><div><div class="page-header-title">💹 Daftar Harga Sampah</div><div class="page-header-sub">Harga berlaku hari ini</div></div></div>
      <div class="price-grid">
        ${trash_types.map(t=>`
          <div class="price-card">
            <div class="price-card-icon">${t.icon}</div>
            <div class="price-card-name">${t.name}</div>
            <div class="price-card-price">${fmt(t.price_per_kg)}</div>
            <div class="price-card-unit">per ${t.unit}</div>
          </div>`).join('')}
      </div>
      <div class="card mt-3"><div class="card-body"><p class="text-sm text-muted">⚠️ Harga dapat berubah sewaktu-waktu. Konfirmasi dengan petugas saat menyetor.</p></div></div>`;
  } catch(err) { showError(err.message); }
}

async function userProfile() {
  setTitle('Profil Saya');
  showLoading();
  try {
    const { user } = await api('GET', '/user/profile');
    currentUser = { ...currentUser, ...user };
    const u = currentUser;
    document.getElementById('pageContent').innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar-large">${u.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()}</div>
        <div>
          <div style="font-size:20px;font-weight:800">${u.name}</div>
          <div style="color:rgba(255,255,255,0.7);margin-top:4px;font-size:13px">${u.email}</div>
          <span class="badge badge-green" style="margin-top:8px">✅ Nasabah Aktif</span>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">📋 Informasi Akun</span><button class="btn btn-secondary btn-sm" onclick="showEditProfile()">✏️ Edit</button></div>
        <div class="card-body">
          <div class="form-grid">
            <div><div class="form-label">Nama Lengkap</div><div class="fw-bold">${u.name}</div></div>
            <div><div class="form-label">Email</div><div class="fw-bold">${u.email}</div></div>
            <div><div class="form-label">No. Telepon</div><div class="fw-bold">${u.phone||'-'}</div></div>
            <div><div class="form-label">Bergabung</div><div class="fw-bold">${fmtDate(u.join_date)}</div></div>
            <div class="full"><div class="form-label">Alamat</div><div class="fw-bold">${u.address||'-'}</div></div>
          </div>
          <div class="divider"></div>
          <div class="form-label">Saldo Aktif</div>
          <div style="font-size:28px;font-weight:800;color:var(--green-700)">${fmt(u.balance)}</div>
        </div>
      </div>`;
  } catch(err) { showError(err.message); }
}

function showEditProfile() {
  const u = currentUser;
  showModal('✏️ Edit Profil', `
    <div class="form-group"><label class="form-label">Nama Lengkap</label><input class="form-control" id="epName" value="${u.name}"></div>
    <div class="form-group"><label class="form-label">No. Telepon</label><input class="form-control" id="epPhone" value="${u.phone||''}"></div>
    <div class="form-group"><label class="form-label">Alamat</label><input class="form-control" id="epAddress" value="${u.address||''}"></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveProfile()">💾 Simpan</button>`);
}

async function saveProfile() {
  try {
    const name    = document.getElementById('epName').value;
    const phone   = document.getElementById('epPhone').value;
    const address = document.getElementById('epAddress').value;
    const { user } = await api('PUT', '/user/profile', { name, phone, address });
    currentUser = { ...currentUser, ...user };
    closeModal();
    showToast('success','Berhasil','Profil diperbarui');
    document.getElementById('sidebarUserName').textContent = currentUser.name;
    document.getElementById('sidebarAvatarText').textContent = currentUser.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
    userProfile();
  } catch(err) { showToast('error','Gagal', err.message); }
}

// ===================== ADMIN PAGES =====================
async function adminDashboard() {
  setTitle('Dashboard Admin');
  showLoading();
  try {
    const data = await api('GET', '/admin/dashboard');
    const s    = data.stats;
    const pendingList = data.pending_withdrawals;
    document.getElementById('pageContent').innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon green">👥</div><div class="stat-label">Total Nasabah</div><div class="stat-value">${s.total_users}</div></div>
        <div class="stat-card"><div class="stat-icon blue">💰</div><div class="stat-label">Total Saldo Nasabah</div><div class="stat-value" style="font-size:17px">${fmt(s.total_balance)}</div></div>
        <div class="stat-card"><div class="stat-icon green">📥</div><div class="stat-label">Total Setoran</div><div class="stat-value" style="font-size:17px">${fmt(s.total_deposit)}</div><div class="stat-change">${s.total_deposit_cnt} transaksi</div></div>
        <div class="stat-card"><div class="stat-icon yellow">⏳</div><div class="stat-label">Penarikan Pending</div><div class="stat-value">${s.pending_cnt}</div><div class="stat-change ${s.pending_cnt>0?'down':''}">perlu approval</div></div>
      </div>
      <div class="charts-grid">
        <div class="card"><div class="card-header"><span class="card-title">📊 Setoran per Jenis Sampah</span></div><div class="card-body"><div class="chart-container"><canvas id="chartTrash"></canvas></div></div></div>
        <div class="card"><div class="card-header"><span class="card-title">💹 Nilai Setoran vs Penarikan</span></div><div class="card-body"><div class="chart-container"><canvas id="chartSummary"></canvas></div></div></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">⏳ Penarikan Menunggu Approval</span><button class="btn btn-primary btn-sm" onclick="navigateTo('adminPenarikan')">Kelola Semua</button></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Nasabah</th><th>Tipe</th><th>Jumlah</th><th>Tanggal</th><th>Aksi</th></tr></thead>
          <tbody>${pendingList.slice(0,5).map(w=>`<tr>
            <td><strong>${w.user_name}</strong></td>
            <td>${w.type==='cash'?'💵 Tunai':'🛒 '+w.sembako_name}</td>
            <td class="fw-bold">${fmt(w.amount)}</td>
            <td>${fmtDate(w.request_date)}</td>
            <td><button class="btn btn-success btn-sm" onclick="approveWithdrawal(${w.id})">✅ Setujui</button> <button class="btn btn-danger btn-sm" onclick="rejectWithdrawal(${w.id})">❌</button></td>
          </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--gray-400);padding:20px">Tidak ada permintaan pending</td></tr>'}
          </tbody>
        </table></div>
      </div>`;
    setTimeout(() => renderAdminCharts(data.by_trash_type, s), 100);
  } catch(err) { showError(err.message); }
}

function renderAdminCharts(byType, stats) {
  const ctx1 = document.getElementById('chartTrash');
  if (ctx1 && byType.length) {
    new Chart(ctx1, {
      type: 'doughnut',
      data: {
        labels: byType.map(t=>t.name),
        datasets: [{ data: byType.map(t=>t.total_weight), backgroundColor: ['#22c55e','#16a34a','#84cc16','#10b981','#14b8a6','#06b6d4','#3b82f6','#8b5cf6'] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } } }
    });
  }
  const ctx2 = document.getElementById('chartSummary');
  if (ctx2) {
    new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: ['Total Setoran', 'Total Penarikan', 'Saldo Nasabah'],
        datasets: [{ label: 'Nilai (Rp)', data: [stats.total_deposit, stats.total_withdraw, stats.total_balance], backgroundColor: ['#22c55e','#ef4444','#3b82f6'], borderRadius: 8 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => 'Rp'+Number(v).toLocaleString('id-ID') } } } }
    });
  }
}

async function adminNasabah() {
  setTitle('Data Nasabah');
  showLoading();
  try {
    const { nasabah } = await api('GET', '/admin/nasabah');
    document.getElementById('pageContent').innerHTML = `
      <div class="page-header">
        <div><div class="page-header-title">👥 Data Nasabah</div><div class="page-header-sub">${nasabah.length} nasabah terdaftar</div></div>
        <button class="btn btn-primary" onclick="showAddNasabah()">➕ Tambah Nasabah</button>
      </div>
      <div class="card">
        <div class="table-wrap"><table>
          <thead><tr><th>Nama</th><th>Email</th><th>Telepon</th><th>Saldo</th><th>Bergabung</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>${nasabah.map(u=>`<tr>
            <td><div class="flex items-center gap-2"><div class="user-avatar" style="width:32px;height:32px;font-size:13px;border-radius:8px">${u.name[0]}</div>${u.name}</div></td>
            <td>${u.email}</td>
            <td>${u.phone||'-'}</td>
            <td class="fw-bold text-green">${fmt(u.balance)}</td>
            <td>${fmtDate(u.join_date)}</td>
            <td>${u.active?'<span class="badge badge-green">Aktif</span>':'<span class="badge badge-red">Nonaktif</span>'}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="showEditNasabah(${u.id},'${u.name.replace(/'/g,"\\'")}','${u.email}','${u.phone||''}','${u.address||''}')">✏️</button>
              <button class="btn btn-danger btn-sm" onclick="toggleNasabah(${u.id})">${u.active?'🚫':'✅'}</button>
              <button class="btn btn-danger btn-sm" onclick="deleteNasabah(${u.id})">🗑️</button>
            </td>
          </tr>`).join('')}
          </tbody>
        </table></div>
      </div>`;
  } catch(err) { showError(err.message); }
}

function showAddNasabah() {
  showModal('➕ Tambah Nasabah', `
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Nama</label><input class="form-control" id="anName"></div>
      <div class="form-group"><label class="form-label">Telepon</label><input class="form-control" id="anPhone"></div>
      <div class="form-group full"><label class="form-label">Email</label><input class="form-control" id="anEmail" type="email"></div>
      <div class="form-group"><label class="form-label">Password</label><input class="form-control" id="anPass" type="password"></div>
      <div class="form-group full"><label class="form-label">Alamat</label><input class="form-control" id="anAddress"></div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveNewNasabah()">💾 Simpan</button>`
  );
}

async function saveNewNasabah() {
  try {
    await api('POST', '/admin/nasabah', {
      name: document.getElementById('anName').value,
      email: document.getElementById('anEmail').value,
      password: document.getElementById('anPass').value,
      phone: document.getElementById('anPhone').value,
      address: document.getElementById('anAddress').value,
    });
    closeModal(); showToast('success','Berhasil','Nasabah ditambahkan'); adminNasabah();
  } catch(err) { showToast('error','Gagal', err.message); }
}

function showEditNasabah(id, name, email, phone, address) {
  showModal('✏️ Edit Nasabah', `
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Nama</label><input class="form-control" id="enName" value="${name}"></div>
      <div class="form-group"><label class="form-label">Telepon</label><input class="form-control" id="enPhone" value="${phone}"></div>
      <div class="form-group full"><label class="form-label">Email</label><input class="form-control" id="enEmail" value="${email}"></div>
      <div class="form-group full"><label class="form-label">Alamat</label><input class="form-control" id="enAddress" value="${address}"></div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveEditNasabah(${id})">💾 Simpan</button>`
  );
}

async function saveEditNasabah(id) {
  try {
    await api('PUT', `/admin/nasabah/${id}`, {
      name: document.getElementById('enName').value,
      email: document.getElementById('enEmail').value,
      phone: document.getElementById('enPhone').value,
      address: document.getElementById('enAddress').value,
    });
    closeModal(); showToast('success','Berhasil','Data nasabah diperbarui'); adminNasabah();
  } catch(err) { showToast('error','Gagal', err.message); }
}

async function toggleNasabah(id) {
  try {
    const res = await api('PATCH', `/admin/nasabah/${id}/toggle`);
    showToast('success','Berhasil', res.message); adminNasabah();
  } catch(err) { showToast('error','Gagal', err.message); }
}

function deleteNasabah(id) {
  showModal('🗑️ Hapus Nasabah','<p>Yakin ingin menghapus nasabah ini?</p>',
    `<button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-danger" onclick="confirmDeleteNasabah(${id})">🗑️ Hapus</button>`);
}

async function confirmDeleteNasabah(id) {
  try {
    await api('DELETE', `/admin/nasabah/${id}`);
    closeModal(); showToast('success','Berhasil','Nasabah dihapus'); adminNasabah();
  } catch(err) { showToast('error','Gagal', err.message); }
}

async function adminSetoran() {
  setTitle('Input Setoran Sampah');
  showLoading();
  try {
    const [usersRes, trashRes, depositRes] = await Promise.all([
      api('GET', '/admin/nasabah'),
      api('GET', '/admin/trash-types'),
      api('GET', '/admin/deposits'),
    ]);
    const users  = usersRes.nasabah.filter(u=>u.active);
    const trash  = trashRes.trash_types.filter(t=>t.active);
    const recent = depositRes.deposits.slice(0,10);

    document.getElementById('pageContent').innerHTML = `
      <div class="page-header"><div><div class="page-header-title">📥 Input Setoran Sampah</div><div class="page-header-sub">Catat setoran sampah nasabah</div></div></div>
      <div class="card">
        <div class="card-body">
          <div class="form-grid">
            <div class="form-group"><label class="form-label">Pilih Nasabah</label>
              <select class="form-control form-select" id="depUser" onchange="calcDeposit()">
                <option value="">-- Pilih Nasabah --</option>
                ${users.map(u=>`<option value="${u.id}">${u.name} - Saldo: ${fmt(u.balance)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label class="form-label">Jenis Sampah</label>
              <select class="form-control form-select" id="depTrash" onchange="calcDeposit()">
                <option value="">-- Pilih Jenis --</option>
                ${trash.map(t=>`<option value="${t.id}" data-price="${t.price_per_kg}" data-unit="${t.unit}">${t.icon} ${t.name} - ${fmt(t.price_per_kg)}/${t.unit}</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label class="form-label">Berat/Jumlah</label><input type="number" class="form-control" id="depWeight" placeholder="e.g. 2.5" step="0.1" min="0.1" oninput="calcDeposit()"></div>
            <div class="form-group"><label class="form-label">Tanggal Setoran</label><input type="date" class="form-control" id="depDate" value="${today()}"></div>
            <div class="form-group full"><label class="form-label">Catatan</label><input type="text" class="form-control" id="depNote" placeholder="Catatan (opsional)"></div>
          </div>
          <div id="depositCalc" style="background:var(--green-50);border:1px solid var(--green-200);padding:14px 16px;border-radius:12px;margin-bottom:16px;display:none">
            <div class="flex justify-between"><span class="text-sm text-muted">Nilai Setoran:</span><span class="fw-bold text-green" id="calcVal">Rp 0</span></div>
          </div>
          <button class="btn btn-primary" onclick="submitDeposit()">💾 Simpan Setoran</button>
        </div>
      </div>
      <div class="card mt-3">
        <div class="card-header"><span class="card-title">📋 Setoran Terakhir</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Nasabah</th><th>Jenis</th><th>Berat</th><th>Nilai</th><th>Tanggal</th></tr></thead>
          <tbody>${recent.map(d=>`<tr>
            <td><strong>${d.user_name}</strong></td>
            <td>${d.trash_icon||''} ${d.trash_name}</td>
            <td>${d.weight} ${d.unit}</td>
            <td class="text-green fw-bold">${fmt(d.amount)}</td>
            <td>${fmtDate(d.deposit_date)}</td>
          </tr>`).join('')}
          </tbody>
        </table></div>
      </div>`;
  } catch(err) { showError(err.message); }
}

function calcDeposit() {
  const sel = document.getElementById('depTrash');
  const opt = sel.options[sel.selectedIndex];
  const w   = parseFloat(document.getElementById('depWeight').value);
  const calcEl = document.getElementById('depositCalc');
  if (opt && opt.value && w > 0) {
    const val = parseFloat(opt.dataset.price) * w;
    document.getElementById('calcVal').textContent = fmt(val);
    calcEl.style.display = 'block';
  } else { calcEl.style.display = 'none'; }
}

async function submitDeposit() {
  const user_id       = parseInt(document.getElementById('depUser').value);
  const trash_type_id = parseInt(document.getElementById('depTrash').value);
  const weight        = parseFloat(document.getElementById('depWeight').value);
  const deposit_date  = document.getElementById('depDate').value;
  const note          = document.getElementById('depNote').value;
  if (!user_id||!trash_type_id||!weight||weight<=0) { showToast('error','Error','Lengkapi semua data setoran'); return; }
  try {
    const res = await api('POST', '/admin/deposits', { user_id, trash_type_id, weight, deposit_date, note });
    showToast('success','Setoran Berhasil', res.message);
    adminSetoran();
  } catch(err) { showToast('error','Gagal', err.message); }
}

async function adminTrash() {
  setTitle('Jenis Sampah');
  showLoading();
  try {
    const { trash_types } = await api('GET', '/admin/trash-types');
    document.getElementById('pageContent').innerHTML = `
      <div class="page-header">
        <div><div class="page-header-title">♻️ Kelola Jenis Sampah</div></div>
        <button class="btn btn-primary" onclick="showAddTrash()">➕ Tambah Jenis</button>
      </div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Icon</th><th>Nama</th><th>Harga/Satuan</th><th>Satuan</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>${trash_types.map(t=>`<tr>
          <td style="font-size:22px">${t.icon}</td>
          <td><strong>${t.name}</strong></td>
          <td class="fw-bold text-green">${fmt(t.price_per_kg)}</td>
          <td>${t.unit}</td>
          <td>${t.active?'<span class="badge badge-green">Aktif</span>':'<span class="badge badge-red">Nonaktif</span>'}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="showEditTrash(${t.id},'${t.name.replace(/'/g,"\\'")}','${t.icon}',${t.price_per_kg},'${t.unit}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="toggleTrashType(${t.id})">${t.active?'🚫':'✅'}</button>
            <button class="btn btn-danger btn-sm" onclick="deleteTrash(${t.id})">🗑️</button>
          </td>
        </tr>`).join('')}
        </tbody>
      </table></div></div>`;
  } catch(err) { showError(err.message); }
}

function showAddTrash() {
  showModal('➕ Tambah Jenis Sampah', `
    <div class="form-group"><label class="form-label">Icon (emoji)</label><input class="form-control" id="atIcon" placeholder="♻️" value="♻️"></div>
    <div class="form-group"><label class="form-label">Nama</label><input class="form-control" id="atName"></div>
    <div class="form-group"><label class="form-label">Harga per Satuan (Rp)</label><input type="number" class="form-control" id="atPrice" min="0"></div>
    <div class="form-group"><label class="form-label">Satuan</label><select class="form-control form-select" id="atUnit"><option value="kg">kg</option><option value="liter">liter</option><option value="pcs">pcs</option></select></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveNewTrash()">💾 Simpan</button>`
  );
}

async function saveNewTrash() {
  try {
    await api('POST', '/admin/trash-types', {
      name: document.getElementById('atName').value,
      icon: document.getElementById('atIcon').value||'♻️',
      price_per_kg: parseFloat(document.getElementById('atPrice').value),
      unit: document.getElementById('atUnit').value,
    });
    closeModal(); showToast('success','Berhasil','Jenis sampah ditambahkan'); adminTrash();
  } catch(err) { showToast('error','Gagal', err.message); }
}

function showEditTrash(id, name, icon, price, unit) {
  showModal('✏️ Edit Jenis Sampah', `
    <div class="form-group"><label class="form-label">Icon</label><input class="form-control" id="etIcon" value="${icon}"></div>
    <div class="form-group"><label class="form-label">Nama</label><input class="form-control" id="etName" value="${name}"></div>
    <div class="form-group"><label class="form-label">Harga per Satuan (Rp)</label><input type="number" class="form-control" id="etPrice" value="${price}"></div>
    <div class="form-group"><label class="form-label">Satuan</label><select class="form-control form-select" id="etUnit"><option ${unit==='kg'?'selected':''} value="kg">kg</option><option ${unit==='liter'?'selected':''} value="liter">liter</option><option ${unit==='pcs'?'selected':''} value="pcs">pcs</option></select></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveEditTrash(${id})">💾 Simpan</button>`
  );
}

async function saveEditTrash(id) {
  try {
    await api('PUT', `/admin/trash-types/${id}`, {
      name: document.getElementById('etName').value,
      icon: document.getElementById('etIcon').value,
      price_per_kg: parseFloat(document.getElementById('etPrice').value),
      unit: document.getElementById('etUnit').value,
    });
    closeModal(); showToast('success','Berhasil','Jenis sampah diperbarui'); adminTrash();
  } catch(err) { showToast('error','Gagal', err.message); }
}

async function toggleTrashType(id) {
  try {
    const res = await api('PATCH', `/admin/trash-types/${id}/toggle`);
    showToast('success','Berhasil', res.message); adminTrash();
  } catch(err) { showToast('error','Gagal', err.message); }
}

function deleteTrash(id) {
  showModal('🗑️ Hapus Jenis Sampah','<p>Yakin ingin menghapus jenis sampah ini?</p>',
    `<button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-danger" onclick="confirmDeleteTrash(${id})">🗑️ Hapus</button>`);
}

async function confirmDeleteTrash(id) {
  try {
    await api('DELETE', `/admin/trash-types/${id}`);
    closeModal(); showToast('success','Berhasil','Jenis sampah dihapus'); adminTrash();
  } catch(err) { showToast('error','Gagal', err.message); }
}

async function adminPenarikan() {
  setTitle('Kelola Penarikan');
  showLoading();
  try {
    const { withdrawals } = await api('GET', '/admin/withdrawals');
    const statusBadge = s => s==='approved'?'<span class="badge badge-green">✅ Disetujui</span>':s==='rejected'?'<span class="badge badge-red">❌ Ditolak</span>':'<span class="badge badge-yellow">⏳ Menunggu</span>';
    document.getElementById('pageContent').innerHTML = `
      <div class="page-header"><div><div class="page-header-title">💸 Kelola Semua Penarikan</div><div class="page-header-sub">${withdrawals.filter(w=>w.status==='pending').length} menunggu approval</div></div></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Nasabah</th><th>Tipe</th><th>Detail</th><th>Jumlah</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>${withdrawals.map(w=>`<tr>
          <td><strong>${w.user_name}</strong></td>
          <td>${w.type==='cash'?'💵 Tunai':'🛒 Sembako'}</td>
          <td class="text-sm text-muted">${w.type==='sembako'?`${w.sembako_name} x${w.qty}`:w.note||'-'}</td>
          <td class="fw-bold">${fmt(w.amount)}</td>
          <td>${fmtDate(w.request_date)}</td>
          <td>${statusBadge(w.status)}</td>
          <td>${w.status==='pending'?`<button class="btn btn-success btn-sm" onclick="approveWithdrawal(${w.id})">✅</button> <button class="btn btn-danger btn-sm" onclick="rejectWithdrawal(${w.id})">❌</button>`:'<span class="text-muted text-xs">-</span>'}</td>
        </tr>`).join('')}
        </tbody>
      </table></div></div>`;
  } catch(err) { showError(err.message); }
}

async function approveWithdrawal(id) {
  try {
    const res = await api('PATCH', `/admin/withdrawals/${id}/approve`);
    showToast('success','Berhasil', res.message);
    if (currentPage==='adminDashboard') adminDashboard(); else adminPenarikan();
  } catch(err) { showToast('error','Gagal', err.message); }
}

async function rejectWithdrawal(id) {
  try {
    await api('PATCH', `/admin/withdrawals/${id}/reject`);
    showToast('warning','Ditolak','Permintaan penarikan ditolak');
    if (currentPage==='adminDashboard') adminDashboard(); else adminPenarikan();
  } catch(err) { showToast('error','Gagal', err.message); }
}

async function adminSembako() {
  setTitle('Kelola Sembako');
  showLoading();
  try {
    const { sembako } = await api('GET', '/admin/sembako');
    document.getElementById('pageContent').innerHTML = `
      <div class="page-header"><div><div class="page-header-title">🛒 Data Sembako</div></div></div>
      <div class="sembako-grid">
        ${sembako.map(s=>{
          const pct = Math.min(100,(s.stock/200)*100);
          const cls = pct<20?'low':pct<50?'mid':'';
          return `<div class="sembako-card">
            <div class="sembako-icon">${s.icon}</div>
            <div class="sembako-name">${s.name}</div>
            <div class="sembako-price">${fmt(s.price)}<span style="font-size:11px;font-weight:400;color:var(--gray-400)">/${s.unit}</span></div>
            <div class="sembako-stock ${s.stock<20?'low':''}">Stok: ${s.stock} ${s.unit}</div>
            <div class="stock-bar-wrap mb-3"><div class="stock-bar ${cls}" style="width:${pct}%"></div></div>
            <button class="btn btn-secondary btn-sm" style="width:100%" onclick="showEditSembako(${s.id},'${s.name.replace(/'/g,"\\'")}',${s.price},${s.stock})">✏️ Edit</button>
          </div>`;
        }).join('')}
      </div>`;
  } catch(err) { showError(err.message); }
}

function showEditSembako(id, name, price, stock) {
  showModal(`✏️ Edit Sembako`, `
    <div class="form-group"><label class="form-label">Nama Produk</label><input class="form-control" id="esProd" value="${name}"></div>
    <div class="form-group"><label class="form-label">Harga (Rp)</label><input type="number" class="form-control" id="esPrice" value="${price}"></div>
    <div class="form-group"><label class="form-label">Stok</label><input type="number" class="form-control" id="esStock" value="${stock}"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveEditSembako(${id})">💾 Simpan</button>`
  );
}

async function saveEditSembako(id) {
  try {
    await api('PUT', `/admin/sembako/${id}`, {
      name: document.getElementById('esProd').value,
      price: parseFloat(document.getElementById('esPrice').value),
      stock: parseFloat(document.getElementById('esStock').value),
    });
    closeModal(); showToast('success','Berhasil','Data sembako diperbarui'); adminSembako();
  } catch(err) { showToast('error','Gagal', err.message); }
}

async function adminTransaksi() {
  setTitle('Riwayat Transaksi');
  showLoading();
  try {
    const { transactions } = await api('GET', '/admin/transactions');
    document.getElementById('pageContent').innerHTML = `
      <div class="card"><div class="card-header"><span class="card-title">📊 Semua Transaksi</span><span class="badge badge-gray">${transactions.length} transaksi</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Tanggal</th><th>Nasabah</th><th>Tipe</th><th>Detail</th><th>Jumlah</th><th>Status</th></tr></thead>
          <tbody>${transactions.map(t=>`<tr>
            <td>${fmtDate(t.tx_date)}</td>
            <td><strong>${t.user_name}</strong></td>
            <td><span class="badge ${t.tx_type==='deposit'?'badge-green':'badge-blue'}">${t.tx_type==='deposit'?'📥 Setoran':t.tx_type==='cash'?'💵 Tunai':'🛒 Sembako'}</span></td>
            <td class="text-sm text-muted">${t.icon} ${t.detail}</td>
            <td class="${t.tx_type==='deposit'?'text-green':'text-red'} fw-bold">${t.tx_type==='deposit'?'+':'−'}${fmt(t.amount)}</td>
            <td><span class="badge ${t.status==='approved'?'badge-green':t.status==='rejected'?'badge-red':'badge-yellow'}">${t.status==='approved'?'✅':t.status==='rejected'?'❌':'⏳'}</span></td>
          </tr>`).join('')}
          </tbody>
        </table></div>
      </div>`;
  } catch(err) { showError(err.message); }
}

async function adminPemasok() {
  setTitle('Data Pemasok');
  showLoading();
  try {
    const { pemasok } = await api('GET', '/admin/pemasok');
    document.getElementById('pageContent').innerHTML = `
      <div class="page-header">
        <div><div class="page-header-title">🏪 Data Pemasok Sembako</div></div>
        <button class="btn btn-primary" onclick="showAddPemasok()">➕ Tambah Pemasok</button>
      </div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Nama Toko</th><th>Email</th><th>Telepon</th><th>Alamat</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>${pemasok.map(p=>`<tr>
          <td><strong>${p.name}</strong></td>
          <td>${p.email}</td>
          <td>${p.phone||'-'}</td>
          <td>${p.address||'-'}</td>
          <td>${p.active?'<span class="badge badge-green">Aktif</span>':'<span class="badge badge-red">Nonaktif</span>'}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="showEditPemasok(${p.id},'${p.name.replace(/'/g,"\\'")}','${p.phone||''}','${p.address||''}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="togglePemasokStatus(${p.id})">${p.active?'🚫':'✅'}</button>
          </td>
        </tr>`).join('')}
        </tbody>
      </table></div></div>`;
  } catch(err) { showError(err.message); }
}

function showAddPemasok() {
  showModal('➕ Tambah Pemasok', `
    <div class="form-group"><label class="form-label">Nama Toko</label><input class="form-control" id="apName"></div>
    <div class="form-group"><label class="form-label">Email</label><input class="form-control" id="apEmail" type="email"></div>
    <div class="form-group"><label class="form-label">Password</label><input class="form-control" id="apPass" type="password"></div>
    <div class="form-group"><label class="form-label">Telepon</label><input class="form-control" id="apPhone"></div>
    <div class="form-group"><label class="form-label">Alamat</label><input class="form-control" id="apAddress"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveNewPemasok()">💾 Simpan</button>`
  );
}

async function saveNewPemasok() {
  try {
    await api('POST', '/admin/pemasok', {
      name: document.getElementById('apName').value,
      email: document.getElementById('apEmail').value,
      password: document.getElementById('apPass').value,
      phone: document.getElementById('apPhone').value,
      address: document.getElementById('apAddress').value,
    });
    closeModal(); showToast('success','Berhasil','Pemasok ditambahkan'); adminPemasok();
  } catch(err) { showToast('error','Gagal', err.message); }
}

function showEditPemasok(id, name, phone, address) {
  showModal('✏️ Edit Pemasok', `
    <div class="form-group"><label class="form-label">Nama Toko</label><input class="form-control" id="epPName" value="${name}"></div>
    <div class="form-group"><label class="form-label">Telepon</label><input class="form-control" id="epPPhone" value="${phone}"></div>
    <div class="form-group"><label class="form-label">Alamat</label><input class="form-control" id="epPAddress" value="${address}"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveEditPemasok(${id})">💾 Simpan</button>`
  );
}

async function saveEditPemasok(id) {
  try {
    await api('PUT', `/admin/pemasok/${id}`, {
      name: document.getElementById('epPName').value,
      phone: document.getElementById('epPPhone').value,
      address: document.getElementById('epPAddress').value,
    });
    closeModal(); showToast('success','Berhasil','Data pemasok diperbarui'); adminPemasok();
  } catch(err) { showToast('error','Gagal', err.message); }
}

async function togglePemasokStatus(id) {
  try {
    const res = await api('PATCH', `/admin/pemasok/${id}/toggle`);
    showToast('success','Berhasil', res.message); adminPemasok();
  } catch(err) { showToast('error','Gagal', err.message); }
}

// ===================== PEMASOK PAGES =====================
async function pemasokDashboard() {
  setTitle('Dashboard Pemasok');
  showLoading();
  try {
    const data = await api('GET', '/pemasok/dashboard');
    const s    = data.stats;
    document.getElementById('pageContent').innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon green">🛒</div><div class="stat-label">Produk Sembako</div><div class="stat-value">${s.total_produk}</div></div>
        <div class="stat-card"><div class="stat-icon yellow">⏳</div><div class="stat-label">Permintaan Pending</div><div class="stat-value">${s.pending_cnt}</div><div class="stat-change ${s.pending_cnt>0?'down':''}">menunggu proses</div></div>
        <div class="stat-card"><div class="stat-icon green">✅</div><div class="stat-label">Permintaan Diproses</div><div class="stat-value">${s.approved_cnt}</div></div>
        <div class="stat-card"><div class="stat-icon blue">💰</div><div class="stat-label">Total Nilai Transaksi</div><div class="stat-value" style="font-size:16px">${fmt(s.total_revenue)}</div></div>
      </div>
      <div class="sembako-grid">
        ${data.produk.map(s=>{
          const pct = Math.min(100,(s.stock/200)*100);
          const cls = pct<20?'low':pct<50?'mid':'';
          return `<div class="sembako-card">
            <div class="sembako-icon">${s.icon}</div>
            <div class="sembako-name">${s.name}</div>
            <div class="sembako-price">${fmt(s.price)}</div>
            <div class="sembako-stock ${s.stock<20?'low':''}">Stok: ${s.stock} ${s.unit} ${s.stock<20?'⚠️ HAMPIR HABIS':''}</div>
            <div class="stock-bar-wrap"><div class="stock-bar ${cls}" style="width:${pct}%"></div></div>
          </div>`;
        }).join('')}
      </div>`;
  } catch(err) { showError(err.message); }
}

async function pemasokSembako() {
  setTitle('Kelola Sembako');
  showLoading();
  try {
    const { sembako } = await api('GET', '/pemasok/sembako');
    document.getElementById('pageContent').innerHTML = `
      <div class="page-header"><div><div class="page-header-title">🛒 Kelola Produk Sembako</div></div></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Produk</th><th>Harga</th><th>Stok</th><th>Satuan</th><th>Status Stok</th><th>Aksi</th></tr></thead>
        <tbody>${sembako.map(s=>{
          const pct = (s.stock/200)*100;
          return `<tr>
            <td><span style="font-size:20px">${s.icon}</span> <strong>${s.name}</strong></td>
            <td class="fw-bold text-green">${fmt(s.price)}</td>
            <td class="${s.stock<20?'text-red fw-bold':''}">${s.stock}</td>
            <td>${s.unit}</td>
            <td>
              <div class="stock-bar-wrap" style="min-width:80px"><div class="stock-bar ${pct<20?'low':pct<50?'mid':''}" style="width:${Math.min(100,pct)}%"></div></div>
              ${s.stock<20?'<span class="text-xs text-red">Hampir habis!</span>':''}
            </td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="showEditSembakoP(${s.id},'${s.name.replace(/'/g,"\\'")}',${s.price})">✏️ Edit</button>
              <button class="btn btn-primary btn-sm" onclick="showAddStok(${s.id},'${s.name.replace(/'/g,"\\'")}',${s.stock},'${s.unit}')">📦 Stok</button>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div></div>`;
  } catch(err) { showError(err.message); }
}

function showEditSembakoP(id, name, price) {
  showModal(`✏️ Edit ${name}`, `
    <div class="form-group"><label class="form-label">Nama Produk</label><input class="form-control" id="espName" value="${name}"></div>
    <div class="form-group"><label class="form-label">Harga Baru (Rp)</label><input type="number" class="form-control" id="espPrice" value="${price}"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="savePemasokSembako(${id})">💾 Simpan</button>`
  );
}

async function savePemasokSembako(id) {
  try {
    await api('PUT', `/pemasok/sembako/${id}`, {
      name: document.getElementById('espName').value,
      price: parseFloat(document.getElementById('espPrice').value),
    });
    closeModal(); showToast('success','Berhasil','Produk diperbarui'); pemasokSembako();
  } catch(err) { showToast('error','Gagal', err.message); }
}

function showAddStok(id, name, currentStock, unit) {
  showModal(`📦 Tambah Stok ${name}`, `
    <p class="text-sm text-muted mb-3">Stok saat ini: <strong>${currentStock} ${unit}</strong></p>
    <div class="form-group"><label class="form-label">Jumlah yang Ditambahkan</label><input type="number" class="form-control" id="addStokVal" min="1" placeholder="Masukkan jumlah"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveAddStok(${id})">📦 Tambah Stok</button>`
  );
}

async function saveAddStok(id) {
  const qty = parseFloat(document.getElementById('addStokVal').value);
  if (!qty || qty < 1) { showToast('error','Error','Masukkan jumlah yang valid'); return; }
  try {
    const res = await api('PATCH', `/pemasok/sembako/${id}/stock`, { action: 'add', qty });
    closeModal(); showToast('success','Berhasil', res.message); pemasokSembako();
  } catch(err) { showToast('error','Gagal', err.message); }
}

async function pemasokStok() {
  setTitle('Update Stok & Harga');
  showLoading();
  try {
    const { sembako } = await api('GET', '/pemasok/sembako');
    document.getElementById('pageContent').innerHTML = `
      <div class="page-header"><div><div class="page-header-title">📦 Update Stok & Harga Sembako</div></div></div>
      <div class="sembako-grid">
        ${sembako.map(s=>`
          <div class="sembako-card">
            <div class="sembako-icon">${s.icon}</div>
            <div class="sembako-name">${s.name}</div>
            <div class="sembako-price">${fmt(s.price)}/${s.unit}</div>
            <div class="sembako-stock ${s.stock<20?'low':''}">Stok: ${s.stock} ${s.unit}</div>
            <div class="form-group mt-2"><label class="form-label">Harga Baru (Rp)</label><input type="number" class="form-control" id="ph_${s.id}" value="${s.price}" style="padding:8px 12px;font-size:13px"></div>
            <div class="form-group"><label class="form-label">Tambah Stok</label><input type="number" class="form-control" id="ps_${s.id}" placeholder="0" style="padding:8px 12px;font-size:13px"></div>
            <button class="btn btn-primary btn-sm" style="width:100%" onclick="updateSembakoItem(${s.id},'${s.unit}')">💾 Update</button>
          </div>`).join('')}
      </div>`;
  } catch(err) { showError(err.message); }
}

async function updateSembakoItem(id, unit) {
  const newPrice = parseFloat(document.getElementById(`ph_${id}`).value);
  const addStock = parseFloat(document.getElementById(`ps_${id}`).value)||0;
  try {
    const tasks = [];
    if (newPrice > 0) tasks.push(api('PATCH', `/pemasok/sembako/${id}/price`, { price: newPrice }));
    if (addStock > 0) tasks.push(api('PATCH', `/pemasok/sembako/${id}/stock`, { action:'add', qty: addStock }));
    if (tasks.length === 0) { showToast('warning','Info','Tidak ada perubahan'); return; }
    await Promise.all(tasks);
    showToast('success','Berhasil','Data sembako diperbarui');
    pemasokStok();
  } catch(err) { showToast('error','Gagal', err.message); }
}

async function pemasokPermintaan() {
  setTitle('Permintaan Sembako');
  showLoading();
  try {
    const { requests } = await api('GET', '/pemasok/requests');
    const statusBadge = s => s==='approved'?'<span class="badge badge-green">✅ Selesai</span>':s==='rejected'?'<span class="badge badge-red">❌ Ditolak</span>':'<span class="badge badge-yellow">⏳ Pending</span>';
    document.getElementById('pageContent').innerHTML = `
      <div class="page-header"><div><div class="page-header-title">📋 Semua Permintaan Sembako</div><div class="page-header-sub">${requests.filter(w=>w.status==='pending').length} menunggu diproses</div></div></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Tanggal</th><th>Nasabah</th><th>Produk</th><th>Qty</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>${requests.length ? requests.map(w=>`<tr>
          <td>${fmtDate(w.request_date)}</td>
          <td><strong>${w.user_name}</strong></td>
          <td>${w.sembako_icon||'🛒'} ${w.sembako_name}</td>
          <td>${w.qty} ${w.sembako_unit||''}</td>
          <td class="fw-bold">${fmt(w.amount)}</td>
          <td>${statusBadge(w.status)}</td>
          <td>${w.status==='pending'?`<button class="btn btn-success btn-sm" onclick="approvePemasokReq(${w.id})">✅ Proses</button> <button class="btn btn-danger btn-sm" onclick="rejectPemasokReq(${w.id})">❌</button>`:'<span class="text-muted text-xs">-</span>'}</td>
        </tr>`).join('') : '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">Belum ada permintaan</div></div></td></tr>'}
        </tbody>
      </table></div></div>`;
  } catch(err) { showError(err.message); }
}

async function approvePemasokReq(id) {
  try {
    const res = await api('PATCH', `/pemasok/requests/${id}/approve`);
    showToast('success','Berhasil', res.message); pemasokPermintaan();
  } catch(err) { showToast('error','Gagal', err.message); }
}

async function rejectPemasokReq(id) {
  try {
    await api('PATCH', `/pemasok/requests/${id}/reject`);
    showToast('warning','Ditolak','Permintaan ditolak'); pemasokPermintaan();
  } catch(err) { showToast('error','Gagal', err.message); }
}

// ===================== AUTO-RESTORE SESSION =====================
document.addEventListener('DOMContentLoaded', async () => {
  const token = getToken();
  if (token) {
    try {
      const data = await api('GET', '/auth/me');
      currentUser = data.user;
      document.getElementById('authScreen').classList.add('hidden');
      document.getElementById('appScreen').classList.remove('hidden');
      await initApp();
    } catch {
      clearToken();
    }
  }

  // Demo hint
  const hint = document.createElement('div');
  hint.style.cssText = 'position:fixed;bottom:16px;left:16px;background:rgba(15,76,42,0.95);color:white;padding:14px 18px;border-radius:12px;font-size:12px;z-index:9999;max-width:260px;line-height:1.7;backdrop-filter:blur(4px)';
  hint.innerHTML = `<div style="font-weight:700;margin-bottom:6px">🔑 Akun Demo</div>
  <div>👤 <b>Nasabah:</b> budi@mail.com / 123456</div>
  <div>🛡️ <b>Admin:</b> admin@eco.com / admin123</div>
  <div>🏪 <b>Pemasok:</b> pemasok@mail.com / 123456</div>
  <div style="margin-top:6px;opacity:0.6;font-size:11px">Klik ✕ untuk tutup</div>
  <button onclick="this.parentElement.remove()" style="position:absolute;top:8px;right:8px;background:none;border:none;color:white;cursor:pointer;font-size:14px">✕</button>`;
  document.body.appendChild(hint);
});
