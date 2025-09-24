import React, { useState, useRef, useEffect } from 'react';

// ajuste os paths dos assets conforme você salvou
import bgImg from '/dynamic-data-visualization-3d.jpg';
import logoGame from '/SalesGame_Logo-removebg-preview.png';
import logoMultiplier from '/Multiplier-Copia.png';
import coachPng from '/WhatsApp_Image_2025-06-24_at_16.47.00-removebg-preview.png';

export default function StartScreen({ onEnter }) {
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleEnter() {
    const cleaned = name.trim();
    if (!cleaned) return;
    // callback para o chamador decidir a navegação (ex: ir para /salas)
    onEnter?.(cleaned);
  }

  function onKey(e) {
    if (e.key === 'Enter') handleEnter();
  }

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
          <button className="startBtn" onClick={handleEnter}>Entrar</button>
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
    </div>
  );
}
