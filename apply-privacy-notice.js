// Also lightens the select/placeholder text in the callback form.
// Adds (1) a Privacy Policy link to the footer and (2) a consent line under the
// callback form's submit button. Safe to run more than once. Usage: node apply-privacy-notice.js
const fs = require('fs'), path = require('path');
const URL = 'https://jthandymansolutionz.com.au/privacy-policy';
const LINE = `\n          <p class="form-privacy" style="margin:8px 0 0;font-size:.78rem;line-height:1.5;font-weight:400;color:#767676;text-align:center;">Unsubscribe any time. <a href="${URL}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;">Privacy policy</a></p>`;
const FOOT = `\n      <span><a href="${URL}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;">Privacy Policy</a></span>`;
const POLISH = `\n<style id="form-polish">/* lighter placeholder text in the callback form */\nselect:required:invalid,select:has(option[value=""]:checked){color:#98a1ab}\nselect option{color:#1b1b1c}\nform input::placeholder,form textarea::placeholder{color:#a3abb5;opacity:1}</style>`;
let changed = 0;
for (const f of fs.readdirSync('.').filter((n) => n.endsWith('.html'))) {
  let h = fs.readFileSync(f, 'utf8'), o = h;
  if (!h.includes('class="form-privacy"')) {
    h = h.replace(/(<p id="form-promise"[^>]*>[^<]*<\/p>)/, '$1' + LINE);
  }
  if (!h.includes('class="footer-privacy"') && /footer-bottom/.test(h) && !h.includes(`>Privacy Policy</a></span>\n      <span>©`)) {
    h = h.replace(/(\n\s*)(<span>©[^<]*<\/span>)/, FOOT.replace('<span>', '<span class="footer-privacy">') + '$1$2');
  }
  if (h.includes('</head>')) { h = h.replace(/\n?<style id="form-polish">.*?<\/style>\n?/s, ''); h = h.replace('</head>', POLISH + '\n</head>'); }
  if (h !== o) { fs.writeFileSync(f, h); changed++; console.log('updated', f); }
}
console.log(changed + ' file(s) updated');
