export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'svg' | 'bmp' | 'tiff' | 'ico'

export type OutputFormat = 'avif' | 'webp' | 'jpeg' | 'png'

export type QualityTier = 'ultra' | 'high' | 'medium' | 'low'

export interface TierConfig {
  quality: number
  widths: number[]
}

export interface PluginOptions {
  tiers?: Partial<Record<QualityTier, TierConfig>>
  adaptive?: boolean
  autoTune?: boolean
  formats?: OutputFormat[]
  maxFileSize?: number
  widths?: number[]
  verbose?: boolean
  preprocess?: boolean
  faceDetection?: boolean
  remote?: RemoteOptions
}

export interface RemoteOptions {
  domains: string[]
  cacheDir?: string
}

export interface ImageVariant {
  src: string
  width: number
  format: OutputFormat
  size: number
  integrity: string
}

export interface ImageMetadata {
  src: string
  width: number
  height: number
  format: ImageFormat
  placeholder: string
  variants: ImageVariant[]
  tiers: Record<QualityTier, string>
}

export interface TileAnalysis {
  x: number
  y: number
  entropy: number
  edgeDensity: number
  importance: number
  centerWeight: number
}

export interface TileQuality {
  x: number
  y: number
  saliency: number
  quality: number
  weight: number
}

export interface DeviceFingerprint {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown'
  deviceMemory: number
  hardwareConcurrency: number
  devicePixelRatio: number
  saveData: boolean
  tier: QualityTier
}

export interface ManifestEntry {
  src: string
  width: number
  height: number
  format: ImageFormat
  placeholder: string
  tiers: Record<QualityTier, string>
  variants: ImageVariant[]
}

export interface BuildManifest {
  version: string
  generatedAt: string
  entries: Record<string, ManifestEntry>
}
