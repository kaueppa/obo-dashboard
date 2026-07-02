export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, pass } = req.body;

  const validUser = process.env.DASHBOARD_USER || 'kaue';
  const validPass = process.env.DASHBOARD_PASSWORD;

  if (user === validUser && pass === validPass) {
    const token = Buffer.from(`${user}:${pass}`).toString('base64');
    res.setHeader(
      'Set-Cookie',
      `obo_auth=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`
    );
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ ok: false, error: 'Invalid credentials' });
}
