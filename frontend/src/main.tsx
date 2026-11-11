import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './style.css'

if (import.meta.env.DEV && new URLSearchParams(location.search).get('theatre') === '1') {
  void import('./animation/theatreStudio').then(module => module.initializeTheatreStudio())
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
