import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/sora/index.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import './index.css'
import App from './App.tsx'
import { RoleProvider } from './context/RoleContext'
import { LayoutProvider } from './context/LayoutContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <RoleProvider>
        <LayoutProvider>
          <App />
        </LayoutProvider>
      </RoleProvider>
    </BrowserRouter>
  </StrictMode>,
)
