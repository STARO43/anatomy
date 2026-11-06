// main.js — точка входа, монтирование приложения
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

const container = document.getElementById('root');

if (container) {
  createRoot(container).render(<App />);
} else {
  console.error('main.js: root element not found');
}