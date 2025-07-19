import React from 'react';

interface ImageDebugProps {
  image: {
    id: string;
    url?: string;
    name?: string;
    [key: string]: unknown;
  };
}

export const ImageDebug: React.FC<ImageDebugProps> = ({ image }) => {
  return (
    <div className="bg-gray-100 p-4 rounded-lg mb-4">
      <h3 className="font-bold mb-2">Image Debug Info</h3>
      <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(image, null, 2)}</pre>
      <div className="mt-2">
        <p>
          <strong>thumbnail_url:</strong> {image.thumbnail_url || 'N/A'}
        </p>
        <p>
          <strong>url:</strong> {image.url || 'N/A'}
        </p>
        <p>
          <strong>id:</strong> {image.id || 'N/A'}
        </p>
        <p>
          <strong>name:</strong> {image.name || 'N/A'}
        </p>
      </div>
    </div>
  );
};

export default ImageDebug;
