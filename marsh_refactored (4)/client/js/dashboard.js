/* ============================================================================
   Dashboard page logic
   ========================================================================== */

(async function initDashboard() {
  const user = await Marsh.requireAuth();
  if (!user) return;

  // Coin prices used only to convert each wallet's USD value into a coin amount
  const PRICES = { btc: 64000, eth: 3100, usdt: 1 };
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

    // Wallet cards — each wallet's USD value is set directly by the admin
    const wallets = user.wallets || { btc: 0, eth: 0, usdt: 0 };
    Object.keys(PRICES).forEach((coin) => {
      const fiat = wallets[coin] || 0;
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

  /* ------------------------------ Withdrawals ------------------------------ */
  const modal = document.getElementById('withdraw-modal');
  let selectedMethod = 'bank';

  function openModal() {
    document.getElementById('wd-amount').value = '';
    document.getElementById('wd-bank-name').value = '';
    document.getElementById('wd-account-name').value = '';
    document.getElementById('wd-account-number').value = '';
    document.getElementById('wd-routing-number').value = '';
    document.getElementById('wd-wallet-address').value = '';
    document.getElementById('wd-network').value = '';
    document.getElementById('wd-crypto-asset').value = 'BTC';
    selectMethod('bank');
    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  function selectMethod(method) {
    selectedMethod = method;
    document.querySelectorAll('.method-option').forEach((el) => {
      el.classList.toggle('active', el.dataset.method === method);
    });
    document.querySelectorAll('.withdraw-method-fields').forEach((el) => {
      el.classList.toggle('active', el.dataset.fields === method);
    });
  }

  async function submitWithdrawal() {
    const btn = document.getElementById('submit-withdraw');
    const amount = Number(document.getElementById('wd-amount').value);

    if (!amount || amount <= 0) {
      return Marsh.toast('Enter a valid amount.', 'error');
    }
    if (amount > user.balance) {
      return Marsh.toast('Amount exceeds your available balance.', 'error');
    }

    const payload = { method: selectedMethod, amount };

    if (selectedMethod === 'bank') {
      const bankName = document.getElementById('wd-bank-name').value.trim();
      const accountName = document.getElementById('wd-account-name').value.trim();
      const accountNumber = document.getElementById('wd-account-number').value.trim();
      const routingNumber = document.getElementById('wd-routing-number').value.trim();
      if (!bankName || !accountName || !accountNumber) {
        return Marsh.toast('Please fill in all required bank details.', 'error');
      }
      Object.assign(payload, { bankName, accountName, accountNumber, routingNumber });
    } else {
      const cryptoAsset = document.getElementById('wd-crypto-asset').value;
      const walletAddress = document.getElementById('wd-wallet-address').value.trim();
      const network = document.getElementById('wd-network').value.trim();
      if (!walletAddress) {
        return Marsh.toast('Please enter a destination wallet address.', 'error');
      }
      Object.assign(payload, { cryptoAsset, walletAddress, network });
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      await Marsh.api.post('/api/user/withdrawals', payload);
      Marsh.toast('Withdrawal request submitted — awaiting approval.', 'success');
      closeModal();
      loadWithdrawals();
    } catch (err) {
      Marsh.toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Submit Request';
    }
  }

  function statusBadge(status) {
    if (status === 'approved') return '<span class="badge success">Approved</span>';
    if (status === 'rejected') return '<span class="badge danger">Rejected</span>';
    return '<span class="badge warning">Awaiting approval</span>';
  }

  function describeWithdrawal(w) {
    if (w.method === 'bank') {
      return `Bank transfer · ${w.bankName} ••${w.accountNumber.slice(-4)}`;
    }
    return `Crypto · ${w.cryptoAsset} · ${w.walletAddress.slice(0, 6)}…${w.walletAddress.slice(-4)}`;
  }

  async function loadWithdrawals() {
    const list = document.getElementById('withdrawal-list');
    try {
      const data = await Marsh.api.get('/api/user/withdrawals');
      if (!data.withdrawals.length) {
        list.innerHTML = '<p class="muted center">No withdrawal requests yet.</p>';
        return;
      }
      list.innerHTML = data.withdrawals.map((w) => `
        <div class="withdrawal-item">
          <div class="w-main">
            <div class="w-amount">${Marsh.fmt.usd(w.amount)}</div>
            <div class="w-meta">${describeWithdrawal(w)} · ${Marsh.fmt.date(w.createdAt)}</div>
            ${w.status === 'rejected' && w.rejectionReason ? `<div class="w-reason">Reason: ${w.rejectionReason}</div>` : ''}
          </div>
          ${statusBadge(w.status)}
        </div>
      `).join('');
    } catch (err) {
      list.innerHTML = `<p class="muted center">${err.message}</p>`;
    }
  }

  document.querySelectorAll('.method-option').forEach((el) => {
    el.addEventListener('click', () => selectMethod(el.dataset.method));
  });
  document.getElementById('open-withdraw').addEventListener('click', openModal);
  document.getElementById('cancel-withdraw').addEventListener('click', closeModal);
  document.getElementById('submit-withdraw').addEventListener('click', submitWithdrawal);
  modal.addEventListener('click', (e) => {
    if (e.target.id === 'withdraw-modal') closeModal();
  });

  loadWithdrawals();

  document.getElementById('logout-btn')?.addEventListener('click', () => Marsh.auth.logout());
})();
