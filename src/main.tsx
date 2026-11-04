import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './styles.css'
import App from './App'

// Dev-only worst-case data toggle (?data=worst|empty|one|huge). Not in builds.
if (import.meta.env.DEV) await import('./dev/worstCase')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
