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

// Serve static files
app.use(express.static(path.join(__dirname, '.')));

// Use the modular routes
app.use('/api', wordRoutes);
app.use('/api', sentenceRoutes);

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
