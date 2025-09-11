module.exports = (_req, res) => {
  res.status(200).json({ ok: true, commit: process.env.VERCEL_GIT_COMMIT_SHA || null, time: new Date().toISOString() });
};