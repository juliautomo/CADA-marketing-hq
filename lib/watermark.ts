import sharp from 'sharp'

/**
 * Fetches an image from a URL and returns it as a Buffer.
 */
async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}

/**
 * Composites a logo PNG onto a generated image.
 * Logo is placed in the bottom-right corner with padding.
 * Returns the composited image as a base64 data URL (PNG).
 */
export async function compositeLogoOntoImage(
  imageUrl: string,
  logoUrl: string,
  options: {
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    logoMaxWidthPercent?: number  // logo width as % of image width (default: 20%)
    padding?: number              // px padding from edge (default: 32)
  } = {}
): Promise<string> {
  const {
    position = 'bottom-right',
    logoMaxWidthPercent = 20,
    padding = 32,
  } = options

  const [imageBuffer, logoBuffer] = await Promise.all([
    fetchBuffer(imageUrl),
    fetchBuffer(logoUrl),
  ])

  const base = sharp(imageBuffer)
  const baseMeta = await base.metadata()
  const baseWidth = baseMeta.width ?? 1024
  const baseHeight = baseMeta.height ?? 1536

  const logoMaxWidth = Math.round(baseWidth * (logoMaxWidthPercent / 100))

  // Resize logo to fit within max width, preserving aspect ratio
  const logoResized = await sharp(logoBuffer)
    .resize({ width: logoMaxWidth, withoutEnlargement: true })
    .png()
    .toBuffer()

  const logoMeta = await sharp(logoResized).metadata()
  const logoW = logoMeta.width ?? logoMaxWidth
  const logoH = logoMeta.height ?? logoMaxWidth

  // Calculate position
  let left: number
  let top: number
  switch (position) {
    case 'top-left':
      left = padding; top = padding; break
    case 'top-right':
      left = baseWidth - logoW - padding; top = padding; break
    case 'bottom-left':
      left = padding; top = baseHeight - logoH - padding; break
    case 'bottom-right':
    default:
      left = baseWidth - logoW - padding; top = baseHeight - logoH - padding
  }

  const composited = await sharp(imageBuffer)
    .composite([{
      input: logoResized,
      left: Math.max(0, left),
      top: Math.max(0, top),
      blend: 'over',
    }])
    .png()
    .toBuffer()

  const base64 = composited.toString('base64')
  return `data:image/png;base64,${base64}`
}
