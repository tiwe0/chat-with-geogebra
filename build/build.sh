#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR/../next"
if [ $? -ne 0 ]; then
    echo "Failed to change directory to next"
    exit 1
fi

echo "Installing dependencies..."
pnpm install
if [ $? -ne 0 ]; then
    echo "Failed to install dependencies"
    exit 1
fi

echo "Building project..."
pnpm build
if [ $? -ne 0 ]; then
    echo "Failed to build project"
    exit 1
fi

echo "Copying static assets..."
cp -r "$SCRIPT_DIR/../next/.next/static" "$SCRIPT_DIR/../next/.next/standalone/.next/"
cp -r "$SCRIPT_DIR/../next/public" "$SCRIPT_DIR/../next/.next/standalone/"

echo "Copying standalone files into tauri..."
mv "$SCRIPT_DIR/../next/.next/standalone" "$SCRIPT_DIR/../tauri/standalone"

# 处理该死的 styled-jsx
rm -rf "$SCRIPT_DIR/../tauri/standalone/node_modules/styled-jsx"
cp -r "$SCRIPT_DIR/../tauri/standalone/node_modules/.pnpm/styled-jsx@5.1.6_react@19.2.3/node_modules/styled-jsx" "$SCRIPT_DIR/../tauri/standalone/node_modules/"

cd "$SCRIPT_DIR/../tauri"

echo "Installing tauri dependencies..."
pnpm install
if [ $? -ne 0 ]; then
    echo "Failed to install tauri dependencies"
    exit 1
fi

echo "Building tauri..."
pnpm tauri build
if [ $? -ne 0 ]; then
    echo "Failed to build tauri"
    exit 1
fi

echo "Returning to original directory..."
cd "$SCRIPT_DIR/.."

echo "Build completed successfully!"
