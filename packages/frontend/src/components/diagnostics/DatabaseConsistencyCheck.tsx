import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/lib/apiClient';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import logger from '@/utils/logger';

interface ConsistencyReport {
  totalImages: number;
  imagesWithoutStatus: number;
  imagesWithInvalidStatus: number;
  orphanedImages: number;
  missingFiles: number;
  fixedIssues: number;
  errors: string[];
}

interface DiagnosticsData {
  consistency: ConsistencyReport;
  statusBreakdown: Record<string, number>;
  recentUploads: {
    total: number;
    withoutStatus: number;
    imageIds: string[];
  };
  timestamp: string;
}

interface DatabaseConsistencyCheckProps {
  projectId: string;
  onRefreshNeeded?: () => void;
}

export const DatabaseConsistencyCheck: React.FC<DatabaseConsistencyCheckProps> = ({ projectId, onRefreshNeeded }) => {
  const { t: _t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [diagnosticsData, setDiagnosticsData] = useState<DiagnosticsData | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/api/diagnostics/project/${projectId}/consistency`);
      setDiagnosticsData(response.data);
      setShowDetails(true);

      // Check if there are issues
      const { consistency } = response.data;
      if (consistency.imagesWithoutStatus > 0 || consistency.imagesWithInvalidStatus > 0) {
        toast.warning('Database consistency issues found. Consider running the fix.');
      } else {
        toast.success('Database consistency check passed!');
      }
    } catch (error) {
      logger.error('Failed to run diagnostics:', error);
      toast.error('Failed to run diagnostics');
    } finally {
      setLoading(false);
    }
  };

  const fixIssues = async (dryRun: boolean = true) => {
    setLoading(true);
    try {
      const response = await apiClient.post(`/api/diagnostics/project/${projectId}/fix-consistency`, {
        dryRun,
      });

      const { report } = response.data;

      if (dryRun) {
        toast.info(`Dry run complete. Would fix ${report.fixedIssues} issues.`);
      } else {
        toast.success(`Fixed ${report.fixedIssues} database consistency issues.`);

        // Refresh diagnostics
        await runDiagnostics();

        // Notify parent to refresh data
        if (onRefreshNeeded) {
          onRefreshNeeded();
        }
      }
    } catch (error) {
      logger.error('Failed to fix consistency issues:', error);
      toast.error('Failed to fix consistency issues');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'queued':
        return 'outline';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Database Consistency Check</span>
          <Button size="sm" onClick={runDiagnostics} disabled={loading}>
            {loading ? 'Checking...' : 'Run Diagnostics'}
          </Button>
        </CardTitle>
      </CardHeader>

      {showDetails && diagnosticsData && (
        <CardContent>
          <div className="space-y-4">
            {/* Consistency Report */}
            <div>
              <h4 className="font-medium mb-2">Consistency Report</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Total Images:</div>
                <div className="font-mono">{diagnosticsData.consistency.totalImages}</div>

                <div>Images Without Status:</div>
                <div className="font-mono">
                  {diagnosticsData.consistency.imagesWithoutStatus}
                  {diagnosticsData.consistency.imagesWithoutStatus > 0 && (
                    <span className="text-orange-500 ml-2">⚠️</span>
                  )}
                </div>

                <div>Invalid Status:</div>
                <div className="font-mono">
                  {diagnosticsData.consistency.imagesWithInvalidStatus}
                  {diagnosticsData.consistency.imagesWithInvalidStatus > 0 && (
                    <span className="text-red-500 ml-2">❌</span>
                  )}
                </div>

                <div>Orphaned Images:</div>
                <div className="font-mono">{diagnosticsData.consistency.orphanedImages}</div>
              </div>
            </div>

            {/* Status Breakdown */}
            <div>
              <h4 className="font-medium mb-2">Status Breakdown</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(diagnosticsData.statusBreakdown).map(([status, count]) => (
                  <Badge key={status} variant={getStatusBadgeVariant(status)}>
                    {status}: {count}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Recent Uploads */}
            <div>
              <h4 className="font-medium mb-2">Recent Uploads (Last 5 minutes)</h4>
              <div className="text-sm">
                <div>Total: {diagnosticsData.recentUploads.total}</div>
                <div>Without Status: {diagnosticsData.recentUploads.withoutStatus}</div>
                {diagnosticsData.recentUploads.withoutStatus > 0 && (
                  <div className="text-orange-500 text-xs mt-1">Some recent uploads may not be visible</div>
                )}
              </div>
            </div>

            {/* Fix Actions */}
            {(diagnosticsData.consistency.imagesWithoutStatus > 0 ||
              diagnosticsData.consistency.imagesWithInvalidStatus > 0) && (
              <div className="border-t pt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => fixIssues(true)} disabled={loading}>
                  Dry Run Fix
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (window.confirm('This will update the database. Are you sure?')) {
                      fixIssues(false);
                    }
                  }}
                  disabled={loading}
                >
                  Apply Fix
                </Button>
              </div>
            )}

            {/* Timestamp */}
            <div className="text-xs text-gray-500">
              Last checked: {new Date(diagnosticsData.timestamp).toLocaleString()}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default DatabaseConsistencyCheck;
