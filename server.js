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
const PORT = process.env.PORT || 3000;
let galleryCache = null;
let galleryCacheTime = 0;
const GALLERY_CACHE_MS = 15 * 60 * 1000; // 15 minutes

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
    const img = sharp(buffer).resize(100, 100, { fit: 'inside' }); // downscale for fast analysis
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const channels = info.channels;
    let whiteish = 0;
    let totalSaturationSum = 0;
    const pixelCount = data.length / channels;

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      totalSaturationSum += saturation;
      if (r > 225 && g > 225 && b > 225) whiteish++;
    }

    const whiteRatio = whiteish / pixelCount;
    const avgSaturation = totalSaturationSum / pixelCount;

    // Tuned thresholds — a page of text/invoice is typically >55% near-white
    // background AND very low average saturation. Real photos of finished
    // trade work (tiles, timber, brick, paint) are rarely both at once.
    const isDocument = whiteRatio > 0.55 && avgSaturation < 0.12;
    return isDocument;
  } catch (err) {
    console.error('[photo-analysis] error, assuming OK:', err.message);
    return false; // fail open — don't block a photo just because analysis errored
  }
}

async function getBestJobPhoto(apiKey, photoUuids) {
  // photoUuids is already newest-first. Check each until we find one that
  // doesn't look like a document/screenshot; fall back to newest if none pass.
  for (const uuid of photoUuids.slice(0, 5)) { // cap at 5 checks per job to keep this fast
    try {
      const fileRes = await fetchWithTimeout(`https://api.servicem8.com/api_1.0/attachment/${uuid}.file`, {
        headers: { 'X-API-Key': apiKey }
      }, 15000);
      if (!fileRes.ok) continue;
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      const isDoc = await looksLikeDocument(buffer);
      if (!isDoc) return uuid;
    } catch (err) {
      console.error('[gallery] photo check failed for', uuid, err.message);
      continue;
    }
  }
  return photoUuids[0]; // fallback: newest photo, even if we couldn't confirm it's ideal
}

app.get('/api/jobs', async (req, res) => {
  const API_KEY = process.env.SERVICEM8_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Missing SERVICEM8_API_KEY in .env' });

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
        suburb: job.geo_city || 'Melbourne'
      }));

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
    ).slice(0, 25); // cap how many jobs we deep-analyze photos for, to keep this reasonably fast

    console.log('[gallery] fetching attachments...');
    const attUrl = 'https://api.servicem8.com/api_1.0/attachment.json' +
      '?$orderby=' + encodeURIComponent('timestamp desc') + '&$top=150';
    const attRes = await fetchWithTimeout(attUrl, { headers: { 'X-API-Key': API_KEY, 'Accept': 'application/json' } }, 25000);
    const attachments = attRes.ok ? await attRes.json() : [];
    console.log('[gallery] attachments received:', attachments.length);

    const photosByJob = {};
    attachments.forEach(att => {
      const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes((att.file_type || '').toLowerCase());
      const isJobAttachment = att.related_object === 'job';
      if (!isImage || !isJobAttachment || !att.active) return;
      const jobUuid = att.related_object_uuid;
      if (!photosByJob[jobUuid]) photosByJob[jobUuid] = [];
      photosByJob[jobUuid].push(att.uuid); // attachments already newest-first from the API sort
    });

    const jobsWithPhotos = completedJobs.filter(job => photosByJob[job.uuid] && photosByJob[job.uuid].length > 0);
    console.log('[gallery] jobs with photos to analyze:', jobsWithPhotos.length);

    // Analyze photos per job to find the best one (skip documents/screenshots)
    const galleryItems = [];
    for (const job of jobsWithPhotos.slice(0, 40)) {
      const bestUuid = await getBestJobPhoto(API_KEY, photosByJob[job.uuid]);
      galleryItems.push({
        category: guessTrade(job.work_done_description || job.job_description),
        suburb: job.geo_city || 'Melbourne',
        photoUrl: `/api/photo/${bestUuid}`
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});