import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AquaReadyApp } from './aquaready/AquaReadyApp'
import { registerServiceWorker } from './pwa'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AquaReadyApp />
  </StrictMode>,
)
