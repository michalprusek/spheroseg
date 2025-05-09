import React from "react";
import { constructUrl } from "@/lib/urlUtils";

interface ProjectThumbnailProps {
  thumbnailUrl: string | null | undefined;
  fallbackSrc?: string;
  altText?: string;
}

const ProjectThumbnail: React.FC<ProjectThumbnailProps> = ({
  thumbnailUrl,
  fallbackSrc = "/placeholder.svg",
  altText = "Project thumbnail"
}) => {
  // Use the thumbnail URL with constructUrl or fallback
  const finalSrc = thumbnailUrl ? constructUrl(thumbnailUrl) : fallbackSrc;

  // Log for debugging
  console.log(`[ProjectThumbnail] Using URL: ${finalSrc} (original: ${thumbnailUrl})`);

  return (
    <img
      src={finalSrc}
      alt={altText}
      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
      onError={(e) => {
        if (e.currentTarget.src !== fallbackSrc) {
            e.currentTarget.src = fallbackSrc;
        }
      }}
    />
  );
};

export default ProjectThumbnail;
