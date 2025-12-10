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

echo "Copying standalone files into tauri..."
cp -r "$SCRIPT_DIR/../next/.next/standalone" "$SCRIPT_DIR/../tauri/standalone"

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
