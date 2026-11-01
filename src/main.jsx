import React from 'react';
import { createRoot } from 'react-dom/client';
import Stagecraft from './Stagecraft.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Stagecraft />
  </React.StrictMode>,
);