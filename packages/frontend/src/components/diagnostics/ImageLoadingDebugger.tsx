import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface ImageLoadingDebuggerProps {
  imageUrl: string;
  projectId?: string;
  imageId?: string;
}

/**
 * A diagnostic component that helps debug image loading issues
 * This component attempts to load an image using different URL formats
 * and reports success or failure for each attempt
 */
const ImageLoadingDebugger: React.FC<ImageLoadingDebuggerProps> = ({ imageUrl, projectId, imageId }) => {
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const testUrls: Record<string, string> = {
      'Original URL': imageUrl,
      'Relative URL': `/uploads/${imageUrl.split('/').pop()}`,
      'Project-specific URL': projectId ? `/uploads/${projectId}/${imageUrl.split('/').pop()}` : '',
      'API URL': `/api/uploads/${imageUrl.split('/').pop()}`,
      'Project-specific API URL': projectId ? `/api/uploads/${projectId}/${imageUrl.split('/').pop()}` : '',
      'Direct Backend URL': `http://localhost:5001/uploads/${imageUrl.split('/').pop()}`,
      'Project-specific Backend URL': projectId
        ? `http://localhost:5001/uploads/${projectId}/${imageUrl.split('/').pop()}`
        : '',
      'Docker Network URL': `http://cellseg-backend:5000/uploads/${imageUrl.split('/').pop()}`,
      'Project-specific Docker Network URL': projectId
        ? `http://cellseg-backend:5000/uploads/${projectId}/${imageUrl.split('/').pop()}`
        : '',
    };

    // Filter out empty URLs
    const filteredUrls = Object.fromEntries(Object.entries(testUrls).filter(([_, url]) => url !== ''));

    const testImage = (url: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      });
    };

    const runTests = async () => {
      const results: Record<string, boolean> = {};

      for (const [name, url] of Object.entries(filteredUrls)) {
        try {
          const success = await testImage(url);
          results[name] = success;
          console.log(`Image loading test for ${name} (${url}): ${success ? 'SUCCESS' : 'FAILED'}`);
        } catch (error) {
          results[name] = false;
          console.error(`Error testing ${name} (${url}):`, error);
        }
      }

      setResults(results);
      setLoading(false);

      // Count successful tests
      const successCount = Object.values(results).filter(Boolean).length;

      if (successCount === 0) {
        toast.error('Image loading diagnostic: All URL formats failed');
      } else {
        toast.success(`Image loading diagnostic: ${successCount}/${Object.keys(results).length} URL formats succeeded`);
      }
    };

    runTests();
  }, [imageUrl, projectId, imageId]);

  if (loading) {
    return <div className="text-sm text-gray-500">Running image loading diagnostics...</div>;
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md mt-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Image Loading Diagnostic Results</h3>
        <button onClick={() => setShowDetails(!showDetails)} className="text-xs text-blue-500 hover:text-blue-700">
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {showDetails && (
        <div className="mt-2 text-xs">
          <p className="mb-2">Testing image loading with different URL formats:</p>
          <ul className="space-y-1">
            {Object.entries(results).map(([name, success]) => (
              <li key={name} className={`flex items-center ${success ? 'text-green-600' : 'text-red-600'}`}>
                <span
                  className={`inline-block w-2 h-2 rounded-full mr-2 ${success ? 'bg-green-600' : 'bg-red-600'}`}
                ></span>
                {name}: {success ? 'Success' : 'Failed'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ImageLoadingDebugger;
