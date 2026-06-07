import { resolve } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { BuildEngine } from './build-engine.ts'
import { isRemoteUrl } from './core/remote.ts'
import type { PluginOptions } from './core/types.ts'

export default function viteImageReact(userOptions: PluginOptions = {}): Plugin {
  let config: ResolvedConfig
  let engine: BuildEngine

  return {
    name: 'vite-image-react',
    enforce: 'post',

    configResolved(resolved: ResolvedConfig) {
      config = resolved
      engine = new BuildEngine(userOptions, config.root)
    },

    async buildStart() {
      engine = new BuildEngine(userOptions, config.root)
      const publicDir = config.publicDir
      if (publicDir) {
        await engine.processPublicDir(publicDir)
      }
    },

    async transform(_code: string, id: string) {
      if (!/\.(jpe?g|png|webp|avif|gif|svg|bmp|tiff?|ico)$/i.test(id)) return
      if (id.includes('node_modules')) return

      const outDir = resolve(config.root, config.build.outDir ?? 'dist', 'assets')

      let imagePath = id

      if (isRemoteUrl(id)) {
        if (!engine.options.remote) {
          if (engine.options.verbose) {
            console.warn(
              `[vite-image-react] Remote image "${id}" found but no remote config (add \`remote: { domains: [...] }\`)`,
            )
          }
          return
        }
        const downloaded = await engine.processRemoteUrl(id, engine.options.remote)
        if (!downloaded) return
        imagePath = downloaded
      }

      try {
        const entry = await engine.processImage(imagePath, outDir)
        engine.writeManifest(resolve(outDir, 'gimage-manifest.json'))

        return {
          code: `export default ${JSON.stringify(entry)};`,
          map: null,
        }
      } catch (error) {
        console.warn(
          `[vite-image-react] Failed to optimize ${id} — falling back to unoptimized image`,
        )
        if (engine.options.verbose) {
          console.error(`[vite-image-react]   ${error instanceof Error ? error.message : error}`)
        }
        return {
          code: `export default ${JSON.stringify({
            src: id.split('/').pop() ?? 'image',
            width: 0,
            height: 0,
            format: id.split('.').pop() ?? 'jpg',
            placeholder: '',
            variants: [],
            tiers: {},
          })};`,
          map: null,
        }
      }
    },

    closeBundle() {
      const outDir = resolve(config.root, config.build.outDir ?? 'dist', 'assets')
      engine.writeManifest(resolve(outDir, 'gimage-manifest.json'))
    },
  }
}
