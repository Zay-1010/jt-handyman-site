// test-servicem8.js
// Run this on its own first: node test-servicem8.js
// Purpose: confirm your API key works and see the REAL shape of the data
// ServiceM8 returns, before trusting any assumptions about field names.

require('dotenv').config();

async function testConnection() {
  const API_KEY = process.env.SERVICEM8_API_KEY;

  if (!API_KEY) {
    console.error('No SERVICEM8_API_KEY found in .env — check your file.');
    return;
  }

  console.log('Testing ServiceM8 connection...\n');

  // Start simple: just get ANY jobs, no filter, small limit —
  // so we can see real field names before adding filters/sorting.
  const url = 'https://api.servicem8.com/api_1.0/job.json?$top=3';

  try {
    const response = await fetch(url, {
      headers: {
        'X-API-Key': API_KEY,
        'Accept': 'application/json'
      }
    });

    console.log('Status:', response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.error('Error response:', errText);
      return;
    }

    const data = await response.json();
    console.log('Number of jobs returned:', data.length);
    console.log('\nFirst job (full object, so we can see real field names):');
    console.log(JSON.stringify(data[0], null, 2));

  } catch (err) {
    console.error('Connection failed:', err.message);
  }
}

testConnection();
