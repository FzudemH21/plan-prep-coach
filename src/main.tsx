import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n' // must be imported before App so i18n is initialised first

createRoot(document.getElementById("root")!).render(<App />);
