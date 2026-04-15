import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // <-- ESTA ES LA LÍNEA MÁGICA QUE DEBES ASEGURARTE QUE ESTÉ
})