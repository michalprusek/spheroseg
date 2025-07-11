const express = require('express');
const app = express();

app.get('/test', (req, res) => {
  res.json({ message: 'Test server is working!' });
});

const port = 5001;
app.listen(port, '0.0.0.0', () => {
  console.log(`Test server running on port ${port}`);
});