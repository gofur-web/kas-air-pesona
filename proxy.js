export default async function handler(req, res) {
  const gasUrl = process.env.GAS_WEB_APP_URL;
  if (!gasUrl) {
    return res.status(500).json({ error: 'Environment variable GAS_WEB_APP_URL belum diatur di Vercel.' });
  }

  const action = String(req.query.action || '');
  const allowed = ['dashboard', 'informasi', 'tambahInformasi', 'hapusInformasi'];
  if (!allowed.includes(action)) {
    return res.status(400).json({ error: 'Aksi API tidak valid.' });
  }

  try {
    let upstream;
    if (req.method === 'GET') {
      if (!['dashboard', 'informasi'].includes(action)) {
        return res.status(405).json({ error: 'Metode tidak diizinkan.' });
      }
      const url = new URL(gasUrl);
      url.searchParams.set('action', action);
      upstream = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
    } else if (req.method === 'POST') {
      if (!['tambahInformasi', 'hapusInformasi'].includes(action)) {
        return res.status(405).json({ error: 'Metode tidak diizinkan.' });
      }
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      payload.action = action;
      upstream = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });
    } else {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Metode tidak diizinkan.' });
    }

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error('Respons Apps Script bukan JSON. Pastikan deployment Web App sudah diperbarui.'); }

    if (!upstream.ok) {
      return res.status(upstream.status).json(data);
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Gagal menghubungi Google Apps Script.' });
  }
}
