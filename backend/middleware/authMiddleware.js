const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  // 1. Check if the frontend sent a token in the request headers
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: "Access Denied. No token provided." });

  try {
    // 2. Verify the token using your secret password
    const verified = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
    
    // 3. Attach the user's ID to the request so the route knows who is asking
    req.user = verified; 
    
    // 4. Tell the bouncer to let them through to the actual route
    next(); 
  } catch (error) {
    res.status(400).json({ error: "Invalid Token." });
  }
};

module.exports = verifyToken;