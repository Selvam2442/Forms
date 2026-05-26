const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    rollNumber: { type: String, required: true, unique: true },
    pin: { type: String },
    role: { type: String, enum: ['admin', 'student'], default: 'student' },
    currentStreak: { type: Number, default: 0 }, // 🔥 NEW: Gamification
    lastLoginDate: { type: String, default: "" } // 🔥 NEW: Date tracker
});

module.exports = mongoose.model('User', userSchema);