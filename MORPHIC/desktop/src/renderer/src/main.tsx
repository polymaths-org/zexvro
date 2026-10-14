import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/lexend'
import '@fontsource-variable/atkinson-hyperlegible-next'
import '@fontsource/lexend-tera/500.css'
import './styles.css'
import { App } from './App'

document.documentElement.dataset.platform = window.morphic.platform

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
