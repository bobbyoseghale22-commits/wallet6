(async function initProfile() {
  const user = await Marsh.requireAuth();
  if (!user) return;

  if (user.role === 'admin') {
    document.getElementById('admin-link')?.classList.remove('hidden');
  }

  // Hydrate read-only fields
  document.getElementById('avatar-host').innerHTML = Marsh.avatarHTML(user);
  document.getElementById('p-name-display').textContent = user.name;
  document.getElementById('p-email-display').textContent = user.email;
  document.getElementById('name').value = user.name;
  document.getElementById('email').value = user.email;
  document.getElementById('country').value = user.country || '—';
  document.getElementById('phone').value = user.phone || '—';
  document.getElementById('p-country').textContent = user.country || '—';
  document.getElementById('p-created').textContent = Marsh.fmt.dateShort(user.createdAt);
  document.getElementById('p-lastlogin').textContent = Marsh.fmt.date(user.lastLogin);
  document.getElementById('p-role').textContent = user.role;

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

  /* ======================================================================
     KYC
     ====================================================================== */
  const DOC_TYPES = ['proofOfId', 'proofOfAddress', 'proofOfFunds'];

  const KYC_LABELS = {
    not_submitted: ['', ''],
    pending: ['⏳ Under Review', 'warning'],
    approved: ['✅ Verified', 'success'],
    rejected: ['❌ Rejected', 'danger'],
    resubmit_requested: ['🔄 Resubmission Required', 'warning'],
  };

  function renderKycStatus(kyc) {
    const status = kyc?.status || 'not_submitted';
    const [label, cls] = KYC_LABELS[status] || ['', ''];

    // Overall badge
    const badgeEl = document.getElementById('kyc-status-badge');
    badgeEl.innerHTML = label ? `<span class="badge ${cls}" style="font-size:0.9rem;padding:7px 14px">${label}</span>` : '';

    // Admin note
    const noteBox = document.getElementById('kyc-admin-note');
    const noteText = document.getElementById('kyc-admin-note-text');
    if (kyc?.adminNote && ['rejected', 'resubmit_requested'].includes(status)) {
      noteText.textContent = kyc.adminNote;
      noteBox.classList.remove('hidden');
      noteBox.style.borderColor = status === 'rejected' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)';
      noteBox.style.background = status === 'rejected' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)';
    } else {
      noteBox.classList.add('hidden');
    }

    // Per-document cards
    const isLocked = status === 'approved';
    const isResubmit = status === 'resubmit_requested';

    DOC_TYPES.forEach((docType) => {
      const doc = kyc?.[docType] || {};
      const card = document.getElementById(`doc-${docType}`);
      const statusEl = document.getElementById(`status-${docType}`);
      const filenameEl = document.getElementById(`filename-${docType}`);
      const labelEl = document.getElementById(`label-${docType}`);
      const fileInput = document.getElementById(`file-${docType}`);

      card.className = 'kyc-doc-card glass';

      if (doc.uploadedAt) {
        if (status === 'approved') {
          statusEl.innerHTML = '<span style="color:var(--success)">✓ Uploaded &amp; verified</span>';
          card.classList.add('approved');
        } else if (status === 'rejected') {
          statusEl.innerHTML = '<span style="color:var(--danger)">✗ Rejected — reupload required</span>';
          card.classList.add('rejected');
        } else {
          statusEl.innerHTML = '<span style="color:var(--cyan)">✓ Uploaded</span>';
          card.classList.add('uploaded');
        }
        filenameEl.textContent = doc.filename || '';
      } else {
        statusEl.innerHTML = '<span class="muted">Not uploaded</span>';
        filenameEl.textContent = '';
      }

      // Disable upload for approved kyc; allow reupload otherwise
      if (isLocked) {
        labelEl.classList.add('hidden');
        fileInput.disabled = true;
      } else {
        labelEl.classList.remove('hidden');
        labelEl.textContent = doc.uploadedAt ? 'Replace File' : 'Choose File';
        // Re-add hidden file input inside label
        labelEl.appendChild(fileInput);
        fileInput.disabled = false;
      }
    });
  }

  async function loadKyc() {
    try {
      const data = await Marsh.api.get('/api/user/kyc');
      renderKycStatus(data.kyc);
    } catch (err) {
      Marsh.toast('Could not load KYC status.', 'error');
    }
  }

  // File upload handler
  DOC_TYPES.forEach((docType) => {
    document.getElementById(`file-${docType}`).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        return Marsh.toast('File must be under 5 MB.', 'error');
      }

      const labelEl = document.getElementById(`label-${docType}`);
      const origText = labelEl.childNodes[0]?.textContent || 'Choose File';
      // Show spinner in label text node
      if (labelEl.childNodes[0]) labelEl.childNodes[0].textContent = 'Uploading…';

      try {
        const base64 = await fileToBase64(file);
        await Marsh.api.post('/api/user/kyc/upload', {
          docType,
          filename: file.name,
          mimeType: file.type,
          data: base64,
        });
        Marsh.toast('Document uploaded.', 'success');
        await loadKyc();
      } catch (err) {
        Marsh.toast(err.message, 'error');
        if (labelEl.childNodes[0]) labelEl.childNodes[0].textContent = origText;
      }

      e.target.value = ''; // reset input
    });
  });

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Strip data URL prefix — we only want the raw base64
        const result = reader.result;
        resolve(result.split(',')[1]);
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  }

  await loadKyc();

  document.getElementById('logout-btn')?.addEventListener('click', () => Marsh.auth.logout());
})();
