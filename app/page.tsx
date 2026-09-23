import Link from 'next/link'
import { AgentCard } from '@/components/dashboard/agent-card'

const agents = [
  {
    title: 'Posts',
    description: 'Tell us what to post about. Get 7 trend-inspired posts, approve them, and they auto-publish to Instagram or TikTok on schedule.',
    href: '/posts',
    iconName: 'Zap' as const,
    color: 'bg-violet-500',
    capabilities: ['AI Content Plan', 'Post Queue', 'Google Calendar', 'Auto-publish'],
  },
  {
    title: 'Content Creator',
    description: 'Generate captions, product descriptions, promo emails, GPT Image images, Runway videos, and Canva templates.',
    href: '/agents/creator',
    iconName: 'Sparkles' as const,
    color: 'bg-pink-500',
    capabilities: ['Captions', 'Emails', 'GPT Image', 'Runway Video', 'Canva'],
  },
  {
    title: 'Trend Analyst',
    description: 'Search live trends and get structured insights on styles, content angles, and hashtags.',
    href: '/agents/trend',
    iconName: 'TrendingUp' as const,
    color: 'bg-emerald-500',
    capabilities: ['Live Search', 'Color Trends', 'Forms & Formats', 'Style Directions'],
  },
  {
    title: 'Performance Reviewer',
    description: 'Paste metrics or upload a CSV to get AI-generated insights saved to Google Drive.',
    href: '/agents/performance',
    iconName: 'BarChart3' as const,
    color: 'bg-amber-500',
    capabilities: ['Paste Metrics', 'CSV Upload', 'AI Insights', 'Drive Report'],
  },
]

const HOW_IT_WORKS = [
  {
    step: '1',
    label: 'Plan your content',
    desc: 'Tell us what to post about. AI researches trends and builds 7 ready-to-approve posts with captions.',
    href: '/posts',
    color: 'bg-violet-500',
    arrow: true,
  },
  {
    step: '2',
    label: 'Review & approve posts',
    desc: 'AI generates individual post ideas with captions and image concepts. Tweak anything, then approve.',
    href: '/posts',
    color: 'bg-blue-500',
    arrow: true,
  },
  {
    step: '3',
    label: 'Auto-generate & publish',
    desc: 'At the scheduled time, the image is generated automatically and posted to Instagram or TikTok.',
    href: '/posts',
    color: 'bg-emerald-500',
    arrow: true,
  },
  {
    step: '4',
    label: 'Review performance',
    desc: 'Paste your metrics or connect Instagram. Get AI-powered insights and recommendations.',
    href: '/agents/performance',
    color: 'bg-amber-500',
    arrow: false,
  },
]

export default async function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Marketing HQ</h1>
        <p className="text-sm text-zinc-500 mt-1">Your AI-powered marketing command centre</p>
      </div>

      {/* How it works — automation flow */}
      <div>
        <h2 className="text-base font-semibold text-zinc-700 mb-4">Automation flow</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {HOW_IT_WORKS.map((item) => (
            <Link key={item.step} href={item.href} className="group relative bg-white rounded-2xl border border-zinc-100 p-5 hover:border-zinc-300 hover:shadow-sm transition-all">
              <div className={`w-8 h-8 rounded-xl ${item.color} flex items-center justify-center text-white text-sm font-bold mb-3`}>
                {item.step}
              </div>
              <p className="text-sm font-semibold text-zinc-800 mb-1">{item.label}</p>
              <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
              {item.arrow && (
                <div className="hidden xl:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-zinc-200 rounded-full items-center justify-center text-zinc-400 text-xs z-10">
                  →
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Agents grid */}
      <div>
        <h2 className="text-base font-semibold text-zinc-700 mb-4">Agents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {agents.map((agent, i) => (
            <AgentCard key={agent.href} {...agent} index={i} />
          ))}
        </div>
      </div>

    </div>
  )
}
