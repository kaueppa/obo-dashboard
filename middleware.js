export default function middleware(request) {
  const { pathname } = new URL(request.url);

  // API routes e login passam sem autenticação
  if (pathname.startsWith('/api/') || pathname === '/login.html') return;

  // Verificar cookie de autenticação
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/obo_auth=([^;]+)/);

  if (match) {
    try {
      const decoded = atob(match[1]);
      const [user, ...rest] = decoded.split(':');
      const pass = rest.join(':');
      const validUser = process.env.DASHBOARD_USER || 'kaue';
      const validPass = process.env.DASHBOARD_PASSWORD;
      if (user === validUser && pass === validPass) return;
    } catch (_) {}
  }

  // Redirecionar para login
  return Response.redirect(new URL('/login.html', request.url), 302);
}

export const config = {
  matcher: ['/', '/index.html', '/loader.js'],
};
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
