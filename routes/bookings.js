// routes/bookings.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.send('All bookings');
});

module.exports = router;