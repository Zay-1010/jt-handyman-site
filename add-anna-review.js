// Run from the landing-page repo root:  node add-anna-review.js
// Adds Anna G.'s Google review under the reviews widget on outdoor-construction.html (safe to run twice).
const fs = require('fs');
const f = 'outdoor-construction.html';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('Anna G.')) { console.log('Already added.'); process.exit(0); }
const CARD = `      <!-- Featured review (outdoor page) -->
      <div class="review-cards" style="margin-top:20px;">
        <div class="docket">
          <div class="docket-head"><span class="docket-stars">★★★★★</span></div>
          <blockquote style="font-style:italic;">Really good service. Good value. Worked with three owners who have shared decking on first floor… Alexi really problem solved and was flexible… All three owners really happy with the job they did. Left the site tidy, and was a great communicator.</blockquote>
          <cite>Anna G.<span>Google review</span></cite>
        </div>
      </div>
`;
const marker = '      <div id="reviewsFallback" hidden>';
if (!s.includes(marker)) { console.error('Could not find the reviews section — nothing changed.'); process.exit(1); }
fs.writeFileSync(f, s.replace(marker, CARD + marker));
console.log('Added to ' + f);
