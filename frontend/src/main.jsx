// import { StrictMode } from 'react'
// import { createRoot } from 'react-dom/client'
// import './index.css'
// import App from './App.jsx'

// createRoot(document.getElementById('root')).render(
//   <StrictMode>
//     <App />
//   </StrictMode>,
// )


import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react';
// import '@neondatabase/neon-js/ui/css';
import './index.css'
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { authClient } from '../src/services/authNeonService';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* <NeonAuthUIProvider emailOTP authClient={authClient}> */}
        <App />
    {/* </NeonAuthUIProvider> */}
  </StrictMode>
);
