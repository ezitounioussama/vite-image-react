import { optimize } from 'svgo'

export function sanitizeSvg(input: string): string {
  let sanitized = input

  sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, '')
  sanitized = sanitized.replace(/<\s*script[^>]*\/?>/gi, '')

  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')

  sanitized = sanitized.replace(/javascript\s*:/gi, '')
  sanitized = sanitized.replace(/data\s*:\s*text\s*\/\s*html/gi, '')
  sanitized = sanitized.replace(/document\./gi, '')
  sanitized = sanitized.replace(/window\./gi, '')
  sanitized = sanitized.replace(/eval\s*\(/gi, '')
  sanitized = sanitized.replace(/new\s+Function\s*\(/gi, '')
  sanitized = sanitized.replace(/setTimeout\s*\(/gi, '')
  sanitized = sanitized.replace(/setInterval\s*\(/gi, '')

  try {
    const result = optimize(sanitized, {
      multipass: true,
      plugins: [
        {
          name: 'preset-default',
          params: {
            overrides: {
              convertShapeToPath: false,
              cleanupIds: false,
            },
          },
        },
        'removeDimensions',
        'sortAttrs',
        'removeStyleElement',
        {
          name: 'removeAttrs',
          params: { attrs: ['data-*', 'class'] },
        },
      ],
    })
    if (result.data) {
      sanitized = result.data
    }
  } catch (error) {
    console.warn(
      `[vite-image-react] SVGO optimization failed: ${error instanceof Error ? error.message : error}`,
    )
  }

  return sanitized
}

export function validateSvgContent(input: string): boolean {
  const dangerous = [
    'script',
    'onerror',
    'onload',
    'onclick',
    'onmouseover',
    'javascript:',
    'data:text/html',
    'document.cookie',
    '<?',
    '<%',
  ]

  const lower = input.toLowerCase()
  for (const pattern of dangerous) {
    if (lower.includes(pattern)) {
      return false
    }
  }

  return true
}
