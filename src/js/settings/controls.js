import { clearFieldInvalid } from './validation.js';

// Add event listeners to clear invalid states when user types
document.querySelectorAll('input, select, textarea').forEach((el) => {
  el.addEventListener('input', () => {
    clearFieldInvalid(el.id);
  });
});
