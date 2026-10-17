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
      supabase.from('projects').select('id, title, is_published'),
      supabase.from('skills').select('id, name, is_published'),
      supabase.from('experience').select('id, role, company, is_published'),
      supabase.from('education').select('id, degree, institution, is_published'),
      supabase.from('certifications').select('id, title, is_published'),
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

    // Detect actual duplicate records across collections
    const projTitles = new Set();
    let dupProjCount = 0;
    projs.forEach(p => {
      const k = (p.title || '').trim().toLowerCase();
      if (k) {
        if (projTitles.has(k)) dupProjCount++;
        else projTitles.add(k);
      }
    });

    const skillNames = new Set();
    let dupSkillCount = 0;
    skills.forEach(s => {
      const k = (s.name || '').trim().toLowerCase();
      if (k) {
        if (skillNames.has(k)) dupSkillCount++;
        else skillNames.add(k);
      }
    });

    const expRoles = new Set();
    let dupExpCount = 0;
    exp.forEach(e => {
      const k = `${(e.role || '').trim()}:::${(e.company || '').trim()}`.toLowerCase();
      if (k !== ':::') {
        if (expRoles.has(k)) dupExpCount++;
        else expRoles.add(k);
      }
    });

    const eduDegs = new Set();
    let dupEduCount = 0;
    edu.forEach(ed => {
      const k = `${(ed.degree || '').trim()}:::${(ed.institution || '').trim()}`.toLowerCase();
      if (k !== ':::') {
        if (eduDegs.has(k)) dupEduCount++;
        else eduDegs.add(k);
      }
    });

    const certTitles = new Set();
    let dupCertCount = 0;
    certs.forEach(c => {
      const k = (c.title || '').trim().toLowerCase();
      if (k) {
        if (certTitles.has(k)) dupCertCount++;
        else certTitles.add(k);
      }
    });

    const totalDups = dupProjCount + dupSkillCount + dupExpCount + dupEduCount + dupCertCount;
    const dupBtn = document.getElementById('btnCleanupDups');
    const dupBadge = document.getElementById('dupCountBadge');
    if (dupBtn) {
      if (totalDups > 0) {
        if (dupBadge) {
          dupBadge.textContent = ` (${totalDups})`;
          dupBadge.style.display = 'inline';
        }
        dupBtn.style.display = 'inline-flex';
      } else {
        if (dupBadge) {
          dupBadge.textContent = '';
          dupBadge.style.display = 'none';
        }
        dupBtn.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Error loading metrics:', err);
  }
}

/* ==========================================================================
   3B. UNIVERSAL IMAGE UPLOAD & MEDIA PICKER HELPERS
   ========================================================================== */

let activePickerCallback = null;

async function uploadMediaFile(file, folder = 'uploads') {
  if (!file) throw new Error('No file selected.');

  const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMime.includes(file.type)) {
    throw new Error('Forbidden file type: Only JPEG, PNG, and WebP images are permitted. SVG rejected.');
  }

  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('File too large: Maximum allowed file size is 5 MB.');
  }

  const supabase = window.getSupabase();
  if (!supabase) throw new Error('Supabase client unavailable.');

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${folder}/${Date.now()}_${cleanName}`;

  const { data, error } = await supabase.storage
    .from('portfolio-media')
    .upload(filePath, file, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data: pubData } = supabase.storage.from('portfolio-media').getPublicUrl(filePath);
  return {
    path: filePath,
    publicUrl: pubData.publicUrl
  };
}

function openMediaPicker(onSelect) {
  activePickerCallback = onSelect;
  document.getElementById('mediaPickerModal').style.display = 'flex';
  loadPickerGallery();
}

function openMediaPickerForTarget(urlInputId, previewImgId, placeholderId) {
  openMediaPicker((url) => {
    const input = document.getElementById(urlInputId);
    if (input) input.value = url;
    if (previewImgId) {
      const img = document.getElementById(previewImgId);
      if (img) {
        img.src = url;
        img.style.display = 'block';
      }
    }
    if (placeholderId) {
      const ph = document.getElementById(placeholderId);
      if (ph) ph.style.display = 'none';
    }
  });
}

function closeMediaPicker() {
  document.getElementById('mediaPickerModal').style.display = 'none';
  activePickerCallback = null;
}

async function loadPickerGallery() {
  const grid = document.getElementById('mediaPickerGrid');
  grid.innerHTML = '<p class="text-muted text-center py-6" style="grid-column: 1 / -1;"><i class="fa-solid fa-spinner fa-spin"></i> Loading assets...</p>';

  const supabase = window.getSupabase();
  if (!supabase) {
    grid.innerHTML = '<p class="text-rose text-center py-6" style="grid-column: 1 / -1;">Supabase offline</p>';
    return;
  }

  try {
    const { data, error } = await supabase.storage.from('portfolio-media').list('uploads', {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' }
    });

    if (error) throw error;

    grid.innerHTML = '';
    const files = (data || []).filter(item => item.name !== '.emptyFolderPlaceholder');
    if (!files.length) {
      grid.innerHTML = '<p class="text-muted text-center py-6" style="grid-column: 1 / -1;">No media files found in bucket. Upload one above!</p>';
      return;
    }

    files.forEach(item => {
      const { data: pubData } = supabase.storage.from('portfolio-media').getPublicUrl(`uploads/${item.name}`);
      const publicUrl = pubData.publicUrl;

      const card = document.createElement('div');
      card.className = 'media-picker-item';
      card.title = `Click to select ${item.name}`;
      card.innerHTML = `
        <img src="${publicUrl}" alt="${escapeAttr(item.name)}" class="media-picker-thumb" loading="lazy">
        <span class="media-picker-name mono">${escapeHTML(item.name)}</span>
      `;
      card.onclick = () => {
        if (activePickerCallback) {
          activePickerCallback(publicUrl);
        }
        closeMediaPicker();
        showToast('Media asset selected!', 'success');
      };
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<p class="text-rose text-center py-6" style="grid-column: 1 / -1;">Error: ${escapeHTML(err.message)}</p>`;
  }
}

async function handlePickerFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const pWrap = document.getElementById('mediaPickerProgress');
  const pBar = document.getElementById('mediaPickerProgressBar');
  const pStatus = document.getElementById('mediaPickerStatus');

  pWrap.style.display = 'block';
  pBar.style.width = '30%';
  pStatus.textContent = `Uploading ${file.name}...`;

  try {
    const res = await uploadMediaFile(file, 'uploads');
    pBar.style.width = '100%';
    pStatus.textContent = 'Uploaded successfully!';
    showToast('File uploaded to portfolio-media!', 'success');
    if (activePickerCallback) {
      activePickerCallback(res.publicUrl);
      closeMediaPicker();
    } else {
      loadPickerGallery();
    }
  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error');
    pStatus.textContent = 'Upload failed: ' + err.message;
  } finally {
    e.target.value = '';
    setTimeout(() => {
      pWrap.style.display = 'none';
      pBar.style.width = '0%';
    }, 1500);
  }
}

async function handleModalImageUpload(e, urlInputId, previewId, placeholderId, progressWrapId, progressBarId, statusId, folder) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const pWrap = document.getElementById(progressWrapId);
  const pBar = document.getElementById(progressBarId);
  const pStatus = document.getElementById(statusId);

  if (pWrap) pWrap.style.display = 'block';
  if (pBar) pBar.style.width = '35%';
  if (pStatus) pStatus.textContent = `Uploading ${file.name}...`;

  try {
    const res = await uploadMediaFile(file, folder || 'uploads');
    if (pBar) pBar.style.width = '100%';
    if (pStatus) pStatus.textContent = 'Upload complete!';

    const urlInput = document.getElementById(urlInputId);
    if (urlInput) urlInput.value = res.publicUrl;

    const img = document.getElementById(previewId);
    const ph = document.getElementById(placeholderId);
    if (img) {
      img.src = res.publicUrl;
      img.style.display = 'block';
    }
    if (ph) ph.style.display = 'none';

    showToast('Photo uploaded successfully! Save changes to record.', 'success');
  } catch (err) {
    showToast('Image upload failed: ' + err.message, 'error');
    if (pStatus) pStatus.textContent = 'Upload failed: ' + err.message;
  } finally {
    e.target.value = '';
    setTimeout(() => {
      if (pWrap) pWrap.style.display = 'none';
      if (pBar) pBar.style.width = '0%';
    }, 2000);
  }
}

function clearModalImageWidget(urlInputId, previewId, placeholderId) {
  const urlInput = document.getElementById(urlInputId);
  if (urlInput) urlInput.value = '';

  const img = document.getElementById(previewId);
  const ph = document.getElementById(placeholderId);
  if (img) {
    img.src = '';
    img.style.display = 'none';
  }
  if (ph) ph.style.display = 'flex';
  showToast('Image removed. Click Save to apply.', 'info');
}

function updateImageWidgetFromInput(urlInputId, previewId, placeholderId) {
  const urlInput = document.getElementById(urlInputId);
  const img = document.getElementById(previewId);
  const ph = document.getElementById(placeholderId);
  const val = urlInput ? urlInput.value.trim() : '';

  if (val) {
    if (img) {
      img.src = val;
      img.style.display = 'block';
    }
    if (ph) ph.style.display = 'none';
  } else {
    if (img) {
      img.src = '';
      img.style.display = 'none';
    }
    if (ph) ph.style.display = 'flex';
  }
}

/* ==========================================================================
   4. PROJECTS CRUD WITH RICH SPECS & PHOTO EDITING
   ========================================================================== */

const baselineSpecs = {
  'HospitalOS + PharmacyERP': {
    engineeringFocus: 'Healthcare workflow + inventory integration',
    authRequired: false,
    overview: 'HospitalOS + PharmacyERP unifies clinical records management with pharmacy inventory control to eliminate medication expiration waste and streamline hospital administrative coordination.',
    problem: 'Traditional clinic systems struggle with disconnected pharmacy inventory, leading to expired medication dispensation, stockouts, and disorganized medical record sharing between physicians and dispensaries.',
    solution: 'Engineered a centralized PostgreSQL relational database accessed through NestJS REST APIs with Prisma ORM. Paired with a responsive React doctor console and a native C# client for rapid pharmacy dispensing with FEFO stock rotation.',
    challenge: 'Synchronizing dual web and C# desktop client requests with atomic transactional locks to prevent duplicate stock dispenses during peak patient hours.',
    impact: 'Eliminated expired stock dispensing risk, reduced prescription fulfillment time by 45%, and unified records for multi-department clinics.',
    architecture: 'NestJS backend services containerized with Docker, PostgreSQL relational schema, React web interface, and native C# client communicating over secured REST endpoints.',
    keyFeatures: [
      'Clinical patient records management & outpatient appointment scheduling',
      'Pharmacy dispensing with automated First-Expired-First-Out (FEFO) stock rotation',
      'Role-based access control (RBAC) separating doctors, nurses, and pharmacists',
      'Relational data modeling with PostgreSQL and type-safe Prisma ORM',
      'C# Windows desktop module communicating via secured REST endpoints'
    ]
  },
  'Restaurant Billing & Real-Time POS': {
    engineeringFocus: 'Real-time order synchronization',
    authRequired: true,
    overview: 'A food-service management system designed to accelerate table turnover, push waitstaff orders instantly to kitchen display stations, and streamline customer bill settlement with integrated digital payments.',
    problem: 'Order discrepancies and delays happen frequently when waitstaff paper slips fail to sync immediately with kitchen prep stations or during peak checkout rush.',
    solution: 'Constructed an event-driven synchronization layer using Node.js and Socket.io to push table tickets immediately to the Kitchen Display System (KDS), backed by Next.js and secure Razorpay payment flow.',
    challenge: 'Handling real-time WebSocket state reconnection without losing pending ticket items or producing duplicate kitchen order prints during network drops.',
    impact: 'Reduced table turnover time by 30% and achieved instant kitchen ticket dispatch with zero lost orders.',
    architecture: 'Next.js frontend deployed on Vercel, Node.js/Express backend server, Socket.io bi-directional WebSocket channels, and PostgreSQL via Prisma.',
    keyFeatures: [
      'Dynamic visual table management & instant bill calculation',
      'Real-time kitchen order dispatch via Socket.io WebSocket channels',
      'Bi-directional live order state updates across server and KDS stations',
      'Secure Razorpay payment gateway checkout and webhook verification',
      'PostgreSQL relational schema migrations with Prisma ORM'
    ]
  },
  'Core Banking System (CBS)': {
    engineeringFocus: 'Role-based banking workflows',
    authRequired: false,
    overview: 'A core financial management engine simulating retail banking workflows, credit assessment schedules, and transactional ledger accounting with strict audit logging.',
    problem: 'Financial operations require strict data consistency, role separation, and error-safe balance updates to prevent balance calculation bugs or unauthorized transactional actions.',
    solution: 'Developed Python Flask REST endpoints with Flask-SQLAlchemy and PostgreSQL, enforcing signed JWT authentication and role-based permissions separating customer accounts from teller operations.',
    challenge: 'Structuring strict isolation levels on relational database transactions to eliminate race conditions during simultaneous fund transfers.',
    impact: '100% mathematical precision across multi-ledger transactions and automated loan EMI schedule amortization.',
    architecture: 'React + TypeScript frontend dashboard interacting with a Python Flask service backed by PostgreSQL relational tables.',
    keyFeatures: [
      'Customer account creation & multi-account ledger management',
      'Atomic deposits, withdrawals & ledger fund transfers with audit logging',
      'Loan application processing & automated EMI schedule calculations',
      'Role-based authorization for tellers, managers, and account holders',
      'Relational integrity and audit-ready transaction history'
    ]
  },
  'CoreERP Enterprise Suite': {
    engineeringFocus: 'Enterprise Resource Planning & Operations',
    authRequired: false,
    overview: 'CoreERP is a full-featured enterprise management platform built to centralize inventory movement, employee directories, and financial audit trails into a single coordinated system.',
    problem: 'Growing businesses encounter operational friction when departments use fragmented tools for stock control, personnel management, and billing records.',
    solution: 'Built a unified architecture with React, Node.js, and PostgreSQL to provide role-based dashboard views and automated transaction workflows across company departments.',
    challenge: 'Designing a highly normalized relational database schema that supports scalable multi-department querying without slow join bottlenecks.',
    impact: 'Centralized operational reporting across 3 major business verticals into a unified real-time dashboard.',
    architecture: 'React + TypeScript frontend interacting with an Express REST API backend and PostgreSQL database managed with Prisma ORM.',
    keyFeatures: [
      'Multi-department employee directory & role assignment',
      'Warehouse inventory dispatching & stock balance auditing',
      'Automated financial ledger logs and billing reports',
      'Type-safe schema validation with Prisma ORM'
    ]
  },
  'Expense Tracker & Financial Analytics': {
    engineeringFocus: 'Financial analytics & budgets',
    authRequired: false,
    overview: 'An interactive personal finance application that helps users monitor expenditures, set category budgets, and analyze spending patterns with real-time Chart.js visual graphs.',
    problem: 'Managing personal expenses across multiple categories often lacks visual insights and fast transaction categorization.',
    solution: 'Engineered a responsive React + TypeScript dashboard with Chart.js visualization, Node.js backend, and PostgreSQL for relational budget storage.',
    challenge: 'Dynamically computing real-time aggregations across custom date ranges without degrading client UI frame rates.',
    impact: 'Instant visual category breakdowns and threshold notifications with zero client-side lag.',
    architecture: 'React Vite client with Chart.js, Express REST API, and PostgreSQL relational database.',
    keyFeatures: [
      'Interactive category spending breakdown charts',
      'Custom budget limit thresholds with alert flags',
      'Quick transaction filtering and CSV export',
      'Optimized client-side rendering with Vite'
    ]
  },
  'Yumm (Nex-Food) Ordering Platform': {
    engineeringFocus: 'On-demand food ordering & delivery',
    authRequired: false,
    overview: 'A modern food ordering platform featuring restaurant menus, dynamic cart calculations, real-time checkout flows, and responsive UI designed for mobile and desktop.',
    problem: 'Food ordering platforms require responsive cart synchronization, fast menu filtering, and smooth navigation under high concurrency.',
    solution: 'Constructed with Next.js and TypeScript, utilizing server-side rendering for restaurant listings and optimized state management for the order checkout pipeline.',
    challenge: 'Synchronizing nested item customizer options and dynamic tax calculations smoothly across local storage and server session.',
    impact: 'Sub-second page navigations and a seamless multi-item order placement pipeline.',
    architecture: 'Next.js application deployed on Vercel with TailwindCSS and PostgreSQL backend.',
    keyFeatures: [
      'Dynamic multi-item cart with persistent local storage',
      'Fast restaurant menu search and dietary category filtering',
      'Mobile-first responsive interface with fluid transitions'
    ]
  },
  'AI Resume Screening & Ranking': {
    engineeringFocus: 'Natural language parsing + ranking',
    authRequired: false,
    overview: 'An AI-powered recruitment tool that parses candidate resumes from PDFs, tokenizes technical skills, and ranks candidates against job descriptions using NLP.',
    problem: 'HR teams spend excessive manual hours reviewing hundreds of resumes for technical roles without objective match metrics.',
    solution: 'Built a Python Flask service using TF-IDF vectorization and Cosine Similarity to compute quantified relevancy scores for candidate resumes.',
    challenge: 'Normalizing heterogeneous resume formatting, non-standard headings, and multi-column PDF layouts for accurate token extraction.',
    impact: 'Reduces recruiter candidate screening cycles by 75% with transparent similarity metrics.',
    architecture: 'Python Flask processing backend, PyPDF2 text extraction, scikit-learn NLP models, and Pandas analytics.',
    keyFeatures: [
      'TF-IDF text vectorization and cosine similarity scoring',
      'Automated PDF resume parsing and skill keyword extraction',
      'Ranked candidate leaderboard generation for hiring managers'
    ]
  },
  'Company Management System': {
    engineeringFocus: 'Corporate hierarchy & operations',
    authRequired: false,
    overview: 'A comprehensive corporate portal for employee records, organizational tree navigation, leave requests, and department budgeting.',
    problem: 'Internal corporate processes become disorganized without a centralized system for staff directories and administrative approvals.',
    solution: 'Built a React and Express platform supporting role-based access control for employees, department managers, and system administrators.',
    challenge: 'Constructing recursive organizational chart queries without recursive database performance penalties.',
    impact: 'Eliminated manual email leave approval trails and established clear organizational hierarchy views.',
    architecture: 'React frontend connected to an Express REST API backend and MongoDB document database.',
    keyFeatures: [
      'Interactive organizational department hierarchy view',
      'Leave management and attendance tracking workflows',
      'Administrative role-based permissions and access audits'
    ]
  }
};

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
  filterProjectTable();
}

function renderProjectsTable(projects) {
  const tbody = document.getElementById('projectsTableBody');
  tbody.innerHTML = '';

  if (!projects.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-6">No matching projects found.</td></tr>';
    return;
  }

  projects.forEach((p, idx) => {
    const tr = document.createElement('tr');

    const statusBadge = p.is_published 
      ? '<span class="badge badge-emerald mono"><i class="fa-solid fa-circle-check"></i> Published</span>'
      : '<span class="badge badge-amber mono"><i class="fa-solid fa-clock"></i> Draft</span>';

    const tagsHtml = (p.tags || []).slice(0, 3).map(t => `<span class="badge badge-cyan mono">${escapeHTML(t)}</span>`).join(' ');

    let cleanDesc = p.description || '';
    if (cleanDesc.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(cleanDesc);
        cleanDesc = parsed.overview || parsed.description || cleanDesc;
      } catch (e) {}
    }

    const thumbHtml = p.image_url 
      ? `<img src="${escapeAttr(p.image_url)}" alt="thumb" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border); vertical-align: middle; margin-right: 8px;">`
      : `<span style="display: inline-flex; width: 32px; height: 32px; border-radius: 4px; background: rgba(255,255,255,0.05); align-items: center; justify-content: center; margin-right: 8px; color: var(--text-subtle);"><i class="fa-solid fa-image"></i></span>`;

    tr.innerHTML = `
      <td class="mono text-muted text-sm">${String(idx + 1).padStart(2, '0')}</td>
      <td>
        <div style="display: flex; align-items: center;">
          ${thumbHtml}
          <div>
            <strong style="color: var(--text-main); cursor: pointer;" onclick="viewProjectDetails('${p.id}')">${escapeHTML(p.title)}</strong>
            <p class="text-muted text-sm" style="max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(cleanDesc)}</p>
          </div>
        </div>
      </td>
      <td><span class="badge badge-indigo mono">${escapeHTML(p.category)}</span></td>
      <td>${tagsHtml}</td>
      <td>${statusBadge}</td>
      <td class="mono">${p.display_order}</td>
      <td>
        <div class="table-actions">
          <button class="action-btn" title="View Full Specifications" onclick="viewProjectDetails('${p.id}')">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="action-btn action-btn--publish" title="${p.is_published ? 'Unpublish (Make Draft)' : 'Publish to Live Site'}" onclick="toggleProjectPublish('${p.id}', ${p.is_published})">
            <i class="fa-solid ${p.is_published ? 'fa-eye-slash' : 'fa-eye'}"></i>
          </button>
          <button class="action-btn" title="Edit Project &amp; Photos" onclick="openEditProjectModal('${p.id}')">
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
  const query = (document.getElementById('projectSearchInput')?.value || '').toLowerCase().trim();
  const catFilter = document.getElementById('projectCategoryFilter')?.value || 'all';
  const sortFilter = document.getElementById('projectSortFilter')?.value || 'order_asc';

  let list = [...cachedProjects];

  if (catFilter !== 'all') {
    list = list.filter(p => (p.category || '').toLowerCase() === catFilter.toLowerCase());
  }

  if (query) {
    list = list.filter(p => 
      (p.title || '').toLowerCase().includes(query) || 
      (p.category || '').toLowerCase().includes(query) ||
      (p.description || '').toLowerCase().includes(query) ||
      (p.tags || []).some(t => t.toLowerCase().includes(query))
    );
  }

  if (sortFilter === 'order_asc') {
    list.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  } else if (sortFilter === 'order_desc') {
    list.sort((a, b) => (b.display_order || 0) - (a.display_order || 0));
  } else if (sortFilter === 'title_asc') {
    list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  } else if (sortFilter === 'status_pub') {
    list.sort((a, b) => (b.is_published ? 1 : 0) - (a.is_published ? 1 : 0));
  }

  renderProjectsTable(list);
}

function viewProjectDetails(id) {
  const p = cachedProjects.find(item => item.id === id);
  if (!p) return;

  let parsed = null;
  try {
    if (p.description && p.description.trim().startsWith('{')) {
      parsed = JSON.parse(p.description);
    }
  } catch (e) {}

  const matched = baselineSpecs[p.title] || {};
  const overview = (parsed && (parsed.overview || parsed.description)) || p.description || matched.overview || 'No overview provided.';
  const problem = (parsed && parsed.problem) || matched.problem || 'N/A';
  const solution = (parsed && parsed.solution) || matched.solution || 'N/A';
  const challenge = (parsed && parsed.challenge) || matched.challenge || 'N/A';
  const impact = (parsed && parsed.impact) || matched.impact || 'N/A';
  const architecture = (parsed && parsed.architecture) || matched.architecture || (p.tags || []).join(' • ');
  const focus = (parsed && parsed.engineeringFocus) || matched.engineeringFocus || (p.tags && p.tags[0] ? `${p.tags[0]} Architecture` : 'Full-Stack');
  const features = (parsed && Array.isArray(parsed.keyFeatures)) ? parsed.keyFeatures : (matched.keyFeatures || []);

  const tagsHtml = (p.tags || []).map(t => `<span class="badge badge-cyan mono">${escapeHTML(t)}</span>`).join(' ');

  const html = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      ${p.image_url ? `
        <div style="width: 100%; height: 200px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border);">
          <img src="${escapeAttr(p.image_url)}" alt="${escapeAttr(p.title)}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
      ` : ''}
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <span class="badge badge-indigo mono">${escapeHTML(p.category)}</span>
        <span class="badge mono ${p.is_published ? 'badge-emerald' : 'badge-amber'}">${p.is_published ? 'Published' : 'Draft'}</span>
        <span class="badge mono">Order: ${p.display_order}</span>
        <span class="mono text-muted text-sm">${escapeHTML(focus)}</span>
      </div>
      <div>
        <h4 class="mono text-cyan" style="margin-bottom: 4px;">OVERVIEW</h4>
        <p style="color: var(--text-main); font-size: 0.95rem;">${escapeHTML(overview)}</p>
      </div>
      <div class="grid grid--2col">
        <div style="background: rgba(244, 63, 94, 0.05); border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 8px; padding: 12px;">
          <h4 class="mono text-rose" style="font-size: 0.85rem; margin-bottom: 4px;"><i class="fa-solid fa-circle-exclamation"></i> THE PROBLEM</h4>
          <p class="text-sm" style="color: var(--text-muted);">${escapeHTML(problem)}</p>
        </div>
        <div style="background: rgba(45, 212, 191, 0.05); border: 1px solid rgba(45, 212, 191, 0.2); border-radius: 8px; padding: 12px;">
          <h4 class="mono text-cyan" style="font-size: 0.85rem; margin-bottom: 4px;"><i class="fa-solid fa-circle-check"></i> THE SOLUTION</h4>
          <p class="text-sm" style="color: var(--text-muted);">${escapeHTML(solution)}</p>
        </div>
      </div>
      <div class="grid grid--2col">
        <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 8px; padding: 12px;">
          <h4 class="mono text-amber" style="font-size: 0.85rem; margin-bottom: 4px;"><i class="fa-solid fa-mountain"></i> CHALLENGES OVERCOME</h4>
          <p class="text-sm" style="color: var(--text-muted);">${escapeHTML(challenge)}</p>
        </div>
        <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px;">
          <h4 class="mono text-emerald" style="font-size: 0.85rem; margin-bottom: 4px;"><i class="fa-solid fa-bullseye"></i> MEASURABLE IMPACT</h4>
          <p class="text-sm" style="color: var(--text-muted);">${escapeHTML(impact)}</p>
        </div>
      </div>
      <div>
        <h4 class="mono text-muted text-sm" style="margin-bottom: 6px;">ARCHITECTURE</h4>
        <p class="text-sm text-muted">${escapeHTML(architecture)}</p>
      </div>
      <div>
        <h4 class="mono text-muted text-sm" style="margin-bottom: 6px;">TECH STACK</h4>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">${tagsHtml}</div>
      </div>
      ${features.length ? `
        <div>
          <h4 class="mono text-muted text-sm" style="margin-bottom: 6px;">KEY HIGHLIGHTS</h4>
          <ul style="padding-left: 18px; color: var(--text-muted); font-size: 0.85rem;">
            ${features.map(f => `<li>${escapeHTML(f)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      <div style="display: flex; gap: 12px; margin-top: 8px;">
        ${p.github_url ? `<a href="${escapeAttr(p.github_url)}" target="_blank" class="btn btn--outline btn--sm"><i class="fa-brands fa-github"></i> GitHub</a>` : ''}
        ${p.live_url ? `<a href="${escapeAttr(p.live_url)}" target="_blank" class="btn btn--primary btn--sm"><i class="fa-solid fa-arrow-up-right-from-square"></i> Live Demo</a>` : ''}
        <button type="button" class="btn btn--ghost btn--sm" onclick="closeEditModal(); openEditProjectModal('${p.id}');"><i class="fa-solid fa-pen-to-square"></i> Edit Project</button>
      </div>
    </div>
  `;

  openEditModal(`Project Specs: ${p.title}`, html, async () => { return true; }, true);
  const saveBtn = document.getElementById('editModalSaveBtn');
  if (saveBtn) saveBtn.style.display = 'none';
}

function openCreateProjectModal() {
  const html = `
    <form id="projectForm">
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Project Title *</label>
          <input type="text" id="mProjTitle" class="form-input" placeholder="e.g. HospitalOS + PharmacyERP" required>
        </div>
        <div class="form-group">
          <label class="form-label mono">Engineering Focus / Subtitle</label>
          <input type="text" id="mProjFocus" class="form-input" placeholder="e.g. Real-Time Order Dispatch">
        </div>
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

      <!-- Project Photo Upload & Preview Widget -->
      <div class="form-group">
        <label class="form-label mono"><i class="fa-solid fa-image"></i> Project Thumbnail / Cover Photo</label>
        <div class="image-upload-widget">
          <div class="image-preview-row">
            <div class="image-preview-box image-preview-box--wide" id="mProjImageBox">
              <img id="mProjImagePreview" src="" alt="Thumbnail preview" class="image-preview-img" style="display: none;" onerror="this.style.display='none'; document.getElementById('mProjImagePlaceholder').style.display='flex';">
              <div id="mProjImagePlaceholder" class="image-preview-placeholder">
                <i class="fa-solid fa-image"></i>
                <span>No thumbnail selected</span>
              </div>
            </div>
            <div class="image-controls-col">
              <span class="mono text-sm text-muted">Upload cover image (JPEG, PNG, WebP &le; 5 MB)</span>
              <div class="image-btn-group">
                <button type="button" class="btn btn--primary btn--sm" onclick="document.getElementById('mProjFileInput').click()">
                  <i class="fa-solid fa-upload"></i> Upload Photo
                </button>
                <button type="button" class="btn btn--outline btn--sm" onclick="openMediaPickerForTarget('mProjImage', 'mProjImagePreview', 'mProjImagePlaceholder')">
                  <i class="fa-solid fa-images"></i> Media Library
                </button>
                <button type="button" class="btn btn--ghost btn--sm" onclick="clearModalImageWidget('mProjImage', 'mProjImagePreview', 'mProjImagePlaceholder')">
                  <i class="fa-solid fa-trash-can"></i> Remove
                </button>
              </div>
              <input type="file" id="mProjFileInput" accept="image/jpeg,image/png,image/webp" style="display: none;" onchange="handleModalImageUpload(event, 'mProjImage', 'mProjImagePreview', 'mProjImagePlaceholder', 'mProjProgressWrap', 'mProjProgressBar', 'mProjStatus', 'uploads')">
              <div id="mProjProgressWrap" style="display: none;" class="image-upload-progress">
                <div class="progress-bar">
                  <div id="mProjProgressBar" class="progress-fill" style="width: 0%;"></div>
                </div>
                <span id="mProjStatus" class="mono text-sm text-muted">Uploading...</span>
              </div>
              <input type="url" id="mProjImage" class="form-input text-sm mono mt-2" placeholder="Image URL (auto-filled on upload or paste)" oninput="updateImageWidgetFromInput('mProjImage', 'mProjImagePreview', 'mProjImagePlaceholder')">
            </div>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label mono">Overview &amp; Summary *</label>
        <textarea id="mProjDesc" class="form-input" rows="3" placeholder="Primary overview of the application and its purpose..." required></textarea>
      </div>

      <div class="form-group">
        <label class="form-label mono">Tags &amp; Technologies (Comma-separated)</label>
        <input type="text" id="mProjTags" class="form-input" placeholder="NestJS, React, PostgreSQL, Docker">
      </div>

      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono"><i class="fa-solid fa-circle-exclamation text-rose"></i> Problem Statement</label>
          <textarea id="mProjProblem" class="form-input text-sm" rows="3" placeholder="What core problem or inefficiency does this solve?"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label mono"><i class="fa-solid fa-circle-check text-cyan"></i> Engineered Solution</label>
          <textarea id="mProjSolution" class="form-input text-sm" rows="3" placeholder="How does the system technically address the problem?"></textarea>
        </div>
      </div>

      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono"><i class="fa-solid fa-mountain text-amber"></i> Challenges Overcome</label>
          <textarea id="mProjChallenge" class="form-input text-sm" rows="2" placeholder="Technical hurdles, concurrency or data consistency challenges..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label mono"><i class="fa-solid fa-bullseye text-emerald"></i> Measurable Impact</label>
          <textarea id="mProjImpact" class="form-input text-sm" rows="2" placeholder="Quantified results, turnover speed, error reduction..."></textarea>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label mono">Architecture &amp; System Design</label>
        <textarea id="mProjArch" class="form-input text-sm" rows="2" placeholder="Microservices, Docker containerization, REST API, WebSocket layer..."></textarea>
      </div>

      <div class="form-group">
        <label class="form-label mono">Key Technical Features (One feature per line)</label>
        <textarea id="mProjFeatures" class="form-input text-sm" rows="3" placeholder="Dynamic table reservation &amp; instant bill settlement&#10;Real-time order dispatch via WebSockets&#10;Razorpay webhook verification"></textarea>
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
        <input type="checkbox" id="mProjPublish" class="form-check-input" checked>
        <label for="mProjPublish" class="form-check-label">Publish this project immediately (Visible on live site)</label>
      </div>
    </form>
  `;

  openEditModal('Create New Project', html, async () => {
    const title = document.getElementById('mProjTitle').value.trim();
    const overview = document.getElementById('mProjDesc').value.trim();
    const category = document.getElementById('mProjCategory').value;
    const order = parseInt(document.getElementById('mProjOrder').value) || 0;
    const tagsStr = document.getElementById('mProjTags').value;
    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
    const imageUrl = document.getElementById('mProjImage').value.trim() || null;
    const githubUrl = document.getElementById('mProjGithub').value.trim() || null;
    const liveUrl = document.getElementById('mProjLive').value.trim() || null;
    const isPublished = document.getElementById('mProjPublish').checked;

    const focus = document.getElementById('mProjFocus').value.trim();
    const problem = document.getElementById('mProjProblem').value.trim();
    const solution = document.getElementById('mProjSolution').value.trim();
    const challenge = document.getElementById('mProjChallenge').value.trim();
    const impact = document.getElementById('mProjImpact').value.trim();
    const architecture = document.getElementById('mProjArch').value.trim();
    const keyFeatures = document.getElementById('mProjFeatures').value.split('\n').map(s => s.trim()).filter(Boolean);

    if (!title || !overview) {
      showToast('Project Title and Overview are required.', 'error');
      return false;
    }

    const descObj = {
      overview,
      engineeringFocus: focus,
      problem,
      solution,
      challenge,
      impact,
      architecture,
      keyFeatures
    };
    const descPayload = JSON.stringify(descObj);

    const supabase = window.getSupabase();
    const { error } = await supabase.from('projects').insert([{
      title,
      description: descPayload,
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

    showToast('Project created successfully with full specifications!', 'success');
    loadProjects();
    loadOverviewMetrics();
    return true;
  }, true);
}

function openEditProjectModal(id) {
  const p = cachedProjects.find(item => item.id === id);
  if (!p) return;

  let parsed = null;
  try {
    if (p.description && p.description.trim().startsWith('{')) {
      parsed = JSON.parse(p.description);
    }
  } catch (e) {}

  const matched = baselineSpecs[p.title] || {};
  const overview = (parsed && (parsed.overview || parsed.description)) || p.description || matched.overview || '';
  const focus = (parsed && parsed.engineeringFocus) || matched.engineeringFocus || '';
  const problem = (parsed && parsed.problem) || matched.problem || '';
  const solution = (parsed && parsed.solution) || matched.solution || '';
  const challenge = (parsed && parsed.challenge) || matched.challenge || '';
  const impact = (parsed && parsed.impact) || matched.impact || '';
  const architecture = (parsed && parsed.architecture) || matched.architecture || (p.tags || []).join(' • ');
  const keyFeaturesList = (parsed && Array.isArray(parsed.keyFeatures)) ? parsed.keyFeatures : (matched.keyFeatures || []);

  const html = `
    <form id="projectForm">
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Project Title *</label>
          <input type="text" id="mProjTitle" class="form-input" value="${escapeAttr(p.title)}" required>
        </div>
        <div class="form-group">
          <label class="form-label mono">Engineering Focus / Subtitle</label>
          <input type="text" id="mProjFocus" class="form-input" value="${escapeAttr(focus)}" placeholder="e.g. Healthcare workflow + inventory">
        </div>
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

      <!-- Project Photo Upload & Preview Widget -->
      <div class="form-group">
        <label class="form-label mono"><i class="fa-solid fa-image"></i> Project Thumbnail / Cover Photo</label>
        <div class="image-upload-widget">
          <div class="image-preview-row">
            <div class="image-preview-box image-preview-box--wide" id="mProjImageBox">
              <img id="mProjImagePreview" src="${escapeAttr(p.image_url || '')}" alt="Thumbnail preview" class="image-preview-img" style="${p.image_url ? '' : 'display: none;'}" onerror="this.style.display='none'; document.getElementById('mProjImagePlaceholder').style.display='flex';">
              <div id="mProjImagePlaceholder" class="image-preview-placeholder" style="${p.image_url ? 'display: none;' : ''}">
                <i class="fa-solid fa-image"></i>
                <span>No thumbnail uploaded</span>
              </div>
            </div>
            <div class="image-controls-col">
              <span class="mono text-sm text-muted">Upload cover image (JPEG, PNG, WebP &le; 5 MB)</span>
              <div class="image-btn-group">
                <button type="button" class="btn btn--primary btn--sm" onclick="document.getElementById('mProjFileInput').click()">
                  <i class="fa-solid fa-upload"></i> Upload / Change Photo
                </button>
                <button type="button" class="btn btn--outline btn--sm" onclick="openMediaPickerForTarget('mProjImage', 'mProjImagePreview', 'mProjImagePlaceholder')">
                  <i class="fa-solid fa-images"></i> Media Library
                </button>
                <button type="button" class="btn btn--ghost btn--sm" onclick="clearModalImageWidget('mProjImage', 'mProjImagePreview', 'mProjImagePlaceholder')">
                  <i class="fa-solid fa-trash-can"></i> Remove
                </button>
              </div>
              <input type="file" id="mProjFileInput" accept="image/jpeg,image/png,image/webp" style="display: none;" onchange="handleModalImageUpload(event, 'mProjImage', 'mProjImagePreview', 'mProjImagePlaceholder', 'mProjProgressWrap', 'mProjProgressBar', 'mProjStatus', 'uploads')">
              <div id="mProjProgressWrap" style="display: none;" class="image-upload-progress">
                <div class="progress-bar">
                  <div id="mProjProgressBar" class="progress-fill" style="width: 0%;"></div>
                </div>
                <span id="mProjStatus" class="mono text-sm text-muted">Uploading...</span>
              </div>
              <input type="url" id="mProjImage" class="form-input text-sm mono mt-2" placeholder="Image URL (auto-filled on upload or paste)" value="${escapeAttr(p.image_url || '')}" oninput="updateImageWidgetFromInput('mProjImage', 'mProjImagePreview', 'mProjImagePlaceholder')">
            </div>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label mono">Overview &amp; Summary *</label>
        <textarea id="mProjDesc" class="form-input" rows="3" required>${escapeHTML(overview)}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label mono">Tags &amp; Technologies (Comma-separated)</label>
        <input type="text" id="mProjTags" class="form-input" value="${escapeAttr((p.tags || []).join(', '))}">
      </div>

      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono"><i class="fa-solid fa-circle-exclamation text-rose"></i> Problem Statement</label>
          <textarea id="mProjProblem" class="form-input text-sm" rows="3">${escapeHTML(problem)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label mono"><i class="fa-solid fa-circle-check text-cyan"></i> Engineered Solution</label>
          <textarea id="mProjSolution" class="form-input text-sm" rows="3">${escapeHTML(solution)}</textarea>
        </div>
      </div>

      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono"><i class="fa-solid fa-mountain text-amber"></i> Challenges Overcome</label>
          <textarea id="mProjChallenge" class="form-input text-sm" rows="2">${escapeHTML(challenge)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label mono"><i class="fa-solid fa-bullseye text-emerald"></i> Measurable Impact</label>
          <textarea id="mProjImpact" class="form-input text-sm" rows="2">${escapeHTML(impact)}</textarea>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label mono">Architecture &amp; System Design</label>
        <textarea id="mProjArch" class="form-input text-sm" rows="2">${escapeHTML(architecture)}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label mono">Key Technical Features (One feature per line)</label>
        <textarea id="mProjFeatures" class="form-input text-sm" rows="3">${escapeHTML(keyFeaturesList.join('\n'))}</textarea>
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
    const overview = document.getElementById('mProjDesc').value.trim();
    const category = document.getElementById('mProjCategory').value;
    const order = parseInt(document.getElementById('mProjOrder').value) || 0;
    const tagsStr = document.getElementById('mProjTags').value;
    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
    const imageUrl = document.getElementById('mProjImage').value.trim() || null;
    const githubUrl = document.getElementById('mProjGithub').value.trim() || null;
    const liveUrl = document.getElementById('mProjLive').value.trim() || null;
    const isPublished = document.getElementById('mProjPublish').checked;

    const focus = document.getElementById('mProjFocus').value.trim();
    const problem = document.getElementById('mProjProblem').value.trim();
    const solution = document.getElementById('mProjSolution').value.trim();
    const challenge = document.getElementById('mProjChallenge').value.trim();
    const impact = document.getElementById('mProjImpact').value.trim();
    const architecture = document.getElementById('mProjArch').value.trim();
    const keyFeatures = document.getElementById('mProjFeatures').value.split('\n').map(s => s.trim()).filter(Boolean);

    if (!title || !overview) {
      showToast('Title and Overview are required.', 'error');
      return false;
    }

    const descObj = {
      overview,
      engineeringFocus: focus,
      problem,
      solution,
      challenge,
      impact,
      architecture,
      keyFeatures
    };
    const descPayload = JSON.stringify(descObj);

    const supabase = window.getSupabase();
    const { error } = await supabase.from('projects').update({
      title,
      description: descPayload,
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

    showToast('Project and specifications updated successfully.', 'success');
    loadProjects();
    loadOverviewMetrics();
    return true;
  }, true);
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
  const query = (document.getElementById('skillSearchInput')?.value || '').toLowerCase().trim();
  const catFilter = document.getElementById('skillCategoryFilter')?.value || 'all';

  let list = [...cachedSkills];
  if (catFilter !== 'all') {
    list = list.filter(s => (s.category || '').toLowerCase() === catFilter.toLowerCase());
  }
  if (query) {
    list = list.filter(s => 
      (s.name || '').toLowerCase().includes(query) || 
      (s.category || '').toLowerCase().includes(query) ||
      (s.icon_class || '').toLowerCase().includes(query)
    );
  }
  renderSkillsTable(list);
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

function filterExperienceTable() {
  const query = (document.getElementById('expSearchInput')?.value || '').toLowerCase().trim();
  let list = [...cachedExperience];
  if (query) {
    list = list.filter(item => 
      (item.role || '').toLowerCase().includes(query) ||
      (item.company || '').toLowerCase().includes(query) ||
      (item.location || '').toLowerCase().includes(query) ||
      (item.description || '').toLowerCase().includes(query) ||
      (item.highlights || []).some(h => h.toLowerCase().includes(query))
    );
  }
  renderExperienceTable(list);
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
          <button class="action-btn action-btn--publish" title="Toggle Publish" onclick="toggleEduPublish('${item.id}', ${item.is_published})">
            <i class="fa-solid ${item.is_published ? 'fa-eye-slash' : 'fa-eye'}"></i>
          </button>
          <button class="action-btn" title="Edit Education" onclick="openEditEducationModal('${item.id}')">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="action-btn action-btn--delete" title="Delete Education" onclick="confirmDeleteEdu('${item.id}', '${escapeAttr(item.degree)}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterEducationTable() {
  const query = (document.getElementById('eduSearchInput')?.value || '').toLowerCase().trim();
  let list = [...cachedEducation];
  if (query) {
    list = list.filter(item =>
      (item.degree || '').toLowerCase().includes(query) ||
      (item.institution || '').toLowerCase().includes(query) ||
      (item.field_of_study || '').toLowerCase().includes(query) ||
      (item.grade || '').toLowerCase().includes(query)
    );
  }
  renderEducationTable(list);
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
      <div class="form-group">
        <label class="form-label mono">Field of Study</label>
        <input type="text" id="mEduField" class="form-input" placeholder="Computer Science and Engineering">
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
    const field_of_study = document.getElementById('mEduField').value.trim() || null;
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
      degree, institution, field_of_study, start_date, end_date, grade, display_order, is_published
    }]);

    if (error) { showToast('Error: ' + error.message, 'error'); return false; }
    showToast('Education record added.', 'success');
    loadEducation();
    loadOverviewMetrics();
    return true;
  });
}

function openEditEducationModal(id) {
  const item = cachedEducation.find(x => x.id === id);
  if (!item) return;

  const html = `
    <form id="eduForm">
      <div class="form-group">
        <label class="form-label mono">Degree / Qualification *</label>
        <input type="text" id="mEduDegree" class="form-input" value="${escapeAttr(item.degree)}" required>
      </div>
      <div class="form-group">
        <label class="form-label mono">Institution / University *</label>
        <input type="text" id="mEduInst" class="form-input" value="${escapeAttr(item.institution)}" required>
      </div>
      <div class="form-group">
        <label class="form-label mono">Field of Study</label>
        <input type="text" id="mEduField" class="form-input" value="${escapeAttr(item.field_of_study || '')}">
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Start Date *</label>
          <input type="text" id="mEduStart" class="form-input" value="${escapeAttr(item.start_date)}" required>
        </div>
        <div class="form-group">
          <label class="form-label mono">End Date</label>
          <input type="text" id="mEduEnd" class="form-input" value="${escapeAttr(item.end_date || '')}">
        </div>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Grade / CGPA</label>
          <input type="text" id="mEduGrade" class="form-input" value="${escapeAttr(item.grade || '')}">
        </div>
        <div class="form-group">
          <label class="form-label mono">Display Order</label>
          <input type="number" id="mEduOrder" class="form-input" value="${item.display_order}">
        </div>
      </div>
      <div class="form-check mt-3">
        <input type="checkbox" id="mEduPublish" class="form-check-input" ${item.is_published ? 'checked' : ''}>
        <label for="mEduPublish" class="form-check-label">Publish on portfolio</label>
      </div>
    </form>
  `;

  openEditModal(`Edit Education: ${item.degree}`, html, async () => {
    const degree = document.getElementById('mEduDegree').value.trim();
    const institution = document.getElementById('mEduInst').value.trim();
    const field_of_study = document.getElementById('mEduField').value.trim() || null;
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
    const { error } = await supabase.from('education').update({
      degree, institution, field_of_study, start_date, end_date, grade, display_order, is_published
    }).eq('id', id);

    if (error) { showToast('Update error: ' + error.message, 'error'); return false; }
    showToast('Education record updated.', 'success');
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
          <button class="action-btn action-btn--publish" title="Toggle Publish" onclick="toggleCertPublish('${c.id}', ${c.is_published})">
            <i class="fa-solid ${c.is_published ? 'fa-eye-slash' : 'fa-eye'}"></i>
          </button>
          <button class="action-btn" title="Edit Certification" onclick="openEditCertModal('${c.id}')">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="action-btn action-btn--delete" title="Delete Certification" onclick="confirmDeleteCert('${c.id}', '${escapeAttr(c.title)}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterCertsTable() {
  const query = (document.getElementById('certSearchInput')?.value || '').toLowerCase().trim();
  let list = [...cachedCerts];
  if (query) {
    list = list.filter(item =>
      (item.title || '').toLowerCase().includes(query) ||
      (item.issuer || '').toLowerCase().includes(query) ||
      (item.credential_id || '').toLowerCase().includes(query)
    );
  }
  renderCertsTable(list);
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
      <div class="form-group">
        <label class="form-label mono">Credential ID</label>
        <input type="text" id="mCertId" class="form-input" placeholder="e.g. CERT-12345">
      </div>

      <!-- Certificate Badge / Document Photo Upload Widget -->
      <div class="form-group">
        <label class="form-label mono"><i class="fa-solid fa-award"></i> Certificate Badge / Photo / URL</label>
        <div class="image-upload-widget">
          <div class="image-preview-row">
            <div class="image-preview-box" id="mCertBox">
              <img id="mCertPreview" src="" alt="Cert preview" class="image-preview-img" style="display: none;" onerror="this.style.display='none'; document.getElementById('mCertPlaceholder').style.display='flex';">
              <div id="mCertPlaceholder" class="image-preview-placeholder">
                <i class="fa-solid fa-certificate"></i>
                <span>No badge/doc</span>
              </div>
            </div>
            <div class="image-controls-col">
              <span class="mono text-sm text-muted">Upload certificate or badge (JPEG, PNG, WebP &le; 5 MB)</span>
              <div class="image-btn-group">
                <button type="button" class="btn btn--primary btn--sm" onclick="document.getElementById('mCertFileInput').click()">
                  <i class="fa-solid fa-upload"></i> Upload / Change Photo
                </button>
                <button type="button" class="btn btn--outline btn--sm" onclick="openMediaPickerForTarget('mCertUrl', 'mCertPreview', 'mCertPlaceholder')">
                  <i class="fa-solid fa-images"></i> Media Library
                </button>
                <button type="button" class="btn btn--ghost btn--sm" onclick="clearModalImageWidget('mCertUrl', 'mCertPreview', 'mCertPlaceholder')">
                  <i class="fa-solid fa-trash-can"></i> Remove
                </button>
              </div>
              <input type="file" id="mCertFileInput" accept="image/jpeg,image/png,image/webp" style="display: none;" onchange="handleModalImageUpload(event, 'mCertUrl', 'mCertPreview', 'mCertPlaceholder', 'mCertProgressWrap', 'mCertProgressBar', 'mCertStatus', 'uploads')">
              <div id="mCertProgressWrap" style="display: none;" class="image-upload-progress">
                <div class="progress-bar">
                  <div id="mCertProgressBar" class="progress-fill" style="width: 0%;"></div>
                </div>
                <span id="mCertStatus" class="mono text-sm text-muted">Uploading...</span>
              </div>
              <input type="url" id="mCertUrl" class="form-input text-sm mono mt-2" placeholder="Credential or image URL (auto-filled on upload or paste)" oninput="updateImageWidgetFromInput('mCertUrl', 'mCertPreview', 'mCertPlaceholder')">
            </div>
          </div>
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

function openEditCertModal(id) {
  const c = cachedCerts.find(x => x.id === id);
  if (!c) return;

  const html = `
    <form id="certForm">
      <div class="form-group">
        <label class="form-label mono">Certification Title *</label>
        <input type="text" id="mCertTitle" class="form-input" value="${escapeAttr(c.title)}" required>
      </div>
      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Issuer / Academy *</label>
          <input type="text" id="mCertIssuer" class="form-input" value="${escapeAttr(c.issuer)}" required>
        </div>
        <div class="form-group">
          <label class="form-label mono">Issue Date</label>
          <input type="text" id="mCertDate" class="form-input" value="${escapeAttr(c.issue_date || '')}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label mono">Credential ID</label>
        <input type="text" id="mCertId" class="form-input" value="${escapeAttr(c.credential_id || '')}">
      </div>

      <!-- Certificate Badge / Document Photo Upload Widget -->
      <div class="form-group">
        <label class="form-label mono"><i class="fa-solid fa-award"></i> Certificate Badge / Photo / URL</label>
        <div class="image-upload-widget">
          <div class="image-preview-row">
            <div class="image-preview-box" id="mCertBox">
              <img id="mCertPreview" src="${escapeAttr(c.credential_url || '')}" alt="Cert preview" class="image-preview-img" style="${c.credential_url ? 'display: block;' : 'display: none;'}" onerror="this.style.display='none'; document.getElementById('mCertPlaceholder').style.display='flex';">
              <div id="mCertPlaceholder" class="image-preview-placeholder" style="${c.credential_url ? 'display: none;' : 'display: flex;'}">
                <i class="fa-solid fa-certificate"></i>
                <span>No badge/doc</span>
              </div>
            </div>
            <div class="image-controls-col">
              <span class="mono text-sm text-muted">Upload certificate or badge (JPEG, PNG, WebP &le; 5 MB)</span>
              <div class="image-btn-group">
                <button type="button" class="btn btn--primary btn--sm" onclick="document.getElementById('mCertFileInput').click()">
                  <i class="fa-solid fa-upload"></i> Upload / Change Photo
                </button>
                <button type="button" class="btn btn--outline btn--sm" onclick="openMediaPickerForTarget('mCertUrl', 'mCertPreview', 'mCertPlaceholder')">
                  <i class="fa-solid fa-images"></i> Media Library
                </button>
                <button type="button" class="btn btn--ghost btn--sm" onclick="clearModalImageWidget('mCertUrl', 'mCertPreview', 'mCertPlaceholder')">
                  <i class="fa-solid fa-trash-can"></i> Remove
                </button>
              </div>
              <input type="file" id="mCertFileInput" accept="image/jpeg,image/png,image/webp" style="display: none;" onchange="handleModalImageUpload(event, 'mCertUrl', 'mCertPreview', 'mCertPlaceholder', 'mCertProgressWrap', 'mCertProgressBar', 'mCertStatus', 'uploads')">
              <div id="mCertProgressWrap" style="display: none;" class="image-upload-progress">
                <div class="progress-bar">
                  <div id="mCertProgressBar" class="progress-fill" style="width: 0%;"></div>
                </div>
                <span id="mCertStatus" class="mono text-sm text-muted">Uploading...</span>
              </div>
              <input type="url" id="mCertUrl" class="form-input text-sm mono mt-2" placeholder="Credential or image URL (auto-filled on upload or paste)" value="${escapeAttr(c.credential_url || '')}" oninput="updateImageWidgetFromInput('mCertUrl', 'mCertPreview', 'mCertPlaceholder')">
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid--2col">
        <div class="form-group">
          <label class="form-label mono">Display Order</label>
          <input type="number" id="mCertOrder" class="form-input" value="${c.display_order}">
        </div>
        <div class="form-check mt-4">
          <input type="checkbox" id="mCertPublish" class="form-check-input" ${c.is_published ? 'checked' : ''}>
          <label for="mCertPublish" class="form-check-label">Publish on portfolio</label>
        </div>
      </div>
    </form>
  `;

  openEditModal(`Edit Certification: ${c.title}`, html, async () => {
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
    const { error } = await supabase.from('certifications').update({
      title, issuer, issue_date, credential_id, credential_url, display_order, is_published
    }).eq('id', id);

    if (error) { showToast('Update failed: ' + error.message, 'error'); return false; }
    showToast('Certification updated.', 'success');
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

function handleAvatarFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const pWrap = document.getElementById('profAvatarProgressWrap');
  const pBar = document.getElementById('profAvatarProgressBar');
  const pStatus = document.getElementById('profAvatarStatus');

  if (pWrap) pWrap.style.display = 'block';
  if (pBar) pBar.style.width = '35%';
  if (pStatus) pStatus.textContent = `Uploading ${file.name}...`;

  uploadMediaFile(file, 'uploads')
    .then(res => {
      if (pBar) pBar.style.width = '100%';
      if (pStatus) pStatus.textContent = 'Uploaded successfully!';

      const input = document.getElementById('profAvatarUrl');
      if (input) input.value = res.publicUrl;

      const img = document.getElementById('profAvatarPreview');
      const ph = document.getElementById('profAvatarPlaceholder');
      if (img) {
        img.src = res.publicUrl;
        img.style.display = 'block';
      }
      if (ph) ph.style.display = 'none';

      showToast('Avatar uploaded! Click "Save Public Profile" to publish changes.', 'success');
    })
    .catch(err => {
      showToast('Avatar upload failed: ' + err.message, 'error');
      if (pStatus) pStatus.textContent = 'Upload failed: ' + err.message;
    })
    .finally(() => {
      e.target.value = '';
      setTimeout(() => {
        if (pWrap) pWrap.style.display = 'none';
        if (pBar) pBar.style.width = '0%';
      }, 2000);
    });
}

function resetProfileAvatarToDefault() {
  const defaultAvatar = '/images/avatar.jpg';
  const input = document.getElementById('profAvatarUrl');
  if (input) input.value = defaultAvatar;

  const img = document.getElementById('profAvatarPreview');
  const ph = document.getElementById('profAvatarPlaceholder');
  if (img) {
    img.src = defaultAvatar;
    img.style.display = 'block';
  }
  if (ph) ph.style.display = 'none';

  showToast('Reset to default avatar (/images/avatar.jpg). Click Save to apply.', 'info');
}

function syncSocialLinksFromInputs() {
  const gh = document.getElementById('profLinkGithub')?.value.trim() || '';
  const li = document.getElementById('profLinkLinkedin')?.value.trim() || '';
  const tw = document.getElementById('profLinkTwitter')?.value.trim() || '';
  const ig = document.getElementById('profLinkInstagram')?.value.trim() || '';
  const res = document.getElementById('profLinkResume')?.value.trim() || '';

  let currentObj = {};
  try {
    const raw = document.getElementById('profSocialLinks')?.value.trim();
    if (raw) currentObj = JSON.parse(raw);
  } catch (e) {}

  if (gh) currentObj.github = gh; else delete currentObj.github;
  if (li) currentObj.linkedin = li; else delete currentObj.linkedin;
  if (tw) currentObj.twitter = tw; else delete currentObj.twitter;
  if (ig) currentObj.instagram = ig; else delete currentObj.instagram;
  if (res) currentObj.resume = res; else delete currentObj.resume;

  const container = document.getElementById('profSocialLinks');
  if (container) container.value = JSON.stringify(currentObj, null, 2);
}

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
      document.getElementById('profBio').value = pubData.bio || '';
      document.getElementById('profIsPublished').checked = !!pubData.is_published;

      // Avatar widget
      const avatarUrl = pubData.avatar_url || '';
      const avatarInput = document.getElementById('profAvatarUrl');
      const avatarImg = document.getElementById('profAvatarPreview');
      const avatarPh = document.getElementById('profAvatarPlaceholder');

      if (avatarInput) avatarInput.value = avatarUrl;
      if (avatarUrl) {
        if (avatarImg) { avatarImg.src = avatarUrl; avatarImg.style.display = 'block'; }
        if (avatarPh) avatarPh.style.display = 'none';
      } else {
        if (avatarImg) { avatarImg.src = ''; avatarImg.style.display = 'none'; }
        if (avatarPh) avatarPh.style.display = 'flex';
      }

      // Social Links
      const sLinks = pubData.social_links || {};
      if (document.getElementById('profSocialLinks')) {
        document.getElementById('profSocialLinks').value = JSON.stringify(sLinks, null, 2);
      }
      if (document.getElementById('profLinkGithub')) document.getElementById('profLinkGithub').value = sLinks.github || '';
      if (document.getElementById('profLinkLinkedin')) document.getElementById('profLinkLinkedin').value = sLinks.linkedin || '';
      if (document.getElementById('profLinkTwitter')) document.getElementById('profLinkTwitter').value = sLinks.twitter || '';
      if (document.getElementById('profLinkInstagram')) document.getElementById('profLinkInstagram').value = sLinks.instagram || '';
      if (document.getElementById('profLinkResume')) document.getElementById('profLinkResume').value = sLinks.resume || '';

      const badge = document.getElementById('publicProfileBadge');
      if (badge) {
        if (pubData.is_published) {
          badge.className = 'badge badge-emerald mono';
          badge.textContent = 'Published';
        } else {
          badge.className = 'badge badge-amber mono';
          badge.textContent = 'Draft';
        }
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

  syncSocialLinksFromInputs();

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
   10. SEED / IMPORT INITIAL CONTENT & DEDUPLICATION
   ========================================================================== */

let isImportingContent = false;
let isCleaningDuplicates = false;

async function promptImportStaticContent() {
  if (isImportingContent) {
    showToast('Import already in progress...', 'info');
    return;
  }

  openConfirmModal(
    'Import & Synchronize All Portfolio Content',
    'This will import all 8 verified projects, 22 technical skills, work experience, 3 academic qualifications, 3 certifications, and verified profile records into Supabase. Existing records will be safely preserved without duplicates. Proceed?',
    async () => {
      if (isImportingContent) return;
      isImportingContent = true;

      const actionBtn = document.getElementById('confirmActionBtn');
      if (actionBtn) {
        actionBtn.disabled = true;
        actionBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importing...';
      }

      const supabase = window.getSupabase();
      if (!supabase) {
        isImportingContent = false;
        if (actionBtn) {
          actionBtn.disabled = false;
          actionBtn.textContent = 'Confirm Action';
        }
        return;
      }

      try {
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
      } catch (err) {
        showToast('Import failed: ' + err.message, 'error');
      } finally {
        isImportingContent = false;
        if (actionBtn) {
          actionBtn.disabled = false;
          actionBtn.textContent = 'Confirm Action';
        }
      }
    }
  );
}

async function cleanupDuplicates() {
  if (isCleaningDuplicates) {
    showToast('Cleanup already in progress...', 'info');
    return;
  }

  openConfirmModal(
    'Clean Up Duplicate Database Records',
    'This will safely inspect projects, skills, experience, education, and certifications, retaining the authentic primary record for each genuine item and deleting exact duplicates. Proceed?',
    async () => {
      if (isCleaningDuplicates) return;
      isCleaningDuplicates = true;

      const actionBtn = document.getElementById('confirmActionBtn');
      if (actionBtn) {
        actionBtn.disabled = true;
        actionBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cleaning...';
      }

      const supabase = window.getSupabase();
      if (!supabase || !activeAdminSession) {
        isCleaningDuplicates = false;
        showToast('Administrator session required for database cleanup.', 'error');
        if (actionBtn) {
          actionBtn.disabled = false;
          actionBtn.textContent = 'Confirm Action';
        }
        return;
      }

      try {
        showToast('Scanning collections for duplicate records...', 'info');

        // 1. Projects - keep earliest created
        const { data: projs } = await supabase.from('projects').select('*').order('created_at', { ascending: true });
        const seenProjTitles = new Set();
        const projDups = [];
        (projs || []).forEach(p => {
          const k = (p.title || '').trim().toLowerCase();
          if (seenProjTitles.has(k)) projDups.push(p.id);
          else seenProjTitles.add(k);
        });
        if (projDups.length > 0) {
          const { error } = await supabase.from('projects').delete().in('id', projDups);
          if (error) throw new Error('Projects deletion failed: ' + error.message);
        }

        // 2. Skills
        const { data: skills } = await supabase.from('skills').select('*').order('created_at', { ascending: true });
        const seenSkills = new Set();
        const skillDups = [];
        (skills || []).forEach(s => {
          const k = (s.name || '').trim().toLowerCase();
          if (seenSkills.has(k)) skillDups.push(s.id);
          else seenSkills.add(k);
        });
        if (skillDups.length > 0) {
          const { error } = await supabase.from('skills').delete().in('id', skillDups);
          if (error) throw new Error('Skills deletion failed: ' + error.message);
        }

        // 3. Experience
        const { data: exp } = await supabase.from('experience').select('*').order('created_at', { ascending: true });
        const seenExp = new Set();
        const expDups = [];
        (exp || []).forEach(e => {
          const k = `${(e.role || '').trim()}:::${(e.company || '').trim()}`.toLowerCase();
          if (seenExp.has(k)) expDups.push(e.id);
          else seenExp.add(k);
        });
        if (expDups.length > 0) {
          const { error } = await supabase.from('experience').delete().in('id', expDups);
          if (error) throw new Error('Experience deletion failed: ' + error.message);
        }

        // 4. Education
        const { data: edu } = await supabase.from('education').select('*').order('created_at', { ascending: true });
        const seenEdu = new Set();
        const eduDups = [];
        (edu || []).forEach(ed => {
          const k = `${(ed.degree || '').trim()}:::${(ed.institution || '').trim()}`.toLowerCase();
          if (seenEdu.has(k)) eduDups.push(ed.id);
          else seenEdu.add(k);
        });
        if (eduDups.length > 0) {
          const { error } = await supabase.from('education').delete().in('id', eduDups);
          if (error) throw new Error('Education deletion failed: ' + error.message);
        }

        // 5. Certifications
        const { data: certs } = await supabase.from('certifications').select('*').order('created_at', { ascending: true });
        const seenCerts = new Set();
        const certDups = [];
        (certs || []).forEach(c => {
          const k = (c.title || '').trim().toLowerCase();
          if (seenCerts.has(k)) certDups.push(c.id);
          else seenCerts.add(k);
        });
        if (certDups.length > 0) {
          const { error } = await supabase.from('certifications').delete().in('id', certDups);
          if (error) throw new Error('Certifications deletion failed: ' + error.message);
        }

        const totalRemoved = projDups.length + skillDups.length + expDups.length + eduDups.length + certDups.length;
        if (totalRemoved > 0) {
          showToast(`Cleanup complete! Removed ${totalRemoved} duplicates (${projDups.length} projects, ${skillDups.length} skills, ${expDups.length} exp, ${eduDups.length} edu, ${certDups.length} certs).`, 'success');
        } else {
          showToast('Database is already clean. Zero duplicate records found.', 'info');
        }

        loadOverviewMetrics();
        loadSectionData(currentSection);
      } catch (err) {
        showToast('Cleanup failed: ' + err.message, 'error');
      } finally {
        isCleaningDuplicates = false;
        if (actionBtn) {
          actionBtn.disabled = false;
          actionBtn.textContent = 'Confirm Action';
        }
      }
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

function openEditModal(title, bodyHTML, onSave, isLarge = false) {
  document.getElementById('editModalTitle').textContent = title;
  document.getElementById('editModalBody').innerHTML = bodyHTML;
  pendingEditSaveAction = onSave;

  const card = document.getElementById('editModalCard');
  if (card) {
    if (isLarge) card.classList.add('modal-card--lg');
    else card.classList.remove('modal-card--lg');
  }

  const saveBtn = document.getElementById('editModalSaveBtn');
  if (saveBtn) saveBtn.style.display = 'inline-flex';

  document.getElementById('editModal').style.display = 'flex';

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
  const card = document.getElementById('editModalCard');
  if (card) card.classList.remove('modal-card--lg');
  const saveBtn = document.getElementById('editModalSaveBtn');
  if (saveBtn) saveBtn.style.display = 'inline-flex';
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
