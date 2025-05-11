import React, { useState } from 'react';
import { constructUrl } from '@/lib/urlUtils';

interface ProjectThumbnailProps {
  thumbnailUrl: string | null | undefined;
  fallbackSrc?: string;
  altText?: string;
}

const ProjectThumbnail: React.FC<ProjectThumbnailProps> = ({
  thumbnailUrl,
  fallbackSrc = '/placeholder.svg',
  altText = 'Project thumbnail',
}) => {
  // State to track if we're already showing the fallback
  const [isFallback, setIsFallback] = useState(false);
  const [triedDirectUrl, setTriedDirectUrl] = useState(false);

  // Use the thumbnail URL with constructUrl or fallback
  const finalSrc = thumbnailUrl ? constructUrl(thumbnailUrl) : fallbackSrc;

  return (
    <img
      src={isFallback ? fallbackSrc : finalSrc}
      alt={altText}
      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
      onError={(e) => {
        // Prevent infinite error loop
        if (isFallback) {
          // Already showing fallback, stop trying
          e.preventDefault();
          return;
        }

        try {
          // Only try direct URL once, and only if we're not already showing fallback
          if (!triedDirectUrl && thumbnailUrl && !thumbnailUrl.startsWith('blob:')) {
            setTriedDirectUrl(true);

            const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
            const thumbnailPath =
              thumbnailUrl && thumbnailUrl.includes('uploads/')
                ? thumbnailUrl.substring(thumbnailUrl.indexOf('uploads/') + 8)
                : thumbnailUrl || '';

            // Only try backendUrl if thumbnailPath is valid
            if (thumbnailPath && thumbnailPath.length > 0) {
              const directPath = `${backendUrl}/uploads/${thumbnailPath}`;
              e.currentTarget.src = directPath;
              return;
            }
          }
        } catch (err) {
          console.error('Error handling project thumbnail fallback:', err);
        }

        // Set to fallback mode
        setIsFallback(true);
      }}
    />
  );
};

export default ProjectThumbnail;
