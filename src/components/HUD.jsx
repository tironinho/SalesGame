import React, { useEffect } from 'react'
import { getPlayerEmojiById } from '../utils/playerEmojis'

export default function HUD({ totals, players }){
  useEffect(() => {
    console.groupCollapsed('[HUD] totals')
    console.log(totals)
    console.groupEnd()
  }, [totals])

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
        <div><b>Manual Onboarding:</b> </div>
        <div><b>Azul:</b> <span>{totals.az || 0}</span> &nbsp;
         <b> Amarelo: </b><span>{totals.am || 0}</span> &nbsp;
          <b>Roxo:</b> <span>{totals.rox || 0}</span>
        </div>
        <div><b>Gestores Comerciais:</b> <span>{totals.gestores ?? totals.gestoresComerciais ?? 0}</span></div>
        <div><b>Capacidade:</b> <span>{totals.possibAt ?? 0}</span> &nbsp; <b>Em Atendimento:</b> <span>{totals.clientsAt ?? 0}</span></div>
      </div>
      <div className="score">
        <div className="title">Placar</div>
        {players.map(p => (
          <div className="row" key={p.id}>
            <span>
              <span style={{ marginRight: '8px', fontSize: '16px' }}>
                {getPlayerEmojiById(p.id, players)}
              </span>
              {p.name}
            </span>
            <span>{p.cash}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
