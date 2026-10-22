const express = require('express');
const router = express.Router();
const { loadCanvas, getUserCanvases, createCanvas, updateCanvas, renameCanvas, deleteCanvas } = require("../controllers/canvasController");
const { authMiddleware } = require('../middleware/auth');


router.get("/list", authMiddleware, getUserCanvases);
router.get("/load/:id", authMiddleware, loadCanvas); 
router.post("/create", authMiddleware, createCanvas);
router.put("/update", authMiddleware, updateCanvas); 
router.put("/rename", authMiddleware, renameCanvas);
router.delete("/:canvasId", authMiddleware, deleteCanvas);



module.exports = router;
