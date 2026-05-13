import './lib/sentry'

import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'

import App from './App.tsx'
import './index.css'
import {Sentry} from './lib/sentry'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div style={{padding: 24, fontFamily: 'system-ui', textAlign: 'center'}}>
          <h1>Something broke.</h1>
          <p>Reload the page to keep going.</p>
        </div>
      }
    >
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
