/**
 * File Upload Test Utilities
 */

export const createMockFile = (name = 'test.jpg', size = 1024, type = 'image/jpeg'): File => {
  const blob = new Blob(['test'], { type });
  Object.defineProperty(blob, 'size', { value: size });
  return new File([blob], name, { type });
};

export const createMockFileList = (files: File[]): FileList => {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    ...files.reduce((acc, file, index) => ({
      ...acc,
      [index]: file,
    }), {}),
  };
  
  return fileList as unknown as FileList;
};

export const createMockDropEvent = (files: File[]): Partial<DragEvent> => {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      files: createMockFileList(files),
      items: [] as any,
      types: ['Files'],
      dropEffect: 'copy' as any,
      effectAllowed: 'all' as any,
      clearData: vi.fn(),
      getData: vi.fn(),
      setData: vi.fn(),
      setDragImage: vi.fn(),
    },
  };
};

export const createMockUploadProgress = (loaded: number, total: number) => ({
  loaded,
  total,
  percent: Math.round((loaded / total) * 100),
});

export const mockFileReader = () => {
  const mockReadAsDataURL = vi.fn();
  const mockResult = 'data:image/jpeg;base64,test';
  
  global.FileReader = vi.fn(() => ({
    readAsDataURL: mockReadAsDataURL,
    result: mockResult,
    onload: null,
    onerror: null,
  })) as any;
  
  return { mockReadAsDataURL, mockResult };
};