const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
    title: String,
    testType: { type: String, default: 'addition' }, // 🔥 NEW: addition, multiplication, or division
    timeLimitMinutes: Number,
    isActive: { type: Boolean, default: true },
    availableFrom: { type: Date, default: null }, 
    dueDate: { type: Date, default: null },       
    questions: [{
        questionId: String,
        numbersArray: [Number],
        correctAnswer: Number
    }],
    assignedTo: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Test || mongoose.model('Test', testSchema);