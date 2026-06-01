'use client'

import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { formatRelativeTime } from '@/lib/utils'
import type { AgentRun } from '@/types'

const agentLabels: Record<string, string> = {
  creator: 'Content Creator',
  trend_analyst: 'Trend Analyst',
  campaign_planner: 'Campaign Planner',
  performance_reviewer: 'Performance Reviewer',
}

interface RecentRunsProps {
  runs: AgentRun[]
}

export function RecentRuns({ runs }: RecentRunsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Agent Runs</CardTitle>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-8">No agent runs yet — launch an agent to get started.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {runs.map((run, i) => (
              <motion.div
                key={run.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-zinc-300 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-zinc-800">
                      {agentLabels[run.agent] ?? run.agent}
                    </p>
                    <p className="text-xs text-zinc-400">{formatRelativeTime(run.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {run.duration_ms && (
                    <span className="text-xs text-zinc-400">{(run.duration_ms / 1000).toFixed(1)}s</span>
                  )}
                  <Badge
                    variant={
                      run.status === 'completed'
                        ? 'success'
                        : run.status === 'failed'
                        ? 'error'
                        : run.status === 'running'
                        ? 'info'
                        : 'default'
                    }
                  >
                    {run.status}
                  </Badge>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
