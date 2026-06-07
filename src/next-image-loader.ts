import { resolve } from 'node:path'
import { BuildEngine } from './build-engine.ts'
import type { PluginOptions } from './core/types.ts'

interface LoaderContext {
  async: () => (err: Error | null, code?: string) => void
  getOptions: () => Record<string, unknown>
  resourcePath: string
}

let engine: BuildEngine | null = null

function getEngine(options: PluginOptions): BuildEngine {
  if (!engine) {
    engine = new BuildEngine(options, process.cwd())
  }
  return engine
}

export default function viteImageReactLoader(this: LoaderContext, _source: string): void {
  const callback = this.async()
  const opts = this.getOptions() as unknown as PluginOptions
  const imagePath = this.resourcePath
  const outDir = resolve(process.cwd(), '.next', 'static', 'media')

  const eng = getEngine(opts)

  eng
    .processImage(imagePath, outDir)
    .then(
      (entry: {
        src: string
        width: number
        height: number
        format: string
        placeholder: string
        variants: Array<unknown>
        tiers: Record<string, string>
      }) => {
        callback(null, `export default ${JSON.stringify(entry)};`)
      },
    )
    .catch((err: Error) => {
      callback(err)
    })
}
