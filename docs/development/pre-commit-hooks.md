# Pre-commit Hooks Documentation

Comprehensive pre-commit hooks system for ensuring code quality in the Spheroseg project.

## Overview

Pre-commit hooks are automated checks that run before each commit to enforce code quality standards. The system blocks commits if issues are found and provides clear error messages for remediation.

**Key Benefits:**
- 🚀 **Performance Optimized**: Smart caching and parallel execution
- 🔧 **Auto-fixing**: Automatically resolves formatting and style issues
- 📊 **Progressive Validation**: Lightweight checks first, comprehensive validation on demand
- 🎯 **Targeted Checks**: Only validates changed files and affected packages
- 🛡️ **Security**: Validates imports, dependencies, and prevents common security issues

## System Components

### 1. Husky Git Hooks

**Files:**
- `.husky/pre-commit` - Runs quality checks before commit with performance monitoring
- `.husky/commit-msg` - Validates commit message format according to conventional commits

**Enhanced Functionality:**
- Smart file targeting with lint-staged integration
- Progressive test execution (critical tests first, full suite optional)
- Parallel execution with resource monitoring
- Automatic cache management and cleanup
- Performance metrics and reporting

### 2. Lint-staged Configuration

**File:** `.lintstagedrc.js`

**Performance-Optimized Rules by File Type:**
```javascript
// TypeScript/JavaScript files with caching
'packages/frontend/src/**/*.{ts,tsx,js,jsx}': [
  'npx eslint --fix --max-warnings 0 --cache --cache-location .cache/eslint',
  'prettier --write --cache --cache-location .cache/prettier',
]

// Backend files with parallel processing
'packages/backend/**/*.{ts,js}': [
  'npx eslint --fix --max-warnings 0 --cache',
  'prettier --write --cache',
]

// Python files (ML package) with formatting and linting
'packages/ml/**/*.py': [
  'python -m black --check --diff',
  'python -m isort --check-only --diff', 
  'python -m flake8 --max-line-length=88 --extend-ignore=E203',
]

// JSON files with validation
'**/*.json': [
  'prettier --write --cache',
  'node -e "JSON.parse(require(\'fs\').readFileSync(process.argv[1], \'utf8\'))"',
]

// Markdown files with linting
'**/*.md': [
  'prettier --write --cache',
  'markdownlint --fix --disable MD013 MD033 MD041',
]
```

### 3. Commitlint Configuration

**File:** `commitlint.config.js`

**Supported Commit Types:**
- `feat` - New feature or functionality
- `fix` - Bug fix or error correction
- `docs` - Documentation changes
- `style` - Code style changes (formatting, semicolons, etc.)
- `refactor` - Code refactoring without feature changes
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `chore` - Maintenance tasks
- `ci` - CI/CD pipeline changes
- `build` - Build system changes
- `security` - Security fixes and improvements
- `deps` - Dependency updates

**Supported Scopes:**
- **Packages**: `frontend`, `backend`, `ml`, `shared`, `types`
- **Infrastructure**: `docs`, `ci`, `deps`, `config`, `docker`
- **Features**: `auth`, `api`, `db`, `ui`, `performance`, `security`
- **Quality**: `test`, `build`, `lint`, `hooks`

**Commit Message Format:**
```
type(scope): Subject starting with capital letter

Optional body describing the change in detail.

Optional footer with references to issues:
- Closes #123
- Refs #456
```

**Examples:**
```bash
# Good examples
feat(frontend): Add responsive navigation component
fix(backend): Resolve authentication token expiration
perf(ml): Optimize image preprocessing pipeline
docs(hooks): Update pre-commit documentation

# Bad examples (will be rejected)
add stuff                    # No type/scope
fix: something               # No scope
FEAT(frontend): component    # Wrong case
```

### 4. Import Validation

**File:** `scripts/validate-imports.js`

**Enhanced Functionality:**
- Enforces package dependency boundaries with performance monitoring
- Validates external dependencies against security-audited whitelist
- Detects forbidden cross-package imports (e.g., frontend → backend)
- Analyzes deep relative import patterns
- Security scanning for unauthorized dependencies
- Performance metrics and caching for faster validation

**Package Dependency Rules:**
```javascript
// Frontend package restrictions
allowedInternal: ['@spheroseg/shared', '@spheroseg/types']
forbiddenPatterns: [
  /\.\.\/\.\.\/backend/,  // No direct backend imports
  /\.\.\/\.\.\/ml/,       // No direct ML imports
]

// Backend package restrictions
allowedInternal: ['@spheroseg/shared', '@spheroseg/types']
forbiddenPatterns: [
  /\.\.\/\.\.\/frontend/, // No direct frontend imports
  /\.\.\/\.\.\/ml/,       // No direct ML imports (use HTTP)
]

// Shared and Types have strictest limitations
// These packages cannot depend on application packages
```

**Security Features:**
- Whitelist-based external dependency validation
- Detection of potentially malicious imports
- Analysis of deep dependency chains
- Reporting of unauthorized package additions

### 5. Pre-commit Framework

**File:** `.pre-commit-config.yaml`

**Built-in Hooks with Performance Optimization:**
- **trailing-whitespace** - Removes trailing whitespace (with markdown support)
- **end-of-file-fixer** - Ensures files end with newline
- **check-yaml** - Validates YAML syntax with unsafe loading for complex configs
- **check-json** - Validates JSON syntax with detailed error reporting
- **check-toml** - Validates TOML configuration files
- **check-merge-conflict** - Detects unresolved merge conflicts
- **check-added-large-files** - Blocks files larger than 1MB
- **detect-private-key** - Security check for accidentally committed keys
- **check-case-conflict** - Prevents case sensitivity issues
- **forbid-new-submodules** - Blocks accidental submodule additions

**Language-Specific Hooks:**
- **Black** (Python) - Code formatting for ML package
- **isort** (Python) - Import sorting with black compatibility
- **flake8** (Python) - Linting with customized rules
- **markdownlint** - Markdown formatting and style checking
- **hadolint** - Dockerfile linting and best practices

## Installation and Setup

### Automatic Installation
Hooks are automatically configured during dependency installation:
```bash
npm install  # Automatically runs husky install and setup
```

### Manual Setup (if needed)
```bash
# Install husky if not already installed
npx husky install

# Test pre-commit hooks system
git add .
git commit -m "test: Test pre-commit hooks system"

# Install Python tools for ML package validation
pip install black isort flake8 pre-commit

# Install additional tools
npm install -g markdownlint-cli
# Install hadolint for Dockerfile linting (platform-specific)
```

### Verification
```bash
# Verify all tools are available
node scripts/validate-imports.js --dry-run
npx eslint --version
npx prettier --version
black --version
flake8 --version
```

## Usage

### Standard Workflow
1. Make your code changes
2. Stage files for commit: `git add .`
3. Commit with proper message: `git commit -m "feat(frontend): Add new component"`
4. Hooks automatically run and:
   - Fix formatting issues where possible
   - Run linting and type checking with caching
   - Execute critical tests for changed packages
   - Validate commit message format
   - Check import boundaries and security

### Progressive Validation Levels

**Level 1: Fast Checks (< 10 seconds)**
- Code formatting (ESLint, Prettier, Black)
- Basic syntax validation
- Commit message format

**Level 2: Comprehensive Checks (< 30 seconds)**
- TypeScript compilation
- Import validation
- Critical test execution

**Level 3: Full Validation (manual trigger)**
- Complete test suite
- Full security audit
- Performance benchmarking

### Example: Successful Commit
```bash
git add src/components/NewComponent.tsx
git commit -m "feat(frontend): Add responsive navigation component"

# Output:
🔍 Running pre-commit checks...
[10:30:15] 📦 Validating 3 changed files in frontend package...
[10:30:16] ✅ ESLint: Fixed 2 formatting issues
[10:30:17] ✅ Prettier: Applied formatting to 3 files
[10:30:18] ✅ TypeScript: Compilation successful
[10:30:19] ✅ Import validation: All boundaries respected
[10:30:21] ✅ Critical tests: 15/15 passed
[10:30:21] ✅ Commit message: Valid conventional format
[10:30:21] ✅ All pre-commit checks passed!
⏱️  Performance: 6.2s total (cached: 2.1s saved)
```

### Example: Failed Commit with Recovery
```bash
git commit -m "add stuff"

# Output:
❌ Pre-commit check failed
💡 Troubleshooting tips:
  • Run 'npm run code:check' to see detailed issues
  • Run 'npm run code:fix' to auto-fix common problems
  • Check specific linting errors above for guidance
  • Use 'git commit --no-verify' only in emergencies
  • See docs/development/pre-commit-hooks.md for detailed help

🔧 Quick fixes available:
  • Fix commit message: git commit --amend -m "feat(scope): Proper description"
  • Auto-fix code issues: npm run code:fix && git add . && git commit
```

## Troubleshooting

### ESLint Errors
```bash
# Automatic fixes
npm run lint:fix

# Check issues without fixing
npm run lint

# Fix specific package
cd packages/frontend && npm run lint:fix

# ESLint with caching for faster runs
npx eslint --cache --cache-location .cache/eslint src/
```

### TypeScript Errors
```bash
# Type checking for specific package
cd packages/frontend && npx tsc --noEmit

# Type checking for all packages
npm run type-check

# Watch mode for development
cd packages/frontend && npx tsc --noEmit --watch

# Clear TypeScript cache if issues persist
rm -rf packages/*/tsconfig.tsbuildinfo
```

### Test Failures
```bash
# Run tests for specific package
cd packages/frontend && npm test
cd packages/backend && npm test

# Run only critical tests (faster)
npm run test -- --testNamePattern="(critical|auth|security)"

# Run tests with coverage
npm run test:coverage

# Debug failing tests
cd packages/backend && npm test -- --verbose --detectOpenHandles
```

### Import Validation Errors
```bash
# Run import validation with detailed output
node scripts/validate-imports.js

# Common solutions:
# 1. Remove forbidden cross-package imports
# 2. Use path aliases instead of deep relative paths
# 3. Add external dependencies to ALLOWED_EXTERNAL_DEPS
# 4. Move shared code to packages/shared

# Example fixes:
# Bad:  import { helper } from '../../backend/utils/helper'
# Good: import { helper } from '@spheroseg/shared/utils/helper'

# Bad:  import { Component } from '../../../components/Component'
# Good: import { Component } from '@/components/Component'
```

### Python/ML Package Issues
```bash
# Format Python code
cd packages/ml && python -m black app/

# Sort imports
cd packages/ml && python -m isort app/

# Lint Python code
cd packages/ml && python -m flake8 app/

# Install missing Python tools
pip install black isort flake8 pre-commit
```

### Performance Issues
```bash
# Clear all caches
rm -rf .cache/ packages/*/.cache/ node_modules/.cache/

# Reduce parallel workers if system is slow
export LINT_STAGED_CONCURRENCY=1

# Skip non-critical checks temporarily
export SKIP=python-tests,hadolint

# Use faster TypeScript checking
cd packages/frontend && npx tsc --noEmit --skipLibCheck
```

### Environment-Specific Issues
```bash
# CI environment optimizations
if [ "${CI:-false}" = "true" ]; then
  export NODE_OPTIONS="--max-old-space-size=4096"
  export LINT_STAGED_CONCURRENCY=2
fi

# Development environment setup
export NODE_ENV=development
export SKIP_GIT_HOOKS=false

# Check tool availability
command -v node || echo "Node.js not found"
command -v python3 || echo "Python3 not found"
command -v black || echo "Black not installed"
```

## Configuration

### Disabling Specific Checks
```javascript
// .lintstagedrc.js - temporary disabling
'packages/frontend/**/*.{ts,tsx,js,jsx}': [
  // 'npx eslint --fix --max-warnings 0',  // disabled
  'prettier --write --cache',
],

// Skip specific hooks via environment variable
export SKIP=eslint,typescript  # Skip ESLint and TypeScript checks
export SKIP_GIT_HOOKS=true      # Skip all hooks (emergency only)
```

### Adding New Rules
```javascript
// .lintstagedrc.js - adding support for new file types
'**/*.{vue,svelte}': [
  'npx eslint --fix --cache',
  'prettier --write --cache',
],

'**/*.{yaml,yml}': [
  'prettier --write --cache',
  'yamllint -d relaxed',  // YAML-specific linting
],

'packages/*/Dockerfile*': [
  'hadolint --ignore DL3008 --ignore DL3009',
],
```

### Updating Allowed Dependencies
```javascript
// scripts/validate-imports.js
const ALLOWED_EXTERNAL_DEPS = new Set([
  // Core libraries
  'react', 'react-dom', 'react-router-dom',
  
  // Add new approved dependencies here
  'your-new-dependency',
  '@your-org/approved-package',
  
  // Security note: All additions must be security reviewed
]);

// Update forbidden patterns for stricter boundaries
const IMPORT_RULES = {
  frontend: {
    allowedInternal: ['@spheroseg/shared', '@spheroseg/types'],
    forbiddenPatterns: [
      /\.\.\/\.\.\/backend/,     // No backend access
      /\.\.\/\.\.\/ml/,          // No ML service access
      /\.\.\//,                   // Discourage relative imports > 1 level
    ],
  },
};
```

## Performance Optimization

### Built-in Optimizations
- **Intelligent Caching**: ESLint, TypeScript, and Prettier use persistent caches
- **Parallel Processing**: Multi-core utilization with smart concurrency limits
- **Incremental Validation**: Only validates changed files and affected dependencies
- **Progressive Testing**: Critical tests first, full suite on demand
- **Smart Skipping**: Automatically skips unnecessary checks based on file types
- **Resource Monitoring**: Adjusts concurrency based on system resources

### Performance Metrics
```bash
# Current benchmarks (with optimizations)
Small commit (1-5 files):     3-8 seconds   (was 15-30s)
Medium commit (5-15 files):    8-20 seconds  (was 30-60s)
Large commit (15+ files):      20-45 seconds (was 1-3 min)
Documentation only:            2-5 seconds   (was 5-10s)
Cached run (no changes):       1-3 seconds   (was 5-15s)

# Performance breakdown by check type:
Code formatting (cached):      0.5-2s
Linting (incremental):         1-5s
TypeScript compilation:        2-8s
Import validation:             0.5-2s
Critical tests:                3-15s
Commit message validation:     0.1s
```

### Advanced Performance Tuning
```bash
# Environment variables for optimization
export LINT_STAGED_CONCURRENCY=auto  # Auto-detect CPU cores
export ESLint_CACHE_LOCATION=.cache/eslint
export PRETTIER_CACHE=.cache/prettier
export TS_NODE_TRANSPILE_ONLY=true   # Faster TypeScript

# CI-specific optimizations
if [ "$CI" = "true" ]; then
  export NODE_OPTIONS="--max-old-space-size=4096"
  export LINT_STAGED_CONCURRENCY=2   # Limit for CI resources
  export SKIP_SLOW_TESTS=true         # Skip time-intensive tests
fi

# Memory-constrained environments
export NODE_OPTIONS="--max-old-space-size=2048"
export LINT_STAGED_CONCURRENCY=1
```

### Cache Management
```bash
# Cache locations
.cache/eslint/           # ESLint cache
.cache/prettier/         # Prettier cache
node_modules/.cache/     # Various tool caches
packages/*/tsconfig.tsbuildinfo  # TypeScript incremental cache

# Cache maintenance scripts
npm run cache:clean      # Clean all caches
npm run cache:status     # Show cache sizes and hit rates
npm run cache:optimize   # Optimize cache for better performance

# Manual cache cleanup
rm -rf .cache/ packages/*/.cache/ packages/*/tsconfig.tsbuildinfo

# Selective cache cleanup
rm -rf .cache/eslint     # Clear only ESLint cache
rm -rf .cache/prettier   # Clear only Prettier cache
find . -name "*.tsbuildinfo" -delete  # Clear TypeScript caches
```

## CI/CD Integration

Pre-commit hooks complement the CI/CD pipeline:
- **Pre-commit**: Fast local validation and auto-fixing
- **CI Pipeline**: Comprehensive testing, building, and deployment checks
- **Redundancy**: CI re-validates all checks for security and reliability
- **Progressive Enhancement**: Local hooks prevent most CI failures

### GitHub Actions Integration
```yaml
# .github/workflows/pre-commit.yml
name: Pre-commit Validation

on: [push, pull_request]

jobs:
  pre-commit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run pre-commit checks
        run: |
          # Run the same checks as local pre-commit
          npm run code:check
          node scripts/validate-imports.js
          
      - name: Upload coverage reports
        if: always()
        uses: codecov/codecov-action@v3
```

## Migration and Upgrades

### Upgrading Husky
```bash
# Update to latest version
npm install --save-dev husky@latest

# Reinstall hooks if needed
npx husky install

# Verify hooks are working
git add . && git commit --dry-run -m "test: Verify hooks"
```

### Adding New Hooks
```bash
# Add post-commit hook for notifications
npx husky add .husky/post-commit "echo 'Commit completed successfully'"

# Add pre-push hook for additional validation
npx husky add .husky/pre-push "npm run test:integration"

# Add prepare-commit-msg for automatic formatting
npx husky add .husky/prepare-commit-msg "node scripts/prepare-commit-msg.js $1"
```

### Version Migration Guide

**From Husky v4 to v8+:**
```bash
# 1. Remove old husky configuration
npm uninstall husky@4
rm -rf .huskyrc* .huskyrc.js .huskyrc.json

# 2. Install new version
npm install --save-dev husky@latest
npx husky install

# 3. Recreate hooks
npx husky add .husky/pre-commit "npx lint-staged"
npx husky add .husky/commit-msg "npx commitlint --edit $1"

# 4. Update package.json
# Remove "husky" field from package.json
# Add "prepare": "husky install" to scripts
```

## Best Practices

### Development Workflow
1. **Commit Frequently**: Smaller commits = faster hooks and easier debugging
2. **Let Hooks Auto-fix**: Allow automatic formatting and style fixes
3. **Quality Commit Messages**: Follow conventional commits format consistently
4. **Test Locally First**: Run `npm run code:check` before committing large changes
5. **Update Documentation**: Keep docs in sync with API and component changes

### Performance Best Practices
1. **Use Caching**: Ensure `.cache/` directories are in `.gitignore`
2. **Stage Incrementally**: Use `git add -p` for selective staging
3. **Clean Caches**: Run `npm run cache:clean` if hooks become slow
4. **Monitor Resources**: Watch for memory usage on large commits

### Team Collaboration
1. **Consistent Setup**: Ensure all team members use the same Node.js version
2. **Document Exceptions**: Create team guidelines for `--no-verify` usage
3. **Share Configuration**: Keep hook configurations in version control
4. **Regular Updates**: Update tools and dependencies regularly

### Security Best Practices
1. **Review Dependencies**: Audit new dependencies before adding to whitelist
2. **Monitor Secrets**: Never commit `.env` files or API keys
3. **Validate Imports**: Enforce package boundaries to prevent code leaks
4. **Regular Audits**: Run `npm audit` and address vulnerabilities promptly

## Monitoring and Metrics

### Logging and Reporting
Hooks provide comprehensive logging:
- **Console Output**: Real-time progress and results during execution
- **Performance Metrics**: Execution time breakdown by check type
- **Error Details**: Specific file locations and fix suggestions
- **CI/CD Logs**: Full validation history in pipeline runs

### Success Metrics
- **Pass Rate**: Percentage of commits that pass on first attempt
- **Auto-fix Rate**: Percentage of issues automatically resolved
- **Performance Trend**: Average execution time over time
- **Coverage Metrics**: Code coverage maintained through testing

### Performance Monitoring
```bash
# Enable detailed performance logging
export DEBUG_HOOKS=true
export PERFORMANCE_LOG=.cache/hooks-performance.log

# View performance breakdown
node scripts/analyze-hook-performance.js

# Sample output:
# Hook Performance Report (last 30 days)
# =====================================
# Average commit time: 8.3s (down from 15.2s)
# Cache hit rate: 73%
# Auto-fix success: 89%
# Most common issues: formatting (45%), imports (23%), tests (32%)
```

### Health Checks
```bash
# Verify hook system health
node scripts/check-hook-health.js

# Outputs:
# ✅ All tools available and working
# ✅ Cache directories accessible
# ✅ Performance within acceptable limits
# ⚠️  Python tools need update (flake8 v4.0.1 -> v6.0.0)
# ❌ hadolint not found (Docker linting disabled)
```

## Support and Troubleshooting

### Common Issues and Solutions

**1. Hooks Don't Execute**
```bash
# Check git configuration
git config core.hooksPath
ls -la .git/hooks/

# Reinstall hooks
npx husky install
chmod +x .husky/pre-commit
```

**2. Permission Errors**
```bash
# Fix hook permissions
chmod +x .husky/*

# Fix cache permissions
sudo chown -R $USER:$USER .cache/
```

**3. Node.js/NPM Issues**
```bash
# Use specific Node version
nvm use 18
npm ci

# Clear npm cache
npm cache clean --force
```

**4. Python Tool Issues**
```bash
# Install in user directory
pip install --user black isort flake8

# Use virtual environment
python -m venv .venv
source .venv/bin/activate
pip install -r packages/ml/requirements-dev.txt
```

### Debug Mode
```bash
# Enable comprehensive debugging
DEBUG=1 VERBOSE=1 git commit -m "debug: Test commit"

# Debug specific tools
DEBUG_ESLINT=1 npx eslint src/
DEBUG_PRETTIER=1 npx prettier --check src/

# Husky debugging
npx husky debug
```

### Emergency Bypass
```bash
# Emergency bypass (use sparingly!)
git commit --no-verify -m "emergency: Fix critical production issue"

# Document the bypass reason
echo "Emergency bypass: $(date) - $(git log -1 --oneline)" >> .emergency-bypasses.log
```

### Getting Help

**Internal Resources:**
- Pre-commit hooks documentation: `docs/development/pre-commit-hooks.md`
- Code quality guidelines: `docs/development/code-quality.md`
- Python tools setup: `docs/development/python-tools-setup.md`

**External Resources:**
- Husky documentation: https://typicode.github.io/husky/
- Conventional commits: https://conventionalcommits.org/
- ESLint rules: https://eslint.org/docs/rules/
- Prettier configuration: https://prettier.io/docs/en/configuration.html

**Team Support:**
- Create GitHub issue for persistent problems
- Check team chat for quick questions
- Review recent commits for configuration changes

---

**Note**: Pre-commit hooks are a critical part of our development workflow. They maintain code quality and prevent issues from reaching production. When in doubt, ask for help rather than bypassing checks.