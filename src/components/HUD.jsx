import React from 'react'

export default function HUD({ totals, players }){
  return (
    <div className="hud">
      <div className="panel">
        <div className="line"><b>Faturamento:</b> <span className="pos">$ {totals.faturamento}</span></div>
        <div className="line"><b>Manutenção:</b> <span className="neg">$ {totals.manutencao}</span></div>
        <div className="line"><b>Empréstimos:</b> <span>$ {totals.emprestimos}</span></div>
        <div className="line"><b>Vendedores Comuns:</b> <span>{totals.vendedoresComuns}</span></div>
        <div className="line"><b>Field Sales:</b> <span>{totals.fieldSales}</span></div>
        <div className="line"><b>Inside Sales:</b> <span>{totals.insideSales}</span></div>
        <div className="line"><b>Mix Produtos:</b> <span>{totals.mixProdutos}</span> <b> Bens:</b> <span>$ {totals.bens}</span></div>
        <div className="line"><b>ERP/Sistemas:</b> <span>{totals.erpSistemas}</span> <b> Clientes:</b> <span>{totals.clientes}</span></div>
        <div className="line"><b>Manual Onboarding</b></div>
        <div className="line"><b>Azul:</b> 0 <b>Amarelo:</b> 0 <b>Roxo:</b> 0</div>
        <div className="line"><b>Gestores Comerciais:</b> 0</div>
      </div>
      <div className="score">
        <div className="title">Placar</div>
        {players.map(p => (
          <div className="row" key={p.id}>
            <span>{p.name}</span>
            <span>{p.cash}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
