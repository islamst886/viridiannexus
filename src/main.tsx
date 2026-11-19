import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { GlobalStateProvider } from './context/GlobalState';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <AuthProvider>
      <GlobalStateProvider>
        <App />
      </GlobalStateProvider>
    </AuthProvider>
  </StrictMode>
);
