import React, { useState } from 'react';
// Remove uuid import if not needed
// import { v4 as uuidv4 } from 'uuid';
import { useAuth } from "@/contexts/AuthContext";
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient'; // Import apiClient
import { Project } from '@/types'; // Import Project type
import axios, { AxiosError } from 'axios'; // Import axios
import { useLanguage } from '@/contexts/LanguageContext';

interface UseProjectFormProps {
  onSuccess?: (projectId: string) => void;
  onClose: () => void;
}

export const useProjectForm = ({ onSuccess, onClose }: UseProjectFormProps) => {
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { user } = useAuth();
  const { t } = useLanguage();

  const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      toast.error(t('projects.loginRequired'));
      return null;
    }
    if (!projectName.trim()) {
      toast.error(t('projects.projectNameRequired')); // Keep client-side check
      return null;
    }

    // Data to send to the backend (matches createProjectSchema body)
    const projectData = {
      title: projectName,
      description: projectDescription.trim() ? projectDescription : undefined,
    };

    setIsCreating(true);

    try {
      // Call the backend API to create the project
      const response = await apiClient.post<Project>('/projects', projectData);
      const createdProject = response.data;

      toast.success(t('projects.createSuccess'));
      onClose();
      setProjectName("");
      setProjectDescription("");

      // Use the actual ID from the created project
      if (onSuccess) {
        onSuccess(createdProject.id);
      } else {
         const event = new CustomEvent('project-created', { detail: { projectId: createdProject.id } });
         window.dispatchEvent(event);
      }

      return createdProject; // Return the actual created project

    } catch (error: unknown) {
      console.error("Error creating project:", error);
      let errorMessage = t('projects.createError');
      if (axios.isAxiosError(error) && error.response) {
         errorMessage = error.response.data?.message || errorMessage;
         // Handle potential validation errors (400)
         if (error.response.status === 400 && error.response.data?.errors) {
             const validationErrors = error.response.data.errors
                 .map((err: {path: string, message: string}) => `${err.path}: ${err.message}`)
                 .join('; ');
             errorMessage = `Validation Failed: ${validationErrors}`;
         }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    projectName,
    setProjectName,
    projectDescription,
    setProjectDescription,
    isCreating,
    handleCreateProject
  };
};
