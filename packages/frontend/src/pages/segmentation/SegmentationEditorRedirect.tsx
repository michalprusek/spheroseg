import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * This component redirects from the old segmentation editor to the new one
 */
const SegmentationEditorRedirect: React.FC = () => {
  const { projectId, imageId } = useParams<{ projectId: string, imageId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (projectId && imageId) {
      console.log(`[SegmentationEditorRedirect] Redirecting to: /projects/${projectId}/segmentation/${imageId}`);
      navigate(`/projects/${projectId}/segmentation/${imageId}`, { replace: true });
    } else {
      console.error('[SegmentationEditorRedirect] Missing projectId or imageId for redirect');
      navigate('/dashboard', { replace: true });
    }
  }, [projectId, imageId, navigate]);

  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
        <p className="mt-4 text-gray-600">Redirecting to the new segmentation editor...</p>
      </div>
    </div>
  );
};

export default SegmentationEditorRedirect;
