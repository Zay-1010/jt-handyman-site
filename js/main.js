// ============================================
// Shared site behaviour — nav, ticker, filters
// ============================================
document.addEventListener('DOMContentLoaded', () => {

  // --- Mobile nav toggle ---
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', nav.classList.contains('open'));
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
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

  // --- Recent jobs feed (ticker + recent-jobs page list) ---
  // Pulls from our backend, which proxies ServiceM8 and strips any
  // personal/address details — only job category, suburb and date.
  loadRecentJobs();
});

async function loadRecentJobs() {
  const tickerTrack = document.querySelector('[data-job-ticker]');
  const listTarget = document.querySelector('[data-job-list]');
  if (!tickerTrack && !listTarget) return;

  try {
    const res = await fetch('/api/recent-jobs');
    if (!res.ok) throw new Error('feed unavailable');
    const jobs = await res.json();
    if (!Array.isArray(jobs) || jobs.length === 0) throw new Error('empty');

    if (tickerTrack) {
      tickerTrack.innerHTML = jobs.map((j, i) =>
        `<span class="job-ticker-item${i === 0 ? ' show' : ''}">${j.category} — <span class="muted">${j.suburb} · ${j.date}</span></span>`
      ).join('');
      let idx = 0;
      const items = tickerTrack.querySelectorAll('.job-ticker-item');
      if (items.length > 1) {
        setInterval(() => {
          items[idx].classList.remove('show');
          idx = (idx + 1) % items.length;
          items[idx].classList.add('show');
        }, 3200);
      }
    }

    if (listTarget) {
      listTarget.innerHTML = jobs.map(j => `
        <div class="docket">
          <div class="docket-head">
            <strong>${j.category}</strong>
            <span class="docket-id">JOB #${j.ref}</span>
          </div>
          <p style="margin:0;color:var(--slate);font-size:.9rem;">${j.suburb}, VIC · Completed ${j.date}</p>
        </div>
      `).join('');
    }
  } catch (e) {
    // Fallback placeholder state — shown until ServiceM8 API is connected
    const fallback = [
      { category: 'Bathroom & tiling', suburb: 'Reservoir', date: 'this week' },
      { category: 'Carpentry & doors', suburb: 'Brunswick', date: 'this week' },
      { category: 'Fencing & gates', suburb: 'South Yarra', date: 'last week' },
    ];
    if (tickerTrack) {
      tickerTrack.innerHTML = fallback.map((j, i) =>
        `<span class="job-ticker-item${i === 0 ? ' show' : ''}">${j.category} — <span class="muted">${j.suburb} · ${j.date}</span></span>`
      ).join('');
    }
    if (listTarget) {
      listTarget.innerHTML = `<p style="color:var(--slate);">Live feed connects once the ServiceM8 API key is added on the server (see README). Showing placeholder jobs for now.</p>` +
        fallback.map(j => `
          <div class="docket">
            <div class="docket-head"><strong>${j.category}</strong><span class="docket-id">PLACEHOLDER</span></div>
            <p style="margin:0;color:var(--slate);font-size:.9rem;">${j.suburb}, VIC · Completed ${j.date}</p>
          </div>
        `).join('');
    }
  }
}
