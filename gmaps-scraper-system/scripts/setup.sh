#!/bin/bash

echo "🚀 Google Maps Scraper System - Setup Script"
echo "=============================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your configuration."
    echo ""
else
    echo "✅ .env file already exists"
    echo ""
fi

# Check PostgreSQL connection
echo "🔍 Checking PostgreSQL connection..."
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL is installed"
else
    echo "❌ PostgreSQL not found. Please install PostgreSQL 13+."
fi
echo ""

# Check Redis connection
echo "🔍 Checking Redis connection..."
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis is running"
    else
        echo "⚠️  Redis is installed but not running. Please start Redis:"
        echo "   brew services start redis  (macOS)"
        echo "   sudo systemctl start redis (Linux)"
    fi
else
    echo "❌ Redis not found. Please install Redis 6+."
fi
echo ""

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate
if [ $? -eq 0 ]; then
    echo "✅ Prisma client generated successfully"
else
    echo "⚠️  Prisma client generation failed. Will retry during npm postinstall."
fi
echo ""

# Create database and run migrations
echo "🗄️  Setting up database..."
echo "Please ensure your PostgreSQL database exists and credentials are correct in .env"
read -p "Do you want to run database migrations now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx prisma migrate dev --name init
    if [ $? -eq 0 ]; then
        echo "✅ Database migrations completed"
    else
        echo "❌ Database migrations failed. Please check your DATABASE_URL in .env"
    fi
fi
echo ""

# Create exports directory
echo "📁 Creating exports directory..."
mkdir -p exports
echo "✅ Exports directory created"
echo ""

echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your database and Redis credentials"
echo "2. Configure Discord webhook URL (optional but recommended)"
echo "3. Start the application:"
echo "   Terminal 1: npm run dev"
echo "   Terminal 2: npm run worker"
echo ""
echo "4. Open http://localhost:3000 in your browser"
echo ""
