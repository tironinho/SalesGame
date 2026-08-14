import React, { useState, useRef, useEffect } from 'react'
import {
  setTabPlayerName,      // grava o nome nesta ABA
} from '../auth'
import TutorialModal from './TutorialModal.jsx'
import TironiCredit from './TironiCredit.jsx'

// ajuste os paths dos assets conforme você salvou
import bgImg from '/dynamic-data-visualization-3d.jpg'
import logoGame from '/SalesGame_Logo-removebg-preview.png'
import logoMultiplier from '/Multiplier-Copia.png'

export default function StartScreen({ onEnter }) {
  // ✅ OBJ 2: input SEMPRE inicia vazio (não auto-preenche via sessionStorage)
  const [name, setName] = useState("")
  // Tour automático fica ao entrar no tabuleiro; aqui só reabertura manual
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const inputRef = useRef(null)

  // Desktop: foca o nome. Mobile/touch: NÃO autofocar — Safari dá zoom em inputs.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const narrow = window.matchMedia('(max-width: 960px)').matches
    if (coarse || narrow) return
    inputRef.current?.focus()
  }, [])

  function handleEnter() {
    const cleaned = (name || '').trim()
    if (!cleaned) return
    setTabPlayerName(cleaned)  // <- salva o nome desta ABA (sessionStorage)
    onEnter?.(cleaned)         // callback para navegação (ex.: ir para lista de salas)
  }

  function onKey(e) {
    if (e.key === 'Enter') handleEnter()
  }

  const canEnter = (name || '').trim().length > 0

  return (
    <div className="start">
      <img className="startBg" src={bgImg} alt="" />
      <div className="startShade" />

      {/* topo com logo do jogo */}
      <div className="startHeader">
        <img className="startLogo" src={logoGame} alt="Sales GAME" />
      </div>

      {/* card central com input e botão */}
      <div className="startCenter">
        <div className="startCard">
          <p className="startHint">
            Digite seu nome e entre para visualizar as salas disponíveis.
          </p>

          <div className="startSummary">
            <p><strong>Duração:</strong> escolhida pelo host entre 1 e 5 rodadas (padrão: 5). A partida termina após esse número.</p>
            <p><strong>Objetivo:</strong> administrar a empresa e tomar decisões comerciais</p>
            <p><strong>Vitória:</strong> vence quem terminar com o maior patrimônio</p>
            <p className="startSummaryNote">
              Patrimônio = Caixa + Bens. Em empate, maior caixa desempata.
            </p>
          </div>

          <label className="startLabel" htmlFor="playerName">Nome do Jogador</label>
          <input
            id="playerName"
            ref={inputRef}
            className="startInput"
            placeholder="Digite seu nome"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={onKey}
            maxLength={30}
          />
          <button className="startBtn" onClick={handleEnter} disabled={!canEnter} aria-disabled={!canEnter}>
            Entrar
          </button>
          <button
            type="button"
            className="startBtnSecondary"
            onClick={() => setTutorialOpen(true)}
          >
            Tour / Como jogar
          </button>
        </div>
      </div>

      {/* rodapé com redes/site e marcas */}
      <div className="startFooter">
        <div className="startLinks">
          <div>@multiplier.educacao</div>
          <div>https://multipliereducacao.com.br/</div>
        </div>

        <div className="startBrand">
          <TironiCredit compact />
          <img className="startBrandLogo" src={logoMultiplier} alt="Multiplier" />
        </div>
      </div>

      <TutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
      />
    </div>
  )
}
