// ==========================================
// SkillSwap Global Frontend Logic & UI Controller
// ==========================================
const API_BASE_URL = '';

/**
 * Global Logout handler
 */
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

/**
 * Universal Navbar Controller
 * Works consistently across all pages
 */
async function initNavbar() {
  const token = localStorage.getItem('token');
  let user = null;

  try {
    const raw = localStorage.getItem('user');
    if (raw) user = JSON.parse(raw);
  } catch (e) {
    console.warn('Error parsing user JSON:', e);
  }

  // Determine current page for active nav link
  const path = window.location.pathname.toLowerCase();
  const navLinks = {
    'nav-home': path === '/' || path.endsWith('/index.html') || path === '',
    'nav-skills': path.endsWith('/skills.html'),
    'nav-dashboard': path.endsWith('/dashboard.html'),
    'nav-profile': path.endsWith('/profile.html'),
    'nav-admin': path.endsWith('/admin.html')
  };

  Object.entries(navLinks).forEach(([id, isActive]) => {
    const el = document.getElementById(id);
    if (el) {
      if (isActive) {
        el.classList.add('active');
        el.setAttribute('aria-current', 'page');
      } else {
        el.classList.remove('active');
        el.removeAttribute('aria-current');
      }
    }
  });

  const guestElements = document.querySelectorAll('.guest-only');
  const authElements = document.querySelectorAll('.auth-only');
  const adminElements = document.querySelectorAll('.admin-only');

  if (token && user) {
    guestElements.forEach(el => el.style.setProperty('display', 'none', 'important'));
    authElements.forEach(el => el.style.setProperty('display', el.classList.contains('d-flex') ? 'flex' : 'inline-block', 'important'));

    // Admin-specific elements
    if (user.role === 'admin') {
      adminElements.forEach(el => el.style.setProperty('display', 'inline-block', 'important'));
    } else {
      adminElements.forEach(el => el.style.setProperty('display', 'none', 'important'));
    }

    // Set credits and name in UI
    const creditEls = document.querySelectorAll('#navCreditBalance, .credit-display');
    creditEls.forEach(el => el.innerText = `${user.credits ?? 10} Credits`);

    const nameEls = document.querySelectorAll('#navProfileName, .user-name-display');
    nameEls.forEach(el => el.innerText = user.name || 'My Profile');

    // Asynchronously refresh user session in the background
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const freshUser = await res.json();
        const prevCredits = typeof user.credits === 'number' ? user.credits : 10;
        const newCredits = typeof freshUser.credits === 'number' ? freshUser.credits : 10;

        localStorage.setItem('user', JSON.stringify(freshUser));

        if (prevCredits !== newCredits) {
          window.updateCreditsSmoothly(newCredits, { silent: true });
        } else {
          creditEls.forEach(el => el.innerText = `${newCredits} Credits`);
        }

        nameEls.forEach(el => el.innerText = freshUser.name || 'My Profile');

        if (freshUser.role === 'admin') {
          adminElements.forEach(el => el.style.setProperty('display', 'inline-block', 'important'));
        }
      } else if (res.status === 401 || res.status === 403) {
        logout();
      }
    } catch (err) {
      console.warn('Background session sync offline:', err.message);
    }
  } else {
    // Guest state
    guestElements.forEach(el => el.style.setProperty('display', 'inline-block', 'important'));
    authElements.forEach(el => el.style.setProperty('display', 'none', 'important'));
    adminElements.forEach(el => el.style.setProperty('display', 'none', 'important'));
  }
}

/**
 * =========================================================
 * Universal Smooth Credit Transition Controller
 * Smoothly animates credit increases and decreases across the entire UI
 * =========================================================
 */
function animateCreditNumber(element, endVal, duration, formatFn, isIncrease, isDecrease) {
  if (!element) return;
  const currentText = element.innerText || '0';
  const startNum = parseInt(currentText.replace(/[^0-9\-]/g, ''), 10) || 0;

  if (startNum === endVal) {
    element.innerText = formatFn(endVal);
    return;
  }

  if (isIncrease) element.classList.add('credit-number-glow-up');
  if (isDecrease) element.classList.add('credit-number-glow-down');

  const startTime = performance.now();

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Smooth cubic ease out
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const currentVal = Math.round(startNum + (endVal - startNum) * easeProgress);

    element.innerText = formatFn(currentVal);

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      element.innerText = formatFn(endVal);
      setTimeout(() => {
        element.classList.remove('credit-number-glow-up', 'credit-number-glow-down');
      }, 400);
    }
  }

  requestAnimationFrame(step);
}

function triggerCreditPill(container, diff) {
  if (!container || diff === 0) return;
  const style = window.getComputedStyle(container);
  if (style.position === 'static') {
    container.style.position = 'relative';
  }

  const existing = container.querySelector('.credit-float-pill');
  if (existing) existing.remove();

  const pill = document.createElement('span');
  pill.className = `credit-float-pill ${diff > 0 ? 'float-up' : 'float-down'}`;
  pill.innerHTML = diff > 0
    ? `<i class="fa-solid fa-arrow-trend-up me-1"></i>+${diff} Credit`
    : `<i class="fa-solid fa-arrow-trend-down me-1"></i>${diff} Credit`;

  container.appendChild(pill);
  setTimeout(() => pill.remove(), 1450);
}

function showCreditToast(message, type = 'success') {
  let container = document.getElementById('creditToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'creditToastContainer';
    container.className = 'credit-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `credit-toast toast-${type}`;
  const icon = type === 'success'
    ? 'fa-solid fa-bolt text-warning'
    : type === 'warning'
    ? 'fa-solid fa-circle-exclamation text-warning'
    : 'fa-solid fa-circle-info text-info';

  toast.innerHTML = `
    <i class="${icon} fs-5"></i>
    <div class="flex-grow-1">${message}</div>
    <button type="button" class="btn-close btn-close-white btn-sm" aria-label="Close"></button>
  `;

  const closeBtn = toast.querySelector('.btn-close');
  closeBtn.addEventListener('click', () => removeToast(toast));

  container.appendChild(toast);
  const autoDismiss = setTimeout(() => removeToast(toast), 4500);

  function removeToast(el) {
    clearTimeout(autoDismiss);
    el.style.animation = 'toastSlideOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }
}

window.updateCreditsSmoothly = function(targetCredits, options = {}) {
  if (typeof targetCredits !== 'number' || isNaN(targetCredits)) return;

  let user = null;
  try {
    const raw = localStorage.getItem('user');
    if (raw) user = JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading user:', e);
  }

  const prevCredits = (user && typeof user.credits === 'number') ? user.credits : null;

  if (user) {
    user.credits = targetCredits;
    localStorage.setItem('user', JSON.stringify(user));
  }

  const diff = prevCredits !== null ? (targetCredits - prevCredits) : 0;
  const isIncrease = diff > 0;
  const isDecrease = diff < 0;
  const animDuration = 750;

  // Nav badges
  const navBalanceEls = document.querySelectorAll('#navCreditBalance, .credit-display');
  navBalanceEls.forEach(el => {
    animateCreditNumber(el, targetCredits, animDuration, val => `${val} Credits`, isIncrease, isDecrease);
    triggerCreditPill(el.closest('.credit-badge') || el, diff);
  });

  // Dashboard & profile numeric counters
  const statCreditsEls = document.querySelectorAll('#statCredits, #userCreditsCount');
  statCreditsEls.forEach(el => {
    animateCreditNumber(el, targetCredits, animDuration, val => `${val}`, isIncrease, isDecrease);
    triggerCreditPill(el.closest('.stat-card') || el.parentElement || el, diff);
  });

  // Pulse animation on badge wrappers
  if (isIncrease || isDecrease) {
    const badges = document.querySelectorAll('.credit-badge, .stat-card');
    badges.forEach(badge => {
      badge.classList.remove('credit-pulse-up', 'credit-pulse-down');
      void badge.offsetWidth; // trigger reflow
      badge.classList.add(isIncrease ? 'credit-pulse-up' : 'credit-pulse-down');
      setTimeout(() => badge.classList.remove('credit-pulse-up', 'credit-pulse-down'), 900);
    });
  }

  // Toasts
  if (options.message) {
    showCreditToast(options.message, options.type || (isIncrease ? 'success' : isDecrease ? 'warning' : 'info'));
  } else if (!options.silent && (isIncrease || isDecrease)) {
    const msg = isIncrease
      ? `⚡ +${diff} Skill Credit${diff > 1 ? 's' : ''} added! (Balance: ${targetCredits})`
      : `⚡ ${diff} Skill Credit${Math.abs(diff) > 1 ? 's' : ''} deducted. (Balance: ${targetCredits})`;
    showCreditToast(msg, isIncrease ? 'success' : 'warning');
  }
};

/**
 * Toast / Alert Notification Helper
 */
function showAlert(message, type = 'success', containerId = null) {
  const target = containerId ? document.getElementById(containerId) : null;
  if (target) {
    target.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show shadow-sm" role="alert">
        <i class="fa-solid fa-${type === 'success' ? 'circle-check' : type === 'danger' ? 'circle-exclamation' : 'circle-info'} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
    setTimeout(() => {
      if (target) target.innerHTML = '';
    }, 5000);
  } else {
    showCreditToast(message, type);
  }
}

// ==========================================
// Page-Specific Controllers on DOM Ready
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();

  const token = localStorage.getItem('token');
  const path = window.location.pathname.toLowerCase();

  // Authentication guards for protected routes
  const protectedPages = ['/dashboard.html', '/profile.html', '/admin.html'];
  if (protectedPages.some(p => path.endsWith(p)) && !token) {
    window.location.href = '/login.html';
    return;
  }

  // Redirect logged-in users away from auth pages
  const authPages = ['/login.html', '/register.html'];
  if (authPages.some(p => path.endsWith(p)) && token) {
    window.location.href = '/dashboard.html';
    return;
  }

  // Index Page specific initialization
  const skillsContainer = document.getElementById('skillsContainer');
  const skillFormContainer = document.getElementById('skillFormContainer');
  if (skillsContainer) {
    if (token) {
      if (skillFormContainer) skillFormContainer.style.display = 'block';
      const feedCol = document.getElementById('skillsFeedCol');
      if (feedCol) {
        feedCol.className = 'col-lg-7';
      }
    } else {
      if (skillFormContainer) skillFormContainer.style.display = 'none';
      const feedCol = document.getElementById('skillsFeedCol');
      if (feedCol) {
        feedCol.className = 'col-lg-9 mx-auto';
      }
    }
    fetchIndexSkills();
  }

  // Index Add Skill form handler
  const indexSkillForm = document.getElementById('addSkillForm');
  if (indexSkillForm && skillsContainer) {
    indexSkillForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!token) {
        window.location.href = '/login.html';
        return;
      }

      const submitBtn = indexSkillForm.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Publishing...';
      }

      const formData = new FormData();
      formData.append('title', document.getElementById('skillTitle').value);
      formData.append('category', document.getElementById('skillCategory').value);
      formData.append('description', document.getElementById('skillDesc').value);

      const pdf = document.getElementById('skillPdf')?.files[0];
      const video = document.getElementById('skillVideo')?.files[0];
      const MAX_SIZE = 4.5 * 1024 * 1024; // 4.5MB
      if (pdf && pdf.size > MAX_SIZE) {
        showAlert('PDF file exceeds 4.5MB limit. Please upload a smaller document.', 'danger');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; }
        return;
      }
      if (video && video.size > MAX_SIZE) {
        showAlert('Video file exceeds 4.5MB limit. Please upload a shorter or compressed demo.', 'danger');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; }
        return;
      }

      if (pdf) formData.append('pdf', pdf);
      if (video) formData.append('video', video);

      try {
        const res = await fetch('/api/skills', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const currentCredit = (user && typeof user.credits === 'number') ? user.credits : 10;
          const newCredit = typeof data.userCredits === 'number' ? data.userCredits : (currentCredit + 1);

          window.updateCreditsSmoothly(newCredit, {
            message: '🎉 Skill published! +1 Skill Credit added to your balance!',
            type: 'success'
          });

          indexSkillForm.reset();
          fetchIndexSkills();
        } else {
          const err = await res.json().catch(() => null);
          showAlert(err?.message || 'Failed to post skill', 'danger');
        }
      } catch (err) {
        showAlert('Network error: Unable to post skill', 'danger');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      }
    });
  }
});

/**
 * Fetch and Render Skills for Index Page
 */
async function fetchIndexSkills() {
  const container = document.getElementById('skillsContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="col-12 text-center py-5">
      <div class="spinner-border text-info" role="status"></div>
      <p class="text-muted mt-2">Loading latest community skills...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/skills');
    if (!res.ok) throw new Error('Could not fetch skills');
    const skills = await res.json();

    if (!skills || skills.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="fa-solid fa-seedling text-muted fa-3x mb-3"></i>
          <p class="text-muted fs-5">No skills posted yet. Be the first to share your knowledge!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = skills.map(s => {
      const authorName = s.user?.name || 'Community Member';
      return `
        <div class="col-12 mb-3">
          <div class="card p-4 shadow-sm border-0">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>
                <h5 class="fw-bold mb-1">${escapeHtml(s.title)}</h5>
                <small class="text-muted"><i class="fa-solid fa-user-circle me-1"></i> Posted by: <strong>${escapeHtml(authorName)}</strong></small>
              </div>
              <span class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-3 py-2 rounded-pill fw-semibold">${escapeHtml(s.category)}</span>
            </div>
            <p class="text-secondary my-2">${escapeHtml(s.description)}</p>

            ${s.videoFile ? `
              <div class="my-3">
                <video controls preload="metadata" class="w-100 rounded shadow-sm" style="max-height: 280px; background-color: #000;">
                  <source src="${s.videoFile}">
                  Your browser does not support video playback.
                </video>
              </div>
            ` : ''}

            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3 pt-3 border-top">
              <div class="d-flex align-items-center gap-1">
                ${s.pdfFile ? `
                  <a href="${s.pdfFile}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-danger">
                    <i class="fa-solid fa-file-pdf me-1"></i> View Syllabus
                  </a>
                  <a href="${s.pdfFile}?download=1" class="btn btn-sm btn-outline-secondary" download title="Download Syllabus PDF">
                    <i class="fa-solid fa-download"></i>
                  </a>
                ` : '<span class="text-muted small"><i class="fa-solid fa-circle-check text-success me-1"></i> Interactive Session</span>'}
                ${s.videoFile ? `
                  <a href="${s.videoFile}?download=1" class="btn btn-sm btn-outline-secondary" download title="Download Demo Video">
                    <i class="fa-solid fa-video me-1"></i><i class="fa-solid fa-download"></i>
                  </a>
                ` : ''}
              </div>
              <a href="/skills.html" class="btn btn-sm btn-primary">
                <i class="fa-solid fa-calendar-check me-1"></i> Book in Catalog
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `
      <div class="col-12 text-center py-4">
        <p class="text-danger"><i class="fa-solid fa-triangle-exclamation me-1"></i> Failed to load skills. Please check your connection.</p>
      </div>
    `;
  }
}

/**
 * XSS helper for safe rendering
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}