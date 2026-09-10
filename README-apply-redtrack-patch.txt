HOW TO APPLY: redtrack-click-notify.patch
============================================

WHAT THIS DOES
--------------
Adds a new function (fireRedTrackClick) to js/main.js, and updates the
"Get a Quote" button across 61 JT Handyman pages so that clicking it
also fires a background notification to RedTrack's /click endpoint,
alongside opening the quote modal as before.

This does NOT change the quote modal, the iframe, or anything about
how the estimator loads. It's purely additive — a background call
that tells RedTrack "someone clicked the quote button," so RedTrack
can start counting Landing Page Clicks for this Lander→Offer step.

IMPORTANT CONTEXT
------------------
As of tonight, RedTrack's /click endpoint has a separate, unresolved
issue on their end: it currently redirects back to the Landing page
instead of to the configured Offer. A support ticket has been sent
about this. This patch is safe to apply regardless, but Landing Page
Click counts may not show real numbers until RedTrack resolves that
issue on their side.

JT Compliance pages (jtcompliance.html, jtcompliance-blog.html) are
correctly excluded — they have a same-named but unrelated
openQuoteModal() function for a different purpose, and are not part
of this fix.

STEPS
-----
1. cd into your local repo folder (same one used for the previous patch).

2. Make sure it's up to date:
     git status
     git pull

3. Check the patch applies cleanly:
     git apply --check redtrack-click-notify.patch
   Tested tonight against a fresh clone — applies cleanly with no
   conflicts.

4. Apply it:
     git apply redtrack-click-notify.patch

5. Review:
     git diff --stat
   Should show 62 files changed (61 HTML pages + js/main.js).

6. Commit and push:
     git add -A
     git commit -m "Add RedTrack click notification on quote button (Lander->Offer tracking)"
     git push

7. Vercel will auto-deploy as usual.

VERIFYING IT WORKS
-------------------
Once live, open any service page, open DevTools > Network tab, click
the quote button, and look for a request to:
  track.jthandymansolutionz.com.au/click?clickid=...
It should fire alongside the modal opening. A successful request
confirms the code is working — actual Landing Page Click counts in
RedTrack's dashboard depend on RedTrack resolving the redirect issue
mentioned above.
