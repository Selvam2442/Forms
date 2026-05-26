const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
    title: String,
    timeLimitMinutes: Number,
    isActive: { type: Boolean, default: true },
    availableFrom: { type: Date, default: null }, // 🔥 NEW: When the test opens
    dueDate: { type: Date, default: null },       // 🔥 NEW: When the test closes (Deadline)
    questions: [{
        questionId: String,
        numbersArray: [Number],
        correctAnswer: Number
    }],
    assignedTo: [String],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Test', testSchema);