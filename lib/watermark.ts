import Jimp from 'jimp'

export async function compositeLogoOntoImage(
  imageUrl: string,
  logoUrl: string,
  options: {
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    logoMaxWidthPercent?: number
    padding?: number
  } = {}
): Promise<string> {
  const {
    position = 'bottom-right',
    logoMaxWidthPercent = 20,
    padding = 32,
  } = options

  const [base, logo] = await Promise.all([
    Jimp.read(imageUrl),
    Jimp.read(logoUrl),
  ])

  const baseWidth = base.bitmap.width
  const baseHeight = base.bitmap.height

  const logoMaxWidth = Math.round(baseWidth * (logoMaxWidthPercent / 100))
  if (logo.bitmap.width > logoMaxWidth) {
    const scale = logoMaxWidth / logo.bitmap.width
    logo.resize(logoMaxWidth, Math.round(logo.bitmap.height * scale))
  }

  const logoW = logo.bitmap.width
  const logoH = logo.bitmap.height

  let x: number
  let y: number
  switch (position) {
    case 'top-left':    x = padding; y = padding; break
    case 'top-right':   x = baseWidth - logoW - padding; y = padding; break
    case 'bottom-left': x = padding; y = baseHeight - logoH - padding; break
    case 'bottom-right':
    default:            x = baseWidth - logoW - padding; y = baseHeight - logoH - padding
  }

  base.composite(logo, Math.max(0, x), Math.max(0, y))

  const buffer = await base.getBufferAsync(Jimp.MIME_PNG)
  return `data:image/png;base64,${buffer.toString('base64')}`
}
