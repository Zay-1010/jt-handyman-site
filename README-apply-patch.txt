HOW TO APPLY: meta-capi-bridge.patch
======================================

WHAT THIS DOES
--------------
Adds a shared helper (jtBuildQuoteFrameParams) to js/main.js, and updates
the quote-modal script on 51 pages so the #quoteFrame iframe URL carries:
  - every existing query param on the page (fbclid, utm_*, etc.)
  - fbp (from the _fbp cookie, if the Meta Pixel has set one)
  - fbc (from the _fbc cookie, if the Meta Pixel has set one)

This lets the estimator backend (once updated by the developer) pull
fbclid/fbp/fbc out of its own incoming request and include them in its
Meta CAPI payload for better Lead-event attribution.

Tested: applies cleanly against a fresh clone of your repo as of today
(Sept 5, 2026), 52 files changed, no conflicts.

STEPS
-----
1. Open a terminal, go to your local copy of the repo:
     cd path/to/jt-handyman-site

2. Make sure your local copy is up to date and has no uncommitted changes:
     git status
     git pull

3. Put meta-capi-bridge.patch in that same folder, then run:
     git apply --check meta-capi-bridge.patch
   This just checks it will apply cleanly — it won't change anything yet.
   If it says nothing / no errors, you're good to continue.

4. Actually apply it:
     git apply meta-capi-bridge.patch

5. Review the changes:
     git diff --stat
     git diff js/main.js
   (Spot check a page or two if you like, e.g. git diff carpentry.html)

6. Commit and push:
     git add -A
     git commit -m "Forward fbclid/fbp/fbc into quote iframe for Meta CAPI attribution"
     git push

7. Vercel will auto-deploy from the push (same as your usual workflow).
   Once live, open any page, click the quote button, and check the
   Network tab or just view the iframe's src — it should now have
   ?fbclid=...&fbp=...&fbc=... appended (values depend on how you
   arrived at the page).

IF THE PATCH DOESN'T APPLY CLEANLY
-----------------------------------
This would only happen if the repo has changed since this patch was
generated (e.g. someone edited one of these 51 files in the meantime).
If step 3 reports an error, don't force it — send me the specific file(s)
it's complaining about and I'll regenerate the patch against your current
version instead.

WHAT'S STILL NEEDED (not in this patch)
-----------------------------------------
This only covers the landing page side. The estimator backend (developer's
code at jthandymansolutionz.com.au/estimate) still needs to:
  - read fbclid, fbp, fbc from its own incoming request's query string
  - include them in the CAPI payload sent to Meta
  - client_ip_address and client_user_agent don't need any of this —
    the backend can read those directly off the incoming HTTP request
    it already receives, no bridging required.
