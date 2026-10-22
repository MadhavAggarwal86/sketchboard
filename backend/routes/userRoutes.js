const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const router = express.Router();
const User = require('../models/user');
const { validateUser } = require('../middleware/validation');

const createToken = (user) => jwt.sign(
  {
    userId: user._id.toString(),
    first_name: user.first_name,
    last_name: user.last_name
  },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

const publicUser = (user) => ({
  id: user._id.toString(),
  first_name: user.first_name,
  last_name: user.last_name,
  name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.name,
  email: user.email
});
const isBcryptHash = (value) => /^\$2[aby]\$/.test(value);

const requireJwtSecret = (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Authentication is not configured' });
  }
  next();
};

router.post('/register', requireJwtSecret, validateUser, async (req, res) => {
  try {
    const { first_name, last_name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    const user = new User({
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      name: `${first_name.trim()} ${last_name.trim()}`,
      email,
      password: await bcrypt.hash(password, 12)
    });
    await user.save();
    res.status(201).json({
      token: createToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    res.status(500).json({ error: 'Failed to register account' });
  }
});

router.post(
  '/login',
  requireJwtSecret,
  [
    check('email').isEmail().withMessage('Invalid email format'),
    check('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const user = await User.findOne({ email: req.body.email });
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const passwordMatches = isBcryptHash(user.password)
        ? await bcrypt.compare(req.body.password, user.password)
        : req.body.password === user.password;
      if (!passwordMatches) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      let shouldSaveUser = false;
      if (!isBcryptHash(user.password)) {
        user.password = await bcrypt.hash(req.body.password, 12);
        shouldSaveUser = true;
      }
      if (user.first_name === undefined || user.last_name === undefined) {
        const [firstName = '', ...lastNameParts] = (user.name || '').trim().split(/\s+/);
        user.first_name ??= firstName;
        user.last_name ??= lastNameParts.join(' ');
        shouldSaveUser = true;
      }
      if (shouldSaveUser) {
        await user.save();
      }
      res.json({
        token: createToken(user),
        user: publicUser(user)
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to sign in' });
    }
  }
);

module.exports = router;
