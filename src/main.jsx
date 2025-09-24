import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// 👇 importe o provider do seu contexto de modais
import { ModalProvider } from './modals/ModalContext'

import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ModalProvider>
      <App />
    </ModalProvider>
  </React.StrictMode>
)
