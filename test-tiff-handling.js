#!/usr/bin/env node

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

async function testTiffHandling() {
  console.log('Testing TIFF handling...\n');

  // Test 1: Check if Sharp can handle TIFF files
  console.log('Test 1: Checking Sharp TIFF support');
  try {
    const formats = sharp.format;
    console.log('Supported input formats:', Object.keys(formats).filter(f => formats[f].input));
    console.log('TIFF input support:', formats.tiff?.input ? 'YES' : 'NO');
    console.log('TIFF output support:', formats.tiff?.output ? 'YES' : 'NO');
  } catch (error) {
    console.error('Error checking Sharp formats:', error);
  }

  // Test 2: Create a test TIFF file and try to convert it
  console.log('\nTest 2: Creating and converting test TIFF');
  try {
    // Create a simple test image
    const testBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    })
    .tiff()
    .toBuffer();

    // Save as TIFF
    const tiffPath = './test-image.tiff';
    await fs.writeFile(tiffPath, testBuffer);
    console.log('Created test TIFF file:', tiffPath);

    // Convert TIFF to JPEG
    const jpegPath = './test-image-converted.jpg';
    await sharp(tiffPath)
      .jpeg({ quality: 90 })
      .toFile(jpegPath);
    console.log('Successfully converted TIFF to JPEG:', jpegPath);

    // Get metadata
    const metadata = await sharp(tiffPath).metadata();
    console.log('TIFF metadata:', metadata);

    // Clean up
    await fs.unlink(tiffPath);
    await fs.unlink(jpegPath);
    console.log('Cleaned up test files');

  } catch (error) {
    console.error('Error in TIFF conversion test:', error);
  }

  // Test 3: Check if the conversion function exists
  console.log('\nTest 3: Checking imageUtils');
  try {
    const imageUtils = require('./packages/backend/dist/utils/imageUtils.unified.js').default;
    console.log('convertTiffToWebFriendly exists:', typeof imageUtils.convertTiffToWebFriendly === 'function');
  } catch (error) {
    console.error('Error loading imageUtils:', error.message);
  }
}

testTiffHandling().catch(console.error);