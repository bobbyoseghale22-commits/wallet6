/* ============================================================================
   Profile management page
   ========================================================================== */

(async function initProfile() {
  const user = await Marsh.requireAuth();
  if (!user) return;

  if (user.role === 'admin') {
    document.getElementById('admin-link')?.classList.remove('hidden');
  }

  // Hydrate
  document.getElementById('avatar-host').innerHTML = Marsh.avatarHTML(user);
  document.getElementById('p-name-display').textContent = user.name;
  document.getElementById('p-email-display').textContent = user.email;
  document.getElementById('name').value = user.name;
  document.getElementById('email').value = user.email;
  document.getElementById('p-created').textContent = Marsh.fmt.dateShort(user.createdAt);
  document.getElementById('p-lastlogin').textContent = Marsh.fmt.date(user.lastLogin);
  document.getElementById('p-role').textContent = user.role;

  // Save profile (name)
  document.getElementById('save-profile').addEventListener('click', async () => {
    const btn = document.getElementById('save-profile');
    const name = document.getElementById('name').value.trim();
    if (!name) return Marsh.toast('Name cannot be empty.', 'error');

    btn.disabled = true;
    try {
      const data = await Marsh.api.put('/api/user/update', { name });
      Marsh.toast('Profile updated.', 'success');
      document.getElementById('p-name-display').textContent = data.user.name;
    } catch (err) {
      Marsh.toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Change password
  document.getElementById('save-password').addEventListener('click', async () => {
    const btn = document.getElementById('save-password');
    const pw = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;

    if (pw.length < 8) return Marsh.toast('Password must be at least 8 characters.', 'error');
    if (pw !== confirm) return Marsh.toast('Passwords do not match.', 'error');

    btn.disabled = true;
    try {
      await Marsh.api.put('/api/user/update', { password: pw });
      Marsh.toast('Password updated.', 'success');
      document.getElementById('new-password').value = '';
      document.getElementById('confirm-password').value = '';
    } catch (err) {
      Marsh.toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('logout-btn')?.addEventListener('click', () => Marsh.auth.logout());
})();
