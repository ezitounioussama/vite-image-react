import { describe, expect, it } from 'vitest'
import { BuildEngine } from '../src/build-engine.ts'
import type { PluginOptions } from '../src/core/types.ts'

describe('BuildEngine Next.js compatibility', () => {
  it('accepts empty options', () => {
    const engine = new BuildEngine({}, '/tmp')
    expect(engine.options.formats).toEqual(['avif', 'webp', 'jpeg'])
    expect(engine.options.adaptive).toBe(true)
    expect(engine.options.autoTune).toBe(true)
    expect(engine.options.verbose).toBe(false)
  })

  it('accepts partial remote config', () => {
    const engine = new BuildEngine(
      { remote: { domains: ['example.com'] } } as PluginOptions,
      '/tmp',
    )
    expect(engine.options.remote?.domains).toEqual(['example.com'])
  })

  it('generates manifest for Next.js output directory pattern', () => {
    const engine = new BuildEngine({}, '/tmp')
    const manifest = engine.manifest
    expect(manifest.version).toBe('1.0.0')
    expect(typeof manifest.generatedAt).toBe('string')
    expect(manifest.entries).toEqual({})
  })

  it('deep-merges partial tier configs', () => {
    const engine = new BuildEngine(
      { tiers: { high: { quality: 85, widths: [400] } } } as PluginOptions,
      '/tmp',
    )
    const tiers = engine.options.tiers as Record<string, Record<string, unknown>>
    expect(tiers.high?.quality).toBe(85)
    expect(tiers.high?.widths).toEqual([400])
    expect(tiers.ultra?.quality).toBe(90)
  })
})
