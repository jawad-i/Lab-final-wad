const API_BASE_URL = ''; 

function logout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  let user = null;

  try {
    const userData = localStorage.getItem('user');
    if (userData) user = JSON.parse(userData);
  } catch (err) {
    console.error("User JSON parse error:", err);
  }

  const skillFormContainer = document.getElementById('skillFormContainer');

  if (token && user) {
    if (document.getElementById('login-link')) document.getElementById('login-link').style.display = 'none';
    if (document.getElementById('register-link')) document.getElementById('register-link').style.display = 'none';
    if (document.getElementById('dashboard-link')) document.getElementById('dashboard-link').style.display = 'inline-block';
    if (document.getElementById('logout-btn')) document.getElementById('logout-btn').style.display = 'inline-block';

    // Show skill creation form container ONLY if user is logged in
    if (skillFormContainer) skillFormContainer.style.display = 'block';

    if (user.role === 'admin' && document.getElementById('admin-link')) {
      document.getElementById('admin-link').style.display = 'inline-block';
    }
  } else {
    // Hide form if user is not logged in
    if (skillFormContainer) skillFormContainer.style.display = 'none';
  }

  fetchSkills();
});

const addSkillForm = document.getElementById('addSkillForm');

if (addSkillForm) {
  addSkillForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const token = localStorage.getItem('token');
    if (!token) {
      alert('You must be logged in to post a skill.');
      window.location.href = 'login.html';
      return;
    }

    const formData = new FormData();
    formData.append('title', document.getElementById('skillTitle').value);
    formData.append('category', document.getElementById('skillCategory').value);
    formData.append('description', document.getElementById('skillDesc').value);

    const pdfFile = document.getElementById('skillPdf')?.files[0];
    const videoFile = document.getElementById('skillVideo')?.files[0];

    if (pdfFile) formData.append('pdf', pdfFile);
    if (videoFile) formData.append('video', videoFile);

    try {
      const headers = {
        'Authorization': `Bearer ${token}`
      };

      const res = await fetch(`${API_BASE_URL}/api/skills`, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      if (res.ok) {
        alert('Skill successfully created with attached files!');
        addSkillForm.reset();
        fetchSkills();
      } else {
        const errorData = await res.json().catch(() => null);
        const errorMsg = errorData?.message || `Server returned error status ${res.status}`;
        alert('Error: ' + errorMsg);
      }
    } catch (err) {
      console.error('Upload Error:', err);
      alert('Could not connect to the server.');
    }
  });
}

async function fetchSkills() {
  const container = document.getElementById('skillsContainer');
  if (!container) return;

  container.innerHTML = '<div class="col-12 text-center py-4"><div class="spinner-border text-info" role="status"></div><p class="text-muted mt-2">Loading skills...</p></div>';

  try {
    let res = await fetch('/api/skills');
    if (!res.ok && res.status === 404) {
      res = await fetch('/skills');
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.message || `Server status: ${res.status}`);
    }

    const skills = await res.json();

    if (!skills || skills.length === 0) {
      container.innerHTML = '<div class="col-12"><p class="text-muted">No skills posted yet.</p></div>';
      return;
    }

    container.innerHTML = skills.map(s => {
      const videoSrc = s.videoFile ? (s.videoFile.startsWith('http') || s.videoFile.startsWith('data:') ? s.videoFile : `${API_BASE_URL}${s.videoFile.startsWith('/') ? '' : '/'}${s.videoFile}`) : null;
      const pdfSrc = s.pdfFile ? (s.pdfFile.startsWith('http') || s.pdfFile.startsWith('data:') ? s.pdfFile : `${API_BASE_URL}${s.pdfFile.startsWith('/') ? '' : '/'}${s.pdfFile}`) : null;
      const authorName = s.user?.name ? s.user.name : 'Anonymous';

      return `
        <div class="col-12">
          <div class="card p-3 shadow-sm border-0 mb-3">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h5 class="fw-bold mb-1">${s.title}</h5>
                <small class="text-muted">Posted by: ${authorName}</small>
              </div>
              <span class="badge bg-info text-dark">${s.category}</span>
            </div>
            <p class="text-muted my-2">${s.description}</p>

            ${videoSrc ? `
              <div class="my-2">
                <video controls class="w-100 rounded" style="max-height: 240px; background-color: #000;">
                  <source src="${videoSrc}">
                  Your browser does not support the video tag.
                </video>
              </div>
            ` : ''}

            ${pdfSrc ? `
              <div class="mt-2">
                <a href="${pdfSrc}" target="_blank" class="btn btn-sm btn-outline-danger">
                  <i class="fa-solid fa-file-pdf me-1"></i> View / Download PDF
                </a>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Fetch Error:', err);
    container.innerHTML = `<div class="col-12"><p class="text-danger">Failed to load skills (${err.message || 'Server error'}). Make sure your server is running.</p></div>`;
  }
}