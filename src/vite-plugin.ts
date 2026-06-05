import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { encodeImage } from './core/encoder.ts'
import { addToManifest, createManifest, writeManifest } from './core/manifest.ts'
import { downloadRemoteImage, isRemoteUrl } from './core/remote.ts'
import type { BuildManifest, PluginOptions, QualityTier, TierConfig } from './core/types.ts'

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|avif|gif|svg|bmp|tiff?|ico)$/i

const DEFAULT_TIERS: Record<QualityTier, TierConfig> = {
  ultra: { quality: 90, widths: [480, 768, 1024, 1920] },
  high: { quality: 80, widths: [480, 768, 1024] },
  medium: { quality: 60, widths: [480, 768] },
  low: { quality: 40, widths: [480] },
}

export default function viteImageReact(userOptions: PluginOptions = {}): Plugin {
  let config: ResolvedConfig
  let manifest = createManifest()
  const options: PluginOptions = {
    tiers: {
      ultra: { ...DEFAULT_TIERS.ultra, ...userOptions.tiers?.ultra },
      high: { ...DEFAULT_TIERS.high, ...userOptions.tiers?.high },
      medium: { ...DEFAULT_TIERS.medium, ...userOptions.tiers?.medium },
      low: { ...DEFAULT_TIERS.low, ...userOptions.tiers?.low },
    },
    widths: userOptions.widths,
    adaptive: userOptions.adaptive ?? true,
    autoTune: userOptions.autoTune ?? true,
    preprocess: userOptions.preprocess ?? true,
    faceDetection: userOptions.faceDetection ?? true,
    formats: userOptions.formats ?? ['avif', 'webp', 'jpeg'],
    maxFileSize: userOptions.maxFileSize ?? 50 * 1024 * 1024,
    verbose: userOptions.verbose ?? false,
    remote: userOptions.remote,
  }

  return {
    name: 'vite-image-react',
    enforce: 'post',

    configResolved(resolved: ResolvedConfig) {
      config = resolved
    },

    async buildStart() {
      manifest = createManifest()

      const publicDir = config.publicDir
      if (publicDir && existsSync(publicDir)) {
        await processPublicDir(publicDir, options, config, manifest)
      }
    },

    async transform(_code: string, id: string) {
      if (!IMAGE_EXTENSIONS.test(id)) return
      if (id.includes('node_modules')) return

      const outDir = resolve(config.root, config.build.outDir ?? 'dist', 'assets')
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true })
      }

      const tiers = options.tiers as Record<QualityTier, TierConfig>
      const formats = options.formats ?? (['avif', 'webp', 'jpeg'] as const)

      let imagePath = id

      if (isRemoteUrl(id)) {
        if (!options.remote) {
          if (options.verbose) {
            console.warn(
              `[vite-image-react] Remote image "${id}" found but no remote config (add \`remote: { domains: [...] }\`)`,
            )
          }
          return
        }
        try {
          imagePath = await downloadRemoteImage(id, options.remote)
          if (options.verbose) {
            console.log(`[vite-image-react] Downloaded remote: ${id}`)
          }
        } catch (error) {
          console.warn(
            `[vite-image-react] Failed to download remote image ${id}: ${error instanceof Error ? error.message : error}`,
          )
          return
        }
      }

      const widths = options.widths ?? tiers.high.widths

      try {
        const entry = await encodeImage(imagePath, {
          widths,
          formats: [...formats],
          tiers,
          autoTune: options.autoTune ?? true,
          adaptive: options.adaptive ?? true,
          preprocess: options.preprocess ?? true,
          faceDetection: options.faceDetection ?? true,
          outDir,
          verbose: options.verbose,
        })

        const key = basename(imagePath)
        addToManifest(manifest, key, entry)

        if (options.verbose) {
          console.log(`[vite-image-react] Optimized: ${key}`)
        }

        const manifestData = JSON.stringify(entry)
        const manifestPath = resolve(outDir, 'gimage-manifest.json')
        writeManifest(manifest, manifestPath)

        return {
          code: `export default ${manifestData};`,
          map: null,
        }
      } catch (error) {
        console.warn(
          `[vite-image-react] Failed to optimize ${basename(imagePath)} — falling back to unoptimized image`,
        )
        if (options.verbose) {
          console.error(`[vite-image-react]   ${error instanceof Error ? error.message : error}`)
        }
        return {
          code: `export default ${JSON.stringify({
            src: basename(imagePath),
            width: 0,
            height: 0,
            format: extname(imagePath).slice(1),
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
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true })
      }
      const manifestPath = resolve(outDir, 'gimage-manifest.json')
      writeManifest(manifest, manifestPath)
    },
  }
}

function scanImages(dir: string): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      results.push(...scanImages(fullPath))
    } else if (IMAGE_EXTENSIONS.test(entry)) {
      results.push(fullPath)
    }
  }
  return results
}

async function processPublicDir(
  publicDir: string,
  options: PluginOptions,
  config: ResolvedConfig,
  manifest: BuildManifest,
): Promise<void> {
  const images = scanImages(publicDir)
  if (images.length === 0) return

  const outDir = resolve(config.root, config.build.outDir ?? 'dist')
  const tiers = (options.tiers ?? {}) as Record<QualityTier, TierConfig>
  const formats = options.formats ?? ['avif', 'webp', 'jpeg']

  for (const imagePath of images) {
    try {
      const relPath = relative(publicDir, imagePath)
      const imageOutDir = resolve(outDir, dirname(relPath))
      if (!existsSync(imageOutDir)) {
        mkdirSync(imageOutDir, { recursive: true })
      }

      const widths = options.widths ?? tiers.high?.widths ?? [480, 768, 1024, 1920]

      const entry = await encodeImage(imagePath, {
        widths,
        formats: [...formats],
        tiers,
        autoTune: options.autoTune ?? true,
        adaptive: options.adaptive ?? true,
        preprocess: options.preprocess ?? true,
        faceDetection: options.faceDetection ?? true,
        outDir: imageOutDir,
        verbose: options.verbose,
      })

      addToManifest(manifest, relPath, entry)

      if (options.verbose) {
        console.log(`[vite-image-react] Optimized public: ${relPath}`)
      }
    } catch (error) {
      if (options.verbose) {
        console.warn(
          `[vite-image-react] Failed to optimize public image ${imagePath}: ${error instanceof Error ? error.message : error}`,
        )
      }
    }
  }
}
