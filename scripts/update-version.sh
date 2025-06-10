#!/bin/bash

# Script to update version in all package.json files
# Usage: ./scripts/update-version.sh <new_version>

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <new_version>"
    echo "Example: $0 1.2.3"
    exit 1
fi

NEW_VERSION="$1"

# Validate version format (semver check including pre-releases)
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?$ ]]; then
    echo "Error: Version must be in semver format (e.g., 1.2.3, 1.2.3-rc1, 1.2.3-alpha.1)"
    exit 1
fi

echo "Updating all package.json files to version $NEW_VERSION..."

# Array of package.json files to update
PACKAGE_FILES=(
    "package.json"
    "packages/axios/package.json"
    "packages/core/package.json"
    "packages/express/package.json" 
    "packages/examples/package.json"
)

# Function to update version in a package.json file
update_package_version() {
    local file="$1"
    if [ -f "$file" ]; then
        echo "Updating $file..."
        # Use sed to update the version field
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS sed syntax
            sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" "$file"
        else
            # Linux sed syntax
            sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" "$file"
        fi
        echo "✓ Updated $file"
    else
        echo "⚠ Warning: $file not found"
    fi
}

# Function to update internal dependencies
update_internal_dependencies() {
    local file="$1"
    if [ -f "$file" ]; then
        echo "Updating internal dependencies in $file..."
        # Update @diager-js/core dependency
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/\"@diager-js\/core\": \"[^\"]*\"/\"@diager-js\/core\": \"^$NEW_VERSION\"/" "$file"
            sed -i '' "s/\"@diager-js\/express\": \"[^\"]*\"/\"@diager-js\/express\": \"^$NEW_VERSION\"/" "$file"
            sed -i '' "s/\"@diager-js\/axios\": \"[^\"]*\"/\"@diager-js\/axios\": \"^$NEW_VERSION\"/" "$file"
        else
            sed -i "s/\"@diager-js\/core\": \"[^\"]*\"/\"@diager-js\/core\": \"^$NEW_VERSION\"/" "$file"
            sed -i "s/\"@diager-js\/express\": \"[^\"]*\"/\"@diager-js\/express\": \"^$NEW_VERSION\"/" "$file"
            sed -i "s/\"@diager-js\/axios\": \"[^\"]*\"/\"@diager-js\/axios\": \"^$NEW_VERSION\"/" "$file"
        fi
        echo "✓ Updated internal dependencies in $file"
    fi
}

# Update version in all package.json files
for file in "${PACKAGE_FILES[@]}"; do
    update_package_version "$file"
done

echo ""
echo "Updating internal dependencies..."

# Update internal dependencies in packages that depend on other packages
update_internal_dependencies "packages/axios/package.json"
update_internal_dependencies "packages/express/package.json"
update_internal_dependencies "packages/examples/package.json"

echo ""
echo "🎉 All package.json files have been updated to version $NEW_VERSION"
echo ""
echo "Updated files:"
for file in "${PACKAGE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  - $file"
    fi
done 
