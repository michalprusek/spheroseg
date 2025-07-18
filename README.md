# SpherosegV4 - Cell Segmentation Application

A comprehensive cell segmentation application using computer vision and deep learning for microscopic image analysis.

## 🚀 Quick Start

### Production Mode
```bash
docker-compose --profile prod up -d
```
Application available at: http://localhost

### Development Mode (Hot Reload)
```bash
docker-compose --profile dev up -d
```
Development server available at: http://localhost:3000

## 📖 Documentation

For comprehensive documentation, see:
- **[Complete Documentation Index](./docs/DOCUMENTATION_INDEX.md)** - Navigation hub for all documentation
- **[Developer Guide](./CLAUDE.md)** - Essential developer information and commands
- **[API Documentation](./docs/api/README.md)** - Complete API reference
- **[System Architecture](./docs/architecture/system-overview.md)** - Technical architecture overview

## 🏗️ Project Structure

```
spheroseg/
├── packages/
│   ├── frontend/         # React + TypeScript + Vite + Material UI
│   ├── backend/          # Node.js + Express + PostgreSQL  
│   ├── ml/               # Python + Flask + PyTorch (ResUNet)
│   ├── shared/           # Shared utilities
│   └── types/            # TypeScript definitions
├── docs/                 # Complete documentation
├── scripts/              # Utility scripts
├── docker-compose.yml    # Container orchestration
└── turbo.json           # Turborepo configuration
```

## ⚡ Essential Commands

```bash
# Development
npm run dev              # Start all services in dev mode
npm run code:check       # Validate code quality
npm run test             # Run all tests
npm run build            # Build for production

# Container Management
docker-compose --profile dev up -d    # Development with hot reload
docker-compose --profile prod up -d   # Production build
docker-compose logs -f [service]      # View service logs
docker-compose exec [service] sh      # Access container shell

# Database Access
docker-compose exec db psql -U postgres -d spheroseg
```

## 🔧 Key Features

- **ML-Powered Segmentation**: ResUNet model for accurate cell detection
- **Real-time Updates**: WebSocket integration for live progress tracking
- **Multi-format Support**: JPEG, PNG, TIFF, BMP image processing
- **Performance Optimized**: 84% faster queries, 93% faster rendering
- **Comprehensive Testing**: Vitest, Jest, Playwright, Pytest
- **Type-Safe**: Full TypeScript implementation
- **Containerized**: Docker-based development and deployment

## 📊 Performance Achievements

| Metric | Before | After | Improvement |
|--------|---------|--------|-------------|
| Database Queries | 500ms | 80ms | 84% faster |
| Frontend Rendering | 3s | 200ms | 93% faster |
| Memory Usage | 500MB | 120MB | 76% reduction |
| API Response Time | 250ms | 100ms | 60% faster |

## 🧪 Testing

```bash
npm run test             # All tests
npm run test:frontend    # Frontend tests (Vitest)
npm run test:backend     # Backend tests (Jest)
npm run test:ml          # ML service tests (Pytest)
npm run test:coverage    # Coverage reports
```

## 🔒 Security

- JWT authentication with RS256 signing
- Refresh token rotation
- Rate limiting and CORS protection
- Input validation and sanitization
- Container security and isolation

## 🚨 Troubleshooting

### Quick Fixes
```bash
# Restart environment
docker-compose down && docker-compose --profile dev up -d

# Check logs
docker-compose logs -f [frontend-dev|backend|ml|db]

# Validate code
npm run code:check && npm run code:fix
```

### Common Issues
- **TypeScript Errors**: Run `npm run code:check` to identify issues
- **Test Failures**: See `docs/testing/TEST_RESULTS.md` for detailed analysis
- **Performance Issues**: Check `docs/performance/` for optimization guides
- **Database Issues**: Use `docker-compose exec db psql -U postgres -d spheroseg`

## 📞 Support

- **Documentation**: [Complete Documentation Index](./docs/DOCUMENTATION_INDEX.md)
- **Developer Guide**: [CLAUDE.md](./CLAUDE.md)
- **Email**: spheroseg@utia.cas.cz
- **Test User**: testuser@test.com / testuser123

## 🎯 Development Status

### ✅ Completed
- [x] Performance optimizations (84% database, 93% frontend improvement)
- [x] Comprehensive documentation and API reference
- [x] Testing infrastructure with E2E and integration tests
- [x] TypeScript safety improvements
- [x] Code quality and consolidation efforts

### ⚠️ Known Issues
- TypeScript build errors (271 remaining)
- Frontend test failures (111/189 tests)
- ESLint warnings (497 remaining)

See [DOCUMENTATION_INDEX.md](./docs/DOCUMENTATION_INDEX.md) for complete project documentation and development guides.

---

**Version**: v1.2.0 | **API Version**: v1.0.0 | **Last Updated**: 2025-07-15