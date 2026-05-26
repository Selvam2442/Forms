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
    assignedTo: [String],
    createdAt: { type: Date, default: Date.now }
});

// 🔥 THE FIX: Checks if the model exists before trying to create it again
module.exports = mongoose.models.Test || mongoose.model('Test', testSchema);