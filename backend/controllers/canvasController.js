const Canvas = require('../models/canvas');
const mongoose = require('mongoose');
const isSharedWithUser = (canvas, userId) => (
    canvas.shared.some((sharedUserId) => sharedUserId.toString() === userId)
);
const isInvalidCanvasId = (id) => !mongoose.isValidObjectId(id);

exports.getUserCanvases = async (req, res) => {
    try {
        const userId = req.userId;

        const canvases = await Canvas.find({
            $or: [{ owner: userId }, { shared: userId }]
        }).sort({ createdAt: -1 });

        res.json(canvases);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch canvases" });
    }
};

exports.loadCanvas = async (req, res) => {
    try {
        const canvasId = req.params.id;
        const userId = req.userId;
        if (isInvalidCanvasId(canvasId)) {
            return res.status(400).json({ error: "Invalid canvas ID" });
        }

        const canvas = await Canvas.findById(canvasId);
        if (!canvas) {
            return res.status(404).json({ error: "Canvas not found" });
        }

        // Ensure only the owner or shared users can access it
        if (canvas.owner.toString() !== userId && !isSharedWithUser(canvas, userId)) {
            return res.status(403).json({ error: "Unauthorized to access this canvas" });
        }

        res.json(canvas);
    } catch (error) {
        res.status(500).json({ error: "Failed to load canvas" });
    }
};


exports.createCanvas = async (req, res) => {
    try {
        const userId = req.userId;

        const newCanvas = new Canvas({
            name: "Untitled canvas",
            owner: userId,
            shared: [],
            elements: []
        });

        await newCanvas.save();
        res.status(201).json({
            message: "Canvas created successfully",
            canvasId: newCanvas._id,
            name: newCanvas.name
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to create canvas" });
    }
};


exports.updateCanvas = async (req, res) => {
    try {
        const { canvasId, elements } = req.body;
        const userId = req.userId;
        if (!canvasId || !Array.isArray(elements)) {
            return res.status(400).json({ error: "canvasId and an elements array are required" });
        }
        if (isInvalidCanvasId(canvasId)) {
            return res.status(400).json({ error: "Invalid canvas ID" });
        }

        const canvas = await Canvas.findById(canvasId);
        if (!canvas) {
            return res.status(404).json({ error: "Canvas not found" });
        }

        // Ensure only the owner or shared users can update
        if (canvas.owner.toString() !== userId && !isSharedWithUser(canvas, userId)) {
            return res.status(403).json({ error: "Unauthorized to update this canvas" });
        }

        canvas.elements = elements;
        await canvas.save();

        res.json({ message: "Canvas updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to update canvas" });
    }
};

exports.renameCanvas = async (req, res) => {
    try {
        const { canvasId, name } = req.body;
        if (!canvasId || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({ error: "canvasId and a non-empty name are required" });
        }
        if (name.trim().length > 20) {
            return res.status(400).json({ error: "Canvas name must be 18 characters or fewer" });
        }
        if (isInvalidCanvasId(canvasId)) {
            return res.status(400).json({ error: "Invalid canvas ID" });
        }

        const canvas = await Canvas.findById(canvasId);
        if (!canvas) {
            return res.status(404).json({ error: "Canvas not found" });
        }
        if (canvas.owner.toString() !== req.userId) {
            return res.status(403).json({ error: "Only the owner can rename this canvas" });
        }

        canvas.name = name.trim();
        await canvas.save();
        res.json({ message: "Canvas renamed successfully", name: canvas.name });
    } catch (error) {
        res.status(500).json({ error: "Failed to rename canvas" });
    }
};

exports.deleteCanvas = async (req, res) => {
    try {
        const canvasId = req.params.canvasId;
        const userId = req.userId;
        if (isInvalidCanvasId(canvasId)) {
            return res.status(400).json({ error: "Invalid canvas ID" });
        }

        const canvas = await Canvas.findById(canvasId);
        if (!canvas) {
            return res.status(404).json({ error: "Canvas not found" });
        }

        if (canvas.owner.toString() === userId) {
            await Canvas.findByIdAndDelete(canvasId);
            return res.json({ message: "Canvas deleted successfully", deleted: true });
        }

        if (!isSharedWithUser(canvas, userId)) {
            return res.status(403).json({ error: "You do not have access to this canvas" });
        }

        canvas.shared = canvas.shared.filter(
            (sharedUserId) => sharedUserId.toString() !== userId
        );
        await canvas.save();
        return res.json({ message: "Canvas removed from your shared list", deleted: false });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete canvas" });
    }
};
