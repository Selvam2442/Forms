const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Test = require('../models/Test');
const Submission = require('../models/Submission');

const verifyStudent = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ error: "Access Denied." });
    const token = authHeader.split(' ')[1];
    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        if (verified.role !== 'student') return res.status(403).json({ error: "Student access required." });
        req.user = verified;
        next();
    } catch (error) { res.status(401).json({ error: "Invalid token." }); }
};

router.use(verifyStudent);

// 🔥 UPDATED: Only show tests that are active AND have reached their scheduled time
router.get('/tests', async (req, res) => {
    try {
        const tests = await Test.find({ 
            isActive: true,
            $or: [
                { scheduledFor: { $exists: false } },
                { scheduledFor: { $lte: new Date() } }
            ]
        }).select('-questions.correctAnswer');
        res.status(200).json(tests);
    } catch (error) { res.status(500).json({ error: "Server error fetching tests." }); }
});

// 🔥 UPDATED: Securely hides the score and answers if not approved yet
router.get('/my-submissions', async (req, res) => {
    try {
        const submissions = await Submission.find({ studentId: req.user.userId })
            .populate('testId', 'title')
            .sort({ submitTime: -1 });
            
        const safeSubmissions = submissions.map(s => {
            const obj = s.toObject();
            if (obj.status !== 'graded') {
                obj.finalScore = undefined; // Hide the score!
                obj.answers = [];           // Hide the answers!
            }
            return obj;
        });

        res.status(200).json(safeSubmissions);
    } catch (error) { res.status(500).json({ error: "Server error." }); }
});

router.post('/submit', async (req, res) => {
    try {
        const { testId, answers } = req.body; 
        const test = await Test.findById(testId);
        if(!test) return res.status(404).json({error: "Test not found"});

        let score = 0;
        const gradedAnswers = test.questions.map(q => {
            const studentAns = Number(answers[q.questionId]);
            const isCorrect = studentAns === q.correctAnswer;
            if (isCorrect) score++;
            return {
                questionId: q.questionId,
                numbersArray: q.numbersArray,
                studentAnswer: studentAns || 0,
                correctAnswer: q.correctAnswer,
                isCorrect: isCorrect
            };
        });

        const submission = new Submission({
            studentId: req.user.userId,
            studentName: req.user.name,
            testId: test._id,
            answers: gradedAnswers,
            finalScore: score,
            status: 'pending_review'
        });

        await submission.save();
        res.status(201).json({ message: "Test submitted successfully!" });
    } catch (error) {
        console.error("SUBMISSION ERROR:", error);
        res.status(500).json({ error: "Server error submitting test." });
    }
});

module.exports = router;