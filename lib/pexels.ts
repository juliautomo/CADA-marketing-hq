// Pexels API — free fashion imagery for trend mood boards
// Get a free key at pexels.com/api (takes 2 min)

export interface PexelsPhoto {
  id: number
  url: string
  photographer: string
  photographer_url: string
  src: {
    medium: string
    large: string
    small: string
  }
  alt: string
}

export async function searchFashionImages(query: string, count = 6): Promise<PexelsPhoto[]> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return []

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=portrait`,
      { headers: { Authorization: apiKey } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.photos ?? []) as PexelsPhoto[]
  } catch {
    return []
  }
}
