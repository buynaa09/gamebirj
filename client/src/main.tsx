import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ClerkProvider } from '@clerk/clerk-react';
import { dark } from '@clerk/themes'; // 1. Dark theme-ийг импортлох

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider 
      publishableKey={PUBLISHABLE_KEY}
      appearance={{
        baseTheme: dark, // 2. Энд dark theme-ийг зааж өгнө
      }}
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>
);