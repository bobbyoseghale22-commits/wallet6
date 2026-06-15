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
    document.getElementById('edit-balance').value = u.balance;
    document.getElementById('edit-password').value = '';
    document.getElementById('edit-role').value = u.role;
    document.getElementById('edit-modal').classList.remove('hidden');
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
      balance: Number(document.getElementById('edit-balance').value),
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
  document.getElementById('logout-btn')?.addEventListener('click', () => Marsh.auth.logout());

  /* ----------------------------------- Tabs ---------------------------------- */
  document.querySelectorAll('[data-tab]').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('active', t === el));
      const tab = el.dataset.tab;
      document.getElementById('tab-users').classList.toggle('hidden', tab !== 'users');
      document.getElementById('tab-withdrawals').classList.toggle('hidden', tab !== 'withdrawals');
      if (tab === 'withdrawals') loadWithdrawals();
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

  refreshPendingBadge();
  load();
})();
