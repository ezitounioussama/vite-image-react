import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PluginOptions } from './core/types.ts'

// biome-ignore lint/suspicious/noExplicitAny: Next.js config type is dynamic
type NextConfig = Record<string, any>

export default function withViteImageReact(
  nextConfig: NextConfig = {},
  pluginOptions: PluginOptions = {},
): NextConfig {
  const dirname =
    typeof __dirname !== 'undefined' ? __dirname : fileURLToPath(new URL('.', import.meta.url))

  return {
    ...nextConfig,
    webpack(
      config: { module: { rules: Array<Record<string, unknown>> } },
      options: { isServer: boolean; dev: boolean },
    ) {
      if (!config.module) config.module = { rules: [] }

      config.module.rules.push({
        test: /\.(jpe?g|png|webp|avif|gif|svg|bmp|tiff?|ico)$/i,
        issuer: /\.(js|jsx|ts|tsx|mjs)$/,
        exclude: /node_modules/,
        use: {
          loader: resolve(dirname, 'next-image-loader.cjs'),
          options: pluginOptions,
        },
      })

      // biome-ignore lint/complexity/useLiteralKeys: index signature access
      if (typeof nextConfig['webpack'] === 'function') {
        // biome-ignore lint/complexity/useLiteralKeys: index signature access
        return nextConfig['webpack'](config, options)
      }

      return config
    },

    // biome-ignore lint/complexity/useLiteralKeys: need bracket access for index signature
    ['images']: {
      // biome-ignore lint/complexity/useLiteralKeys: index signature access
      ...(nextConfig['images'] || {}),
      remotePatterns: [
        // biome-ignore lint/complexity/useLiteralKeys: index signature access
        ...(nextConfig['images']?.remotePatterns || []),
        ...(pluginOptions.remote?.domains?.map((d: string) => ({
          protocol: 'https' as const,
          hostname: d,
        })) || []),
      ],
    },
  }
}
