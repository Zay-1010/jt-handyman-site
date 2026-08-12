// server.js — local dev server (privacy-safe version)
//
// IMPORTANT: work_done_description / job_description are INTERNAL NOTES.
// They can and do contain customer names, phone numbers, and other private
// details (confirmed from real data during testing). NEVER show that field
// publicly. This version only ever exposes: service category + suburb.

require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
let categoryCache = null; // cache category_uuid -> name lookup, refreshed hourly
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

app.get('/api/jobs', async (req, res) => {
  const API_KEY = process.env.SERVICEM8_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'Missing SERVICEM8_API_KEY in .env' });
  }

  try {
    const url = 'https://api.servicem8.com/api_1.0/job.json' +
      '?$orderby=' + encodeURIComponent('edit_date desc') +
      '&$top=60';

    const smResponse = await fetch(url, {
      headers: { 'X-API-Key': API_KEY, 'Accept': 'application/json' }
    });

    if (!smResponse.ok) {
      const errText = await smResponse.text();
      console.error('ServiceM8 API error:', smResponse.status, errText);
      return res.status(502).json({ error: 'Failed to fetch jobs from ServiceM8' });
    }

    const jobs = await smResponse.json();
    const categoryMap = await getCategoryMap(API_KEY);

    const safeJobs = jobs
      .filter(job => {
        const hasRealCompletion = job.completion_date && job.completion_date !== '0000-00-00 00:00:00';
        const isNotSample = job.generated_job_id !== 'SAMPLE';
        return hasRealCompletion && isNotSample;
      })
      .sort((a, b) => new Date(b.completion_date) - new Date(a.completion_date))
      .slice(0, 8)
      .map(job => ({
        // ONLY category + suburb — never raw notes, never names, never phone numbers.
        category: categoryMap[job.category_uuid] || 'Property repair',
        suburb: job.geo_city || 'Melbourne'
      }));

    res.json({ jobs: safeJobs });

  } catch (err) {
    console.error('Unexpected error fetching jobs:', err);
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});