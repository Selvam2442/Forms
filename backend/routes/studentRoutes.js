const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Import your database models
const User = require('../models/User');
const Test = require('../models/Test');
const Submission = require('../models/Submission');

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================
// This checks the student's digital ID card to ensure they are logged in
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ error: "Access Denied. No token provided." });

    const token = authHeader.split(' ')[1]; // Extract token from "Bearer <token>"
    if (!token) return res.status(403).json({ error: "Access Denied. Invalid token format." });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified; // Attach the user data (like userId) to the request
        next();
    } catch (error) {
        res.status(401).json({ error: "Invalid or expired token." });
    }
};


// ==========================================
// 1. FETCH AVAILABLE TESTS
// ==========================================
// Route: GET /api/student/tests
// Purpose: Fetch tests assigned to the student OR available to everyone
router.get('/tests', verifyToken, async (req, res) => {
    try {
        const student = await User.findById(req.user.userId);
        if (!student) return res.status(404).json({ error: "Student not found." });

        const rollNumber = student.rollNumber;

        // Find tests assigned specifically to this roll number OR tests for everyone ($size: 0)
        const assignedTests = await Test.find({ 
            isActive: true, 
            $or: [
                { assignedTo: rollNumber },
                { assignedTo: { $size: 0 } }
            ]
        });

        // Filter out the ones they have already submitted
        const submissions = await Submission.find({ studentRollNumber: rollNumber });
        const submittedTestIds = submissions.map(sub => sub.testId.toString());

        const pendingTests = assignedTests.filter(
            test => !submittedTestIds.includes(test._id.toString())
        );

        res.status(200).json(pendingTests);
    } catch (error) {
        console.error("Error fetching tests:", error);
        res.status(500).json({ error: "Server error fetching tests." });
    }
});


// ==========================================
// 2. SUBMIT TEST & AUTO-GRADE
// ==========================================
// Route: POST /api/student/submit
// Purpose: Receive answers, auto-calculate the score, and save for Admin review
router.post('/submit', verifyToken, async (req, res) => {
    try {
        const { testId, startTime, cheatWarnings, answers } = req.body;
        
        const student = await User.findById(req.user.userId);
        const test = await Test.findById(testId);
        
        if (!student || !test) return res.status(404).json({ error: "Data not found." });

        // --- AUTO GRADING ENGINE ---
        let score = 0;
        
        // Loop through the student's answers and compare them to the actual math
        for (let i = 0; i < answers.length; i++) {
            const studentAns = answers[i].studentAnswer;
            
            // Calculate what the correct sum *should* be for this specific question
            const correctSum = test.questions[i].numbersArray.reduce((total, num) => total + num, 0);
            
            // If they match, grant a point!
            if (studentAns === correctSum) {
                score++;
            }
        }

        // Save the final submission to the database
        const newSubmission = new Submission({
            testId: testId,
            studentRollNumber: student.rollNumber,
            studentName: student.name, 
            startTime: startTime,
            submitTime: new Date().toISOString(),
            cheatWarnings: cheatWarnings || 0,
            finalScore: score,
            answers: answers,
            status: 'pending_review' // Waiting for Admin to approve
        });

        await newSubmission.save();
        
        res.status(201).json({ message: "Test submitted securely!", autoGradedScore: score });
    } catch (error) {
        console.error("Error submitting test:", error);
        res.status(500).json({ error: "Server error during submission." });
    }
});


// ==========================================
// 3. STUDENT HISTORY
// ==========================================
// Route: GET /api/student/history
// Purpose: Fetch the student's past tests, scores, and admin feedback
router.get('/history', verifyToken, async (req, res) => {
    try {
        const student = await User.findById(req.user.userId);
        
        // .populate() automatically swaps the testId for the actual Test Title!
        const submissions = await Submission.find({ studentRollNumber: student.rollNumber })
            .populate('testId', 'title')
            .sort({ submitTime: -1 }); // Newest first
            
        res.status(200).json(submissions);
    } catch (error) {
        console.error("Error fetching history:", error);
        res.status(500).json({ error: "Server error fetching history." });
    }
});


// ==========================================
// 4. REQUEST A RETAKE
// ==========================================
// Route: PUT /api/student/submissions/:id/request-retake
// Purpose: Flags a test so the Admin knows the student wants to try again
router.put('/submissions/:id/request-retake', verifyToken, async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.id);
        if (!submission) return res.status(404).json({ error: "Submission not found." });
        
        // 🛠️ THE FIX FOR OLD DATA: If this is an old test missing a name, fetch and attach it!
        if (!submission.studentName) {
            const student = await User.findOne({ rollNumber: submission.studentRollNumber });
            submission.studentName = student ? student.name : "Unknown Student";
        }

        submission.status = 'retake_requested';
        await submission.save();
        
        res.status(200).json({ message: "Retake requested successfully!" });
    } catch (error) {
        console.error("Error requesting retake:", error);
        res.status(500).json({ error: "Server error requesting retake." });
    }
});


// ==========================================
// 5. GLOBAL LEADERBOARD
// ==========================================
// Route: GET /api/student/leaderboard
// Purpose: Fetch the top 10 highest scores from across the entire center
router.get('/leaderboard', verifyToken, async (req, res) => {
    try {
        const submissions = await Submission.find({ status: 'graded' })
            .populate('testId', 'title')
            .sort({ finalScore: -1, submitTime: 1 });

        const groupedLeaderboard = {};
        submissions.forEach(sub => {
            if (!sub.testId) return; 
            const title = sub.testId.title;
            if (!groupedLeaderboard[title]) groupedLeaderboard[title] = [];
            if (groupedLeaderboard[title].length < 10) {
                groupedLeaderboard[title].push(sub);
            }
        });

        res.status(200).json(groupedLeaderboard);
    } catch (error) {
        res.status(500).json({ error: "Server error fetching leaderboard." });
    }
});

module.exports = router;