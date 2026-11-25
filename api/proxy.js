module.exports = async function handler(req, res) {
  const gasUrl = process.env.GAS_WEB_APP_URL;

  if (!gasUrl) {
    return res.status(500).json({
      error: 'GAS_WEB_APP_URL belum diatur di Vercel.'
    });
  }

  const action = String(req.query.action || '');
  const allowed = [
    'dashboard',
    'informasi',
    'notifikasi',
    'tambahInformasi',
    'hapusInformasi',
    'meterData',
    'meterSimpanBacaan',
    'meterBuatTagihan',
    'meterBayar',
    'meterSimpanMeterAwal'
  ];

  if (!allowed.includes(action)) {
    return res.status(400).json({ error: 'Aksi API tidak valid.' });
  }

  try {
    let upstream;

    if (!['dashboard', 'informasi', 'notifikasi'].includes(action)) {
  return res.status(405).json({ error: 'Metode tidak diizinkan.' });

      }

      const url = new URL(gasUrl);
      url.searchParams.set('action', action);

      upstream = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'follow'
      });

    } else if (req.method === 'POST') {
      if (!['tambahInformasi', 'hapusInformasi', 'meterData', 'meterSimpanBacaan', 'meterBuatTagihan', 'meterBayar', 'meterSimpanMeterAwal'].includes(action)) {
        return res.status(405).json({ error: 'Metode tidak diizinkan.' });
      }

      const payload = typeof req.body === 'string'
        ? JSON.parse(req.body)
        : (req.body || {});

      payload.action = action;

      upstream = await fetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });

    } else {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Metode tidak diizinkan.' });
    }

    const responseText = await upstream.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(
        'Respons Apps Script bukan JSON. Periksa deployment Apps Script.'
      );
    }

    return res.status(upstream.ok ? 200 : upstream.status).json(data);

  } catch (err) {
    return res.status(502).json({
      error: err.message || 'Gagal menghubungi Google Apps Script.'
    });
  }
}


