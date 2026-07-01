// ============================================================
// Obo Dashboard — API Route: Banco Inter PJ
// GET /api/inter
//
// O Inter PJ exige autenticação mTLS (OAuth2 + certificado digital).
// Enquanto o certificado não está configurado, retorna { configured: false }.
//
// Como configurar:
//   1. Acesse: Inter → Empresas → Mais → Developer → Minhas Aplicações
//   2. Crie uma aplicação com escopo: extrato.read, saldo.read
//   3. Gere o certificado digital (.crt e .key)
//   4. Converta para base64: cat inter.crt | base64 -w0 > cert_b64.txt
//   5. Adicione como variáveis de ambiente no Vercel:
//        INTER_CLIENT_ID, INTER_CLIENT_SECRET, INTER_CERT_PEM, INTER_KEY_PEM
//
// Endpoints Inter PJ (sandbox: cdpj.partners.bancointer.com.br):
//   POST /oauth/v2/token          → access token
//   GET  /banking/v3/saldo        → saldo atual
//   GET  /banking/v3/extrato      → extrato por período
// ============================================================

const CLIENT_ID     = process.env.INTER_CLIENT_ID;
const CLIENT_SECRET = process.env.INTER_CLIENT_SECRET;
const CERT_B64      = process.env.INTER_CERT_PEM;
const KEY_B64       = process.env.INTER_KEY_PEM;

const INTER_BASE = 'https://cdpj.partners.bancointer.com.br';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  // Verifica se o certificado está configurado
  if (!CLIENT_ID || !CERT_B64 || !KEY_B64) {
    return res.json({
      ok:         false,
      configured: false,
      saldo:      null,
      message:    'Banco Inter ainda não configurado. Adicione INTER_CLIENT_ID, INTER_CERT_PEM e INTER_KEY_PEM nas variáveis de ambiente do Vercel.',
      instrucoes: 'https://developers.inter.co/references/token'
    });
  }

  try {
    // Node 18+ com suporte a mTLS via undici / custom agent
    // Decodifica os certificados de base64
    const cert = Buffer.from(CERT_B64, 'base64').toString('utf-8');
    const key  = Buffer.from(KEY_B64,  'base64').toString('utf-8');

    // Obtém access token via mTLS
    // Nota: fetch nativo do Node 18 não suporta mTLS diretamente.
    // Usamos o módulo https do Node para este call específico.
    const https    = require('https');
    const agent    = new https.Agent({ cert, key });
    const tokenUrl = `${INTER_BASE}/oauth/v2/token`;

    const tokenBody = new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'client_credentials',
      scope:         'extrato.read saldo.read'
    });

    const tokenRes = await fetch(tokenUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    tokenBody,
      // @ts-ignore — agent é suportado no Node.js mas não no tipo padrão do fetch
      agent
    });

    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      throw new Error(`Inter auth falhou (${tokenRes.status}): ${txt}`);
    }

    const { access_token: accessToken } = await tokenRes.json();

    // Busca saldo atual
    const saldoRes = await fetch(`${INTER_BASE}/banking/v3/saldo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-conta-corrente': process.env.INTER_CONTA || ''
      },
      agent
    });

    if (!saldoRes.ok) {
      const txt = await saldoRes.text();
      throw new Error(`Inter saldo falhou (${saldoRes.status}): ${txt}`);
    }

    const saldoData = await saldoRes.json();

    // Inter retorna: { disponivel, bloqueado, saldoTotal, ... }
    const saldo = saldoData.disponivel ?? saldoData.saldoTotal ?? null;

    res.json({
      ok:         true,
      configured: true,
      timestamp:  new Date().toISOString(),
      saldo,
      bloqueado:  saldoData.bloqueado ?? 0,
      saldoTotal: saldoData.saldoTotal ?? saldo
    });

  } catch (err) {
    console.error('[api/inter] Erro:', err.message);
    res.status(500).json({ ok: false, configured: true, error: err.message, saldo: null });
  }
};
