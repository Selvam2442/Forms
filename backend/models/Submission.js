const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
    studentName: String, 
    answers: [{
        questionId: String,
        numbersArray: [Number],
        studentAnswer: Number,
        correctAnswer: Number,
        isCorrect: Boolean
    }],
    finalScore: { type: Number, default: 0 },
    timeTakenSeconds: { type: Number, default: 0 }, // 🔥 NEW: Tracks time taken
    status: { type: String, default: 'pending_review' }, 
    adminFeedback: { type: String, default: '' },
    submitTime: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Submission', submissionSchema);