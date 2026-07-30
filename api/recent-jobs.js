const { getRecentCompletedJobs } = require('../lib/servicem8');

module.exports = async (req, res) => {
  try {
    const jobs = await getRecentCompletedJobs(10);
    res.status(200).json(jobs);
  } catch (err) {
    console.error('recent-jobs error:', err);
    // Front-end falls back to placeholder jobs when this errors/is empty.
    res.status(200).json([]);
  }
};
