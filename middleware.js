export default function middleware(request) {
  const { pathname } = new URL(request.url);

  // API routes passam sem autenticação
  if (pathname.startsWith('/api/')) return;

  const auth = request.headers.get('authorization');

  if (auth && auth.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6));
      const colonIdx = decoded.indexOf(':');
      const pass = decoded.slice(colonIdx + 1);
      if (pass === process.env.DASHBOARD_PASSWORD) return;
    } catch (_) {}
  }

  return new Response('Obo Studio — Acesso Restrito', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Obo Studio Dashboard"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

export const config = {
  matcher: ['/', '/index.html', '/loader.js'],
};
