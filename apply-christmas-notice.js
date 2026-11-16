// Run once from the root of the landing-page repo:   node apply-christmas-notice.js
// Safe to run again: it skips anything already done. It only adds ids, one link and one <script> tag.
const fs = require('fs'), path = require('path');
const SKIP = new Set(['thank-you-quote.html', 'index_live_widescreen.html']);
const NUDGE = '\n          <p id="estimator-nudge" style="margin:10px 0 0;text-align:center;font-size:.88rem;"><a href="javascript:void(0)" onclick="if(typeof closeBriefModal===\'function\'){closeBriefModal();} fireRedTrackClick(); openQuoteModal(\'hero_form_link\');" style="color:#e7161f;font-weight:700;">Want a price now? Get a rough estimate in 2 minutes &rarr;</a></p>';
const SCRIPT = '<script src="js/christmas-notice.js?v=1" defer></script>';
const report = [];
for (const f of fs.readdirSync('.').filter((x) => x.endsWith('.html') && !SKIP.has(x)).sort()) {
  let s = fs.readFileSync(f, 'utf8'), o = s, did = [];
  // JT Compliance is a different business: never touch it (by file name or by page content)
  if (/compliance/i.test(f) || /jtcompliance|JT Compliance/i.test((s.match(/<title>[^<]*<\/title>/) || [''])[0])) { report.push(f + ': skipped (JT Compliance)'); continue; }
  if (!s.includes('class="top-strip"')) { report.push(f + ': skipped (no top bar)'); continue; }
  if (!s.includes('id="top-bar"')) { s = s.replace('<div class="top-strip">', '<div class="top-strip" id="top-bar">'); did.push('top-bar'); }
  if (!s.includes('id="form-note"')) {
    const n = s.replace(/<p ([^>]*)>(We'd love a photo of the job\.)/, '<p id="form-note" $1>$2');
    if (n !== s) { s = n; did.push('form-note'); }
  }
  if (!s.includes('christmas-notice.js')) {
    const n = s.replace(/(<script src="js\/main\.js"[^>]*><\/script>)/, '$1\n' + SCRIPT);
    if (n !== s) { s = n; did.push('script'); }
  }
  if (s !== o) fs.writeFileSync(f, s);
  report.push(f + ': ' + (did.length ? did.join(', ') : 'already done'));
}
console.log(report.join('\n'));
