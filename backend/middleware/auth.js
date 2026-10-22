const jwt = require('jsonwebtoken');

exports.authMiddleware = (req, res, next) => {
    const token = req.header("Authorization")?.replace(/^Bearer\s+/i, "");
    
    if (!token) return res.status(401).json({ error: "Access Denied: No Token Provided" });
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ error: "Authentication is not configured" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: "Invalid Token" });
    }
};
