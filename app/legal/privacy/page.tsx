export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-6 space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Privacy Policy</h1>
      <p className="text-sm text-zinc-500">Last updated: June 2026</p>
      <div className="space-y-4 text-sm text-zinc-700 leading-relaxed">
        <p>CADA Marketing HQ is an internal tool operated by CADA (wear_cada). This privacy policy explains how we handle data within this application.</p>
        <h2 className="font-semibold text-zinc-900">Data We Collect</h2>
        <p>This application stores marketing content, product information, and social media access tokens necessary to publish content on behalf of CADA's official accounts. No personal data from third-party users is collected.</p>
        <h2 className="font-semibold text-zinc-900">How We Use Data</h2>
        <p>Data is used solely to generate, manage, and publish marketing content for CADA's Instagram and TikTok accounts. Access tokens are stored securely and used only to authenticate API requests on behalf of CADA.</p>
        <h2 className="font-semibold text-zinc-900">Data Sharing</h2>
        <p>We do not sell or share data with third parties. API integrations (Meta, TikTok, Supabase, Anthropic, OpenAI) are used solely to operate the tool's features.</p>
        <h2 className="font-semibold text-zinc-900">Contact</h2>
        <p>For privacy questions, contact: wearcada@gmail.com</p>
      </div>
    </div>
  )
}
