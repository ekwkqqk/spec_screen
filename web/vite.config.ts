import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // exceljs(약 1MB)는 Excel 내보내기 때만 따로 불러온다
  build: { chunkSizeWarningLimit: 1000 },
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': `http://localhost:${process.env.PORT ?? 4300}` },
  },
});
