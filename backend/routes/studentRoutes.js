const express = require('express');
const router = express.Router();
const Test = require('../models/Test');
const Submission = require('../models/Submission');
const jwt = require('jsonwebtoken');

// Middleware to verify student token
const verifyStudent = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ error: "Access Denied" });

    try {
        const verified = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'fallback_secret');
        if (verified.role !== 'student') return res.status(403).json({ error: "Invalid role" });
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ error: "Invalid Token" });
    }
};

// 1. Get Available Tests for this Student
router.get('/tests', verifyStudent, async (req, res) => {
    try {
        const now = new Date();
        // Find tests that are active, and either assigned to everyone OR specifically to this student's roll number
        const tests = await Test.find({ 
            isActive: true,
            $or: [
                { assignedTo: { $size: 0 } }, 
                { assignedTo: req.user.rollNumber }
            ]
        });

        // Filter out tests that haven't opened yet or are past their due date
        const validTests = tests.filter(t => {
            if (t.availableFrom && new Date(t.availableFrom) > now) return false;
            if (t.dueDate && new Date(t.dueDate) < now) return false;
            return true;
        });

        res.json(validTests);
    } catch (err) {
        res.status(500).json({ error: "Error fetching tests" });
    }
});

// 2. Submit a Test
router.post('/submit', verifyStudent, async (req, res) => {
    try {
        const { testId, answers, timeTakenSeconds } = req.body;
        const test = await Test.findById(testId);
        if (!test) return res.status(404).json({ error: "Test not found" });

        let score = 0;
        const gradedAnswers = test.questions.map(q => {
            const studentAns = answers[q.questionId] !== undefined ? answers[q.questionId] : null;
            const isCorrect = studentAns === q.correctAnswer;
            if (isCorrect) score++;

            return {
                questionId: q.questionId,
                numbersArray: q.numbersArray,
                correctAnswer: q.correctAnswer,
                studentAnswer: studentAns,
                isCorrect: isCorrect
            };
        });

        const newSubmission = new Submission({
            studentId: req.user.id,
            studentName: req.user.name,
            testId: test._id,
            answers: gradedAnswers,
            finalScore: score,
            timeTakenSeconds: timeTakenSeconds || 0,
            status: 'pending_review' // Default status awaiting admin approval
        });

        await newSubmission.save();
        res.status(201).json({ message: "Test submitted successfully!", score });
    } catch (err) {
        res.status(500).json({ error: "Error submitting test" });
    }
});

// 3. Get Student's Submissions (History & Results)
router.get('/my-submissions', verifyStudent, async (req, res) => {
    try {
        const submissions = await Submission.find({ studentId: req.user.id }).populate('testId', 'title testType');
        res.json(submissions);
    } catch (err) {
        res.status(500).json({ error: "Error fetching submissions" });
    }
});

// 4. 🔥 NEW: Request a Retake
router.put('/submissions/:id/request-retake', verifyStudent, async (req, res) => {
    try {
        const submission = await Submission.findOne({ _id: req.params.id, studentId: req.user.id });
        if (!submission) return res.status(404).json({ error: "Submission not found" });

        submission.status = 'retake_requested';
        await submission.save();

        res.status(200).json({ message: "Retake requested successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Error requesting retake" });
    }
});

module.exports = router;