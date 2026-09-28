import Link from 'next/link'
import { AgentCard } from '@/components/dashboard/agent-card'
import { ProductsNudge } from '@/components/dashboard/products-nudge'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { Zap, TrendingUp, CheckCircle2, BarChart3, ArrowRight, Sparkles } from 'lucide-react'

const agents = [
  {
    title: 'Content Planner',
    description: 'Tell us what to post about. Get trend-inspired posts, approve them, and they auto-publish to Instagram or TikTok on schedule.',
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

const FLOW_STEPS = [
  {
    step: '01',
    label: 'Research trends',
    desc: 'See what\'s trending in your industry — styles, hooks, hashtags, and content angles performing right now.',
    href: '/agents/trend',
    icon: TrendingUp,
    accent: 'from-pink-500 to-rose-500',
    tag: 'Optional',
    agent: { label: 'Trend Analyst', icon: TrendingUp, color: 'bg-emerald-500' },
  },
  {
    step: '02',
    label: 'Plan your content',
    desc: 'Tell us what to post about and pick your period. AI builds trend-inspired posts and sends them to your queue.',
    href: '/posts',
    icon: Zap,
    accent: 'from-violet-500 to-purple-600',
    tag: 'Start here',
    agent: { label: 'Content Planner', icon: Zap, color: 'bg-violet-500' },
  },
  {
    step: '03',
    label: 'Approve & schedule',
    desc: 'Review each post, edit captions or image concepts, then approve. Posts publish automatically at the right time.',
    href: '/posts',
    icon: CheckCircle2,
    accent: 'from-blue-500 to-indigo-500',
    tag: null,
    agent: { label: 'Content Planner', icon: Zap, color: 'bg-violet-500' },
  },
  {
    step: '04',
    label: 'Review performance',
    desc: 'Paste your metrics or upload a CSV. Get AI-powered insights and recommendations for the next round.',
    href: '/agents/performance',
    icon: BarChart3,
    accent: 'from-amber-400 to-orange-500',
    tag: null,
    agent: { label: 'Performance Reviewer', icon: BarChart3, color: 'bg-amber-500' },
  },
]

export default async function DashboardPage() {
  return (
    <div className="space-y-12">

      {/* Hero */}
      <div className="relative bg-zinc-900 rounded-3xl px-8 py-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-zinc-900 to-zinc-900 pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-violet-500/20 text-violet-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-4 border border-violet-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            AI-powered marketing
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Welcome to Marketing HQ</h1>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-xl mb-6">
            Your brand's AI command centre. Plan content campaigns, generate posts, schedule them automatically,
            and track what's working — all in one place. Each AI agent handles a different part of your marketing workflow.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/posts"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
              Start a content plan <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/agents/trend"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors border border-white/10">
              Research trends
            </Link>
          </div>
        </div>
      </div>

      <ProductsNudge />

      {/* How it works */}
      <div>
        <div className="mb-6">
          <h2 className="text-lg font-bold text-zinc-900">How it works</h2>
          <p className="text-sm text-zinc-500 mt-1">Follow these steps to run your full marketing cycle with AI.</p>
        </div>

        <div className="relative">
          {/* connecting line */}
          <div className="hidden xl:block absolute top-10 left-[calc(12.5%+1rem)] right-[calc(12.5%+1rem)] h-px bg-gradient-to-r from-pink-200 via-violet-200 via-blue-200 to-amber-200 z-0" />

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 relative z-10">
            {FLOW_STEPS.map((item) => {
              const Icon = item.icon
              const isClickable = item.step === '02'
              const AgentIcon = item.agent.icon
              const inner = (
                <div className={[
                  'group bg-white rounded-2xl border border-zinc-100 p-5 transition-all h-full flex flex-col',
                  isClickable ? 'hover:border-violet-200 hover:shadow-md cursor-pointer' : 'cursor-default',
                ].join(' ')}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.accent} flex items-center justify-center shadow-sm`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex items-center gap-2">
                      {item.tag && (
                        <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">
                          {item.tag}
                        </span>
                      )}
                      <span className="text-2xl font-black text-zinc-100 leading-none">
                        {item.step}
                      </span>
                    </div>
                  </div>
                  <p className={['text-sm font-semibold text-zinc-800 mb-1.5', isClickable ? 'group-hover:text-violet-700 transition-colors' : ''].join(' ')}>{item.label}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
                  {/* agent badge */}
                  <div className="mt-auto pt-4 flex items-center gap-1.5">
                    <div className={`w-4 h-4 rounded-md ${item.agent.color} flex items-center justify-center flex-shrink-0`}>
                      <AgentIcon className="w-2.5 h-2.5 text-white" />
                    </div>
                    <span className="text-[10px] font-medium text-zinc-400">{item.agent.label}</span>
                  </div>
                </div>
              )
              return isClickable
                ? <Link key={item.step} href={item.href}>{inner}</Link>
                : <div key={item.step}>{inner}</div>
            })}
          </div>
        </div>
      </div>

      <RecentActivity />

      {/* Agents grid */}
      <div>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-400 mb-1.5">Powered by Claude AI</p>
            <h2 className="text-lg font-bold text-zinc-900">AI Agents</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
          {agents.map((agent, i) => (
            <AgentCard key={agent.href} {...agent} index={i} />
          ))}
        </div>
      </div>

    </div>
  )
}
