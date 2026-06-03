const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    questionId: { type: String, required: true },
    numbersArray: { type: [Number], required: true },
    correctAnswer: { type: mongoose.Schema.Types.Mixed, required: true }
});

const TestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    testType: { type: String, default: 'addition' },
    
    // 🔥 New Field: Multiple Choice vs Direct Keyboard
    answerFormat: { type: String, enum: ['mcq', 'direct'], default: 'mcq' },
    
    timeLimitMinutes: { type: Number, required: true },
    assignedTo: { type: [String], default: [] }, // Array of student rollNumbers
    questions: { type: [QuestionSchema], required: true },
    isActive: { type: Boolean, default: true },
    availableFrom: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Test', TestSchema);