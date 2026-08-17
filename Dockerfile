# Use a slim Python 3.13 image as base
FROM python:3.13-slim

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set the working directory
WORKDIR /app

# Enable bytecode compilation for performance
ENV UV_COMPILE_BYTECODE=1

# Copy dependency definition
COPY pyproject.toml ./

# Install dependencies directly into the system environment
RUN uv pip install --system -r pyproject.toml

# Copy application code, static assets, and runtime reference catalogs
COPY agent.py main.py ./
COPY static/ ./static/
COPY resources/ ./resources/

# Expose port (Cloud Run sets PORT=8080)
EXPOSE 8080

# Launch server
CMD ["python", "main.py"]
