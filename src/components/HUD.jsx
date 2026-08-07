import React, { useEffect, useState } from 'react'

const DEBUG_LOGS = import.meta.env.DEV && localStorage.getItem('SG_DEBUG_LOGS') === '1'

export default function HUD({ totals, players }){
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (!DEBUG_LOGS) return
    console.groupCollapsed('[HUD] totals')
    console.log(totals)
    console.groupEnd()
  }, [totals])

  return (
    <div className={`hud${showDetails ? ' hud--detailsOpen' : ''}`}>
      <div className="panel">
        <div className="hudMetricsPrimary">
          <div className="line hudMetric"><b className="hudHelp" title="Valor gerado pelas vendas e recursos da empresa.">Faturamento:</b> <span className="pos">$ {totals.faturamento}</span></div>
          <div className="line hudMetric"><b className="hudHelp" title="Custos para manter vendedores, gestores, sistemas e outros recursos.">Manutenção:</b> <span className="neg">$ {totals.manutencao}</span></div>
          <div className="line hudMetric"><b className="hudHelp" title="Recursos recebidos na recuperação financeira que geram obrigações futuras.">Empréstimos:</b> <span>$ {totals.emprestimos}</span></div>
        </div>

        <button
          type="button"
          className="hudDetailsToggle"
          aria-expanded={showDetails}
          aria-controls="hud-secondary-metrics"
          onClick={() => setShowDetails(v => !v)}
        >
          {showDetails ? 'Ocultar detalhes' : 'Ver detalhes'}
        </button>

        <div
          id="hud-secondary-metrics"
          className={`hudMetricsSecondary${showDetails ? ' is-open' : ''}`}
        >
          <div className="line hudMetric"><b>Vendedores Comuns:</b> <span>{totals.vendedoresComuns}</span></div>
          <div className="line hudMetric"><b>Field Sales:</b> <span>{totals.fieldSales}</span></div>
          <div className="line hudMetric"><b>Inside Sales:</b> <span>{totals.insideSales}</span></div>
          <div className="line hudMetric hudMetric--wide"><b>Mix Produtos:</b> <span>{totals.mixProdutos}</span> <b className="hudHelp" title="Valor dos recursos adquiridos que compõem o patrimônio."> Bens:</b> <span>$ {totals.bens}</span></div>
          <div className="line hudMetric hudMetric--wide"><b>ERP/Sistemas:</b> <span>{totals.erpSistemas}</span> <b> Clientes:</b> <span>{totals.clientes}</span></div>
          <div className="hudMetric hudMetric--wide"><b>Manual Onboarding:</b> </div>
          <div className="hudMetric hudMetric--wide"><b>Azul:</b> <span>{totals.az || 0}</span> &nbsp;
           <b> Amarelo: </b><span>{totals.am || 0}</span> &nbsp;
            <b>Roxo:</b> <span>{totals.rox || 0}</span>
          </div>
          <div className="hudMetric"><b>Gestores Comerciais:</b> <span>{totals.gestores ?? totals.gestoresComerciais ?? 0}</span></div>
        </div>

        <div className="hudMetricsPrimary hudMetricsPrimary--capacity">
          <div className="hudMetric hudMetric--wide"><b className="hudHelp" title="Quantidade de clientes que a equipe consegue atender.">Capacidade:</b> <span>{totals.possibAt ?? 0}</span> &nbsp; <b>Em Atendimento:</b> <span>{totals.clientsAt ?? 0}</span></div>
        </div>
      </div>
      <div className="score">
        <div className="title">Placar</div>
        {players.map(p => (
          <div className="row" key={p.id}>
            <span>{p.name}</span>
            <span className="hudHelp" title="Dinheiro disponível para compras, despesas e decisões.">{p.cash}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
