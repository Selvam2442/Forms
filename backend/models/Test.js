const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
    title: String,
    timeLimitMinutes: Number,
    isActive: { type: Boolean, default: true },
    availableFrom: { type: Date, default: null }, 
    dueDate: { type: Date, default: null },       
    questions: [{
        questionId: String,
        numbersArray: [Number],
        correctAnswer: Number
    }],
    assignedTo: { type: [String], default: [] }, // 🔥 NEW: Empty means "Everyone", otherwise contains Roll Numbers
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Test || mongoose.model('Test', testSchema);