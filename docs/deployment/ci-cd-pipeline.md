# CI/CD Pipeline Documentation

This document describes the continuous integration and deployment pipeline for SpherosegV4.

## Overview

The CI/CD pipeline is implemented using GitHub Actions and provides:
- Automated testing and code quality checks
- Security vulnerability scanning
- Docker image building and registry management
- Automated deployment to production
- Dependency management and updates

## Pipeline Structure

### 1. Pull Request Workflow (`pull-request.yml`)

Triggered on every pull request to ensure code quality before merging.

**Stages:**
1. **Pre-checks**
   - Merge conflict detection
   - Commit message validation (conventional commits)
   - Large file detection (>5MB)

2. **Lint and Format**
   - ESLint validation
   - Prettier formatting check
   - TypeScript compilation

3. **Security Check**
   - GitLeaks secret scanning
   - npm audit for dependencies

4. **Unit Tests**
   - Frontend tests with coverage
   - Backend tests with coverage
   - Coverage reports to Codecov

5. **Build Check**
   - Docker image build validation
   - Multi-service build testing

### 2. Main CI/CD Pipeline (`ci-cd-production.yml`)

Triggered on pushes to main branch and handles production deployments.

**Stages:**
1. **Security Scanning**
   - Trivy vulnerability scanning
   - Snyk security analysis
   - GitLeaks secret detection

2. **Code Quality**
   - ESLint and Prettier checks
   - TypeScript compilation
   - Code coverage analysis

3. **Testing**
   - Frontend unit/integration tests
   - Backend tests with real database
   - ML service Python tests
   - E2E integration tests

4. **Docker Build & Push**
   - Multi-stage builds
   - Image tagging and versioning
   - Push to GitHub Container Registry
   - Container vulnerability scanning

5. **Deployment**
   - Zero-downtime deployment
   - Health check verification
   - Slack notifications

### 3. Security Scanning (`security-scan.yml`)

Comprehensive security checks run daily and on every push.

**Scans:**
- **CodeQL**: Static code analysis for JavaScript, TypeScript, Python
- **Container Security**: Trivy and Snyk for Docker images
- **Secret Detection**: GitLeaks and TruffleHog
- **Dependency Vulnerabilities**: npm audit, pip-audit, Snyk
- **SAST**: Semgrep with OWASP rules
- **License Compliance**: Allowed license verification
- **Infrastructure**: Checkov for Dockerfile and YAML security

### 4. Dependency Updates (`dependency-update.yml`)

Automated weekly dependency updates with security fixes.

**Features:**
- Automatic npm and pip updates
- Security vulnerability fixes
- Pull request creation
- Dependency review on PRs

## Environment Configuration

### Required Secrets

Configure these in GitHub repository settings:

```yaml
# Container Registry
GITHUB_TOKEN: Automatically provided

# Security Scanning
SNYK_TOKEN: Your Snyk authentication token
CODECOV_TOKEN: Codecov upload token

# Production Deployment
PRODUCTION_HOST: Production server hostname
PRODUCTION_USER: SSH username
PRODUCTION_SSH_KEY: Private SSH key for deployment

# Notifications
SLACK_WEBHOOK: Slack webhook URL for notifications
```

### Environment Variables

Set in workflow files or repository settings:

```yaml
NODE_VERSION: '18'
PYTHON_VERSION: '3.9'
DOCKER_REGISTRY: ghcr.io
IMAGE_PREFIX: ${{ github.repository_owner }}/spheroseg
```

## Deployment Process

### Automatic Deployment

Deployments to production are triggered when:
1. Code is pushed to `main` branch
2. All tests and security scans pass
3. Either:
   - Manual workflow dispatch with `deploy: true`
   - Commit message contains `[deploy]`

### Deployment Steps

1. **Pre-deployment**
   - Build and test all services
   - Security vulnerability scanning
   - Integration tests pass

2. **Deployment**
   - SSH to production server
   - Pull latest code
   - Create/verify Docker secrets
   - Pull new Docker images
   - Rolling update with zero downtime
   - Health check verification

3. **Post-deployment**
   - Verify service health
   - Send Slack notification
   - Clean up old Docker images

### Zero-Downtime Deployment

The deployment strategy ensures zero downtime:

```bash
# Scale backend to 2 instances
docker-compose up -d --no-deps --scale backend=2 backend

# Wait for new instance to be healthy
sleep 30

# Update frontend and nginx
docker-compose up -d --no-deps frontend-prod nginx-prod
```

## Security Best Practices

### Secret Management
- Never commit secrets to repository
- Use GitHub Secrets for sensitive data
- Rotate secrets regularly
- Use Docker Secrets in production

### Container Security
- Scan all images before deployment
- Use specific version tags, not `latest`
- Run containers as non-root users
- Keep base images updated

### Dependency Management
- Weekly automated updates
- Security audit on every build
- License compliance checking
- Vulnerability threshold enforcement

## Monitoring and Alerts

### Build Status
- GitHub Actions dashboard
- Branch protection rules
- Required status checks

### Deployment Monitoring
- Health endpoint monitoring
- Slack notifications
- Prometheus/Grafana dashboards

### Security Alerts
- GitHub Security tab
- Snyk dashboard
- Daily security report summary

## Troubleshooting

### Failed Builds

1. **Check GitHub Actions logs**
   ```bash
   gh run list --workflow=ci-cd-production.yml
   gh run view <run-id>
   ```

2. **Common issues**
   - Dependency conflicts
   - Test failures
   - Docker build errors
   - Network timeouts

### Failed Deployments

1. **Verify prerequisites**
   - SSH key is valid
   - Production server is accessible
   - Docker Swarm is initialized
   - Secrets are configured

2. **Manual deployment**
   ```bash
   ssh production-server
   cd /opt/spheroseg
   ./scripts/deploy-production.sh
   ```

### Security Scan Failures

1. **Review scan results**
   - Check GitHub Security tab
   - Review SARIF reports
   - Check Snyk dashboard

2. **Fix vulnerabilities**
   - Update dependencies
   - Patch security issues
   - Update base images

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review dependency updates
   - Check security alerts
   - Monitor build times

2. **Monthly**
   - Review and optimize workflows
   - Update GitHub Actions versions
   - Clean up old artifacts

3. **Quarterly**
   - Rotate secrets
   - Review security policies
   - Update documentation

### Workflow Updates

To update workflows:
1. Create feature branch
2. Test changes in branch
3. Create pull request
4. Merge after review

## Cost Optimization

### GitHub Actions Minutes
- Use concurrency limits
- Cancel redundant workflows
- Cache dependencies
- Optimize build times

### Container Registry
- Automated cleanup of old images
- Keep only recent versions
- Use multi-stage builds

### Best Practices
- Run heavy jobs only when needed
- Use matrix builds efficiently
- Implement proper caching
- Minimize workflow triggers