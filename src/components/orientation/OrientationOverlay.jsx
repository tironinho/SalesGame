import './orientation.css'

/**
 * Overlay fullscreen pedindo landscape. Não desmonta o jogo por baixo.
 */
export default function OrientationOverlay({ onTryLock }) {
  return (
    <div
      className="orientationOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="orientation-title"
    >
      <div className="orientationOverlay__card">
        <div className="orientationOverlay__iconWrap" aria-hidden="true">
          <div className="orientationOverlay__device">
            <span className="orientationOverlay__deviceScreen" />
          </div>
        </div>

        <h1 id="orientation-title" className="orientationOverlay__title">
          Gire seu dispositivo
        </h1>

        <p className="orientationOverlay__text">
          Para jogar o Sales Game, use o celular na posição
          {' '}
          <strong>horizontal</strong>
          .
        </p>

        {typeof onTryLock === 'function' ? (
          <button
            type="button"
            className="orientationOverlay__btn"
            onClick={onTryLock}
            aria-label="Tentar tela cheia e travar na horizontal"
          >
            Tela cheia / travar horizontal
          </button>
        ) : null}
      </div>
    </div>
  )
}
