/* ============================================================================
   Registration page logic
   ========================================================================== */

(async function initRegister() {
  // If already authenticated, skip to dashboard
  try {
    await Marsh.auth.me();
    window.location.href = '/dashboard';
    return;
  } catch (_) { /* not logged in */ }

  const submit = async () => {
    const btn = document.getElementById('register-btn');
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!name || !email || !password || !confirmPassword) {
      return Marsh.toast('Please fill in all fields.', 'error');
    }
    if (password.length < 8) {
      return Marsh.toast('Password must be at least 8 characters.', 'error');
    }
    if (password !== confirmPassword) {
      return Marsh.toast('Passwords do not match.', 'error');
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      await Marsh.auth.register(name, email, password);
      Marsh.toast('Account created.', 'success');
      setTimeout(() => (window.location.href = '/dashboard'), 500);
    } catch (err) {
      Marsh.toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  };

  document.getElementById('register-btn').addEventListener('click', submit);

  document.getElementById('confirm-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('register-btn').click();
  });
})();
