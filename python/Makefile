# Makefile for Python backend

.PHONY: install run test format lint clean

# Install dependencies
install:
	poetry install

# Run development server
run:
	poetry run uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
test:
	poetry run pytest -v

# Format code
format:
	poetry run black src tests
	poetry run ruff src tests --fix

# Lint code
lint:
	poetry run black src tests --check
	poetry run ruff src tests
	poetry run mypy src

# Clean cache files
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	find . -type d -name ".ruff_cache" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

# Help
help:
	@echo "Available commands:"
	@echo "  make install  - Install dependencies with Poetry"
	@echo "  make run      - Run development server"
	@echo "  make test     - Run tests"
	@echo "  make format   - Format code with Black and Ruff"
	@echo "  make lint     - Check code quality"
	@echo "  make clean    - Remove cache files"
