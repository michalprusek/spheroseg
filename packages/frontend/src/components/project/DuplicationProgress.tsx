import React from 'react';
import { DuplicationTask } from '@/hooks/useDuplicationProgress';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

interface DuplicationProgressProps {
  task: DuplicationTask;
  onCancel?: () => void;
  onViewProject?: (projectId: string) => void;
}

const DuplicationProgress: React.FC<DuplicationProgressProps> = ({ 
  task, 
  onCancel, 
  onViewProject 
}) => {
  const { t } = useLanguage();

  // Format the created time as "x minutes/hours ago"
  const timeAgo = task.created_at ? 
    formatDistanceToNow(new Date(task.created_at), { addSuffix: true }) : 
    '';

  // Determine status icon and color
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'cancelled':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    }
  };

  // Get status text with translation
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return t('projects.duplicationPending') || 'Pending';
      case 'processing':
        return t('projects.duplicationProcessing') || 'Processing';
      case 'completed':
        return t('projects.duplicationCompleted') || 'Completed';
      case 'failed':
        return t('projects.duplicationFailed') || 'Failed';
      case 'cancelled':
        return t('projects.duplicationCancelled') || 'Cancelled';
      default:
        return status;
    }
  };

  // Get status color for styling
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-blue-500';
      case 'processing':
        return 'text-blue-500';
      case 'completed':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      case 'cancelled':
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };

  // Generate title based on available information
  const getTitle = () => {
    const fromTitle = task.original_project_title || t('projects.unknownProject') || 'Unknown Project';
    
    if (task.status === 'completed' && task.new_project_title) {
      return `${fromTitle} → ${task.new_project_title}`;
    }
    
    return `${t('projects.duplicating') || 'Duplicating'}: ${fromTitle}`;
  };

  // Determine if we can show the View Project button
  const canViewProject = task.status === 'completed' && task.new_project_id;

  // Determine if we can show the Cancel button
  const canCancel = (task.status === 'pending' || task.status === 'processing') && onCancel;

  return (
    <Card className="w-full shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-medium truncate" title={getTitle()}>
            {getTitle()}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {getStatusIcon(task.status)}
            <span className={`text-sm font-medium ${getStatusColor(task.status)}`}>
              {getStatusText(task.status)}
            </span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        <div className="space-y-2">
          {/* Progress bar */}
          <div className="w-full">
            <Progress 
              value={task.progress} 
              className={
                task.status === 'completed' ? 'bg-green-100' : 
                task.status === 'failed' ? 'bg-red-100' : 
                task.status === 'cancelled' ? 'bg-yellow-100' : 
                'bg-gray-100'
              }
            />
          </div>
          
          {/* Progress details */}
          <div className="flex justify-between text-xs text-gray-500">
            <span>
              {task.processed_items} / {task.total_items} {t('projects.items') || 'items'}
            </span>
            <span>{task.progress}%</span>
          </div>
          
          {/* Error message if any */}
          {task.error_message && (
            <div className="mt-2 text-xs text-red-500">
              {task.error_message}
            </div>
          )}
          
          {/* Time info */}
          <div className="text-xs text-gray-500 mt-1">
            {timeAgo}
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="pt-2 flex justify-end gap-2">
        {canCancel && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onCancel}
          >
            {t('common.cancel') || 'Cancel'}
          </Button>
        )}
        
        {canViewProject && (
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => onViewProject?.(task.new_project_id!)}
          >
            {t('projects.viewProject') || 'View Project'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default DuplicationProgress;