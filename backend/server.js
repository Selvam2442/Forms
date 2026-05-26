require('dotenv').config(); 
const express = require('express'); 
const mongoose = require('mongoose'); 
const cors = require('cors'); 
const User = require('./models/User'); // <-- We imported the User model here

const app = express();

app.use(express.json()); 
app.use(cors()); 

// Routes
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');

app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);       
app.use('/api/student', studentRoutes);

// Connect to Database
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ Successfully connected to MongoDB Atlas!");
    
    // ==========================================
    // SEED THE ADMIN ACCOUNT
    // ==========================================
    const adminExists = await User.findOne({ rollNumber: 'ADMIN' });
    if (!adminExists) {
        const newAdmin = new User({
            name: 'Center Admin',
            rollNumber: 'ADMIN',
            pin: 'aabfc404', 
            role: 'admin'
        });
        await newAdmin.save();
        console.log("👑 Default Admin account automatically created!");
    }
    // ==========================================
    
  })
  .catch((error) => console.error("❌ MongoDB connection failed:", error.message));

// Start Engine
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running live on port ${PORT}`);
});