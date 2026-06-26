// CADA Brand Context — injected into all agent system prompts

export const BRAND = {
  name: 'CADA',
  handle: 'wear_cada',
  tagline: 'Modest fashion for the modern Muslim woman',
  description: `CADA (wear_cada) is an Indonesian modest fashion brand selling Muslim-friendly womenswear.
We design elegant, covered clothing that is fashionable, comfortable, and appropriate for Muslim women.
Our aesthetic is sophisticated and understated — think quiet luxury meets modest everyday dressing.`,

  markets: ['Indonesia', 'Singapore'],
  channels: ['Shopee', 'TikTok Shop', 'Tokopedia', 'Instagram', 'TikTok'],
  pricePoint: 'affordable-mid (Rp 280,000 – Rp 400,000 / SGD 25–35)',
  currency: 'IDR (Rp) for Indonesia, SGD for Singapore',

  products: [
    { name: 'Pleated Linen Pants', price: 'Rp 350,000', notes: 'Wide-leg, high-waist, navy' },
    { name: 'Butter Yellow Ruffle Sleeve Button-Up Shirt', price: 'Rp 280,000', notes: 'Loose fit, feminine, modest' },
    { name: 'High Waisted Denim Maxi Skirt', price: 'Rp 385,000', notes: 'Full coverage, A-line, dark wash' },
  ],

  brandColor: '#6B0F2B', // Deep burgundy/maroon
  aesthetics: ['quiet luxury', 'modest chic', 'clean minimal', 'sophisticated everyday'],

  voiceAndTone: `
- Warm, elegant, and aspirational — never preachy or overly religious
- Indonesian and Singaporean Muslim women aged 20–35
- Speaks to women who want to look polished and on-trend while being covered
- Mix of English and occasional Bahasa Indonesia phrases is appropriate (e.g. "Yuk, tampil cantik!")
- Never use words: revealing, sexy, bare, skin-baring
- Always use: modest, covered, elegant, effortless, feminine, everyday luxury`,

  social: {
    instagram: 'https://www.instagram.com/wear_cada',
    tiktok: 'https://www.tiktok.com/@wear_cada',
    shopee: 'https://shopee.co.id/wearcada',
  },

  contentGuidelines: `
- All clothing must be fully covered (wrists, ankles, neckline)
- Models should wear hijab in any visual references
- Captions can mix English + Bahasa Indonesia
- Hashtags: #CADA #wearcada #modestfashion #hijabfashion #ootdmodest #fashionmuslim #bajumuslim
- Platform tone: Instagram = elegant & editorial; TikTok = relatable & conversational
- Price should always be shown in Rp for Indonesian content`,
}

export interface BrandOverrides {
  brand_voice?: string
  brand_guidelines?: string
  brand_target_customer?: string
  brand_campaign_theme?: string
  brand_caption_examples?: string
}

export function getBrandSystemPrompt(agentRole: string, overrides: BrandOverrides = {}): string {
  const voice = overrides.brand_voice || BRAND.voiceAndTone
  const guidelines = overrides.brand_guidelines || BRAND.contentGuidelines
  const targetCustomer = overrides.brand_target_customer || 'Indonesian and Singaporean Muslim women aged 20–35'
  const campaignTheme = overrides.brand_campaign_theme
  const captionExamples = overrides.brand_caption_examples

  return `You are the ${agentRole} for CADA (wear_cada), an Indonesian modest fashion brand.

BRAND OVERVIEW:
${BRAND.description}

PRODUCTS (current range):
${BRAND.products.map(p => `- ${p.name} (${p.price}): ${p.notes}`).join('\n')}

PRICE POINT: ${BRAND.pricePoint}
MARKETS: ${BRAND.markets.join(', ')}
SALES CHANNELS: ${BRAND.channels.join(', ')}

TARGET CUSTOMER:
${targetCustomer}

BRAND VOICE & TONE:
${voice}

CONTENT GUIDELINES:
${guidelines}
${campaignTheme ? `\nCURRENT CAMPAIGN THEME:\n${campaignTheme}` : ''}
${captionExamples ? `\nCAPTION STYLE EXAMPLES (match this voice and style):\n${captionExamples}` : ''}

Always tailor every output specifically for CADA. Reference real product names, correct price points, and appropriate modest fashion aesthetics.`
}
