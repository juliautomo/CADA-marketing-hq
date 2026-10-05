import Jimp from 'jimp'

export async function compositeLogoOntoImage(
  imageUrl: string,
  logoUrl: string,
  options: {
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    logoMaxWidthPercent?: number
    paddingPercent?: number
  } = {}
): Promise<string> {
  const {
    position = 'bottom-right',
    logoMaxWidthPercent = 20,
    paddingPercent = 3,
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

  const padX = Math.round(baseWidth * (paddingPercent / 100))
  const padY = Math.round(baseHeight * (paddingPercent / 100))

  let x: number
  let y: number
  switch (position) {
    case 'top-left':    x = padX; y = padY; break
    case 'top-right':   x = baseWidth - logoW - padX; y = padY; break
    case 'bottom-left': x = padX; y = baseHeight - logoH - padY; break
    case 'bottom-right':
    default:            x = baseWidth - logoW - padX; y = baseHeight - logoH - padY
  }

  // Clear a white rectangle behind the logo zone so AI-generated content doesn't bleed through
  const clearW = Math.min(logoW + padX * 4, baseWidth)
  const clearH = Math.min(logoH + padY * 4, baseHeight)
  const clearX = Math.max(0, x - padX)
  const clearY = Math.max(0, y - padY)
  const whiteRect = await new Jimp(clearW, clearH, 0xFFFFFFFF)
  base.composite(whiteRect, clearX, clearY)

  base.composite(logo, Math.max(0, x), Math.max(0, y))

  const buffer = await base.getBufferAsync(Jimp.MIME_PNG)
  return `data:image/png;base64,${buffer.toString('base64')}`
}
