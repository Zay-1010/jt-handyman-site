// Run from the landing-page repo root:  node add-anna-review.js
// Adds Anna G.'s Google review as its own band, directly below the "Get your outdoor space ready for summer" section
// of outdoor-construction.html. Safe to run twice; it also moves the review if an earlier version put it somewhere else.
const fs = require('fs');
const f = 'outdoor-construction.html';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('<!-- Featured review: own band -->')) { console.log('Already added.'); process.exit(0); }
// remove earlier placements (under the Google reviews box, or inside the summer section)
s = s.replace(/[ \t]*<!-- Featured review \(outdoor page\) -->\s*<div class="review-cards"[\s\S]*?<\/cite>\s*<\/div>\s*<\/div>\n?/, '');
s = s.replace(/[ \t]*<!-- Featured review: summer section -->\s*<div class="review-cards"[\s\S]*?<\/cite>\s*<\/div>\s*<\/div>\n?/, '');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
const h = s.indexOf('Get your outdoor space ready for summer.</h2>');
const end = h < 0 ? -1 : s.indexOf('</section>', h);
if (end < 0) { console.error('Could not find the summer section — nothing changed.'); process.exit(1); }
const at = end + '</section>'.length;
const BAND = `

<!-- Featured review: own band -->
<section class="section band-white" style="padding-top:44px;padding-bottom:44px;">
  <div class="container">
    <div class="review-cards" style="grid-template-columns:1fr;max-width:760px;margin:0 auto;">
      <div class="docket">
        <div class="docket-head"><span class="docket-stars">★★★★★</span></div>
        <blockquote style="font-style:italic;">Really good service. Good value. Worked with three owners who have shared decking on first floor… Alexi really problem solved and was flexible… All three owners really happy with the job they did. Left the site tidy, and was a great communicator.</blockquote>
        <cite>Anna G.<span>Google review</span></cite>
      </div>
    </div>
  </div>
</section>`.replace(/\n/g, eol);
fs.writeFileSync(f, s.slice(0, at) + BAND + s.slice(at));
console.log('Added below the summer section of ' + f);
