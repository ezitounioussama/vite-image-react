# vite-image-react

**Content-aware, device-adaptive image optimizer for Vite + React.**

Built by [@ezitounioussama](https://github.com/ezitounioussama) — [gotodev.ma](https://gotodev.ma)

Surpasses `next/image` in perceptual quality at equal or smaller file sizes. Works with any Vite project, not locked to any framework.

[![npm version](https://img.shields.io/npm/v/vite-image-react.svg)](https://www.npmjs.com/package/vite-image-react)
[![npm downloads](https://img.shields.io/npm/dw/vite-image-react)](https://www.npmjs.com/package/vite-image-react)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/vite-image-react)](https://bundlephobia.com/package/vite-image-react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D18.17-brightgreen)](https://nodejs.org)
[![Vite compatibility](https://registry.vite.dev/api/badges?package=vite-image-react&tool=vite)](https://registry.vite.dev/plugins)
[![React](https://img.shields.io/badge/react-%3E%3D19-blue)](https://react.dev)
[![GitHub stars](https://img.shields.io/github/stars/ezitounioussama/vite-image-react)](https://github.com/ezitounioussama/vite-image-react)

---

## How it works

### Build time (Vite plugin)

Every image is divided into 64×64 tiles and analyzed:

1. **Analyze** — per-tile Shannon entropy, Sobel edge density, and skin-tone ratio produce an importance map
2. **Weight** — top 30% most-important tiles drive 70% of the quality decision; center-bias and edge-bonuses refine it
3. **Preprocess** — high-importance tiles are selectively sharpened (with overlapped boundaries to prevent seams)
4. **Encode** — each tier/variant is encoded at the perceptually-weighted quality; SSIM auto-tune finds the Pareto-optimal quality/size point
5. **Emit** — manifest with variants, tiers, LQIP placeholders, and SRI hashes is embedded in the module

### Runtime (GImage component)

1. **Fingerprint** — reads `effectiveType`, `deviceMemory`, `hardwareConcurrency`, `devicePixelRatio`, `saveData`
2. **Tier** — scoring algorithm selects `ultra`/`high`/`medium`/`low` per device capability
3. **Format** — `<picture>` with AVIF, WebP, and JPEG sources
4. **Load** — IntersectionObserver with scroll-velocity-adaptive preload distance (600–3000px)
5. **Placeholder** — blur-up CSS transition from 32×32 WebP base64 to full image

---

## Features

- **Perceptually-optimized quality** — 64×64 tile saliency drives quality per region. Faces, text, and detail get higher quality; backgrounds compress harder.
- **Saliency-driven preprocessing** — important tiles are sharpened before encoding, preserving detail where it matters.
- **Skin-tone face detection** — automatic quality boost around skin-colored regions. Zero extra dependencies.
- **SSIM auto-tune** — finds the lowest quality where SSIM >= 0.97, saving 20–40% file size with no visible loss.
- **Device-adaptive delivery** — runtime fingerprinting selects the optimal quality tier for each device.
- **Automatic format conversion** — AVIF, WebP, and JPEG sources in a `<picture>` element.
- **Predictive lazy loading** — scroll velocity sampling dynamically adjusts the preload distance.
- **Blur-up placeholders** — 32×32 WebP base64 with CSS fade-in.
- **CLS prevention** — fixed-aspect-ratio container from image metadata.
- **SVG optimization** — automatic SVGO compression with security sanitization.

---

## Install

```bash
npm install vite-image-react
```

---

## Usage

### Vite plugin

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteImageReact from 'vite-image-react/vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    viteImageReact(),
  ],
})
```

### React component

```tsx
import GImage from 'vite-image-react'
import hero from './hero.jpg'

function Page() {
  return (
    <GImage
      src={hero}
      alt="Hero banner"
      priority
      sizes="(max-width: 768px) 100vw, 50vw"
    />
  )
}
```

### Remote images

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteImageReact from 'vite-image-react/vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    viteImageReact({
      remote: {
        domains: ['images.unsplash.com', 'cdn.example.com'],
      },
    }),
  ],
})
```

```tsx
import GImage from 'vite-image-react'
import hero from 'https://images.unsplash.com/photo-1234567890'

function Page() {
  return (
    <GImage src={hero} alt="Remote hero" />
  )
}
```

### Public directory images

Images placed in your project's `public/` directory are automatically scanned and optimized during build. No import needed:

```
public/
├── logo.png          ← optimized to dist/logo.png
├── og-image.jpg      ← optimized to dist/og-image.jpg
└── images/
    └── banner.webp   ← optimized to dist/images/banner.webp
```

Public images use the same compression pipeline (AVIF/WebP/JPEG encoding, SSIM auto-tune, saliency preprocessing) with the `high` quality tier defaults. Since they aren't directly imported, they get optimized on-disk in `dist/` under their original paths.

All standard `<img>` props work: `className`, `style`, `onLoad`, `onError`, `loading`, etc.

---

## Options

### Plugin options

```ts
viteImageReact({
  tiers?: Partial<Record<QualityTier, TierConfig>>
  adaptive?: boolean          // default: true
  autoTune?: boolean          // default: true
  preprocess?: boolean        // default: true — sharpen important tiles before encoding
  faceDetection?: boolean     // default: true — boost quality around skin tones
  formats?: OutputFormat[]    // default: ['avif', 'webp', 'jpeg']
  maxFileSize?: number        // default: 52_428_800 (50MB)
  verbose?: boolean           // default: false
  remote?: {
    domains: string[]         // allowed remote image domains (e.g. ['images.unsplash.com'])
    cacheDir?: string         // cache directory (default: node_modules/.cache/vite-image-react)
  }
})
```

### GImage props

```ts
interface GImageProps {
  src: string | ImageMetadata  // import result or metadata object
  alt: string
  priority?: boolean            // eager load + fetchPriority='high'
  sizes?: string                // default: '100vw'
  disableAdaptive?: boolean     // always deliver highest quality
  placeholder?: 'blur' | 'none' // default: 'blur'
  onLoad?: () => void
  onError?: () => void
  // + all standard img props (className, style, loading, etc.)
}
```

---

## Comparison: next/image vs vite-image-react

| Aspect | next/image | vite-image-react |
|---|---|---|
| **Quality strategy** | Uniform (e.g. 75) | Perceptually-weighted — important regions drive quality |
| **Preprocessing** | None | Saliency-guided sharpen — detail preserved where it matters |
| **Face/subject detection** | None | Skin-tone heuristic — quality boost on faces |
| **SSIM auto-tune** | None | Smallest file at SSIM >= 0.97 |
| **Device adaptation** | Responsive srcSet only | Runtime tier switching — CPU/memory/connection-aware |
| **Predictive loading** | Fixed threshold | Velocity-adaptive — faster scroll = bigger preload zone |
| **Format pipeline** | AVIF/WebP/JPEG | Same + skin detection + selectable preprocessor |
| **SVG optimization** | None | SVGO integration with security sanitization |

---

## Requirements

- Node.js >= 18.17
- Vite >= 7
- React >= 19

---

## License

MIT — built with care by [@ezitounioussama](https://github.com/ezitounioussama) · [gotodev.ma](https://gotodev.ma)
