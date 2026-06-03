const express = require('express');
const router = express.Router();

// IMPORTANT: Adjust these paths if your models are located in a different folder structure
const User = require('../models/User'); 
const Test = require('../models/Test');
const Submission = require('../models/Submission');

// ==========================================
// 1. SECURITY & PASSWORD MANAGEMENT
// ==========================================
router.get('/password-info', async (req, res) => {
    try {
        const admin = await User.findOne({ role: 'admin' }); 
        if (!admin) return res.status(404).json({ error: "Admin not found." });
        res.status(200).json({ lastUpdated: admin.lastPasswordUpdate || null });
    } catch (error) {
        res.status(500).json({ error: "Server error retrieving security info." });
    }
});

router.put('/change-password', async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const admin = await User.findOne({ role: 'admin' });

        if (!admin) return res.status(404).json({ error: "Admin not found." });

        // 🔥 Checking 'admin.pin' based on your specific database structure
        if (admin.pin !== oldPassword) {
            return res.status(400).json({ error: "Incorrect Old Password! Request denied." });
        }

        // Save the new password to the 'pin' field (and 'secret' to be universally safe)
        admin.pin = newPassword;
        admin.secret = newPassword;
        admin.lastPasswordUpdate = new Date();
        await admin.save();

        res.status(200).json({ message: "Password updated successfully!", lastUpdated: admin.lastPasswordUpdate });
    } catch (error) {
        res.status(500).json({ error: "Server error updating password." });
    }
});

// ==========================================
// 2. STUDENT MANAGEMENT
// ==========================================
router.get('/students', async (req, res) => {
    try {
        const students = await User.find({ role: 'student' }).sort({ createdAt: -1 });
        res.status(200).json(students);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/students', async (req, res) => {
    try {
        const { name, pin } = req.body;
        const rollNumber = 'STU' + Math.floor(1000 + Math.random() * 9000);
        
        const newStudent = new User({
            name,
            secret: pin,
            pin: pin,
            identifier: rollNumber,
            rollNumber: rollNumber,
            role: 'student'
        });
        await newStudent.save();
        res.status(201).json({ message: "Student created", student: newStudent });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/students/:id/pin', async (req, res) => {
    try {
        const { pin } = req.body;
        await User.findOneAndUpdate({ rollNumber: req.params.id }, { secret: pin, pin: pin });
        res.status(200).json({ message: "PIN updated successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/students/:id', async (req, res) => {
    try {
        await User.findOneAndDelete({ rollNumber: req.params.id });
        res.status(200).json({ message: "Student deleted" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 3. TEST MANAGEMENT (With Answer Format)
// ==========================================
router.get('/tests', async (req, res) => {
    try {
        const tests = await Test.find().sort({ createdAt: -1 });
        res.status(200).json(tests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/tests', async (req, res) => {
    try {
        const { title, testType, answerFormat, timeLimitMinutes, questions, isActive, availableFrom, dueDate, assignedTo } = req.body;
        
        const processedQuestions = questions.map((q, index) => {
            let correctAns = 0;
            if (testType === 'multiplication') {
                correctAns = q.numbersArray[0] * q.numbersArray[1];
            } else if (testType === 'division') {
                correctAns = q.numbersArray[0] / q.numbersArray[1];
            } else {
                correctAns = q.numbersArray.reduce((sum, num) => sum + num, 0);
            }
            return { questionId: `Q${index + 1}`, numbersArray: q.numbersArray, correctAnswer: correctAns };
        });

        const newTest = new Test({ 
            title, 
            testType: testType || 'addition', 
            answerFormat: answerFormat || 'mcq', // 🔥 Injects Multiple Choice vs Direct Format
            timeLimitMinutes, 
            assignedTo: assignedTo || [], 
            questions: processedQuestions, 
            isActive, 
            availableFrom: availableFrom ? new Date(availableFrom) : null, 
            dueDate: dueDate ? new Date(dueDate) : null 
        });
        
        await newTest.save(); 
        res.status(201).json({ message: "Test saved!", test: newTest });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

router.put('/tests/:id', async (req, res) => {
    try {
        const { title, testType, answerFormat, timeLimitMinutes, questions, isActive, availableFrom, dueDate, assignedTo } = req.body;
        
        const processedQuestions = questions.map((q, index) => {
            let correctAns = 0;
            if (testType === 'multiplication') {
                correctAns = q.numbersArray[0] * q.numbersArray[1];
            } else if (testType === 'division') {
                correctAns = q.numbersArray[0] / q.numbersArray[1];
            } else {
                correctAns = q.numbersArray.reduce((sum, num) => sum + num, 0);
            }
            return { questionId: `Q${index + 1}`, numbersArray: q.numbersArray, correctAnswer: correctAns };
        });
        
        await Test.findByIdAndUpdate(req.params.id, {
            title, 
            testType: testType || 'addition', 
            answerFormat: answerFormat || 'mcq', // 🔥 Injects Multiple Choice vs Direct Format
            timeLimitMinutes, 
            questions: processedQuestions, 
            isActive, 
            assignedTo: assignedTo || [],
            availableFrom: availableFrom ? new Date(availableFrom) : null, 
            dueDate: dueDate ? new Date(dueDate) : null
        });
        res.status(200).json({ message: "Test updated successfully!" });
    } catch (error) { 
        res.status(500).json({ error: "Server error updating test." }); 
    }
});

router.put('/tests/:id/toggle', async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        test.isActive = !test.isActive;
        await test.save();
        res.status(200).json({ message: "Test visibility toggled" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/tests/:id', async (req, res) => {
    try {
        await Test.findByIdAndDelete(req.params.id);
        await Submission.deleteMany({ testId: req.params.id });
        res.status(200).json({ message: "Test and related submissions deleted" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 4. SUBMISSION & GRADING MANAGEMENT
// ==========================================
router.get('/submissions', async (req, res) => {
    try {
        const submissions = await Submission.find().populate('testId', 'title timeLimitMinutes').sort({ submitTime: -1 });
        res.status(200).json(submissions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/submissions/approve-bulk', async (req, res) => {
    try {
        const { submissionIds } = req.body;
        await Submission.updateMany(
            { _id: { $in: submissionIds } }, 
            { $set: { status: 'graded', adminFeedback: "Bulk Approved" } }
        );
        res.status(200).json({ message: "Bulk approval successful" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/submissions/:id/approve', async (req, res) => {
    try {
        const { feedback } = req.body;
        await Submission.findByIdAndUpdate(req.params.id, { status: 'graded', adminFeedback: feedback || "Approved" });
        res.status(200).json({ message: "Submission approved" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/submissions/:id/reset', async (req, res) => {
    try {
        await Submission.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Submission reset successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 5. LEADERBOARD
// ==========================================
router.get('/leaderboard', async (req, res) => {
    try {
        const submissions = await Submission.find({ status: 'graded' }).populate('testId', 'title');
        const grouped = {};
        
        submissions.forEach(sub => {
            if (!sub.testId) return;
            const testName = sub.testId.title;
            if (!grouped[testName]) grouped[testName] = [];
            grouped[testName].push({
                studentName: sub.studentName,
                finalScore: sub.finalScore,
                timeTakenSeconds: sub.timeTakenSeconds
            });
        });

        for (const test in grouped) {
            grouped[test].sort((a, b) => {
                if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
                return a.timeTakenSeconds - b.timeTakenSeconds;
            });
            grouped[test] = grouped[test].slice(0, 3);
        }
        
        res.status(200).json(grouped);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;