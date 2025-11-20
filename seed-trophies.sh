#!/bin/bash

echo "🏆 Seeding trophies..."
echo ""

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ Error: Server is not running!"
    echo "Please start the server first with: yarn dev"
    exit 1
fi

# Seed trophies
response=$(curl -s -X POST http://localhost:3000/api/trophies/seed)

if echo "$response" | grep -q "success"; then
    echo "✅ Trophies seeded successfully!"
    echo "$response" | grep -o '"count":[0-9]*' | grep -o '[0-9]*' | xargs echo "   Added trophies:"
else
    echo "Response: $response"
    if echo "$response" | grep -q "already seeded"; then
        echo "✅ Trophies already exist in database"
    else
        echo "❌ Failed to seed trophies"
    fi
fi

echo ""
echo "Done!"
