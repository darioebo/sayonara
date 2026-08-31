import { mount } from './pdf-app.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}

document.addEventListener('DOMContentLoaded', () => mount(document.getElementById('app')));
