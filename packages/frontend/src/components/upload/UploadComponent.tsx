import React, { useState } from 'react';
import apiClient from '../../lib/apiClient';

const UploadComponent: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
    }
  };

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError('No file selected');
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiClient.post('/api/upload/single', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Handle successful upload
    } catch (err) {
      setError('An error occurred');
    } finally {
      setUploading(false);
    }
  };

  return <div>{/* Render your form here */}</div>;
};

export default UploadComponent;
