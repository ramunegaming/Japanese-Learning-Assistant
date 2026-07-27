import express from 'express';
import cors from 'cors';
<<<<<<< HEAD
import fs from 'fs/promises';
=======
>>>>>>> origin/main
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

// ✅ Add this block to load the CommonJS Twitch bot script
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('./twitch-bot.cjs'); // Runs your Twitch bot

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

<<<<<<< HEAD
// Favorites endpoints
const DATA_FILE = path.join(__dirname, 'favorites.json');
fs.writeFile(DATA_FILE, JSON.stringify([])).then(() => {
    console.log('Favorites cleared on server start');
});

app.get('/api/favorites', async (req, res) => {
    try {
        const raw = await fs.readFile(DATA_FILE, 'utf8');
        res.json(JSON.parse(raw));
    } catch (err) {
        if (err.code === 'ENOENT') { res.json([]); }
        else res.status(500).json({ error: 'Failed to load favorites' });
    }
});

app.post('/api/favorites/sync', async (req, res) => {
    try {
        const { favorites } = req.body;
        if (!Array.isArray(favorites)) 
            return res.status(400).json({ error: 'Favorites must be an array' });
        await fs.writeFile(DATA_FILE, JSON.stringify(favorites, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to sync favorites' });
    }
});

=======
>>>>>>> origin/main
// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});