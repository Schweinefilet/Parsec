import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { I18nProvider } from './i18n'

// Language wraps everything, including the error boundary inside App: a page
// that has fallen over should still apologise in the reader's own language.
createRoot(document.getElementById('root')).render(
    <I18nProvider>
        <App />
    </I18nProvider>
)
