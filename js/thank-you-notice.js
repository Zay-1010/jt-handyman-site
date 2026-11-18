/*!
 * JT Handyman Solutionz – Christmas wording for thank-you-quote.html
 * Same Melbourne-time dates as js/christmas-notice.js. Edit dates / wording here only.
 *   up to 15 Dec 2026        -> page's normal wording (untouched)
 *   16 – 17 Dec 2026         -> "We close for Christmas on 18 Dec"
 *   18 Dec 2026 – 3 Jan 2027 -> "We're closed until 4 Jan"
 *   from 4 Jan 2027          -> normal wording again (script does nothing)
 * Only changes #ty-lede and #ty-step2. Does not touch the tracking script on the page.
 */
(function () {
  'use strict';
  var TZ = 'Australia/Melbourne';
  var LAST_DAYS_FROM = '2026-12-16';
  var CLOSED_FROM    = '2026-12-18';
  var CLOSED_UNTIL   = '2027-01-03';

  var TEXT = {
    lastdays: {
      lede:  'We&rsquo;ve got your job brief and will be in touch as soon as we can. We close for Christmas on 18 Dec, so if we can&rsquo;t reach you before then, we&rsquo;ll be in touch from 4 Jan.',
      step2: '<strong>We contact you.</strong> We&rsquo;ll be in touch as soon as we can. If we can&rsquo;t get to you before we close on 18 Dec, we&rsquo;ll reach out from 4 Jan.'
    },
    closed: {
      lede:  'We&rsquo;re closed until 4 Jan. We&rsquo;ve got your job brief and will be in touch when we&rsquo;re back, to lock in an early January start.',
      step2: '<strong>We contact you.</strong> We&rsquo;re closed until 4 Jan, so we&rsquo;ll be in touch when we&rsquo;re back.'
    }
  };

  /* ===== TEST-DATE OVERRIDE (delete this block after the break; same switch as the other pages) =====
   * Add ?xmas=2026-12-16 (or 12-20, or 2027-01-05) to the thank-you page URL to preview. ?xmas=reset clears it. */
  var TEST = (function () {
    try {
      var m = /[?&]xmas=([^&#]*)/.exec(location.search);
      if (m) {
        if (m[1] === 'reset') { sessionStorage.removeItem('jt_xmas_test'); return null; }
        if (/^\d{4}-\d{2}-\d{2}$/.test(m[1])) { sessionStorage.setItem('jt_xmas_test', m[1]); return m[1]; }
      }
      return sessionStorage.getItem('jt_xmas_test');
    } catch (e) { return null; }
  })();
  /* ===== END TEST-DATE OVERRIDE ===== */

  var today = TEST || new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  var state = null;
  if (today >= LAST_DAYS_FROM && today < CLOSED_FROM) state = 'lastdays';
  else if (today >= CLOSED_FROM && today <= CLOSED_UNTIL) state = 'closed';
  if (!state) return;

  function run() {
    var lede = document.getElementById('ty-lede'); if (lede) lede.innerHTML = '<strong>' + TEXT[state].lede + '</strong>';
    var s2 = document.getElementById('ty-step2'); if (s2) s2.innerHTML = TEXT[state].step2;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
