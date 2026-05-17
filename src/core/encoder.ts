import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { contentHash, sriHash } from '../utils/hash.ts'
import type { AnalysisResult } from './analyzer.ts'
import { analyzeImage, computeTargetQuality } from './analyzer.ts'
import { isAnimatedFormat } from './formats.ts'
import { preprocessImage } from './preprocessor.ts'
import { sanitizeSvg } from './sanitizer.ts'
import { autoTuneQuality } from './tuner.ts'
import type { ImageVariant, ManifestEntry, OutputFormat, QualityTier, TierConfig } from './types.ts'
import {
  validateFileSize,
  validateImageContent,
  validateOutputFormat,
  validatePath,
} from './validator.ts'

export interface EncodeOptions {
  widths: number[]
  formats: OutputFormat[]
  tiers: Record<QualityTier, TierConfig>
  autoTune: boolean
  adaptive: boolean
  preprocess: boolean
  faceDetection: boolean
  outDir: string
}

export interface EncodeResult {
  entries: Record<string, ManifestEntry>
}

function readFileSafe(filePath: string): Buffer {
  validatePath(filePath)
  const buffer = readFileSync(filePath)
  validateFileSize(buffer.length)
  return buffer
}

async function encodeVariant(
  source: string | Buffer,
  width: number,
  format: OutputFormat,
  quality: number,
  outDir: string,
): Promise<ImageVariant | null> {
  try {
    validateOutputFormat(format)

    const img = typeof source === 'string' ? sharp(source) : sharp(source)
    const metadata = await img.metadata()

    if ((metadata.width ?? 0) <= width) {
      const buffer = await img[format]({ quality }).toBuffer()
      const hash = contentHash(buffer)
      const ext = format === 'jpeg' ? 'jpg' : format
      const filename = `${hash}-${width}.${ext}`
      const outPath = `${outDir}/${filename}`

      await sharp(buffer).toFile(outPath)

      return {
        src: filename,
        width,
        format,
        size: buffer.length,
        integrity: sriHash(buffer),
      }
    }

    const resized =
      typeof source === 'string'
        ? await sharp(source).resize(width).toBuffer()
        : await sharp(source).resize(width).toBuffer()
    const encoded = await sharp(resized)[format]({ quality }).toBuffer()
    const hash = contentHash(encoded)
    const ext = format === 'jpeg' ? 'jpg' : format
    const filename = `${hash}-${width}.${ext}`
    const outPath = `${outDir}/${filename}`

    await sharp(encoded).toFile(outPath)

    return {
      src: filename,
      width,
      format,
      size: encoded.length,
      integrity: sriHash(encoded),
    }
  } catch {
    return null
  }
}

export async function encodeImage(
  imagePath: string,
  options: EncodeOptions,
): Promise<ManifestEntry> {
  const buffer = readFileSafe(imagePath)
  const ext = imagePath.split('.').pop() ?? 'jpg'
  const format = validateImageContent(buffer, ext)

  if (format === 'svg') {
    const content = buffer.toString('utf-8')
    const sanitized = sanitizeSvg(content)
    const hash = contentHash(Buffer.from(sanitized))
    const filename = `${hash}.svg`
    const svgBuffer = Buffer.from(sanitized)

    return {
      src: filename,
      width: 0,
      height: 0,
      format: 'svg',
      placeholder: '',
      tiers: {} as Record<QualityTier, string>,
      variants: [
        {
          src: filename,
          width: 0,
          format: 'webp',
          size: svgBuffer.length,
          integrity: sriHash(svgBuffer),
        },
      ],
    }
  }

  if (isAnimatedFormat(format)) {
    const img = sharp(buffer, { animated: true })
    const metadata = await img.metadata()
    const width = metadata.width ?? 0
    const height = metadata.height ?? 0

    const webpBuffer = await img.webp({ quality: 75 }).toBuffer()
    const hash = contentHash(webpBuffer)
    const filename = `${hash}.webp`

    return {
      src: filename,
      width,
      height,
      format: 'gif',
      placeholder: '',
      tiers: {} as Record<QualityTier, string>,
      variants: [
        {
          src: filename,
          width,
          format: 'webp',
          size: webpBuffer.length,
          integrity: sriHash(webpBuffer),
        },
      ],
    }
  }

  const metadata = await sharp(buffer).metadata()
  const originalWidth = metadata.width ?? 0
  const originalHeight = metadata.height ?? 0

  let placeholder = ''
  if (originalWidth > 0 && originalHeight > 0) {
    const placeholderBuffer = await sharp(buffer)
      .resize(32, 32, { fit: 'inside' })
      .webp({ quality: 20 })
      .toBuffer()
    placeholder = `data:image/webp;base64,${placeholderBuffer.toString('base64')}`
  }

  const tiers: Partial<Record<QualityTier, string>> = {}
  const variants: ImageVariant[] = []

  let analysis: AnalysisResult | null = null
  let preprocessedSource: Buffer | null = null

  if (options.adaptive || options.preprocess) {
    try {
      analysis = await analyzeImage(imagePath, 64, options.faceDetection)
    } catch {}
  }

  if (options.preprocess && analysis) {
    try {
      preprocessedSource = await preprocessImage(imagePath, analysis)
    } catch {}
  }

  const source = preprocessedSource ?? imagePath

  for (const [tierKey, tierConfig] of Object.entries(options.tiers)) {
    const tier = tierKey as QualityTier
    let quality = tierConfig.quality

    if (options.adaptive && analysis) {
      try {
        quality = computeTargetQuality(analysis, quality, {
          minQuality: Math.max(20, quality - 30),
          maxQuality: Math.min(95, quality + 10),
        })
      } catch {}
    }

    if (options.autoTune) {
      try {
        const tuned = await autoTuneQuality(source, 'webp', {
          threshold: 0.97,
          minQuality: Math.max(40, quality - 10),
          maxQuality: Math.min(95, quality + 5),
        })
        quality = tuned.quality
      } catch {}
    }

    const widths = tierConfig.widths.filter((w) => w <= originalWidth)
    if (widths.length === 0) {
      widths.push(originalWidth)
    }

    for (const w of widths) {
      for (const fmt of options.formats) {
        const variant = await encodeVariant(source, w, fmt, quality, options.outDir)
        if (variant) {
          variants.push(variant)
        }
      }
    }

    const bestVariant = variants.find((v) => v.format === 'webp')
    if (bestVariant) {
      tiers[tier] = bestVariant.src
    }
  }

  return {
    src: imagePath.split('/').pop() ?? 'image',
    width: originalWidth,
    height: originalHeight,
    format,
    placeholder,
    tiers: tiers as Record<QualityTier, string>,
    variants,
  }
}
