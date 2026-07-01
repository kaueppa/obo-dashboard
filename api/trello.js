// ============================================================
// Obo Dashboard — API Route: Trello
// GET /api/trello
//
// Variáveis necessárias no Vercel:
//   TRELLO_API_KEY  → https://trello.com/app-key
//   TRELLO_TOKEN    → mesmo link acima, clique em "Token"
//   TRELLO_BOARD_ID → ID do board (padrão: o2sztgqv)
// ============================================================

const BOARD_ID = process.env.TRELLO_BOARD_ID || 'o2sztgqv';
const KEY      = process.env.TRELLO_API_KEY;
const TOKEN    = process.env.TRELLO_TOKEN;

const DONE_LISTS  = new Set(['FINALIZADOS', 'APROVADO', 'ENVIADO AO CLIENTE', 'CONCLUÍDOS']);
const WATCH_LISTS = ['EM ATRASO', 'EM AJUSTE', 'STAND-BY', 'STAND BY', 'EM APROVAÇÃO / REVISÃO'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  if (!KEY || !TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'TRELLO_API_KEY e TRELLO_TOKEN não configurados nas variáveis de ambiente do Vercel.'
    });
  }

  try {
    const auth = `key=${KEY}&token=${TOKEN}`;
    const base = 'https://api.trello.com/1';

    const [listsRes, cardsRes, membersRes] = await Promise.all([
      fetch(`${base}/boards/${BOARD_ID}/lists?${auth}&filter=open&fields=id,name`),
      fetch(`${base}/boards/${BOARD_ID}/cards?${auth}&filter=open&fields=name,idList,idMembers,due,dueComplete,labels`),
      fetch(`${base}/boards/${BOARD_ID}/members?${auth}&fields=id,fullName`)
    ]);

    if (!listsRes.ok)   throw new Error(`Trello lists: ${listsRes.status}`);
    if (!cardsRes.ok)   throw new Error(`Trello cards: ${cardsRes.status}`);
    if (!membersRes.ok) throw new Error(`Trello members: ${membersRes.status}`);

    const lists   = await listsRes.json();
    const cards   = await cardsRes.json();
    const members = await membersRes.json();

    const listMap   = Object.fromEntries(lists.map(l => [l.id, l.name]));
    const memberMap = Object.fromEntries(members.map(m => [m.id, m.fullName]));

    const now = new Date();
    const getName  = c => c.name;
    const getMembs = c => c.idMembers.map(id => memberMap[id] || id);
    const getDays  = c => c.due ? Math.floor((now - new Date(c.due)) / 86400000) : null;
    const getLbls  = c => c.labels.map(l => l.name);

    const vencidos = cards
      .filter(c => {
        if (!c.due || c.dueComplete) return false;
        if (DONE_LISTS.has(listMap[c.idList])) return false;
        return new Date(c.due) < now;
      })
      .map(c => ({ name: getName(c), list: listMap[c.idList] || '?', members: getMembs(c), daysLate: getDays(c), labels: getLbls(c) }))
      .sort((a, b) => b.daysLate - a.daysLate);

    const porLista = {};
    WATCH_LISTS.forEach(l => { porLista[l] = []; });
    cards.forEach(c => {
      const listName = listMap[c.idList];
      if (porLista[listName] !== undefined) {
        porLista[listName].push({ name: getName(c), members: getMembs(c), daysLate: getDays(c), labels: getLbls(c) });
      }
    });

    const standby = [...porLista['STAND-BY'], ...porLista['STAND BY']];
    const briefingsSemDono = cards
      .filter(c => listMap[c.idList] === 'BRIEFINGS - NOVOS' && c.idMembers.length === 0)
      .map(c => ({ name: getName(c) }));

    res.json({
      ok: true, timestamp: new Date().toISOString(),
      resumo: { totalAtivos: cards.length, totalVencidos: vencidos.length, emAtraso: porLista['EM ATRASO'].length, emAjuste: porLista['EM AJUSTE'].length, emAprovacao: porLista['EM APROVAÇÃO / REVISÃO'].length, emStandby: standby.length, briefingsSemDono: briefingsSemDono.length },
      vencidos: vencidos.slice(0, 25),
      emAtraso: porLista['EM ATRASO'],
      emAjuste: porLista['EM AJUSTE'],
      emAprovacao: porLista['EM APROVAÇÃO / REVISÃO'],
      standby,
      briefingsSemDono
    });
  } catch (err) {
    console.error('[api/trello] Erro:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
};
