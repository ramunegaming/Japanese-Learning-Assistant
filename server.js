import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

// loads the CommonJS Twitch bot script
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

// Favorites endpoints (website full history + today-only bot file — both tiny JSON)
const DATA_FILE = path.join(__dirname, 'favorites.json'); // today only, read by Twitch bot (untouched)
const HISTORY_FILE = path.join(__dirname, 'favorites-history.json'); // full dated history for website
async function ensureFile(file, fallback = '[]') {
    try {
        await fs.access(file);
    } catch (err) {
        if (err.code === 'ENOENT') await fs.writeFile(file, fallback);
    }
}
await ensureFile(DATA_FILE);
await ensureFile(HISTORY_FILE);

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

// Full dated history for the website (tiny). Bot never reads this.
app.get('/api/favorites/history', async (req, res) => {
    try {
        const raw = await fs.readFile(HISTORY_FILE, 'utf8');
        res.json(JSON.parse(raw));
    } catch (err) {
        if (err.code === 'ENOENT') { res.json([]); }
        else res.status(500).json({ error: 'Failed to load history' });
    }
});

app.post('/api/favorites/history', async (req, res) => {
    try {
        const { favorites } = req.body;
        if (!Array.isArray(favorites))
            return res.status(400).json({ error: 'Favorites must be an array' });
        await fs.writeFile(HISTORY_FILE, JSON.stringify(favorites, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save history' });
    }
});

// Study Tracker stats (tiny per-day counters, idle-aware on the client)
const STUDY_FILE = path.join(__dirname, 'study-stats.json');
await ensureFile(STUDY_FILE, '{}');

app.get('/api/study/stats', async (req, res) => {
    try {
        const raw = await fs.readFile(STUDY_FILE, 'utf8');
        res.json(JSON.parse(raw));
    } catch (err) {
        if (err.code === 'ENOENT') { res.json({}); }
        else res.status(500).json({ error: 'Failed to load study stats' });
    }
});

app.post('/api/study/stats', async (req, res) => {
    try {
        const { stats } = req.body;
        if (!stats || typeof stats !== 'object' || Array.isArray(stats))
            return res.status(400).json({ error: 'Stats must be an object' });
        await fs.writeFile(STUDY_FILE, JSON.stringify(stats, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save study stats' });
    }
});

// Mined sentences + grammar notes (tiny personal collections)
const MINES_FILE = path.join(__dirname, 'mined-sentences.json');
const NOTES_FILE = path.join(__dirname, 'grammar-notes.json');
await ensureFile(MINES_FILE);
await ensureFile(NOTES_FILE);

app.get('/api/mines', async (req, res) => {
    try {
        res.json(JSON.parse(await fs.readFile(MINES_FILE, 'utf8')));
    } catch (err) {
        if (err.code === 'ENOENT') { res.json([]); }
        else res.status(500).json({ error: 'Failed to load mines' });
    }
});

app.post('/api/mines', async (req, res) => {
    try {
        const { mines } = req.body;
        if (!Array.isArray(mines)) return res.status(400).json({ error: 'Mines must be an array' });
        await fs.writeFile(MINES_FILE, JSON.stringify(mines, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save mines' });
    }
});

app.get('/api/notes', async (req, res) => {
    try {
        res.json(JSON.parse(await fs.readFile(NOTES_FILE, 'utf8')));
    } catch (err) {
        if (err.code === 'ENOENT') { res.json([]); }
        else res.status(500).json({ error: 'Failed to load notes' });
    }
});

app.post('/api/notes', async (req, res) => {
    try {
        const { notes } = req.body;
        if (!Array.isArray(notes)) return res.status(400).json({ error: 'Notes must be an array' });
        await fs.writeFile(NOTES_FILE, JSON.stringify(notes, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save notes' });
    }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});