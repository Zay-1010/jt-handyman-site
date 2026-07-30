// ============================================
// ServiceM8 REST API helper (server-side only)
// Docs: https://developer.servicem8.com/docs/rest-overview
// Base URL + X-API-Key auth as documented by ServiceM8.
// ============================================
const BASE_URL = 'https://api.servicem8.com/api_1.0';

function getApiKey() {
  const key = process.env.SERVICEM8_API_KEY;
  if (!key) {
    throw new Error('SERVICEM8_API_KEY is not set. Add it to your server environment (see README).');
  }
  return key;
}

async function sm8Request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE_URL}/${path}`, {
    method,
    headers: {
      'X-Api-Key': getApiKey(),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ServiceM8 ${method} ${path} failed: ${res.status} ${text}`);
  }

  // ServiceM8 returns the new record's UUID in this header on create.
  const uuid = res.headers.get('x-record-uuid');
  let data = null;
  try { data = await res.json(); } catch (_) { /* empty body is normal on create */ }
  return { uuid, data };
}

/**
 * Creates (or reuses) a Client/Company in ServiceM8 for a quote request.
 */
async function createOrFindCompany({ name, email, phone, address }) {
  // Look for an existing company with this email first, to avoid duplicates
  // on repeat enquiries from the same person.
  if (email) {
    const search = await sm8Request(
      `company.json?%24filter=email eq '${email.replace(/'/g, "''")}'`
    );
    if (Array.isArray(search.data) && search.data.length > 0) {
      return search.data[0].uuid;
    }
  }

  const { uuid } = await sm8Request('company.json', {
    method: 'POST',
    body: {
      name: name || 'Website enquiry',
      email: email || '',
      mobile: phone || '',
      address: address || '',
      active: 1,
    },
  });
  return uuid;
}

/**
 * Creates a Job (a quote request) attached to a Company.
 */
async function createJob({ companyUuid, description, address, jobName }) {
  const { uuid } = await sm8Request('job.json', {
    method: 'POST',
    body: {
      company_uuid: companyUuid,
      status: 'Quote',
      job_address: address || '',
      job_description: description,
      job_name: jobName || 'Website quote request',
      queue_uuid: null,
      active: 1,
    },
  });
  return uuid;
}

/**
 * Adds the enquirer as the Job Contact so their name/phone/email
 * shows against the job card in ServiceM8.
 */
async function createJobContact({ jobUuid, name, phone, email }) {
  await sm8Request('jobcontact.json', {
    method: 'POST',
    body: {
      job_uuid: jobUuid,
      first: name || '',
      phone: phone || '',
      email: email || '',
      type: 'JOB',
      is_primary_contact: 1,
    },
  });
}

/**
 * Fetches recently completed jobs for the public "recent jobs" feed.
 * Only category, suburb and completion date are returned — never
 * client names, addresses or contact details.
 */
async function getRecentCompletedJobs(limit = 10) {
  const { data } = await sm8Request(
    `job.json?%24filter=status eq 'Completed'&%24orderby=date desc&%24top=${limit}`
  );
  if (!Array.isArray(data)) return [];

  return data.map((job) => ({
    ref: (job.generated_job_id || job.uuid || '').toString().slice(-5).toUpperCase(),
    category: job.category_name || job.job_name || 'Property repair',
    suburb: extractSuburb(job.job_address),
    date: job.completion_date ? job.completion_date.split(' ')[0] : (job.date || '').split(' ')[0],
  }));
}

function extractSuburb(address) {
  if (!address) return 'Melbourne';
  // Take the second-to-last comma-separated segment as a rough suburb guess,
  // e.g. "12 Smith St, Reservoir, VIC 3073" -> "Reservoir"
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : 'Melbourne';
}

module.exports = {
  createOrFindCompany,
  createJob,
  createJobContact,
  getRecentCompletedJobs,
};
