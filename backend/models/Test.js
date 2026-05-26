const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  title: { type: String, required: true },
  timeLimitMinutes: { type: Number, required: true },
  assignedTo: [{ type: String }], // Array of student roll numbers
  questions: [{
    questionId: { type: String, required: true },
    numbersArray: [{ type: Number, required: true }], // e.g., [10, 7, -2]
    correctAnswer: { type: Number, required: true }
  }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Test', testSchema);