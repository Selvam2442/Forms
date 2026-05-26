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
    timeTakenSeconds: { type: Number, default: 0 }, 
    status: { type: String, default: 'pending_review' }, 
    adminFeedback: { type: String, default: '' },
    submitTime: { type: Date, default: Date.now }
});

// 🔥 THE FIX: Prevents the OverwriteModelError crash
module.exports = mongoose.models.Submission || mongoose.model('Submission', submissionSchema);