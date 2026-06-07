import { afterAll, describe, expect, it } from 'vitest'
import { BuildEngine } from '../src/build-engine.ts'
import type { ManifestEntry, PluginOptions } from '../src/core/types.ts'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const TMP_DIR = join(__dirname, '..', 'tmp-build-engine-test')

async function createTestImage(width = 100, height = 100): Promise<string> {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true })
  const path = join(TMP_DIR, `test-${width}x${height}-${Date.now()}.jpg`)
  await sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .jpeg()
    .toFile(path)
  return path
}

describe('BuildEngine', () => {
  const outDir = join(TMP_DIR, 'out')

  afterAll(() => {
    rmSync(TMP_DIR, { recursive: true, force: true })
  })

  it('creates manifest on construction', () => {
    const engine = new BuildEngine({}, TMP_DIR)
    expect(engine.manifest).toBeDefined()
    expect(engine.manifest.version).toBe('1.0.0')
    expect(engine.manifest.entries).toEqual({})
  })

  it('merges tier options with defaults', () => {
    const engine = new BuildEngine(
      { tiers: { ultra: { quality: 95 } } } as PluginOptions,
      TMP_DIR,
    )
    const tiers = engine.options.tiers as Record<string, { quality: number; widths: number[] }>
    expect(tiers.ultra?.quality).toBe(95)
    expect(tiers.ultra?.widths).toEqual([480, 768, 1024, 1920])
    expect(tiers.low?.quality).toBe(40)
  })

  it('applies top-level widths override', () => {
    const engine = new BuildEngine({ widths: [100, 200] } as PluginOptions, TMP_DIR)
    expect(engine['widths']).toEqual([100, 200])
  })

  it('processes an image and returns manifest entry', async () => {
    const imgPath = await createTestImage()
    const engine = new BuildEngine(
      { formats: ['jpeg'], tiers: { high: { quality: 80, widths: [50] } } } as unknown as PluginOptions,
      TMP_DIR,
    )

    const entry: ManifestEntry = await engine.processImage(imgPath, outDir)

    expect(entry.width).toBeGreaterThan(0)
    expect(entry.height).toBeGreaterThan(0)
    expect(entry.format).toBe('jpeg')
    expect(entry.variants.length).toBeGreaterThan(0)
    expect(entry.placeholder).toBeTruthy()
    expect(entry.variants.length).toBeGreaterThan(0)
    expect(entry.variants.some((v) => existsSync(join(outDir, v.src)))).toBe(true)
  })

  it('adds processed image to manifest', async () => {
    const imgPath = await createTestImage()
    const engine = new BuildEngine(
      { formats: ['jpeg'], tiers: { high: { quality: 80, widths: [50] } } } as unknown as PluginOptions,
      TMP_DIR,
    )

    const key = imgPath.split('/').pop()!
    await engine.processImage(imgPath, outDir)

    expect(engine.manifest.entries[key]).toBeDefined()
    expect(engine.manifest.entries[key]?.format).toBe('jpeg')
  })

  it('writes manifest file to disk', async () => {
    const imgPath = await createTestImage()
    const engine = new BuildEngine(
      { formats: ['jpeg'], tiers: { high: { quality: 80, widths: [50] } } } as unknown as PluginOptions,
      TMP_DIR,
    )

    await engine.processImage(imgPath, outDir)
    const manifestPath = join(TMP_DIR, 'manifest.json')
    engine.writeManifest(manifestPath)

    expect(existsSync(manifestPath)).toBe(true)
    const content = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    expect(content.version).toBe('1.0.0')
    expect(Object.keys(content.entries).length).toBeGreaterThan(0)
  })

  it('processPublicDir scans and optimizes images', async () => {
    const publicDir = join(TMP_DIR, 'public')
    if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true })

    const imgPath = join(publicDir, 'public-test.jpg')
    await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .jpeg()
      .toFile(imgPath)

    const engine = new BuildEngine(
      { formats: ['jpeg'], tiers: { high: { quality: 80, widths: [50] } } } as unknown as PluginOptions,
      TMP_DIR,
    )

    await engine.processPublicDir(publicDir)

    expect(Object.keys(engine.manifest.entries).length).toBeGreaterThan(0)
  })

  it('handles remote URLs - returns null when no remote config', async () => {
    const engine = new BuildEngine({} as PluginOptions, TMP_DIR)
    const result = await engine.processRemoteUrl('https://example.com/image.jpg', undefined)
    expect(result).toBeNull()
  })
})
