const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const validator = require('validator');
const { Server } = require('socket.io');
const connectToDatabase = require('./config/db');
const User = require('./models/user');
const Canvas = require('./models/canvas');
const Comment = require('./models/comment');

const userRoutes = require('./routes/userRoutes');
const canvasRoutes = require("./routes/canvasRoutes");
const profileRoute = require('./routes/profileRoute');

const cors = require('cors');




const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: true,
        methods: ['GET', 'POST']
    }
});
app.set('io', io);

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || !process.env.JWT_SECRET) {
        return next(new Error('Authentication required'));
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!mongoose.isValidObjectId(decoded.userId)) {
            return next(new Error('Invalid authentication token'));
        }
        socket.data.userId = decoded.userId;
        next();
    } catch (error) {
        next(new Error('Invalid authentication token'));
    }
});

io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);

    socket.on('joinCanvas', async (payload, acknowledge) => {
        const respond = typeof acknowledge === 'function' ? acknowledge : () => {};
        const canvasId = payload?.canvasId;
        if (!mongoose.isValidObjectId(canvasId)) {
            respond({ ok: false, error: 'Invalid canvas ID.' });
            return;
        }

        try {
            const canvas = await Canvas.findById(canvasId).select('owner shared');
            if (!canvas) {
                respond({ ok: false, error: 'Canvas not found.' });
                return;
            }
            const userId = socket.data.userId;
            const canAccess = canvas.owner.toString() === userId
                || canvas.shared.some((sharedUserId) => sharedUserId.toString() === userId);
            if (!canAccess) {
                respond({ ok: false, error: 'You do not have access to this canvas.' });
                return;
            }

            if (socket.data.canvasRoom) {
                await socket.leave(socket.data.canvasRoom);
            }
            const room = `canvas:${canvasId}`;
            await socket.join(room);
            socket.data.canvasRoom = room;

            const comments = await Comment.find({ canvas: canvasId })
                .sort({ createdAt: 1 })
                .populate('author', 'first_name last_name name')
                .lean();
            respond({ ok: true, comments: comments.map(serializeComment) });
        } catch (error) {
            console.error('Failed to join canvas comments:', error);
            respond({ ok: false, error: 'Unable to load canvas comments.' });
        }
    });

    socket.on('newComment', async (payload, acknowledge) => {
        const respond = typeof acknowledge === 'function' ? acknowledge : () => {};
        const { canvasId, x, y } = payload || {};
        const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
        if (!mongoose.isValidObjectId(canvasId)) {
            respond({ ok: false, error: 'Invalid canvas ID.' });
            return;
        }
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) {
            respond({ ok: false, error: 'Comment position is invalid.' });
            return;
        }
        if (!text || text.length > 2000) {
            respond({ ok: false, error: 'Comments must contain between 1 and 2000 characters.' });
            return;
        }

        try {
            const canvas = await Canvas.findById(canvasId).select('owner shared');
            if (!canvas) {
                respond({ ok: false, error: 'Canvas not found.' });
                return;
            }
            const userId = socket.data.userId;
            const canAccess = canvas.owner.toString() === userId
                || canvas.shared.some((sharedUserId) => sharedUserId.toString() === userId);
            if (!canAccess) {
                respond({ ok: false, error: 'You do not have access to this canvas.' });
                return;
            }

            const comment = await Comment.create({
                canvas: canvasId,
                author: userId,
                x,
                y,
                text
            });
            const savedComment = await Comment.findById(comment._id)
                .populate('author', 'first_name last_name name')
                .lean();
            const serializedComment = serializeComment(savedComment);
            io.to(`canvas:${canvasId}`).emit('newComment', serializedComment);
            respond({ ok: true, comment: serializedComment });
        } catch (error) {
            console.error('Failed to save canvas comment:', error);
            respond({ ok: false, error: 'Unable to save this comment.' });
        }
    });

    socket.on('shareCanvas', async (payload, acknowledge) => {
        const respond = typeof acknowledge === 'function' ? acknowledge : () => {};
        const canvasId = payload?.canvasId;
        const email = typeof payload?.email === 'string' ? payload.email.trim() : '';

        if (!mongoose.isValidObjectId(canvasId)) {
            respond({ ok: false, code: 'INVALID_CANVAS', error: 'Canvas not found.' });
            return;
        }
        if (!validator.isEmail(email)) {
            respond({ ok: false, code: 'INVALID_EMAIL', error: 'Enter a valid email address.' });
            return;
        }

        try {
            const canvas = await Canvas.findById(canvasId);
            if (!canvas) {
                respond({ ok: false, code: 'CANVAS_NOT_FOUND', error: 'Canvas not found.' });
                return;
            }
            if (canvas.owner.toString() !== socket.data.userId) {
                respond({ ok: false, code: 'FORBIDDEN', error: 'Only the canvas owner can share it.' });
                return;
            }

            const user = await User.findOne({
                email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
            });
            if (!user) {
                respond({ ok: false, code: 'USER_NOT_FOUND', error: 'No account was found with that email.' });
                return;
            }
            if (user._id.toString() === socket.data.userId) {
                respond({ ok: false, code: 'ALREADY_OWNER', error: 'You already own this canvas.' });
                return;
            }

            const alreadyShared = canvas.shared.some(
                (sharedUserId) => sharedUserId.toString() === user._id.toString()
            );
            if (!alreadyShared) {
                canvas.shared.push(user._id);
                await canvas.save();
            }

            io.to(`user:${user._id.toString()}`).emit('canvasShared', {
                _id: canvas._id.toString(),
                name: canvas.name,
                owner: canvas.owner.toString(),
                createdAt: canvas.createdAt
            });
            respond({
                ok: true,
                alreadyShared,
                message: alreadyShared ? 'This canvas is already shared with that user.' : 'Canvas shared successfully.'
            });
        } catch (error) {
            console.error('Failed to share canvas:', error);
            respond({ ok: false, code: 'SERVER_ERROR', error: 'Unable to share the canvas right now.' });
        }
    });
});

function serializeComment(comment) {
    const author = comment.author || {};
    return {
        _id: comment._id.toString(),
        canvasId: comment.canvas.toString(),
        x: comment.x,
        y: comment.y,
        text: comment.text,
        createdAt: comment.createdAt,
        author: {
            id: author._id?.toString(),
            name: [author.first_name, author.last_name].filter(Boolean).join(' ')
                || author.name
                || 'User'
        }
    };
}

app.use('/api/users', userRoutes);
app.use("/api/canvas", canvasRoutes);
app.use('/api', profileRoute);

app.use((req, res) => {
    res.status(404).json({ error: 'API route not found' });
});

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return res.status(400).json({ error: 'Invalid JSON request body' });
    }
    console.error(error);
    return res.status(500).json({ error: 'An unexpected server error occurred' });
});

connectToDatabase();

server.listen(3030, () => {
    console.log('Server is running on port 3030.');
});







// const myMiddleware = (req, res, next) => {
//   console.log('This is my middleware');
//   next();  // Pass control to the next middleware
// };

// // Use the custom middleware
// app.use(myMiddleware);


// app.get('/', (req, res) => {
//   res.send('Successful response.');
// });

// app.get("/about", (req, res) => {
//     console.log('LISTENED on port 5030.');
// 	res.send("This is the about page");
// });

// app.post('/submit', (req, res) => {
//     const { name, email } = req.body;     
//     res.status(200).send(`Submitted - ${name}`);
// });
