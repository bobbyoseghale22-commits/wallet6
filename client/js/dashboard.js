/* ============================================================================
   Dashboard page logic
   ========================================================================== */

(async function initDashboard() {
  const user = await Marsh.requireAuth();
  if (!user) return;

  // Demo holdings derived from the stored USD balance
  const PRICES = { btc: 64000, eth: 3100, usdt: 1 };
  const SPLIT = { btc: 0.45, eth: 0.35, usdt: 0.2 };
  const CHANGE = { btc: +2.4, eth: -1.1, usdt: +0.0 };

  function render() {
    // Greeting + profile
    document.getElementById('greeting').textContent = `Welcome back, ${user.name.split(' ')[0]}`;
    document.getElementById('avatar-host').innerHTML = Marsh.avatarHTML(user);
    document.getElementById('u-name').textContent = user.name;
    document.getElementById('u-email').textContent = user.email;
    document.getElementById('u-created').textContent = Marsh.fmt.dateShort(user.createdAt);
    document.getElementById('u-lastlogin').textContent = Marsh.fmt.date(user.lastLogin);

    if (user.role === 'admin') {
      document.getElementById('admin-link').classList.remove('hidden');
    }

    // Balance
    document.getElementById('total-balance').textContent = Marsh.fmt.usd(user.balance);

    // Wallet cards
    Object.keys(PRICES).forEach((coin) => {
      const fiat = user.balance * SPLIT[coin];
      const amount = fiat / PRICES[coin];
      const amtEl = document.getElementById(`${coin}-amt`);
      const fiatEl = document.getElementById(`${coin}-fiat`);
      const chgEl = document.getElementById(`${coin}-change`);
      if (amtEl) {
        const decimals = coin === 'usdt' ? 2 : coin === 'eth' ? 4 : 6;
        amtEl.textContent = `${amount.toFixed(decimals)} ${coin.toUpperCase()}`;
      }
      if (fiatEl) fiatEl.textContent = Marsh.fmt.usd(fiat);
      if (chgEl) {
        const c = CHANGE[coin];
        chgEl.textContent = `${c >= 0 ? '▲' : '▼'} ${Math.abs(c).toFixed(1)}% (24h)`;
        chgEl.className = `change ${c >= 0 ? 'up' : 'down'}`;
      }
    });
  }

  render();

  document.getElementById('logout-btn')?.addEventListener('click', () => Marsh.auth.logout());
})();
