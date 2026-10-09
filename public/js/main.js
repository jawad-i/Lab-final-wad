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
        localStorage.setItem('user', JSON.stringify(freshUser));
        creditEls.forEach(el => el.innerText = `${freshUser.credits ?? 10} Credits`);
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
    alert(message);
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
          showAlert('Skill posted successfully!', 'success');
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