const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Route: POST /api/auth/login
// Purpose: Securely logs in both Admins and Students, calculating daily streaks.
router.post('/login', async (req, res) => {
    try {
        const { role, identifier, secret } = req.body;

        // ==========================================
        // 1. INSTRUCTOR / ADMIN LOGIN
        // ==========================================
        if (role === 'admin') {
            // Checks for environment variables first, defaults to admin/admin123
            const validUser = process.env.ADMIN_USER || 'admin';
            const validPass = process.env.ADMIN_PASS || 'admin123';
            
            if (identifier === validUser && secret === validPass) {
                const token = jwt.sign(
                    { role: 'admin' }, 
                    process.env.JWT_SECRET || 'supersecret', 
                    { expiresIn: '8h' }
                );
                return res.json({ message: "Admin Login Successful", token, role: 'admin' });
            }
            return res.status(401).json({ error: "Invalid Admin Credentials" });
        }

        // ==========================================
        // 2. STUDENT SECURE PIN LOGIN & STREAK MATH
        // ==========================================
        if (role === 'student') {
            // Find student by Roll Number (converting to uppercase to prevent typos)
            const student = await User.findOne({ 
                role: 'student', 
                rollNumber: identifier.toUpperCase() 
            });
            
            // Validate existence and PIN match
            if (!student || student.pin !== secret) {
                return res.status(401).json({ error: "Invalid Roll Number or PIN." });
            }

            // --- Gamification: Streak Calculation ---
            const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
            let streak = student.currentStreak || 0;
            
            // If they haven't logged in today yet, we process the streak
            if (student.lastLoginDate !== today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];
                
                if (student.lastLoginDate === yesterdayStr) {
                    // They logged in yesterday, increment the streak!
                    streak += 1;
                } else {
                    // They missed a day, reset their streak back to 1
                    streak = 1; 
                }
                
                // Save the new streak and date to the database
                student.lastLoginDate = today;
                student.currentStreak = streak;
                await student.save();
            }

            // --- Generate Secure Token ---
            const token = jwt.sign({
                userId: student._id,
                role: 'student',
                name: student.name, 
                rollNumber: student.rollNumber,
                streak: streak // Sent to frontend to trigger Confetti!
            }, process.env.JWT_SECRET || 'supersecret', { expiresIn: '8h' });

            return res.json({ 
                message: "Login successful!", 
                token, 
                role: 'student', 
                name: student.name,
                streak: streak
            });
        }
        
        // Failsafe catch
        return res.status(400).json({ error: "Invalid login role requested." });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Server error during login." });
    }
});

module.exports = router;