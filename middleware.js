export default function middleware(request) {
  const { pathname } = new URL(request.url);

  if (pathname.startsWith('/api/') || pathname === '/login.html') return;

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

  return Response.redirect(new URL('/login.html', request.url), 302);
}

export const config = {
  matcher: ['/', '/index.html', '/loader.js'],
};
