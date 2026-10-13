import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'node:path';

// WebAuthn + PRF (Mera) need a secure context. localhost is already secure;
// set HTTPS=true to test from a phone over the LAN with a self-signed cert.
export default defineConfig({
  base: '/monadow/',
  plugins: [...(process.env.HTTPS === 'true' ? [basicSsl()] : []), react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  server: { port: 5173, allowedHosts: ['.ts.net'] },
});
