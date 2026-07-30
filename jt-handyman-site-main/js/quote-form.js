// ============================================
// Instant quote form → /api/submit-quote → ServiceM8
// IMPORTANT: the ServiceM8 API key is never used in this file.
// It lives server-side only (see /api/submit-quote.js + README).
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#quote-form');
  if (!form) return;

  // Pre-select the service dropdown if the visitor arrived from a
  // trade-specific landing page, e.g. carpentry.html links to
  // contact.html?service=Carpentry%20%26%20Doors
  const params = new URLSearchParams(window.location.search);
  const preselect = params.get('service');
  if (preselect) {
    const select = form.querySelector('#service');
    if (select) {
      const match = Array.from(select.options).find(
        (opt) => opt.value.toLowerCase() === preselect.toLowerCase()
      );
      if (match) select.value = match.value;
    }
  }

  const statusEl = form.querySelector('.form-status');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.className = 'form-status';
    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = 'Sending…';

    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch('/api/submit-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(result.error || 'Something went wrong. Please call us instead.');

      statusEl.textContent = "Got it — that's logged as a job in our system. We'll be in touch shortly, often within the hour.";
      statusEl.classList.add('show', 'ok');
      form.reset();
    } catch (err) {
      statusEl.textContent = err.message.includes('fetch')
        ? "Couldn't reach our booking system right now — please call 1800 587 659 and we'll quote you on the spot."
        : err.message;
      statusEl.classList.add('show', 'err');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
});
