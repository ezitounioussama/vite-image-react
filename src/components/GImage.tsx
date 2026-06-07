'use client'
import { type ImgHTMLAttributes, useCallback, useEffect, useRef, useState } from 'react'
import { getDeviceFingerprint, listenForChanges } from '../adaptive/fingerprint.ts'
import { PredictiveLoader } from '../adaptive/predictive.ts'
import { isAnimatedFormat } from '../core/formats.ts'
import type { ManifestEntry, QualityTier } from '../core/types.ts'

export interface GImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'width' | 'height'> {
  src: ManifestEntry | string
  alt: string
  priority?: boolean
  sizes?: string
  disableAdaptive?: boolean
  placeholder?: 'blur' | 'none'
  onLoad?: () => void
  onError?: () => void
}

interface LoadState {
  loaded: boolean
  error: boolean
  currentTier: QualityTier
}

export default function GImage({
  src,
  alt,
  priority = false,
  sizes = '100vw',
  disableAdaptive = false,
  placeholder: placeholderMode = 'blur',
  className,
  style,
  loading: loadingProp,
  onLoad,
  onError,
  ...imgProps
}: GImageProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const predictiveRef = useRef<PredictiveLoader | null>(null)
  const [loadState, setLoadState] = useState<LoadState>({
    loaded: false,
    error: false,
    currentTier: 'ultra',
  })

  const metadata: ManifestEntry | null =
    typeof src === 'string'
      ? null
      : {
          src: src.src,
          width: src.width,
          height: src.height,
          format: src.format,
          placeholder: src.placeholder,
          variants: src.variants,
          tiers: src.tiers,
        }

  useEffect(() => {
    if (disableAdaptive || !metadata) {
      setLoadState((prev) => ({ ...prev, currentTier: 'ultra' }))
      return
    }

    const fp = getDeviceFingerprint()
    setLoadState((prev) => ({ ...prev, currentTier: fp.tier }))

    const cleanup = listenForChanges((newFp) => {
      setLoadState((prev) => ({ ...prev, currentTier: newFp.tier }))
    })

    return cleanup
  }, [disableAdaptive, metadata])

  useEffect(() => {
    if (priority || loadingProp === 'eager') {
      setLoadState((prev) => ({ ...prev, loaded: true }))
      return
    }

    if (!containerRef.current) return

    predictiveRef.current = new PredictiveLoader()
    predictiveRef.current.observe(containerRef.current, () => {
      setLoadState((prev) => ({ ...prev, loaded: true }))
    })

    return () => {
      predictiveRef.current?.destroy()
    }
  }, [priority, loadingProp])

  const handleLoad = useCallback(() => {
    setLoadState((prev) => ({ ...prev, loaded: true }))
    onLoad?.()
  }, [onLoad])

  const handleError = useCallback(() => {
    setLoadState((prev) => ({ ...prev, error: true }))
    onError?.()
  }, [onError])

  if (!metadata) {
    return (
      <img
        ref={imgRef}
        {...imgProps}
        src={typeof src === 'string' ? src : ''}
        alt={alt ?? ''}
        className={className}
        style={style}
        loading={priority ? 'eager' : (loadingProp ?? 'lazy')}
        fetchPriority={priority ? 'high' : 'low'}
        onLoad={handleLoad}
        onError={handleError}
      />
    )
  }

  const aspectRatio =
    metadata.width && metadata.height ? (metadata.height / metadata.width) * 100 : 0

  const tier = loadState.currentTier
  const tierVariants = metadata.variants.filter((v) => {
    const tierWidths: Record<QualityTier, number> = {
      ultra: 99999,
      high: 1024,
      medium: 768,
      low: 480,
    }
    return v.width <= tierWidths[tier]
  })

  const hasPlaceholder = placeholderMode === 'blur' && !!metadata.placeholder && !loadState.loaded
  const isAnimated = isAnimatedFormat(metadata.format)

  const pictureContent = (
    <picture>
      {!isAnimated && tierVariants.length > 0 && (
        <>
          <source
            type="image/avif"
            srcSet={tierVariants
              .filter((v) => v.format === 'avif')
              .map((v) => `${v.src} ${v.width}w`)
              .join(', ')}
            sizes={sizes}
          />
          <source
            type="image/webp"
            srcSet={tierVariants
              .filter((v) => v.format === 'webp')
              .map((v) => `${v.src} ${v.width}w`)
              .join(', ')}
            sizes={sizes}
          />
        </>
      )}
      <img
        ref={imgRef}
        {...imgProps}
        src={tierVariants.find((v) => v.format === 'jpeg')?.src ?? metadata.src}
        srcSet={
          tierVariants
            .filter((v) => v.format === 'jpeg' || v.format === 'png')
            .map((v) => `${v.src} ${v.width}w`)
            .join(', ') || undefined
        }
        sizes={sizes}
        alt={alt ?? ''}
        width={metadata.width}
        height={metadata.height}
        loading={loadState.loaded && !priority ? 'lazy' : 'eager'}
        fetchPriority={priority ? 'high' : 'low'}
        decoding={priority ? 'auto' : 'async'}
        className={className}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          background: hasPlaceholder ? `${metadata.placeholder} center/cover no-repeat` : undefined,
          filter: hasPlaceholder ? 'blur(20px)' : undefined,
          transition: 'filter 0.4s ease-out, opacity 0.4s ease-out',
          opacity: loadState.loaded ? 1 : 0.99,
          ...style,
        }}
        onLoad={handleLoad}
        onError={handleError}
      />
    </picture>
  )

  if (aspectRatio > 0) {
    return (
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          paddingBottom: `${aspectRatio}%`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
          }}
        >
          {pictureContent}
        </div>
      </div>
    )
  }

  return <div ref={containerRef}>{pictureContent}</div>
}
