import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Project } from '@/types';
import apiClient from '@/lib/apiClient';

interface ProjectSelectorProps {
  selectedProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
}

interface ProjectsApiResponse {
  projects: Project[];
  total: number;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ selectedProjectId, onProjectChange }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await apiClient.get<ProjectsApiResponse>('/api/projects');
        setProjects(response.data.projects || []);
      } catch (error) {
        console.error('Error fetching projects:', error);
        toast.error('Failed to load projects for selector.');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [user]);

  const handleValueChange = (value: string) => {
    onProjectChange(value === 'all' ? null : value);
  };

  return (
    <Select value={selectedProjectId ?? 'all'} onValueChange={handleValueChange} disabled={loading}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={loading ? 'Loading...' : 'Select Project'} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Projects</SelectItem>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ProjectSelector;
