const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Route: POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { role, identifier, secret } = req.body;

        // ==========================================
        // 1. ADMIN LOGIN
        // ==========================================
        if (role === 'admin') {
            const validUser = process.env.ADMIN_USER || 'admin';
            const validPass = process.env.ADMIN_PASS || 'admin123';
            
            if (identifier === validUser && secret === validPass) {
                const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'supersecret', { expiresIn: '8h' });
                return res.json({ token, role: 'admin' });
            }
            return res.status(401).json({ error: "Invalid Admin Credentials" });
        }

        // ==========================================
        // 2. STUDENT SECURE PIN LOGIN
        // ==========================================
        if (role === 'student') {
            // Find student by Roll Number (e.g., AB001)
            const student = await User.findOne({ role: 'student', rollNumber: identifier.toUpperCase() });
            
            // Check if student exists AND if the PIN matches
            if (!student || student.pin !== secret) {
                return res.status(401).json({ error: "Invalid Roll Number or PIN." });
            }

            // 🔥 THE FIX: Attach the real name to the token so it's never "Unknown" again!
            const token = jwt.sign({
                userId: student._id,
                role: 'student',
                name: student.name, 
                rollNumber: student.rollNumber
            }, process.env.JWT_SECRET || 'supersecret', { expiresIn: '8h' });

            return res.json({ 
                message: "Login successful!",
                token, 
                role: 'student', 
                name: student.name 
            });
        }
        
        return res.status(400).json({ error: "Invalid login role requested." });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Server error during login." });
    }
});

module.exports = router;