const express = require('express');
const router = express.Router();
const protectRoute = require('../middleware/protectRoute');

router.get('/profile', protectRoute, (req, res) => {
  const name = [req.user.first_name, req.user.last_name].filter(Boolean).join(' ')
    || req.user.name;
  res.json({ message: `Welcome, ${name}` });
});

module.exports = router;
