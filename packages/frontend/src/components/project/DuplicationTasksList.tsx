import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/services/api/client';
import { DuplicationTask } from '@/hooks/useDuplicationProgress';
import DuplicationProgress from './DuplicationProgress';
import { toast } from 'sonner';
import logger from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DuplicationTasksListProps {
  refreshInterval?: number; // in milliseconds
  maxTasks?: number;
  showActiveOnly?: boolean;
  showTabs?: boolean;
}

const DuplicationTasksList: React.FC<DuplicationTasksListProps> = ({
  refreshInterval = 10000, // Default to 10 seconds
  maxTasks = 5,
  showActiveOnly = false,
  showTabs = true,
}) => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<DuplicationTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(showActiveOnly ? 'active' : 'all');

  // Fetch tasks from the API
  const fetchTasks = async () => {
    try {
      setError(null);

      const response = await apiClient.get('/api/duplication');
      const data = response.data.tasks || [];

      setTasks(data);
      setLoading(false);
    } catch (err) {
      logger.error('Error fetching duplication tasks:', err);
      setError('Failed to fetch duplication tasks');
      setLoading(false);
    }
  };

  // Cancel a duplication task
  const cancelTask = async (taskId: string) => {
    try {
      await apiClient.delete(`/api/duplication/${taskId}`);
      toast.success(t('projects.duplicationCancelled') || 'Duplication cancelled');

      // Refresh the tasks list
      fetchTasks();
    } catch (err) {
      logger.error('Error cancelling duplication task:', err);
      toast.error(t('projects.duplicationCancellationFailed') || 'Failed to cancel duplication');
    }
  };

  // Navigate to a project
  const viewProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  // Initial fetch and setup interval
  useEffect(() => {
    fetchTasks();

    // Set up a refresh interval
    const interval = setInterval(fetchTasks, refreshInterval);

    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Filter tasks based on the active tab
  const filteredTasks = tasks
    .filter((task) => {
      if (activeTab === 'active') {
        return task.status === 'pending' || task.status === 'processing';
      }
      return true;
    })
    .slice(0, maxTasks);

  // Count active tasks
  const activeTasks = tasks.filter((task) => task.status === 'pending' || task.status === 'processing').length;

  // Show loading state
  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span>{t('common.loading') || 'Loading...'}</span>
      </div>
    );
  }

  // Show error state
  if (error && tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-red-500">
        <p>{error}</p>
        <Button variant="outline" size="sm" onClick={fetchTasks} className="mt-2">
          {t('common.retry') || 'Retry'}
        </Button>
      </div>
    );
  }

  // Show empty state
  if (filteredTasks.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        {activeTab === 'active'
          ? t('projects.noActiveDuplications') || 'No active duplications'
          : t('projects.noDuplications') || 'No duplication tasks found'}
      </div>
    );
  }

  // Render tasks list with optional tabs
  return (
    <div className="w-full">
      {showTabs && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="active">
              {t('projects.activeTasks') || 'Active'} {activeTasks > 0 && `(${activeTasks})`}
            </TabsTrigger>
            <TabsTrigger value="all">
              {t('projects.allTasks') || 'All'} ({tasks.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="space-y-3">
        {filteredTasks.map((task) => (
          <DuplicationProgress
            key={task.id}
            task={task}
            onCancel={() => cancelTask(task.id)}
            onViewProject={viewProject}
          />
        ))}
      </div>
    </div>
  );
};

export default DuplicationTasksList;
