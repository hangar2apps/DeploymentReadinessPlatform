import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import os from 'node:os'

function networkInterfaceLabels(): PluginOption {
  return {
    name: 'network-interface-labels',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const addr = server.httpServer?.address()
        const port = typeof addr === 'object' && addr ? addr.port : 5173
        const rows = Object.entries(os.networkInterfaces()).flatMap(
          ([name, addrs]) =>
            (addrs ?? [])
              .filter((a) => a.family === 'IPv4' && !a.internal)
              .map((a) => `  ${name.padEnd(10)} http://${a.address}:${port}/`),
        )
        if (rows.length) {
          server.config.logger.info('\n  Interfaces:')
          rows.forEach((r) => server.config.logger.info(r))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), networkInterfaceLabels()],
  server: { host: true },
})
