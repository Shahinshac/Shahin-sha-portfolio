/**
 * Shahin Sha Portfolio - Dynamic Supabase Synchronization Engine
 * Dedicated Supabase Project: yaxyqpwsxknahehhmtch
 * Gracefully syncs published CMS content with static HTML fallback
 */

(function () {
  'use strict';

  // Config
  const SYNC_TIMEOUT_MS = 4000;

  document.addEventListener('DOMContentLoaded', () => {
    initPortfolioSync();
  });

  async function initPortfolioSync() {
    // Check if client is available
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
      // Fetch with timeout
      await Promise.race([
        syncPublishedContent(supabase),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), SYNC_TIMEOUT_MS))
      ]);
    } catch (err) {
      console.warn('[PortfolioSync] Fallback active:', err.message || err);
      // Static fallback remains in place
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
      return;
    }

    // Only overwrite static projects if database contains verified published projects
    if (Array.isArray(projects) && projects.length > 0) {
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
  }

  function renderDynamicProjects(projects) {
    const grid = document.getElementById('projectGrid');
    if (!grid) return;

    // Ensure global projectsData exists
    if (!window.projectsData) {
      window.projectsData = {};
    }

    // Build fragment safely
    const fragment = document.createDocumentFragment();

    projects.forEach((p, idx) => {
      const projNum = String(idx + 1).padStart(2, '0');
      const projId = p.id;

      // Update in-memory projectsData dictionary for the specs modal
      window.projectsData[projId] = {
        number: `PROJECT ${projNum}`,
        title: p.title,
        engineeringFocus: (p.tags && p.tags[0]) ? `${p.tags[0]} Architecture` : 'Full-Stack System',
        authRequired: false,
        overview: p.description,
        problem: p.description,
        solution: 'Engineered with clean architectural separation, relational database modeling, and performant REST APIs.',
        challenge: 'Maintaining high throughput, resilient caching, and strict transactional data consistency.',
        impact: 'Delivered robust system performance and streamlined workflows for end users.',
        architecture: (p.tags || []).join(' • '),
        stack: Array.isArray(p.tags) ? p.tags : [],
        keyFeatures: Array.isArray(p.tags) && p.tags.length > 0
          ? p.tags.map(t => `Engineered and integrated ${t}`)
          : ['Full-stack system integration'],
        github: sanitizeUrl(p.github_url),
        live: sanitizeUrl(p.live_url)
      };

      // Construct card DOM node safely
      const card = document.createElement('article');
      card.className = 'project-card';
      card.setAttribute('data-category', (p.category || 'fullstack').toLowerCase());

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
      focusSpan.textContent = (p.tags && p.tags[0]) ? p.tags[0] : (p.category || 'fullstack');
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
      (p.tags || []).forEach(tag => {
        const span = document.createElement('span');
        span.className = 'badge badge-cyan';
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
        liveLink.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i> Live';
        linksDiv.appendChild(liveLink);
      }

      actionsDiv.appendChild(linksDiv);
      card.appendChild(actionsDiv);

      fragment.appendChild(card);
    });

    // Replace projectGrid with dynamic cards
    grid.innerHTML = '';
    grid.appendChild(fragment);

    // Re-bind interactive features and animations
    bindCardPhysics();
    console.log(`[PortfolioSync] Successfully synchronized ${projects.length} database projects.`);
  }

  function applyDynamicProfile(profile) {
    // Safe updates to profile elements if present
    const bioModal = document.querySelector('.profile-modal-bio');
    if (bioModal && profile.bio) {
      bioModal.textContent = profile.bio;
    }
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

    // 3. Re-bind category filtering for active filter tab
    const activeFilterBtn = document.querySelector('.filter-tab.is-active');
    if (activeFilterBtn) {
      const filter = activeFilterBtn.getAttribute('data-filter') || 'all';
      cards.forEach(card => {
        if (filter === 'all') {
          card.style.display = 'flex';
        } else {
          const cats = card.getAttribute('data-category') || '';
          card.style.display = cats.includes(filter) ? 'flex' : 'none';
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
