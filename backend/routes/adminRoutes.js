const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Test = require('../models/Test');
const Submission = require('../models/Submission');

const verifyAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ error: "Access Denied." });
    const token = authHeader.split(' ')[1];
    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        if (verified.role !== 'admin') return res.status(403).json({ error: "Admin access required." });
        req.user = verified;
        next();
    } catch (error) { res.status(401).json({ error: "Invalid token." }); }
};

router.use(verifyAdmin);

// === STUDENT MANAGEMENT ===
router.post('/students', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: "Name is required" });
        const count = await User.countDocuments({ role: 'student' });
        const rollNumber = `AB${String(count + 1).padStart(3, '0')}`;
        const pin = Math.floor(1000 + Math.random() * 9000).toString();
        const newStudent = new User({ name, rollNumber, pin, role: 'student' });
        await newStudent.save();
        res.status(201).json({ message: "Created!", student: newStudent });
    } catch (error) { res.status(500).json({ error: "Server error" }); }
});

router.get('/students', async (req, res) => {
    try {
        const students = await User.find({ role: 'student' }).sort({ rollNumber: 1 });
        res.status(200).json(students);
    } catch (error) { res.status(500).json({ error: "Server error" }); }
});

router.delete('/students/:rollNumber', async (req, res) => {
    try {
        await User.findOneAndDelete({ rollNumber: req.params.rollNumber, role: 'student' });
        res.status(200).json({ message: "Student deleted!" });
    } catch (error) { res.status(500).json({ error: "Server error" }); }
});

// === TEST MANAGEMENT ===
router.post('/tests', async (req, res) => {
    try {
        const { title, timeLimitMinutes, questions, isActive } = req.body;
        const processedQuestions = questions.map((q, index) => ({
            questionId: `Q${index + 1}`,
            numbersArray: q.numbersArray,
            correctAnswer: q.numbersArray.reduce((sum, num) => sum + num, 0) 
        }));
        const newTest = new Test({ title, timeLimitMinutes, assignedTo: [], questions: processedQuestions, isActive });
        await newTest.save();
        res.status(201).json({ message: "Test saved!", test: newTest });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/tests', async (req, res) => {
    try {
        const tests = await Test.find().sort({ createdAt: -1 });
        res.status(200).json(tests);
    } catch (error) { res.status(500).json({ error: "Server error" }); }
});

router.put('/tests/:id/toggle', async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        test.isActive = !test.isActive;
        await test.save();
        res.status(200).json({ message: "Status updated!", isActive: test.isActive });
    } catch (error) { res.status(500).json({ error: "Server error" }); }
});

// NEW: Delete Test and its submissions
router.delete('/tests/:id', async (req, res) => {
    try {
        await Test.findByIdAndDelete(req.params.id);
        await Submission.deleteMany({ testId: req.params.id }); // Clean up old data
        res.status(200).json({ message: "Test permanently deleted." });
    } catch (error) { res.status(500).json({ error: "Server error deleting test." }); }
});

// === SUBMISSIONS & LEADERBOARD ===
router.get('/submissions', async (req, res) => {
    try {
        const submissions = await Submission.find().populate('testId', 'title').sort({ submitTime: -1 });
        res.status(200).json(submissions);
    } catch (error) { res.status(500).json({ error: "Server error" }); }
});

router.put('/submissions/:id/approve', async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.id);
        submission.status = 'graded';
        submission.adminFeedback = req.body.feedback || 'Great job!';
        await submission.save();
        res.status(200).json({ message: "Approved!" });
    } catch (error) { res.status(500).json({ error: "Server error" }); }
});

router.delete('/submissions/:id/reset', async (req, res) => {
    try {
        await Submission.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Reset successful." });
    } catch (error) { res.status(500).json({ error: "Server error" }); }
});

router.get('/leaderboard', async (req, res) => {
    try {
        const submissions = await Submission.find({ status: 'graded' }).populate('testId', 'title').sort({ finalScore: -1, submitTime: 1 });
        const groupedLeaderboard = {};
        submissions.forEach(sub => {
            if (!sub.testId) return; 
            const title = sub.testId.title;
            if (!groupedLeaderboard[title]) groupedLeaderboard[title] = [];
            if (groupedLeaderboard[title].length < 10) groupedLeaderboard[title].push(sub);
        });
        res.status(200).json(groupedLeaderboard);
    } catch (error) { res.status(500).json({ error: "Error compiling leaderboard." }); }
});

module.exports = router;