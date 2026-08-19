// ============================================
// Background prefetch — Recent Jobs data
// ============================================
// Runs immediately on script load (not waiting for DOMContentLoaded,
// since it never touches the DOM at all — just fetches and caches).
// This ONLY stores data; it never renders anything. Rendering stays
// entirely the responsibility of recent-jobs.html's own script, which
// checks this cache first. Keeping fetch and render fully separate is
// deliberate — it's exactly what avoids the earlier bug where two
// scripts fought over writing the same page element.
(function () {
  const isRecentJobsPage = window.location.pathname.endsWith('recent-jobs.html');
  if (isRecentJobsPage) return; // that page does its own fresh fetch; no need to also prefetch here

  const CACHE_KEY = 'jt_recent_jobs_prefetch';
  const CACHE_TIME_KEY = 'jt_recent_jobs_prefetch_time';
  const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

  const cachedTime = sessionStorage.getItem(CACHE_TIME_KEY);
  const isFresh = cachedTime && (Date.now() - parseInt(cachedTime, 10)) < CACHE_MAX_AGE_MS;
  if (isFresh) return; // already have a recent enough copy this session

  fetch('/api/recent-jobs')
    .then(res => (res.ok ? res.json() : null))
    .then(data => {
      if (data && data.jobs) {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
        sessionStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      }
    })
    .catch(err => console.error('[prefetch] recent-jobs background fetch failed:', err.message));
})();

// ============================================
// Shared site behaviour — nav, filters
// ============================================
document.addEventListener('DOMContentLoaded', () => {

  // --- Mobile nav toggle ---
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.main-nav');
  const openIcon = document.querySelector('.nav-toggle-icon-open');
  const closeIcon = document.querySelector('.nav-toggle-icon-close');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen);
      if (openIcon && closeIcon) {
        openIcon.style.display = isOpen ? 'none' : 'block';
        closeIcon.style.display = isOpen ? 'block' : 'none';
      }
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      if (openIcon && closeIcon) {
        openIcon.style.display = 'block';
        closeIcon.style.display = 'none';
      }
      const dropdown = document.querySelector('.has-dropdown');
      if (dropdown) dropdown.classList.remove('expanded');
    }));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        if (openIcon && closeIcon) {
          openIcon.style.display = 'block';
          closeIcon.style.display = 'none';
        }
      }
    });
  }

  // --- Services dropdown (mobile expand/collapse toggle) ---
  const dropdownToggle = document.querySelector('.dropdown-toggle');
  const dropdownParent = document.querySelector('.has-dropdown');
  if (dropdownToggle && dropdownParent) {
    dropdownToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isExpanded = dropdownParent.classList.toggle('expanded');
      dropdownToggle.setAttribute('aria-expanded', isExpanded);
    });
  }

  // --- Gallery / blog filters (data-filter-group) ---
  document.querySelectorAll('[data-filter-group]').forEach(group => {
    const targetSelector = group.dataset.filterGroup;
    const items = document.querySelectorAll(targetSelector);
    group.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.filter;
        items.forEach(item => {
          const match = cat === 'all' || item.dataset.category === cat;
          item.style.display = match ? '' : 'none';
        });
        const countEl = document.querySelector('[data-filter-count]');
        if (countEl) {
          const visible = Array.from(items).filter(i => i.style.display !== 'none').length;
          countEl.textContent = cat === 'all'
            ? `Showing all ${items.length} jobs`
            : `Showing ${visible} job${visible === 1 ? '' : 's'} in ${btn.textContent.trim()}`;
        }
      });
    });
  });

  // NOTE: the recent-jobs ticker + list feed used to be loaded from here,
  // but that duplicated (and conflicted with) the working fetch scripts
  // already embedded directly in each page (index.html's ticker script,
  // recent-jobs.html's list script, etc). Removed to fix a bug where this
  // older version — expecting a different API response shape — was
  // silently overwriting the correctly-loaded real data with fallback
  // placeholder text a few seconds after page load.

});