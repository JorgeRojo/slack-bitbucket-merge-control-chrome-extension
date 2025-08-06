import React from 'react';
import { createRoot } from 'react-dom/client';
import '../common/styles/popup.css';

const Popup = () => {
  return <h1>Hola, React!</h1>;
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
