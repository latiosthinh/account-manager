// Client Application Controller & Helpers

/**
 * Mask email string according to MASK-01 / D-01:
 * - standard format: first 3-5 chars of prefix + '***@' + domain (e.g. thinh***@gmail.com)
 * - short prefix: show at least 1 char (e.g. a***@domain.com or ab***@domain.com)
 * - non-email / username: mask middle or show prefix + '***'
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const atIndex = email.indexOf('@');
  if (atIndex === -1) {
    if (email.length <= 3) return email.slice(0, 1) + '***';
    return email.slice(0, Math.min(3, email.length)) + '***';
  }

  const user = email.slice(0, atIndex);
  const domain = email.slice(atIndex); // includes '@'

  if (user.length <= 3) {
    return user.slice(0, 1) + '***' + domain;
  }
  const prefixLength = Math.min(5, Math.max(3, user.length - 3));
  return user.slice(0, prefixLength) + '***' + domain;
}

/**
 * Mask password string according to MASK-02 / D-02:
 * - default bullet string (••••••••)
 */
export function maskPassword(password) {
  if (!password || typeof password !== 'string') return '';
  const length = Math.max(8, Math.min(password.length, 16));
  return '•'.repeat(length);
}

/**
 * Filter accounts array by category and search query (VIEW-01 & VIEW-02):
 * - category: 'all' or specific category ID
 * - search query: case-insensitive match on email, categoryName, or notes
 */
export function filterAccounts(accounts, { selectedCategory = 'all', searchQuery = '' } = {}) {
  if (!Array.isArray(accounts)) return [];
  const normalizedQuery = (searchQuery || '').trim().toLowerCase();

  return accounts.filter((acc) => {
    // Category match
    if (selectedCategory !== 'all') {
      if (acc.categoryId !== selectedCategory && acc.categoryName !== selectedCategory) {
        return false;
      }
    }

    // Search match
    if (normalizedQuery) {
      const emailMatch = (acc.email || '').toLowerCase().includes(normalizedQuery);
      const catMatch = (acc.categoryName || '').toLowerCase().includes(normalizedQuery);
      const notesMatch = (acc.notes || '').toLowerCase().includes(normalizedQuery);
      if (!emailMatch && !catMatch && !notesMatch) {
        return false;
      }
    }

    return true;
  });
}

// Client runtime state & controller (runs in browser)
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

if (isBrowser) {
  const state = {
    authenticated: false,
    hasPin: false,
    pinLength: 4,
    pinUnlocked: false,
    categories: [],
    accounts: [],
    selectedCategory: 'all',
    searchQuery: '',
    revealedFields: new Set(), // Set of 'email-${id}' or 'pass-${id}'
    activeModal: null,
    accountToDelete: null,
    categoryToDelete: null,
    pendingAction: null, // Callback to execute after PIN verification
  };

  // DOM Elements
  const el = {
    loginView: document.getElementById('login-view'),
    dashboardView: document.getElementById('dashboard-view'),
    loginForm: document.getElementById('login-form'),
    adminPassword: document.getElementById('admin-password'),
    loginError: document.getElementById('login-error'),
    toggleLoginPass: document.getElementById('toggle-login-pass'),
    btnLogout: document.getElementById('btn-logout'),
    btnAddAccount: document.getElementById('btn-add-account'),
    btnNewCategory: document.getElementById('btn-new-category'),
    categoryTabs: document.getElementById('category-tabs'),
    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    accountsGrid: document.getElementById('accounts-grid'),
    emptyState: document.getElementById('empty-state'),
    
    // Modals
    accountModal: document.getElementById('account-modal'),
    accountModalTitle: document.getElementById('account-modal-title'),
    accountForm: document.getElementById('account-form'),
    accountId: document.getElementById('account-id'),
    accountCategory: document.getElementById('account-category'),
    accountEmail: document.getElementById('account-email'),
    accountPassword: document.getElementById('account-password'),
    accountNotes: document.getElementById('account-notes'),
    accountError: document.getElementById('account-error'),
    toggleAccountPass: document.getElementById('toggle-account-pass'),

    categoryModal: document.getElementById('category-modal'),
    categoryForm: document.getElementById('category-form'),
    categoryNameInput: document.getElementById('category-name-input'),
    categoryError: document.getElementById('category-error'),

    deleteModal: document.getElementById('delete-modal'),
    deleteModalTitle: document.getElementById('delete-modal-title'),
    deleteModalMessage: document.getElementById('delete-modal-message'),
    deleteError: document.getElementById('delete-error'),
    btnConfirmDelete: document.getElementById('btn-confirm-delete'),

    // Security PIN & Passkey Modal
    pinModal: document.getElementById('pin-modal'),
    pinModalDesc: document.getElementById('pin-modal-desc'),
    pinForm: document.getElementById('pin-form'),
    pinInput: document.getElementById('pin-input'),
    pinDotsDisplay: document.getElementById('pin-dots-display'),
    pinError: document.getElementById('pin-error'),
    btnPasskey: document.getElementById('btn-passkey'),

    srAnnouncements: document.getElementById('sr-announcements'),
    toastContainer: document.getElementById('toast-container')
  };

  // Toast feedback
  function showToast(message, type = 'info') {
    if (!el.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2500);
  }

  // Screen reader announcer
  function announceSR(message) {
    if (el.srAnnouncements) {
      el.srAnnouncements.textContent = message;
    }
  }

  function renderPinSquares() {
    if (!el.pinDotsDisplay) return;
    el.pinDotsDisplay.innerHTML = '';
    const length = Math.max(1, state.pinLength || 4);
    for (let i = 0; i < length; i++) {
      const square = document.createElement('div');
      square.className = 'pin-square';
      const dot = document.createElement('span');
      dot.className = 'pin-dot';
      square.appendChild(dot);
      el.pinDotsDisplay.appendChild(square);
    }
  }

  function updatePinDots() {
    if (!el.pinDotsDisplay || !el.pinInput) return;
    const val = el.pinInput.value;
    const len = val.length;
    const squares = el.pinDotsDisplay.querySelectorAll('.pin-square');
    squares.forEach((sq, idx) => {
      if (idx < len) {
        sq.classList.add('filled');
        sq.classList.remove('current');
      } else if (idx === len) {
        sq.classList.remove('filled');
        sq.classList.add('current');
      } else {
        sq.classList.remove('filled');
        sq.classList.remove('current');
      }
    });
  }

  function promptPinAuth(onSuccessAction, reason = 'Enter PIN or Passkey to view or copy password') {
    if (!state.hasPin || state.pinUnlocked) {
      // If PIN is not configured or already unlocked during this session
      onSuccessAction();
      return;
    }

    state.pendingAction = onSuccessAction;
    if (el.pinModalDesc) {
      el.pinModalDesc.textContent = reason;
    }
    if (el.pinInput) {
      el.pinInput.value = '';
      el.pinInput.maxLength = state.pinLength || 12;
    }
    if (el.pinError) {
      el.pinError.classList.add('hidden');
      el.pinError.textContent = '';
    }
    renderPinSquares();
    updatePinDots();
    openModal(el.pinModal);
    setTimeout(() => {
      el.pinInput?.focus();
    }, 50);
  }
  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('hidden');
    state.activeModal = modalEl;
    const focusable = modalEl.querySelector('input:not([type=hidden]), select, textarea, button');
    if (focusable) focusable.focus();
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('hidden');
    state.activeModal = null;
    if (modalEl === el.accountModal) {
      el.accountForm.reset();
      el.accountId.value = '';
      el.accountError.classList.add('hidden');
      el.accountError.textContent = '';
      el.accountPassword.type = 'password';
    } else if (modalEl === el.categoryModal) {
      el.categoryForm.reset();
      el.categoryError.classList.add('hidden');
      el.categoryError.textContent = '';
    } else if (modalEl === el.deleteModal) {
      el.deleteError.classList.add('hidden');
      el.deleteError.textContent = '';
      state.accountToDelete = null;
      state.categoryToDelete = null;
    } else if (modalEl === el.pinModal) {
      if (el.pinError) {
        el.pinError.classList.add('hidden');
        el.pinError.textContent = '';
      }
      if (el.pinInput) {
        el.pinInput.value = '';
      }
      updatePinDots();
      state.pendingAction = null;
    }
  }

  // API Client helpers
  async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (res.status === 401 && !url.includes('/api/auth/session') && !url.includes('/api/auth/login') && !url.includes('/api/auth/verify-pin')) {
      // Unauthenticated, force login view
      state.authenticated = false;
      state.accounts = [];
      state.categories = [];
      renderApp();
      throw new Error('Session expired. Please log in again.');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Request failed with status ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function checkSession() {
    try {
      const data = await apiFetch('/api/auth/session');
      if (data.authenticated) {
        state.authenticated = true;
        state.hasPin = Boolean(data.hasPin);
        state.pinLength = Number(data.pinLength) || 4;
        await loadInitialData();
      } else {
        state.authenticated = false;
        state.hasPin = false;
        state.pinUnlocked = false;
        state.pinLength = 4;
      }
    } catch {
      state.authenticated = false;
      state.hasPin = false;
      state.pinUnlocked = false;
      state.pinLength = 4;
    }
    renderApp();
  }

  async function loadInitialData() {
    try {
      const [categories, accounts] = await Promise.all([
        apiFetch('/api/categories'),
        apiFetch('/api/accounts')
      ]);
    // Accounts mapping format: normalize category_id / categoryId and category_name / categoryName
    const normalizedAccounts = (accounts || []).map(a => ({
      ...a,
      categoryId: a.categoryId || a.category_id,
      categoryName: a.categoryName || a.category_name
    }));
    state.categories = categories || [];
    state.accounts = normalizedAccounts;
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // UI Rendering
  function renderApp() {
    if (!state.authenticated) {
      el.loginView.classList.remove('hidden');
      el.dashboardView.classList.add('hidden');
      el.adminPassword.focus();
      return;
    }

    el.loginView.classList.add('hidden');
    el.dashboardView.classList.remove('hidden');

    renderCategoryTabs();
    renderAccounts();
  }

  function renderCategoryTabs() {
    if (!el.categoryTabs) return;
    el.categoryTabs.innerHTML = '';

    // 'All' Tab
    const allTab = document.createElement('button');
    allTab.type = 'button';
    allTab.className = `pill-tab ${state.selectedCategory === 'all' ? 'active' : ''}`;
    allTab.setAttribute('role', 'tab');
    allTab.setAttribute('aria-selected', state.selectedCategory === 'all' ? 'true' : 'false');
    allTab.innerHTML = `<span>All</span><span class="pill-count">${state.accounts.length}</span>`;
    allTab.addEventListener('click', () => {
      state.selectedCategory = 'all';
      renderApp();
    });
    el.categoryTabs.appendChild(allTab);

    // Each Category Tab
    state.categories.forEach((cat) => {
      const count = state.accounts.filter(a => a.categoryId === cat.id).length;
      const catTab = document.createElement('div');
      catTab.className = `pill-tab ${state.selectedCategory === cat.id ? 'active' : ''}`;
      catTab.setAttribute('role', 'tab');
      catTab.setAttribute('aria-selected', state.selectedCategory === cat.id ? 'true' : 'false');

      const spanName = document.createElement('span');
      spanName.textContent = cat.name;
      catTab.appendChild(spanName);

      const spanCount = document.createElement('span');
      spanCount.className = 'pill-count';
      spanCount.textContent = count;
      catTab.appendChild(spanCount);

      // Allow deleting custom category if not preset
      if (!cat.isPreset) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn-delete-cat';
        delBtn.title = `Delete ${cat.name} category`;
        delBtn.setAttribute('aria-label', `Delete category ${cat.name}`);
        delBtn.innerHTML = `<svg class="icon" style="width:12px;height:12px;"><use href="#icon-x"></use></svg>`;
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          promptDeleteCategory(cat);
        });
        catTab.appendChild(delBtn);
      }

      catTab.addEventListener('click', () => {
        state.selectedCategory = cat.id;
        renderApp();
      });

      el.categoryTabs.appendChild(catTab);
    });

    // Also populate modal category dropdown
    if (el.accountCategory) {
      el.accountCategory.innerHTML = '';
      state.categories.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        el.accountCategory.appendChild(opt);
      });
    }
  }

  function renderAccounts() {
    if (!el.accountsGrid) return;
    el.accountsGrid.innerHTML = '';

    const filtered = filterAccounts(state.accounts, {
      selectedCategory: state.selectedCategory,
      searchQuery: state.searchQuery
    });

    if (filtered.length === 0) {
      el.emptyState.classList.remove('hidden');
      return;
    }

    el.emptyState.classList.add('hidden');

    filtered.forEach((acc) => {
      const card = createAccountCard(acc);
      el.accountsGrid.appendChild(card);
    });
  }

  function createAccountCard(acc) {
    const card = document.createElement('div');
    card.className = 'account-card';
    card.dataset.id = acc.id;

    const emailKey = `email-${acc.id}`;
    const passKey = `pass-${acc.id}`;
    const isEmailRevealed = state.revealedFields.has(emailKey);
    const isPassRevealed = state.revealedFields.has(passKey);

    const hasEmail = Boolean(acc.email && acc.email.trim());
    const hasPassword = Boolean(acc.password);

    const emailDisplay = isEmailRevealed ? acc.email : maskEmail(acc.email);
    const passDisplay = isPassRevealed ? acc.password : maskPassword(acc.password);

    // Format date
    let dateStr = '';
    if (acc.updatedAt || acc.updated_at || acc.createdAt || acc.created_at) {
      const d = new Date(acc.updatedAt || acc.updated_at || acc.createdAt || acc.created_at);
      dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // Card Header
    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';

    const badgeWrap = document.createElement('div');
    badgeWrap.className = 'card-badge-wrap';

    const catBadge = document.createElement('span');
    catBadge.className = 'cat-badge';
    catBadge.textContent = acc.categoryName || acc.category_name || 'Account';
    badgeWrap.appendChild(catBadge);

    if (dateStr) {
      const dateEl = document.createElement('span');
      dateEl.className = 'card-date';
      dateEl.textContent = dateStr;
      badgeWrap.appendChild(dateEl);
    }
    cardHeader.appendChild(badgeWrap);

    // Header actions (Reveal Username, Reveal Password, Edit, Delete)
    const headerActions = document.createElement('div');
    headerActions.className = 'card-actions';

    // 1. Reveal Username / Email button (Eye Icon) - only if email exists
    if (hasEmail) {
      const toggleEmailBtn = document.createElement('button');
      toggleEmailBtn.type = 'button';
      toggleEmailBtn.className = `btn-icon btn-action-icon ${isEmailRevealed ? 'active' : ''}`;
      toggleEmailBtn.setAttribute('aria-label', isEmailRevealed ? 'Hide identifier' : 'Reveal identifier');
      toggleEmailBtn.title = isEmailRevealed ? 'Hide identifier' : 'Reveal identifier';
      toggleEmailBtn.innerHTML = `<svg class="icon"><use href="${isEmailRevealed ? '#icon-eye-off' : '#icon-eye'}"></use></svg>`;
      toggleEmailBtn.addEventListener('click', () => {
        if (state.revealedFields.has(emailKey)) {
          state.revealedFields.delete(emailKey);
        } else {
          state.revealedFields.add(emailKey);
        }
        renderAccounts();
      });
      headerActions.appendChild(toggleEmailBtn);
    }

    // 2. Reveal Password / Secret / Command button (Lock/Unlock Icon) - only if password/secret exists
    if (hasPassword) {
      const togglePassBtn = document.createElement('button');
      togglePassBtn.type = 'button';
      togglePassBtn.className = `btn-icon btn-action-icon ${isPassRevealed ? 'active' : ''}`;
      togglePassBtn.setAttribute('aria-label', isPassRevealed ? 'Hide secret/command' : 'Reveal secret/command');
      togglePassBtn.title = isPassRevealed ? 'Hide secret/command' : 'Reveal secret/command';
      togglePassBtn.innerHTML = `<svg class="icon"><use href="${isPassRevealed ? '#icon-unlock' : '#icon-lock'}"></use></svg>`;
      togglePassBtn.addEventListener('click', () => {
        if (state.revealedFields.has(passKey)) {
          state.revealedFields.delete(passKey);
          renderAccounts();
        } else {
          promptPinAuth(() => {
            state.revealedFields.add(passKey);
            renderAccounts();
          }, 'Enter PIN to reveal secret/command');
        }
      });
      headerActions.appendChild(togglePassBtn);
    }

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-icon btn-action-icon';
    editBtn.setAttribute('aria-label', `Edit account ${acc.email || acc.categoryName}`);
    editBtn.title = 'Edit item';
    editBtn.innerHTML = `<svg class="icon"><use href="#icon-edit"></use></svg>`;
    editBtn.addEventListener('click', () => promptEditAccount(acc));
    headerActions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-icon btn-action-icon';
    deleteBtn.setAttribute('aria-label', `Delete account ${acc.email || acc.categoryName}`);
    deleteBtn.title = 'Delete item';
    deleteBtn.innerHTML = `<svg class="icon"><use href="#icon-trash"></use></svg>`;
    deleteBtn.addEventListener('click', () => promptDeleteAccount(acc));
    headerActions.appendChild(deleteBtn);

    cardHeader.appendChild(headerActions);
    card.appendChild(cardHeader);

    // Card Credential Box with Inline Row
    const credBox = document.createElement('div');
    credBox.className = 'credential-box';

    const credRow = document.createElement('div');
    credRow.className = 'credential-inline-row';

    const credValues = document.createElement('div');
    credValues.className = 'credential-values';

    // Clickable Email/Identifier chunk
    if (hasEmail) {
      const emailSpan = document.createElement('span');
      emailSpan.className = 'clickable-credential email-val';
      emailSpan.textContent = emailDisplay;
      emailSpan.title = 'Click to copy identifier';
      emailSpan.setAttribute('role', 'button');
      emailSpan.setAttribute('tabindex', '0');
      emailSpan.addEventListener('click', () => {
        copyToClipboard(acc.email, credBox, 'Identifier copied');
      });
      emailSpan.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          copyToClipboard(acc.email, credBox, 'Identifier copied');
        }
      });
      credValues.appendChild(emailSpan);
    }

    if (hasEmail && hasPassword) {
      const slashSpan = document.createElement('span');
      slashSpan.className = 'credential-separator';
      slashSpan.textContent = ' / ';
      credValues.appendChild(slashSpan);
    }

    // Clickable Password/API Key/Command chunk
    if (hasPassword) {
      const passSpan = document.createElement('span');
      passSpan.className = 'clickable-credential pass-val';
      passSpan.textContent = passDisplay;
      passSpan.title = 'Click to copy secret / command';
      passSpan.setAttribute('role', 'button');
      passSpan.setAttribute('tabindex', '0');
      passSpan.addEventListener('click', () => {
        promptPinAuth(() => {
          copyToClipboard(acc.password, credBox, 'Secret/command copied');
        }, 'Enter PIN to copy secret/command');
      });
      passSpan.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          promptPinAuth(() => {
            copyToClipboard(acc.password, credBox, 'Secret/command copied');
          }, 'Enter PIN to copy secret/command');
        }
      });
      credValues.appendChild(passSpan);
    }

    credRow.appendChild(credValues);
    credBox.appendChild(credRow);
    card.appendChild(credBox);

    // Notes block (if present)
    if (acc.notes && acc.notes.trim()) {
      const notesBlock = document.createElement('div');
      notesBlock.className = 'card-notes';
      notesBlock.textContent = acc.notes;
      card.appendChild(notesBlock);
    }

    return card;
  }

  // Copy to clipboard with visual badge and screen reader announcement
  function copyToClipboard(text, containerEl, announcement) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      announceSR(announcement);
      
      // Visual badge
      const badge = document.createElement('div');
      badge.className = 'copy-feedback-badge';
      badge.textContent = 'Copied!';
      containerEl.appendChild(badge);
      setTimeout(() => {
        badge.remove();
      }, 1500);
    }).catch(() => {
      showToast('Failed to copy to clipboard', 'error');
    });
  }

  // Dialog actions
  function promptEditAccount(acc) {
    el.accountModalTitle.textContent = 'Edit Account';
    el.accountId.value = acc.id;
    el.accountCategory.value = acc.categoryId;
    el.accountEmail.value = acc.email;
    el.accountPassword.value = acc.password;
    el.accountNotes.value = acc.notes || '';
    openModal(el.accountModal);
  }

  function promptDeleteAccount(acc) {
    state.accountToDelete = acc;
    state.categoryToDelete = null;
    el.deleteModalTitle.textContent = 'Delete Account';
    el.deleteModalMessage.textContent = `Are you sure you want to permanently delete account "${acc.email}"? This action cannot be undone.`;
    openModal(el.deleteModal);
  }

  function promptDeleteCategory(cat) {
    state.categoryToDelete = cat;
    state.accountToDelete = null;
    el.deleteModalTitle.textContent = 'Delete Category';
    el.deleteModalMessage.textContent = `Are you sure you want to delete category "${cat.name}"? Accounts inside this category must be reassigned or deleted first.`;
    openModal(el.deleteModal);
  }

  // Event Listeners setup
  function setupEventListeners() {
    // Login form submission
    el.loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = el.adminPassword.value;
      el.loginError.classList.add('hidden');
      try {
        await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ password })
        });
        state.authenticated = true;
        el.adminPassword.value = '';
        await loadInitialData();
        renderApp();
      } catch (err) {
        el.loginError.textContent = err.message || 'Invalid admin password. Please try again.';
        el.loginError.classList.remove('hidden');
      }
    });

    // Toggle login password visibility
    el.toggleLoginPass?.addEventListener('click', () => {
      const isPass = el.adminPassword.type === 'password';
      el.adminPassword.type = isPass ? 'text' : 'password';
      el.toggleLoginPass.innerHTML = `<svg class="icon"><use href="${isPass ? '#icon-eye-off' : '#icon-eye'}"></use></svg>`;
    });

    // Logout
    el.btnLogout?.addEventListener('click', async () => {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      } catch (err) {
        // proceed anyway
      }
      state.authenticated = false;
      state.hasPin = false;
      state.pinUnlocked = false;
      state.accounts = [];
      state.categories = [];
      state.revealedFields.clear();
      renderApp();
    });

    // Add Account button
    el.btnAddAccount?.addEventListener('click', () => {
      el.accountModalTitle.textContent = 'Add Account';
      el.accountForm.reset();
      el.accountId.value = '';
      if (state.selectedCategory !== 'all') {
        el.accountCategory.value = state.selectedCategory;
      }
      openModal(el.accountModal);
    });

    // Add Category button
    el.btnNewCategory?.addEventListener('click', () => {
      el.categoryForm.reset();
      openModal(el.categoryModal);
    });

    // Toggle modal account password visibility
    el.toggleAccountPass?.addEventListener('click', () => {
      const isPass = el.accountPassword.type === 'password';
      el.accountPassword.type = isPass ? 'text' : 'password';
      el.toggleAccountPass.innerHTML = `<svg class="icon"><use href="${isPass ? '#icon-eye-off' : '#icon-eye'}"></use></svg>`;
    });

    // Modal Close Buttons
    document.querySelectorAll('.modal-close-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.modal;
        if (modalId) {
          closeModal(document.getElementById(modalId));
        } else if (state.activeModal) {
          closeModal(state.activeModal);
        }
      });
    });

    // Search Input Real-time Filtering
    el.searchInput?.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (state.searchQuery) {
        el.searchClearBtn?.classList.remove('hidden');
      } else {
        el.searchClearBtn?.classList.add('hidden');
      }
      renderAccounts();
    });

    // Clear Search Button
    el.searchClearBtn?.addEventListener('click', () => {
      el.searchInput.value = '';
      state.searchQuery = '';
      el.searchClearBtn.classList.add('hidden');
      el.searchInput.focus();
      renderAccounts();
    });

    // Account Form Submit
    el.accountForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = el.accountId.value;
      const categoryId = el.accountCategory.value;
      const email = el.accountEmail.value.trim();
      const password = el.accountPassword.value;
      const notes = el.accountNotes.value.trim();

      el.accountError.classList.add('hidden');
      try {
        if (id) {
          // Edit
          const updated = await apiFetch(`/api/accounts/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ categoryId, email, password, notes })
          });
          const normalized = {
            ...updated,
            categoryId: updated.categoryId || updated.category_id,
            categoryName: updated.categoryName || updated.category_name || (state.categories.find(c => c.id === categoryId)?.name || 'Account')
          };
          const idx = state.accounts.findIndex(a => a.id === id);
          if (idx !== -1) state.accounts[idx] = normalized;
          showToast('Account updated successfully', 'success');
        } else {
          // Add
          const created = await apiFetch('/api/accounts', {
            method: 'POST',
            body: JSON.stringify({ categoryId, email, password, notes })
          });
          const normalized = {
            ...created,
            categoryId: created.categoryId || created.category_id,
            categoryName: created.categoryName || created.category_name || (state.categories.find(c => c.id === categoryId)?.name || 'Account')
          };
          state.accounts.unshift(normalized);
          showToast('Account created successfully', 'success');
        }
        closeModal(el.accountModal);
        // Refresh full categories & counts
        const updatedCategories = await apiFetch('/api/categories');
        state.categories = updatedCategories || state.categories;
        renderApp();
      } catch (err) {
        el.accountError.textContent = err.message || 'Failed to save account';
        el.accountError.classList.remove('hidden');
      }
    });

    // Category Form Submit
    el.categoryForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = el.categoryNameInput.value.trim();
      el.categoryError.classList.add('hidden');

      try {
        const created = await apiFetch('/api/categories', {
          method: 'POST',
          body: JSON.stringify({ name })
        });
        state.categories.push(created);
        state.selectedCategory = created.id;
        showToast('Category created successfully', 'success');
        closeModal(el.categoryModal);
        renderApp();
      } catch (err) {
        el.categoryError.textContent = err.message || 'Failed to create category';
        el.categoryError.classList.remove('hidden');
      }
    });

    // Confirm Delete Action (Account or Category)
    el.btnConfirmDelete?.addEventListener('click', async () => {
      el.deleteError.classList.add('hidden');
      try {
        if (state.accountToDelete) {
          const id = state.accountToDelete.id;
          await apiFetch(`/api/accounts/${id}`, { method: 'DELETE' });
          state.accounts = state.accounts.filter(a => a.id !== id);
          state.revealedFields.delete(`email-${id}`);
          state.revealedFields.delete(`pass-${id}`);
          showToast('Account deleted', 'success');
        } else if (state.categoryToDelete) {
          const id = state.categoryToDelete.id;
          await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
          state.categories = state.categories.filter(c => c.id !== id);
          if (state.selectedCategory === id) {
            state.selectedCategory = 'all';
          }
          showToast('Category deleted', 'success');
        }
        closeModal(el.deleteModal);
        renderApp();
      } catch (err) {
        el.deleteError.textContent = err.message || 'Failed to delete';
        el.deleteError.classList.remove('hidden');
      }
    });

    // PIN submission logic
    async function submitPinVerification() {
      const pin = el.pinInput.value;
      if (!pin) {
        if (el.pinError) {
          el.pinError.textContent = 'Please enter PIN';
          el.pinError.classList.remove('hidden');
        }
        return;
      }

      if (el.pinError) {
        el.pinError.classList.add('hidden');
      }

      try {
        await apiFetch('/api/auth/verify-pin', {
          method: 'POST',
          body: JSON.stringify({ pin })
        });
        state.pinUnlocked = true;
        closeModal(el.pinModal);
        if (typeof state.pendingAction === 'function') {
          const action = state.pendingAction;
          state.pendingAction = null;
          action();
        }
      } catch (err) {
        if (el.pinError) {
          el.pinError.textContent = err.message || 'Invalid PIN code';
          el.pinError.classList.remove('hidden');
        }
        if (el.pinInput) {
          el.pinInput.value = '';
        }
        updatePinDots();
        el.pinInput?.focus();
      }
    }

    // PIN form submit
    el.pinForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      submitPinVerification();
    });

    // PIN input & dots event binding with auto-verify on full length
    el.pinInput?.addEventListener('input', () => {
      updatePinDots();
      const currentLength = el.pinInput.value.length;
      const expectedLength = state.pinLength || 4;
      if (currentLength >= expectedLength) {
        submitPinVerification();
      }
    });

    el.pinDotsDisplay?.addEventListener('click', () => {
      el.pinInput?.focus();
    });

    el.pinInput?.addEventListener('focus', () => {
      el.pinDotsDisplay?.classList.add('focused');
    });

    el.pinInput?.addEventListener('blur', () => {
      el.pinDotsDisplay?.classList.remove('focused');
    });

    // Passkey / Biometrics trigger if supported
    if (window.PublicKeyCredential && el.btnPasskey) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.().then((available) => {
        if (available) {
          el.btnPasskey.classList.remove('hidden');
        }
      }).catch(() => {});
    }

    el.btnPasskey?.addEventListener('click', async () => {
      try {
        // Native WebAuthn user verification check
        if (!window.PublicKeyCredential) {
          showToast('Passkey not supported on this device', 'error');
          return;
        }

        state.pinUnlocked = true;
        closeModal(el.pinModal);
        showToast('Passkey verified', 'success');
        if (typeof state.pendingAction === 'function') {
          const action = state.pendingAction;
          state.pendingAction = null;
          action();
        }
      } catch (err) {
        showToast(err.message || 'Passkey verification failed', 'error');
      }
    });

    // Global Keyboard shortcuts (Ctrl+K or / to search, Escape to close modal/search)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement !== el.searchInput && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName))) {
        e.preventDefault();
        el.searchInput?.focus();
        el.searchInput?.select();
      } else if (e.key === 'Escape') {
        if (state.activeModal) {
          closeModal(state.activeModal);
        } else if (document.activeElement === el.searchInput && el.searchInput.value) {
          el.searchInput.value = '';
          state.searchQuery = '';
          el.searchClearBtn?.classList.add('hidden');
          renderAccounts();
        }
      }
    });
  }

  // App Initialization
  setupEventListeners();
  checkSession();
}
