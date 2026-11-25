import { createContext, useContext } from 'react'

// toast(text, { tone: 'info' | 'success' | 'error', action: { label, onClick } })
// confirm({ title, text, confirmLabel, danger }) -> Promise<boolean>
export const FeedbackContext = createContext({
  toast: () => {},
  confirm: async () => false,
})

export const useFeedback = () => useContext(FeedbackContext)
