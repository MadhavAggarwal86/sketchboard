const express = require('express');
const connectToDatabase = require('./config/db');

const userRoutes = require('./routes/userRoutes');
const canvasRoutes = require("./routes/canvasRoutes");
const profileRoute = require('./routes/profileRoute');

const cors = require('cors');




const app = express();
app.use(cors());
app.use(express.json());

connectToDatabase();

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

app.listen(3030, () => {
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
