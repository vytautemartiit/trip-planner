// `npm run dev` talks to the backend on your computer; the built site uses the Codespace.
// Set VITE_API_URL to override either one.
export const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? 'http://127.0.0.1:8000'
    : 'https://supreme-computing-machine-r777rj7qj9vq29w6-8000.app.github.dev')
