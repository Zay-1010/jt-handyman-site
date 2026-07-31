// File location: /api/jobs.js
// This runs on Vercel's server, never in the browser — the API key stays secret.

export default async function handler(req, res) {
  const API_KEY = process.env.SERVICEM8_API_KEY; // set in Vercel Project Settings → Environment Variables

  if (!API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing API key' });
  }

  try {
    // Ask ServiceM8 for jobs, most recently completed first.
    // Adjust $filter / $orderby if your ServiceM8 data uses different field names —
    // test this URL directly in a browser (with your key) via Postman/Insomnia first
    // if the response doesn't look right.
    const url = 'https://api.servicem8.com/api_1.0/job.json' +
      '?$filter=' + encodeURIComponent("status eq 'Completed'") +
      '&$orderby=' + encodeURIComponent('completion_date desc') +
      '&$top=12';

    const smResponse = await fetch(url, {
      headers: {
        'X-API-Key': API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!smResponse.ok) {
      const errText = await smResponse.text();
      console.error('ServiceM8 API error:', smResponse.status, errText);
      return res.status(502).json({ error: 'Failed to fetch jobs from ServiceM8' });
    }

    const jobs = await smResponse.json();

    // IMPORTANT: only pass through what's safe to show publicly.
    // Do NOT expose customer names, full addresses, phone numbers, or pricing.
    // job_address in ServiceM8 is usually the full street address — we only
    // want the suburb, so we take the last comma-separated segment as a rough
    // suburb extraction. You may need to adjust this depending on how your
    // team enters addresses (test with real data and refine if needed).
    const safeJobs = jobs
      .filter(job => job.job_description) // skip jobs with no description
      .slice(0, 8)
      .map(job => {
        const addressParts = (job.job_address || '').split(',').map(s => s.trim());
        const suburb = addressParts.length > 1 ? addressParts[addressParts.length - 2] : '';

        return {
          description: truncate(job.job_description, 60),
          suburb: suburb || 'Melbourne',
          category: job.category_uuid || null // optional: map to a readable name if needed
        };
      });

    // Cache for 5 minutes at the edge so we're not hammering ServiceM8's API
    // on every single page load across all your traffic.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ jobs: safeJobs });

  } catch (err) {
    console.error('Unexpected error fetching jobs:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 1).trim() + '…' : str;
}
