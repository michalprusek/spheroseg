# Python Development Tools Setup

This guide covers the installation and configuration of Python development tools required for the ML package in Spheroseg.

## Required Python Tools

The pre-commit hooks system uses several Python tools for code quality:

- **black**: Code formatter for Python
- **isort**: Import sorter for Python
- **flake8**: Linter for Python
- **pre-commit**: Framework for managing git hooks

## Installation Options

### Option 1: Using pip (Recommended)

```bash
# Install Python tools globally
pip install black isort flake8 pre-commit

# Or install in user directory
pip install --user black isort flake8 pre-commit
```

### Option 2: Using conda/mamba

```bash
# Install with conda
conda install -c conda-forge black isort flake8 pre-commit

# Or with mamba (faster)
mamba install -c conda-forge black isort flake8 pre-commit
```

### Option 3: Using pipx (Isolated installation)

```bash
# Install pipx first
pip install --user pipx

# Install tools in isolated environments
pipx install black
pipx install isort
pipx install flake8
pipx install pre-commit
```

### Option 4: Using the ML package virtual environment

```bash
# Create virtual environment for ML package
cd packages/ml
python -m venv venv

# Activate virtual environment
# On Linux/macOS:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install development dependencies
pip install -r requirements-dev.txt
```

## Tool Configuration

### Black Configuration

Black is configured in `pyproject.toml`:

```toml
[tool.black]
line-length = 88
target-version = ['py38', 'py39', 'py310']
include = '\.pyi?$'
extend-exclude = '''
/(
  # directories
  \.eggs
  | \.git
  | \.hg
  | \.mypy_cache
  | \.tox
  | \.venv
  | build
  | dist
)/
'''
```

### Isort Configuration

Isort is configured in `pyproject.toml`:

```toml
[tool.isort]
profile = "black"
multi_line_output = 3
line_length = 88
known_first_party = ["app", "spheroseg"]
```

### Flake8 Configuration

Flake8 is configured in `.flake8`:

```ini
[flake8]
max-line-length = 88
extend-ignore = E203, W503
exclude = 
    .git,
    __pycache__,
    .venv,
    build,
    dist,
    *.egg-info
```

## Verification

Test that all tools are properly installed:

```bash
# Check tool versions
black --version
isort --version
flake8 --version
pre-commit --version

# Test on ML package
cd packages/ml

# Format with black
black --check --diff app/

# Sort imports with isort
isort --check-only --diff app/

# Lint with flake8
flake8 app/
```

## Troubleshooting

### Python Not Found

```bash
# Check Python installation
python --version
python3 --version

# Install Python if needed (Ubuntu/Debian)
sudo apt update
sudo apt install python3 python3-pip

# Install Python if needed (macOS with Homebrew)
brew install python
```

### Permission Issues

```bash
# Use user installation
pip install --user black isort flake8

# Or use virtual environment
python -m venv ~/.local/python-tools
source ~/.local/python-tools/bin/activate
pip install black isort flake8
```

### Path Issues

Add to your shell profile (`.bashrc`, `.zshrc`, etc.):

```bash
# Add user pip binaries to PATH
export PATH="$HOME/.local/bin:$PATH"

# For pipx installations
export PATH="$HOME/.local/bin:$PATH"
```

### Tool Version Conflicts

```bash
# Check installed versions
pip list | grep -E "(black|isort|flake8)"

# Upgrade to latest versions
pip install --upgrade black isort flake8

# Or pin specific versions
pip install black==23.12.1 isort==5.13.2 flake8==7.0.0
```

## CI/CD Integration

### GitHub Actions

Example workflow for Python tools:

```yaml
# .github/workflows/python-quality.yml
name: Python Code Quality

on: [push, pull_request]

jobs:
  python-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
          
      - name: Install dependencies
        run: |
          pip install black isort flake8
          
      - name: Check code formatting
        run: |
          black --check --diff packages/ml/
          
      - name: Check import sorting
        run: |
          isort --check-only --diff packages/ml/
          
      - name: Lint code
        run: |
          flake8 packages/ml/
```

### Docker Integration

Add to ML service Dockerfile:

```dockerfile
# Install Python development tools
RUN pip install black isort flake8

# Copy and validate Python code
COPY packages/ml/ /app/
WORKDIR /app

# Run quality checks during build
RUN black --check app/ && \
    isort --check-only app/ && \
    flake8 app/
```

## IDE Integration

### VS Code

Install Python extensions:

```json
// .vscode/extensions.json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.black-formatter",
    "ms-python.isort",
    "ms-python.flake8"
  ]
}
```

Configure in settings:

```json
// .vscode/settings.json
{
  "python.formatting.provider": "black",
  "python.formatting.blackArgs": ["--line-length=88"],
  "python.sortImports.args": ["--profile=black"],
  "python.linting.flake8Enabled": true,
  "python.linting.flake8Args": ["--max-line-length=88"],
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  }
}
```

### PyCharm

1. Go to **Settings** → **Tools** → **External Tools**
2. Add tools for Black, isort, and flake8
3. Configure keyboard shortcuts
4. Enable format on save

## ML Package Specific Setup

### Requirements Files

Create `packages/ml/requirements-dev.txt`:

```txt
# Development tools
black>=23.12.0
isort>=5.13.0
flake8>=7.0.0
pre-commit>=3.6.0

# Testing tools
pytest>=7.4.0
pytest-cov>=4.1.0
pytest-mock>=3.12.0

# Type checking
mypy>=1.8.0
types-requests>=2.31.0
```

### Pre-commit Configuration

ML-specific `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/psf/black
    rev: 23.12.1
    hooks:
      - id: black
        language_version: python3.10
        
  - repo: https://github.com/pycqa/isort
    rev: 5.13.2
    hooks:
      - id: isort
        args: ["--profile=black"]
        
  - repo: https://github.com/pycqa/flake8
    rev: 7.0.0
    hooks:
      - id: flake8
        args: ["--max-line-length=88"]
```

## Best Practices

1. **Use consistent versions** across development and CI
2. **Pin tool versions** in requirements files
3. **Configure tools consistently** with shared config files
4. **Test in clean environment** before committing
5. **Document exceptions** for any tool-specific overrides

## Getting Help

- **Black documentation**: https://black.readthedocs.io/
- **isort documentation**: https://pycqa.github.io/isort/
- **flake8 documentation**: https://flake8.pycqa.org/
- **pre-commit documentation**: https://pre-commit.com/

For project-specific issues, check:
- `docs/development/pre-commit-hooks.md`
- ML package README
- Team chat or create an issue