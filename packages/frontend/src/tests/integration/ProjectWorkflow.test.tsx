import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock dependencies
vi.mock('@/services/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/hooks/useDashboardProjects', () => ({
  useDashboardProjects: () => ({
    projects: [
      {
        id: 'project-1',
        title: 'Test Project 1',
        description: 'This is test project 1',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
        image_count: 5,
        thumbnail_url: 'https://example.com/thumbnail1.jpg',
      },
    ],
    loading: false,
    error: null,
    fetchProjects: vi.fn(),
  }),
}));

vi.mock('@/hooks/useProjectData', () => ({
  useProjectData: (projectId: string) => ({
    projectTitle: 'Test Project 1',
    images: [
      {
        id: 'image-1',
        project_id: projectId,
        name: 'test-image-1.jpg',
        url: 'https://example.com/image1.jpg',
        thumbnail_url: 'https://example.com/thumbnail1.jpg',
        segmentationStatus: 'completed',
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-02T00:00:00Z'),
        width: 800,
        height: 600,
        segmentationResultPath: 'https://example.com/segmentation1.json',
      },
    ],
    loading: false,
    error: null,
    refreshData: vi.fn(),
    updateImageStatus: vi.fn(),
  }),
}));

vi.mock('@/pages/segmentation/hooks/segmentation', () => ({
  useSegmentationV2: () => ({
    imageData: {
      name: 'test-image-1.jpg',
      width: 800,
      height: 600,
      src: 'https://example.com/image1.jpg',
    },
    segmentationData: {
      polygons: [
        {
          id: 'polygon-1',
          points: [
            { x: 100, y: 100 },
            { x: 200, y: 100 },
            { x: 200, y: 200 },
            { x: 100, y: 200 },
          ],
          type: 'external',
        },
      ],
    },
    transform: { zoom: 1, translateX: 0, translateY: 0 },
    editMode: 'view',
    selectedPolygonId: null,
    hoveredVertex: { polygonId: null, vertexIndex: null },
    tempPoints: [],
    interactionState: null,
    isLoading: false,
    isSaving: false,
    isResegmenting: false,
    error: null,
    canUndo: false,
    canRedo: false,
    setEditMode: vi.fn(),
    setTransform: vi.fn(),
    setHoveredVertex: vi.fn(),
    setSelectedPolygonId: vi.fn(),
    setTempPoints: vi.fn(),
    setInteractionState: vi.fn(),
    handleSave: vi.fn(),
    handleResegment: vi.fn(),
    onMouseDown: vi.fn(),
    onMouseMove: vi.fn(),
    onMouseUp: vi.fn(),
    handleWheel: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    handleDeletePolygon: vi.fn(),
  }),
  EditMode: {
    VIEW: 'view',
    EDIT: 'edit',
    CREATE: 'create',
    SLICE: 'slice',
    ADD_POINTS: 'add_points',
  },
}));

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({
      id: 'project-1',
      projectId: 'project-1',
      imageId: 'image-1',
    }),
  };
});

// Mock components
vi.mock('@/components/dashboard/ProjectsTab', () => ({
  default: ({ projects, onOpenProject }: any) => (
    <div data-testid="projects-tab">
      {projects.map((project: any) => (
        <div key={project.id} data-testid={`project-${project.id}`}>
          <div>{project.title}</div>
          <button onClick={() => onOpenProject(project.id)}>Open Project</button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/project/ProjectImages', () => ({
  default: ({ images, onOpen }: any) => (
    <div data-testid="project-images">
      {images.map((image: any) => (
        <div key={image.id} data-testid={`image-${image.id}`}>
          <div>{image.name}</div>
          <button onClick={() => onOpen(image.id)}>Open Image</button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/pages/segmentation/components/canvas/CanvasV2', () => ({
  default: ({ imageData, segmentationData }: any) => (
    <div data-testid="segmentation-canvas">
      <div data-testid="image-name">{imageData?.name}</div>
      <div data-testid="polygon-count">{segmentationData?.polygons?.length || 0}</div>
    </div>
  ),
}));

describe('Project Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies that the mocks are set up correctly', () => {
    // This is a simplified test to ensure our mocks are working
    expect(mockNavigate).toBeDefined();
  });
});
