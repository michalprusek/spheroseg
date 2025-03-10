import React from 'react'
import { LineChart, BarChart } from '@/components/charts'
import { useSystemMetrics } from '@/hooks/useMetrics'
import { Card } from '@/components/ui/card'

export const SystemMetrics: React.FC = () => {
  const { data, isLoading } = useSystemMetrics()

  if (isLoading) return <div>Loading metrics...</div>

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <h3 className="text-lg font-semibold mb-4">CPU Usage</h3>
        <LineChart
          data={data.cpu}
          xAxis="timestamp"
          yAxis="usage"
          color="blue"
        />
      </Card>
      
      <Card>
        <h3 className="text-lg font-semibold mb-4">Memory Usage</h3>
        <LineChart
          data={data.memory}
          xAxis="timestamp"
          yAxis="usage"
          color="green"
        />
      </Card>
      
      <Card>
        <h3 className="text-lg font-semibold mb-4">Processing Queue</h3>
        <BarChart
          data={data.queue}
          xAxis="status"
          yAxis="count"
          color="purple"
        />
      </Card>
      
      <Card>
        <h3 className="text-lg font-semibold mb-4">API Latency</h3>
        <LineChart
          data={data.latency}
          xAxis="timestamp"
          yAxis="ms"
          color="red"
        />
      </Card>
    </div>
  )
}