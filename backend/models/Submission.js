const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
    testId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Test', 
        required: true 
    },
    studentRollNumber: { type: String, required: true },
    studentName: { type: String, required: true }, // Added for easy Admin viewing
    startTime: { type: Date, required: true },
    submitTime: { type: Date, required: true },
    cheatWarnings: { type: Number, default: 0 },
    finalScore: { type: Number, default: 0 },
    
    // The VIP List of allowed statuses:
    status: { 
        type: String, 
        enum: ['pending_review', 'graded', 'retake_requested'], 
        default: 'pending_review' 
    },
    
    adminFeedback: { type: String, default: '' },
    
    answers: [{
        questionId: { type: String },
        studentAnswer: { type: Number }
    }]
});

module.exports = mongoose.model('Submission', submissionSchema);