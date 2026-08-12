// server.js — local dev server
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
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
// ServiceM8's own "category" field on this account tracks CLIENT TYPE
// (private homeowner, property manager, agent) — not the trade — so it's
// not useful for a "browse by trade" gallery filter. This guesses the
// trade from the job text instead. Only the matched LABEL is ever
// returned to the browser, never the raw description text itself.
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

  try {
    console.log('[gallery] fetching jobs...');
    const jobsUrl = 'https://api.servicem8.com/api_1.0/job.json' +
      '?$orderby=' + encodeURIComponent('completion_date desc') + '&$top=100';
    const jobsRes = await fetchWithTimeout(jobsUrl, { headers: { 'X-API-Key': API_KEY, 'Accept': 'application/json' } });
    if (!jobsRes.ok) return res.status(502).json({ error: 'Failed to fetch jobs' });
    const allJobs = await jobsRes.json();
    console.log('[gallery] jobs received:', allJobs.length);

    const completedJobs = allJobs.filter(job =>
      job.completion_date && job.completion_date !== '0000-00-00 00:00:00' && job.generated_job_id !== 'SAMPLE'
    );

    console.log('[gallery] fetching attachments...');
    const attUrl = 'https://api.servicem8.com/api_1.0/attachment.json' +
      '?$orderby=' + encodeURIComponent('timestamp desc') + '&$top=300';
    const attRes = await fetchWithTimeout(attUrl, { headers: { 'X-API-Key': API_KEY, 'Accept': 'application/json' } });
    const attachments = attRes.ok ? await attRes.json() : [];
    console.log('[gallery] attachments received:', attachments.length);

    const photosByJob = {};
    attachments.forEach(att => {
      const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes((att.file_type || '').toLowerCase());
      const isJobAttachment = att.related_object === 'job';
      if (!isImage || !isJobAttachment || !att.active) return;
      const jobUuid = att.related_object_uuid;
      if (!photosByJob[jobUuid]) photosByJob[jobUuid] = [];
      photosByJob[jobUuid].push(att.uuid);
    });
    console.log('[gallery] jobs with photos:', Object.keys(photosByJob).length);

    const galleryItems = completedJobs
      .filter(job => photosByJob[job.uuid] && photosByJob[job.uuid].length > 0)
      .slice(0, 40)
      .map(job => ({
        category: guessTrade(job.work_done_description || job.job_description),
        suburb: job.geo_city || 'Melbourne',
        photoUrl: `/api/photo/${photosByJob[job.uuid][0]}`
      }));

    console.log('[gallery] final items:', galleryItems.length);
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