// ============================================================
// Obo Dashboard — loader.js
// Busca dados das APIs serverless e atualiza o DOM ao vivo.
// Incluído no index.html via <script src="/loader.js"></script>
// ============================================================

(function () {
  'use strict';

  // Formata número como moeda BR sem prefixo (ex: 52.015,29)
  function fmtNum(n) {
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);
  }

  // Formata como "R$ 52.015,29"
  function fmtBRL(n) {
    if (n == null || isNaN(n)) return '—';
    const sign = n < 0 ? '-' : '';
    return `${sign}R$ ${fmtNum(Math.abs(n))}`;
  }

  // Atualiza um elemento pelo id (silencioso se não existir)
  function set(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function setStyle(id, prop, value) {
    const el = document.getElementById(id);
    if (el) el.style[prop] = value;
  }

  // ──────────────────────────────────────────────────────────
  // TRELLO
  // ──────────────────────────────────────────────────────────
  function applyTrello(data) {
    const { resumo, vencidos, emAprovacao } = data;

    // Alerta "tarefas em atraso" (amber) ─ al-num
    set('alert-atraso-num',    resumo.totalVencidos);
    set('alert-aprovacao-num', resumo.emAprovacao);

    // Kanban badges
    set('kb-badge-andamento', resumo.emAjuste + (resumo.emAprovacao || 0));
    set('kb-badge-travadas',  resumo.emAtraso + resumo.emAjuste);

    // Pessoas & Cultura — tasks em atraso
    set('ps-atraso-num', resumo.totalVencidos);

    // Nav badge "Aprovações"
    set('nav-badge-aprovacoes', resumo.emAprovacao);

    // Tabela de vencidos no view-tarefas
    const tbody = document.getElementById('tabela-vencidos-body');
    if (tbody && vencidos && vencidos.length) {
      tbody.innerHTML = vencidos.slice(0, 20).map(v => {
        const cor  = v.daysLate > 10 ? '#EF4444' : v.daysLate > 4 ? '#F59E0B' : '#666';
        const tags = v.labels.slice(0, 2)
          .map(l => `<span style="background:#F1F5F9;border-radius:4px;padding:1px 6px;font-size:10px;color:#475569">${l}</span>`)
          .join(' ');
        return `
          <tr>
            <td style="font-weight:600">${v.name}</td>
            <td style="color:#666">${v.list}</td>
            <td style="color:#555">${v.members.join(', ') || '—'}</td>
            <td style="font-weight:700;color:${cor}">${v.daysLate}d</td>
            <td>${tags}</td>
          </tr>`;
      }).join('');
    }

    // Seção "Em aprovação" no view-tarefas
    const aprovacaoEl = document.getElementById('lista-em-aprovacao');
    if (aprovacaoEl && emAprovacao && emAprovacao.length) {
      aprovacaoEl.innerHTML = emAprovacao.map(c => {
        const cor = (c.daysLate > 0) ? '#EF4444' : '#22C55E';
        const prazo = c.daysLate > 0
          ? `<span style="color:${cor};font-weight:700;font-size:10px">${c.daysLate}d atraso</span>`
          : `<span style="color:#22C55E;font-size:10px">no prazo</span>`;
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #F0F0F0">
            <span style="font-size:12px;font-weight:600">${c.name}</span>
            <div style="display:flex;gap:8px;align-items:center">
              <span style="font-size:10px;color:#888">${c.members.join(', ') || '—'}</span>
              ${prazo}
            </div>
          </div>`;
      }).join('');
    }
  }

  // ──────────────────────────────────────────────────────────
  // CLICKUP (CRM)
  // ──────────────────────────────────────────────────────────
  function applyClickUp(data) {
    const { pipeline, propostas, boloComPrazo } = data;

    // KPIs do CRM
    set('crm-kpi-propostas',    pipeline.propostas);
    set('crm-kpi-bolo',         pipeline.bolo);
    set('crm-kpi-prospects',    pipeline.prospects);
    set('crm-kpi-com-interacao',pipeline.comInteracao);
    set('crm-kpi-perdidas',     pipeline.perdidas);
    set('crm-kpi-total',        pipeline.total);

    // Lista de propostas abertas
    const propEl = document.getElementById('lista-propostas-abertas');
    if (propEl && propostas && propostas.length) {
      propEl.innerHTML = propostas.map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #F0F0F0">
          <span style="font-size:12px;font-weight:600">${p.name}</span>
          <a href="${p.url}" target="_blank" style="font-size:10px;color:#3B82F6">ver →</a>
        </div>`).join('');
    } else if (propEl) {
      propEl.innerHTML = '<div style="font-size:11px;color:#999;padding:8px 0">Nenhuma proposta aberta no momento.</div>';
    }
  }

  // ──────────────────────────────────────────────────────────
  // CONTA AZUL
  // ──────────────────────────────────────────────────────────
  function applyContaAzul(data) {
    const { receita, despesa, resultado } = data;

    // Sidebar financeiro (view overview)
    const corRes = resultado >= 0 ? '#22C55E' : '#EF4444';
    setHTML('fin-sidebar-entradas', `R$ ${fmtNum(receita.recebido)}`);
    setHTML('fin-sidebar-saidas',   `R$ ${fmtNum(despesa.pago + despesa.vencido)}`);
    setHTML('fin-sidebar-resultado', `${resultado >= 0 ? '+' : ''}${fmtBRL(resultado)}`);
    setStyle('fin-sidebar-resultado', 'color', corRes);

    // KPI Receitas (5 KPIs no topo do overview)
    const kpiReceita = document.getElementById('kpi-receitas');
    if (kpiReceita) {
      const val = receita.recebido + receita.aVencer;
      const int = Math.floor(val).toLocaleString('pt-BR');
      const dec = val.toFixed(2).split('.')[1];
      kpiReceita.innerHTML = `R$ ${int}<sub>,${dec}</sub>`;
    }

    // KPIs no view-financeiro
    set('fin-kpi-entradas',  `R$ ${fmtNum(receita.recebido + receita.aVencer)}`);
    set('fin-kpi-saidas',    `R$ ${fmtNum(despesa.pago + despesa.aVencer + despesa.vencido)}`);
    set('fin-kpi-resultado', `${resultado >= 0 ? '+' : ''}${fmtBRL(resultado)}`);
    setStyle('fin-kpi-resultado', 'color', corRes);

    // Tabela "Recebido em {mês}"
    const recTbody = document.getElementById('tabela-recebidos-body');
    if (recTbody && data.aReceber) {
      const recebidos = data.aReceber.filter(i => ['RECEIVED', 'RECEIVED_LATE'].includes(i.status));
      if (recebidos.length) {
        recTbody.innerHTML = recebidos.map(i => `
          <tr>
            <td style="font-weight:600">${i.nome || '—'}</td>
            <td style="color:#22C55E;font-weight:700">${fmtBRL(i.valor)}</td>
            <td style="color:#666;font-size:11px">${i.vencimento ? i.vencimento.slice(0, 10) : '—'}</td>
            <td><span style="background:#DCFCE7;color:#166534;border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700">Recebido</span></td>
          </tr>`).join('');
      }
    }

    // Tabela "Em aberto a receber"
    const abTbody = document.getElementById('tabela-aberto-receber-body');
    if (abTbody && data.aReceber) {
      const pendentes = data.aReceber.filter(i => i.status === 'PENDING');
      const now       = new Date();
      if (pendentes.length) {
        abTbody.innerHTML = pendentes.map(i => {
          const dt       = new Date(i.vencimento);
          const atrasado = dt < now;
          const badgeCor = atrasado ? '#FEE2E2' : '#DBEAFE';
          const textCor  = atrasado ? '#991B1B'  : '#1E40AF';
          const label    = atrasado ? 'Vencido'  : 'A vencer';
          return `
            <tr>
              <td style="font-weight:600">${i.nome || '—'}</td>
              <td style="font-weight:700;color:#1E40AF">${fmtBRL(i.valor)}</td>
              <td style="color:#666;font-size:11px">${i.vencimento ? i.vencimento.slice(0, 10) : '—'}</td>
              <td><span style="background:${badgeCor};color:${textCor};border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700">${label}</span></td>
            </tr>`;
        }).join('');
      }
    }

    // Tabela "Contas a pagar"
    const pagTbody = document.getElementById('tabela-contas-pagar-body');
    if (pagTbody && data.aPagar) {
      const now = new Date();
      const pendentes = data.aPagar.filter(i => i.status !== 'PAID' && i.status !== 'PAID_LATE');
      if (pendentes.length) {
        pagTbody.innerHTML = pendentes.map(i => {
          const dt       = new Date(i.vencimento);
          const atrasado = dt < now;
          const cor      = atrasado ? '#EF4444' : '#F59E0B';
          const label    = atrasado ? 'Vencido'  : 'A pagar';
          return `
            <tr>
              <td style="font-weight:600">${i.descricao || '—'}</td>
              <td style="font-weight:700;color:${cor}">${fmtBRL(i.valor)}</td>
              <td style="color:#666;font-size:11px">${i.vencimento ? i.vencimento.slice(0, 10) : '—'}</td>
              <td><span style="background:${atrasado ? '#FEE2E2' : '#FEF9C3'};color:${cor};border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700">${label}</span></td>
            </tr>`;
        }).join('');
      }
    }
  }

  // ──────────────────────────────────────────────────────────
  // BANCO INTER
  // ──────────────────────────────────────────────────────────
  function applyInter(data) {
    if (!data.configured || data.saldo == null) return;

    const saldo = data.saldo;
    const cor   = saldo < 0 ? '#EF4444' : saldo < 500 ? '#F59E0B' : '#22C55E';
    const int   = Math.floor(Math.abs(saldo)).toLocaleString('pt-BR');
    const dec   = Math.abs(saldo).toFixed(2).split('.')[1];
    const sign  = saldo < 0 ? '-' : '';

    // KPI saldo Inter no overview
    const kpiSaldo = document.getElementById('kpi-inter-saldo');
    if (kpiSaldo) {
      kpiSaldo.style.color = cor;
      kpiSaldo.innerHTML   = `${sign}R$ ${int}<sub>,${dec}</sub>`;
    }

    // KPI saldo no view-financeiro
    const finSaldo = document.getElementById('fin-kpi-inter-saldo');
    if (finSaldo) {
      finSaldo.style.color = cor;
      finSaldo.textContent = `${sign}R$ ${int},${dec}`;
    }
  }

  // ──────────────────────────────────────────────────────────
  // BADGE "● LIVE" na topbar
  // ──────────────────────────────────────────────────────────
  function showLiveBadge(sources) {
    const dateChip = document.querySelector('.date-chip');
    if (!dateChip) return;

    // Remove badge antigo se existir
    const old = document.getElementById('obo-live-badge');
    if (old) old.remove();

    const ok    = sources.filter(Boolean).length;
    const total = sources.length;
    const cor   = ok === total ? '#22C55E' : ok > 0 ? '#F59E0B' : '#EF4444';

    const badge = document.createElement('span');
    badge.id    = 'obo-live-badge';
    badge.style.cssText = [
      `background:${cor}`, 'color:#fff', 'font-size:9px', 'font-weight:800',
      'padding:3px 8px', 'border-radius:6px', 'margin-left:8px',
      'letter-spacing:.5px', 'cursor:default'
    ].join(';');
    badge.title       = `Atualizado em ${new Date().toLocaleTimeString('pt-BR')} · ${ok}/${total} fontes OK`;
    badge.textContent = `● LIVE ${ok}/${total}`;
    dateChip.after(badge);
  }

  // ──────────────────────────────────────────────────────────
  // MAIN — busca todas as APIs em paralelo
  // ──────────────────────────────────────────────────────────
  async function loadAll() {
    const [tRaw, cRaw, caRaw, iRaw] = await Promise.allSettled([
      fetch('/api/trello').then(r    => r.json()),
      fetch('/api/clickup').then(r   => r.json()),
      fetch('/api/contaazul').then(r => r.json()),
      fetch('/api/inter').then(r     => r.json())
    ]);

    const tData  = tRaw.status  === 'fulfilled' ? tRaw.value  : null;
    const cData  = cRaw.status  === 'fulfilled' ? cRaw.value  : null;
    const caData = caRaw.status === 'fulfilled' ? caRaw.value : null;
    const iData  = iRaw.status  === 'fulfilled' ? iRaw.value  : null;

    if (tData  && tData.ok)  applyTrello(tData);
    if (cData  && cData.ok)  applyClickUp(cData);
    if (caData && caData.ok) applyContaAzul(caData);
    if (iData)               applyInter(iData);

    showLiveBadge([
      tData  && tData.ok,
      cData  && cData.ok,
      caData && caData.ok,
      iData  && iData.ok && iData.configured
    ]);
  }

  // Aguarda o DOM estar pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAll);
  } else {
    loadAll();
  }
})();
