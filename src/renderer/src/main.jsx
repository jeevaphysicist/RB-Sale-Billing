import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyFontScaleToDocument, loadStoredFontScale } from './contexts/AccessibilityContext'

applyFontScaleToDocument(loadStoredFontScale())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
