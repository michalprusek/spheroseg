import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';

import DashboardHeader from '@/components/DashboardHeader';
import StatsOverview from '@/components/dashboard/StatsOverview';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import DashboardTabs from '@/components/dashboard/DashboardTabs';
import ProjectsTab from '@/components/dashboard/ProjectsTab';
import { useDashboardProjects } from '@/hooks/useDashboardProjects';
import { useProjectDelete } from '@/hooks/useProjectDelete';
import apiClient from '@/lib/apiClient';
import { useCacheManager } from '@/hooks/useUnifiedCache';

const Dashboard = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortField, setSortField] = useState<string>('updated_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { clearByTag } = useCacheManager();

  const { projects, loading, error, fetchProjects } = useDashboardProjects();

  // Force refresh statistics when dashboard is loaded
  useEffect(() => {
    const refreshDashboardData = async () => {
      // Clear all dashboard-related caches
      await clearByTag('dashboard-data');
      await clearByTag('user-statistics');
      await clearByTag('project-data');
      
      // Invalidate React Query caches
      queryClient.invalidateQueries(['userStatistics']);
      queryClient.invalidateQueries(['projects']);

      // Log that we're refreshing data
      console.log('Dashboard loaded - refreshing statistics and projects data');

      // Fetch projects directly with current sort parameters
      fetchProjects(10, 0, sortField, sortDirection);
    };
    
    refreshDashboardData();
  }, [queryClient, clearByTag, fetchProjects, sortField, sortDirection]);

  useEffect(() => {
    // Poslouchej události pro aktualizaci seznamu projektů
    const handleProjectCreated = () => fetchProjects(10, 0, sortField, sortDirection);
    const handleProjectDeleted = () => fetchProjects(10, 0, sortField, sortDirection);

    window.addEventListener('project-created', handleProjectCreated);
    window.addEventListener('project-deleted', handleProjectDeleted);

    return () => {
      window.removeEventListener('project-created', handleProjectCreated);
      window.removeEventListener('project-deleted', handleProjectDeleted);
    };
  }, [fetchProjects, sortField, sortDirection]);

  const handleOpenProject = (id: string) => {
    navigate(`/project/${id}`);
  };

  // We don't actually need this hook instance here since we're using DeleteProjectDialog
  // which already handles the deletion. Keep it only for direct API access if needed.
  const { deleteProject: deleteProjectHook, isDeleting } = useProjectDelete({
    showToasts: true, // Show toast notifications
    navigateToDashboard: false, // Don't navigate away from dashboard
    showConfirmation: false, // Don't show confirmation dialog (we use our own)
    invalidateQueries: true, // Invalidate relevant queries
    onSuccess: () => {
      console.log('Project deleted successfully, refreshing project list');
      // Manually refresh the project list for immediate UI update
      fetchProjects();
    },
  });

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    console.log(`Dashboard: Project deletion handled by DeleteProjectDialog, just refreshing UI`);

    if (!projectId) {
      console.error('Project ID is undefined or empty');
      toast.error('Cannot delete project: missing project identifier');
      return;
    }

    // The actual deletion is handled by DeleteProjectDialog through its own hook instance
    // We just need to refresh the project list when notified of deletion
    fetchProjects(10, 0, sortField, sortDirection);
  };

  const handleSort = (field: 'name' | 'updatedAt' | 'segmentationStatus') => {
    let dbField = sortField;

    // Map field names to database fields
    if (field === 'name') dbField = 'title';
    else if (field === 'updatedAt') dbField = 'updated_at';
    else if (field === 'segmentationStatus') dbField = 'status';

    // Toggle direction if same field
    const newDirection = dbField === sortField ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'desc';

    // Log sorting to debug
    console.log(`Sorting by ${field} (mapped to ${dbField}) in ${newDirection} order`);

    setSortField(dbField);
    setSortDirection(newDirection);

    // Refresh projects with new sort parameters
    fetchProjects(10, 0, dbField, newDirection);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-blue-200/30 dark:bg-blue-400/10 rounded-full filter blur-3xl animate-float" />
          <div
            className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-blue-300/20 dark:bg-blue-500/10 rounded-full filter blur-3xl animate-float"
            style={{ animationDelay: '-2s' }}
          />
          <div
            className="absolute top-2/3 left-1/3 w-40 h-40 bg-blue-400/20 dark:bg-blue-600/10 rounded-full filter blur-3xl animate-float"
            style={{ animationDelay: '-4s' }}
          />
        </div>

        <DashboardHeader />
        <div className="container mx-auto px-4 py-8 relative z-10">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-red-200 dark:border-red-800 text-center shadow-md">
            <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={() => fetchProjects()}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
            >
              {t('common.tryAgain')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Create a sorted copy of projects to display
  const sortedProjects = [...projects].sort((a, b) => {
    // Use the current sort field and direction
    let valueA = a[sortField]?.toString().toLowerCase() || '';
    let valueB = b[sortField]?.toString().toLowerCase() || '';

    // For date fields, convert to Date objects
    if (sortField === 'updated_at' || sortField === 'created_at') {
      valueA = new Date(a[sortField] || 0).getTime();
      valueB = new Date(b[sortField] || 0).getTime();
    }

    // Apply sort direction
    if (sortDirection === 'asc') {
      return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
    } else {
      return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
    }
  });

  // Log the sorted projects for debugging
  console.log('Dashboard rendering sorted projects:', {
    originalProjects: projects,
    sortedProjects,
    sortField,
    sortDirection
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-blue-200/30 dark:bg-blue-400/10 rounded-full filter blur-3xl animate-float" />
        <div
          className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-blue-300/20 dark:bg-blue-500/10 rounded-full filter blur-3xl animate-float"
          style={{ animationDelay: '-2s' }}
        />
        <div
          className="absolute top-2/3 left-1/3 w-40 h-40 bg-blue-400/20 dark:bg-blue-600/10 rounded-full filter blur-3xl animate-float"
          style={{ animationDelay: '-4s' }}
        />
      </div>

      <DashboardHeader />

      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1 dark:text-gray-100">{t('common.dashboard')}</h1>
            <p className="text-gray-500 dark:text-gray-300">{t('dashboard.manageProjects')}</p>
          </div>
        </div>

        <div className="mb-8 animate-fade-in">
          <StatsOverview />
        </div>

        <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <DashboardTabs
            viewMode={viewMode}
            setViewMode={setViewMode}
            onSort={handleSort}
            sortField={sortField === 'title' ? 'name' : sortField === 'updated_at' ? 'updatedAt' : 'name'}
            sortDirection={sortDirection}
          >
            <ProjectsTab
              projects={sortedProjects}
              viewMode={viewMode}
              loading={loading}
              onOpenProject={handleOpenProject}
              onDeleteProject={handleDeleteProject}
            />
          </DashboardTabs>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
