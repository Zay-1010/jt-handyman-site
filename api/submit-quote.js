const { createOrFindCompany, createJob, createJobContact } = require('../lib/servicem8');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { name, email, phone, address, service, message, agency, portfolioSize, honeypot } = body;

    // Simple spam trap — a hidden field real users never fill in.
    if (honeypot) {
      res.status(200).json({ ok: true });
      return;
    }

    if (!name || !phone) {
      res.status(400).json({ error: 'Please provide at least your name and phone number.' });
      return;
    }

    // NOTE: `address` is the enquirer's physical/job address in ServiceM8 —
    // never repurpose it for an agency name or other free text. Agency and
    // portfolio size are enquiry details, so they go in the description only.
    const companyUuid = await createOrFindCompany({ name, email, phone, address });

    const description = [
      agency ? `Agency/company: ${agency}` : null,
      portfolioSize ? `Properties in portfolio: ${portfolioSize}` : null,
      service ? `Service requested: ${service}` : null,
      message ? `Details: ${message}` : null,
      `Submitted via website instant quote form.`,
    ].filter(Boolean).join('\n');

    const jobUuid = await createJob({
      companyUuid,
      description,
      address,
      jobName: service ? `${service} — website enquiry` : 'Website enquiry',
    });

    await createJobContact({ jobUuid, name, phone, email });

    res.status(200).json({ ok: true, jobUuid });
  } catch (err) {
    console.error('submit-quote error:', err);
    res.status(500).json({ error: 'Could not reach ServiceM8 right now. Please call 1800 587 659.' });
  }
};
