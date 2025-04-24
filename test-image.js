const fs = require('fs');
const { createCanvas } = require('canvas');

// Create a 200x200 canvas with a red circle
const width = 200;
const height = 200;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// Fill the background
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, width, height);

// Draw a red circle
ctx.fillStyle = 'red';
ctx.beginPath();
ctx.arc(width/2, height/2, 50, 0, Math.PI * 2);
ctx.fill();

// Save the image
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('test-image.png', buffer);

console.log('Test image created: test-image.png');
