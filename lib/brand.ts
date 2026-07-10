// CADA Brand Context — injected into all agent system prompts
import { createServiceClient } from '@/lib/supabase'

export interface BrandContext {
  systemPrompt: (agentRole: string) => string
  imagePrompt: string
  referenceImageUrl: string | undefined
  imageQuality: 'low' | 'medium' | 'high'
  driveEnabled: boolean
  driveFolderId: string | undefined
  raw: Record<string, string>
}

export async function getBrandContext(clientId?: string | null): Promise<BrandContext> {
  const db = createServiceClient()
  const KEYS = [
    'brand_name', 'brand_handle', 'brand_description',
    'brand_products_list', 'brand_price_point', 'brand_markets', 'brand_channels',
    'brand_subject_description', 'brand_hashtags', 'brand_ecommerce_platform', 'brand_industry',
    'brand_voice', 'brand_guidelines', 'brand_target_customer',
    'brand_campaign_theme', 'brand_caption_examples',
    'brand_style_prefix', 'brand_negative_prompts', 'brand_color_description',
    'brand_shot_style', 'brand_colors',
    'brand_model_reference_url', 'brand_logo_url',
    'image_quality', 'drive_media_upload_enabled', 'drive_media_folder_id',
  ]
  let query = db.from('cada_settings').select('key, value').in('key', KEYS)
  if (clientId) query = query.eq('client_id', clientId)
  else query = query.is('client_id', null)
  const { data } = await query
  const raw: Record<string, string> = {}
  for (const row of data ?? []) {
    if (row.value && row.value !== 'null') {
      raw[row.key] = typeof row.value === 'string' ? row.value : JSON.stringify(row.value)
    }
  }

  // Build image prompt from Visual Kit fields
  let colorContext = raw.brand_color_description || ''
  if (raw.brand_colors) {
    try {
      const hexes: string[] = JSON.parse(raw.brand_colors)
      if (hexes.length) colorContext = `Color palette: ${hexes.join(', ')}${colorContext ? `. ${colorContext}` : ''}`
    } catch { /* ignore */ }
  }
  const imagePromptParts = [
    raw.brand_style_prefix,
    colorContext,
    raw.brand_shot_style,
  ].filter(Boolean)
  const imagePromptBase = imagePromptParts.join('. ')
  const imagePrompt = raw.brand_negative_prompts
    ? `${imagePromptBase}${imagePromptBase ? '. ' : ''}Avoid: ${raw.brand_negative_prompts}`
    : imagePromptBase

  // Use first library photo as style reference, fall back to manual uploads
  let referenceImageUrl: string | undefined = raw.brand_model_reference_url || undefined
  try {
    const { data: libraryPhotos } = await db.from('cada_brand_photos').select('url').order('created_at', { ascending: false }).limit(1)
    if (libraryPhotos?.[0]?.url) referenceImageUrl = libraryPhotos[0].url
  } catch { /* fall back to manual reference */ }

  return {
    systemPrompt: (agentRole: string) => getBrandSystemPrompt(agentRole, raw),
    imagePrompt,
    referenceImageUrl,
    imageQuality: (raw.image_quality as BrandContext['imageQuality']) || 'medium',
    driveEnabled: raw.drive_media_upload_enabled === 'true',
    driveFolderId: raw.drive_media_folder_id || undefined,
    raw,
  }
}

// Generic fallback — used only when Settings → Brand tab has not been filled in yet.
// These are intentionally neutral so a new client never sees CADA content.
export const BRAND = {
  name: 'Your Brand',
  handle: 'yourbrand',
  tagline: '',
  description: 'A brand committed to quality products and exceptional customer experience.',

  markets: [] as string[],
  channels: ['Instagram', 'TikTok'] as string[],
  pricePoint: '',
  currency: '',

  products: [] as { name: string; price: string; notes: string }[],

  brandColor: '#000000',
  aesthetics: [] as string[],

  voiceAndTone: `
- Warm, friendly, and professional
- Speak directly to the target customer
- Focus on benefits, not just features
- Write in a clear, confident tone`,

  social: {
    instagram: '',
    tiktok: '',
    shopee: '',
  },

  contentGuidelines: `
- Match the brand voice in every piece of content
- Keep captions clear and on-brand
- Always include a call to action`,
}

export interface BrandOverrides {
  brand_voice?: string
  brand_guidelines?: string
  brand_target_customer?: string
  brand_campaign_theme?: string
  brand_caption_examples?: string
}

export function getBrandSystemPrompt(agentRole: string, overrides: BrandOverrides = {}): string {
  const name = (overrides as Record<string, string>).brand_name || BRAND.name
  const handle = (overrides as Record<string, string>).brand_handle || BRAND.handle
  const description = (overrides as Record<string, string>).brand_description || BRAND.description
  const pricePoint = (overrides as Record<string, string>).brand_price_point || BRAND.pricePoint
  const markets = (overrides as Record<string, string>).brand_markets || BRAND.markets.join(', ')
  const channels = (overrides as Record<string, string>).brand_channels || BRAND.channels.join(', ')
  const productsList = (overrides as Record<string, string>).brand_products_list
  const products = productsList
    ? productsList.split('\n').filter(Boolean).map(l => `- ${l.trim()}`).join('\n')
    : BRAND.products.length > 0
      ? BRAND.products.map(p => `- ${p.name} (${p.price}): ${p.notes}`).join('\n')
      : ''

  const voice = overrides.brand_voice || BRAND.voiceAndTone
  const guidelines = overrides.brand_guidelines || BRAND.contentGuidelines
  const targetCustomer = overrides.brand_target_customer || ''
  const campaignTheme = overrides.brand_campaign_theme
  const captionExamples = overrides.brand_caption_examples
  const industry = (overrides as Record<string, string>).brand_industry || ''
  const ecommerce = (overrides as Record<string, string>).brand_ecommerce_platform || ''
  const hashtags = (overrides as Record<string, string>).brand_hashtags || ''
  const subjectDescription = (overrides as Record<string, string>).brand_subject_description || ''

  const handlePart = handle ? ` (${handle})` : ''
  return `You are the ${agentRole} for ${name}${handlePart}.

BRAND OVERVIEW:
${description}
${products ? `\nPRODUCTS (current range):\n${products}` : ''}
${pricePoint ? `\nPRICE POINT: ${pricePoint}` : ''}
${markets ? `\nMARKETS: ${markets}` : ''}
${channels ? `\nSALES CHANNELS: ${channels}` : ''}
${targetCustomer ? `\nTARGET CUSTOMER:\n${targetCustomer}` : ''}

BRAND VOICE & TONE:
${voice}

CONTENT GUIDELINES:
${guidelines}
${campaignTheme ? `\nCURRENT CAMPAIGN THEME:\n${campaignTheme}` : ''}
${captionExamples ? `\nCAPTION STYLE EXAMPLES (match this voice and style):\n${captionExamples}` : ''}

${industry ? `INDUSTRY: ${industry}` : ''}
${ecommerce ? `PRIMARY SALES PLATFORM: ${ecommerce}` : ''}
${subjectDescription ? `SUBJECT / MODEL: ${subjectDescription} (use this in image and video descriptions)` : ''}
${hashtags ? `DEFAULT HASHTAGS: ${hashtags}` : ''}

Always tailor every output specifically for ${name}. Reference real product names, correct price points, and appropriate aesthetics.`
}
