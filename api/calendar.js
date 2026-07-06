// api/calendar.js — Google Calendar integration (Obo Studio Dashboard)
// Busca eventos das agendas configuradas via OAuth2 + refresh_token
// Env vars necessárias no Vercel:
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   GOOGLE_REFRESH_TOKEN   (conta contato@obostudio.com.br)
//   GOOGLE_REFRESH_TOKEN_OI (conta oi@obostudio.com.br — opcional)
//   GOOGLE_CALENDAR_IDS    (CSV: "primary,outroID@group.calendar.google.com")

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const allEvents = [];

    // Buscar eventos para cada refresh_token configurado
    const tokens = [
      process.env.GOOGLE_REFRESH_TOKEN,
      process.env.GOOGLE_REFRESH_TOKEN_OI,
    ].filter(Boolean);

    for (const refreshToken of tokens) {
      const accessToken = await getAccessToken(refreshToken);
      if (!accessToken) continue;

      // IDs de calendário: padrão = primary (agenda principal da conta)
      const calIds = process.env.GOOGLE_CALENDAR_IDS
        ? process.env.GOOGLE_CALENDAR_IDS.split(',').map(s => s.trim())
        : ['primary'];

      for (const calId of calIds) {
        const events = await fetchEvents(accessToken, calId);
        allEvents.push(...events);
      }
    }

    // Ordenar por data de início
    allEvents.sort((a, b) => {
      const da = new Date(a.start.dateTime || a.start.date);
      const db = new Date(b.start.dateTime || b.start.date);
      return da - db;
    });

    // Remover duplicatas pelo ID
    const seen = new Set();
    const unique = allEvents.filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    return res.status(200).json({ events: unique, total: unique.length });
  } catch (err) {
    console.error('calendar error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function getAccessToken(refreshToken) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });
  const data = await r.json();
  return data.access_token || null;
}

async function fetchEvents(accessToken, calendarId) {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin:      now.toISOString(),
    timeMax:      in30Days.toISOString(),
    maxResults:   '50',
    singleEvents: 'true',
    orderBy:      'startTime',
  });

  const encodedId = encodeURIComponent(calendarId);
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodedId}/events?${params}`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!r.ok) {
    const err = await r.text();
    console.error('Calendar fetch error:', calendarId, err);
    return [];
  }

  const data = await r.json();
  return (data.items || []).map(e => ({
    id:       e.id,
    title:    e.summary || '(sem título)',
    start:    e.start,
    end:      e.end,
    location: e.location || '',
    desc:     e.description || '',
    link:     e.htmlLink || '',
    calendar: calendarId,
    color:    e.colorId || null,
    allDay:   !!e.start?.date && !e.start?.dateTime,
  }));
}
