/**
 * Shahin Sha Portfolio - Dynamic Supabase Synchronization Engine
 * Dedicated Supabase Project: yaxyqpwsxknahehhmtch
 * Gracefully synchronizes published CMS content with static HTML fallback
 */

(function () {
  'use strict';

  const SYNC_TIMEOUT_MS = 4000;

  document.addEventListener('DOMContentLoaded', () => {
    initPortfolioSync();
  });

  async function initPortfolioSync() {
    if (typeof window.getSupabase !== 'function') {
      console.log('[PortfolioSync] Supabase client helper not available, retaining static fallback.');
      return;
    }

    const supabase = window.getSupabase();
    if (!supabase) {
      console.log('[PortfolioSync] Supabase SDK offline, retaining static HTML.');
      return;
    }

    try {
      await Promise.race([
        syncPublishedContent(supabase),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), SYNC_TIMEOUT_MS))
      ]);
    } catch (err) {
      console.warn('[PortfolioSync] Fallback active:', err.message || err);
    }
  }

  async function syncPublishedContent(supabase) {
    // 1. Fetch published projects
    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .eq('is_published', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (projErr) {
      console.warn('[PortfolioSync] Projects fetch error:', projErr.message);
    } else if (Array.isArray(projects) && projects.length > 0) {
      renderDynamicProjects(projects);
    } else {
      console.log('[PortfolioSync] Zero published database projects; preserving static portfolio.');
    }

    // 2. Fetch published profile
    try {
      const { data: profile } = await supabase
        .from('public_profiles')
        .select('*')
        .eq('is_published', true)
        .limit(1)
        .maybeSingle();

      if (profile) {
        applyDynamicProfile(profile);
      }
    } catch (e) {
      console.warn('[PortfolioSync] Profile sync warning:', e);
    }

    // 3. Fetch published education
    try {
      const { data: eduList } = await supabase
        .from('education')
        .select('*')
        .eq('is_published', true)
        .order('display_order', { ascending: true });

      if (Array.isArray(eduList) && eduList.length > 0) {
        renderDynamicEducation(eduList);
      }
    } catch (e) {
      console.warn('[PortfolioSync] Education sync warning:', e);
    }
  }

  // Pre-mapped rich modal specifications for the primary projects
  const baselineSpecs = {
    'HospitalOS + PharmacyERP': {
      number: 'PROJECT 01',
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
      number: 'PROJECT 02',
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
      number: 'PROJECT 03',
      engineeringFocus: 'Role-based banking workflows',
      authRequired: false,
      overview: 'A core financial management engine simulating retail banking workflows, credit assessment schedules, and transactional ledger accounting.',
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
      number: 'PROJECT 04',
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
      number: 'PROJECT 05',
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
      number: 'PROJECT 06',
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
      number: 'PROJECT 07',
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
      number: 'PROJECT 08',
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

  function renderDynamicProjects(projects) {
    const grid = document.getElementById('projectGrid');
    if (!grid) return;

    if (!window.projectsData) {
      window.projectsData = {};
    }

    const fragment = document.createDocumentFragment();

    projects.forEach((p, idx) => {
      const projNum = String(idx + 1).padStart(2, '0');
      const projId = p.id;
      const matched = baselineSpecs[p.title] || {};

      // Register into window.projectsData for specs modal
      window.projectsData[projId] = {
        number: `PROJECT ${projNum}`,
        title: p.title,
        engineeringFocus: matched.engineeringFocus || (p.tags && p.tags[0] ? `${p.tags[0]} Architecture` : 'Full-Stack System'),
        authRequired: !!matched.authRequired,
        overview: p.description || matched.overview || '',
        problem: matched.problem || p.description,
        solution: matched.solution || 'Engineered with clean architectural separation, relational database modeling, and performant REST APIs.',
        challenge: matched.challenge || 'Maintaining high throughput, resilient caching, and strict transactional data consistency.',
        impact: matched.impact || 'Delivered robust system performance and streamlined workflows for end users.',
        architecture: matched.architecture || (p.tags || []).join(' • '),
        stack: Array.isArray(p.tags) && p.tags.length > 0 ? p.tags : (matched.stack || []),
        keyFeatures: matched.keyFeatures || (Array.isArray(p.tags) && p.tags.length > 0
          ? p.tags.map(t => `Engineered and integrated ${t}`)
          : ['Full-stack system integration']),
        github: sanitizeUrl(p.github_url),
        live: sanitizeUrl(p.live_url)
      };

      // Card Element
      const card = document.createElement('article');
      card.className = 'project-card';

      // Category attribute mapping for filter tabs
      const cat = (p.category || 'fullstack').toLowerCase();
      let filterCats = [cat];
      if (cat === 'erp') filterCats.push('fullstack');
      if (cat === 'fullstack' && p.title.toLowerCase().includes('erp')) filterCats.push('erp');
      if (p.tags && p.tags.some(t => t.toLowerCase().includes('python'))) filterCats.push('python');
      if (p.tags && (p.tags.some(t => t.toLowerCase().includes('socket') || t.toLowerCase().includes('realtime')))) filterCats.push('realtime');
      if (p.tags && (p.tags.some(t => t.toLowerCase().includes('nest') || t.toLowerCase().includes('express') || t.toLowerCase().includes('fastapi')))) filterCats.push('backend');
      card.setAttribute('data-category', filterCats.join(' '));

      const innerDiv = document.createElement('div');

      // Top Meta
      const topMeta = document.createElement('div');
      topMeta.className = 'project-card__top';

      const metaLeft = document.createElement('div');
      metaLeft.className = 'project-card__meta';
      const numSpan = document.createElement('span');
      numSpan.className = 'project-num';
      numSpan.textContent = projNum;
      const focusSpan = document.createElement('span');
      focusSpan.className = 'project-focus mono';
      focusSpan.textContent = window.projectsData[projId].engineeringFocus;
      metaLeft.appendChild(numSpan);
      metaLeft.appendChild(focusSpan);

      const specsBtn = document.createElement('button');
      specsBtn.className = 'project-specs-btn mono';
      specsBtn.innerHTML = '<i class="fa-solid fa-circle-info"></i> Specs';
      specsBtn.addEventListener('click', () => {
        if (typeof window.openProjectModal === 'function') {
          window.openProjectModal(projId);
        }
      });

      topMeta.appendChild(metaLeft);
      topMeta.appendChild(specsBtn);
      innerDiv.appendChild(topMeta);

      // Title
      const h3 = document.createElement('h3');
      h3.textContent = p.title;
      innerDiv.appendChild(h3);

      // Description
      const desc = document.createElement('p');
      desc.textContent = p.description;
      innerDiv.appendChild(desc);

      // Tech Stack Badges
      const stackDiv = document.createElement('div');
      stackDiv.className = 'project-stack';
      const tags = Array.isArray(p.tags) && p.tags.length > 0 ? p.tags : (matched.stack || []);
      tags.forEach((tag, tIdx) => {
        const span = document.createElement('span');
        span.className = tIdx < 3 ? 'badge badge-cyan' : (tIdx < 5 ? 'badge badge-indigo' : 'badge');
        span.textContent = tag;
        stackDiv.appendChild(span);
      });
      innerDiv.appendChild(stackDiv);

      card.appendChild(innerDiv);

      // Card Bottom Actions
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'project-card__actions';

      const archBtn = document.createElement('button');
      archBtn.className = 'btn btn--outline btn--sm';
      archBtn.textContent = 'Architecture & Specs';
      archBtn.addEventListener('click', () => {
        if (typeof window.openProjectModal === 'function') {
          window.openProjectModal(projId);
        }
      });
      actionsDiv.appendChild(archBtn);

      const linksDiv = document.createElement('div');
      linksDiv.className = 'project-action-links';

      const safeGithub = sanitizeUrl(p.github_url);
      if (safeGithub) {
        const ghLink = document.createElement('a');
        ghLink.href = safeGithub;
        ghLink.target = '_blank';
        ghLink.rel = 'noopener noreferrer';
        ghLink.className = 'project-link';
        ghLink.innerHTML = '<i class="fa-brands fa-github"></i> Code';
        linksDiv.appendChild(ghLink);
      }

      const safeLive = sanitizeUrl(p.live_url);
      if (safeLive) {
        const liveLink = document.createElement('a');
        liveLink.href = safeLive;
        liveLink.target = '_blank';
        liveLink.rel = 'noopener noreferrer';
        liveLink.className = 'project-link';
        liveLink.innerHTML = '<span class="live-pulse"></span> Live <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 11px; margin-left: 3px;"></i>';
        linksDiv.appendChild(liveLink);
      }

      actionsDiv.appendChild(linksDiv);
      card.appendChild(actionsDiv);

      fragment.appendChild(card);
    });

    // Replace projectGrid with dynamic cards
    grid.innerHTML = '';
    grid.appendChild(fragment);

    // Re-bind interactive features, tilt, glare, and filtering
    bindCardPhysics();
    console.log(`[PortfolioSync] Successfully synchronized ${projects.length} database projects.`);
  }

  function applyDynamicProfile(profile) {
    const bioModal = document.querySelector('.profile-modal-bio');
    if (bioModal && profile.bio) {
      bioModal.textContent = profile.bio;
    }
    const nameEl = document.querySelector('.profile-modal-name');
    if (nameEl && profile.full_name) {
      nameEl.textContent = profile.full_name;
    }
    const roleEl = document.querySelector('.profile-modal-role');
    if (roleEl && profile.headline) {
      roleEl.textContent = profile.headline;
    }
  }

  function renderDynamicEducation(eduList) {
    const timeline = document.querySelector('.edu-timeline');
    if (!timeline) return;

    const frag = document.createDocumentFragment();
    eduList.forEach(item => {
      const div = document.createElement('div');
      div.className = 'edu-item';

      const iconDiv = document.createElement('div');
      iconDiv.className = 'edu-item__icon';
      iconDiv.innerHTML = '<i class="fa-solid fa-graduation-cap"></i>';

      const bodyDiv = document.createElement('div');
      bodyDiv.className = 'edu-item__body';

      const rangeSpan = document.createElement('span');
      rangeSpan.className = 'edu-item__range mono';
      rangeSpan.textContent = `${item.start_date} - ${item.end_date || 'Present'}`;

      const h3 = document.createElement('h3');
      h3.textContent = item.degree;

      const schoolP = document.createElement('p');
      schoolP.className = 'edu-item__school';
      schoolP.textContent = item.institution;

      bodyDiv.appendChild(rangeSpan);
      bodyDiv.appendChild(h3);
      bodyDiv.appendChild(schoolP);

      div.appendChild(iconDiv);
      div.appendChild(bodyDiv);

      if (item.grade) {
        const badge = document.createElement('span');
        badge.className = 'gpa-badge mono';
        badge.textContent = item.grade;
        div.appendChild(badge);
      }

      frag.appendChild(div);
    });

    timeline.innerHTML = '';
    timeline.appendChild(frag);
  }

  function bindCardPhysics() {
    const cards = document.querySelectorAll('.project-card');

    // 1. 3D Hover tilt & glare
    cards.forEach(el => {
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotX = ((y - centerY) / centerY) * -5;
        const rotY = ((x - centerX) / centerX) * 5;
        el.style.transform = `perspective(800px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateY(-6px)`;
        el.style.setProperty('--mouse-x', `${((x / rect.width) * 100).toFixed(1)}%`);
        el.style.setProperty('--mouse-y', `${((y / rect.height) * 100).toFixed(1)}%`);
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    });

    // 2. Scroll reveal
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

      cards.forEach((card, index) => {
        card.classList.add('reveal-on-scroll');
        card.style.transitionDelay = `${(index % 4) * 0.08}s`;
        observer.observe(card);
      });
    } else {
      cards.forEach(card => card.classList.add('is-revealed'));
    }

    // 3. Dynamic Filter Tabs Delegation
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
      // Clone tab to strip older listeners
      const newTab = tab.cloneNode(true);
      tab.parentNode.replaceChild(newTab, tab);

      newTab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('is-active'));
        newTab.classList.add('is-active');

        const filter = newTab.getAttribute('data-filter') || 'all';
        const currentCards = document.querySelectorAll('.project-card');
        currentCards.forEach(card => {
          if (filter === 'all') {
            card.style.display = 'flex';
          } else {
            const categories = card.getAttribute('data-category') || '';
            card.style.display = categories.includes(filter) ? 'flex' : 'none';
          }
        });
      });
    });

    // Re-apply the currently active filter
    const activeTab = document.querySelector('.filter-tab.is-active');
    if (activeTab) {
      const activeFilter = activeTab.getAttribute('data-filter') || 'all';
      cards.forEach(card => {
        if (activeFilter === 'all') {
          card.style.display = 'flex';
        } else {
          const categories = card.getAttribute('data-category') || '';
          card.style.display = categories.includes(activeFilter) ? 'flex' : 'none';
        }
      });
    }
  }

  function sanitizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const trimmed = rawUrl.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return null;
  }

})();
