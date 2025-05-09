import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Proxy endpoint for Jisho word search
router.get('/search/words', async (req, res) => {
    try {
        const query = req.query.keyword;
        console.log('Received word search request for:', query);

        if (!query) {
            console.error('Missing keyword parameter');
            return res.status(400).json({ error: 'Missing keyword parameter' });
        }

        console.log('Fetching from Jisho API:', `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(query)}`);
        const response = await fetch(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(query)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Jisho API error:', response.status, errorText);
            return res.status(response.status).json({ error: `Jisho API error: ${errorText}` });
        }

        const data = await response.json();
        console.log('Successfully fetched data from Jisho');
        res.json(data);
    } catch (error) {
        console.error('Error in word search endpoint:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

export default router;
