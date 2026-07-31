import React, { useState, useRef, useEffect } from 'react'
import {
  setTabPlayerName,      // grava o nome nesta ABA
} from '../auth'
import HowToPlayModal from '../modals/HowToPlayModal.jsx'

// ajuste os paths dos assets conforme você salvou
import bgImg from '/dynamic-data-visualization-3d.jpg'
import logoGame from '/SalesGame_Logo-removebg-preview.png'
import logoMultiplier from '/Multiplier-Copia.png'
import coachPng from '/WhatsApp_Image_2025-06-24_at_16.47.00-removebg-preview.png'

export default function StartScreen({ onEnter }) {
  // ✅ OBJ 2: input SEMPRE inicia vazio (não auto-preenche via sessionStorage)
  const [name, setName] = useState("")
  const [howToPlayOpen, setHowToPlayOpen] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
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
            <p><strong>Duração:</strong> escolhida pelo host entre 1 e 5 rodadas (padrão: 5)</p>
            <p><strong>Objetivo:</strong> administrar a empresa e tomar decisões comerciais</p>
            <p><strong>Vitória:</strong> vence quem terminar com o maior patrimônio</p>
            <p className="startSummaryNote">
              Patrimônio é a soma do caixa com os bens.
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
            onClick={() => setHowToPlayOpen(true)}
          >
            Como jogar
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
          <img className="startBrandLogo" src={logoMultiplier} alt="Multiplier" />
        </div>
      </div>

      {/* personagem à direita */}
      <img className="startCoach" src={coachPng} alt="" draggable="false" />

      <HowToPlayModal
        open={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
      />
    </div>
  )
}
