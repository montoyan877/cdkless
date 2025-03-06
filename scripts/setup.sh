#!/bin/bash

# Setup script for CdkLess development

# Install dependencies
echo "Installing dependencies..."
npm install

# Create necessary directories if they don't exist
echo "Setting up project structure..."
mkdir -p dist
mkdir -p examples/microservice-example/src/handlers/{orders,admin}
mkdir -p tests
mkdir -p docs

# Build the project
echo "Building project..."
npm run build

# Run tests
echo "Running tests..."
npm test

echo "Setup complete! Development environment is ready."
echo ""
echo "To publish to npm, run:"
echo "  npm login"
echo "  npm publish"
echo ""
echo "To link locally for testing, run:"
echo "  npm link"
echo "  cd ../your-test-project"
echo "  npm link cdkless" 