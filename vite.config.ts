import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
) as { version?: string }

/** Short git hash of the commit being built; falls back to "local" outside a git checkout. */
function resolveCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'local'
  }
}

/**
 * En desarrollo, `http://localhost:5173/legacy-manager` (sin barra final) no es
 * una ruta válida para Vite y muestra un error. Redirigimos a la URL base real
 * antes de que llegue al middleware de Vite.
 */
function baseTrailingSlashRedirect(base: string): Plugin {
  const cleanBase = `/${base.replace(/^\/|\/$/g, '')}`
  return {
    name: 'base-trailing-slash-redirect',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url) return next()
        const [pathname, search] = request.url.split('?')
        if (pathname === cleanBase) {
          response.writeHead(302, { Location: `${cleanBase}/${search ? `?${search}` : ''}` })
          response.end()
          return
        }
        next()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), baseTrailingSlashRedirect('/legacy-manager/')],
  // GitHub Pages deploys to /legacy-manager/ subdirectory
  base: '/legacy-manager/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version ?? '0.0.0'),
    __APP_COMMIT__: JSON.stringify(resolveCommit()),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Las dependencias cambian poco: en un chunk aparte se cachean entre
        // despliegues y el navegador solo descarga el código de la página.
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase'
          if (id.includes('node_modules/react') || id.includes('node_modules/react-router')) return 'react'
          return undefined
        },
      },
    },
  },
})
