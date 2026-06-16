/* ============================================================================
   Marsh CRM — admin.js
   ========================================================================== */

(async function initAdmin() {
  const admin = await Marsh.requireAuth({ admin: true });
  if (!admin) return;

  // Render admin avatar in topbar
  document.getElementById('admin-avatar-host').innerHTML =
    Marsh.avatarHTML(admin, 'avatar').replace('84px', '36px').replace('width: 84', 'width: 36').replace('height: 84', 'height: 36')
      .replace(/width:\s*84px/g, 'width:36px').replace(/height:\s*84px/g, 'height:36px')
      .replace('border-radius: 18px', 'border-radius:9px');

  /* ===================================================================
     HELPERS
     =================================================================== */
  function escapeHtml(s = '') {
    return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function kycBadge(status) {
    const map = {
      not_submitted: ['—', ''],
      pending:       ['⏳ Pending',  'warning'],
      approved:      ['✓ Verified',  'success'],
      rejected:      ['✗ Rejected',  'danger'],
      resubmit_requested: ['↩ Resubmit', 'warning'],
    };
    const [label, cls] = map[status] || [status, ''];
    return label ? `<span class="badge ${cls}" style="font-size:0.72rem">${label}</span>` : '<span class="muted">—</span>';
  }

  function wdBadge(status) {
    if (status === 'approved') return '<span class="badge success">Approved</span>';
    if (status === 'rejected') return '<span class="badge danger">Rejected</span>';
    return '<span class="badge warning">Pending</span>';
  }

  function rolePill(role) {
    return `<span class="role-pill ${role}">${role}</span>`;
  }

  function statusDot(suspended) {
    return `<span class="status-dot ${suspended ? 'suspended' : 'active'}"></span>${suspended ? 'Suspended' : 'Active'}`;
  }

  /* ===================================================================
     NAVIGATION / VIEW SWITCHING
     =================================================================== */
  const VIEW_TITLES = { overview: 'Dashboard', users: 'All Users', kyc: 'KYC Review', withdrawals: 'Withdrawals' };
  let activeView = 'overview';

  function switchView(view) {
    activeView = view;
    document.querySelectorAll('.crm-view').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');
    document.querySelectorAll('.crm-nav-item[data-view]').forEach(el =>
      el.classList.toggle('active', el.dataset.view === view)
    );
    document.getElementById('crm-title').textContent = VIEW_TITLES[view] || view;

    if (view === 'overview')     loadOverview();
    if (view === 'users')        loadUsers();
    if (view === 'kyc')          loadKyc();
    if (view === 'withdrawals')  loadWithdrawals();
  }

  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); switchView(el.dataset.view); });
  });

  // Global search wires to user view
  let searchDebounce;
  document.getElementById('search').addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      currentUserSearch = e.target.value.trim();
      if (activeView !== 'users') switchView('users');
      else loadUsers();
    }, 300);
  });

  document.getElementById('logout-btn').addEventListener('click', () => Marsh.auth.logout());

  /* ===================================================================
     OVERVIEW
     =================================================================== */
  async function loadOverview() {
    try {
      const [usersRes, kycRes, wdRes] = await Promise.all([
        Marsh.api.get('/api/admin/users?limit=5'),
        Marsh.api.get('/api/admin/kyc?status=pending&limit=1'),
        Marsh.api.get('/api/admin/withdrawals?status=pending&limit=1'),
      ]);

      document.getElementById('stat-users').textContent = usersRes.pagination.total;
      document.getElementById('stat-kyc').textContent   = kycRes.pagination.total;
      document.getElementById('stat-wd').textContent    = wdRes.pagination.total;
      document.getElementById('nav-user-count').textContent = usersRes.pagination.total;
      document.getElementById('nav-kyc-count').textContent  = kycRes.pagination.total;
      document.getElementById('nav-wd-count').textContent   = wdRes.pagination.total;

      // Suspended count
      const suspRes = await Marsh.api.get('/api/admin/users?suspended=true&limit=1');
      document.getElementById('stat-suspended').textContent = suspRes.pagination.total;

      renderRecentRows(usersRes.users);
    } catch (err) {
      console.error(err);
    }
  }

  function renderRecentRows(users) {
    const tbody = document.getElementById('recent-rows');
    if (!users.length) { tbody.innerHTML = `<tr><td colspan="6" class="center muted">No users yet.</td></tr>`; return; }
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div style="font-weight:600">${escapeHtml(u.name)}</div>
          <div class="muted" style="font-size:0.78rem">${escapeHtml(u.email)}</div>
        </td>
        <td class="muted">${escapeHtml(u.country || '—')}</td>
        <td class="mono" style="color:var(--cyan)">${Marsh.fmt.usd(u.balance)}</td>
        <td>${kycBadge(u.kyc?.status || 'not_submitted')}</td>
        <td class="muted" style="font-size:0.82rem">${Marsh.fmt.dateShort(u.createdAt)}</td>
        <td><button class="btn btn-ghost btn-sm" data-open-user="${u.id}">View</button></td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-open-user]').forEach(b =>
      b.addEventListener('click', () => openDrawer(users.find(u => u.id === b.dataset.openUser)))
    );
  }

  /* ===================================================================
     USERS
     =================================================================== */
  let currentUserSearch = '';
  let currentUserPage   = 1;

  document.getElementById('user-role-filter').addEventListener('change', () => { currentUserPage = 1; loadUsers(); });
  document.getElementById('user-status-filter').addEventListener('change', () => { currentUserPage = 1; loadUsers(); });

  async function loadUsers() {
    const tbody = document.getElementById('user-rows');
    tbody.innerHTML = `<tr><td colspan="8" class="center muted">Loading users…</td></tr>`;
    try {
      const role      = document.getElementById('user-role-filter').value;
      const suspended = document.getElementById('user-status-filter').value;
      const params = new URLSearchParams({ page: currentUserPage, limit: 20 });
      if (currentUserSearch) params.set('search', currentUserSearch);
      if (role) params.set('role', role);
      if (suspended === 'suspended') params.set('suspended', 'true');
      if (suspended === 'active')    params.set('suspended', 'false');

      const data = await Marsh.api.get(`/api/admin/users?${params}`);
      document.getElementById('nav-user-count').textContent = data.pagination.total;
      renderUserRows(data.users);
      renderPagination('user-pagination', data.pagination, (p) => { currentUserPage = p; loadUsers(); });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="center muted">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderUserRows(users) {
    const tbody = document.getElementById('user-rows');
    if (!users.length) { tbody.innerHTML = `<tr><td colspan="8" class="center muted">No users found.</td></tr>`; return; }
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div style="font-weight:600">${escapeHtml(u.name)}</div>
          <div class="muted" style="font-size:0.78rem">${escapeHtml(u.email)}</div>
        </td>
        <td class="muted">${escapeHtml(u.country || '—')}</td>
        <td class="muted">${escapeHtml(u.phone || '—')}</td>
        <td class="mono" style="color:var(--cyan)">${Marsh.fmt.usd(u.balance)}</td>
        <td>${kycBadge(u.kyc?.status || 'not_submitted')}</td>
        <td>${statusDot(u.suspended)}</td>
        <td class="muted" style="font-size:0.82rem">${Marsh.fmt.dateShort(u.createdAt)}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm" data-open-user="${u.id}">Open</button>
            <button class="btn btn-danger btn-sm" data-delete="${u.id}" data-name="${escapeHtml(u.name)}">Delete</button>
          </div>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-open-user]').forEach(b =>
      b.addEventListener('click', () => openDrawer(users.find(u => u.id === b.dataset.openUser)))
    );
    tbody.querySelectorAll('[data-delete]').forEach(b =>
      b.addEventListener('click', () => removeUser(b.dataset.delete, b.dataset.name))
    );
  }

  function renderPagination(containerId, pagination, onPage) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (pagination.pages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    for (let i = 1; i <= pagination.pages; i++) {
      html += `<button class="crm-tab${i === pagination.page ? ' active' : ''}" data-page="${i}">${i}</button>`;
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-page]').forEach(b =>
      b.addEventListener('click', () => onPage(Number(b.dataset.page)))
    );
  }

  /* ===================================================================
     USER DETAIL DRAWER
     =================================================================== */
  let drawerUser = null;
  let drawerTab  = 'details';

  function openDrawer(u) {
    drawerUser = u;
    drawerTab  = 'details';

    // Head
    document.getElementById('drawer-name').textContent  = u.name;
    document.getElementById('drawer-email').textContent = u.email;

    // Detail rows
    document.getElementById('edit-id').value            = u.id;
    document.getElementById('edit-name').value          = u.name;
    document.getElementById('edit-email').value         = u.email;
    document.getElementById('edit-role').value          = u.role;
    document.getElementById('drawer-status-badge').innerHTML  = statusDot(u.suspended);
    document.getElementById('drawer-role-badge').innerHTML    = rolePill(u.role);
    document.getElementById('drawer-country').textContent     = u.country  || '—';
    document.getElementById('drawer-phone').textContent       = u.phone    || '—';
    document.getElementById('drawer-kyc-badge').innerHTML     = kycBadge(u.kyc?.status || 'not_submitted');
    document.getElementById('drawer-joined').textContent      = Marsh.fmt.dateShort(u.createdAt);
    document.getElementById('drawer-lastlogin').textContent   = Marsh.fmt.date(u.lastLogin);
    document.getElementById('drawer-balance').textContent     = Marsh.fmt.usd(u.balance);

    // Wallets
    const w = u.wallets || { btc: 0, eth: 0, usdt: 0 };
    document.getElementById('edit-wallet-btc').value   = w.btc;
    document.getElementById('edit-wallet-eth').value   = w.eth;
    document.getElementById('edit-wallet-usdt').value  = w.usdt;
    updateWalletTotal();

    // Suspend button label
    document.getElementById('drawer-suspend-btn').textContent = u.suspended ? 'Unsuspend' : 'Suspend';
    document.getElementById('edit-password').value = '';

    // Show correct drawer tab
    switchDrawerTab('details');

    document.getElementById('drawer-overlay').classList.remove('hidden');
    document.getElementById('user-drawer').classList.remove('hidden');
  }

  function closeDrawer() {
    document.getElementById('drawer-overlay').classList.add('hidden');
    document.getElementById('user-drawer').classList.add('hidden');
    drawerUser = null;
  }

  function switchDrawerTab(tab) {
    drawerTab = tab;
    ['details', 'wallets', 'security'].forEach(t => {
      document.getElementById(`drawer-tab-${t}`).classList.toggle('hidden', t !== tab);
    });
    document.querySelectorAll('[data-drawer-tab]').forEach(b =>
      b.classList.toggle('active', b.dataset.drawerTab === tab)
    );
  }

  function updateWalletTotal() {
    const btc  = Number(document.getElementById('edit-wallet-btc').value)  || 0;
    const eth  = Number(document.getElementById('edit-wallet-eth').value)   || 0;
    const usdt = Number(document.getElementById('edit-wallet-usdt').value)  || 0;
    document.getElementById('edit-total-balance').textContent = Marsh.fmt.usd(btc + eth + usdt);
  }

  ['edit-wallet-btc', 'edit-wallet-eth', 'edit-wallet-usdt'].forEach(id =>
    document.getElementById(id).addEventListener('input', updateWalletTotal)
  );

  document.querySelectorAll('[data-drawer-tab]').forEach(b =>
    b.addEventListener('click', () => switchDrawerTab(b.dataset.drawerTab))
  );

  document.getElementById('close-drawer').addEventListener('click', closeDrawer);
  document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);

  // Save details
  document.getElementById('save-details-btn').addEventListener('click', async () => {
    const btn = document.getElementById('save-details-btn');
    btn.disabled = true;
    try {
      await Marsh.api.put('/api/admin/update-user', {
        id:    document.getElementById('edit-id').value,
        name:  document.getElementById('edit-name').value.trim(),
        email: document.getElementById('edit-email').value.trim(),
        role:  document.getElementById('edit-role').value,
      });
      Marsh.toast('Details saved.', 'success');
      closeDrawer();
      if (activeView === 'users') loadUsers(); else loadOverview();
    } catch (err) { Marsh.toast(err.message, 'error'); }
    finally { btn.disabled = false; }
  });

  // Save wallets
  document.getElementById('save-wallets-btn').addEventListener('click', async () => {
    const btn = document.getElementById('save-wallets-btn');
    btn.disabled = true;
    try {
      await Marsh.api.put('/api/admin/update-user', {
        id: document.getElementById('edit-id').value,
        wallets: {
          btc:  Number(document.getElementById('edit-wallet-btc').value)  || 0,
          eth:  Number(document.getElementById('edit-wallet-eth').value)   || 0,
          usdt: Number(document.getElementById('edit-wallet-usdt').value)  || 0,
        },
      });
      Marsh.toast('Wallets updated.', 'success');
      closeDrawer();
      if (activeView === 'users') loadUsers(); else loadOverview();
    } catch (err) { Marsh.toast(err.message, 'error'); }
    finally { btn.disabled = false; }
  });

  // Reset password
  document.getElementById('save-password-btn').addEventListener('click', async () => {
    const btn = document.getElementById('save-password-btn');
    const pw = document.getElementById('edit-password').value;
    if (pw.length < 8) return Marsh.toast('Password must be at least 8 characters.', 'error');
    btn.disabled = true;
    try {
      await Marsh.api.put('/api/admin/update-user', {
        id: document.getElementById('edit-id').value,
        password: pw,
      });
      Marsh.toast('Password reset.', 'success');
      document.getElementById('edit-password').value = '';
    } catch (err) { Marsh.toast(err.message, 'error'); }
    finally { btn.disabled = false; }
  });

  // Suspend / unsuspend
  document.getElementById('drawer-suspend-btn').addEventListener('click', async () => {
    if (!drawerUser) return;
    try {
      await Marsh.api.put('/api/admin/update-user', { id: drawerUser.id, suspended: !drawerUser.suspended });
      Marsh.toast(drawerUser.suspended ? 'Account unsuspended.' : 'Account suspended.', 'success');
      closeDrawer();
      if (activeView === 'users') loadUsers(); else loadOverview();
    } catch (err) { Marsh.toast(err.message, 'error'); }
  });

  // Delete
  document.getElementById('drawer-delete-btn').addEventListener('click', () => {
    if (!drawerUser) return;
    removeUser(drawerUser.id, drawerUser.name, true);
  });

  async function removeUser(id, name, fromDrawer = false) {
    if (!confirm(`Permanently delete ${name || 'this user'}? This cannot be undone.`)) return;
    try {
      await Marsh.api.del(`/api/admin/user/${id}`);
      Marsh.toast('User deleted.', 'success');
      if (fromDrawer) closeDrawer();
      if (activeView === 'users') loadUsers(); else loadOverview();
    } catch (err) { Marsh.toast(err.message, 'error'); }
  }

  /* ===================================================================
     KYC
     =================================================================== */
  let currentKycStatus = 'pending';

  document.querySelectorAll('[data-kyc-status]').forEach(el =>
    el.addEventListener('click', () => {
      document.querySelectorAll('[data-kyc-status]').forEach(t => t.classList.toggle('active', t === el));
      currentKycStatus = el.dataset.kycStatus;
      loadKyc();
    })
  );

  async function loadKyc() {
    const tbody = document.getElementById('kyc-rows');
    tbody.innerHTML = `<tr><td colspan="6" class="center muted">Loading…</td></tr>`;
    try {
      const statusParam = currentKycStatus === 'all' ? '' : `?status=${encodeURIComponent(currentKycStatus)}`;
      const data = await Marsh.api.get(`/api/admin/kyc${statusParam}`);
      document.getElementById('nav-kyc-count').textContent = data.pagination.total;
      renderKycRows(data.users);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="center muted">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function docPill(doc, label) {
    return doc?.uploadedAt
      ? `<span class="badge success" style="font-size:0.7rem;padding:3px 8px">${label} ✓</span>`
      : `<span class="badge" style="font-size:0.7rem;padding:3px 8px;opacity:0.4">${label}</span>`;
  }

  function renderKycRows(users) {
    const tbody = document.getElementById('kyc-rows');
    if (!users.length) { tbody.innerHTML = `<tr><td colspan="6" class="center muted">No KYC submissions.</td></tr>`; return; }
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div style="font-weight:600">${escapeHtml(u.name)}</div>
          <div class="muted" style="font-size:0.78rem">${escapeHtml(u.email)}</div>
          ${u.country ? `<div class="muted" style="font-size:0.75rem">${escapeHtml(u.country)}</div>` : ''}
        </td>
        <td>
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            ${docPill(u.proofOfId, 'ID')}
            ${docPill(u.proofOfAddress, 'Address')}
            ${docPill(u.proofOfFunds, 'Funds')}
          </div>
        </td>
        <td>${kycBadge(u.kycStatus)}</td>
        <td class="muted" style="font-size:0.78rem;max-width:180px">${escapeHtml(u.kycAdminNote || '—')}</td>
        <td class="muted" style="font-size:0.82rem">${u.proofOfId?.uploadedAt ? Marsh.fmt.dateShort(u.proofOfId.uploadedAt) : '—'}</td>
        <td>
          <button class="btn btn-primary btn-sm" data-kyc-review="${u.id}" data-kyc-name="${escapeHtml(u.name)}" data-kyc-email="${escapeHtml(u.email)}" data-kyc-status="${u.kycStatus}">
            Review Docs
          </button>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-kyc-review]').forEach(b =>
      b.addEventListener('click', () => openKycDrawer(b.dataset.kycReview, b.dataset.kycName, b.dataset.kycEmail, b.dataset.kycStatus))
    );
  }

  /* ===================================================================
     KYC REVIEW DRAWER
     =================================================================== */
  let kycDrawerUserId = null;

  async function openKycDrawer(userId, userName, userEmail, kycStatus) {
    kycDrawerUserId = userId;
    document.getElementById('kyc-drawer-name').textContent  = `KYC Review — ${userName}`;
    document.getElementById('kyc-drawer-email').textContent = userEmail;
    document.getElementById('kyc-drawer-status').innerHTML  = kycBadge(kycStatus);
    document.getElementById('kyc-note').value = '';

    document.getElementById('kyc-overlay').classList.remove('hidden');
    document.getElementById('kyc-drawer').classList.remove('hidden');

    // Load all three docs
    const grid = document.getElementById('kyc-doc-grid');
    grid.innerHTML = '<div class="center muted" style="grid-column:1/-1;padding:30px">Loading documents…</div>';

    const docTypes = [
      { key: 'proofOfId',      label: '🪪 Proof of ID' },
      { key: 'proofOfAddress', label: '🏠 Proof of Address' },
      { key: 'proofOfFunds',   label: '💰 Proof of Funds' },
    ];

    const panels = await Promise.all(docTypes.map(async ({ key, label }) => {
      try {
        const doc = await Marsh.api.get(`/api/admin/kyc/${userId}/document/${key}`);
        const isPdf = doc.url?.startsWith('data:application/pdf');
        const uploadedDate = doc.uploadedAt ? Marsh.fmt.dateShort(doc.uploadedAt) : '';
        return `
          <div class="kyc-doc-panel">
            <div class="kyc-doc-panel-head">
              <span>${label}</span>
              <span class="badge success" style="font-size:0.65rem;padding:2px 6px">Uploaded</span>
            </div>
            <div class="kyc-doc-panel-body">
              ${isPdf
                ? `<div style="text-align:center">
                    <div style="font-size:2rem;margin-bottom:8px">📄</div>
                    <a href="${doc.url}" target="_blank" class="btn btn-ghost btn-sm">Open PDF ↗</a>
                   </div>`
                : `<img src="${doc.url}" alt="${label}" />`
              }
            </div>
            <div class="kyc-doc-panel-foot">
              <span style="word-break:break-all;flex:1">${escapeHtml(doc.filename)}</span>
              <span>${uploadedDate}</span>
            </div>
          </div>`;
      } catch (_) {
        return `
          <div class="kyc-doc-panel" style="opacity:0.45">
            <div class="kyc-doc-panel-head">${label}</div>
            <div class="kyc-doc-panel-body">
              <div class="center muted" style="font-size:0.82rem">Not uploaded</div>
            </div>
            <div class="kyc-doc-panel-foot">—</div>
          </div>`;
      }
    }));

    grid.innerHTML = panels.join('');
  }

  function closeKycDrawer() {
    document.getElementById('kyc-overlay').classList.add('hidden');
    document.getElementById('kyc-drawer').classList.add('hidden');
    kycDrawerUserId = null;
  }

  async function submitKycAction(action) {
    const id   = kycDrawerUserId;
    const note = document.getElementById('kyc-note').value.trim();
    if ((action === 'reject' || action === 'request-resubmit') && !note) {
      return Marsh.toast('A note to the user is required for this action.', 'error');
    }
    try {
      await Marsh.api.put(`/api/admin/kyc/${id}/${action}`, { note });
      const labels = { approve: 'KYC approved ✓', reject: 'KYC rejected.', 'request-resubmit': 'Resubmission requested.' };
      Marsh.toast(labels[action] || 'Done.', 'success');
      closeKycDrawer();
      loadKyc();
    } catch (err) { Marsh.toast(err.message, 'error'); }
  }

  document.getElementById('close-kyc-drawer').addEventListener('click', closeKycDrawer);
  document.getElementById('kyc-overlay').addEventListener('click', closeKycDrawer);
  document.getElementById('kyc-approve-btn').addEventListener('click',   () => submitKycAction('approve'));
  document.getElementById('kyc-reject-btn').addEventListener('click',    () => submitKycAction('reject'));
  document.getElementById('kyc-resubmit-btn').addEventListener('click',  () => submitKycAction('request-resubmit'));

  /* ===================================================================
     WITHDRAWALS
     =================================================================== */
  let currentWdStatus = 'pending';

  document.querySelectorAll('[data-wd-status]').forEach(el =>
    el.addEventListener('click', () => {
      document.querySelectorAll('[data-wd-status]').forEach(t => t.classList.toggle('active', t === el));
      currentWdStatus = el.dataset.wdStatus;
      loadWithdrawals();
    })
  );

  async function loadWithdrawals() {
    const tbody = document.getElementById('withdrawal-rows');
    tbody.innerHTML = `<tr><td colspan="7" class="center muted">Loading…</td></tr>`;
    try {
      const q = currentWdStatus ? `?status=${encodeURIComponent(currentWdStatus)}` : '';
      const data = await Marsh.api.get(`/api/admin/withdrawals${q}`);
      document.getElementById('nav-wd-count').textContent = data.pagination.total;
      renderWdRows(data.withdrawals);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="center muted">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function wdDetails(w) {
    if (w.method === 'bank') {
      return `<div style="font-size:0.83rem">${escapeHtml(w.bankName)}</div>
              <div class="muted" style="font-size:0.75rem">${escapeHtml(w.accountName)} · ••${escapeHtml((w.accountNumber||'').slice(-4))}</div>`;
    }
    return `<div style="font-size:0.83rem">${escapeHtml(w.cryptoAsset)}${w.network ? ` <span class="muted">(${escapeHtml(w.network)})</span>` : ''}</div>
            <div class="muted" style="font-size:0.75rem;word-break:break-all">${escapeHtml(w.walletAddress)}</div>`;
  }

  function renderWdRows(withdrawals) {
    const tbody = document.getElementById('withdrawal-rows');
    if (!withdrawals.length) { tbody.innerHTML = `<tr><td colspan="7" class="center muted">No requests found.</td></tr>`; return; }
    tbody.innerHTML = withdrawals.map(w => `
      <tr>
        <td>
          <div style="font-weight:600">${escapeHtml(w.user?.name || '—')}</div>
          <div class="muted" style="font-size:0.78rem">${escapeHtml(w.user?.email || '')}</div>
        </td>
        <td>${w.method === 'bank' ? '🏦 Bank' : '₿ Crypto'}</td>
        <td>${wdDetails(w)}</td>
        <td class="mono" style="color:var(--cyan)">${Marsh.fmt.usd(w.amount)}</td>
        <td>
          ${wdBadge(w.status)}
          ${w.rejectionReason ? `<div class="muted" style="font-size:0.73rem;margin-top:3px">${escapeHtml(w.rejectionReason)}</div>` : ''}
        </td>
        <td class="muted" style="font-size:0.82rem">${Marsh.fmt.dateShort(w.createdAt)}</td>
        <td>
          ${w.status === 'pending' ? `
            <div class="row-actions">
              <button class="btn btn-primary btn-sm" data-approve="${w.id}">Approve</button>
              <button class="btn btn-danger btn-sm"  data-reject="${w.id}">Reject</button>
            </div>` : '<span class="muted">—</span>'}
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-approve]').forEach(b =>
      b.addEventListener('click', () => approveWithdrawal(b.dataset.approve))
    );
    tbody.querySelectorAll('[data-reject]').forEach(b =>
      b.addEventListener('click', () => openRejectModal(b.dataset.reject))
    );
  }

  async function approveWithdrawal(id) {
    if (!confirm('Approve this withdrawal? The amount will be deducted from the user\'s balance.')) return;
    try {
      await Marsh.api.put(`/api/admin/withdrawals/${id}/approve`);
      Marsh.toast('Withdrawal approved.', 'success');
      loadWithdrawals();
    } catch (err) { Marsh.toast(err.message, 'error'); }
  }

  function openRejectModal(id) {
    document.getElementById('reject-id').value = id;
    document.getElementById('reject-reason').value = '';
    document.getElementById('reject-modal').classList.remove('hidden');
  }
  function closeRejectModal() {
    document.getElementById('reject-modal').classList.add('hidden');
  }
  document.getElementById('cancel-reject').addEventListener('click', closeRejectModal);
  document.getElementById('reject-modal').addEventListener('click', e => { if (e.target.id === 'reject-modal') closeRejectModal(); });
  document.getElementById('confirm-reject').addEventListener('click', async () => {
    const id     = document.getElementById('reject-id').value;
    const reason = document.getElementById('reject-reason').value.trim();
    try {
      await Marsh.api.put(`/api/admin/withdrawals/${id}/reject`, { reason });
      Marsh.toast('Withdrawal rejected.', 'success');
      closeRejectModal();
      loadWithdrawals();
    } catch (err) { Marsh.toast(err.message, 'error'); }
  });

  /* ===================================================================
     BOOT
     =================================================================== */
  switchView('overview');
})();
