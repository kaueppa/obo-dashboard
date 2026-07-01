// ============================================================
// Obo Dashboard — API Route: ClickUp CRM
// GET /api/clickup
//
// Variáveis necessárias no Vercel:
//   CLICKUP_TOKEN    → ClickUp → Settings → Apps → API Token
//   CLICKUP_LIST_ID  → ID da lista CRM GERAL (padrão: 901311064373)
// ============================================================

const TOKEN   = process.env.CLICKUP_TOKEN;
const LIST_ID = process.env.CLICKUP_LIST_ID || '901311064373';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  if (!TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'CLICKUP_TOKEN não configurado nas variáveis de ambiente do Vercel.'
    });
  }

  try {
    const base    = 'https://api.clickup.com/api/v2';
    const headers = { Authorization: TOKEN, 'Content-Type': 'application/json' };

    let allTasks = [];
    let page     = 0;
    let hasMore  = true;

    while (hasMore) {
      const res2 = await fetch(
        `${base}/list/${LIST_ID}/task?include_closed=false&subtasks=false&page=${page}`,
        { headers }
      );
      if (!res2.ok) throw new Error(`ClickUp retornou ${res2.status}`);
      const data  = await res2.json();
      const tasks = data.tasks || [];
      allTasks = allTasks.concat(tasks);
      hasMore = tasks.length === 100;
      page++;
      if (page > 10) break;
    }

    const fmt = t => ({
      id: t.id, name: t.name, url: t.url,
      assignees: (t.assignees || []).map(a => a.username),
      tags: (t.tags || []).map(tag => tag.name),
      due: t.due_date ? new Date(parseInt(t.due_date)).toISOString().slice(0, 10) : null
    });

    const byStatus = {};
    allTasks.forEach(t => {
      const s = t.status?.status || 'unknown';
      if (!byStatus[s]) byStatus[s] = [];
      byStatus[s].push(fmt(t));
    });

    const propostas = [
      ...(byStatus['elab. de proposta/ enviada'] || []),
      ...(byStatus['elab. de proposta'] || [])
    ];

    const boloComPrazo = (byStatus['bolo'] || [])
      .filter(t => t.due)
      .sort((a, b) => new Date(a.due) - new Date(b.due))
      .slice(0, 5);

    res.json({
      ok: true, timestamp: new Date().toISOString(),
      pipeline: {
        propostas: propostas.length,
        bolo: (byStatus['bolo'] || []).length,
        prospects: (byStatus['prospects'] || []).length,
        comInteracao: (byStatus['contatos com interação'] || []).length,
        perdidas: (byStatus['perdidas'] || []).length,
        total: allTasks.length
      },
      propostas, boloComPrazo,
      comInteracao: (byStatus['contatos com interação'] || []).slice(0, 10)
    });
  } catch (err) {
    console.error('[api/clickup] Erro:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
};
