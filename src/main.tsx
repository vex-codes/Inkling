import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App.tsx'
import { useStore } from './store.ts'

// Boot once, outside React, so StrictMode's double effects can't seed the sample twice.
useStore.getState().init().catch((e) => console.error('[inkling] failed to open library', e))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
