export const dynamic = 'force-dynamic'
import { AgentCard } from '@/components/dashboard/agent-card'
import { StatsCard } from '@/components/dashboard/stats-card'
import { RecentRuns } from '@/components/dashboard/recent-runs'
import { createServiceClient } from '@/lib/supabase'
import type { AgentRun } from '@/types'

const agents = [
  {
    title: 'Content Creator',
    description: 'Generate captions, product descriptions, promo emails, GPT Image images, Runway videos, and Canva templates.',
    href: '/agents/creator',
    iconName: 'Sparkles' as const,
    color: 'bg-violet-500',
    capabilities: ['Captions', 'Emails', 'GPT Image', 'Runway Video', 'Canva'],
  },
  {
    title: 'Trend Analyst',
    description: 'Search live fashion trends and get structured insights on colors, silhouettes, and styles.',
    href: '/agents/trend',
    iconName: 'TrendingUp' as const,
    color: 'bg-emerald-500',
    capabilities: ['Live Search', 'Color Trends', 'Silhouettes', 'Style Directions'],
  },
  {
    title: 'Campaign Planner',
    description: 'Build 4-week campaign calendars with Todoist tasks, Google Calendar events, and Drive briefs.',
    href: '/agents/campaign',
    iconName: 'CalendarDays' as const,
    color: 'bg-blue-500',
    capabilities: ['4-Week Calendar', 'Todoist Tasks', 'Google Calendar', 'Drive Brief'],
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

async function getDashboardData() {
  try {
    const db = createServiceClient()
    const [runsRes, contentRes, campaignsRes, trendsRes] = await Promise.all([
      db.from('cada_agent_runs').select('*').order('created_at', { ascending: false }).limit(8),
      db.from('cada_content_items').select('id', { count: 'exact', head: true }),
      db.from('cada_campaigns').select('id', { count: 'exact', head: true }),
      db.from('cada_trend_reports').select('id', { count: 'exact', head: true }),
    ])
    return {
      runs: (runsRes.data ?? []) as AgentRun[],
      contentCount: contentRes.count ?? 0,
      campaignCount: campaignsRes.count ?? 0,
      trendCount: trendsRes.count ?? 0,
    }
  } catch {
    return { runs: [], contentCount: 0, campaignCount: 0, trendCount: 0 }
  }
}

export default async function DashboardPage() {
  const { runs, contentCount, campaignCount, trendCount } = await getDashboardData()
  const completedRuns = runs.filter((r) => r.status === 'completed').length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">CADA Marketing HQ</h1>
        <p className="text-sm text-zinc-500 mt-1">Your AI-powered marketing command centre</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Content Items" value={contentCount} sub="in library"    iconName="Image"     color="bg-violet-500" index={0} />
        <StatsCard label="Campaigns"     value={campaignCount} sub="planned"      iconName="Layers"    color="bg-blue-500"   index={1} />
        <StatsCard label="Trend Reports" value={trendCount}   sub="generated"     iconName="TrendingUp" color="bg-emerald-500" index={2} />
        <StatsCard label="Agent Runs"    value={completedRuns} sub="completed"    iconName="FileText"  color="bg-amber-500"  index={3} />
      </div>

      {/* Agents grid */}
      <div>
        <h2 className="text-base font-semibold text-zinc-700 mb-4">Individual Agents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {agents.map((agent, i) => (
            <AgentCard key={agent.href} {...agent} index={i} />
          ))}
        </div>
      </div>

      {/* Recent runs */}
      <RecentRuns runs={runs} />
    </div>
  )
}
