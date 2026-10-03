// Theme functionality
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (theme === 'dark') {
        icon.className = 'fas fa-sun';
    } else {
        icon.className = 'fas fa-lightbulb';
    }
}

// Main app functionality
let searchHistory = [];
let favorites = [];
let lastSearchResults = null;

// Word Search functionality
async function handleSearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;

    try {
        const resultsContainer = document.getElementById('search-results');
        resultsContainer.innerHTML = '<p>Searching...</p>';
        resultsContainer.style.display = 'block';

        const response = await fetch(`http://localhost:3001/api/search/words?keyword=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        lastSearchResults = data;
        displayResults(data);
        addToHistory(query);
    } catch (error) {
        console.error('Search error:', error);
        const resultsContainer = document.getElementById('search-results');
        resultsContainer.innerHTML = '<p>Error performing search. Please try again.</p>';
        resultsContainer.style.display = 'block';
    }
}

function displayResults(data) {
    lastSearchResults = data;  // Store the results
    const container = document.getElementById('search-results');
    container.innerHTML = '';
    container.style.display = 'block';
    
    if (!data.data || data.data.length === 0) {
        container.innerHTML = '<p>No results found.</p>';
        return;
    }

    // Get fresh favorites from localStorage
    favorites = JSON.parse(localStorage.getItem('favorites') || '[]');

    data.data.forEach(entry => {
        const wordDiv = document.createElement('div');
        wordDiv.className = 'word-card';

        // Japanese word and reading
        const wordHeader = document.createElement('h3');
        const word = entry.japanese[0].word || entry.japanese[0].reading;
        const reading = entry.japanese[0].reading;
        wordHeader.textContent = word;
        if (reading && word !== reading) {
            wordHeader.textContent += ` (${reading})`;
        }
        wordDiv.appendChild(wordHeader);

        // English definitions
        const definitionsList = document.createElement('ul');
        entry.senses.forEach(sense => {
            const defItem = document.createElement('li');
            defItem.textContent = sense.english_definitions.join(', ');
            definitionsList.appendChild(defItem);
        });
        wordDiv.appendChild(definitionsList);

        // Favorite button
        const favoriteButton = document.createElement('button');
        favoriteButton.className = 'favorite-button';
        const isFavorite = favorites.some(f => f.word === word);
        favoriteButton.textContent = isFavorite ? '★' : '☆';
        favoriteButton.addEventListener('click', () => toggleFavorite(word, reading, entry.senses[0].english_definitions.join(', ')));
        wordDiv.appendChild(favoriteButton);

        container.appendChild(wordDiv);
    });
}

// History functionality
function addToHistory(query) {
    searchHistory.unshift(query);
    if (searchHistory.length > 10) {
        searchHistory.pop();
    }
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    historyList.style.display = 'block';

    if (searchHistory.length === 0) {
        historyList.innerHTML = '<p>No search history</p>';
        return;
    }

    searchHistory.forEach(query => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const queryText = document.createElement('span');
        queryText.textContent = query;
        historyItem.appendChild(queryText);
        
        const searchButton = document.createElement('button');
        searchButton.textContent = 'Search';
        searchButton.addEventListener('click', () => {
            document.getElementById('search-input').value = query;
            handleSearch();
            showPage('search');
        });
        historyItem.appendChild(searchButton);
        
        historyList.appendChild(historyItem);
    });
}

// Favorites functionality
function cleanMeaning(meaning) {
    return meaning.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

async function toggleFavorite(word, reading, meaning, date) {
    // Date-aware toggle. From search: toggles today's entry. From list: toggles that day's entry.
    favorites = getStoredFavorites();
    const targetDate = date || getTodayKey();

    // Check if word is already in favorites (same word + same date)
    const index = favorites.findIndex(f => f.word === word && (f.date || getTodayKey()) === targetDate);

    if (index !== -1) {
        // Remove from favorites (frees storage + drops from flashcard checklist)
        const removed = favorites[index];
        favorites.splice(index, 1);
        setupChecked.delete(favKey(removed));
        await syncFavoritesToServer(favorites);
    } else {
        // Unlimited on website — bot stays spam-safe via today-only sync + its slice(-5)
        const cleanedMeaning = cleanMeaning(meaning);
        const entry = { word, reading, meaning: cleanedMeaning, date: targetDate };
        favorites.push(entry);
        setupChecked.add(favKey(entry));
        await syncFavoritesToServer(favorites);
    }

    // Update localStorage
    localStorage.setItem('favorites', JSON.stringify(favorites));

    // Keep day selection valid
    const dates = getFavDates();
    if (selectedFavDate && !dates.includes(selectedFavDate)) {
        selectedFavDate = dates.length > 0 ? dates[dates.length - 1] : null;
    }
    if (setupBrowseDate && !dates.includes(setupBrowseDate)) {
        setupBrowseDate = selectedFavDate || (dates.length > 0 ? dates[dates.length - 1] : null);
    }

    // Update displays
    updateFavoritesDisplay();
    if (flashcardsMode) renderFlashcardsChecklist();

    // Update the star button that was clicked
    if (lastSearchResults) {
        displayResults(lastSearchResults);
    }
}

function renderDateTabs(stripId, carouselId, dates, activeDate, onPick) {
    const carousel = document.getElementById(carouselId);
    const strip = document.getElementById(stripId);
    if (!carousel || !strip) return;
    const favs = getStoredFavorites();
    if (dates.length === 0) {
        carousel.hidden = true;
        return;
    }
    carousel.hidden = false;
    strip.innerHTML = '';
    dates.forEach(d => {
        const count = favs.filter(f => f.date === d).length;
        const tab = document.createElement('button');
        tab.className = 'date-tab' + (d === activeDate ? ' active' : '');
        tab.innerHTML = '';
        const label = document.createElement('span');
        label.textContent = formatDateLabel(d);
        const cnt = document.createElement('span');
        cnt.className = 'date-count';
        cnt.textContent = ` (${count})`;
        tab.appendChild(label);
        tab.appendChild(cnt);
        tab.addEventListener('click', () => onPick(d));
        strip.appendChild(tab);
    });
}

function scrollStrip(stripId, dir) {
    const strip = document.getElementById(stripId);
    if (!strip) return;
    const amount = Math.max(strip.clientWidth * 0.7, 160) * dir;
    const atStart = strip.scrollLeft <= 1;
    const atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1;
    if ((dir < 0 && atStart) || (dir > 0 && atEnd)) {
        // loop around
        strip.scrollTo({ left: dir > 0 ? 0 : strip.scrollWidth, behavior: 'smooth' });
    } else {
        strip.scrollBy({ left: amount, behavior: 'smooth' });
    }
}

function updateFavoritesDisplay() {
    const favoritesList = document.getElementById('favorites-list');
    if (!favoritesList) return;
    favoritesList.innerHTML = ''; // Clear existing favorites

    const allFavs = getStoredFavorites();
    const dates = getFavDates();
    if (!selectedFavDate || !dates.includes(selectedFavDate)) {
        selectedFavDate = dates.length > 0 ? dates[dates.length - 1] : null; // default: most recent
    }
    renderDateTabs('fav-dates-strip', 'fav-dates-carousel', dates, selectedFavDate, (d) => {
        selectedFavDate = d;
        updateFavoritesDisplay();
    });

    const visible = selectedFavDate ? allFavs.filter(f => f.date === selectedFavDate) : [];

    if (visible.length === 0) {
        favoritesList.innerHTML = '<p>No favorites yet. Search and star words to build a deck.</p>';
    }

    visible.forEach(favorite => {
        const li = document.createElement('li');
        li.className = 'favorite-item';
        li.style.textAlign = 'left';  // Ensure left alignment

        // Create the word display container
        const wordContainer = document.createElement('span');
        wordContainer.className = 'word-container';

        // Only show reading in parentheses if the word contains kanji
        const wordDisplay = containsKanji(favorite.word) ?
            `${favorite.word} (${favorite.reading}): ` :
            `${favorite.word}: `;

        // Create text node for word display
        const wordText = document.createTextNode(wordDisplay);
        wordContainer.appendChild(wordText);

        // Create meaning span
        const meaningSpan = document.createElement('span');
        meaningSpan.className = 'meaning';
        meaningSpan.textContent = favorite.meaning;

        // Create remove button (heart again removes + frees storage)
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-favorite';
        removeButton.innerHTML = '<i class="fas fa-heart"></i>';
        removeButton.setAttribute('aria-label', 'Remove favorite');
        removeButton.onclick = () => toggleFavorite(favorite.word, favorite.reading, favorite.meaning, favorite.date);

        // Append elements in order
        li.appendChild(wordContainer);
        li.appendChild(meaningSpan);
        li.appendChild(removeButton);
        favoritesList.appendChild(li);
    });

    // Update the counter: selected day count (unlimited, no /5)
    const counter = document.getElementById('favorites-counter');
    if (counter) {
        counter.textContent = selectedFavDate
            ? `${visible.length} (${formatDateLabel(selectedFavDate)})`
            : '0';
    }
}

// Function to check if a string contains kanji
function containsKanji(str) {
    // Kanji Unicode ranges
    return /[\u4E00-\u9FAF]/.test(str);
}

// Navigation functionality
function showPage(pageId) {
    // Remove active class from all pages and nav items
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    // Add active class to selected page and nav item
    document.getElementById(`${pageId}-page`).classList.add('active');
    document.querySelector(`.nav-item[data-page="${pageId}"]`).classList.add('active');
}

// === Flashcards (Favorites page only) ===
let flashcardsMode = false; // false = list, true = setup/viewer
let flashcardsDeck = [];
let flashcardsIndex = 0;

function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function getTodayKey() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

function formatDateLabel(key) {
    // "2026-10-03" -> "3rd Oct"
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const parts = String(key).split('-');
    if (parts.length < 3) return key;
    const dayNum = parseInt(parts[2], 10);
    const mon = months[parseInt(parts[1], 10) - 1] || '';
    const suffix = (dayNum === 1 || dayNum === 21 || dayNum === 31) ? 'st'
        : (dayNum === 2 || dayNum === 22) ? 'nd'
        : (dayNum === 3 || dayNum === 23) ? 'rd' : 'th';
    return `${dayNum}${suffix} ${mon}`;
}

function favKey(f) {
    return `${f.date || ''}|${f.word || ''}|${f.reading || ''}`;
}

function getStoredFavorites() {
    let favs = [];
    try {
        favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    } catch (e) {
        favs = [];
    }
    if (!Array.isArray(favs)) return [];
    const today = getTodayKey();
    let changed = false;
    favs.forEach(f => {
        if (!f.date) { f.date = today; changed = true; }
    });
    if (changed) {
        try { localStorage.setItem('favorites', JSON.stringify(favs)); } catch (e) {}
    }
    return favs;
}

function getFavDates() {
    const favs = getStoredFavorites();
    const dates = [...new Set(favs.map(f => f.date))];
    dates.sort(); // oldest first
    return dates;
}

let selectedFavDate = null; // favorites list view: single day
let setupBrowseDate = null; // flashcard setup: browsed day
let setupChecked = new Set(); // favKeys accumulated across days

async function syncFavoritesToServer(allFavs) {
    const today = getTodayKey();
    const todayOnly = allFavs.filter(f => f.date === today);
    try {
        await fetch('/api/favorites/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ favorites: todayOnly })
        });
    } catch (e) {
        console.warn('Today sync failed', e);
    }
    try {
        await fetch('/api/favorites/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ favorites: allFavs })
        });
    } catch (e) {
        console.warn('History sync failed', e);
    }
}

async function loadHistoryFromServer() {
    try {
        const local = getStoredFavorites();
        if (local.length > 0) return;
        const res = await fetch('/api/favorites/history');
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            localStorage.setItem('favorites', JSON.stringify(data));
            favorites = data;
        }
    } catch (e) {
        console.warn('History load failed', e);
    }
}

function setFlashcardsMode(on) {
    flashcardsMode = on;
    const listWrap = document.getElementById('favorites-list-wrap');
    const setup = document.getElementById('flashcards-setup');
    const viewer = document.getElementById('flashcards-viewer');
    const toggle = document.getElementById('flashcards-toggle');
    const favCar = document.getElementById('fav-dates-carousel');
    const fcCar = document.getElementById('fc-dates-carousel');
    if (!listWrap || !setup || !viewer) return;
    if (on) {
        listWrap.hidden = true;
        setup.hidden = false;
        viewer.hidden = true;
        if (favCar) favCar.hidden = true;
        if (toggle) toggle.classList.add('active');
        renderFlashcardsChecklist();
    } else {
        listWrap.hidden = false;
        setup.hidden = true;
        viewer.hidden = true;
        if (fcCar) fcCar.hidden = true;
        if (toggle) toggle.classList.remove('active');
        updateFavoritesDisplay();
    }
}

function renderFlashcardsChecklist() {
    const box = document.getElementById('flashcards-checklist');
    const begin = document.getElementById('flashcards-begin');
    if (!box) return;
    const allFavs = getStoredFavorites();
    const dates = getFavDates();
    if (allFavs.length === 0) {
        const fcCar = document.getElementById('fc-dates-carousel');
        if (fcCar) fcCar.hidden = true;
        box.innerHTML = '<p>No favorites yet. Search and star words to build a deck.</p>';
        if (begin) begin.disabled = true;
        return;
    }
    if (!setupBrowseDate || !dates.includes(setupBrowseDate)) {
        setupBrowseDate = selectedFavDate || dates[dates.length - 1];
    }
    // Seed checked set on first open (all words), preserve across date switches
    if (setupChecked.size === 0) {
        allFavs.forEach(f => setupChecked.add(favKey(f)));
    }
    // Prune keys removed via unfavorite (frees storage + checklist)
    [...setupChecked].forEach(k => {
        if (!allFavs.some(f => favKey(f) === k)) setupChecked.delete(k);
    });
    renderDateTabs('fc-dates-strip', 'fc-dates-carousel', dates, setupBrowseDate, (d) => {
        setupBrowseDate = d;
        renderFlashcardsChecklist();
    });
    const dayFavs = allFavs.filter(f => f.date === setupBrowseDate);
    box.innerHTML = '';
    if (dayFavs.length === 0) {
        box.innerHTML = '<p>No words on this date.</p>';
    }
    dayFavs.forEach((fav) => {
        const key = favKey(fav);
        const row = document.createElement('label');
        row.className = 'fc-check-row';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = setupChecked.has(key);
        cb.dataset.key = key;
        cb.addEventListener('change', () => {
            if (cb.checked) setupChecked.add(key);
            else setupChecked.delete(key);
            updateBeginState();
        });
        const wordSpan = document.createElement('span');
        wordSpan.className = 'fc-word';
        wordSpan.textContent = fav.word;
        const meanSpan = document.createElement('span');
        meanSpan.className = 'fc-meaning';
        meanSpan.textContent = `(${fav.reading}) — ${fav.meaning}`;
        row.appendChild(cb);
        row.appendChild(wordSpan);
        row.appendChild(meanSpan);
        box.appendChild(row);
    });
    updateBeginState();

    function updateBeginState() {
        const b = document.getElementById('flashcards-begin');
        if (b) {
            b.disabled = setupChecked.size === 0;
            b.textContent = setupChecked.size === 0 ? 'Begin' : `Begin (${setupChecked.size})`;
        }
    }
}

function getCheckedFavorites() {
    const allFavs = getStoredFavorites();
    if (setupChecked.size === 0) return [];
    return allFavs.filter(f => setupChecked.has(favKey(f)));
}

async function enrichFavorite(fav) {
    // Favorites only store word/reading/meaning. Look up POS / JLPT / common on demand.
    const enriched = { ...fav, pos: [], jlpt: null, is_common: false, kanji: null };
    try {
        const res = await fetch(`/api/search/words?keyword=${encodeURIComponent(fav.word)}`);
        if (!res.ok) return enriched;
        const data = await res.json();
        const entries = data.data || [];
        // Prefer exact headword match, else first entry
        let match = entries.find(e => (e.japanese || []).some(j => j.word === fav.word))
            || entries.find(e => (e.japanese || []).some(j => j.reading === fav.reading))
            || entries[0];
        if (!match) return enriched;
        enriched.is_common = !!match.is_common;
        if (Array.isArray(match.jlpt) && match.jlpt.length > 0) enriched.jlpt = match.jlpt[0];
        else if (match.tags && match.tags.length > 0) {
            const jlptTag = match.tags.find(t => /^jlpt-/i.test(t) || /^n[1-5]$/i.test(t));
            if (jlptTag) enriched.jlpt = jlptTag;
        }
        const senses = match.senses || [];
        const posSet = [];
        senses.slice(0, 3).forEach(s => {
            (s.parts_of_speech || []).forEach(p => {
                if (/^wikipedia definition$/i.test(String(p).trim())) return;
                if (!posSet.includes(p)) posSet.push(p);
            });
        });
        enriched.pos = posSet.slice(0, 4);
        // Backfill missing reading/meaning if empty
        if (!enriched.reading && match.japanese && match.japanese[0]) {
            enriched.reading = match.japanese[0].reading || '';
        }
        if (!enriched.meaning && senses[0]) {
            enriched.meaning = (senses[0].english_definitions || []).slice(0, 3).join(', ');
        }
    } catch (e) {
        console.warn('Enrich failed for', fav.word, e);
    }
    // Single-kanji cards: fetch all kun/on readings for reference (kanjiapi.dev)
    if (/^[\u4E00-\u9FAF]$/.test(String(fav.word || ''))) {
        try {
            const kRes = await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(fav.word)}`);
            if (kRes.ok) {
                const k = await kRes.json();
                enriched.kanji = {
                    kun: Array.isArray(k.kun_readings) ? k.kun_readings : [],
                    on: Array.isArray(k.on_readings) ? k.on_readings : [],
                    meanings: Array.isArray(k.meanings) ? k.meanings : [],
                    grade: k.grade ?? null,
                    strokes: k.stroke_count ?? null,
                    jlpt: k.jlpt ?? null
                };
                if (!enriched.jlpt && enriched.kanji.jlpt) {
                    enriched.jlpt = 'jlpt-n' + enriched.kanji.jlpt;
                }
            }
        } catch (e) {
            console.warn('Kanji enrich failed for', fav.word, e);
        }
    }
    return enriched;
}

async function beginFlashcards() {
    const selected = getCheckedFavorites();
    if (selected.length === 0) return;
    const begin = document.getElementById('flashcards-begin');
    if (begin) { begin.disabled = true; begin.textContent = 'Loading...'; }
    const enriched = [];
    for (const fav of selected) {
        enriched.push(await enrichFavorite(fav));
    }
    if (begin) { begin.disabled = false; begin.textContent = 'Begin'; }
    flashcardsDeck = shuffleArray(enriched);
    flashcardsIndex = 0;
    const setup = document.getElementById('flashcards-setup');
    const viewer = document.getElementById('flashcards-viewer');
    const fcCar = document.getElementById('fc-dates-carousel');
    if (setup) setup.hidden = true;
    if (viewer) viewer.hidden = false;
    if (fcCar) fcCar.hidden = true;
    showFlashcard();
}

function showFlashcard() {
    const card = document.getElementById('flashcard');
    const jp = document.getElementById('flashcard-jp');
    const reading = document.getElementById('flashcard-reading');
    const meaning = document.getElementById('flashcard-meaning');
    const tags = document.getElementById('flashcard-tags');
    const kanjiBox = document.getElementById('flashcard-kanji');
    const status = document.getElementById('flashcard-status');
    if (!card || !jp) return;
    if (flashcardsDeck.length === 0) return;
    const item = flashcardsDeck[flashcardsIndex];
    card.classList.add('no-anim');
    card.classList.remove('flipped');
    void card.offsetWidth;
    card.classList.remove('no-anim');
    jp.textContent = item.word; // Japanese side: headword only (kanji + okurigana as saved)
    if (reading) reading.textContent = item.reading || '';
    if (meaning) meaning.textContent = item.meaning || '';
    if (kanjiBox) {
        kanjiBox.innerHTML = '';
        if (item.kanji && (item.kanji.kun.length > 0 || item.kanji.on.length > 0)) {
            const meta = [];
            if (item.kanji.strokes) meta.push(`${item.kanji.strokes} strokes`);
            if (item.kanji.jlpt) meta.push(`JLPT N${item.kanji.jlpt}`);
            else if (item.jlpt) meta.push(String(item.jlpt).replace('jlpt-', 'JLPT ').replace('jlpt ', 'JLPT '));
            if (item.kanji.grade) meta.push(`grade ${item.kanji.grade}`);
            if (meta.length > 0) {
                const metaDiv = document.createElement('div');
                metaDiv.className = 'fc-kanji-meta';
                metaDiv.textContent = meta.join('. ');
                kanjiBox.appendChild(metaDiv);
            }
            if (item.kanji.kun.length > 0) {
                const kunDiv = document.createElement('div');
                kunDiv.className = 'fc-kanji-row';
                const label = document.createElement('span');
                label.className = 'fc-kanji-label';
                label.textContent = 'Kun: ';
                kunDiv.appendChild(label);
                kunDiv.appendChild(document.createTextNode(item.kanji.kun.join(', ')));
                kanjiBox.appendChild(kunDiv);
            }
            if (item.kanji.on.length > 0) {
                const onDiv = document.createElement('div');
                onDiv.className = 'fc-kanji-row';
                const label = document.createElement('span');
                label.className = 'fc-kanji-label';
                label.textContent = 'On: ';
                onDiv.appendChild(label);
                onDiv.appendChild(document.createTextNode(item.kanji.on.join(', ')));
                kanjiBox.appendChild(onDiv);
            }
        }
    }
    if (tags) {
        tags.innerHTML = '';
        (item.pos || []).forEach(p => {
            const t = document.createElement('span');
            t.className = 'fc-tag fc-tag-pos';
            t.textContent = p;
            tags.appendChild(t);
        });
        if (item.is_common) {
            const t = document.createElement('span');
            t.className = 'fc-tag fc-tag-common';
            t.textContent = 'common word';
            tags.appendChild(t);
        }
        if (item.jlpt) {
            const t = document.createElement('span');
            t.className = 'fc-tag fc-tag-jlpt';
            let label = String(item.jlpt).toLowerCase();
            if (label.startsWith('jlpt-')) label = 'jlpt ' + label.slice(5);
            if (/^n[1-5]$/.test(label)) label = 'jlpt ' + label;
            t.textContent = label;
            tags.appendChild(t);
        }
    }
    if (status) status.textContent = `${flashcardsIndex + 1} / ${flashcardsDeck.length}`;
    updateFlashcardStar();
}

function flipFlashcard() {
    const card = document.getElementById('flashcard');
    if (card) card.classList.toggle('flipped');
}

function nextFlashcard() {
    if (flashcardsDeck.length === 0) return;
    flashcardsIndex = (flashcardsIndex + 1) % flashcardsDeck.length;
    showFlashcard();
}

function speakFlashcard(e) {
    if (e) e.stopPropagation();
    if (flashcardsDeck.length === 0) return;
    const item = flashcardsDeck[flashcardsIndex];
    try {
        const utter = new SpeechSynthesisUtterance(item.word);
        utter.lang = 'ja-JP';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
    } catch (err) {
        console.warn('TTS failed', err);
    }
}

function updateFlashcardStar() {
    const star = document.getElementById('flashcard-star');
    if (!star || flashcardsDeck.length === 0) return;
    const item = flashcardsDeck[flashcardsIndex];
    const favs = getStoredFavorites();
    const stillFav = favs.some(f => f.word === item.word && (f.date || '') === (item.date || ''));
    star.style.color = stillFav ? '#e6a817' : '#a0aec0';
}

async function starFlashcard(e) {
    if (e) e.stopPropagation();
    if (flashcardsDeck.length === 0) return;
    const item = flashcardsDeck[flashcardsIndex];
    await toggleFavorite(item.word, item.reading, item.meaning, item.date);
    updateFlashcardStar();
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    initTheme();

    // Load search history
    searchHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    updateHistoryDisplay();

    // Load favorites (restore server history if this browser is empty)
    favorites = getStoredFavorites();
    updateFavoritesDisplay();
    loadHistoryFromServer().then(() => {
        favorites = getStoredFavorites();
        updateFavoritesDisplay();
        if (flashcardsMode) renderFlashcardsChecklist();
    });
    
    // Add event listeners
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('search-button').addEventListener('click', handleSearch);
    document.getElementById('search-input').addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSearch();
        }
    });
    
    // Navigation event listeners
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (event) => {
            event.preventDefault();
            const pageId = item.getAttribute('data-page');
            showPage(pageId);
        });
    });

    // Flashcards (favorites page only)
    const fcToggle = document.getElementById('flashcards-toggle');
    if (fcToggle) fcToggle.addEventListener('click', () => setFlashcardsMode(!flashcardsMode));
    const fcBegin = document.getElementById('flashcards-begin');
    if (fcBegin) fcBegin.addEventListener('click', beginFlashcards);
    const fcCard = document.getElementById('flashcard');
    if (fcCard) {
        fcCard.addEventListener('click', flipFlashcard);
        fcCard.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipFlashcard(); }
        });
    }
    const fcNext = document.getElementById('flashcard-next');
    if (fcNext) fcNext.addEventListener('click', nextFlashcard);
    const fcSpeak = document.getElementById('flashcard-speak');
    if (fcSpeak) fcSpeak.addEventListener('click', speakFlashcard);
    const fcStar = document.getElementById('flashcard-star');
    if (fcStar) fcStar.addEventListener('click', starFlashcard);
    const fcEdit = document.getElementById('flashcards-edit');
    if (fcEdit) fcEdit.addEventListener('click', () => {
        const setup = document.getElementById('flashcards-setup');
        const viewer = document.getElementById('flashcards-viewer');
        if (setup) setup.hidden = false;
        if (viewer) viewer.hidden = true;
        renderFlashcardsChecklist();
    });

    // Date carousel arrows (looping scroll)
    const favPrev = document.getElementById('fav-dates-prev');
    if (favPrev) favPrev.addEventListener('click', () => scrollStrip('fav-dates-strip', -1));
    const favNext = document.getElementById('fav-dates-next');
    if (favNext) favNext.addEventListener('click', () => scrollStrip('fav-dates-strip', 1));
    const fcPrev = document.getElementById('fc-dates-prev');
    if (fcPrev) fcPrev.addEventListener('click', () => scrollStrip('fc-dates-strip', -1));
    const fcNext2 = document.getElementById('fc-dates-next');
    if (fcNext2) fcNext2.addEventListener('click', () => scrollStrip('fc-dates-strip', 1));
});
