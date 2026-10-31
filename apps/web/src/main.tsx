import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SpikeLab } from './SpikeLab';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SpikeLab />
  </StrictMode>,
);
