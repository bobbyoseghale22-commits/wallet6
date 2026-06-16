/* ============================================================================
   Admin panel logic
   ========================================================================== */

(async function initAdmin() {
  const admin = await Marsh.requireAuth({ admin: true });
  if (!admin) return;

  const tbody = document.getElementById('user-rows');
  const searchInput = document.getElementById('search');
  let currentSearch = '';
  let debounce;

  async function load() {
    tbody.innerHTML = `<tr><td colspan="6" class="center muted">Loading users…</td></tr>`;
    try {
      const q = currentSearch ? `?search=${encodeURIComponent(currentSearch)}` : '';
      const data = await Marsh.api.get(`/api/admin/users${q}`);
      renderRows(data.users);
      document.getElementById('user-count').textContent = data.pagination.total;
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="center muted">${err.message}</td></tr>`;
    }
  }

  function renderRows(users) {
    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="center muted">No users found.</td></tr>`;
      return;
    }
    tbody.innerHTML = users.map((u) => `
      <tr>
        <td>
          <div class="flex items-center gap-sm">
            ${Marsh.avatarHTML(u, 'avatar').replace('avatar"', 'avatar" style="width:34px;height:34px;border-radius:9px"')}
            <div>
              <div style="font-weight:600">${escapeHtml(u.name)}</div>
              <div class="muted" style="font-size:0.8rem">${escapeHtml(u.email)}</div>
            </div>
          </div>
        </td>
        <td><span class="role-pill ${u.role}">${u.role}</span></td>
        <td class="mono">${Marsh.fmt.usd(u.balance)}</td>
        <td>
          <span class="status-dot ${u.suspended ? 'suspended' : 'active'}"></span>
          ${u.suspended ? 'Suspended' : 'Active'}
        </td>
        <td class="muted" style="font-size:0.82rem">${Marsh.fmt.dateShort(u.createdAt)}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm" data-edit="${u.id}">Edit</button>
            <button class="btn btn-ghost btn-sm" data-suspend="${u.id}" data-state="${u.suspended}">
              ${u.suspended ? 'Unsuspend' : 'Suspend'}
            </button>
            <button class="btn btn-danger btn-sm" data-delete="${u.id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    // bind row buttons
    tbody.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => openEdit(users.find((u) => u.id === b.dataset.edit)))
    );
    tbody.querySelectorAll('[data-suspend]').forEach((b) =>
      b.addEventListener('click', () => toggleSuspend(b.dataset.suspend, b.dataset.state === 'true'))
    );
    tbody.querySelectorAll('[data-delete]').forEach((b) =>
      b.addEventListener('click', () => removeUser(b.dataset.delete, users.find((u) => u.id === b.dataset.delete)))
    );
  }

  /* --------------------------------- Edit --------------------------------- */
  function openEdit(u) {
    document.getElementById('edit-id').value = u.id;
    document.getElementById('edit-name').value = u.name;
    document.getElementById('edit-email').value = u.email;
    const wallets = u.wallets || { btc: 0, eth: 0, usdt: 0 };
    document.getElementById('edit-wallet-btc').value = wallets.btc;
    document.getElementById('edit-wallet-eth').value = wallets.eth;
    document.getElementById('edit-wallet-usdt').value = wallets.usdt;
    document.getElementById('edit-password').value = '';
    document.getElementById('edit-role').value = u.role;
    updateEditTotal();
    document.getElementById('edit-modal').classList.remove('hidden');
  }

  function updateEditTotal() {
    const btc = Number(document.getElementById('edit-wallet-btc').value) || 0;
    const eth = Number(document.getElementById('edit-wallet-eth').value) || 0;
    const usdt = Number(document.getElementById('edit-wallet-usdt').value) || 0;
    document.getElementById('edit-total-balance').textContent = Marsh.fmt.usd(btc + eth + usdt);
  }

  function closeEdit() {
    document.getElementById('edit-modal').classList.add('hidden');
  }

  async function saveEdit() {
    const btn = document.getElementById('save-edit');
    const payload = {
      id: document.getElementById('edit-id').value,
      name: document.getElementById('edit-name').value.trim(),
      email: document.getElementById('edit-email').value.trim(),
      wallets: {
        btc: Number(document.getElementById('edit-wallet-btc').value) || 0,
        eth: Number(document.getElementById('edit-wallet-eth').value) || 0,
        usdt: Number(document.getElementById('edit-wallet-usdt').value) || 0,
      },
      role: document.getElementById('edit-role').value,
    };
    const pw = document.getElementById('edit-password').value;
    if (pw) {
      if (pw.length < 8) return Marsh.toast('Password must be at least 8 characters.', 'error');
      payload.password = pw;
    }

    btn.disabled = true;
    try {
      await Marsh.api.put('/api/admin/update-user', payload);
      Marsh.toast('User updated.', 'success');
      closeEdit();
      load();
    } catch (err) {
      Marsh.toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  /* ------------------------------- Suspend -------------------------------- */
  async function toggleSuspend(id, currentlySuspended) {
    try {
      await Marsh.api.put('/api/admin/update-user', { id, suspended: !currentlySuspended });
      Marsh.toast(currentlySuspended ? 'User unsuspended.' : 'User suspended.', 'success');
      load();
    } catch (err) {
      Marsh.toast(err.message, 'error');
    }
  }

  /* -------------------------------- Delete -------------------------------- */
  async function removeUser(id, u) {
    if (!confirm(`Permanently delete ${u?.name || 'this user'}? This cannot be undone.`)) return;
    try {
      await Marsh.api.del(`/api/admin/user/${id}`);
      Marsh.toast('User deleted.', 'success');
      load();
    } catch (err) {
      Marsh.toast(err.message, 'error');
    }
  }

  /* -------------------------------- Helpers ------------------------------- */
  function escapeHtml(s = '') {
    return s.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // events
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      currentSearch = e.target.value.trim();
      load();
    }, 300);
  });
  document.getElementById('save-edit').addEventListener('click', saveEdit);
  document.getElementById('cancel-edit').addEventListener('click', closeEdit);
  document.getElementById('edit-modal').addEventListener('click', (e) => {
    if (e.target.id === 'edit-modal') closeEdit();
  });
  ['edit-wallet-btc', 'edit-wallet-eth', 'edit-wallet-usdt'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateEditTotal);
  });
  document.getElementById('logout-btn')?.addEventListener('click', () => Marsh.auth.logout());

  /* ----------------------------------- Tabs ---------------------------------- */
  document.querySelectorAll('[data-tab]').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('active', t === el));
      const tab = el.dataset.tab;
      document.getElementById('tab-users').classList.toggle('hidden', tab !== 'users');
      document.getElementById('tab-withdrawals').classList.toggle('hidden', tab !== 'withdrawals');
      document.getElementById('tab-kyc').classList.toggle('hidden', tab !== 'kyc');
      if (tab === 'withdrawals') loadWithdrawals();
      if (tab === 'kyc') loadKyc();
    });
  });

  /* -------------------------------- Withdrawals ------------------------------- */
  const wTbody = document.getElementById('withdrawal-rows');
  let currentStatus = 'pending';

  document.querySelectorAll('[data-status]').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('[data-status]').forEach((t) => t.classList.toggle('active', t === el));
      currentStatus = el.dataset.status;
      loadWithdrawals();
    });
  });

  function describeWithdrawal(w) {
    if (w.method === 'bank') {
      return `${escapeHtml(w.bankName)} — ${escapeHtml(w.accountName)}<br><span class="muted" style="font-size:0.78rem">Acct ••${escapeHtml((w.accountNumber || '').slice(-4))}${w.routingNumber ? ` · Routing ${escapeHtml(w.routingNumber)}` : ''}</span>`;
    }
    return `${escapeHtml(w.cryptoAsset)}${w.network ? ` (${escapeHtml(w.network)})` : ''}<br><span class="muted" style="font-size:0.78rem">${escapeHtml(w.walletAddress)}</span>`;
  }

  function withdrawalStatusBadge(status) {
    if (status === 'approved') return '<span class="badge success">Approved</span>';
    if (status === 'rejected') return '<span class="badge danger">Rejected</span>';
    return '<span class="badge warning">Pending</span>';
  }

  async function loadWithdrawals() {
    wTbody.innerHTML = `<tr><td colspan="7" class="center muted">Loading withdrawal requests…</td></tr>`;
    try {
      const q = currentStatus ? `?status=${encodeURIComponent(currentStatus)}` : '';
      const data = await Marsh.api.get(`/api/admin/withdrawals${q}`);
      renderWithdrawalRows(data.withdrawals);
      refreshPendingBadge();
    } catch (err) {
      wTbody.innerHTML = `<tr><td colspan="7" class="center muted">${err.message}</td></tr>`;
    }
  }

  async function refreshPendingBadge() {
    try {
      const data = await Marsh.api.get('/api/admin/withdrawals?status=pending&limit=100');
      const badge = document.getElementById('pending-count-badge');
      const count = data.pagination.total;
      if (count > 0) {
        badge.textContent = `${count} pending`;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    } catch (_) { /* ignore */ }
  }

  function renderWithdrawalRows(withdrawals) {
    if (!withdrawals.length) {
      wTbody.innerHTML = `<tr><td colspan="7" class="center muted">No withdrawal requests found.</td></tr>`;
      return;
    }
    wTbody.innerHTML = withdrawals.map((w) => `
      <tr>
        <td>
          <div style="font-weight:600">${escapeHtml(w.user?.name || '—')}</div>
          <div class="muted" style="font-size:0.8rem">${escapeHtml(w.user?.email || '')}</div>
        </td>
        <td>${w.method === 'bank' ? '🏦 Bank' : '₿ Crypto'}</td>
        <td style="font-size:0.85rem">${describeWithdrawal(w)}</td>
        <td class="mono">${Marsh.fmt.usd(w.amount)}</td>
        <td>
          ${withdrawalStatusBadge(w.status)}
          ${w.status === 'rejected' && w.rejectionReason ? `<div class="muted" style="font-size:0.75rem;margin-top:4px">${escapeHtml(w.rejectionReason)}</div>` : ''}
        </td>
        <td class="muted" style="font-size:0.82rem">${Marsh.fmt.dateShort(w.createdAt)}</td>
        <td>
          ${w.status === 'pending' ? `
            <div class="row-actions">
              <button class="btn btn-primary btn-sm" data-approve="${w.id}">Approve</button>
              <button class="btn btn-danger btn-sm" data-reject="${w.id}">Reject</button>
            </div>
          ` : '<span class="muted" style="font-size:0.8rem">—</span>'}
        </td>
      </tr>
    `).join('');

    wTbody.querySelectorAll('[data-approve]').forEach((b) =>
      b.addEventListener('click', () => approveWithdrawal(b.dataset.approve))
    );
    wTbody.querySelectorAll('[data-reject]').forEach((b) =>
      b.addEventListener('click', () => openRejectModal(b.dataset.reject))
    );
  }

  async function approveWithdrawal(id) {
    if (!confirm('Approve this withdrawal? The amount will be deducted from the user\'s balance.')) return;
    try {
      await Marsh.api.put(`/api/admin/withdrawals/${id}/approve`);
      Marsh.toast('Withdrawal approved.', 'success');
      loadWithdrawals();
    } catch (err) {
      Marsh.toast(err.message, 'error');
    }
  }

  function openRejectModal(id) {
    document.getElementById('reject-id').value = id;
    document.getElementById('reject-reason').value = '';
    document.getElementById('reject-modal').classList.remove('hidden');
  }

  function closeRejectModal() {
    document.getElementById('reject-modal').classList.add('hidden');
  }

  async function confirmReject() {
    const id = document.getElementById('reject-id').value;
    const reason = document.getElementById('reject-reason').value.trim();
    try {
      await Marsh.api.put(`/api/admin/withdrawals/${id}/reject`, { reason });
      Marsh.toast('Withdrawal rejected.', 'success');
      closeRejectModal();
      loadWithdrawals();
    } catch (err) {
      Marsh.toast(err.message, 'error');
    }
  }

  document.getElementById('cancel-reject').addEventListener('click', closeRejectModal);
  document.getElementById('confirm-reject').addEventListener('click', confirmReject);
  document.getElementById('reject-modal').addEventListener('click', (e) => {
    if (e.target.id === 'reject-modal') closeRejectModal();
  });

  /* ================================== KYC ================================== */
  const kycTbody = document.getElementById('kyc-rows');
  let currentKycStatus = 'pending';

  document.querySelectorAll('[data-kyc-status]').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('[data-kyc-status]').forEach((t) => t.classList.toggle('active', t === el));
      currentKycStatus = el.dataset.kycStatus;
      loadKyc();
    });
  });

  const KYC_STATUS_LABELS = {
    not_submitted: ['Not Submitted', ''],
    pending: ['Pending', 'warning'],
    approved: ['Approved', 'success'],
    rejected: ['Rejected', 'danger'],
    resubmit_requested: ['Resubmit Requested', 'warning'],
  };

  function kycStatusBadge(status) {
    const [label, cls] = KYC_STATUS_LABELS[status] || [status, ''];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function docPill(doc, label) {
    if (doc?.uploadedAt) {
      return `<span class="badge success" style="font-size:0.72rem">${label} ✓</span>`;
    }
    return `<span class="badge" style="font-size:0.72rem;opacity:0.5">${label}</span>`;
  }

  async function loadKyc() {
    kycTbody.innerHTML = `<tr><td colspan="5" class="center muted">Loading…</td></tr>`;
    try {
      const statusParam = currentKycStatus === 'all' ? '' : `?status=${encodeURIComponent(currentKycStatus)}`;
      const data = await Marsh.api.get(`/api/admin/kyc${statusParam}`);
      renderKycRows(data.users);
      refreshKycBadge();
    } catch (err) {
      kycTbody.innerHTML = `<tr><td colspan="5" class="center muted">${err.message}</td></tr>`;
    }
  }

  async function refreshKycBadge() {
    try {
      const data = await Marsh.api.get('/api/admin/kyc?status=pending&limit=100');
      const badge = document.getElementById('kyc-pending-badge');
      const count = data.pagination.total;
      if (count > 0) { badge.textContent = `${count} pending`; badge.classList.remove('hidden'); }
      else badge.classList.add('hidden');
    } catch (_) {}
  }

  function renderKycRows(users) {
    if (!users.length) {
      kycTbody.innerHTML = `<tr><td colspan="5" class="center muted">No KYC submissions found.</td></tr>`;
      return;
    }
    kycTbody.innerHTML = users.map((u) => `
      <tr>
        <td>
          <div style="font-weight:600">${escapeHtml(u.name)}</div>
          <div class="muted" style="font-size:0.8rem">${escapeHtml(u.email)}</div>
          ${u.country ? `<div class="muted" style="font-size:0.75rem">${escapeHtml(u.country)}</div>` : ''}
        </td>
        <td>
          <div class="kyc-docs-row">
            ${docPill(u.proofOfId, 'ID')}
            ${docPill(u.proofOfAddress, 'Address')}
            ${docPill(u.proofOfFunds, 'Funds')}
          </div>
        </td>
        <td>
          ${kycStatusBadge(u.kycStatus)}
          ${u.kycAdminNote ? `<div class="muted" style="font-size:0.75rem;margin-top:4px">${escapeHtml(u.kycAdminNote)}</div>` : ''}
        </td>
        <td class="muted" style="font-size:0.82rem">
          ${u.proofOfId?.uploadedAt ? Marsh.fmt.dateShort(u.proofOfId.uploadedAt) : '—'}
        </td>
        <td>
          <button class="btn btn-ghost btn-sm" data-kyc-review="${u.id}" data-kyc-name="${escapeHtml(u.name)}">
            Review
          </button>
        </td>
      </tr>
    `).join('');

    kycTbody.querySelectorAll('[data-kyc-review]').forEach((b) => {
      b.addEventListener('click', () => openKycModal(b.dataset.kycReview, b.dataset.kycName));
    });
  }

  /* -------------------------- KYC Review Modal -------------------------- */
  let kycModalUserId = null;

  async function openKycModal(userId, userName) {
    kycModalUserId = userId;
    document.getElementById('kyc-modal-title').textContent = `Review KYC — ${userName}`;
    document.getElementById('kyc-user-id').value = userId;
    document.getElementById('kyc-note').value = '';

    // Load document previews
    const previewsEl = document.getElementById('kyc-doc-previews');
    previewsEl.innerHTML = '<p class="muted center" style="font-size:0.85rem">Loading documents…</p>';
    document.getElementById('kyc-modal').classList.remove('hidden');

    const docTypes = [
      { key: 'proofOfId', label: '🪪 Proof of ID' },
      { key: 'proofOfAddress', label: '🏠 Proof of Address' },
      { key: 'proofOfFunds', label: '💰 Proof of Funds' },
    ];

    const previews = await Promise.all(docTypes.map(async ({ key, label }) => {
      try {
        const data = await Marsh.api.get(`/api/admin/kyc/${userId}/document/${key}`);
        const isPdf = data.url?.startsWith('data:application/pdf');
        return `
          <div style="border:1px solid var(--glass-border);border-radius:10px;padding:12px">
            <div style="font-weight:600;font-size:0.85rem;margin-bottom:8px">${label} — <span class="muted" style="font-weight:400">${escapeHtml(data.filename)}</span></div>
            ${isPdf
              ? `<a href="${data.url}" target="_blank" class="btn btn-ghost btn-sm doc-preview-btn">Open PDF ↗</a>`
              : `<img src="${data.url}" alt="${label}" style="width:100%;max-height:220px;object-fit:contain;border-radius:6px;background:#111" />`
            }
          </div>`;
      } catch (_) {
        return `<div style="border:1px solid var(--glass-border);border-radius:10px;padding:12px;opacity:0.45">
          <div style="font-weight:600;font-size:0.85rem">${label}</div>
          <div class="muted" style="font-size:0.8rem;margin-top:4px">Not uploaded</div>
        </div>`;
      }
    }));

    previewsEl.innerHTML = previews.join('');
  }

  function closeKycModal() {
    document.getElementById('kyc-modal').classList.add('hidden');
    kycModalUserId = null;
  }

  async function submitKycAction(action) {
    const id = kycModalUserId;
    const note = document.getElementById('kyc-note').value.trim();

    if ((action === 'reject' || action === 'request-resubmit') && !note) {
      return Marsh.toast('A note is required for this action.', 'error');
    }

    try {
      await Marsh.api.put(`/api/admin/kyc/${id}/${action}`, { note });
      const labels = { approve: 'KYC approved.', reject: 'KYC rejected.', 'request-resubmit': 'Resubmission requested.' };
      Marsh.toast(labels[action] || 'Done.', 'success');
      closeKycModal();
      loadKyc();
    } catch (err) {
      Marsh.toast(err.message, 'error');
    }
  }

  document.getElementById('cancel-kyc').addEventListener('click', closeKycModal);
  document.getElementById('kyc-modal').addEventListener('click', (e) => {
    if (e.target.id === 'kyc-modal') closeKycModal();
  });
  document.getElementById('kyc-approve-btn').addEventListener('click', () => submitKycAction('approve'));
  document.getElementById('kyc-reject-btn').addEventListener('click', () => submitKycAction('reject'));
  document.getElementById('kyc-resubmit-btn').addEventListener('click', () => submitKycAction('request-resubmit'));

  refreshKycBadge();
  refreshPendingBadge();
  load();
})();
