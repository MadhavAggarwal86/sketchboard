const express = require('express');
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));


app.get('/', (req, res) => {
  res.send('Successful response.');
});

app.get("/about", (req, res) => {
	res.send("This is the about page");
});

app.post('/submit', (req, res) => {
    const { name, email } = req.body;     
    res.status(200).send("Submitted");
});


app.listen(8000, () => console.log('Example app is listening on port 8000.'));
