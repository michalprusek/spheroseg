# SpherosegV4 Project Structure Analysis

## Complete Directory Tree Structure

```
spheroseg/
├── .claude/
├── .git/
├── .turbo/
├── .vscode/
├── assets/
├── checkpoints/
├── jscpd-report/
│   └── html/
│       ├── js/
│       └── styles/
├── letsencrypt/
│   ├── etc/letsencrypt/
│   ├── var/
│   └── webroot/
├── node_modules/
├── packages/
│   ├── backend/                    # Node.js Backend Service
│   │   ├── ML/
│   │   ├── dist/
│   │   ├── logs/
│   │   ├── node_modules/
│   │   ├── src/
│   │   │   ├── __tests__/
│   │   │   ├── backup/
│   │   │   ├── config/
│   │   │   ├── controllers/
│   │   │   ├── db/
│   │   │   │   ├── migrations/
│   │   │   │   └── monitoring/
│   │   │   ├── lib/
│   │   │   │   ├── metrics/
│   │   │   │   └── monitoring/
│   │   │   ├── middleware/
│   │   │   ├── migrations/
│   │   │   ├── mock-data/
│   │   │   ├── monitoring/
│   │   │   ├── routes/
│   │   │   │   └── v1/
│   │   │   ├── scripts/
│   │   │   ├── security/
│   │   │   │   └── middleware/
│   │   │   ├── services/
│   │   │   ├── test-utils/
│   │   │   ├── tests/
│   │   │   ├── types/
│   │   │   ├── utils/
│   │   │   ├── validators/
│   │   │   └── workers/
│   │   ├── test/
│   │   └── uploads/
│   │
│   ├── frontend/                   # React Frontend Application
│   │   ├── dist/
│   │   ├── node_modules/
│   │   ├── public/
│   │   │   ├── assets/
│   │   │   └── locales/
│   │   ├── shared/
│   │   ├── src/
│   │   │   ├── __mocks__/
│   │   │   ├── __tests__/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   │   ├── a11y/
│   │   │   │   ├── auth/
│   │   │   │   ├── charts/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── diagnostics/
│   │   │   │   ├── header/
│   │   │   │   ├── project/
│   │   │   │   ├── settings/
│   │   │   │   ├── ui/
│   │   │   │   └── upload/
│   │   │   ├── context/
│   │   │   ├── contexts/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   │   ├── monitoring/
│   │   │   │   └── segmentation/
│   │   │   ├── pages/
│   │   │   │   ├── export/
│   │   │   │   └── segmentation/
│   │   │   │       ├── components/
│   │   │   │       │   ├── canvas/
│   │   │   │       │   ├── context-menu/
│   │   │   │       │   ├── context-menus/
│   │   │   │       │   ├── editor/
│   │   │   │       │   ├── keyboard/
│   │   │   │       │   ├── layout/
│   │   │   │       │   ├── project/
│   │   │   │       │   ├── statusbar/
│   │   │   │       │   └── toolbar/
│   │   │   │       ├── contexts/
│   │   │   │       ├── hooks/
│   │   │   │       │   ├── polygonInteraction/
│   │   │   │       │   ├── segmentation/
│   │   │   │       │   └── view/
│   │   │   │       ├── utils/
│   │   │   │       ├── wasm/
│   │   │   │       └── workers/
│   │   │   ├── services/
│   │   │   ├── shared/
│   │   │   ├── styles/
│   │   │   ├── test/
│   │   │   ├── test-utils/
│   │   │   ├── tests/
│   │   │   ├── translations/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   └── types/
│   │
│   ├── frontend-static/            # Static Assets
│   │   ├── assets/
│   │   │   └── illustrations/
│   │   └── public/
│   │
│   ├── ml/                         # Python ML Service
│   │   ├── __pycache__/
│   │   ├── uploads/
│   │   ├── ResUnet.py
│   │   ├── checkpoint_epoch_9.pth.tar
│   │   ├── extract_polygons.py
│   │   ├── ml_service.py
│   │   ├── requirements.txt
│   │   ├── resunet_segmentation.py
│   │   ├── test.py
│   │   ├── test_nested_segmentation.py
│   │   └── test_segmentation.py
│   │
│   ├── shared/                     # Shared Utilities
│   │   ├── dist/
│   │   ├── node_modules/
│   │   └── src/
│   │       ├── monitoring/
│   │       └── utils/
│   │           ├── geometry/
│   │           └── http/
│   │
│   └── types/                      # TypeScript Type Definitions
│       ├── dist/
│       ├── node_modules/
│       └── src/
│
└── ssl/

```

## Main Code Areas

### 1. Frontend (React Application)
- **Location**: `packages/frontend/`
- **Source Files**: 581 TypeScript/JavaScript files
- **Key Technologies**: React, TypeScript, Vite, Material UI
- **Structure**: 
  - Components organized by feature (auth, dashboard, segmentation, etc.)
  - Extensive test coverage with `__tests__` directories
  - Pages follow feature-based organization
  - Dedicated segmentation page with complex canvas interactions

### 2. Backend (Node.js API)
- **Location**: `packages/backend/`
- **Source Files**: 190 TypeScript/JavaScript files
- **Key Technologies**: Node.js, Express, TypeScript, PostgreSQL
- **Structure**:
  - MVC pattern with controllers, services, and routes
  - Database migrations and monitoring
  - Security middleware
  - RESTful API with v1 versioning

### 3. ML Service (Python)
- **Location**: `packages/ml/`
- **Source Files**: 7 Python files
- **Key Technologies**: Python, Flask, PyTorch
- **Structure**:
  - ResUNet model implementation
  - Polygon extraction algorithms
  - Flask API service
  - Pre-trained model checkpoint

### 4. Shared Code
- **Location**: `packages/shared/`
- **Source Files**: 27 TypeScript/JavaScript files
- **Purpose**: Common utilities used across frontend and backend
- **Key Features**: Monitoring utilities, geometry helpers, HTTP utilities

### 5. Type Definitions
- **Location**: `packages/types/`
- **Source Files**: 30 TypeScript files
- **Purpose**: Shared TypeScript type definitions across packages

## Identified Duplicate Patterns

### 1. Multiple "monitoring" directories:
- `packages/backend/src/monitoring/`
- `packages/backend/src/lib/monitoring/`
- `packages/backend/src/db/monitoring/`
- `packages/frontend/src/lib/monitoring/`
- `packages/shared/src/monitoring/`

### 2. Multiple "contexts" directories:
- `packages/frontend/src/context/`
- `packages/frontend/src/contexts/`
- `packages/frontend/src/pages/segmentation/contexts/`

### 3. Multiple "utils" directories:
- Found 13 different utils directories across the codebase
- Present in backend, frontend, shared, and nested within features

### 4. Test organization patterns:
- 38 `__tests__` directories distributed throughout the codebase
- Test files co-located with source code
- Additional test directories in some packages

### 5. Nested component structures:
- Deep nesting in segmentation page components
- Duplicate patterns like `context-menu` and `context-menus`

## Observations

1. **Monorepo Structure**: Well-organized using Turborepo with clear package boundaries
2. **Test Coverage**: Extensive test directories suggesting good test coverage
3. **Feature-based Organization**: Frontend follows feature-based folder structure
4. **Duplication Concerns**: Multiple instances of similar directories (monitoring, utils, contexts)
5. **Deep Nesting**: Some areas have very deep directory nesting (especially segmentation components)
6. **ML Service**: Relatively simple structure compared to frontend/backend complexity