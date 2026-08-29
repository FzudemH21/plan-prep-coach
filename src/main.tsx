import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n' // must be imported before App so i18n is initialised first

// Disable the browser's native "scroll wheel changes a focused number input's
// value" behavior app-wide. Without this, scrolling the page while the cursor
// happens to be over a focused numeric field (e.g. a periodization table cell)
// silently changes the number instead of scrolling — including going negative.
document.addEventListener(
  'wheel',
  (e) => {
    const target = e.target as HTMLElement | null;
    if (
      target instanceof HTMLInputElement &&
      target.type === 'number' &&
      document.activeElement === target
    ) {
      e.preventDefault();
    }
  },
  { passive: false },
);

createRoot(document.getElementById("root")!).render(<App />);
