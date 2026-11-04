import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Lets the page load through an ngrok tunnel when sharing a local preview
    allowedHosts: ['.ngrok-free.dev'],
  },
});
