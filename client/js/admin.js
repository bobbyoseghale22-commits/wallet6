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

  load();
})();
