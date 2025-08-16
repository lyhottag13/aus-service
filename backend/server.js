import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import port from './src/port.js';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dependencies for the app to read user input and to return JSONs.
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.listen(port, '127.0.0.1', () => {
    console.log(`App running on port ${port}`);
});

// END BOILERPLATE.

app.get('/api/name', (req, res) => {
    return res.status(200).json({ message: 'Hey!' });
});

