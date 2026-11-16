/*!
 * JT Handyman Solutionz – temporary Christmas notice
 * ONE shared file: every landing page loads this, so dates and wording live only here.
 * Dates are read in Australia/Melbourne time (not the visitor's own time zone).
 *
 *   up to 17 Dec 2026       -> "Booking now" messages
 *   18 Dec 2026 – 3 Jan 2027 -> "Closed" messages
 *   from 4 Jan 2027          -> script does nothing (original top bar / form note, no mobile bar)
 *
 * It only touches: #top-bar, #form-note, and a bottom bar it creates itself (#xmas-bar).
 * It never touches the callback form fields, the Zapier webhook, GTM / gtag, the estimator iframe or the ticker.
 */
(function () {
  'use strict';

  /* ================= SETTINGS (edit dates / wording here only) ================= */
  var TZ = 'Australia/Melbourne';
  var BOOKING_UNTIL = '2026-12-17';   // last day of the "booking now" message (inclusive)
  var CLOSED_FROM   = '2026-12-18';   // first day closed
  var CLOSED_UNTIL  = '2027-01-03';   // last day closed (inclusive). From the next day everything reverts.

  var TEXT = {
    booking: {
      bar:    'Booking now for jobs before our Christmas break (18 Dec)',
      mobile: 'Booking jobs before 18 Dec',
      form:   'Booking now for jobs before 18 Dec',
      ctaHead: 'Ready to get your outdoor space sorted before Christmas?',
      ctaLead: 'Repairs and restorations: booking now ahead of our 18 Dec break. Planning a new deck or pergola? Send us your job brief to discuss an early January start.'
    },
    closed: {
      bar:    'Closed 18 Dec – 3 Jan · Send your request and we’ll reply from 4 Jan',
      mobile: 'Closed 18 Dec–3 Jan · Reply 4 Jan',
      form:   'We’re on a break until 3 Jan. Send your request and we’ll reply from 4 Jan.',
      promise: 'We’re closed until 4 Jan. Submit your request now to lock in an early January start.',
      ctaHead: 'Planning outdoor work for the new year?',
      ctaLead: 'We’re closed from 18 Dec to 3 Jan. You can still send us your request or job brief, and our team will get back to you from 4 Jan.'
    }
  };
  // Last working day(s) before the break: the "2 business hours / 48 hours" promise can't be kept, so the line under the form changes.
  // Change PROMISE_STOPS_FROM to start this earlier (e.g. '2026-12-15'). It runs up to BOOKING_UNTIL.
  var PROMISE_STOPS_FROM = '2026-12-16';
  var PROMISE_LAST_DAYS = 'We close for Christmas on 18 Dec. Submit your request now to lock in an early January start.';
  var BUTTON_LABEL = 'Get my price';

  /* ===== TEST-DATE OVERRIDE (temporary — delete this whole block before you go live) =====
   * Preview any date by adding ?xmas=YYYY-MM-DD to a page URL, e.g.
   *   /plumbing.html?xmas=2026-12-10   -> "booking now" state
   *   /plumbing.html?xmas=2026-12-20   -> "closed" state
   *   /plumbing.html?xmas=2027-01-05   -> back to normal (original text, no mobile bar)
   * The chosen test date sticks while you click around that tab. Use ?xmas=reset to clear it.
   */
  var TEST_OVERRIDE = (function () {
    try {
      var m = /[?&]xmas=([^&#]*)/.exec(window.location.search);
      if (m) {
        if (m[1] === 'reset') { sessionStorage.removeItem('jt_xmas_test'); return null; }
        if (/^\d{4}-\d{2}-\d{2}$/.test(m[1])) { sessionStorage.setItem('jt_xmas_test', m[1]); return m[1]; }
      }
      return sessionStorage.getItem('jt_xmas_test');
    } catch (e) { return null; }
  })();
  /* ===== END TEST-DATE OVERRIDE ===== */

  function melbourneToday() {
    if (typeof TEST_OVERRIDE !== 'undefined' && TEST_OVERRIDE) return TEST_OVERRIDE;
    // en-CA gives YYYY-MM-DD, which compares correctly as plain text
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  var state = 'off', today = '';
  try {
    today = melbourneToday();
    if (today <= BOOKING_UNTIL) state = 'booking';
    else if (today >= CLOSED_FROM && today <= CLOSED_UNTIL) state = 'closed';
  } catch (e) { state = 'off'; }

  if (state === 'off') return;           // from 4 Jan: touch nothing
  var T = TEXT[state];

  function run() {
    /* 1. top bar text */
    var topBar = document.getElementById('top-bar');
    if (topBar) topBar.textContent = T.bar;

    /* 2. small grey line under the form heading */
    var note = document.getElementById('form-note');
    if (note) note.textContent = T.form;

    /* 2a. promise line under the Submit button (normal wording lives in the page; only the closed period changes it) */
    var pr = document.getElementById('form-promise'); if (pr) {
      if (state === 'booking' && today >= PROMISE_STOPS_FROM) pr.textContent = PROMISE_LAST_DAYS;
      else if (T.promise) pr.textContent = T.promise;
    }

    /* 2b. outdoor-construction page final CTA (other pages have no #cta-heading / #cta-lead, so this is skipped there) */
    var ch = document.getElementById('cta-heading'); if (ch && T.ctaHead) ch.textContent = T.ctaHead;
    var cl = document.getElementById('cta-lead');    if (cl && T.ctaLead) { cl.textContent = T.ctaLead; cl.hidden = false; }

    /* 3. styles (sticky top bar on desktop, bottom bar on mobile) */
    var css = ''
      + '#xmas-bar{display:none}'
      + '@media (min-width:768px){'
      +   'html.xmas-on #top-bar{position:sticky;top:0;z-index:101;box-sizing:border-box;height:36px;padding:0 16px;line-height:36px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.1em}'
      +   'html.xmas-on .site-header{top:36px !important}'                      /* header sits directly under the bar, one unit */
      +   'html.xmas-on .hero2-grid > div:first-child{top:166px !important}'    /* was 130px: +36px for the bar */
      +   'html.xmas-on #jobBriefCard{scroll-margin-top:128px !important}'      /* was 92px: +36px for the bar */
      + '}'
      + '@media (max-width:767.98px){'
      +   '#xmas-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;position:fixed;left:0;right:0;bottom:0;z-index:190;'
      +     'box-sizing:border-box;background:#0c0d0f;border-top:2px solid #e7161f;color:#fff;padding:7px 12px calc(7px + env(safe-area-inset-bottom));font-family:inherit}'
      +   '#xmas-bar .xb-msg{flex:1;min-width:0;font-size:.74rem;font-weight:600;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      +   '#xmas-bar .xb-btn{flex:none;background:#e7161f;color:#fff;border:0;border-radius:6px;padding:8px 14px;font-size:.78rem;font-weight:700;letter-spacing:.03em;text-transform:uppercase;text-decoration:none;cursor:pointer}'
      +   '@media (max-width:360px){#xmas-bar .xb-msg{font-size:.66rem}#xmas-bar .xb-btn{padding:8px 9px;font-size:.74rem}}'
      +   '#xmas-bar.xb-hide,body.modal-open #xmas-bar{display:none !important}'
      + '}';
    var style = document.createElement('style');
    style.id = 'xmas-style';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
    document.documentElement.classList.add('xmas-on');

    /* 4. mobile bottom bar */
    var bar = document.createElement('div');
    bar.id = 'xmas-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Christmas opening notice');
    var msg = document.createElement('span'); msg.className = 'xb-msg'; msg.textContent = T.mobile;
    var btn = document.createElement('a'); btn.className = 'xb-btn'; btn.href = '#'; btn.textContent = BUTTON_LABEL;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      // exactly what the "Get a Rough Estimate" buttons do: opens the estimator
      try { if (typeof fireRedTrackClick === 'function') fireRedTrackClick(); } catch (x) {}
      if (typeof openQuoteModal === 'function') openQuoteModal('xmas_sticky_bar');
    });
    bar.appendChild(msg); bar.appendChild(btn);
    document.body.appendChild(bar);

    /* 5. keep clear of the existing call bar, leave room at the bottom of the page */
    var mq = window.matchMedia('(max-width: 767.98px)');
    function layout() {
      if (!mq.matches) { bar.style.bottom = ''; document.body.style.paddingBottom = ''; return; }
      var mb = document.querySelector('.mobile-bar');
      var mbH = (mb && getComputedStyle(mb).display !== 'none') ? mb.offsetHeight : 0;
      bar.style.bottom = mbH + 'px';
      document.body.style.paddingBottom = (mbH + bar.offsetHeight + 8) + 'px';
    }
    layout();
    window.addEventListener('resize', layout);
    window.addEventListener('orientationchange', layout);
    window.addEventListener('load', layout);

    /* 6. never sit on top of the hero form: hide the bar while the form is on screen */
    var card = document.getElementById('jobBriefCard');
    if (card && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        bar.classList.toggle('xb-hide', entries[0].isIntersecting);
      }, { threshold: 0 }).observe(card);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
