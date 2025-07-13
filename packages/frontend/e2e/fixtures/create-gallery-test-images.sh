#!/bin/bash

# Function to create a minimal PNG file
create_minimal_png() {
    local filename=$1
    
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

# Create gallery test images
create_minimal_png "gallery-test-1.png"
create_minimal_png "gallery-test-2.png"
create_minimal_png "gallery-test-3.png"
create_minimal_png "gallery-test-4.png"
create_minimal_png "gallery-test-5.png"
create_minimal_png "gallery-test-6.png"

# Create rapid test images
create_minimal_png "rapid-test-1.png"
create_minimal_png "rapid-test-2.png"
create_minimal_png "rapid-test-3.png"

# Create other test images
create_minimal_png "cross-tab-test.png"
create_minimal_png "progress-test.png"
create_minimal_png "error-test.png"

echo "Gallery test images created successfully"