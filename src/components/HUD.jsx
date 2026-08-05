import React, { useEffect } from 'react'

const DEBUG_LOGS = import.meta.env.DEV && localStorage.getItem('SG_DEBUG_LOGS') === '1'

export default function HUD({ totals, players }){
  useEffect(() => {
    if (!DEBUG_LOGS) return
    console.groupCollapsed('[HUD] totals')
    console.log(totals)
    console.groupEnd()
  }, [totals])

  return (
    <div className="hud">
      <div className="panel">
        <div className="line"><b className="hudHelp" title="Valor gerado pelas vendas e recursos da empresa.">Faturamento:</b> <span className="pos">$ {totals.faturamento}</span></div>
        <div className="line"><b className="hudHelp" title="Custos para manter vendedores, gestores, sistemas e outros recursos.">Manutenção:</b> <span className="neg">$ {totals.manutencao}</span></div>
        <div className="line"><b className="hudHelp" title="Recursos recebidos na recuperação financeira que geram obrigações futuras.">Empréstimos:</b> <span>$ {totals.emprestimos}</span></div>
        <div className="line"><b>Vendedores Comuns:</b> <span>{totals.vendedoresComuns}</span></div>
        <div className="line"><b>Field Sales:</b> <span>{totals.fieldSales}</span></div>
        <div className="line"><b>Inside Sales:</b> <span>{totals.insideSales}</span></div>
        <div className="line"><b>Mix Produtos:</b> <span>{totals.mixProdutos}</span> <b className="hudHelp" title="Valor dos recursos adquiridos que compõem o patrimônio."> Bens:</b> <span>$ {totals.bens}</span></div>
        <div className="line"><b>ERP/Sistemas:</b> <span>{totals.erpSistemas}</span> <b> Clientes:</b> <span>{totals.clientes}</span></div>
        <div><b>Manual Onboarding:</b> </div>
        <div><b>Azul:</b> <span>{totals.az || 0}</span> &nbsp;
         <b> Amarelo: </b><span>{totals.am || 0}</span> &nbsp;
          <b>Roxo:</b> <span>{totals.rox || 0}</span>
        </div>
        <div><b>Gestores Comerciais:</b> <span>{totals.gestores ?? totals.gestoresComerciais ?? 0}</span></div>
        <div><b className="hudHelp" title="Quantidade de clientes que a equipe consegue atender.">Capacidade:</b> <span>{totals.possibAt ?? 0}</span> &nbsp; <b>Em Atendimento:</b> <span>{totals.clientsAt ?? 0}</span></div>
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
