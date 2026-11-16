// Run from the landing-page repo root:  node update-outdoor-cta.js
// Sets up the final CTA on outdoor-construction.html so christmas-notice.js can change its wording by date.
// What is written here is the NORMAL wording (from 4 Jan, or if the script fails to load): no extra lead line.
// Safe to run twice, and safe if you ran an earlier version.
const fs = require('fs');
const f = 'outdoor-construction.html';
let s = fs.readFileSync(f, 'utf8');
const re = /<h2[^>]*>Ready to get your outdoor space sorted[^<]*<\/h2>\s*(?:<p id="cta-lead"[^>]*>[^<]*<\/p>\s*|<p>Repairs and restorations[^<]*<\/p>\s*)?(?=<p>Tell us what you need built)/;
if (!re.test(s)) { console.error('Could not find the final CTA — nothing changed.'); process.exit(1); }
const out = s.replace(re, '<h2 id="cta-heading">Ready to get your outdoor space sorted?</h2>\n    <p id="cta-lead" hidden></p>\n    ');
if (out === s) { console.log('Already updated.'); process.exit(0); }
fs.writeFileSync(f, out);
console.log('Updated ' + f);
