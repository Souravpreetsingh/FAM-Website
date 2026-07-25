const FAM = window.FAM || {};
FAM.Auth = (() => {
  'use strict';

  const API_BASE = '/api/v1/auth';
  const STORAGE_KEY = 'fam_auth';

  // ── Token Management ──

  function getTokens() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  }

  function setTokens(accessToken, refreshToken) {
    const data = { accessToken, refreshToken, updatedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function clearTokens() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function getAccessToken() {
    const tokens = getTokens();
    return tokens ? tokens.accessToken : null;
  }

  // ── API Helpers ──

  async function apiRequest(endpoint, options = {}) {
    const { method = 'POST', body, useAuth = true } = options;
    const headers = { 'Content-Type': 'application/json' };

    if (useAuth) {
      const token = getAccessToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      method,
      headers,
    };

    if (body) config.body = JSON.stringify(body);

    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      const err = new Error(data.message || 'Request failed');
      err.status = response.status;
      err.errors = data.errors || [];
      throw err;
    }

    return data;
  }

  // ── Auth API Functions (ready for backend) ──

  async function login(email, password) {
    const data = await apiRequest('/login', {
      body: { email, password },
      useAuth: false,
    });
    if (data.data?.accessToken && data.data?.refreshToken) {
      setTokens(data.data.accessToken, data.data.refreshToken);
    }
    return data;
  }

  async function register(userData) {
    const data = await apiRequest('/register', {
      body: userData,
      useAuth: false,
    });
    return data;
  }

  async function forgotPassword(email) {
    return apiRequest('/forgot-password', {
      body: { email },
      useAuth: false,
    });
  }

  async function resetPassword(token, password) {
    return apiRequest('/reset-password', {
      body: { token, password },
      useAuth: false,
    });
  }

  async function verifyEmail(token) {
    return apiRequest(`/verify-email?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      useAuth: false,
    });
  }

  async function resendVerification() {
    return apiRequest('/resend-verification', { useAuth: true });
  }

  async function refreshAccessToken() {
    const tokens = getTokens();
    if (!tokens?.refreshToken) throw new Error('No refresh token');

    const data = await apiRequest('/refresh-token', {
      body: { refreshToken: tokens.refreshToken },
      useAuth: false,
    });

    if (data.data?.accessToken && data.data?.refreshToken) {
      setTokens(data.data.accessToken, data.data.refreshToken);
    }
    return data;
  }

  async function logout() {
    const tokens = getTokens();
    if (tokens?.refreshToken) {
      try {
        await apiRequest('/logout', { body: { refreshToken: tokens.refreshToken } });
      } catch { /* ignore */ }
    }
    clearTokens();
  }

  function isAuthenticated() {
    return !!getAccessToken();
  }

  // ── Form Validation ──

  const VALIDATORS = {
    required: (val, field) => {
      if (!val || (typeof val === 'string' && !val.trim())) {
        return `${field || 'This field'} is required`;
      }
      return null;
    },

    email: (val) => {
      if (!val) return null;
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(val.trim())) return 'Please enter a valid email address';
      return null;
    },

    password: (val) => {
      if (!val) return null;
      if (val.length < 8) return 'Password must be at least 8 characters';
      if (!/[A-Z]/.test(val)) return 'Password must have at least one uppercase letter';
      if (!/[a-z]/.test(val)) return 'Password must have at least one lowercase letter';
      if (!/[0-9]/.test(val)) return 'Password must have at least one number';
      return null;
    },

    passwordMatch: (val, matchVal) => {
      if (val !== matchVal) return 'Passwords do not match';
      return null;
    },

    phone: (val) => {
      if (!val || !val.trim()) return null;
      const digits = val.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) return 'Please enter a valid phone number';
      return null;
    },

    minLength: (min) => (val) => {
      if (val && val.length < min) return `Must be at least ${min} characters`;
      return null;
    },

    checked: (val, field) => {
      if (!val) return `You must accept the ${field || 'terms'}`;
      return null;
    },
  };

  function validateField(value, rules, fieldName) {
    for (const rule of rules) {
      let error = null;
      if (typeof rule === 'function') {
        error = rule(value, fieldName);
      } else if (rule.type && VALIDATORS[rule.type]) {
        error = VALIDATORS[rule.type](value, rule.field || fieldName);
      }
      if (error) return error;
    }
    return null;
  }

  function validateForm(formData, schema) {
    const errors = {};
    let isValid = true;

    for (const [field, rules] of Object.entries(schema)) {
      const value = formData[field];
      const error = validateField(value, rules, field);
      if (error) {
        errors[field] = error;
        isValid = false;
      }
    }

    return { isValid, errors };
  }

  // ── Password Strength ──

  function getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { level: 'weak', label: 'Weak', pct: 25 };
    if (score <= 3) return { level: 'medium', label: 'Medium', pct: 50 };
    if (score <= 4) return { level: 'good', label: 'Good', pct: 75 };
    return { level: 'strong', label: 'Strong', pct: 100 };
  }

  function updatePasswordStrength(input, container) {
    if (!container) return;
    const val = input.value;
    const bar = container.querySelector('.password-strength-fill');
    const label = container.querySelector('.password-strength-label');
    const reqs = container.querySelectorAll('.password-req');

    if (!val) {
      bar.style.width = '0';
      label.textContent = '';
      return;
    }

    const { level, label: levelLabel, pct } = getPasswordStrength(val);
    bar.className = 'password-strength-fill ' + level;
    bar.style.width = pct + '%';
    label.textContent = levelLabel;

    reqs.forEach((req) => {
      const check = req.dataset.check;
      const isMet = check === 'length' ? val.length >= 8
        : check === 'uppercase' ? /[A-Z]/.test(val)
        : check === 'lowercase' ? /[a-z]/.test(val)
        : check === 'number' ? /[0-9]/.test(val)
        : check === 'special' ? /[^A-Za-z0-9]/.test(val)
        : false;
      req.classList.toggle('met', isMet);
    });
  }

  // ── OTP Input ──

  function initOTPInputs(container) {
    const inputs = container.querySelectorAll('.otp-input');
    if (!inputs.length) return;

    inputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val;

        if (val && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }

        e.target.classList.toggle('filled', !!val);
        checkOTPComplete(inputs);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
          inputs[index - 1].focus();
          inputs[index - 1].value = '';
          inputs[index - 1].classList.remove('filled');
        }
      });

      input.addEventListener('focus', () => input.select());

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text');
        const digits = paste.replace(/\D/g, '').split('').slice(0, inputs.length);
        digits.forEach((digit, i) => {
          if (inputs[i]) {
            inputs[i].value = digit;
            inputs[i].classList.toggle('filled', true);
          }
        });
        const nextIndex = Math.min(digits.length, inputs.length - 1);
        inputs[nextIndex]?.focus();
        checkOTPComplete(inputs);
      });

      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('autocomplete', 'one-time-code');
    });
  }

  function checkOTPComplete(inputs) {
    const values = Array.from(inputs).map((inp) => inp.value);
    const otp = values.join('');
    const isComplete = otp.length === inputs.length;

    const hiddenInput = inputs[0]?.closest('.otp-container')?.querySelector('.otp-hidden');
    if (hiddenInput) hiddenInput.value = otp;

    const event = new CustomEvent('otpchange', {
      detail: { otp, isComplete },
      bubbles: true,
    });
    inputs[0]?.dispatchEvent(event);

    return { otp, isComplete };
  }

  function startOTPTimer(container, duration = 60, onResend) {
    const display = container.querySelector('.otp-timer-display');
    const btn = container.querySelector('.resend-btn');
    let remaining = duration;

    function updateDisplay() {
      if (display) {
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        display.textContent = `${m}:${s.toString().padStart(2, '0')}`;
      }
      if (btn) btn.disabled = true;
    }

    const interval = setInterval(() => {
      remaining--;
      updateDisplay();
      if (remaining <= 0) {
        clearInterval(interval);
        if (display) display.textContent = '0:00';
        if (btn) {
          btn.disabled = false;
          btn.onclick = async (e) => {
            e.preventDefault();
            btn.disabled = true;
            if (onResend) await onResend();
            remaining = duration;
            updateDisplay();
            startOTPTimer(container, duration, onResend);
          };
        }
      }
    }, 1000);

    updateDisplay();
    return () => clearInterval(interval);
  }

  // ── UI Helpers ──

  function showError(input, message) {
    const group = input.closest('.auth-input-group');
    if (!group) return;
    const errorEl = group.querySelector('.auth-error-text');
    if (errorEl) errorEl.textContent = message || '';
    input.classList.toggle('error', !!message);
  }

  function clearErrors(form) {
    form.querySelectorAll('.auth-error-text').forEach((el) => (el.textContent = ''));
    form.querySelectorAll('.auth-input.error, .auth-select.error').forEach((el) => el.classList.remove('error'));
  }

  function setLoading(btn, isLoading) {
    btn.classList.toggle('loading', isLoading);
    btn.disabled = isLoading;
  }

  function showToast(message, type) {
    const existing = document.querySelector('.auth-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `auth-toast auth-toast-${type || 'error'}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <span class="material-symbols-outlined">${type === 'success' ? 'check_circle' : 'error'}</span>
      <span>${message}</span>
    `;

    toast.style.cssText = `
      position: fixed; top: 24px; left: 50%; transform: translateX(-50%); z-index: 10000;
      background: ${type === 'success' ? '#0a341d' : '#ba1a1a'}; color: #fff;
      padding: 14px 24px; border-radius: 12px; font-family: 'Inter', sans-serif;
      font-size: 14px; display: flex; align-items: center; gap: 10px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15); animation: authSlideUp 0.3s ease;
      max-width: 90vw;
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ── Password Toggle ──

  function initPasswordToggles(container) {
    container.querySelectorAll('.auth-toggle-password').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = btn.closest('.auth-input-group').querySelector('.auth-input');
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.querySelector('.material-symbols-outlined').textContent = isPassword ? 'visibility_off' : 'visibility';
      });
    });
  }

  // ── Auto-hide Nav on Auth Pages ──

  function setupAuthPage() {
    const nav = document.getElementById('main-nav');
    if (nav) nav.style.display = 'none';
    const mobileOverlay = document.getElementById('mobile-overlay');
    if (mobileOverlay) mobileOverlay.style.display = 'none';
    const mobilePanel = document.getElementById('mobile-panel');
    if (mobilePanel) mobilePanel.style.display = 'none';
  }

  // ── Public API ──

  return {
    login,
    register,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerification,
    refreshAccessToken,
    logout,
    isAuthenticated,
    getAccessToken,
    clearTokens,

    validateField,
    validateForm,
    VALIDATORS,

    getPasswordStrength,
    updatePasswordStrength,

    initOTPInputs,
    checkOTPComplete,
    startOTPTimer,

    showError,
    clearErrors,
    setLoading,
    showToast,
    initPasswordToggles,
    setupAuthPage,
  };
})();

window.FAM = FAM;
