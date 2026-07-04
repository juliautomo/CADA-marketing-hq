export const metadata = {
  title: 'Privacy Policy — CADA Marketing HQ',
}

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', fontFamily: 'system-ui, sans-serif', color: '#1a1a1a', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#666', marginBottom: 40 }}>Last updated: July 4, 2026</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>1. Information We Collect</h2>
      <p>We collect information you provide directly, including account credentials, brand settings, and content you create. We also collect data from connected social media accounts (Instagram, TikTok) solely to enable publishing and analytics features.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>2. How We Use Your Information</h2>
      <p>We use your information to:</p>
      <ul style={{ paddingLeft: 20, marginTop: 8 }}>
        <li>Operate and improve the Service</li>
        <li>Generate AI content on your behalf</li>
        <li>Publish content to connected social media platforms</li>
        <li>Display performance metrics from your social accounts</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>3. TikTok Data</h2>
      <p>When you connect your TikTok account, we receive an access token that allows us to post videos on your behalf. We do not sell or share your TikTok data with any third parties. You can revoke access at any time through TikTok's app settings or our Connections settings page.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>4. Instagram Data</h2>
      <p>When you connect your Instagram account via Meta, we receive an access token to publish content and retrieve post metrics. We use this data solely to operate the Service. You can revoke access at any time through Meta's app settings or our Connections settings page.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>5. Data Storage</h2>
      <p>Your data is stored securely in Supabase (PostgreSQL) hosted in the Asia Pacific region. Generated media files may be stored temporarily in Supabase Storage and optionally in your connected Google Drive folder.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>6. Data Sharing</h2>
      <p>We do not sell your personal data. We share data only with the third-party services necessary to operate the Service (e.g., Anthropic for AI generation, OpenAI, fal.ai, Runway, Fashn.ai). Each provider has their own privacy policy.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>7. Data Retention</h2>
      <p>We retain your data for as long as your account is active. You may request deletion of your data at any time by contacting us.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>8. Your Rights</h2>
      <p>You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at the email below.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>9. Contact</h2>
      <p>For privacy-related questions, contact us at <a href="mailto:julia.utomo@gmail.com" style={{ color: '#4f46e5' }}>julia.utomo@gmail.com</a>.</p>
    </div>
  )
}
