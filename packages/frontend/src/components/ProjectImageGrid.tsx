import React from 'react';
import { ProjectImage } from '@/types';
import { Box, Grid, Typography, Paper, Skeleton } from '@mui/material';
import { styled } from '@mui/material/styles';

interface ProjectImageGridProps {
  images: ProjectImage[];
  loading: boolean;
  onImageClick?: (image: ProjectImage) => void;
}

const ImageContainer = styled(Paper)(({ theme }) => ({
  position: 'relative',
  overflow: 'hidden',
  borderRadius: theme.shape.borderRadius,
  cursor: 'pointer',
  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[4],
  },
}));

const ImageOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  padding: theme.spacing(1),
  background: 'rgba(0, 0, 0, 0.6)',
  color: theme.palette.common.white,
  transition: 'opacity 0.2s ease-in-out',
  opacity: 0,
  '.MuiPaper-root:hover &': {
    opacity: 1,
  },
}));

const ImageItem = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
});

const ProjectImageGrid: React.FC<ProjectImageGridProps> = ({ images, loading, onImageClick }) => {
  // Store references to blob URLs to revoke them when component unmounts
  const [blobUrls, setBlobUrls] = React.useState<string[]>([]);

  // Add blob URL to the tracking array
  const trackBlobUrl = React.useCallback((url: string) => {
    if (url && url.startsWith('blob:')) {
      setBlobUrls((prev) => [...prev, url]);
    }
  }, []);

  // Clean up blob URLs when component unmounts
  React.useEffect(() => {
    return () => {
      blobUrls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          console.warn('Error revoking blob URL:', url, e);
        }
      });
    };
  }, [blobUrls]);

  // Handle image loading and track blob URLs
  React.useEffect(() => {
    images.forEach((image) => {
      if (image._tempUrl && image._tempUrl.startsWith('blob:')) {
        trackBlobUrl(image._tempUrl);
      }
    });
  }, [images, trackBlobUrl]);

  const handleImageClick = (image: ProjectImage) => {
    if (onImageClick) {
      onImageClick(image);
    }
  };

  // Show skeletons while loading
  if (loading) {
    return (
      <Grid container spacing={2}>
        {Array.from(new Array(6)).map((_, index) => (
          <Grid key={`skeleton-${index}`} sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4' } }}>
            <Skeleton variant="rectangular" width="100%" height={200} sx={{ borderRadius: 1 }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  // Show message if no images
  if (images.length === 0) {
    return null; // Return null to let the parent component handle the empty state
  }

  // Render the image grid
  return (
    <Grid container spacing={2}>
      {images.map((image) => (
        <Grid key={image.id} sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4' } }}>
          <ImageContainer elevation={2} onClick={() => handleImageClick(image)}>
            <Box
              sx={{
                position: 'relative',
                paddingTop: '75%' /* 4:3 aspect ratio */,
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                }}
              >
                <ImageItem
                  src={image._tempUrl || image.thumbnail_url || image.url}
                  alt={image.name}
                  loading="lazy"
                  onError={(e) => {
                    // Use structured error handling for image loading errors
                    import('@/utils/errorHandling').then(({ handleError, ErrorType, ErrorSeverity }) => {
                      handleError(new Error(`Failed to load image: ${image.name}`), {
                        context: 'Image display',
                        errorInfo: {
                          type: ErrorType.CLIENT,
                          severity: ErrorSeverity.WARNING,
                          message: `Failed to load image: ${image.name}`,
                          details: {
                            imageId: image.id,
                            imageName: image.name,
                            hasUrl: !!image.url,
                            hasThumbnail: !!image.thumbnail_url,
                            hasTempUrl: !!image._tempUrl,
                          },
                        },
                        showToast: false, // Don't show toast for image loading errors
                      });
                    });

                    // For data URLs that might be corrupted, try to use the original URL
                    if ((image._tempUrl || image.thumbnail_url || image.url).startsWith('data:') && image._tempUrl) {
                      console.log('Trying fallback to temp URL for', image.name);
                      (e.target as HTMLImageElement).src = image._tempUrl;
                    } else {
                      // Use placeholder for failed images
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }
                  }}
                />
              </Box>
            </Box>
            <ImageOverlay>
              <Typography variant="subtitle2" noWrap>
                {image.name}
              </Typography>
              <Typography variant="caption" display="block">
                Status: {image.segmentationStatus || 'Not processed'}
              </Typography>
            </ImageOverlay>
          </ImageContainer>
        </Grid>
      ))}
    </Grid>
  );
};

export default ProjectImageGrid;
