import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SpikeA } from './SpikeA';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SpikeA />
  </StrictMode>,
);
