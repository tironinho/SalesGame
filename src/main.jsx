import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Provider do sistema de modais (nomeado)
import { ModalProvider } from './modals/ModalContext.jsx'

import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ModalProvider>
      <App />
    </ModalProvider>
  </React.StrictMode>
)
