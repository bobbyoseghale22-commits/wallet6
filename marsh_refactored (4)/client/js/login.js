/* ============================================================================
   Login page logic
   ========================================================================== */

(async function initLogin() {
  // If already authenticated, skip to dashboard
  try {
    await Marsh.auth.me();
    window.location.href = '/dashboard';
    return;
  } catch (_) { /* not logged in */ }

  // Email/password login
  document.getElementById('email-login').addEventListener('click', async () => {
    const btn = document.getElementById('email-login');
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      return Marsh.toast('Enter email and password.', 'error');
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      await Marsh.auth.login(email, password);
      Marsh.toast('Signed in.', 'success');
      const redirect = new URLSearchParams(location.search).get('redirect');
      setTimeout(() => (window.location.href = redirect || '/dashboard'), 500);
    } catch (err) {
      Marsh.toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  // Enter key submits
  document.getElementById('password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('email-login').click();
  });
})();
