// Run from the landing-page repo root:  node tweak-form-text.js
// 1) Removes the red "Want a price now? Get a rough estimate in 2 minutes" link under the callback form (if present).
// 2) Sets the line under the Submit button to the agreed wording and gives it an id (form-promise)
//    so christmas-notice.js can swap it during the shutdown (18 Dec - 3 Jan). It reverts by itself from 4 Jan.
// Skips JT Compliance pages. Safe to run twice, and safe if you ran an earlier version.
const fs = require('fs');
const P = /<p( id="form-promise")? style="(margin:10px 0 0;font-size:\.85rem;color:#3a4350;text-align:center;font-weight:600;)">(?:We'll be in touch as soon as we can during business hours, with a written quote within 48 hours\.|We'll get back to you as soon as possible during business hours, with a written quote within 48 hours\.|We'll be in touch within 2 business hours, and aim to provide a written quote within 48 hours\.|We'll be in touch within 2 business hours, with a written quote within 48 hours\.)<\/p>/g;
const NEW = '<p id="form-promise" style="$2">We\'ll be in touch within 2 business hours, with a written quote within 48 hours.</p>';
const NUDGE = /[ \t]*<p id="estimator-nudge"[\s\S]*?<\/p>\r?\n?/g;
const out = [];
for (const f of fs.readdirSync('.').filter((x) => x.endsWith('.html')).sort()) {
  let s = fs.readFileSync(f, 'utf8'), o = s;
  if (/compliance/i.test(f) || /jtcompliance|JT Compliance/i.test((s.match(/<title>[^<]*<\/title>/) || [''])[0])) continue;
  s = s.replace(NUDGE, '').replace(P, NEW);
  if (s !== o) { fs.writeFileSync(f, s); out.push(f); }
}
console.log(out.length ? 'Updated:\n' + out.join('\n') : 'Nothing to change.');
