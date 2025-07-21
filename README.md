# SpherosegV4 - Cell Segmentation Application

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![Python](https://img.shields.io/badge/python-%3E%3D3.8-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-%3E%3D5.0-blue.svg)

SpherosegV4 is a professional cell segmentation application that uses computer vision and deep learning to identify and analyze cells in microscopic images. The application features a modern web interface, real-time processing, and advanced ML capabilities powered by ResUNet architecture.

## 🚀 Features

- **Advanced Cell Segmentation**: Powered by ResUNet deep learning model
- **Real-time Processing**: WebSocket integration for live status updates
- **Multi-format Support**: Handles JPEG, PNG, TIFF, and BMP images
- **Batch Processing**: Process multiple images simultaneously
- **Export Capabilities**: Export results in CSV, JSON, and ZIP formats
- **User Management**: Secure authentication with JWT tokens
- **Responsive UI**: Modern React interface with Material UI components
- **Internationalization**: Multi-language support (EN, CS)

## 🏗️ Architecture

This is a monorepo managed by Turborepo with microservices architecture:

```
spheroseg/
├── packages/
│   ├── frontend/         # React + TypeScript + Vite
│   ├── backend/          # Node.js + Express + TypeScript
│   ├── ml/               # Python + Flask + PyTorch
│   ├── shared/           # Shared utilities
│   └── types/            # TypeScript type definitions
├── docker-compose.yml    # Container orchestration
└── turbo.json           # Turborepo configuration
```

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **Python** >= 3.8
- **Docker** and **Docker Compose**
- **PostgreSQL** 14+
- **Redis** (for caching)

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/michalprusek/spheroseg.git
cd spheroseg
```

### 2. Install dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies for ML service
cd packages/ml
pip install -r requirements.txt
cd ../..
```

### 3. Environment setup

Create `.env` files in the respective package directories:

**Frontend** (`packages/frontend/.env`):
```env
VITE_API_URL=http://localhost:5001
VITE_API_BASE_URL=/api
VITE_ASSETS_URL=http://localhost:8080
```

**Backend** (`packages/backend/.env`):
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/spheroseg
JWT_SECRET=your-secret-key-here
ALLOWED_ORIGINS=http://localhost:3000,http://localhost
```

**ML Service** (`packages/ml/.env`):
```env
MODEL_PATH=/app/checkpoint_epoch_9.pth.tar
```

### 4. Database setup

```bash
# Initialize database
npm run init:db

# Run migrations
npm run db:migrate

# Create test user (development only)
npm run db:create-test-user
```

## 🚀 Running the Application

### Development Mode

```bash
# Start all services with hot reload
docker-compose --profile dev up -d

# Or run individual services
npm run dev:frontend  # Frontend only
npm run dev:backend   # Backend only
```

### Production Mode

```bash
# Build all packages
npm run build

# Start production services
docker-compose --profile prod up -d
```

### Service URLs

- **Frontend Dev**: http://localhost:3000
- **Frontend Prod**: http://localhost
- **Backend API**: http://localhost:5001
- **ML Service**: http://localhost:5002
- **Database**: localhost:5432
- **Adminer**: http://localhost:8081

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run specific package tests
npm run test:frontend
npm run test:backend
npm run test:ml

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run e2e
```

### Test Structure

- **Frontend**: Vitest + React Testing Library
- **Backend**: Jest + Supertest
- **ML Service**: Pytest
- **E2E**: Playwright

### Writing Tests

Tests are co-located with source files in `__tests__` directories:

```
src/
├── components/
│   ├── Button.tsx
│   └── __tests__/
│       └── Button.test.tsx
```

## 🔧 Development

### Code Quality

```bash
# Check code quality
npm run code:check

# Fix linting and formatting issues
npm run code:fix

# Run linter
npm run lint

# Format code
npm run format
```

### Pre-commit Hooks

The project uses Husky for Git hooks that automatically:
- Lint and format staged files
- Validate imports
- Run tests for changed packages
- Enforce conventional commits

### Commit Convention

Follow the conventional commits format:

```
feat(frontend): add new feature
fix(backend): resolve issue
docs: update README
chore: update dependencies
```

## 📊 Performance Monitoring

The application includes built-in performance monitoring:

- Memory usage tracking
- Database query performance logging
- API endpoint response time tracking
- WebSocket connection monitoring

Access metrics at: `/api/performance/metrics`

## 🔐 Security

- JWT authentication with refresh tokens
- Rate limiting on API endpoints
- CORS protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection

## 🐛 Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000, 5001, 5002, 5432 are available
2. **Database connection**: Check PostgreSQL is running and credentials are correct
3. **ML model loading**: Ensure `checkpoint_epoch_9.pth.tar` is in the correct location
4. **Permission errors**: Run `sudo chown -R $USER:$USER .` in project root

### Logs

```bash
# View service logs
docker-compose logs -f [service-name]

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f ml
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Team

- **Developer**: Michal Prusek

## 📞 Support

For support, please create an issue in the GitHub repository or contact the development team.

---

## 🔍 Additional Documentation

- [API Documentation](./docs/api/)
- [Architecture Overview](./docs/architecture/)
- [Deployment Guide](./docs/deployment/)
- [Development Guide](./docs/development/)

## 🎯 Roadmap

- [ ] Multi-user collaboration features
- [ ] Advanced ML model fine-tuning interface
- [ ] Mobile application support
- [ ] Cloud deployment templates
- [ ] Extended export formats
- [ ] Performance optimizations for large datasets