import React from 'react';
import { constructUrl } from '@/lib/urlUtils';
import logger from '@/utils/logger';

interface ImageDebuggerProps {
  image: {
    id: string;
    url?: string;
    name?: string;
    [key: string]: unknown;
  };
}

const ImageDebugger: React.FC<ImageDebuggerProps> = ({ image }) => {
  return (
    <div className="bg-gray-100 p-4 rounded-lg mb-4">
      <h2 className="text-lg font-bold mb-2">Image Debug Info</h2>
      <div className="mb-2">
        <p>
          <strong>ID:</strong> {image.id}
        </p>
        <p>
          <strong>Name:</strong> {image.name}
        </p>
        <p>
          <strong>URL:</strong> {image.url}
        </p>
        <p>
          <strong>Thumbnail URL:</strong> {image.thumbnail_url}
        </p>
      </div>
      <div className="mt-2">
        <h3 className="font-bold">Test Image Loading:</h3>
        <div className="flex space-x-4 mt-2">
          <div>
            <p className="text-sm mb-1">Original URL:</p>
            {image.url && (
              <img
                src={image.url}
                alt="Original"
                className="w-20 h-20 object-cover border border-gray-300"
                onError={(e) => logger.error(`Failed to load original: ${image.url}`)}
              />
            )}
          </div>
          <div>
            <p className="text-sm mb-1">With constructUrl:</p>
            {image.url && (
              <img
                src={constructUrl(image.url)}
                alt="With constructUrl"
                className="w-20 h-20 object-cover border border-gray-300"
                onError={(e) => logger.error(`Failed to load with constructUrl: ${constructUrl(image.url)}`)}
              />
            )}
          </div>
          <div>
            <p className="text-sm mb-1">Thumbnail URL:</p>
            {image.thumbnail_url && (
              <img
                src={image.thumbnail_url}
                alt="Thumbnail"
                className="w-20 h-20 object-cover border border-gray-300"
                onError={(e) => logger.error(`Failed to load thumbnail: ${image.thumbnail_url}`)}
              />
            )}
          </div>
          <div>
            <p className="text-sm mb-1">Thumbnail with constructUrl:</p>
            {image.thumbnail_url && (
              <img
                src={constructUrl(image.thumbnail_url)}
                alt="Thumbnail with constructUrl"
                className="w-20 h-20 object-cover border border-gray-300"
                onError={(e) =>
                  logger.error(`Failed to load thumbnail with constructUrl: ${constructUrl(image.thumbnail_url)}`)
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageDebugger;
