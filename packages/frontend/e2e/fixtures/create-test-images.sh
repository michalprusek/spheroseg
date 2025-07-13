#!/bin/bash

# Create test images using ImageMagick or simple binary data
# If ImageMagick is not available, create minimal PNG files

# Function to create a minimal PNG file
create_minimal_png() {
    local filename=$1
    local color=$2
    
    # PNG signature and minimal IHDR, IDAT, IEND chunks
    printf '\x89\x50\x4e\x47\x0d\x0a\x1a\x0a' > "$filename"  # PNG signature
    printf '\x00\x00\x00\x0d' >> "$filename"  # IHDR length
    printf '\x49\x48\x44\x52' >> "$filename"  # IHDR
    printf '\x00\x00\x00\x64\x00\x00\x00\x64' >> "$filename"  # 100x100
    printf '\x08\x02\x00\x00\x00' >> "$filename"  # 8-bit RGB
    printf '\x00\x00\x00\x00' >> "$filename"  # CRC placeholder
    
    # Minimal IDAT chunk
    printf '\x00\x00\x00\x0c' >> "$filename"  # IDAT length
    printf '\x49\x44\x41\x54' >> "$filename"  # IDAT
    printf '\x78\x9c\x01\x01\x00\x00\xfe\xff\x00\x00\x00\x02\x00\x01' >> "$filename"  # Compressed data
    
    # IEND chunk
    printf '\x00\x00\x00\x00' >> "$filename"  # IEND length
    printf '\x49\x45\x4e\x44' >> "$filename"  # IEND
    printf '\xae\x42\x60\x82' >> "$filename"  # IEND CRC
}

# Create test images
create_minimal_png "test-image.png" "red"
create_minimal_png "test-image-1.png" "green"
create_minimal_png "test-image-2.png" "blue"
create_minimal_png "test-image-3.png" "yellow"
create_minimal_png "large-test-image.png" "purple"
create_minimal_png "unique-test-image.png" "orange"
create_minimal_png "test-thumbnail.png" "pink"
create_minimal_png "drag-drop-test.png" "cyan"
create_minimal_png "queue-test-1.png" "magenta"
create_minimal_png "queue-test-2.png" "lime"
create_minimal_png "queue-test-3.png" "navy"
create_minimal_png "queue-test-4.png" "teal"
create_minimal_png "queue-test-5.png" "brown"

# Create invalid test file
echo "This is not an image file" > invalid-file.txt

echo "Test images created successfully"