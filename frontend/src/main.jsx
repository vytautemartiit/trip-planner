import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts ship with the app (no Google Fonts request, works offline)
import '@fontsource/syne/700.css'
import '@fontsource/syne/800.css'
import '@fontsource-variable/manrope/wght.css'
import './index.css'
import App from './App.jsx'
import FeedbackProvider from './components/Feedback'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FeedbackProvider>
      <App />
    </FeedbackProvider>
  </StrictMode>,
)
