// Start Discord bot
require('./discord.js');

// Start ATT bot
require('./index.js');

// Keep the service alive with a tiny HTTP server
const express = require('express');
const app = express();

// Optional: simple health check endpoint
app.get('/', (req, res) => {
  res.send('Bot is running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web server listening on port ${PORT}`);
});
