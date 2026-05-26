const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
    title: String,
    timeLimitMinutes: Number,
    isActive: { type: Boolean, default: true },
    scheduledFor: { type: Date, default: Date.now }, // 🔥 NEW: Scheduled release time
    questions: [{
        questionId: String,
        numbersArray: [Number],
        correctAnswer: Number
    }],
    assignedTo: [String],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Test', testSchema);