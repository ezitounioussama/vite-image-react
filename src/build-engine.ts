import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { encodeImage } from './core/encoder.ts'
import { addToManifest, createManifest, writeManifest } from './core/manifest.ts'
import { downloadRemoteImage } from './core/remote.ts'
import type {
  BuildManifest,
  ManifestEntry,
  OutputFormat,
  PluginOptions,
  QualityTier,
  TierConfig,
} from './core/types.ts'

export type { BuildManifest, ManifestEntry }
export { createManifest, writeManifest }

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|avif|gif|svg|bmp|tiff?|ico)$/i

const DEFAULT_TIERS: Record<QualityTier, TierConfig> = {
  ultra: { quality: 90, widths: [480, 768, 1024, 1920] },
  high: { quality: 80, widths: [480, 768, 1024] },
  medium: { quality: 60, widths: [480, 768] },
  low: { quality: 40, widths: [480] },
}

function deepMergeTiers(
  userTiers?: Partial<Record<QualityTier, TierConfig>>,
): Record<QualityTier, TierConfig> {
  return {
    ultra: { ...DEFAULT_TIERS.ultra, ...userTiers?.ultra },
    high: { ...DEFAULT_TIERS.high, ...userTiers?.high },
    medium: { ...DEFAULT_TIERS.medium, ...userTiers?.medium },
    low: { ...DEFAULT_TIERS.low, ...userTiers?.low },
  }
}

function resolveOptions(userOptions: PluginOptions): PluginOptions {
  return {
    tiers: deepMergeTiers(userOptions.tiers),
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

export class BuildEngine {
  options: PluginOptions
  rootDir: string
  manifest: BuildManifest

  constructor(userOptions: PluginOptions, rootDir: string) {
    this.options = resolveOptions(userOptions)
    this.rootDir = rootDir
    this.manifest = createManifest()
  }

  private get tiers(): Record<QualityTier, TierConfig> {
    return this.options.tiers as Record<QualityTier, TierConfig>
  }

  private get widths(): number[] {
    return this.options.widths ?? this.tiers.high.widths
  }

  private get formats(): OutputFormat[] {
    return (this.options.formats ?? ['avif', 'webp', 'jpeg']) as OutputFormat[]
  }

  async processImage(imagePath: string, outDir: string): Promise<ManifestEntry> {
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true })
    }

    const entry = await encodeImage(imagePath, {
      widths: this.widths,
      formats: [...this.formats],
      tiers: this.tiers,
      autoTune: this.options.autoTune ?? true,
      adaptive: this.options.adaptive ?? true,
      preprocess: this.options.preprocess ?? true,
      faceDetection: this.options.faceDetection ?? true,
      outDir,
      verbose: this.options.verbose,
    })

    const key = basename(imagePath)
    addToManifest(this.manifest, key, entry)

    return entry
  }

  async processRemoteUrl(
    url: string,
    remoteOptions: PluginOptions['remote'],
  ): Promise<string | null> {
    if (!remoteOptions) return null

    try {
      return await downloadRemoteImage(url, remoteOptions)
    } catch (error) {
      console.warn(
        `[vite-image-react] Failed to download remote image ${url}: ${error instanceof Error ? error.message : error}`,
      )
      return null
    }
  }

  async processPublicDir(publicDir: string): Promise<void> {
    const images = scanImages(publicDir)
    if (images.length === 0) return

    const outDir = resolve(this.rootDir, 'dist')

    for (const imagePath of images) {
      try {
        const relPath = relative(publicDir, imagePath)
        const imageOutDir = resolve(outDir, dirname(relPath))
        if (!existsSync(imageOutDir)) {
          mkdirSync(imageOutDir, { recursive: true })
        }

        const entry = await encodeImage(imagePath, {
          widths: this.widths,
          formats: [...this.formats],
          tiers: this.tiers,
          autoTune: this.options.autoTune ?? true,
          adaptive: this.options.adaptive ?? true,
          preprocess: this.options.preprocess ?? true,
          faceDetection: this.options.faceDetection ?? true,
          outDir: imageOutDir,
          verbose: this.options.verbose,
        })

        addToManifest(this.manifest, relPath, entry)

        if (this.options.verbose) {
          console.log(`[vite-image-react] Optimized public: ${relPath}`)
        }
      } catch (error) {
        if (this.options.verbose) {
          console.warn(
            `[vite-image-react] Failed to optimize public image ${imagePath}: ${error instanceof Error ? error.message : error}`,
          )
        }
      }
    }
  }

  writeManifest(path: string): void {
    writeManifest(this.manifest, path)
  }
}
