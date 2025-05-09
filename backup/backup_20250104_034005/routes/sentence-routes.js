import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Proxy endpoint for Jisho sentences search
router.get('/search/sentences', async (req, res) => {
    try {
        const query = req.query.keyword;
        console.log('Received sentence search request for:', query);

        if (!query) {
            console.error('Missing keyword parameter');
            return res.status(400).json({ error: 'Missing keyword parameter' });
        }

        // Use the word search API since it contains sentence examples
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
        
        // Extract sentences from the word data
        const sentences = [];
        if (data && data.data) {
            data.data.forEach(entry => {
                if (entry.senses) {
                    entry.senses.forEach(sense => {
                        if (sense.sentences) {
                            sense.sentences.forEach(sentence => {
                                sentences.push({
                                    japanese: sentence.japanese,
                                    english: sentence.english
                                });
                            });
                        }
                    });
                }
            });
        }

        console.log('Successfully extracted sentences:', sentences);
        res.json({ data: sentences });
    } catch (error) {
        console.error('Error in sentence search endpoint:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

export default router;
