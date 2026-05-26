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
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
        if (verified.role !== 'admin') return res.status(403).json({ error: "Admin access required." });
        req.user = verified;
        next();
    } catch (error) { res.status(401).json({ error: "Invalid token." }); }
};

router.use(verifyAdmin);

// STUDENTS
router.post('/students', async (req, res) => {
    try {
        const { name, pin } = req.body;
        if (!name || !pin) return res.status(400).json({ error: "Name and PIN required" });
        const count = await User.countDocuments({ role: 'student' });
        const rollNumber = `AB${String(count + 1).padStart(3, '0')}`;
        const newStudent = new User({ name, rollNumber, pin, role: 'student' });
        await newStudent.save();
        res.status(201).json({ message: "Created!", student: newStudent });
    } catch (error) { res.status(500).json({ error: "Server error" }); }
});
router.put('/students/:rollNumber/pin', async (req, res) => {
    try {
        const { pin } = req.body; await User.findOneAndUpdate({ rollNumber: req.params.rollNumber, role: 'student' }, { pin });
        res.status(200).json({ message: "PIN Updated!" });
    } catch (error) { res.status(500).json({ error: "Server error" }); }
});
router.get('/students', async (req, res) => {
    try { const students = await User.find({ role: 'student' }).sort({ rollNumber: 1 }); res.status(200).json(students); } catch (error) { res.status(500).json({ error: "Server error" }); }
});
router.delete('/students/:rollNumber', async (req, res) => {
    try { await User.findOneAndDelete({ rollNumber: req.params.rollNumber, role: 'student' }); res.status(200).json({ message: "Student deleted!" }); } catch (error) { res.status(500).json({ error: "Server error" }); }
});

// TESTS
router.post('/tests', async (req, res) => {
    try {
        const { title, timeLimitMinutes, questions, isActive, availableFrom, dueDate, assignedTo } = req.body;
        const processedQuestions = questions.map((q, index) => ({ questionId: `Q${index + 1}`, numbersArray: q.numbersArray, correctAnswer: q.numbersArray.reduce((sum, num) => sum + num, 0) }));
        const newTest = new Test({ title, timeLimitMinutes, assignedTo: assignedTo || [], questions: processedQuestions, isActive, availableFrom: availableFrom ? new Date(availableFrom) : null, dueDate: dueDate ? new Date(dueDate) : null });
        await newTest.save(); res.status(201).json({ message: "Test saved!", test: newTest });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 🔥 NEW: EDIT TEST ROUTE
router.put('/tests/:id', async (req, res) => {
    try {
        const { title, timeLimitMinutes, questions, isActive, availableFrom, dueDate, assignedTo } = req.body;
        const processedQuestions = questions.map((q, index) => ({ questionId: `Q${index + 1}`, numbersArray: q.numbersArray, correctAnswer: q.numbersArray.reduce((sum, num) => sum + num, 0) }));
        
        await Test.findByIdAndUpdate(req.params.id, {
            title, timeLimitMinutes, questions: processedQuestions, isActive, assignedTo: assignedTo || [],
            availableFrom: availableFrom ? new Date(availableFrom) : null, dueDate: dueDate ? new Date(dueDate) : null
        });
        res.status(200).json({ message: "Test updated successfully!" });
    } catch (error) { res.status(500).json({ error: "Server error updating test." }); }
});

router.get('/tests', async (req, res) => {
    try { const tests = await Test.find().sort({ createdAt: -1 }); res.status(200).json(tests); } catch (error) { res.status(500).json({ error: "Server error" }); }
});
router.put('/tests/:id/toggle', async (req, res) => {
    try { const test = await Test.findById(req.params.id); test.isActive = !test.isActive; await test.save(); res.status(200).json({ message: "Status updated!", isActive: test.isActive }); } catch (error) { res.status(500).json({ error: "Server error" }); }
});
router.delete('/tests/:id', async (req, res) => {
    try { await Test.findByIdAndDelete(req.params.id); await Submission.deleteMany({ testId: req.params.id }); res.status(200).json({ message: "Test deleted." }); } catch (error) { res.status(500).json({ error: "Server error" }); }
});

// SUBMISSIONS
router.get('/submissions', async (req, res) => {
    try { const submissions = await Submission.find().populate('testId', 'title').sort({ submitTime: -1 }); res.status(200).json(submissions); } catch (error) { res.status(500).json({ error: "Server error" }); }
});
router.put('/submissions/:id/approve', async (req, res) => {
    try { const submission = await Submission.findById(req.params.id); submission.status = 'graded'; submission.adminFeedback = req.body.feedback || 'Great job!'; await submission.save(); res.status(200).json({ message: "Approved!" }); } catch (error) { res.status(500).json({ error: "Server error" }); }
});
router.put('/submissions/approve-bulk', async (req, res) => {
    try { const { submissionIds } = req.body; await Submission.updateMany({ _id: { $in: submissionIds } }, { $set: { status: 'graded', adminFeedback: 'Approved by Instructor' } }); res.status(200).json({ message: "Approved!" }); } catch (error) { res.status(500).json({ error: "Server error" }); }
});
router.delete('/submissions/:id/reset', async (req, res) => {
    try { await Submission.findByIdAndDelete(req.params.id); res.status(200).json({ message: "Reset successful." }); } catch (error) { res.status(500).json({ error: "Server error" }); }
});

// LEADERBOARD
router.get('/leaderboard', async (req, res) => {
    try {
        const submissions = await Submission.find({ status: 'graded' }).populate('testId', 'title').sort({ finalScore: -1, submitTime: 1 });
        const groupedLeaderboard = {};
        submissions.forEach(sub => { if (!sub.testId) return; const title = sub.testId.title; if (!groupedLeaderboard[title]) groupedLeaderboard[title] = []; if (groupedLeaderboard[title].length < 10) groupedLeaderboard[title].push(sub); });
        res.status(200).json(groupedLeaderboard);
    } catch (error) { res.status(500).json({ error: "Server error." }); }
});
module.exports = router;