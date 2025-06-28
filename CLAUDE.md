# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SpherosegV4 is a cell segmentation application that uses computer vision and deep learning to identify and analyze cells in microscopic images. The application consists of:

- **Frontend**: React application with TypeScript, Vite, and Material UI components
- **Backend**: Node.js API server with Express and TypeScript, with PostgreSQL database
- **ML Service**: Python-based machine learning service using PyTorch for cell segmentation
- **Assets Server**: Static file server for images and resources
- **NGINX**: Reverse proxy for routing requests and handling SSL

## Repository Structure

This project uses a monorepo structure with Turborepo:

- `packages/frontend`: React frontend application 
- `packages/backend`: Node.js/Express backend API
- `packages/ml`: Python ML service with PyTorch model for cell segmentation
- `packages/shared`: Shared utilities and code between packages
- `packages/types`: TypeScript type definitions
- `packages/frontend-static`: Static assets for the frontend

## Development Environment

### Running the Application

**Standard Mode:**
```bash
docker-compose up -d
```
The application will be available at http://localhost

**Development Mode with Hot Reload:**
```bash
docker-compose up -d frontend-dev
```
The development server will be available at http://localhost:3000

### Viewing Container Logs

```bash
docker-compose logs -f frontend-dev  # Frontend development logs
docker-compose logs -f backend       # Backend logs
docker-compose logs -f ml            # ML service logs
docker-compose logs -f db            # Database logs
```

### Accessing Containers

```bash
docker-compose exec frontend-dev sh  # Access frontend dev container
docker-compose exec backend sh       # Access backend container
docker-compose exec ml sh            # Access ML service container
docker-compose exec db psql -U postgres -d spheroseg  # Access database
```

## Common Development Commands

### Turborepo Commands

```bash
npm run dev              # Run development servers for all packages
npm run dev:frontend     # Run only frontend development server
npm run dev:backend      # Run only backend development server
npm run build            # Build all packages
npm run preview          # Preview built applications
npm run lint             # Lint all packages
npm run lint:fix         # Fix linting issues in all packages
npm run format           # Format code in all packages
npm run format:check     # Check code formatting in all packages
npm run test             # Run tests for all packages
npm run test:coverage    # Run tests with coverage reports
npm run test:ci          # Run tests in CI mode
npm run test:frontend    # Run only frontend tests
npm run test:backend     # Run only backend tests
npm run test:ml          # Run ML service tests
npm run code:check       # Run all code quality checks
npm run code:fix         # Fix all code quality issues
npm run clean            # Clean build artifacts
npm run duplicates       # Check for duplicate code with jscpd
```

### Database Commands

```bash
npm run init:db          # Initialize the database
npm run init:db:docker   # Initialize the database in Docker
npm run db:migrate       # Run database migrations
npm run db:create-test-user  # Create a test user for development
```

### ML Service Commands

```bash
npm run ml:segmentation  # Run cell segmentation algorithm
npm run ml:extract       # Extract features from segmented cells
```

### End-to-End Testing

```bash
npm run cypress:open     # Open Cypress test runner
npm run cypress:run      # Run Cypress tests in headless mode
npm run e2e              # Run all end-to-end tests
npm run e2e:open         # Open end-to-end test runner
```

## Services Architecture

### Frontend (Port 3000)

- **Core**: React 18 with TypeScript and Vite
- **UI Stack**: Material UI + Radix UI + TailwindCSS
- **State Management**: React Query (@tanstack/react-query)
- **Routing**: React Router DOM
- **Real-time**: Socket.IO client for live updates
- **Forms**: React Hook Form with Zod validation
- **File Upload**: React Dropzone with image cropping support
- **Internationalization**: i18next + react-i18next

### Backend (Port 5001)

- **Runtime**: Node.js 18 with Express and TypeScript
- **Authentication**: JWT tokens with bcrypt password hashing
- **Database**: PostgreSQL with custom SQL migrations
- **File Processing**: Multer for uploads, Sharp for image processing
- **Real-time**: Socket.IO server
- **Security**: Helmet, CORS, rate limiting
- **Logging**: Winston for structured logging
- **Email**: Nodemailer integration

### ML Service (Port 5002)

- **Framework**: Python 3.9 with Flask
- **Deep Learning**: PyTorch with ResUNet architecture
- **Image Processing**: OpenCV, scikit-image, Pillow
- **Model**: Pre-trained checkpoint in `checkpoint_epoch_9.pth.tar`
- **Algorithm**: Custom polygon extraction for cell boundary detection

### Database (Port 5432)

- **Engine**: PostgreSQL 14 with Alpine Linux
- **Schema**: User authentication, project management, image metadata
- **Admin Interface**: Adminer available at http://localhost:8081
- **Access**: Default credentials (postgres/postgres)

### NGINX Reverse Proxy (Ports 80/443)

- **SSL/HTTPS**: Let's Encrypt certificates with auto-renewal
- **Routing**: Frontend, API, assets, and WebSocket proxying
- **Security**: HSTS, XSS protection, content type validation
- **File Upload**: Large file support (200MB max for segmentation)

## Key Environment Variables

Frontend:
- `VITE_API_URL`: Backend API URL
- `VITE_API_BASE_URL`: Base URL for API requests
- `VITE_API_AUTH_PREFIX`: Auth API path prefix
- `VITE_API_USERS_PREFIX`: Users API path prefix
- `VITE_ASSETS_URL`: URL for the assets server

Backend:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT tokens
- `ALLOWED_ORIGINS`: CORS allowed origins
- `MAX_UPLOAD_SIZE`: Maximum file upload size

ML Service:
- `MODEL_PATH`: Path to the ML model checkpoint
- `DEBUG`: Enable debug mode for development

## Authentication

The application uses JWT-based authentication with tokens stored in localStorage. The backend provides `/auth/login` and `/auth/register` endpoints for authentication.

## Database Access

The PostgreSQL database runs in a Docker container and is accessible at localhost:5432 with:
- Database: spheroseg
- Username: postgres
- Password: postgres

You can also use Adminer at http://localhost:8081 for database management.

## Git Workflow

### Development Branch Strategy

This project uses a feature branch workflow with the `dev` branch as the main development branch:

- **`master`**: Production-ready code
- **`dev`**: Main development branch for integration
- **Feature branches**: Created from `dev` for specific features/fixes

### Claude Code Workflow

When working with Claude Code instances:

1. **Development Instance**: Creates feature branches and submits pull requests to `dev`
2. **Review Instance**: Reviews pull requests and merges approved changes into `dev`

### Pull Request Process

**For Development (this Claude instance):**
- Always create pull requests targeting the `dev` branch
- Include clear descriptions of changes
- Ensure all tests pass before requesting review
- Use descriptive commit messages

**For Review (second Claude instance):**
- Review pull requests submitted to `dev`
- Check code quality, test coverage, and functionality
- Merge approved pull requests into `dev`
- Reject or request changes for pull requests that need improvement

### Git Configuration

```bash
# Set pull strategy to merge (already configured)
git config pull.rebase false

# Create and push feature branch
git checkout -b feature/your-feature-name
git push -u origin feature/your-feature-name

# Create pull request to dev branch
gh pr create --base dev --title "Your PR Title" --body "Description"
```

## Development Best Practices

### Testing Requirements

**ALWAYS test every new implementation:**
- After implementing any new feature or fix, run appropriate tests
- Use `npm run test` for unit tests or specific test commands for the affected package
- Verify functionality works as expected before considering the task complete
- Run `npm run code:check` to ensure code quality standards are met

### Error Investigation Process

**When user reports browser console errors:**
1. **First**: Check Docker container logs for detailed error information:
   ```bash
   docker-compose logs -f frontend-dev  # For frontend errors
   docker-compose logs -f backend       # For backend/API errors
   docker-compose logs -f ml            # For ML service errors
   ```
2. **Analyze**: Gather maximum information from both browser console and Docker logs
3. **Plan**: Create a comprehensive fix plan based on all available error information
4. **Implement**: Only then proceed with the actual fix
5. **Test**: Verify the fix resolves the issue completely

### Monorepo Development Patterns

**Package Dependencies:**
- Packages reference each other via `file:../package-name` in package.json
- Shared types centralized in `@spheroseg/types` package
- Common utilities in `@spheroseg/shared` package
- Turborepo handles intelligent build caching and parallelization

**Code Quality:**
- ESLint configuration shared across all packages
- Prettier formatting with consistent rules
- TypeScript strict mode enabled
- Zod schemas for runtime validation

### Container Development Workflow

**Service Communication:**
- Services communicate via Docker service names (not localhost)
- Frontend dev mode proxies API calls through NGINX
- Hot Module Replacement works through NGINX proxy
- WebSocket connections handled by Socket.IO

**File Uploads & Processing:**
- Large file uploads (up to 200MB) supported for segmentation
- Images processed through Sharp in backend
- ML service receives files via shared Docker volumes
- Results returned via REST API with progress updates

## Troubleshooting

If you encounter issues, try restarting the Docker environment:

```bash
docker-compose down && docker-compose up -d
```

For more detailed logs:

```bash
docker-compose logs -f
```