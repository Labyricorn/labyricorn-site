import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '')
  
  // Validate required environment variables (skip in test mode)
  if (mode !== 'test') {
    const required = ['VITE_API_BASE_URL']
    const missing = required.filter(key => !env[key])
    
    if (missing.length > 0) {
      console.warn(`⚠️  Warning: Missing environment variables: ${missing.join(', ')}`)
      console.warn(`⚠️  Please copy frontend/.env.example to frontend/.env and configure the variables.`)
      console.warn(`⚠️  Using default value: http://localhost:8000/api/v1`)
    }
  }
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@services': path.resolve(__dirname, './src/services'),
        '@types': path.resolve(__dirname, './src/types'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
  }
})
