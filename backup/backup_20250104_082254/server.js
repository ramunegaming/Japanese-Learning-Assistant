import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

// Import routes
import wordRoutes from './routes/word-routes.js';
import sentenceRoutes from './routes/sentence-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Serve static files from the root directory
app.use(express.static(__dirname));

// Serve node_modules (needed for kuroshiro)
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// Use the modular routes
app.use('/api', wordRoutes);
app.use('/api', sentenceRoutes);

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
