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
    }));
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