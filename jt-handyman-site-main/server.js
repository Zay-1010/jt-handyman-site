// ============================================
// Local / traditional-host server.
// On Vercel or Netlify, the files in /api are picked up automatically
// as serverless functions and this file isn't needed — but it's here
// so the site also runs on any plain Node host (e.g. a VPS, Render).
// ============================================
require('dotenv').config();
const express = require('express');
const path = require('path');

const submitQuote = require('./api/submit-quote');
const recentJobs = require('./api/recent-jobs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post('/api/submit-quote', submitQuote);
app.get('/api/recent-jobs', recentJobs);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`JT Handyman site running at http://localhost:${PORT}`);
  if (!process.env.SERVICEM8_API_KEY) {
    console.warn('⚠️  SERVICEM8_API_KEY is not set — quote form and recent jobs feed will fail until it is. See README.md.');
  }
});
