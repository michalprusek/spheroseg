const io = require('socket.io-client');

// Configuration
const SERVER_URL = 'http://localhost:5001';
const PROJECT_ID = 'e9464e37-7967-410d-9742-6e4e45e55190'; // Update this to your project ID
const TOKEN = 'YOUR_AUTH_TOKEN'; // You'll need to get this from your login

// Connect to the server
const socket = io(SERVER_URL, {
  auth: {
    token: TOKEN
  }
});

socket.on('connect', () => {
  console.log('Connected to WebSocket server');
  
  // Join project room
  socket.emit('join_project', PROJECT_ID);
  console.log(`Joined project room: ${PROJECT_ID}`);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});

// Listen for segmentation updates
socket.on('segmentation_update', (data) => {
  console.log('\n=== Segmentation Update ===');
  console.log('Image ID:', data.imageId);
  console.log('Status:', data.status);
  console.log('Timestamp:', data.timestamp);
  if (data.error) {
    console.log('Error:', data.error);
  }
  console.log('==========================\n');
});

// Listen for queue updates
socket.on('segmentation_queue_update', (data) => {
  console.log('\n=== Queue Update ===');
  console.log('Project ID:', data.projectId);
  console.log('Queue Length:', data.queueLength);
  console.log('Active Tasks:', data.activeTasksCount);
  console.log('ML Service Status:', data.mlServiceStatus);
  console.log('Timestamp:', data.timestamp);
  console.log('====================\n');
});

// Listen for image updates
socket.on('image_update', (data) => {
  console.log('\n=== Image Update ===');
  console.log('Image ID:', data.imageId);
  console.log('Type:', data.type);
  console.log('Data:', JSON.stringify(data.data, null, 2));
  console.log('====================\n');
});

// Keep the script running
console.log('Listening for WebSocket events...');
console.log('Press Ctrl+C to exit');