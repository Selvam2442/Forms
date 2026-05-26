const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Route: POST /api/auth/login
// Purpose: Verifies Roll Number (and PIN for admins), then issues a JWT token.
router.post('/login', async (req, res) => {
  try {
    const { rollNumber, pin } = req.body;

    // 1. Everyone must provide at least a Roll Number / Name
    if (!rollNumber) {
      return res.status(400).json({ error: "ID or Roll Number is required." });
    }

    // 2. Find the user in the database (convert to uppercase so 'admin' becomes 'ADMIN')
    const user = await User.findOne({ rollNumber: rollNumber.toUpperCase() });

    if (!user) {
      return res.status(401).json({ error: "User not found. Check your ID." });
    }

    // 3. The New Security Rule: Admin needs a PIN, Students do not!
    if (user.role === 'admin') {
      if (!pin || user.pin !== pin) {
        return res.status(401).json({ error: "Invalid Admin PIN." });
      }
    }

    // 4. Create the secure token
    const payload = { userId: user._id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    res.status(200).json({
      message: "Login successful!",
      token: token,
      user: { name: user.name, rollNumber: user.rollNumber, role: user.role }
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login." });
  }
});

module.exports = router;