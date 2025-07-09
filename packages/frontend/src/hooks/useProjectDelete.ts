import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import apiClient from '@/lib/apiClient';
import logger from '@/utils/logger';

export const useProjectDelete = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiClient.delete(`/api/projects/${projectId}`);
      return response.data;
    },
    onMutate: () => {
      setIsDeleting(true);
    },
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.removeQueries({ queryKey: ['project', projectId] });
      toast.success(t('project.deleteSuccess'));
      logger.info(`Project ${projectId} deleted successfully`);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || t('project.deleteError');
      toast.error(message);
      logger.error('Failed to delete project:', error);
    },
    onSettled: () => {
      setIsDeleting(false);
    },
  });

  return {
    deleteProject: deleteProjectMutation.mutate,
    isDeleting: isDeleting || deleteProjectMutation.isPending,
  };
};
