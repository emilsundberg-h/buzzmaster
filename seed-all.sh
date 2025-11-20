#!/bin/bash

echo "🌱 Seeding Buzzmaster Database..."
echo ""

# Seed players
echo "📦 Seeding players..."
cd prisma
DATABASE_URL="file:./dev.db" npx tsx seed-players.ts
cd ..

echo ""
echo "🏆 Seeding trophies..."
# Seed trophies via API (requires server to be running)
curl -X POST http://localhost:3000/api/trophies/seed

echo ""
echo ""
echo "✅ Done! Database seeded with:"
echo "   - 83 footballers (15 starting pack + 68 awards)"
echo "   - 4 trophies"
echo ""
echo "🎮 Ready to play! Visit /dream-eleven to build your team!"
