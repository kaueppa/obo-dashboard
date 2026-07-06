// ============================================================
// Obo Dashboard — API Route: Conta Azul Pro
// GET /api/contaazul
//
// Variáveis necessárias no Vercel:
//   CONTAAZUL_CLIENT_ID      → app.contaazul.com → Config → API → Aplicações
//   CONTAAZUL_CLIENT_SECRET  → idem
//   CONTAAZUL_REFRESH_TOKEN  → gerado no fluxo OAuth2 (ver .env.example)
//
// Como gerar o refresh_token (uma vez só):
//   1. Acesse: https://app.contaazul.com/auth/oauth/v2/authorize
//      ?response_type=code&client_id=SEU_CLIENT_ID
//      &redirect_uri=https://obo-eight.vercel.app/api/contaazul-callback
//      &scope=sales invoices customers financials
//   2. Autorize e copie o ?code= da URL de retorno
//   3. Troque o code por stokens:
//      POST https://api.contaazul.com/auth/oauth/v2/token
//      Body: grant_type=authorization_code&code=CODE&redirect_uri=...
//   4. Salve o refresh_token retornado como CONTAAZUL_REFRESH_TOKEN
// ============================================================

const CLIENT_ID     = process.env.CONTAAZUL_CLIENT_ID;
const CLIENT_SECRET = process.env.CONTAAZUL_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.CONTAAZUL_REFRESH_TOKEN;

const API_BASE  = 'https://api.contaazul.com';
const AUTH_URL = 'https://api.contaazul.com/auth/oauth/v2/token';

// Troca o refresh_token por um access_token válido
async function getAccessToken() {
  const body = new URLSearchParams({
    grant_type:     'refresh_token',
    refresh_token: REFRESH_TOKEN,
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET
   });

  const res = await fetch(AUTH_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
   });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`ContaAzul auth falhou (${res.status}): ${txt}`);
  }

  const json = await res.json();
  return json.access_token;
}

// Helper GET com Bearer token
async function apiGet(path, token, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`ContaAzul ${path} (${res.status}): ${txt}`);
  }
  return res.json();
}

// Soma os valores de uma lista de lançamentos por status
function somaStatus(items, statusList) {
  return items
    .filter(i => statusList.includes(i.status))
    .reduce((acc, i) => acc + (i.value || i.amount || 0), 0);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=120');

  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'Credenciais do Conta Azul não configuradas (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN).'
    });
  }

  try {
    const token = await getAccessToken();

    // Intervalo: mês corrente
    const now      = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    // Busca contas a receber e a pagar em paralelo
    const [recData, pagData] = await Promise.all([
      apiGet('/v1/bills-to-receive', token, {
        due_date_start: firstDay,
        due_date_end:   lastDay,
        page_size:      200
      }),
      apiGet('/v1/bills-to-pay', token, {
        due_date_start: firstDay,
        due_date_end:   lastDay,
        page_size:      200
      })
    ]);

    // Conta Azul retorna array direto ou { items: [...] }
    const recItems = Array.isArray(recData) ? recData : (recData.items || []);
    const pagItems = Array.isArray(pagData) ? pagData : (pagData.items || []);

    // Contas a receber
    const recebidos = somaStatus(recItems, ['RECEIVED', 'RECEIVED_LATE']);
    const aReceberV = somaStatus(recItems, ['PENDING']);
    const recVencidos = recItems
      .filter(i => i.status === 'PENDING' && new Date(i.due_date || i.dueDate) < now)
      .reduce((acc, i) => acc + (i.value || i.amount || 0), 0);

    // Contas a pagar
    const pagos       = somaStatus(pagItems, ['PAID', 'PAID_LATE']);
    const aPagarV     = somaStatus(pagItems, ['PENDING']);
    const pagVencidos = pagItems
      .filter(i => i.status === 'PENDING' && new Date(i.due_date || i.dueDate) < now)
      .reduce((acc, i) => acc + (i.value || i.amount || 0), 0);

    const resultado = recebidos - (pagos + pagVencidos);

    res.json({
      ok:        true,
      timestamp: new Date().toISOString(),
      periodo:   { de: firstDay, ate: lastDay },

      receita: {
        recebido:  recebidos,
        aVencer:   aReceberV - recVencidos,
        vencido:   recVencidos,
        total:     recebidos + aReceberV
      },
      despesa: {
        pago:    pagos,
        aVencer: aPagarV - pagVencidos,
        vencido: pagVencidos,
        total:   pagos + aPagarV
      },
      resultado,

      // Lançamentos individuais (para tabela)
      aReceber: recItems
        .sort((a, b) => new Date(a.due_date || a.dueDate) - new Date(b.due_date || b.dueDate))
        .map(i => ({
          nome:       i.customer?.name || i.description || i.name,
          valor:      i.value || i.amount,
          vencimento: i.due_date || i.dueDate,
          status:     i.status
        })),

      aPagar: pagItems
        .sort((a, b) => new Date(a.due_date || a.dueDate) - new Date(b.due_date || b.dueDate))
        .map(i => ({
          descricao:  i.description || i.name,
          valor:      i.value || i.amount,
          vencimento: i.due_date || i.dueDate,
          status:     i.status
        }))
    });

  } catch (err) {
    console.error('[api/contaazul] Erro:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
};
