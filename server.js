// server.js — local dev server
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
let categoryCache = null;
let categoryCacheTime = 0;

app.use(express.static(path.join(__dirname)));

async function getCategoryMap(apiKey) {
  const now = Date.now();
  if (categoryCache && (now - categoryCacheTime) < 60 * 60 * 1000) {
    return categoryCache;
  }
  const res = await fetch('https://api.servicem8.com/api_1.0/category.json', {
    headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' }
  });
  if (!res.ok) return {};
  const categories = await res.json();
  const map = {};
  categories.forEach(c => { map[c.uuid] = c.name; });
  categoryCache = map;
  categoryCacheTime = now;
  return map;
}

// ---- Existing ticker endpoint (category + suburb only, unchanged) ----
app.get('/api/jobs', async (req, res) => {
  const API_KEY = process.env.SERVICEM8_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Missing SERVICEM8_API_KEY in .env' });

  try {
    const url = 'https://api.servicem8.com/api_1.0/job.json' +
      '?$orderby=' + encodeURIComponent('edit_date desc') + '&$top=60';
    const smResponse = await fetch(url, { headers: { 'X-API-Key': API_KEY, 'Accept': 'application/json' } });
    if (!smResponse.ok) return res.status(502).json({ error: 'Failed to fetch jobs from ServiceM8' });

    const jobs = await smResponse.json();
    const categoryMap = await getCategoryMap(API_KEY);

    const safeJobs = jobs
      .filter(job => job.completion_date && job.completion_date !== '0000-00-00 00:00:00' && job.generated_job_id !== 'SAMPLE')
      .sort((a, b) => new Date(b.completion_date) - new Date(a.completion_date))
      .slice(0, 8)
      .map(job => ({
        category: categoryMap[job.category_uuid] || 'Property repair',
        suburb: job.geo_city || 'Melbourne'
      }));

    res.json({ jobs: safeJobs });
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

// ---- NEW: Gallery endpoint — completed jobs WITH their attached photos ----
// Returns category, suburb, and a list of our own proxy image URLs
// (never the raw ServiceM8 attachment URLs, and never customer names/addresses).
app.get('/api/gallery', async (req, res) => {
  const API_KEY = process.env.SERVICEM8_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Missing SERVICEM8_API_KEY in .env' });

  try {
    const jobsUrl = 'https://api.servicem8.com/api_1.0/job.json' +
      '?$orderby=' + encodeURIComponent('completion_date desc') + '&$top=100';
    const jobsRes = await fetch(jobsUrl, { headers: { 'X-API-Key': API_KEY, 'Accept': 'application/json' } });
    if (!jobsRes.ok) return res.status(502).json({ error: 'Failed to fetch jobs' });
    const allJobs = await jobsRes.json();

    const completedJobs = allJobs.filter(job =>
      job.completion_date && job.completion_date !== '0000-00-00 00:00:00' && job.generated_job_id !== 'SAMPLE'
    );

    // Attachments are a separate object — fetch recent photo attachments,
    // then match them to completed jobs by related_object_uuid.
    const attUrl = 'https://api.servicem8.com/api_1.0/attachment.json' +
      '?$filter=' + encodeURIComponent("related_object eq 'job'") +
      '&$orderby=' + encodeURIComponent('timestamp desc') + '&$top=300';
    const attRes = await fetch(attUrl, { headers: { 'X-API-Key': API_KEY, 'Accept': 'application/json' } });
    const attachments = attRes.ok ? await attRes.json() : [];

    const photosByJob = {};
    attachments.forEach(att => {
      const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes((att.file_type || '').toLowerCase());
      if (!isImage || !att.active) return;
      const jobUuid = att.related_object_uuid;
      if (!photosByJob[jobUuid]) photosByJob[jobUuid] = [];
      photosByJob[jobUuid].push(att.uuid);
    });

    const categoryMap = await getCategoryMap(API_KEY);

    const galleryItems = completedJobs
      .filter(job => photosByJob[job.uuid] && photosByJob[job.uuid].length > 0)
      .slice(0, 40)
      .map(job => ({
        category: categoryMap[job.category_uuid] || 'General',
        suburb: job.geo_city || 'Melbourne',
        // Point at OUR OWN proxy route, never ServiceM8 directly —
        // the browser can't authenticate to ServiceM8 on its own.
        photoUrl: `/api/photo/${photosByJob[job.uuid][0]}`
      }));

    res.json({ items: galleryItems });
  } catch (err) {
    console.error('Gallery error:', err);
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

// ---- NEW: Authenticated image proxy ----
// Fetches the actual photo bytes from ServiceM8 using our secret key,
// then streams them back. This is the ONLY way a public <img> tag can
// show a ServiceM8 photo, since ServiceM8 requires an API key header
// that a plain <img src="..."> can never send.
app.get('/api/photo/:uuid', async (req, res) => {
  const API_KEY = process.env.SERVICEM8_API_KEY;
  if (!API_KEY) return res.status(500).send('Missing API key');

  try {
    const fileRes = await fetch(`https://api.servicem8.com/api_1.0/attachment/${req.params.uuid}.file`, {
      headers: { 'X-API-Key': API_KEY }
    });
    if (!fileRes.ok) return res.status(404).send('Photo not found');

    res.setHeader('Content-Type', fileRes.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 1 day, reduce repeat API calls
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    console.error('Photo proxy error:', err);
    res.status(500).send('Error loading photo');
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});