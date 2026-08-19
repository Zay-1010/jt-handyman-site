// server.js — local dev server
//
// IMPORTANT: this file now uses the 'sharp' image library for photo
// quality analysis. Install it first:
//   npm install sharp
//
require('dotenv').config();
const express = require('express');
const path = require('path');
const sharp = require('sharp');

const app = express();

app.use(express.json()); // needed to parse JSON POST bodies from the test quote form
const PORT = process.env.PORT || 3000;
let galleryCache = null;
let galleryCacheTime = 0;
const GALLERY_CACHE_MS = 15 * 60 * 1000; // 15 minutes
const MAX_GALLERY_ITEMS = 16; // how many photos actually show on the page — keep this small enough to review/curate easily
const RECENT_JOBS_CACHE_MS = 60 * 60 * 1000; // 1 hour — longer than before, since the underlying ServiceM8 attachment fetch is heavy regardless of parallelization; minimizing how often it runs matters more than freshness here
let recentJobsCache = null;
let recentJobsCacheTime = 0;
let tickerCache = null;
let tickerCacheTime = 0;
const TICKER_CACHE_MS = 5 * 60 * 1000; // 5 minutes — this endpoint is hit on every single page load, so caching matters a lot here

app.use(express.static(path.join(__dirname)));

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ---- Manual exclude list ----
// The document/screenshot heuristic below is approximate, not perfect —
// when you spot a bad photo (invoice, screenshot, irrelevant shot) slip
// through into the gallery, grab its UUID from the image URL shown in
// your browser (e.g. /api/photo/THIS-PART-HERE) and add it below.
// It'll be excluded from the gallery immediately on next cache refresh.
const EXCLUDED_PHOTO_UUIDS = [
  '63a1cb24-908e-4120-88d3-21cff29ba14a', // invoice/document photo, Carpentry & Doors job, South Yarra
  'cd3b7c0c-5db4-4a43-8ada-21ceab1f9dda', // timber photo mislabeled "Plumbing & Leaks", Ringwood North
  '494cc103-50af-4c01-8547-21d18448ffaa', // gate-latch photo mislabeled "Bathrooms & Tiling", Malvern
  '79e20d92-67c9-4228-8053-21f8c70f75ba', // flagged as unsuitable/mismatched
  '90ae48b8-9563-43d2-a5b5-21db3d3426ca', // flagged as unsuitable/mismatched
  'be1f407e-c1e3-4b83-9880-21d6f96e1faa', // flagged as unsuitable/mismatched
  '005ec7a2-77f9-4fca-8b12-21ea7b14f1ea', // flagged as unsuitable/mismatched
  '2db9ef79-dfbd-4a56-b64e-21d8ea4ea07a', // flagged as unsuitable/mismatched
  '02714d50-0eb2-41c3-aa4e-21d5b244e7fa', // flagged as unsuitable/mismatched
  '953bde3f-5f30-4d37-bd3d-21d18ac9ed9a', // flagged as unsuitable/mismatched
  'c351a245-d77b-4517-8a56-21f8ce35134a', // flagged as unsuitable/mismatched
  'fca6699e-bf3d-43b8-bd30-21e1357df1ea', // flagged as unsuitable/mismatched
  '0ae3b6d9-ad2c-46ec-9b2f-21d2bf1cf61a', // flagged as unsuitable/mismatched
  '37554868-d8b7-4bd5-bcf3-21d5bfc9a62a', // flagged as unsuitable/mismatched
  '9159e2fd-4bc2-4db1-ab44-21d8eea2bd5a', // flagged as unsuitable/mismatched
  'fbe9d822-0c67-4272-ba74-21d6ff0cea1a', // flagged as unsuitable/mismatched
];

// ---- Trade category derived from job description keywords ----
const TRADE_KEYWORDS = [
  { label: 'Bathrooms & Tiling', words: ['bathroom', 'shower', 'tile', 'tiling', 'grout', 'waterproof', 'vanity'] },
  { label: 'Carpentry & Doors', words: ['door', 'frame', 'carpentry', 'hinge', 'handrail', 'deck', 'verandah', 'panelling', 'shelv', 'skirting', 'architrave'] },
  { label: 'Painting & Plastering', words: ['paint', 'plaster', 'crack', 'cornice', 'render', 'undercoat'] },
  { label: 'Flooring', words: ['floor', 'flooring', 'laminate', 'vinyl', 'carpet', 'timber floor'] },
  { label: 'Fencing & Gates', words: ['fence', 'fencing', 'gate', 'paling', 'trellis'] },
  { label: 'Kitchens', words: ['kitchen', 'cabinet', 'benchtop', 'cooktop', 'splashback'] },
  { label: 'Windows & Glazing', words: ['window', 'glazing', 'glass pane', 'sash'] },
  { label: 'Plumbing & Leaks', words: ['plumb', 'tap', 'drain', 'leak', 'pipe', 'toilet', 'hot water', 'blocked'] },
  { label: 'Roofing & Gutters', words: ['roof', 'gutter', 'downpipe', 'flashing'] },
];

function guessTrade(text) {
  if (!text) return 'General maintenance';
  const lower = text.toLowerCase();
  for (const { label, words } of TRADE_KEYWORDS) {
    if (words.some(w => lower.includes(w))) return label;
  }
  return 'General maintenance';
}

// ---- Photo quality heuristic ----
// We can't run true AI scene classification cheaply on every photo, so this
// uses visual signals to guess "real job photo" vs "document/screenshot/invoice":
//   - Documents are usually mostly white/near-white background
//   - Documents have low color saturation (text is grayscale-ish even on
//     a "colour" scan)
//   - Real job photos (tiled showers, timber decks, brick walls, etc.) have
//     much more color variance and texture
// This is a heuristic, not perfect classification — but should reliably
// filter out obvious invoice/screenshot photos.
async function looksLikeDocument(buffer) {
  try {
    const sharpImg = sharp(buffer);
    const metadata = await sharpImg.metadata();
    const origWidth = metadata.width || 1;
    const origHeight = metadata.height || 1;
    // Thermal/paper receipts are characteristically very tall and narrow
    // (or the reverse if photographed sideways) — a distinct shape signal
    // separate from colour, useful for catching a receipt even if its
    // lighting/shadow happens to pass the colour-based checks below.
    const aspectRatio = Math.max(origWidth, origHeight) / Math.min(origWidth, origHeight);
    const isReceiptShaped = aspectRatio > 2.6;

    const img = sharpImg.resize(36, 36, { fit: 'inside' }); // downscale further — smaller image = less CPU-bound pixel work = less chance of blocking other concurrent requests (like the ticker on other pages)
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const channels = info.channels;
    let whiteish = 0;
    let totalSaturationSum = 0;
    let brandBlueish = 0; // pixels matching a social-app "brand blue" (e.g. Facebook UI chrome), not a natural photo blue
    const colorBuckets = new Set(); // tracks how many distinct (binned) colors appear — logos/icons use very few, real photos use many
    const pixelCount = data.length / channels;

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      totalSaturationSum += saturation;
      if (r > 225 && g > 225 && b > 225) whiteish++;

      // Facebook's brand blue sits in a fairly narrow, specific band —
      // blue clearly dominant over red and green, and not too dark or
      // too pale. Natural trade-photo blues (tiled pools, sky in a
      // verandah shot) tend to be either lighter/hazier or have more
      // red/green mixed in, so this stays fairly narrow on purpose.
      if (b > 180 && b < 255 && r < 90 && g < 150 && (b - r) > 90) brandBlueish++;

      // Bin into coarse 32-level buckets per channel — real photos have
      // continuous gradients across hundreds of distinct shades even
      // at this resolution; flat-colour logos/icons collapse into a
      // small handful of buckets regardless of brand or colour scheme.
      const bucketKey = `${Math.floor(r / 32)}-${Math.floor(g / 32)}-${Math.floor(b / 32)}`;
      colorBuckets.add(bucketKey);
    }

    const whiteRatio = whiteish / pixelCount;
    const avgSaturation = totalSaturationSum / pixelCount;
    const brandBlueRatio = brandBlueish / pixelCount;

    // Tuned thresholds — a page of text/invoice is typically >45% near-white
    // background AND very low average saturation. Real photos of finished
    // trade work (tiles, timber, brick, paint) are rarely both at once.
    // Tuned thresholds — loosened further (was 0.45/0.10) so this errs
    // toward flagging MORE things as "possibly a document" rather than
    // fewer, since Recent Jobs is fully automated with no manual review
    // step before a photo goes live. A missed real photo is an acceptable
    // cost; a client's invoice slipping through publicly is not.
    const isDocument = whiteRatio > 0.25 && avgSaturation < 0.18;

    // A tall/narrow receipt shape combined with even moderately
    // document-like colouring (lighter, less saturated than a typical
    // trade photo) is treated as a document too — catches photographed
    // receipts that don't fully match the stricter isDocument thresholds
    // above, since a photo (not a scan) of a receipt often has more
    // shadow/background bleeding into the white-ratio calculation.
    const isLikelyReceipt = isReceiptShaped && whiteRatio > 0.15 && avgSaturation < 0.28;

    // Same reasoning applied to screenshots — a job photo that's actually a
    // Facebook page/post/message screenshot (accidentally attached instead
    // of real work photos) should be excluded the same way a document is.
    const isScreenshot = brandBlueRatio > 0.18;

    // General logo/icon detector — brand-agnostic, not tied to any specific
    // company's colours. A real trade photo at this resolution (36x36)
    // still lands in well over a hundred distinct colour buckets thanks to
    // natural lighting, shadow and texture variation. A flat-colour logo or
    // icon — regardless of which brand — collapses into a much smaller set.
    const isLogo = colorBuckets.size < 40;

    return isDocument || isScreenshot || isLogo || isLikelyReceipt;
  } catch (err) {
    console.error('[photo-analysis] error, assuming OK:', err.message);
    return false; // fail open — don't block a photo just because analysis errored
  }
}

async function getBestJobPhoto(apiKey, photos) {
  // photos is already newest-first, each { uuid, text }.
  // First pass: if any photo's own text clearly signals "after/complete/
  // finished" (and doesn't say "before"), strongly prefer those — a real
  // completion-status signal beats just guessing from recency.
  const afterWords = ['after', 'complete', 'completed', 'finished', 'done', 'final'];
  const beforeWords = ['before', 'progress', 'in progress', 'wip', 'during'];

  const scored = photos.map(p => {
    const lower = (p.text || '').toLowerCase();
    const hasAfter = afterWords.some(w => lower.includes(w));
    const hasBefore = beforeWords.some(w => lower.includes(w));
    return { ...p, looksLikeAfter: hasAfter && !hasBefore, looksLikeBefore: hasBefore && !hasAfter };
  });

  // Try "after"-flagged photos first, then everything else EXCEPT
  // explicitly "before"-flagged ones, then finally fall back to anything.
  const priorityOrder = [
    ...scored.filter(p => p.looksLikeAfter),
    ...scored.filter(p => !p.looksLikeAfter && !p.looksLikeBefore),
    ...scored.filter(p => p.looksLikeBefore),
  ];

  const candidates = priorityOrder.slice(0, 3); // cap checks per job

  // Sequential, one photo at a time. Parallel checking was tried and made
  // this endpoint faster on its own, but it saturates the process with
  // too much concurrent work at once, delaying OTHER requests (like the
  // ticker on other pages) that arrive at the same moment. Sequential is
  // slower for this endpoint specifically, but keeps the process lighter
  // moment-to-moment so everything else stays responsive.
  for (const photo of candidates) {
    try {
      const fileRes = await fetchWithTimeout(`https://api.servicem8.com/api_1.0/attachment/${photo.uuid}.file`, {
        headers: { 'X-API-Key': apiKey }
      }, 8000);
      if (!fileRes.ok) continue;
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      const isDoc = await looksLikeDocument(buffer);
      if (!isDoc) return photo;
    } catch (err) {
      console.error('[gallery] photo check failed for', photo.uuid, err.message);
      continue;
    }
  }
  return null; // no candidate passed the check — better to show no photo than risk one
}

// ---- Safe display label from a photo's tag ----
// Techs tag photos in ServiceM8 (short, clean labels like "Door repaired").
// This is much more specific than our trade-category guess, but since it's
// still human-typed free text, we defensively fall back to the category
// guess if it looks too long, sentence-like, or contains anything that
// resembles a phone number — the same category of risk we found once
// before in the full job description field.
function getSafeLabel(tags, fallbackCategory) {
  if (!tags) return fallbackCategory;
  const trimmed = tags.trim();
  if (trimmed.length === 0 || trimmed.length > 40) return fallbackCategory;
  const looksLikePhoneNumber = /\d[\d\s-]{7,}\d/.test(trimmed); // 8+ digits, allowing spaces/dashes
  if (looksLikePhoneNumber) return fallbackCategory;
  // Capitalize first letter for consistent display
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function relativeDate(dateStr) {
  const date = new Date(dateStr.replace(' ', 'T'));
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return 'last week';
  const weeks = Math.floor(diffDays / 7);
  return `${weeks} weeks ago`;
}

app.get('/api/recent-jobs', async (req, res) => {
  const API_KEY = process.env.SERVICEM8_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Missing SERVICEM8_API_KEY in .env' });

  const now = Date.now();
  if (recentJobsCache && (now - recentJobsCacheTime) < RECENT_JOBS_CACHE_MS) {
    console.log('[recent-jobs] serving from cache');
    return res.json({ jobs: recentJobsCache });
  }

  try {
    console.log('[recent-jobs] fetching jobs...');
    const url = 'https://api.servicem8.com/api_1.0/job.json' +
      '?$orderby=' + encodeURIComponent('completion_date desc') + '&$top=100';
    const smResponse = await fetchWithTimeout(url, { headers: { 'X-API-Key': API_KEY, 'Accept': 'application/json' } });
    if (!smResponse.ok) return res.status(502).json({ error: 'Failed to fetch jobs from ServiceM8' });

    const jobs = await smResponse.json();
    const completedJobs = jobs
      .filter(job => job.completion_date && job.completion_date !== '0000-00-00 00:00:00' && job.generated_job_id !== 'SAMPLE')
      .sort((a, b) => new Date(b.completion_date) - new Date(a.completion_date))
      .slice(0, 90);

    console.log('[recent-jobs] fetching attachments for thumbnails...');
    const attUrl = 'https://api.servicem8.com/api_1.0/attachment.json' +
      '?$orderby=' + encodeURIComponent('timestamp desc') + '&$top=250';
    const attRes = await fetchWithTimeout(attUrl, { headers: { 'X-API-Key': API_KEY, 'Accept': 'application/json' } }, 25000);
    const attachments = attRes.ok ? await attRes.json() : [];

    const photosByJob = {};
    attachments.forEach(att => {
      const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes((att.file_type || '').toLowerCase());
      const isJobAttachment = att.related_object === 'job';
      const isExcluded = EXCLUDED_PHOTO_UUIDS.includes(att.uuid);
      if (!isImage || !isJobAttachment || !att.active || isExcluded) return;
      const jobUuid = att.related_object_uuid;
      if (!photosByJob[jobUuid]) photosByJob[jobUuid] = [];
      photosByJob[jobUuid].push({
        uuid: att.uuid,
        tags: (att.tags || '').trim(), // techs tag photos in ServiceM8 — this is the cleanest short label source when present
        text: [att.attachment_name, att.tags, att.extracted_info].filter(Boolean).join(' ')
      });
    });

    // Only keep jobs that actually have a safe, real photo to show —
    // skip ones with no attachments, or where every candidate photo got
    // flagged as a likely document/screenshot.
    const RECENT_JOBS_DISPLAY_CAP = 36; // 12 rows x 3 columns

    const safeJobs = [];
    for (const job of completedJobs) {
      if (safeJobs.length >= RECENT_JOBS_DISPLAY_CAP) break; // stop analyzing once we have enough

      const photos = photosByJob[job.uuid];
      if (!photos || photos.length === 0) continue;

      const bestPhoto = await getBestJobPhoto(API_KEY, photos);
      if (!bestPhoto) continue; // every candidate looked like a document — skip this job

      const categoryFallback = guessTrade(job.work_done_description || job.job_description);

      const rawDescription = job.work_done_description || job.job_description || '';

      safeJobs.push({
        category: getSafeLabel(bestPhoto.tags, categoryFallback),
        suburb: job.geo_city || 'Melbourne',
        completed: relativeDate(job.completion_date),
        thumbUrl: `/api/photo/${bestPhoto.uuid}`,
        _debugRawTags: bestPhoto.tags || '(empty)', // TEMPORARY — remove once we've decided on an approach
        _debugRawDescription: rawDescription ? rawDescription.slice(0, 80) : '(empty)' // TEMPORARY — truncated, for comparison only
      });
    }

    console.log('[recent-jobs] final jobs with real photos:', safeJobs.length, 'out of', completedJobs.length, 'completed jobs checked');
    recentJobsCache = safeJobs;
    recentJobsCacheTime = now;
    res.json({ jobs: safeJobs });
  } catch (err) {
    console.error('[recent-jobs] error:', err.message);
    res.status(500).json({ error: 'Unexpected server error', detail: err.message });
  }
});

app.get('/api/jobs', async (req, res) => {
  const API_KEY = process.env.SERVICEM8_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Missing SERVICEM8_API_KEY in .env' });

  const now = Date.now();
  if (tickerCache && (now - tickerCacheTime) < TICKER_CACHE_MS) {
    return res.json({ jobs: tickerCache });
  }

  try {
    const url = 'https://api.servicem8.com/api_1.0/job.json' +
      '?$orderby=' + encodeURIComponent('edit_date desc') + '&$top=60';
    const smResponse = await fetchWithTimeout(url, { headers: { 'X-API-Key': API_KEY, 'Accept': 'application/json' } });
    if (!smResponse.ok) return res.status(502).json({ error: 'Failed to fetch jobs from ServiceM8' });

    const jobs = await smResponse.json();

    const safeJobs = jobs
      .filter(job => job.completion_date && job.completion_date !== '0000-00-00 00:00:00' && job.generated_job_id !== 'SAMPLE')
      .sort((a, b) => new Date(b.completion_date) - new Date(a.completion_date))
      .slice(0, 8)
      .map(job => ({
        category: guessTrade(job.work_done_description || job.job_description),
        suburb: job.geo_city || 'Melbourne',
        date: new Date(job.completion_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
      }));

    tickerCache = safeJobs;
    tickerCacheTime = now;
    res.json({ jobs: safeJobs });
  } catch (err) {
    console.error('[jobs] error:', err.message);
    res.status(500).json({ error: 'Unexpected server error', detail: err.message });
  }
});

app.get('/api/gallery', async (req, res) => {
  const API_KEY = process.env.SERVICEM8_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Missing SERVICEM8_API_KEY in .env' });

  const now = Date.now();
  if (galleryCache && (now - galleryCacheTime) < GALLERY_CACHE_MS) {
    console.log('[gallery] serving from cache');
    return res.json({ items: galleryCache });
  }

  try {
    console.log('[gallery] fetching jobs...');
    const jobsUrl = 'https://api.servicem8.com/api_1.0/job.json' +
      '?$orderby=' + encodeURIComponent('completion_date desc') + '&$top=100';
    const jobsRes = await fetchWithTimeout(jobsUrl, { headers: { 'X-API-Key': API_KEY, 'Accept': 'application/json' } });
    if (!jobsRes.ok) return res.status(502).json({ error: 'Failed to fetch jobs' });
    const allJobs = await jobsRes.json();

    const completedJobs = allJobs.filter(job =>
      job.completion_date && job.completion_date !== '0000-00-00 00:00:00' && job.generated_job_id !== 'SAMPLE'
    ).slice(0, 60); // cap how many jobs we deep-analyze photos for, to keep this reasonably fast

    console.log('[gallery] fetching attachments...');
    const attUrl = 'https://api.servicem8.com/api_1.0/attachment.json' +
      '?$orderby=' + encodeURIComponent('timestamp desc') + '&$top=250';
    const attRes = await fetchWithTimeout(attUrl, { headers: { 'X-API-Key': API_KEY, 'Accept': 'application/json' } }, 25000);
    const attachments = attRes.ok ? await attRes.json() : [];
    console.log('[gallery] attachments received:', attachments.length);

    const photosByJob = {};
    attachments.forEach(att => {
      const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes((att.file_type || '').toLowerCase());
      const isJobAttachment = att.related_object === 'job';
      const isExcluded = EXCLUDED_PHOTO_UUIDS.includes(att.uuid);
      if (!isImage || !isJobAttachment || !att.active || isExcluded) return;
      const jobUuid = att.related_object_uuid;
      if (!photosByJob[jobUuid]) photosByJob[jobUuid] = [];
      // Keep the per-photo text fields too — these describe THIS photo
      // specifically, which is more accurate than the whole job's
      // description for a multi-service job.
      photosByJob[jobUuid].push({
        uuid: att.uuid,
        text: [att.attachment_name, att.tags, att.extracted_info].filter(Boolean).join(' ')
      });
    });

    const jobsWithPhotos = completedJobs.filter(job => photosByJob[job.uuid] && photosByJob[job.uuid].length > 0);
    console.log('[gallery] jobs with photos to analyze:', jobsWithPhotos.length);

    // Analyze photos per job to find the best one (skip documents/screenshots)
    const galleryItems = [];
    for (const job of jobsWithPhotos.slice(0, MAX_GALLERY_ITEMS)) {
      const bestPhoto = await getBestJobPhoto(API_KEY, photosByJob[job.uuid]);
      if (!bestPhoto) continue; // no safe photo found for this job — skip it entirely
      const categorySource = bestPhoto.text && bestPhoto.text.trim().length > 3
        ? bestPhoto.text
        : (job.work_done_description || job.job_description);
      galleryItems.push({
        category: guessTrade(categorySource),
        suburb: job.geo_city || 'Melbourne',
        photoUrl: `/api/photo/${bestPhoto.uuid}`
      });
    }

    console.log('[gallery] final items:', galleryItems.length);
    galleryCache = galleryItems;
    galleryCacheTime = now;
    res.json({ items: galleryItems });
  } catch (err) {
    console.error('[gallery] ERROR:', err.message);
    res.status(500).json({ error: 'Unexpected server error', detail: err.message });
  }
});


app.get('/api/photo/:uuid', async (req, res) => {
  const API_KEY = process.env.SERVICEM8_API_KEY;
  if (!API_KEY) return res.status(500).send('Missing API key');

  try {
    const fileRes = await fetchWithTimeout(`https://api.servicem8.com/api_1.0/attachment/${req.params.uuid}.file`, {
      headers: { 'X-API-Key': API_KEY }
    });
    if (!fileRes.ok) return res.status(404).send('Photo not found');

    res.setHeader('Content-Type', fileRes.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    console.error('[photo] error:', err.message);
    res.status(500).send('Error loading photo');
  }
});

// Only actually start listening when run locally (node server.js).
// On Vercel, the platform imports this file and calls the exported
// app directly — it never runs this block.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;