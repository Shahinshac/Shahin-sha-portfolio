/**
 * Shahin Sha Portfolio CMS - Admin Dashboard Controller
 * Dedicated Supabase Integration: yaxyqpwsxknahehhmtch
 */

let currentSection = 'overview';
let activeAdminSession = null;
let pendingConfirmAction = null;
let pendingEditSaveAction = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});

/* ==========================================================================
   1. AUTHENTICATION & SESSION MANAGEMENT
   ========================================================================== */

async function waitForSupabase(maxWaitMs = 3500) {
  const start = Date.now();
  while (!window.supabase || typeof window.supabase.createClient !== 'function') {
    if (Date.now() - start > maxWaitMs) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return typeof window.getSupabase === 'function' ? window.getSupabase() : null;
}

async function initAuth() {
  // Always guarantee login view is active by default
  showLoginView();

  const supabase = await waitForSupabase(3500);
  if (!supabase) {
    console.warn('[Admin] Supabase client failed to initialize within timeout.');
    showLoginAlert('Unable to connect to Supabase SDK. Please check your network connection or ad-blocker.');
    return;
  }

  // Check existing session
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('Session check error:', error);
      showLoginView();
      return;
    }

    if (session) {
      await verifyAndApplySession(session);
    } else {
      showLoginView();
    }
  } catch (err) {
    console.warn('Initial session check exception:', err);
    showLoginView();
  }

  // Subscribe to auth state changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await verifyAndApplySession(session);
    } else if (event === 'SIGNED_OUT') {
      activeAdminSession = null;
      showLoginView();
    }
  });
}

async function verifyAndApplySession(session) {
  const supabase = window.getSupabase();
  if (!session || !session.user) {
    showLoginView();
    return;
  }

  // Access Guard: Verify user exists in public.admin_users with role 'admin'
  try {
    const { data: adminRecord, error } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error || !adminRecord || adminRecord.role !== 'admin') {
      console.warn('Unauthorized login attempt:', session.user.id);
      await supabase.auth.signOut();
      showLoginAlert('Access Denied: Your account is not registered as an administrator.');
      showLoginView();
      return;
    }

    // Authorized Admin
    activeAdminSession = session;
    document.getElementById('userEmailBadge').textContent = session.user.email || 'Admin';
    showDashboardView();
    loadOverviewMetrics();
    loadSectionData(currentSection);
    showToast(`Welcome back, ${session.user.email}!`, 'success');
  } catch (err) {
    console.error('Admin verification error:', err);
    await supabase.auth.signOut();
    showLoginAlert('Security check error during administrator verification.');
    showLoginView();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const submitBtn = document.getElementById('loginBtn');
  const alertEl = document.getElementById('loginAlert');

  alertEl.style.display = 'none';
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showLoginAlert('Please enter both email and password.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';

  try {
    const supabase = window.getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      showLoginAlert(error.message || 'Invalid email or password.');
    } else if (data && data.session) {
      await verifyAndApplySession(data.session);
    }
  } catch (err) {
    showLoginAlert(err.message || 'Authentication error.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In to Dashboard';
  }
}

async function handleLogout() {
  openConfirmModal(
    'Sign Out',
    'Are you sure you want to end your administrator session?',
    async () => {
      const supabase = window.getSupabase();
      await supabase.auth.signOut();
      activeAdminSession = null;
      showToast('Successfully signed out.', 'info');
      showLoginView();
    }
  );
}

function showLoginView() {
  document.getElementById('loginView').style.display = 'flex';
  document.getElementById('dashboardView').style.display = 'none';
}

function showDashboardView() {
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('dashboardView').style.display = 'flex';
}

function showLoginAlert(msg) {
  const alertEl = document.getElementById('loginAlert');
  alertEl.textContent = msg;
  alertEl.style.display = 'block';
}

/* ==========================================================================
   2. NAVIGATION & SECTIONS
   ========================================================================== */

function switchSection(sectionId) {
  currentSection = sectionId;

  // Update active sidebar nav
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    btn.classList.toggle('is-active', btn.getAttribute('data-section') === sectionId);
  });

  // Toggle visible section
  document.querySelectorAll('.admin-section').forEach(sec => {
    sec.style.display = 'none';
  });
  const activeSec = document.getElementById(`sec-${sectionId}`);
  if (activeSec) activeSec.style.display = 'block';

  // Update topbar title
  const titles = {
    overview: 'Dashboard Overview',
    projects: 'Projects Management',
    skills: 'Technical Skills Directory',
    experience: 'Work & Professional Experience',
    education: 'Academic Qualifications',
    certifications: 'Professional Certifications',
    profile: 'Profile & Contact Details',
    media: 'Portfolio Media Assets (Storage)'
  };
  document.getElementById('topbarTitle').textContent = titles[sectionId] || 'Dashboard';

  // Close mobile sidebar if open
  document.querySelector('.sidebar').classList.remove('is-open');

  // Load section content
  loadSectionData(sectionId);
}

function refreshCurrentSection() {
  loadOverviewMetrics();
  loadSectionData(currentSection);
  showToast('Data refreshed.', 'info');
}

function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('is-open');
}

function loadSectionData(sec) {
  if (sec === 'overview') loadOverviewMetrics();
  else if (sec === 'projects') loadProjects();
  else if (sec === 'skills') loadSkills();
  else if (sec === 'experience') loadExperience();
  else if (sec === 'education') loadEducation();
  else if (sec === 'certifications') loadCertifications();
  else if (sec === 'profile') loadProfiles();
  else if (sec === 'media') loadMediaGallery();
}

/* ==========================================================================
   3. OVERVIEW METRICS
   ========================================================================== */

async function loadOverviewMetrics() {
  const supabase = window.getSupabase();
  if (!supabase || !activeAdminSession) return;

  try {
    const [projRes, skillRes, expRes, eduRes, certRes, mediaRes] = await Promise.all([
      supabase.from('projects').select('id, is_published'),
      supabase.from('skills').select('id, is_published'),
      supabase.from('experience').select('id, is_published'),
      supabase.from('education').select('id, is_published'),
      supabase.from('certifications').select('id, is_published'),
      supabase.storage.from('portfolio-media').list('uploads')
    ]);

    const projs = projRes.data || [];
    document.getElementById('statProjects').textContent = projs.length;
    document.getElementById('statProjectsPub').textContent = projs.filter(p => p.is_published).length;

    const skills = skillRes.data || [];
    document.getElementById('statSkills').textContent = skills.length;
    document.getElementById('statSkillsPub').textContent = skills.filter(s => s.is_published).length;

    const exp = expRes.data || [];
    document.getElementById('statExp').textContent = exp.length;
    document.getElementById('statExpPub').textContent = exp.filter(e => e.is_published).length;

    const edu = eduRes.data || [];
    document.getElementById('statEdu').textContent = edu.length;
    document.getElementById('statEduPub').textContent = edu.filter(e => e.is_published).length;

    const certs = certRes.data || [];
    document.getElementById('statCerts').textContent = certs.length;
    document.getElementById('statCertsPub').textContent = certs.filter(c => c.is_published).length;

    const mediaList = mediaRes.data || [];
    document.getElementById('statMedia').textContent = mediaList.length;
  } catch (err) {
    console.error('Error loading metrics:', err);
  }
}

/* ==========================================================================
   4. PROJECTS CRUD
   ========================================================================== */

let cachedProjects = [];

async function loadProjects() {
  const tbody = document.getElementById('projectsTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-6"><i class="fa-solid fa-spinner fa-spin"></i> Loading projects...</td></tr>';

  const supabase = window.getSupabase();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-rose py-6">Error: ${escapeHTML(error.message)}</td></tr>`;
    return;
  }

  cachedProjects = data || [];
  renderProjectsTable(cachedProjects);
}

function renderProjectsTable(projects) {
  const tbody = document.getElementById('projectsTableBody');
  tbody.innerHTML = '';

  if (!projects.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-6">No projects found. Click "Add Project" or use the Initial Content Seed.</td></tr>';
    return;
  }

  projects.forEach((p, idx) => {
    const tr = document.createElement('tr');

    const statusBadge = p.is_published 
      ? '<span class="badge badge-emerald mono"><i class="fa-solid fa-circle-check"></i> Published</span>'
      : '<span class="badge badge-amber mono"><i class="fa-solid fa-clock"></i> Draft</span>';

    const tagsHtml = (p.tags || []).slice(0, 3).map(t => `<span class="badge badge-cyan mono">${escapeHTML(t)}</span>`).join(' ');

    tr.innerHTML = `
      <td class="mono text-muted text-sm">${String(idx + 1).padStart(2, '0')}</td>
      <td>
        <strong style="color: var(--text-main);">${escapeHTML(p.title)}</strong>
        <p class="text-muted text-sm" style="max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(p.description)}</p>
      </td>
      <td><span class="badge badge-indigo mono">${escapeHTML(p.category)}</span></td>
      <td>${tagsHtml}</td>
      <td>${statusBadge}</td>
      <td class="mono">${p.display_order}</td>
      <td>
        <div class="table-actions">
          <button class="action-btn action-btn--publish" title="${p.is_published ? 'Unpublish (Make Draft)' : 'Publish to Live Site'}" onclick="toggleProjectPublish('${p.id}', ${p.is_published})">
            <i class="fa-solid ${p.is_published ? 'fa-eye-slash' : 'fa-eye'}"></i>
          </button>
          <button class="action-btn" title="Edit Project" onclick="openEditProjectModal('${p.id}')">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="action-btn action-btn--delete" title="Delete Project" onclick="confirmDeleteProject('${p.id}', '${escapeAttr(p.title)}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterProjectTable() {
  const query = document.getElementById('projectSearchInput').value.toLowerCase();
  const filtered = cachedProjects.filter(p => 
    p.title.toLowerCase().includes(query) || 
    p.category.toLowerCase().includes(query) ||
    (p.tags || []).some(t => t.toLowerCase().includes(query))
  );
  renderProjectsTable(filtered);
}

function openCreateProjectModal() {
  const html = `
    <form id="projectForm">
      <div class="form-group">
        <label class="form-label mono">Project Title *</label>
        <input type="text" id="mProjTitle" class="form-input" placeholder="e.g. HospitalOS + PharmacyERP" required>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Category *</label>
          <select id="mProjCategory" class="form-input">
            <option value="fullstack">Full-Stack</option>
            <option value="backend">Backend &amp; APIs</option>
            <option value="realtime">Real-Time &amp; Cloud</option>
            <option value="python">Python &amp; ML</option>
            <option value="erp">ERP &amp; Finance</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label mono">Display Order</label>
          <input type="number" id="mProjOrder" class="form-input" value="1">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label mono">Description *</label>
        <textarea id="mProjDesc" class="form-input" rows="3" placeholder="Overview of system architecture and features..." required></textarea>
      </div>
      <div class="form-group">
        <label class="form-label mono">Tags (Comma-separated)</label>
        <input type="text" id="mProjTags" class="form-input" placeholder="NestJS, React, PostgreSQL, Docker">
      </div>
      <div class="form-group">
        <label class="form-label mono">Image URL (Optional)</label>
        <input type="url" id="mProjImage" class="form-input" placeholder="https://... or select from Media Storage">
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">GitHub URL</label>
          <input type="url" id="mProjGithub" class="form-input" placeholder="https://github.com/Shahinshac/...">
        </div>
        <div class="form-group">
          <label class="form-label mono">Live Demo URL</label>
          <input type="url" id="mProjLive" class="form-input" placeholder="https://...">
        </div>
      </div>
      <div class="form-check mt-3">
        <input type="checkbox" id="mProjPublish" class="form-check-input">
        <label for="mProjPublish" class="form-check-label">Publish this project immediately (Visible on live site)</label>
      </div>
    </form>
  `;

  openEditModal('Create New Project', html, async () => {
    const title = document.getElementById('mProjTitle').value.trim();
    const desc = document.getElementById('mProjDesc').value.trim();
    const category = document.getElementById('mProjCategory').value;
    const order = parseInt(document.getElementById('mProjOrder').value) || 0;
    const tagsStr = document.getElementById('mProjTags').value;
    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
    const imageUrl = document.getElementById('mProjImage').value.trim() || null;
    const githubUrl = document.getElementById('mProjGithub').value.trim() || null;
    const liveUrl = document.getElementById('mProjLive').value.trim() || null;
    const isPublished = document.getElementById('mProjPublish').checked;

    if (!title || !desc) {
      showToast('Title and Description are required.', 'error');
      return false;
    }

    const supabase = window.getSupabase();
    const { error } = await supabase.from('projects').insert([{
      title,
      description: desc,
      category,
      display_order: order,
      tags,
      image_url: imageUrl,
      github_url: githubUrl,
      live_url: liveUrl,
      is_published: isPublished
    }]);

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
      return false;
    }

    showToast('Project created successfully!', 'success');
    loadProjects();
    loadOverviewMetrics();
    return true;
  });
}

function openEditProjectModal(id) {
  const p = cachedProjects.find(item => item.id === id);
  if (!p) return;

  const html = `
    <form id="projectForm">
      <div class="form-group">
        <label class="form-label mono">Project Title *</label>
        <input type="text" id="mProjTitle" class="form-input" value="${escapeAttr(p.title)}" required>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Category *</label>
          <select id="mProjCategory" class="form-input">
            <option value="fullstack" ${p.category === 'fullstack' ? 'selected' : ''}>Full-Stack</option>
            <option value="backend" ${p.category === 'backend' ? 'selected' : ''}>Backend &amp; APIs</option>
            <option value="realtime" ${p.category === 'realtime' ? 'selected' : ''}>Real-Time &amp; Cloud</option>
            <option value="python" ${p.category === 'python' ? 'selected' : ''}>Python &amp; ML</option>
            <option value="erp" ${p.category === 'erp' ? 'selected' : ''}>ERP &amp; Finance</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label mono">Display Order</label>
          <input type="number" id="mProjOrder" class="form-input" value="${p.display_order}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label mono">Description *</label>
        <textarea id="mProjDesc" class="form-input" rows="3" required>${escapeHTML(p.description)}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label mono">Tags (Comma-separated)</label>
        <input type="text" id="mProjTags" class="form-input" value="${escapeAttr((p.tags || []).join(', '))}">
      </div>
      <div class="form-group">
        <label class="form-label mono">Image URL (Optional)</label>
        <input type="url" id="mProjImage" class="form-input" value="${escapeAttr(p.image_url || '')}">
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">GitHub URL</label>
          <input type="url" id="mProjGithub" class="form-input" value="${escapeAttr(p.github_url || '')}">
        </div>
        <div class="form-group">
          <label class="form-label mono">Live Demo URL</label>
          <input type="url" id="mProjLive" class="form-input" value="${escapeAttr(p.live_url || '')}">
        </div>
      </div>
      <div class="form-check mt-3">
        <input type="checkbox" id="mProjPublish" class="form-check-input" ${p.is_published ? 'checked' : ''}>
        <label for="mProjPublish" class="form-check-label">Publish this project (Visible on live site)</label>
      </div>
    </form>
  `;

  openEditModal(`Edit Project: ${p.title}`, html, async () => {
    const title = document.getElementById('mProjTitle').value.trim();
    const desc = document.getElementById('mProjDesc').value.trim();
    const category = document.getElementById('mProjCategory').value;
    const order = parseInt(document.getElementById('mProjOrder').value) || 0;
    const tagsStr = document.getElementById('mProjTags').value;
    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
    const imageUrl = document.getElementById('mProjImage').value.trim() || null;
    const githubUrl = document.getElementById('mProjGithub').value.trim() || null;
    const liveUrl = document.getElementById('mProjLive').value.trim() || null;
    const isPublished = document.getElementById('mProjPublish').checked;

    if (!title || !desc) {
      showToast('Title and Description are required.', 'error');
      return false;
    }

    const supabase = window.getSupabase();
    const { error } = await supabase.from('projects').update({
      title,
      description: desc,
      category,
      display_order: order,
      tags,
      image_url: imageUrl,
      github_url: githubUrl,
      live_url: liveUrl,
      is_published: isPublished
    }).eq('id', id);

    if (error) {
      showToast('Update failed: ' + error.message, 'error');
      return false;
    }

    showToast('Project updated successfully.', 'success');
    loadProjects();
    loadOverviewMetrics();
    return true;
  });
}

async function toggleProjectPublish(id, currentStatus) {
  const supabase = window.getSupabase();
  const nextStatus = !currentStatus;

  const { error } = await supabase
    .from('projects')
    .update({ is_published: nextStatus })
    .eq('id', id);

  if (error) {
    showToast('Failed to change status: ' + error.message, 'error');
  } else {
    showToast(nextStatus ? 'Project published.' : 'Project set to draft.', 'success');
    loadProjects();
    loadOverviewMetrics();
  }
}

function confirmDeleteProject(id, title) {
  openConfirmModal(
    'Delete Project',
    `Are you sure you want to permanently delete "${title}"? This cannot be undone.`,
    async () => {
      const supabase = window.getSupabase();
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) {
        showToast('Delete failed: ' + error.message, 'error');
      } else {
        showToast('Project deleted.', 'success');
        loadProjects();
        loadOverviewMetrics();
      }
    }
  );
}

/* ==========================================================================
   5. SKILLS CRUD
   ========================================================================== */

let cachedSkills = [];

async function loadSkills() {
  const tbody = document.getElementById('skillsTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-6"><i class="fa-solid fa-spinner fa-spin"></i> Loading skills...</td></tr>';

  const supabase = window.getSupabase();
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('category', { ascending: true })
    .order('display_order', { ascending: true });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-rose py-6">Error: ${escapeHTML(error.message)}</td></tr>`;
    return;
  }

  cachedSkills = data || [];
  renderSkillsTable(cachedSkills);
}

function renderSkillsTable(skills) {
  const tbody = document.getElementById('skillsTableBody');
  tbody.innerHTML = '';

  if (!skills.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-6">No skills found. Click "Add Skill" to create one.</td></tr>';
    return;
  }

  skills.forEach(s => {
    const tr = document.createElement('tr');
    const statusBadge = s.is_published 
      ? '<span class="badge badge-emerald mono">Published</span>' 
      : '<span class="badge badge-amber mono">Draft</span>';

    tr.innerHTML = `
      <td><strong>${escapeHTML(s.name)}</strong></td>
      <td><span class="badge badge-indigo mono">${escapeHTML(s.category)}</span></td>
      <td><code class="mono text-muted">${escapeHTML(s.icon_class || 'None')}</code></td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 80px; height: 6px; background: var(--border); border-radius: 4px; overflow: hidden;">
            <div style="width: ${s.proficiency || 0}%; height: 100%; background: var(--accent);"></div>
          </div>
          <span class="mono text-sm">${s.proficiency || 0}%</span>
        </div>
      </td>
      <td>${statusBadge}</td>
      <td class="mono">${s.display_order}</td>
      <td>
        <div class="table-actions">
          <button class="action-btn action-btn--publish" title="Toggle Publish" onclick="toggleSkillPublish('${s.id}', ${s.is_published})">
            <i class="fa-solid ${s.is_published ? 'fa-eye-slash' : 'fa-eye'}"></i>
          </button>
          <button class="action-btn" title="Edit Skill" onclick="openEditSkillModal('${s.id}')">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="action-btn action-btn--delete" title="Delete Skill" onclick="confirmDeleteSkill('${s.id}', '${escapeAttr(s.name)}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterSkillsTable() {
  const query = document.getElementById('skillSearchInput').value.toLowerCase();
  const filtered = cachedSkills.filter(s => 
    s.name.toLowerCase().includes(query) || 
    s.category.toLowerCase().includes(query)
  );
  renderSkillsTable(filtered);
}

function openCreateSkillModal() {
  const html = `
    <form id="skillForm">
      <div class="form-group">
        <label class="form-label mono">Skill Name *</label>
        <input type="text" id="mSkillName" class="form-input" placeholder="e.g. NestJS, Docker, PostgreSQL" required>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Category *</label>
          <input type="text" id="mSkillCategory" class="form-input" placeholder="Backend, Frontend, Cloud &amp; DevOps" required>
        </div>
        <div class="form-group">
          <label class="form-label mono">Proficiency (0-100%)</label>
          <input type="number" id="mSkillProf" class="form-input" min="0" max="100" value="85">
        </div>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Icon Class (Font Awesome)</label>
          <input type="text" id="mSkillIcon" class="form-input" placeholder="fa-brands fa-react">
        </div>
        <div class="form-group">
          <label class="form-label mono">Display Order</label>
          <input type="number" id="mSkillOrder" class="form-input" value="1">
        </div>
      </div>
      <div class="form-check mt-3">
        <input type="checkbox" id="mSkillPublish" class="form-check-input">
        <label for="mSkillPublish" class="form-check-label">Publish this skill immediately</label>
      </div>
    </form>
  `;

  openEditModal('Add Technical Skill', html, async () => {
    const name = document.getElementById('mSkillName').value.trim();
    const category = document.getElementById('mSkillCategory').value.trim();
    const proficiency = parseInt(document.getElementById('mSkillProf').value) || 0;
    const icon_class = document.getElementById('mSkillIcon').value.trim() || null;
    const display_order = parseInt(document.getElementById('mSkillOrder').value) || 0;
    const is_published = document.getElementById('mSkillPublish').checked;

    if (!name || !category) {
      showToast('Name and Category are required.', 'error');
      return false;
    }

    const supabase = window.getSupabase();
    const { error } = await supabase.from('skills').insert([{
      name, category, proficiency, icon_class, display_order, is_published
    }]);

    if (error) {
      showToast('Error: ' + error.message, 'error');
      return false;
    }

    showToast('Skill added successfully.', 'success');
    loadSkills();
    loadOverviewMetrics();
    return true;
  });
}

function openEditSkillModal(id) {
  const s = cachedSkills.find(item => item.id === id);
  if (!s) return;

  const html = `
    <form id="skillForm">
      <div class="form-group">
        <label class="form-label mono">Skill Name *</label>
        <input type="text" id="mSkillName" class="form-input" value="${escapeAttr(s.name)}" required>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Category *</label>
          <input type="text" id="mSkillCategory" class="form-input" value="${escapeAttr(s.category)}" required>
        </div>
        <div class="form-group">
          <label class="form-label mono">Proficiency (0-100%)</label>
          <input type="number" id="mSkillProf" class="form-input" min="0" max="100" value="${s.proficiency || 85}">
        </div>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Icon Class (Font Awesome)</label>
          <input type="text" id="mSkillIcon" class="form-input" value="${escapeAttr(s.icon_class || '')}">
        </div>
        <div class="form-group">
          <label class="form-label mono">Display Order</label>
          <input type="number" id="mSkillOrder" class="form-input" value="${s.display_order}">
        </div>
      </div>
      <div class="form-check mt-3">
        <input type="checkbox" id="mSkillPublish" class="form-check-input" ${s.is_published ? 'checked' : ''}>
        <label for="mSkillPublish" class="form-check-label">Publish this skill</label>
      </div>
    </form>
  `;

  openEditModal(`Edit Skill: ${s.name}`, html, async () => {
    const name = document.getElementById('mSkillName').value.trim();
    const category = document.getElementById('mSkillCategory').value.trim();
    const proficiency = parseInt(document.getElementById('mSkillProf').value) || 0;
    const icon_class = document.getElementById('mSkillIcon').value.trim() || null;
    const display_order = parseInt(document.getElementById('mSkillOrder').value) || 0;
    const is_published = document.getElementById('mSkillPublish').checked;

    if (!name || !category) {
      showToast('Name and Category are required.', 'error');
      return false;
    }

    const supabase = window.getSupabase();
    const { error } = await supabase.from('skills').update({
      name, category, proficiency, icon_class, display_order, is_published
    }).eq('id', id);

    if (error) {
      showToast('Update failed: ' + error.message, 'error');
      return false;
    }

    showToast('Skill updated.', 'success');
    loadSkills();
    loadOverviewMetrics();
    return true;
  });
}

async function toggleSkillPublish(id, currentStatus) {
  const supabase = window.getSupabase();
  const nextStatus = !currentStatus;
  const { error } = await supabase.from('skills').update({ is_published: nextStatus }).eq('id', id);
  if (error) showToast('Failed: ' + error.message, 'error');
  else {
    showToast(nextStatus ? 'Skill published.' : 'Skill drafted.', 'success');
    loadSkills();
    loadOverviewMetrics();
  }
}

function confirmDeleteSkill(id, name) {
  openConfirmModal('Delete Skill', `Delete skill "${name}"?`, async () => {
    const supabase = window.getSupabase();
    const { error } = await supabase.from('skills').delete().eq('id', id);
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else {
      showToast('Skill deleted.', 'success');
      loadSkills();
      loadOverviewMetrics();
    }
  });
}

/* ==========================================================================
   6. EXPERIENCE CRUD
   ========================================================================== */

let cachedExperience = [];

async function loadExperience() {
  const tbody = document.getElementById('experienceTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-6"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>';

  const supabase = window.getSupabase();
  const { data, error } = await supabase.from('experience').select('*').order('display_order', { ascending: true });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-rose py-6">Error: ${escapeHTML(error.message)}</td></tr>`;
    return;
  }
  cachedExperience = data || [];
  renderExperienceTable(cachedExperience);
}

function renderExperienceTable(list) {
  const tbody = document.getElementById('experienceTableBody');
  tbody.innerHTML = '';
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-6">No experience records found.</td></tr>';
    return;
  }

  list.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHTML(item.role)}</strong></td>
      <td>${escapeHTML(item.company)}</td>
      <td class="mono text-sm">${escapeHTML(item.start_date)} - ${item.is_current ? 'Present' : escapeHTML(item.end_date || '')}</td>
      <td>${item.is_published ? '<span class="badge badge-emerald mono">Published</span>' : '<span class="badge badge-amber mono">Draft</span>'}</td>
      <td class="mono">${item.display_order}</td>
      <td>
        <div class="table-actions">
          <button class="action-btn action-btn--publish" title="Toggle Publish" onclick="toggleExpPublish('${item.id}', ${item.is_published})">
            <i class="fa-solid ${item.is_published ? 'fa-eye-slash' : 'fa-eye'}"></i>
          </button>
          <button class="action-btn" title="Edit" onclick="openEditExperienceModal('${item.id}')">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="action-btn action-btn--delete" title="Delete" onclick="confirmDeleteExp('${item.id}', '${escapeAttr(item.role)}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openCreateExperienceModal() {
  const html = `
    <form id="expForm">
      <div class="form-group">
        <label class="form-label mono">Role / Job Title *</label>
        <input type="text" id="mExpRole" class="form-input" placeholder="Full-Stack Developer Intern" required>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Company / Organization *</label>
          <input type="text" id="mExpCompany" class="form-input" required>
        </div>
        <div class="form-group">
          <label class="form-label mono">Location</label>
          <input type="text" id="mExpLocation" class="form-input" placeholder="Remote / Kerala, India">
        </div>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Start Date *</label>
          <input type="text" id="mExpStart" class="form-input" placeholder="Jan 2024" required>
        </div>
        <div class="form-group">
          <label class="form-label mono">End Date</label>
          <input type="text" id="mExpEnd" class="form-input" placeholder="Present">
        </div>
      </div>
      <div class="form-check mt-2">
        <input type="checkbox" id="mExpCurrent" class="form-check-input">
        <label for="mExpCurrent" class="form-check-label">Currently Working Here</label>
      </div>
      <div class="form-group mt-3">
        <label class="form-label mono">Role Description</label>
        <textarea id="mExpDesc" class="form-input" rows="3"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label mono">Highlights (One per line)</label>
        <textarea id="mExpHighlights" class="form-input" rows="3" placeholder="Engineered REST API endpoints using NestJS&#10;Integrated PostgreSQL database schemas"></textarea>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Display Order</label>
          <input type="number" id="mExpOrder" class="form-input" value="1">
        </div>
        <div class="form-check mt-4">
          <input type="checkbox" id="mExpPublish" class="form-check-input">
          <label for="mExpPublish" class="form-check-label">Publish on portfolio</label>
        </div>
      </div>
    </form>
  `;

  openEditModal('Add Experience Record', html, async () => {
    const role = document.getElementById('mExpRole').value.trim();
    const company = document.getElementById('mExpCompany').value.trim();
    const location = document.getElementById('mExpLocation').value.trim() || null;
    const start_date = document.getElementById('mExpStart').value.trim();
    const end_date = document.getElementById('mExpEnd').value.trim() || null;
    const is_current = document.getElementById('mExpCurrent').checked;
    const description = document.getElementById('mExpDesc').value.trim() || null;
    const highlights = document.getElementById('mExpHighlights').value.split('\n').map(s => s.trim()).filter(Boolean);
    const display_order = parseInt(document.getElementById('mExpOrder').value) || 0;
    const is_published = document.getElementById('mExpPublish').checked;

    if (!role || !company || !start_date) {
      showToast('Role, Company, and Start Date are required.', 'error');
      return false;
    }

    const supabase = window.getSupabase();
    const { error } = await supabase.from('experience').insert([{
      role, company, location, start_date, end_date, is_current, description, highlights, display_order, is_published
    }]);

    if (error) { showToast('Error: ' + error.message, 'error'); return false; }
    showToast('Experience added.', 'success');
    loadExperience();
    loadOverviewMetrics();
    return true;
  });
}

function openEditExperienceModal(id) {
  const item = cachedExperience.find(x => x.id === id);
  if (!item) return;

  const html = `
    <form id="expForm">
      <div class="form-group">
        <label class="form-label mono">Role / Job Title *</label>
        <input type="text" id="mExpRole" class="form-input" value="${escapeAttr(item.role)}" required>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Company / Organization *</label>
          <input type="text" id="mExpCompany" class="form-input" value="${escapeAttr(item.company)}" required>
        </div>
        <div class="form-group">
          <label class="form-label mono">Location</label>
          <input type="text" id="mExpLocation" class="form-input" value="${escapeAttr(item.location || '')}">
        </div>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Start Date *</label>
          <input type="text" id="mExpStart" class="form-input" value="${escapeAttr(item.start_date)}" required>
        </div>
        <div class="form-group">
          <label class="form-label mono">End Date</label>
          <input type="text" id="mExpEnd" class="form-input" value="${escapeAttr(item.end_date || '')}">
        </div>
      </div>
      <div class="form-check mt-2">
        <input type="checkbox" id="mExpCurrent" class="form-check-input" ${item.is_current ? 'checked' : ''}>
        <label for="mExpCurrent" class="form-check-label">Currently Working Here</label>
      </div>
      <div class="form-group mt-3">
        <label class="form-label mono">Role Description</label>
        <textarea id="mExpDesc" class="form-input" rows="3">${escapeHTML(item.description || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label mono">Highlights (One per line)</label>
        <textarea id="mExpHighlights" class="form-input" rows="3">${escapeHTML((item.highlights || []).join('\n'))}</textarea>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Display Order</label>
          <input type="number" id="mExpOrder" class="form-input" value="${item.display_order}">
        </div>
        <div class="form-check mt-4">
          <input type="checkbox" id="mExpPublish" class="form-check-input" ${item.is_published ? 'checked' : ''}>
          <label for="mExpPublish" class="form-check-label">Publish on portfolio</label>
        </div>
      </div>
    </form>
  `;

  openEditModal(`Edit Experience: ${item.role}`, html, async () => {
    const role = document.getElementById('mExpRole').value.trim();
    const company = document.getElementById('mExpCompany').value.trim();
    const location = document.getElementById('mExpLocation').value.trim() || null;
    const start_date = document.getElementById('mExpStart').value.trim();
    const end_date = document.getElementById('mExpEnd').value.trim() || null;
    const is_current = document.getElementById('mExpCurrent').checked;
    const description = document.getElementById('mExpDesc').value.trim() || null;
    const highlights = document.getElementById('mExpHighlights').value.split('\n').map(s => s.trim()).filter(Boolean);
    const display_order = parseInt(document.getElementById('mExpOrder').value) || 0;
    const is_published = document.getElementById('mExpPublish').checked;

    if (!role || !company || !start_date) {
      showToast('Role, Company, and Start Date are required.', 'error');
      return false;
    }

    const supabase = window.getSupabase();
    const { error } = await supabase.from('experience').update({
      role, company, location, start_date, end_date, is_current, description, highlights, display_order, is_published
    }).eq('id', id);

    if (error) { showToast('Update error: ' + error.message, 'error'); return false; }
    showToast('Experience updated.', 'success');
    loadExperience();
    loadOverviewMetrics();
    return true;
  });
}

async function toggleExpPublish(id, currentStatus) {
  const supabase = window.getSupabase();
  const nextStatus = !currentStatus;
  const { error } = await supabase.from('experience').update({ is_published: nextStatus }).eq('id', id);
  if (error) showToast('Failed: ' + error.message, 'error');
  else {
    showToast(nextStatus ? 'Published.' : 'Drafted.', 'success');
    loadExperience();
    loadOverviewMetrics();
  }
}

function confirmDeleteExp(id, role) {
  openConfirmModal('Delete Experience', `Delete role "${role}"?`, async () => {
    const supabase = window.getSupabase();
    const { error } = await supabase.from('experience').delete().eq('id', id);
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else {
      showToast('Experience deleted.', 'success');
      loadExperience();
      loadOverviewMetrics();
    }
  });
}

/* ==========================================================================
   7. EDUCATION & CERTIFICATIONS CRUD
   ========================================================================== */

let cachedEducation = [];
let cachedCerts = [];

async function loadEducation() {
  const tbody = document.getElementById('educationTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-6"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>';
  const supabase = window.getSupabase();
  const { data, error } = await supabase.from('education').select('*').order('display_order', { ascending: true });
  if (error) { tbody.innerHTML = `<tr><td colspan="7" class="text-rose text-center py-6">${escapeHTML(error.message)}</td></tr>`; return; }
  cachedEducation = data || [];
  renderEducationTable(cachedEducation);
}

function renderEducationTable(list) {
  const tbody = document.getElementById('educationTableBody');
  tbody.innerHTML = '';
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="text-muted text-center py-6">No education records found.</td></tr>'; return; }

  list.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHTML(item.degree)}</strong></td>
      <td>${escapeHTML(item.institution)}</td>
      <td class="mono text-sm">${escapeHTML(item.start_date)} - ${escapeHTML(item.end_date || 'Present')}</td>
      <td class="mono">${escapeHTML(item.grade || 'N/A')}</td>
      <td>${item.is_published ? '<span class="badge badge-emerald mono">Published</span>' : '<span class="badge badge-amber mono">Draft</span>'}</td>
      <td class="mono">${item.display_order}</td>
      <td>
        <div class="table-actions">
          <button class="action-btn action-btn--publish" onclick="toggleEduPublish('${item.id}', ${item.is_published})">
            <i class="fa-solid ${item.is_published ? 'fa-eye-slash' : 'fa-eye'}"></i>
          </button>
          <button class="action-btn action-btn--delete" onclick="confirmDeleteEdu('${item.id}', '${escapeAttr(item.degree)}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openCreateEducationModal() {
  const html = `
    <form id="eduForm">
      <div class="form-group">
        <label class="form-label mono">Degree / Qualification *</label>
        <input type="text" id="mEduDegree" class="form-input" placeholder="B.Tech in Computer Science and Engineering" required>
      </div>
      <div class="form-group">
        <label class="form-label mono">Institution / University *</label>
        <input type="text" id="mEduInst" class="form-input" placeholder="APJ Abdul Kalam Technological University" required>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Start Date *</label>
          <input type="text" id="mEduStart" class="form-input" placeholder="2022" required>
        </div>
        <div class="form-group">
          <label class="form-label mono">End Date</label>
          <input type="text" id="mEduEnd" class="form-input" placeholder="2026">
        </div>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Grade / CGPA</label>
          <input type="text" id="mEduGrade" class="form-input" placeholder="CGPA 8.2">
        </div>
        <div class="form-group">
          <label class="form-label mono">Display Order</label>
          <input type="number" id="mEduOrder" class="form-input" value="1">
        </div>
      </div>
      <div class="form-check mt-3">
        <input type="checkbox" id="mEduPublish" class="form-check-input" checked>
        <label for="mEduPublish" class="form-check-label">Publish on portfolio</label>
      </div>
    </form>
  `;

  openEditModal('Add Education', html, async () => {
    const degree = document.getElementById('mEduDegree').value.trim();
    const institution = document.getElementById('mEduInst').value.trim();
    const start_date = document.getElementById('mEduStart').value.trim();
    const end_date = document.getElementById('mEduEnd').value.trim() || null;
    const grade = document.getElementById('mEduGrade').value.trim() || null;
    const display_order = parseInt(document.getElementById('mEduOrder').value) || 0;
    const is_published = document.getElementById('mEduPublish').checked;

    if (!degree || !institution || !start_date) {
      showToast('Degree, Institution, and Start Date are required.', 'error');
      return false;
    }

    const supabase = window.getSupabase();
    const { error } = await supabase.from('education').insert([{
      degree, institution, start_date, end_date, grade, display_order, is_published
    }]);

    if (error) { showToast('Error: ' + error.message, 'error'); return false; }
    showToast('Education record added.', 'success');
    loadEducation();
    loadOverviewMetrics();
    return true;
  });
}

async function toggleEduPublish(id, cur) {
  const supabase = window.getSupabase();
  const next = !cur;
  const { error } = await supabase.from('education').update({ is_published: next }).eq('id', id);
  if (error) showToast('Error: ' + error.message, 'error');
  else { showToast(next ? 'Published.' : 'Drafted.', 'success'); loadEducation(); loadOverviewMetrics(); }
}

function confirmDeleteEdu(id, title) {
  openConfirmModal('Delete Education', `Delete "${title}"?`, async () => {
    const supabase = window.getSupabase();
    const { error } = await supabase.from('education').delete().eq('id', id);
    if (error) showToast('Error: ' + error.message, 'error');
    else { showToast('Deleted.', 'success'); loadEducation(); loadOverviewMetrics(); }
  });
}

// Certifications
async function loadCertifications() {
  const tbody = document.getElementById('certsTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-6"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>';
  const supabase = window.getSupabase();
  const { data, error } = await supabase.from('certifications').select('*').order('display_order', { ascending: true });
  if (error) { tbody.innerHTML = `<tr><td colspan="7" class="text-rose text-center py-6">${escapeHTML(error.message)}</td></tr>`; return; }
  cachedCerts = data || [];
  renderCertsTable(cachedCerts);
}

function renderCertsTable(list) {
  const tbody = document.getElementById('certsTableBody');
  tbody.innerHTML = '';
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="text-muted text-center py-6">No certifications found.</td></tr>'; return; }

  list.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHTML(c.title)}</strong></td>
      <td>${escapeHTML(c.issuer)}</td>
      <td class="mono text-sm">${escapeHTML(c.issue_date || 'N/A')}</td>
      <td class="mono text-sm">${c.credential_url ? `<a href="${escapeAttr(c.credential_url)}" target="_blank" class="link-subtle">View <i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : 'N/A'}</td>
      <td>${c.is_published ? '<span class="badge badge-emerald mono">Published</span>' : '<span class="badge badge-amber mono">Draft</span>'}</td>
      <td class="mono">${c.display_order}</td>
      <td>
        <div class="table-actions">
          <button class="action-btn action-btn--publish" onclick="toggleCertPublish('${c.id}', ${c.is_published})">
            <i class="fa-solid ${c.is_published ? 'fa-eye-slash' : 'fa-eye'}"></i>
          </button>
          <button class="action-btn action-btn--delete" onclick="confirmDeleteCert('${c.id}', '${escapeAttr(c.title)}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openCreateCertModal() {
  const html = `
    <form id="certForm">
      <div class="form-group">
        <label class="form-label mono">Certification Title *</label>
        <input type="text" id="mCertTitle" class="form-input" placeholder="e.g. Meta Front-End Developer" required>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Issuer / Academy *</label>
          <input type="text" id="mCertIssuer" class="form-input" placeholder="Coursera / AWS" required>
        </div>
        <div class="form-group">
          <label class="form-label mono">Issue Date</label>
          <input type="text" id="mCertDate" class="form-input" placeholder="2024">
        </div>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Credential ID</label>
          <input type="text" id="mCertId" class="form-input">
        </div>
        <div class="form-group">
          <label class="form-label mono">Credential Verification URL</label>
          <input type="url" id="mCertUrl" class="form-input" placeholder="https://...">
        </div>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Display Order</label>
          <input type="number" id="mCertOrder" class="form-input" value="1">
        </div>
        <div class="form-check mt-4">
          <input type="checkbox" id="mCertPublish" class="form-check-input" checked>
          <label for="mCertPublish" class="form-check-label">Publish on portfolio</label>
        </div>
      </div>
    </form>
  `;

  openEditModal('Add Certification', html, async () => {
    const title = document.getElementById('mCertTitle').value.trim();
    const issuer = document.getElementById('mCertIssuer').value.trim();
    const issue_date = document.getElementById('mCertDate').value.trim() || null;
    const credential_id = document.getElementById('mCertId').value.trim() || null;
    const credential_url = document.getElementById('mCertUrl').value.trim() || null;
    const display_order = parseInt(document.getElementById('mCertOrder').value) || 0;
    const is_published = document.getElementById('mCertPublish').checked;

    if (!title || !issuer) {
      showToast('Title and Issuer are required.', 'error');
      return false;
    }

    const supabase = window.getSupabase();
    const { error } = await supabase.from('certifications').insert([{
      title, issuer, issue_date, credential_id, credential_url, display_order, is_published
    }]);

    if (error) { showToast('Error: ' + error.message, 'error'); return false; }
    showToast('Certification added.', 'success');
    loadCertifications();
    loadOverviewMetrics();
    return true;
  });
}

async function toggleCertPublish(id, cur) {
  const supabase = window.getSupabase();
  const next = !cur;
  const { error } = await supabase.from('certifications').update({ is_published: next }).eq('id', id);
  if (error) showToast('Error: ' + error.message, 'error');
  else { showToast(next ? 'Published.' : 'Drafted.', 'success'); loadCertifications(); loadOverviewMetrics(); }
}

function confirmDeleteCert(id, title) {
  openConfirmModal('Delete Certification', `Delete "${title}"?`, async () => {
    const supabase = window.getSupabase();
    const { error } = await supabase.from('certifications').delete().eq('id', id);
    if (error) showToast('Error: ' + error.message, 'error');
    else { showToast('Deleted.', 'success'); loadCertifications(); loadOverviewMetrics(); }
  });
}

/* ==========================================================================
   8. PROFILES (PUBLIC MARKETING & PRIVATE ADMIN)
   ========================================================================== */

let existingPublicProfileId = null;
let existingPrivateProfileId = null;

async function loadProfiles() {
  const supabase = window.getSupabase();
  if (!supabase) return;

  // A. Public Profile
  try {
    const { data: pubData } = await supabase.from('public_profiles').select('*').limit(1).maybeSingle();
    if (pubData) {
      existingPublicProfileId = pubData.id;
      document.getElementById('profFullName').value = pubData.full_name || '';
      document.getElementById('profHeadline').value = pubData.headline || '';
      document.getElementById('profLocation').value = pubData.location || '';
      document.getElementById('profAvatarUrl').value = pubData.avatar_url || '';
      document.getElementById('profBio').value = pubData.bio || '';
      document.getElementById('profSocialLinks').value = JSON.stringify(pubData.social_links || {}, null, 2);
      document.getElementById('profIsPublished').checked = !!pubData.is_published;

      const badge = document.getElementById('publicProfileBadge');
      if (pubData.is_published) {
        badge.className = 'badge badge-emerald mono';
        badge.textContent = 'Published';
      } else {
        badge.className = 'badge badge-amber mono';
        badge.textContent = 'Draft';
      }
    }
  } catch (err) {
    console.warn('Error loading public profile:', err);
  }

  // B. Private Profile (Admin Only)
  try {
    const { data: privData } = await supabase.from('admin_profile_private').select('*').limit(1).maybeSingle();
    if (privData) {
      existingPrivateProfileId = privData.id;
      document.getElementById('privEmail').value = privData.email || '';
      document.getElementById('privPhone').value = privData.phone || '';
      document.getElementById('privAddress').value = privData.address || '';
      document.getElementById('privNotes').value = privData.notes || '';
    } else {
      document.getElementById('privEmail').value = activeAdminSession?.user?.email || '';
    }
  } catch (err) {
    console.warn('Error loading private profile:', err);
  }
}

async function savePublicProfile(e) {
  e.preventDefault();
  const supabase = window.getSupabase();
  const full_name = document.getElementById('profFullName').value.trim();
  const headline = document.getElementById('profHeadline').value.trim();
  const location = document.getElementById('profLocation').value.trim();
  const avatar_url = document.getElementById('profAvatarUrl').value.trim() || null;
  const bio = document.getElementById('profBio').value.trim();
  const is_published = document.getElementById('profIsPublished').checked;

  let social_links = {};
  try {
    const raw = document.getElementById('profSocialLinks').value.trim();
    if (raw) social_links = JSON.parse(raw);
  } catch (err) {
    showToast('Social Links must be valid JSON: ' + err.message, 'error');
    return;
  }

  const payload = { full_name, headline, location, avatar_url, bio, social_links, is_published };

  let error = null;
  if (existingPublicProfileId) {
    const res = await supabase.from('public_profiles').update(payload).eq('id', existingPublicProfileId);
    error = res.error;
  } else {
    const res = await supabase.from('public_profiles').insert([payload]).select().single();
    if (!res.error && res.data) existingPublicProfileId = res.data.id;
    error = res.error;
  }

  if (error) {
    showToast('Failed to save public profile: ' + error.message, 'error');
  } else {
    showToast('Public profile updated successfully.', 'success');
    loadProfiles();
  }
}

async function savePrivateProfile(e) {
  e.preventDefault();
  const supabase = window.getSupabase();
  const email = document.getElementById('privEmail').value.trim();
  const phone = document.getElementById('privPhone').value.trim() || null;
  const address = document.getElementById('privAddress').value.trim() || null;
  const notes = document.getElementById('privNotes').value.trim() || null;

  const payload = { email, phone, address, notes };

  let error = null;
  if (existingPrivateProfileId) {
    const res = await supabase.from('admin_profile_private').update(payload).eq('id', existingPrivateProfileId);
    error = res.error;
  } else {
    const res = await supabase.from('admin_profile_private').insert([payload]).select().single();
    if (!res.error && res.data) existingPrivateProfileId = res.data.id;
    error = res.error;
  }

  if (error) {
    showToast('Failed to save private records: ' + error.message, 'error');
  } else {
    showToast('Private records saved securely (protected by RLS).', 'success');
    loadProfiles();
  }
}

/* ==========================================================================
   9. MEDIA STORAGE (portfolio-media)
   ========================================================================== */

async function handleFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  // Strict MIME Type validation (No SVG, raster only)
  const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMime.includes(file.type)) {
    showToast('Forbidden File Type: Only JPEG, PNG, and WEBP images are permitted. SVG is rejected for security.', 'error');
    e.target.value = '';
    return;
  }

  // 5 MB size limit
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    showToast('File Too Large: Maximum allowed file size is 5 MB.', 'error');
    e.target.value = '';
    return;
  }

  const supabase = window.getSupabase();
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `uploads/${Date.now()}_${cleanName}`;

  const progressWrap = document.getElementById('uploadProgressContainer');
  const progressBar = document.getElementById('uploadProgressBar');
  const statusText = document.getElementById('uploadStatusText');

  progressWrap.style.display = 'block';
  progressBar.style.width = '30%';
  statusText.textContent = `Uploading ${file.name}...`;

  try {
    const { data, error } = await supabase.storage
      .from('portfolio-media')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    progressBar.style.width = '100%';

    if (error) {
      showToast('Upload failed: ' + error.message, 'error');
      statusText.textContent = 'Upload failed.';
    } else {
      const { data: pubData } = supabase.storage.from('portfolio-media').getPublicUrl(filePath);
      showToast('Media uploaded to portfolio-media!', 'success');
      statusText.textContent = 'Uploaded successfully!';
      loadMediaGallery();
      loadOverviewMetrics();
    }
  } catch (err) {
    showToast('Upload exception: ' + err.message, 'error');
    statusText.textContent = 'Upload error.';
  } finally {
    e.target.value = '';
    setTimeout(() => {
      progressWrap.style.display = 'none';
      progressBar.style.width = '0%';
    }, 2000);
  }
}

async function loadMediaGallery() {
  const gallery = document.getElementById('mediaGalleryGrid');
  gallery.innerHTML = '<p class="text-muted text-center py-6" style="grid-column: 1 / -1;"><i class="fa-solid fa-spinner fa-spin"></i> Loading assets...</p>';

  const supabase = window.getSupabase();
  const { data, error } = await supabase.storage.from('portfolio-media').list('uploads', {
    limit: 100,
    offset: 0,
    sortBy: { column: 'created_at', order: 'desc' }
  });

  if (error) {
    gallery.innerHTML = `<p class="text-rose text-center py-6" style="grid-column: 1 / -1;">Error: ${escapeHTML(error.message)}</p>`;
    return;
  }

  gallery.innerHTML = '';
  if (!data || !data.length) {
    gallery.innerHTML = '<p class="text-muted text-center py-6" style="grid-column: 1 / -1;">No media files uploaded yet in "uploads" folder.</p>';
    return;
  }

  data.forEach(item => {
    if (item.name === '.emptyFolderPlaceholder') return;
    const { data: pubData } = supabase.storage.from('portfolio-media').getPublicUrl(`uploads/${item.name}`);
    const publicUrl = pubData.publicUrl;
    const sizeKB = Math.round((item.metadata?.size || 0) / 1024);

    const div = document.createElement('div');
    div.className = 'media-item';
    div.innerHTML = `
      <div class="media-thumb-wrap">
        <img src="${publicUrl}" alt="${escapeAttr(item.name)}" class="media-thumb" loading="lazy">
      </div>
      <div class="media-meta">
        <span class="media-name" title="${escapeAttr(item.name)}">${escapeHTML(item.name)}</span>
        <div class="media-actions">
          <span class="mono text-muted text-sm">${sizeKB > 0 ? sizeKB + ' KB' : ''}</span>
          <div>
            <button class="action-btn" title="Copy Public URL" onclick="copyMediaUrl('${escapeAttr(publicUrl)}')">
              <i class="fa-solid fa-link"></i>
            </button>
            <button class="action-btn action-btn--delete" title="Delete File" onclick="confirmDeleteMedia('${escapeAttr(item.name)}')">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `;
    gallery.appendChild(div);
  });
}

function copyMediaUrl(url) {
  navigator.clipboard.writeText(url).then(() => {
    showToast('Public CDN URL copied to clipboard!', 'info');
  });
}

function confirmDeleteMedia(fileName) {
  openConfirmModal('Delete Media Asset', `Permanently delete "${fileName}" from portfolio-media?`, async () => {
    const supabase = window.getSupabase();
    const { error } = await supabase.storage.from('portfolio-media').remove([`uploads/${fileName}`]);
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else {
      showToast('Media asset deleted.', 'success');
      loadMediaGallery();
      loadOverviewMetrics();
    }
  });
}

/* ==========================================================================
   10. SEED / IMPORT INITIAL CONTENT
   ========================================================================== */

async function promptImportStaticContent() {
  openConfirmModal(
    'Import & Synchronize All Portfolio Content',
    'This will import all 8 verified projects, 22 technical skills, work experience, 3 academic qualifications, 3 certifications, and verified profile records into Supabase. Existing records will be safely preserved without duplicates. Proceed?',
    async () => {
      const supabase = window.getSupabase();
      if (!supabase) return;

      // 1. Projects (All 8 verified portfolio systems from index.html)
      const initialProjects = [
        {
          title: 'HospitalOS + PharmacyERP',
          category: 'fullstack',
          description: 'Integrated clinical operations and pharmacy inventory platform featuring patient record tracking, medication dispensing with FEFO stock rotation, and dual web and desktop clients.',
          tags: ['NestJS', 'React', 'TypeScript', 'Prisma', 'PostgreSQL', 'Docker', 'C#'],
          github_url: 'https://github.com/Shahinshac/HospitalOs',
          live_url: null,
          display_order: 1,
          is_published: true
        },
        {
          title: 'Restaurant Billing & Real-Time POS',
          category: 'realtime',
          description: 'A food-service management system designed to accelerate table turnover, push waitstaff orders instantly to kitchen display stations, and streamline customer bill settlement with integrated digital payments.',
          tags: ['Next.js', 'Node.js', 'Express', 'Socket.io', 'Prisma', 'PostgreSQL', 'Razorpay'],
          github_url: 'https://github.com/Shahinshac/restaurant-billing',
          live_url: 'https://26-07billing.vercel.app/',
          display_order: 2,
          is_published: true
        },
        {
          title: 'Core Banking System (CBS)',
          category: 'backend',
          description: 'A core financial management engine simulating retail banking workflows, credit assessment schedules, and transactional ledger accounting with strict audit logging.',
          tags: ['React', 'TypeScript', 'Python Flask', 'Flask-SQLAlchemy', 'PostgreSQL', 'JWT'],
          github_url: 'https://github.com/Shahinshac/CBS',
          live_url: 'https://shaahn.vercel.app/',
          display_order: 3,
          is_published: true
        },
        {
          title: 'CoreERP Enterprise Suite',
          category: 'erp',
          description: 'Centralized enterprise resource planning platform integrating multi-department employee directories, warehouse inventory dispatch, and financial audit logs into a unified dashboard.',
          tags: ['React', 'TypeScript', 'Node.js', 'Express', 'PostgreSQL', 'Prisma'],
          github_url: 'https://github.com/Shahinshac/CoreERP',
          live_url: 'https://core-erpp.vercel.app/',
          display_order: 4,
          is_published: true
        },
        {
          title: 'Expense Tracker & Financial Analytics',
          category: 'fullstack',
          description: 'Interactive personal finance application monitoring expenditures, category budget thresholds, and spending analytics via real-time Chart.js visual graphs.',
          tags: ['React', 'TypeScript', 'Vite', 'Node.js', 'PostgreSQL', 'Chart.js'],
          github_url: 'https://github.com/Shahinshac/Expense-Tracker',
          live_url: 'https://expensfi.vercel.app/',
          display_order: 5,
          is_published: true
        },
        {
          title: 'Yumm (Nex-Food) Ordering Platform',
          category: 'fullstack',
          description: 'Modern food ordering platform featuring restaurant menus, dynamic multi-item cart calculations, persistent checkout flows, and responsive mobile-first UI.',
          tags: ['Next.js', 'TypeScript', 'Node.js', 'PostgreSQL', 'TailwindCSS'],
          github_url: 'https://github.com/Shahinshac/Yumm',
          live_url: 'https://nex-food.vercel.app',
          display_order: 6,
          is_published: true
        },
        {
          title: 'AI Resume Screening & Ranking',
          category: 'python',
          description: 'Recruitment intelligence tool parsing candidate resumes from PDFs, tokenizing skills, and ranking applicants against job descriptions using TF-IDF and cosine similarity.',
          tags: ['Python', 'Flask', 'NLP', 'scikit-learn', 'PyPDF2', 'Pandas'],
          github_url: 'https://github.com/Shahinshac/AI-Resume-screening',
          live_url: null,
          display_order: 7,
          is_published: true
        },
        {
          title: 'Company Management System',
          category: 'fullstack',
          description: 'Corporate hierarchy and employee operations portal featuring organizational department tree navigation, role-based access audits, and leave request tracking.',
          tags: ['JavaScript', 'React', 'Node.js', 'Express', 'MongoDB'],
          github_url: 'https://github.com/Shahinshac/company-management-system',
          live_url: 'https://company-managament.vercel.app/login.html',
          display_order: 8,
          is_published: true
        }
      ];

      const { data: existingProjects } = await supabase.from('projects').select('title');
      const existingTitles = new Set((existingProjects || []).map(p => p.title.toLowerCase()));
      const projsToInsert = initialProjects.filter(p => !existingTitles.has(p.title.toLowerCase()));
      if (projsToInsert.length > 0) {
        await supabase.from('projects').insert(projsToInsert);
      }

      // 2. Skills (22 verified core skills)
      const initialSkills = [
        { name: 'JavaScript (ES6+)', category: 'Languages', proficiency: 95, icon_class: 'fa-brands fa-js', display_order: 1, is_published: true },
        { name: 'TypeScript', category: 'Languages', proficiency: 90, icon_class: 'fa-brands fa-js', display_order: 2, is_published: true },
        { name: 'Python', category: 'Languages', proficiency: 85, icon_class: 'fa-brands fa-python', display_order: 3, is_published: true },
        { name: 'Java', category: 'Languages', proficiency: 75, icon_class: 'fa-brands fa-java', display_order: 4, is_published: true },
        { name: 'C#', category: 'Languages', proficiency: 72, icon_class: 'fa-solid fa-code', display_order: 5, is_published: true },
        { name: 'React', category: 'Frontend', proficiency: 94, icon_class: 'fa-brands fa-react', display_order: 1, is_published: true },
        { name: 'Next.js', category: 'Frontend', proficiency: 90, icon_class: 'fa-solid fa-n', display_order: 2, is_published: true },
        { name: 'HTML5 / Modern CSS', category: 'Frontend', proficiency: 96, icon_class: 'fa-brands fa-html5', display_order: 3, is_published: true },
        { name: 'Vite', category: 'Frontend', proficiency: 88, icon_class: 'fa-solid fa-bolt', display_order: 4, is_published: true },
        { name: 'Tailwind CSS', category: 'Frontend', proficiency: 86, icon_class: 'fa-solid fa-wind', display_order: 5, is_published: true },
        { name: 'NestJS', category: 'Backend', proficiency: 90, icon_class: 'fa-solid fa-server', display_order: 1, is_published: true },
        { name: 'Node.js & Express', category: 'Backend', proficiency: 92, icon_class: 'fa-brands fa-node-js', display_order: 2, is_published: true },
        { name: 'Python & Flask', category: 'Backend', proficiency: 85, icon_class: 'fa-brands fa-python', display_order: 3, is_published: true },
        { name: 'REST APIs', category: 'Backend', proficiency: 92, icon_class: 'fa-solid fa-network-wired', display_order: 4, is_published: true },
        { name: 'WebSockets', category: 'Backend', proficiency: 86, icon_class: 'fa-solid fa-bolt-lightning', display_order: 5, is_published: true },
        { name: 'PostgreSQL', category: 'Databases', proficiency: 90, icon_class: 'fa-solid fa-database', display_order: 1, is_published: true },
        { name: 'Prisma ORM', category: 'Databases', proficiency: 88, icon_class: 'fa-solid fa-database', display_order: 2, is_published: true },
        { name: 'MongoDB', category: 'Databases', proficiency: 84, icon_class: 'fa-solid fa-leaf', display_order: 3, is_published: true },
        { name: 'Flask-SQLAlchemy', category: 'Databases', proficiency: 82, icon_class: 'fa-solid fa-database', display_order: 4, is_published: true },
        { name: 'Docker & Containers', category: 'Cloud & DevOps', proficiency: 82, icon_class: 'fa-brands fa-docker', display_order: 1, is_published: true },
        { name: 'Git & GitHub Actions', category: 'Cloud & DevOps', proficiency: 88, icon_class: 'fa-brands fa-git-alt', display_order: 2, is_published: true },
        { name: 'Linux & Bash', category: 'Cloud & DevOps', proficiency: 80, icon_class: 'fa-brands fa-linux', display_order: 3, is_published: true }
      ];

      const { data: existingSkills } = await supabase.from('skills').select('name');
      const existingSkillNames = new Set((existingSkills || []).map(s => s.name.toLowerCase()));
      const skillsToInsert = initialSkills.filter(s => !existingSkillNames.has(s.name.toLowerCase()));
      if (skillsToInsert.length > 0) {
        await supabase.from('skills').insert(skillsToInsert);
      }

      // 3. Experience
      const initialExperience = [
        {
          role: 'Front-End Web Development Intern',
          company: 'CoreMicron Enterprises LLP',
          location: 'Kottakkal, Kerala, India',
          start_date: 'June 2026',
          end_date: 'June 2026',
          is_current: false,
          description: 'Completed Front-End Web Development Internship gaining practical experience in developing responsive, user-friendly web pages and ERP invoice modules.',
          highlights: [
            'Developed responsive and user-friendly web pages using HTML, CSS, Bootstrap, and JavaScript',
            'Contributed to ERP invoice module development and web application customization',
            'Implemented interactive UI components and client-side form verification'
          ],
          display_order: 1,
          is_published: true
        }
      ];
      const { data: existingExp } = await supabase.from('experience').select('role, company');
      const expSet = new Set((existingExp || []).map(e => `${e.role}:::${e.company}`.toLowerCase()));
      const expToInsert = initialExperience.filter(e => !expSet.has(`${e.role}:::${e.company}`.toLowerCase()));
      if (expToInsert.length > 0) {
        await supabase.from('experience').insert(expToInsert);
      }

      // 4. Education
      const initialEducation = [
        {
          institution: 'MEA Engineering College, Malappuram (APJ Abdul Kalam Technological University)',
          degree: 'B.Tech in Computer Science & Engineering',
          field_of_study: 'Computer Science and Engineering',
          start_date: '2024',
          end_date: 'Present',
          grade: 'Currently pursuing third year',
          display_order: 1,
          is_published: true
        },
        {
          institution: 'GHSS Kadungapuram, Malappuram, Kerala',
          degree: 'Higher Secondary Education',
          field_of_study: 'Biology Science & Computer Science',
          start_date: '2022',
          end_date: '2024',
          grade: 'Higher Secondary',
          display_order: 2,
          is_published: true
        },
        {
          institution: 'GHSS Kadungapuram, Kerala',
          degree: 'Secondary School Leaving Certificate (SSLC)',
          field_of_study: 'Science & Mathematics',
          start_date: '2021',
          end_date: '2022',
          grade: 'SSLC',
          display_order: 3,
          is_published: true
        }
      ];
      const { data: existingEdu } = await supabase.from('education').select('degree');
      const eduSet = new Set((existingEdu || []).map(e => e.degree.toLowerCase()));
      const eduToInsert = initialEducation.filter(e => !eduSet.has(e.degree.toLowerCase()));
      if (eduToInsert.length > 0) {
        await supabase.from('education').insert(eduToInsert);
      }

      // 5. Certifications
      const initialCerts = [
        {
          title: 'Digital 101 – 30 Hours',
          issuer: 'FutureSkills Prime – NASSCOM',
          issue_date: 'May 2025',
          credential_id: null,
          credential_url: null,
          display_order: 1,
          is_published: true
        },
        {
          title: 'Certificate Course in Cyber Awareness AI Basic',
          issuer: 'NIIT Foundation – Cyber Suraksha Plus Program',
          issue_date: 'August 2026',
          credential_id: null,
          credential_url: null,
          display_order: 2,
          is_published: true
        },
        {
          title: 'Foundations of AI: Principles, Applications, and Future Trends',
          issuer: 'Additional Skill Acquisition Programme (ASAP Kerala) & 360DigiTMG',
          issue_date: '2025',
          credential_id: null,
          credential_url: null,
          display_order: 3,
          is_published: true
        }
      ];
      const { data: existingCerts } = await supabase.from('certifications').select('title');
      const certSet = new Set((existingCerts || []).map(c => c.title.toLowerCase()));
      const certsToInsert = initialCerts.filter(c => !certSet.has(c.title.toLowerCase()));
      if (certsToInsert.length > 0) {
        await supabase.from('certifications').insert(certsToInsert);
      }

      // 6. Public Profile
      const { data: existingProfile } = await supabase.from('public_profiles').select('id').limit(1).maybeSingle();
      if (!existingProfile) {
        await supabase.from('public_profiles').insert([{
          full_name: 'Shahin Sha Chakkingathodi',
          headline: 'Full-Stack Developer & CS Engineering Student',
          bio: 'Self-motivated B.Tech Computer Science and Engineering student at MEA Engineering College, Malappuram. Passionate about developing practical and user-friendly software solutions with an interest in full-stack development, front-end development, and backend systems. Currently expanding into Cloud & DevOps.',
          location: 'Malappuram, Kerala, India',
          avatar_url: 'images/avatar.jpg',
          social_links: {
            github: 'https://github.com/Shahinshac',
            linkedin: 'https://www.linkedin.com/in/shahinshac',
            twitter: 'https://x.com/shaahn_c',
            instagram: 'https://instagram.com/shaahn_c'
          },
          is_published: true
        }]);
      }

      // 7. Private Admin Profile
      const { data: existingPrivate } = await supabase.from('admin_profile_private').select('id').limit(1).maybeSingle();
      if (!existingPrivate) {
        await supabase.from('admin_profile_private').insert([{
          email: 'shahin.c.sha@gmail.com',
          phone: '+917594012761',
          address: 'Malappuram, Kerala, India',
          notes: 'Primary administrator account for portfolio CMS management.'
        }]);
      }

      showToast(`Synchronized ${projsToInsert.length} projects, ${skillsToInsert.length} skills, ${eduToInsert.length} education, and ${certsToInsert.length} certs!`, 'success');
      loadOverviewMetrics();
      loadSectionData(currentSection);
    }
  );
}

/* ==========================================================================
   11. MODAL & TOAST UTILITIES
   ========================================================================== */

function openConfirmModal(title, message, onConfirm) {
  document.getElementById('confirmTitle').innerHTML = `<i class="fa-solid fa-triangle-exclamation text-amber"></i> ${escapeHTML(title)}`;
  document.getElementById('confirmMessage').textContent = message;
  pendingConfirmAction = onConfirm;
  document.getElementById('confirmModal').style.display = 'flex';

  const actionBtn = document.getElementById('confirmActionBtn');
  actionBtn.onclick = async () => {
    if (pendingConfirmAction) {
      await pendingConfirmAction();
    }
    closeConfirmModal();
  };
}

function closeConfirmModal() {
  document.getElementById('confirmModal').style.display = 'none';
  pendingConfirmAction = null;
}

function openEditModal(title, bodyHTML, onSave) {
  document.getElementById('editModalTitle').textContent = title;
  document.getElementById('editModalBody').innerHTML = bodyHTML;
  pendingEditSaveAction = onSave;
  document.getElementById('editModal').style.display = 'flex';

  const saveBtn = document.getElementById('editModalSaveBtn');
  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    try {
      const success = await pendingEditSaveAction();
      if (success !== false) {
        closeEditModal();
      }
    } catch (err) {
      showToast('Action failed: ' + err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
    }
  };
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
  pendingEditSaveAction = null;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const iconMap = {
    success: 'fa-solid fa-circle-check',
    error: 'fa-solid fa-circle-xmark',
    info: 'fa-solid fa-circle-info'
  };

  toast.innerHTML = `
    <i class="${iconMap[type] || iconMap.info}"></i>
    <span>${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
