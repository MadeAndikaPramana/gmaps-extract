#!/bin/bash

echo "🤖 Starting Google Maps Scraper Worker..."
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please run setup first: bash scripts/setup.sh"
    exit 1
fi

# Check if Redis is running
if command -v redis-cli &> /dev/null; then
    if ! redis-cli ping &> /dev/null; then
        echo "❌ Error: Redis is not running!"
        echo "Please start Redis first:"
        echo "  macOS: brew services start redis"
        echo "  Linux: sudo systemctl start redis"
        exit 1
    fi
else
    echo "⚠️  Warning: redis-cli not found, cannot verify Redis connection"
fi

echo "✅ Starting worker process..."
echo ""

# Start the worker
npm run worker
