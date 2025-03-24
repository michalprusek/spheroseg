import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Search, 
  ArrowUp, 
  ArrowDown, 
  Clock, 
  Image as ImageIcon, 
  X, 
  CheckCircle, 
  Clock3, 
  AlertCircle, 
  Loader2,
  ArrowUpDown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { segmentImage } from "@/lib/segmentation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Json } from "@/integrations/supabase/types";
import type { SegmentationResult } from "@/lib/segmentation";

interface ProjectImage {
  id: string;
  name: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
  segmentationStatus: 'pending' | 'processing' | 'completed' | 'failed';
  segmentationResult?: SegmentationResult;
}

type SortField = 'name' | 'updatedAt' | 'segmentationStatus';
type SortDirection = 'asc' | 'desc';

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [filteredImages, setFilteredImages] = useState<ProjectImage[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !user) return;

      try {
        const { data: project, error: projectError } = await supabase
          .from("projects")
          .select("*")
          .eq("id", id)
          .single();

        if (projectError) {
          throw projectError;
        }

        if (!project) {
          toast.error("Project not found");
          navigate("/dashboard");
          return;
        }

        setProjectTitle(project.title);

        const { data: imagesData, error: imagesError } = await supabase
          .from("images")
          .select("*")
          .eq("project_id", id)
          .order("updated_at", { ascending: false });

        if (imagesError) {
          throw imagesError;
        }

        const formattedImages: ProjectImage[] = (imagesData || []).map(img => ({
          id: img.id,
          name: img.name,
          url: img.image_url || '/placeholder.svg',
          createdAt: new Date(img.created_at),
          updatedAt: new Date(img.updated_at),
          segmentationStatus: img.segmentation_status as 'pending' | 'processing' | 'completed' | 'failed',
          segmentationResult: img.segmentation_result as unknown as SegmentationResult
        }));

        setImages(formattedImages);
        setFilteredImages(formattedImages);
      } catch (error) {
        console.error("Error fetching project:", error);
        toast.error("Failed to load project data");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id, navigate, user]);

  useEffect(() => {
    let result = [...images];
    
    if (searchTerm) {
      result = result.filter(img => 
        img.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'updatedAt':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        case 'segmentationStatus':
          const statusOrder = { completed: 1, processing: 2, pending: 3, failed: 4 };
          comparison = statusOrder[a.segmentationStatus] - statusOrder[b.segmentationStatus];
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    setFilteredImages(result);
  }, [images, searchTerm, sortField, sortDirection]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      const { error } = await supabase
        .from("images")
        .delete()
        .eq("id", imageId);

      if (error) {
        throw error;
      }

      setImages(prev => prev.filter(img => img.id !== imageId));
      toast.success(t('common.success'), {
        description: t('common.delete') + " " + t('common.success')
      });
    } catch (error: any) {
      console.error("Error deleting image:", error);
      toast.error(t('common.error'), {
        description: t('common.delete') + " " + t('common.error') + ": " + error.message
      });
    }
  };

  const handleOpenSegmentationEditor = (image: ProjectImage) => {
    if (!id) return;
    
    navigate(`/segmentation/${id}/${image.id}`);
    
    if (image.segmentationStatus === 'pending' || image.segmentationStatus === 'failed') {
      updateImageProcessingStatus(image.id);
    }
  };

  const updateImageProcessingStatus = async (imageId: string) => {
    try {
      const { error: updateError } = await supabase
        .from("images")
        .update({ 
          segmentation_status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq("id", imageId);

      if (updateError) {
        console.error("Error updating status:", updateError);
        return;
      }

      setImages(prev => 
        prev.map(img => 
          img.id === imageId 
            ? { ...img, segmentationStatus: 'processing' as const, updatedAt: new Date() } 
            : img
        )
      );
      
      setTimeout(async () => {
        try {
          const image = images.find(img => img.id === imageId);
          if (!image) return;
          
          const result = await segmentImage(image.url);
          
          const { error: resultUpdateError } = await supabase
            .from("images")
            .update({
              segmentation_status: 'completed',
              segmentation_result: result as unknown as Json,
              updated_at: new Date().toISOString()
            })
            .eq("id", imageId);

          if (resultUpdateError) {
            throw resultUpdateError;
          }
        } catch (error) {
          console.error("Segmentation failed:", error);
          
          await supabase
            .from("images")
            .update({
              segmentation_status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq("id", imageId);
        }
      }, 2000);
    } catch (error) {
      console.error("Error updating image status:", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock3 className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center">
            <Button 
              variant="outline" 
              size="sm" 
              className="mr-4"
              onClick={() => navigate("/dashboard")}
            >
              {t('common.back')}
            </Button>
            <div>
              <h1 className="text-xl font-semibold dark:text-white">{projectTitle}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {loading ? t('common.loading') : `${filteredImages.length} ${t('common.images').toLowerCase()}`}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
          <div className="relative w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              className="pl-10 pr-4 w-full md:w-80 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              placeholder={t('dashboard.searchImagesPlaceholder')}
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSort('name')}
              className="flex items-center dark:text-gray-300 dark:border-gray-700"
            >
              {t('common.name')}
              {sortField === 'name' && (
                sortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
              )}
              {sortField !== 'name' && <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSort('updatedAt')}
              className="flex items-center dark:text-gray-300 dark:border-gray-700"
            >
              {t('dashboard.lastChange')}
              {sortField === 'updatedAt' && (
                sortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
              )}
              {sortField !== 'updatedAt' && <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSort('segmentationStatus')}
              className="flex items-center dark:text-gray-300 dark:border-gray-700"
            >
              {t('common.status')}
              {sortField === 'segmentationStatus' && (
                sortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
              )}
              {sortField !== 'segmentationStatus' && <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />}
            </Button>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2 dark:text-white">{t('common.noImages')}</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchTerm ? t('dashboard.searchImagesPlaceholder') : t('dashboard.noImagesDescription')}
            </p>
            <Button
              onClick={() => navigate(`/dashboard`)}
            >
              {t('common.uploadImages')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredImages.map((image) => (
              <Card 
                key={image.id} 
                className="overflow-hidden cursor-pointer group hover:ring-2 hover:ring-blue-200 transition-all duration-200 dark:bg-gray-800 dark:border-gray-700"
                onClick={() => handleOpenSegmentationEditor(image)}
              >
                <div className="relative">
                  <div className="aspect-[16/9]">
                    <img 
                      src={image.url} 
                      alt={image.name} 
                      className="h-full w-full object-cover"
                    />
                  </div>
                  
                  <div className="absolute top-2 left-2 flex items-center space-x-1 bg-white/90 dark:bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full text-xs">
                    {getStatusIcon(image.segmentationStatus)}
                    <span className="capitalize">{t(`dashboard.${image.segmentationStatus}`)}</span>
                  </div>
                  
                  <button
                    className="absolute top-2 right-2 bg-white/90 dark:bg-black/70 p-1 rounded-full text-gray-700 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteImage(image.id);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                  
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-white">
                    <h3 className="text-sm font-medium truncate">{image.name}</h3>
                    <div className="flex items-center text-xs text-white/80 mt-1">
                      <Clock className="h-3 w-3 mr-1" />
                      <span>{formatDistanceToNow(image.updatedAt, { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetail;
