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
        logStudy('words');
    } catch (error) {
        console.error('Search error:', error);
        const resultsContainer = document.getElementById('search-results');
        resultsContainer.innerHTML = '<p>Error performing search. Please try again.</p>';
        resultsContainer.style.display = 'block';
    }
}

function speakJapanese(text) {
    if (!text) return;
    try {
        const utter = new SpeechSynthesisUtterance(String(text).replace(/<[^>]*>/g, ''));
        utter.lang = 'ja-JP';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
    } catch (err) {
        console.warn('TTS failed', err);
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

        // Japanese word and reading (+ speaker)
        const headRow = document.createElement('div');
        headRow.className = 'word-head';
        const wordHeader = document.createElement('h3');
        const word = entry.japanese[0].word || entry.japanese[0].reading;
        const reading = entry.japanese[0].reading;
        wordHeader.textContent = word;
        if (reading && word !== reading) {
            wordHeader.textContent += ` (${reading})`;
        }
        const speakBtn = document.createElement('button');
        speakBtn.className = 'word-speak';
        speakBtn.setAttribute('aria-label', 'Play audio');
        speakBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        speakBtn.addEventListener('click', () => speakJapanese(word));
        headRow.appendChild(wordHeader);
        headRow.appendChild(speakBtn);
        wordDiv.appendChild(headRow);

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
        logStudy('favs');
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
    if (pageId === 'tracker' && typeof renderTracker === 'function') renderTracker();
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

let favView = 'list'; // 'list' | 'cards' | 'tests'
let testsMode = false;
let cardsInViewer = false; // cards sub-state: setup vs viewer
let testsInViewer = false; // tests sub-state: modes vs question

function setFavView(view) {
    favView = view;
    flashcardsMode = (view === 'cards');
    testsMode = (view === 'tests');
    const listWrap = document.getElementById('favorites-list-wrap');
    const setup = document.getElementById('flashcards-setup');
    const viewer = document.getElementById('flashcards-viewer');
    const testsSetup = document.getElementById('tests-setup');
    const testsViewer = document.getElementById('tests-viewer');
    const toggle = document.getElementById('flashcards-toggle');
    const ptToggle = document.getElementById('tests-toggle');
    const favCar = document.getElementById('fav-dates-carousel');
    const fcCar = document.getElementById('fc-dates-carousel');
    if (!listWrap || !setup || !viewer) return;
    if (view === 'list') {
        listWrap.hidden = false;
        setup.hidden = true;
        viewer.hidden = true;
        if (testsSetup) testsSetup.hidden = true;
        if (testsViewer) testsViewer.hidden = true;
        if (fcCar) fcCar.hidden = true;
        updateFavoritesDisplay();
    } else if (view === 'cards') {
        listWrap.hidden = true;
        if (testsSetup) testsSetup.hidden = true;
        if (testsViewer) testsViewer.hidden = true;
        if (favCar) favCar.hidden = true;
        if (cardsInViewer && flashcardsDeck.length > 0) {
            setup.hidden = true;
            viewer.hidden = false;
            if (fcCar) fcCar.hidden = true;
        } else {
            cardsInViewer = false;
            setup.hidden = false;
            viewer.hidden = true;
            renderFlashcardsChecklist();
        }
    } else if (view === 'tests') {
        listWrap.hidden = true;
        setup.hidden = true;
        viewer.hidden = true;
        if (favCar) favCar.hidden = true;
        if (fcCar) fcCar.hidden = true;
        if (testsInViewer && testsQuestion) {
            if (testsSetup) testsSetup.hidden = true;
            if (testsViewer) testsViewer.hidden = false;
        } else {
            testsInViewer = false;
            if (testsSetup) testsSetup.hidden = false;
            if (testsViewer) testsViewer.hidden = true;
            renderTestsModes();
        }
    }
    if (toggle) toggle.classList.toggle('active', view === 'cards');
    if (ptToggle) ptToggle.classList.toggle('active', view === 'tests');
}

function setFlashcardsMode(on) {
    // Wrapper: preserve old call sites. If turning on while in tests, switch.
    if (on) setFavView('cards');
    else if (favView === 'cards') setFavView('list');
}

function setTestsMode(on) {
    if (on) setFavView('tests');
    else if (favView === 'tests') setFavView('list');
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
    enriched.freq = await lookupFreq(enriched.word, enriched.reading);
    return enriched;
}

async function beginFlashcards() {
    const selected = getCheckedFavorites();
    if (selected.length === 0) return;
    const begin = document.getElementById('flashcards-begin');
    if (begin) { begin.disabled = true; begin.textContent = 'Loading...'; }
    const enriched = await Promise.all(selected.map(fav => enrichFavorite(fav)));
    if (begin) { begin.disabled = false; begin.textContent = 'Begin'; }
    flashcardsDeck = shuffleArray(enriched);
    flashcardsIndex = 0;
    cardsInViewer = true;
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
        if (item.freq && item.freq.f) {
            const t = document.createElement('span');
            t.className = 'fc-tag fc-tag-freq';
            t.textContent = freqTagText(item.freq);
            tags.appendChild(t);
        }
    }
    if (status) status.textContent = `${flashcardsIndex + 1} / ${flashcardsDeck.length}`;
    updateFlashcardStar();
    logStudy('cards');
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

// === Study Tracker (Anki-style heatmap, idle-aware) ===
let trackerYear = new Date().getFullYear();
let lastActiveTs = Date.now();
const TRACKER_IDLE_MS = 5 * 60 * 1000;

function loadStudyStats() {
    try {
        const s = JSON.parse(localStorage.getItem('studyStats') || '{}');
        return (s && typeof s === 'object') ? s : {};
    } catch (e) { return {}; }
}
function saveStudyStats(s) {
    try { localStorage.setItem('studyStats', JSON.stringify(s)); } catch (e) {}
    try {
        fetch('/api/study/stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stats: s })
        }).catch(() => {});
    } catch (e) {}
}
async function loadStudyStatsFromServer() {
    try {
        const local = loadStudyStats();
        if (Object.keys(local).length > 0) return;
        const res = await fetch('/api/study/stats');
        if (!res.ok) return;
        const data = await res.json();
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
            try { localStorage.setItem('studyStats', JSON.stringify(data)); } catch (e) {}
        }
    } catch (e) {}
}
function dayTotal(d) {
    if (!d) return 0;
    return (d.words || 0) + (d.sentences || 0) + (d.cards || 0) + (d.tests || 0);
}
function logStudy(type, n) {
    n = n || 1;
    lastActiveTs = Date.now();
    const stats = loadStudyStats();
    const k = getTodayKey();
    if (!stats[k]) stats[k] = { words: 0, sentences: 0, cards: 0, tests: 0, correct: 0, favs: 0, activeSec: 0 };
    stats[k][type] = (stats[k][type] || 0) + n;
    saveStudyStats(stats);
    if (favView === undefined || document.getElementById('tracker-page').classList.contains('active')) {
        renderTracker();
    }
}
function fmtActive(sec) {
    sec = sec || 0;
    if (sec < 60) return sec + 's';
    const m = Math.floor(sec / 60);
    if (m < 60) return m + 'm';
    return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
}
function trackerLevel(total, avg) {
    if (total <= 0 || avg <= 0) return 'l0';
    if (total < avg * 0.5) return 'l1';
    if (total < avg) return 'l2';
    if (total < avg * 1.5) return 'l3';
    return 'l4';
}
function computeStreaks(stats) {
    const days = Object.keys(stats).filter(k => dayTotal(stats[k]) > 0).sort();
    if (days.length === 0) return { current: 0, longest: 0 };
    const dayNum = k => Math.round(new Date(k + 'T12:00:00').getTime() / 86400000);
    let longest = 1, run = 1;
    for (let i = 1; i < days.length; i++) {
        if (dayNum(days[i]) - dayNum(days[i - 1]) === 1) run++;
        else { longest = Math.max(longest, run); run = 1; }
    }
    longest = Math.max(longest, run);
    // current streak: ends today or yesterday
    const todayN = Math.round(new Date(getTodayKey() + 'T12:00:00').getTime() / 86400000);
    let current = 0;
    const set = new Set(days);
    let cursor = set.has(getTodayKey()) ? todayN : todayN - 1;
    const keyOf = n => {
        const d = new Date(n * 86400000);
        const d2 = new Date(d.getTime() + new Date().getTimezoneOffset() * 60000);
        return d2.getFullYear() + '-' + String(d2.getMonth() + 1).padStart(2, '0') + '-' + String(d2.getDate()).padStart(2, '0');
    };
    while (set.has(keyOf(cursor))) { current++; cursor--; }
    return { current, longest };
}
function ensureTrackerTip() {
    let tip = document.getElementById('tracker-tip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'tracker-tip';
        tip.className = 'tracker-tip';
        document.body.appendChild(tip);
    }
    return tip;
}
function renderTracker() {
    const grid = document.getElementById('tracker-heatmap');
    if (!grid) return;
    const stats = loadStudyStats();
    const Y = trackerYear;
    // all-time daily average for stable color scale
    const activeDays = Object.keys(stats).filter(k => dayTotal(stats[k]) > 0);
    const grandTotal = activeDays.reduce((a, k) => a + dayTotal(stats[k]), 0);
    const avg = activeDays.length > 0 ? grandTotal / activeDays.length : 0;
    // build weeks: start Sunday on/before Jan 1
    const jan1 = new Date(Y, 0, 1);
    const start = new Date(jan1);
    start.setDate(start.getDate() - start.getDay());
    const dec31 = new Date(Y, 11, 31);
    const weeks = [];
    const cursor = new Date(start);
    while (cursor <= dec31) {
        const week = [];
        for (let i = 0; i < 7; i++) {
            const inYear = cursor.getFullYear() === Y;
            week.push(inYear ? new Date(cursor) : null);
            cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(week);
    }
    const keyOfDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    grid.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'tracker-grid';
    const todayK = getTodayKey();
    const tip = ensureTrackerTip();
    weeks.forEach(week => {
        const col = document.createElement('div');
        col.className = 'tracker-week';
        week.forEach(d => {
            if (!d) {
                const b = document.createElement('span');
                b.className = 'tracker-cell blank';
                col.appendChild(b);
                return;
            }
            const k = keyOfDate(d);
            const total = dayTotal(stats[k]);
            const b = document.createElement('button');
            b.className = 'tracker-cell ' + trackerLevel(total, avg) + (k === todayK ? ' today' : '');
            b.setAttribute('aria-label', `${k}: ${total} actions`);
            b.addEventListener('mouseenter', (e) => {
                const s = stats[k] || {};
                const nice = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                tip.innerHTML = `<strong>${total} actions</strong> on ${nice}<br>words ${s.words || 0} · sentences ${s.sentences || 0}<br>cards ${s.cards || 0} · tests ${s.tests || 0}`;
                tip.style.display = 'block';
                const pad = 12;
                let x = e.clientX + pad, y = e.clientY + pad;
                tip.style.left = Math.min(x, window.innerWidth - 250) + 'px';
                tip.style.top = Math.min(y, window.innerHeight - 90) + 'px';
            });
            b.addEventListener('mousemove', (e) => {
                const pad = 12;
                tip.style.left = Math.min(e.clientX + pad, window.innerWidth - 250) + 'px';
                tip.style.top = Math.min(e.clientY + pad, window.innerHeight - 90) + 'px';
            });
            b.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
            b.addEventListener('click', () => {
                grid.querySelectorAll('.tracker-cell.selected').forEach(c => c.classList.remove('selected'));
                b.classList.add('selected');
                renderTrackerDetail(k);
            });
            col.appendChild(b);
        });
        wrap.appendChild(col);
    });
    grid.appendChild(wrap);
    const yearEl = document.getElementById('tracker-year');
    if (yearEl) yearEl.textContent = Y;
    // summary: today
    const t = stats[todayK] || {};
    const tTotal = dayTotal(t);
    const summary = document.getElementById('tracker-summary');
    if (summary) summary.textContent = `Studied ${tTotal} items (${fmtActive(t.activeSec)} active) today.`;
    // stats footer
    const streaks = computeStreaks(stats);
    const firstDay = activeDays.sort()[0];
    let spanDays = 0;
    if (firstDay) {
        spanDays = Math.round((new Date().getTime() - new Date(firstDay + 'T12:00:00').getTime()) / 86400000) + 1;
    }
    const pct = spanDays > 0 ? Math.round(activeDays.length / spanDays * 100) : 0;
    const statsEl = document.getElementById('tracker-stats');
    if (statsEl) {
        statsEl.innerHTML = '';
        const mk = (label, val) => {
            const s = document.createElement('span');
            s.innerHTML = '';
            s.appendChild(document.createTextNode(label + ': '));
            const b = document.createElement('b');
            b.textContent = val;
            s.appendChild(b);
            return s;
        };
        statsEl.appendChild(mk('Daily average', `${avg ? avg.toFixed(0) : 0} reviews`));
        statsEl.appendChild(mk('Days learned', pct + '%'));
        statsEl.appendChild(mk('Longest streak', streaks.longest + (streaks.longest === 1 ? ' day' : ' days')));
        statsEl.appendChild(mk('Current streak', streaks.current + (streaks.current === 1 ? ' day' : ' days')));
    }
    // Default the detail panel to today (first view only — your clicks win after that)
    const detail = document.getElementById('tracker-detail');
    if (detail && detail.hidden && Y === new Date().getFullYear()) {
        renderTrackerDetail(todayK);
        const todayBtn = grid.querySelector('.tracker-cell.today');
        if (todayBtn) todayBtn.classList.add('selected');
    }
}
function renderTrackerDetail(k) {
    const box = document.getElementById('tracker-detail');
    if (!box) return;
    const stats = loadStudyStats();
    const s = stats[k] || {};
    const d = new Date(k + 'T12:00:00');
    const nice = isNaN(d) ? k : d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    box.hidden = false;
    box.innerHTML = '';
    const h = document.createElement('h3');
    h.textContent = nice;
    const br = document.createElement('div');
    br.className = 'td-break';
    br.textContent = `words ${s.words || 0} · sentences ${s.sentences || 0} · cards ${s.cards || 0} · tests ${s.tests || 0} (correct ${s.correct || 0}) · favs +${s.favs || 0} · active ${fmtActive(s.activeSec)}`;
    box.appendChild(h);
    box.appendChild(br);
    const favs = getStoredFavorites().filter(f => f.date === k);
    if (favs.length > 0) {
        const ul = document.createElement('ul');
        favs.forEach(f => {
            const li = document.createElement('li');
            li.textContent = `${f.word} (${f.reading}) — ${f.meaning}`;
            ul.appendChild(li);
        });
        box.appendChild(ul);
    } else {
        const p = document.createElement('div');
        p.className = 'td-break';
        p.textContent = 'No favorites added this day.';
        box.appendChild(p);
    }
}

// === Tests (P.T prep, Favorites page only — single-kanji pool, Maybe/Certain SRS-lite) ===
const TESTS_MODES = [
    { id: 'kanji-reading', name: 'Kanji → Reading', desc: 'See kanji, pick the full reading set' },
    { id: 'reading-kanji', name: 'Reading → Kanji', desc: 'See reading, pick the kanji' },
    { id: 'kanji-meaning', name: 'Kanji → Meaning', desc: 'See kanji, pick the meaning' },
    { id: 'meaning-kanji', name: 'Meaning → Kanji', desc: 'See meaning, pick the kanji' },
];
const PT_CERTAIN_TARGET = 3; // consecutive Certain-corrects before a kanji goes rare
const PT_MAX_WEIGHT = 10;
let testsPool = [];
let testsPoolKey = '';
let testsSource = 'mine'; // 'mine' | 'custom' | '5' | '4' | '3' | '2' | '1'
let testsJlptChars = [];
let testsJlptKey = '';

function loadCustomSet() {
    try {
        const a = JSON.parse(localStorage.getItem('testsCustom') || '[]');
        return new Set(Array.isArray(a) ? a : []);
    } catch (e) { return new Set(); }
}
function saveCustomSet(set) {
    try { localStorage.setItem('testsCustom', JSON.stringify([...set])); } catch (e) {}
}
let testsCustomSet = loadCustomSet();
let testsCustomReady = false; // true after Apply — modes use the custom set

function getMineChars() {
    // Unique kanji extracted from ALL fav words (vocab included), any date
    const seen = new Set();
    getStoredFavorites().forEach(f => {
        String(f.word || '').split('').forEach(ch => {
            if (/[\u4E00-\u9FAF]/.test(ch) && !seen.has(ch)) seen.add(ch);
        });
    });
    return [...seen];
}
let testsCurrentMode = null;
let testsQuestion = null; // { answer, options, answerIdx, selected, done }
let testsExam = null; // { queue, idx, score, total } or null
let testsPracticeCount = 0;

function loadPtProgress() {
    try {
        const p = JSON.parse(localStorage.getItem('ptProgress') || '{}');
        return (p && typeof p === 'object') ? p : {};
    } catch (e) { return {}; }
}
function savePtProgress(p) {
    try { localStorage.setItem('ptProgress', JSON.stringify(p)); } catch (e) {}
}
function ptEntry(p, k) {
    if (!p[k]) p[k] = { weight: 3, certain: 0 };
    return p[k];
}
function pickWeighted(pool) {
    const prog = loadPtProgress();
    let total = 0;
    const weights = pool.map(item => {
        const w = Math.max(1, ptEntry(prog, item.word).weight);
        total += w;
        return w;
    });
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
        r -= weights[i];
        if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
}
function pickWeightedChar(chars) {
    const prog = loadPtProgress();
    let total = 0;
    const weights = chars.map(ch => {
        const w = Math.max(1, (ptEntry(prog, ch).weight || 3));
        total += w;
        return w;
    });
    let r = Math.random() * total;
    for (let i = 0; i < chars.length; i++) {
        r -= weights[i];
        if (r <= 0) return chars[i];
    }
    return chars[chars.length - 1];
}

function loadJlptLists() {
    try {
        const c = JSON.parse(localStorage.getItem('jlptLists') || '{}');
        return (c && typeof c === 'object') ? c : {};
    } catch (e) { return {}; }
}
function saveJlptLists(c) {
    try { localStorage.setItem('jlptLists', JSON.stringify(c)); } catch (e) {}
}

async function ensureJlptChars(level) {
    // Official JLPT kanji set for the level (1 request, cached — enrichment stays lazy per question)
    const cache = loadJlptLists();
    if (Array.isArray(cache[level]) && cache[level].length > 0) return cache[level];
    const res = await fetch(`https://kanjiapi.dev/v1/kanji/jlpt-${level}`);
    if (!res.ok) throw new Error('JLPT list failed');
    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) throw new Error('JLPT list empty');
    cache[level] = list;
    saveJlptLists(cache);
    return list;
}

function readingsStr(item) {
    if (item.kanji && (item.kanji.kun.length > 0 || item.kanji.on.length > 0)) {
        const parts = [];
        if (item.kanji.kun.length > 0) parts.push('Kun: ' + item.kanji.kun.join(', '));
        if (item.kanji.on.length > 0) parts.push('On: ' + item.kanji.on.join(', '));
        return parts.join('  /  ');
    }
    return item.reading || '';
}
function renderTagsInto(el, item) {
    if (!el) return;
    el.innerHTML = '';
    (item.pos || []).forEach(p => {
        const t = document.createElement('span');
        t.className = 'fc-tag fc-tag-pos';
        t.textContent = p;
        el.appendChild(t);
    });
    if (item.is_common) {
        const t = document.createElement('span');
        t.className = 'fc-tag fc-tag-common';
        t.textContent = 'common word';
        el.appendChild(t);
    }
    if (item.jlpt) {
        const t = document.createElement('span');
        t.className = 'fc-tag fc-tag-jlpt';
        let label = String(item.jlpt).toLowerCase();
        if (label.startsWith('jlpt-')) label = 'jlpt ' + label.slice(5);
        if (/^n[1-5]$/.test(label)) label = 'jlpt ' + label;
        t.textContent = label;
        el.appendChild(t);
    }
    if (item.freq && item.freq.f) {
        const t = document.createElement('span');
        t.className = 'fc-tag fc-tag-freq';
        t.textContent = freqTagText(item.freq);
        el.appendChild(t);
    }
}

// === JPDB frequency (static top-20k asset, lazy-loaded once, real JPDB corpus ranks) ===
let freqMapPromise = null;
function loadFreqMap() {
    if (!freqMapPromise) {
        freqMapPromise = fetch('data/jpdb-freq.tsv')
            .then(res => {
                if (!res.ok) throw new Error('freq asset failed');
                return res.text();
            })
            .then(text => {
                const map = new Map();
                text.split('\n').forEach(line => {
                    const parts = line.split('\t');
                    if (parts.length < 2 || !parts[0]) return;
                    map.set(parts[0], { f: parseInt(parts[1], 10), k: parts[2] ? parseInt(parts[2], 10) : null });
                });
                return map;
            })
            .catch(e => {
                console.warn('Frequency data unavailable', e);
                return new Map();
            });
    }
    return freqMapPromise;
}
async function lookupFreq(word, reading) {
    try {
        const map = await loadFreqMap();
        if (word && map.has(word)) return map.get(word);
        if (reading && map.has(reading)) return map.get(reading);
    } catch (e) {}
    return null;
}
function freqTagText(freq) {
    if (!freq || !freq.f) return null;
    return freq.k ? `JPDB ${freq.f}; ${freq.k}か` : `JPDB ${freq.f}`;
}

function loadKanjiCache() {
    try {
        const c = JSON.parse(localStorage.getItem('kanjiCache') || '{}');
        return (c && typeof c === 'object') ? c : {};
    } catch (e) { return {}; }
}
function saveKanjiCache(c) {
    try { localStorage.setItem('kanjiCache', JSON.stringify(c)); } catch (e) {}
    // tiny + static data (readings never change) — cap cache size
    try {
        const keys = Object.keys(c);
        if (keys.length > 500) {
            keys.slice(0, keys.length - 500).forEach(k => delete c[k]);
            localStorage.setItem('kanjiCache', JSON.stringify(c));
        }
    } catch (e) {}
}

async function enrichKanjiChar(ch) {
    // Standalone kanji enrichment (kanjiapi.dev) for kanji extracted from vocab favs.
    // Static data cached in localStorage, so repeat visits are instant.
    const cache = loadKanjiCache();
    if (cache[ch]) {
        return { word: ch, reading: '', meaning: '', pos: [], jlpt: null, is_common: false, date: null, ...cache[ch] };
    }
    const item = { word: ch, reading: '', meaning: '', pos: [], jlpt: null, is_common: false, kanji: null, date: null };
    try {
        const kRes = await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(ch)}`);
        if (!kRes.ok) return null;
        const k = await kRes.json();
        const kun = Array.isArray(k.kun_readings) ? k.kun_readings : [];
        const on = Array.isArray(k.on_readings) ? k.on_readings : [];
        const meanings = Array.isArray(k.meanings) ? k.meanings : [];
        item.kanji = {
            kun, on, meanings,
            grade: k.grade ?? null,
            strokes: k.stroke_count ?? null,
            jlpt: k.jlpt ?? null
        };
        item.reading = (kun[0] || on[0] || '').replace(/\./g, '');
        item.meaning = meanings.slice(0, 3).join(', ');
        if (k.jlpt) item.jlpt = 'jlpt-n' + k.jlpt;
        item.freq = await lookupFreq(ch, item.reading);
        cache[ch] = { reading: item.reading, meaning: item.meaning, jlpt: item.jlpt, kanji: item.kanji, freq: item.freq || null };
        saveKanjiCache(cache);
    } catch (e) {
        console.warn('Kanji enrich failed for', ch, e);
        return null;
    }
    return item;
}

async function ensureTestsPool() {
    const allFavs = getStoredFavorites();
    // Pool = unique kanji extracted from ALL fav words (vocab included), any date.
    // e.g. 重さ -> 重, 学者 -> 学+者, 悪 -> 悪
    const seen = new Set();
    const chars = [];
    allFavs.forEach(f => {
        String(f.word || '').split('').forEach(ch => {
            if (/[\u4E00-\u9FAF]/.test(ch) && !seen.has(ch)) {
                seen.add(ch);
                chars.push(ch);
            }
        });
    });
    const key = [...seen].sort().join('');
    if (key === testsPoolKey && testsPool.length > 0) return testsPool;
    testsPoolKey = key;
    // Parallel fetch (was sequential — N× slow). Cached hits resolve instantly.
    const items = await Promise.all(chars.map(ch => enrichKanjiChar(ch)));
    testsPool = items.filter(Boolean);
    return testsPool;
}

function renderTestsCustom() {
    const pane = document.getElementById('tests-custom');
    const list = document.getElementById('tests-custom-list');
    const apply = document.getElementById('tests-custom-apply');
    const modes = document.getElementById('tests-modes');
    const examBtn = document.getElementById('tests-exam');
    if (!pane || !list) return;
    if (modes) modes.hidden = true;
    if (examBtn) examBtn.hidden = true;
    pane.hidden = false;
    list.innerHTML = '<p>Loading kanji sets...</p>';
    buildCustomList();

    async function buildCustomList() {
        const mineChars = getMineChars();
        // Seed: first open checks all mine kanji; new mine kanji default checked
        if (testsCustomSet.size === 0 && mineChars.length > 0) {
            mineChars.forEach(ch => testsCustomSet.add(ch));
            saveCustomSet(testsCustomSet);
        } else {
            let changed = false;
            mineChars.forEach(ch => { if (!testsCustomSet.has(ch)) { testsCustomSet.add(ch); changed = true; } });
            if (changed) saveCustomSet(testsCustomSet);
        }
        // Official sets (parallel, cached after first load)
        let levels = { 5: [], 4: [], 3: [], 2: [], 1: [] };
        try {
            const lists = await Promise.all([5, 4, 3, 2, 1].map(lv => ensureJlptChars(String(lv)).catch(() => [])));
            [5, 4, 3, 2, 1].forEach((lv, i) => { levels[lv] = lists[i] || []; });
        } catch (e) { /* offline — mine section still renders */ }
        // Prune checked chars that exist nowhere (freed fav kanji outside all JLPT sets)
        const allKnown = new Set([...mineChars]);
        Object.values(levels).forEach(arr => arr.forEach(ch => allKnown.add(ch)));
        let pruned = false;
        [...testsCustomSet].forEach(ch => { if (!allKnown.has(ch)) { testsCustomSet.delete(ch); pruned = true; } });
        if (pruned) saveCustomSet(testsCustomSet);

        list.innerHTML = '';
        const sections = [
            { title: 'Mine', chars: mineChars },
            { title: 'N5', chars: levels[5] },
            { title: 'N4', chars: levels[4] },
            { title: 'N3', chars: levels[3] },
            { title: 'N2', chars: levels[2] },
            { title: 'N1', chars: levels[1] },
        ];
        sections.forEach(sec => {
            const head = document.createElement('button');
            head.type = 'button';
            head.className = 'fc-section-head';
            const arrow = document.createElement('span');
            arrow.className = 'fc-section-arrow';
            arrow.textContent = '▸';
            const title = document.createElement('span');
            title.textContent = `${sec.title} (${sec.chars.length})`;
            head.appendChild(arrow);
            head.appendChild(title);
            const body = document.createElement('div');
            body.className = 'fc-section-body';
            body.hidden = true; // start collapsed
            head.addEventListener('click', () => {
                body.hidden = !body.hidden;
                arrow.textContent = body.hidden ? '▸' : '▾';
            });
            list.appendChild(head);
            if (sec.chars.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'fc-section-empty';
                empty.textContent = sec.title === 'Mine' ? 'No kanji in favorites yet.' : 'Could not load — check connection.';
                body.appendChild(empty);
                list.appendChild(body);
                return;
            }
            sec.chars.forEach(ch => {
                const row = document.createElement('label');
                row.className = 'fc-check-row';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = testsCustomSet.has(ch);
                cb.dataset.ch = ch;
                cb.addEventListener('change', () => {
                    if (cb.checked) testsCustomSet.add(ch);
                    else testsCustomSet.delete(ch);
                    saveCustomSet(testsCustomSet);
                    // Same kanji under multiple headers stays in sync
                    list.querySelectorAll(`input[data-ch="${ch}"]`).forEach(other => {
                        if (other !== cb) other.checked = cb.checked;
                    });
                    updateCustomApply();
                });
                const wordSpan = document.createElement('span');
                wordSpan.className = 'fc-word';
                wordSpan.textContent = ch;
                row.appendChild(cb);
                row.appendChild(wordSpan);
                body.appendChild(row);
            });
            list.appendChild(body);
        });
        updateCustomApply();
    }

    function updateCustomApply() {
        if (!apply) return;
        const n = testsCustomSet.size;
        apply.disabled = n < 4;
        apply.textContent = n < 4 ? `Apply (${n}/4 min)` : `Apply (${n})`;
    }
}

function applyTestsCustom() {
    const pane = document.getElementById('tests-custom');
    const modes = document.getElementById('tests-modes');
    const examBtn = document.getElementById('tests-exam');
    if (testsCustomSet.size < 4) return;
    testsJlptChars = [...testsCustomSet];
    testsJlptKey = 'custom';
    testsCustomReady = true;
    if (pane) pane.hidden = true;
    if (modes) modes.hidden = false;
    if (examBtn) examBtn.hidden = false;
    renderTestsModes();
}

async function renderTestsModes() {
    const box = document.getElementById('tests-modes');
    const examBtn = document.getElementById('tests-exam');
    const customPane = document.getElementById('tests-custom');
    if (!box) return;
    const staleWeak = document.getElementById('tests-weak');
    if (staleWeak) staleWeak.remove();
    if (testsSource === 'custom' && !testsCustomReady) {
        // Checklist view instead of modes; Apply fades back here
        renderTestsCustom();
        return;
    }
    if (customPane) customPane.hidden = true;
    box.hidden = false;
    if (examBtn) examBtn.hidden = false;
    box.innerHTML = '<p class="flashcards-hint">Loading kanji...</p>';
    if (examBtn) examBtn.disabled = true;
    try {
        if (testsSource === 'mine') {
            const pool = await ensureTestsPool();
            box.innerHTML = '';
            if (pool.length < 4) {
                box.innerHTML = `<p>No test pool yet — your favorites only contain ${pool.length} unique kanji so far (need 4). Favorite more words containing kanji to unlock prep tests.</p>`;
                if (examBtn) { examBtn.disabled = true; examBtn.textContent = 'Test'; }
                return;
            }
            if (examBtn) {
                examBtn.disabled = false;
                examBtn.textContent = `Test (${Math.min(20, pool.length)})`;
            }
        } else if (testsSource === 'custom') {
            const chars = [...testsCustomSet];
            if (chars.length < 4) {
                testsCustomReady = false;
                renderTestsCustom();
                return;
            }
            testsJlptChars = chars;
            testsJlptKey = 'custom';
            box.innerHTML = '';
            const note = document.createElement('p');
            note.className = 'flashcards-hint';
            note.textContent = `Custom set — ${chars.length} kanji.`;
            box.appendChild(note);
            if (examBtn) {
                examBtn.disabled = false;
                examBtn.textContent = `Test (${Math.min(20, chars.length)})`;
            }
        } else {
            const chars = await ensureJlptChars(testsSource);
            testsJlptChars = chars;
            testsJlptKey = testsSource;
            box.innerHTML = '';
            const note = document.createElement('p');
            note.className = 'flashcards-hint';
            note.textContent = `Official N${testsSource} set — ${chars.length} kanji.`;
            box.appendChild(note);
            if (examBtn) {
                examBtn.disabled = false;
                examBtn.textContent = `Test (${Math.min(20, chars.length)})`;
            }
        }
    } catch (e) {
        box.innerHTML = '<p>Could not load kanji. Check connection and retry.</p>';
        if (examBtn) { examBtn.disabled = true; examBtn.textContent = 'Test'; }
        return;
    }
    TESTS_MODES.forEach(m => {
        const btn = document.createElement('button');
        btn.className = 'tests-mode-row';
        const left = document.createElement('span');
        left.innerHTML = '';
        const name = document.createElement('strong');
        name.textContent = m.name;
        const desc = document.createElement('span');
        desc.className = 'tests-mode-desc';
        desc.textContent = m.desc;
        left.appendChild(name);
        left.appendChild(desc);
        const arrow = document.createElement('span');
        arrow.textContent = '›';
        btn.appendChild(left);
        btn.appendChild(arrow);
        btn.addEventListener('click', () => startTestsMode(m.id));
        box.appendChild(btn);
    });
    renderTestsWeak();
}

function optionTextFor(modeId, opt) {
    if (modeId === 'kanji-reading' || modeId === 'reading-kanji-prompt') return readingsStr(opt);
    if (modeId === 'kanji-meaning') return opt.meaning || '';
    return opt.word;
}

function startTestsMode(modeId) {
    testsCurrentMode = modeId;
    testsExam = null;
    testsInViewer = true;
    prefetchToken++; testsPrefetched = null;
    const setup = document.getElementById('tests-setup');
    const viewer = document.getElementById('tests-viewer');
    if (setup) setup.hidden = true;
    if (viewer) viewer.hidden = false;
    nextTestsQuestion();
}

function startTestsExam() {
    if (testsSource === 'mine') {
        if (testsPool.length < 4) return;
        const queue = shuffleArray(testsPool).slice(0, Math.min(20, testsPool.length));
        testsExam = { queue, idx: 0, score: 0, total: queue.length, results: [] };
    } else {
        if (testsJlptChars.length < 4) return;
        const queue = shuffleArray(testsJlptChars).slice(0, Math.min(20, testsJlptChars.length));
        testsExam = { queue, idx: 0, score: 0, total: queue.length, results: [] };
    }
    testsCurrentMode = TESTS_MODES[Math.floor(Math.random() * TESTS_MODES.length)].id;
    testsInViewer = true;
    prefetchToken++; testsPrefetched = null;
    const setup = document.getElementById('tests-setup');
    const viewer = document.getElementById('tests-viewer');
    if (setup) setup.hidden = true;
    if (viewer) viewer.hidden = false;
    nextTestsQuestion();
}

function showTestsLoading(text) {
    const promptKanji = document.getElementById('tests-prompt-kanji');
    const promptSub = document.getElementById('tests-prompt-sub');
    const tags = document.getElementById('tests-tags');
    const optsBox = document.getElementById('tests-options');
    const status = document.getElementById('tests-status');
    if (promptKanji) { promptKanji.style.display = ''; promptKanji.textContent = '…'; }
    if (promptSub) promptSub.textContent = text || 'Loading...';
    if (tags) tags.innerHTML = '';
    if (optsBox) optsBox.innerHTML = '';
    if (status) status.textContent = '';
}

async function buildQuestionFromChars(chars, answerChar) {
    // Lazy enrich: only the 4 shown kanji (parallel, cached) — keeps N3+ sets fast
    const others = shuffleArray(chars.filter(c => c !== answerChar)).slice(0, 3);
    const items = (await Promise.all([answerChar, ...others].map(enrichKanjiChar))).filter(Boolean);
    if (items.length < 4) return null;
    const answer = items[0];
    const options = shuffleArray(items);
    return {
        answer,
        options,
        answerIdx: options.findIndex(o => o.word === answer.word),
        selected: null,
        done: false
    };
}

let testsPrefetched = null; // { forIdx (-1 practice), mode, q } built in background

async function buildJlptQuestion(forIdx) {
    const chars = testsJlptChars;
    if (!chars || chars.length < 4) return null;
    let answerChar, mode;
    if (testsExam) {
        const idx = (forIdx === undefined) ? testsExam.idx : forIdx;
        if (idx >= testsExam.total) return null;
        answerChar = testsExam.queue[idx];
        mode = TESTS_MODES[Math.floor(Math.random() * TESTS_MODES.length)].id;
        const q = await buildQuestionFromChars(chars, answerChar);
        if (!q) return null;
        return { mode, q, forIdx: idx };
    }
    mode = testsCurrentMode;
    const q = await buildQuestionFromChars(chars, pickWeightedChar(chars));
    if (!q) return null;
    return { mode, q, forIdx: -1 };
}

function prefetchJlptNext() {
    // Background-build the FOLLOWING question so Next renders instantly.
    // Practice: random next; exam: queue[idx+1]. Guarded by token against stale builds.
    if (testsSource === 'mine') return;
    if (!testsJlptChars || testsJlptChars.length < 4) return;
    const token = ++prefetchToken;
    const wantIdx = testsExam ? testsExam.idx + 1 : -1;
    if (testsExam && wantIdx >= testsExam.total) return;
    buildJlptQuestion(wantIdx).then(built => {
        if (token !== prefetchToken) return; // stale (source/mode changed)
        if (!built) return;
        testsPrefetched = built;
    }).catch(() => {});
}
let prefetchToken = 0;

async function nextTestsQuestion() {
    if (testsSource !== 'mine') {
        // JLPT level path: official set, lazy per-question enrich.
        // Uses background-prefetched question when ready — no loader flicker.
        const chars = testsJlptChars;
        if (!chars || chars.length < 4) return;
        if (testsExam && testsExam.idx >= testsExam.total) {
            renderTestsResult();
            return;
        }
        const wantIdx = testsExam ? testsExam.idx : -1;
        if (testsPrefetched && (testsPrefetched.mode || testsCurrentMode) &&
            (!testsExam || testsPrefetched.forIdx === wantIdx)) {
            const pre = testsPrefetched;
            testsPrefetched = null;
            testsCurrentMode = pre.mode;
            testsQuestion = pre.q;
            renderTestsQuestion();
            prefetchJlptNext();
            return;
        }
        showTestsLoading('Loading...');
        const built = await buildJlptQuestion();
        if (!built) return;
        testsCurrentMode = built.mode;
        testsQuestion = built.q;
        renderTestsQuestion();
        prefetchJlptNext();
        return;
    }
    // 'mine' path: pre-enriched fav pool (unchanged)
    let answer;
    if (testsExam) {
        if (testsExam.idx >= testsExam.total) {
            renderTestsResult();
            return;
        }
        const entry = testsExam.queue[testsExam.idx];
        answer = (typeof entry === 'string')
            ? testsPool.find(k => k.word === entry)
            : entry;
        if (!answer) { testsExam.idx++; nextTestsQuestion(); return; }
        // Exam mixes modes per question
        testsCurrentMode = TESTS_MODES[Math.floor(Math.random() * TESTS_MODES.length)].id;
    } else {
        answer = pickWeighted(testsPool);
    }
    const others = shuffleArray(testsPool.filter(k => k.word !== answer.word)).slice(0, 3);
    const options = shuffleArray([answer, ...others]);
    testsQuestion = {
        answer,
        options,
        answerIdx: options.findIndex(o => o.word === answer.word),
        selected: null,
        done: false
    };
    renderTestsQuestion();
}

function renderTestsQuestion() {
    const q = testsQuestion;
    if (!q) return;
    const modeId = testsCurrentMode;
    const promptKanji = document.getElementById('tests-prompt-kanji');
    const promptSub = document.getElementById('tests-prompt-sub');
    const tags = document.getElementById('tests-tags');
    const optsBox = document.getElementById('tests-options');
    const conf = document.getElementById('tests-confidence');
    const feedback = document.getElementById('tests-feedback');
    const status = document.getElementById('tests-status');
    const nextBtn = document.getElementById('tests-next');
    const reviewBox = document.getElementById('tests-review');
    const modeName = (TESTS_MODES.find(m => m.id === modeId) || {}).name || '';
    if (testsExam) {
        if (status) status.textContent = `Test ${testsExam.idx + 1}/${testsExam.total} · score ${testsExam.score} · ${modeName}`;
    } else {
        if (status) status.textContent = modeName;
    }
    // Prompt per mode
    if (promptKanji) promptKanji.style.display = '';
    if (modeId === 'kanji-reading' || modeId === 'kanji-meaning') {
        if (promptKanji) promptKanji.textContent = q.answer.word;
        if (promptSub) promptSub.textContent = '';
    } else if (modeId === 'reading-kanji') {
        if (promptKanji) promptKanji.textContent = q.answer.reading || readingsStr(q.answer).split('/')[0];
        if (promptSub) promptSub.textContent = readingsStr(q.answer);
    } else { // meaning-kanji
        if (promptKanji) promptKanji.style.display = 'none';
        if (promptSub) {
            promptSub.textContent = q.answer.meaning || '';
            promptSub.style.fontSize = '1.6rem';
        }
    }
    if (modeId !== 'meaning-kanji' && promptSub) promptSub.style.fontSize = '';
    renderTagsInto(tags, q.answer);
    // Options per mode (reading options always show the FULL set)
    if (optsBox) {
        optsBox.innerHTML = '';
        q.options.forEach((opt, i) => {
            const b = document.createElement('button');
            b.className = 'tests-option';
            b.textContent = modeId === 'kanji-reading' ? readingsStr(opt)
                : modeId === 'kanji-meaning' ? (opt.meaning || '')
                : opt.word;
            b.addEventListener('click', () => selectTestsOption(i));
            optsBox.appendChild(b);
        });
    }
    if (conf) conf.hidden = true;
    if (feedback) { feedback.textContent = ''; feedback.className = 'tests-feedback'; }
    if (reviewBox) reviewBox.innerHTML = '';
    if (nextBtn) { nextBtn.style.display = 'none'; nextBtn.textContent = 'Next ->'; }
}

function selectTestsOption(i) {
    const q = testsQuestion;
    if (!q || q.done) return;
    q.selected = i;
    const optsBox = document.getElementById('tests-options');
    if (optsBox) {
        [...optsBox.children].forEach((b, bi) => {
            b.classList.toggle('selected', bi === i);
        });
    }
    if (testsExam) {
        // Exam: answer immediately, no confidence
        gradeTestsAnswer(i === q.answerIdx, null);
    } else {
        const conf = document.getElementById('tests-confidence');
        if (conf) conf.hidden = false;
    }
}

function submitTestsConfidence(conf) {
    const q = testsQuestion;
    if (!q || q.done || q.selected === null) return;
    gradeTestsAnswer(q.selected === q.answerIdx, conf);
}

function gradeTestsAnswer(correct, conf) {
    const q = testsQuestion;
    if (!q) return;
    q.done = true;
    const prog = loadPtProgress();
    const entry = ptEntry(prog, q.answer.word);
    const feedback = document.getElementById('tests-feedback');
    const optsBox = document.getElementById('tests-options');
    const confRow = document.getElementById('tests-confidence');
    const nextBtn = document.getElementById('tests-next');
    if (optsBox) {
        [...optsBox.children].forEach((b, bi) => {
            b.disabled = true;
            if (bi === q.answerIdx) b.classList.add('correct');
            else if (bi === q.selected && !correct) b.classList.add('wrong');
        });
    }
    if (confRow) confRow.hidden = true;
    if (testsExam) {
        if (correct) testsExam.score++;
        entry.hits = (entry.hits || 0) + (correct ? 1 : 0);
        entry.misses = (entry.misses || 0) + (correct ? 0 : 1);
        testsExam.results.push({
            mode: testsCurrentMode,
            answer: q.answer.word,
            answerReading: readingsStr(q.answer),
            answerMeaning: q.answer.meaning || '',
            picked: (q.options[q.selected] || {}).word || '',
            pickedText: optionTextFor(testsCurrentMode, q.options[q.selected] || {}),
            correct
        });
        if (feedback) {
            feedback.textContent = correct
                ? `Correct — ${q.answer.word} (${readingsStr(q.answer)})`
                : `Wrong — ${q.answer.word} (${readingsStr(q.answer)})`;
            feedback.className = 'tests-feedback ' + (correct ? 'good' : 'bad');
        }
    } else if (!correct) {
        entry.weight = Math.min(PT_MAX_WEIGHT, entry.weight + 3);
        entry.certain = 0;
        entry.misses = (entry.misses || 0) + 1;
        if (feedback) {
            feedback.textContent = `Not quite — answer: ${readingsStr(q.answer)}. It'll come back soon.`;
            feedback.className = 'tests-feedback bad';
        }
    } else if (conf === 'maybe') {
        entry.weight = Math.min(PT_MAX_WEIGHT, entry.weight + 1);
        entry.certain = 0;
        entry.hits = (entry.hits || 0) + 1;
        if (feedback) {
            feedback.textContent = 'Correct (Maybe) — flagged for more practice.';
            feedback.className = 'tests-feedback info';
        }
    } else {
        entry.certain = (entry.certain || 0) + 1;
        entry.hits = (entry.hits || 0) + 1;
        if (entry.certain >= PT_CERTAIN_TARGET) {
            entry.weight = 1; // rare, never zero
            if (feedback) {
                feedback.textContent = `Correct (Certain ×${entry.certain}) — mastered, now rare.`;
                feedback.className = 'tests-feedback good';
            }
        } else {
            entry.weight = Math.max(1, entry.weight - 1);
            if (feedback) {
                feedback.textContent = `Correct (Certain ${entry.certain}/${PT_CERTAIN_TARGET}) — ${PT_CERTAIN_TARGET - entry.certain} more to master.`;
                feedback.className = 'tests-feedback good';
            }
        }
    }
    savePtProgress(prog);
    testsPracticeCount++;
    logStudy('tests');
    if (correct) logStudy('correct');
    if (nextBtn) {
        nextBtn.style.display = '';
        nextBtn.textContent = testsExam ? 'Next ->' : 'Next ->';
    }
}

function renderTestsResult() {
    const ex = testsExam;
    testsQuestion = null;
    const promptKanji = document.getElementById('tests-prompt-kanji');
    const promptSub = document.getElementById('tests-prompt-sub');
    const tags = document.getElementById('tests-tags');
    const optsBox = document.getElementById('tests-options');
    const conf = document.getElementById('tests-confidence');
    const feedback = document.getElementById('tests-feedback');
    const status = document.getElementById('tests-status');
    const nextBtn = document.getElementById('tests-next');
    const review = document.getElementById('tests-review');
    if (promptKanji) { promptKanji.style.display = ''; promptKanji.textContent = `${ex.score}/${ex.total}`; }
    if (promptSub) { promptSub.style.fontSize = ''; promptSub.textContent = ex.score === ex.total ? 'Perfect!' : ex.score >= ex.total * 0.7 ? 'Nice work!' : 'Keep practicing!'; }
    if (tags) tags.innerHTML = '';
    if (optsBox) optsBox.innerHTML = '';
    if (conf) conf.hidden = true;
    if (status) status.textContent = 'Test complete';
    if (feedback) { feedback.textContent = ''; feedback.className = 'tests-feedback'; }
    if (review) {
        review.innerHTML = '';
        const title = document.createElement('div');
        title.className = 'tests-review-title';
        title.textContent = 'Review — click a missed one for help';
        review.appendChild(title);
        ex.results.forEach((r) => {
            const row = document.createElement('button');
            row.className = 'tests-review-row' + (r.correct ? ' ok' : ' miss');
            const mark = document.createElement('span');
            mark.className = 'tests-review-mark';
            mark.textContent = r.correct ? '✓' : '✗';
            const label = document.createElement('span');
            const modeName = (TESTS_MODES.find(m => m.id === r.mode) || {}).name || r.mode;
            label.textContent = `${r.answer} — ${modeName}`;
            row.appendChild(mark);
            row.appendChild(label);
            if (!r.correct) {
                row.addEventListener('click', () => toggleReviewExplain(row, r));
            } else {
                row.disabled = true;
            }
            review.appendChild(row);
        });
    }
    if (nextBtn) { nextBtn.style.display = ''; nextBtn.textContent = 'Finish'; }
}

async function toggleReviewExplain(row, r) {
    let panel = row.nextElementSibling;
    if (panel && panel.classList && panel.classList.contains('tests-explain')) {
        panel.remove();
        return;
    }
    // Close any other open panels
    document.querySelectorAll('#tests-review .tests-explain').forEach(p => p.remove());
    panel = document.createElement('div');
    panel.className = 'tests-explain';
    panel.innerHTML = '';
    const why = document.createElement('div');
    why.innerHTML = '';
    const w1 = document.createElement('div');
    w1.innerHTML = `<strong>${r.answer}</strong> — ${r.answerReading}`;
    const w2 = document.createElement('div');
    w2.textContent = r.answerMeaning || '';
    w2.className = 'tests-explain-meaning';
    const w3 = document.createElement('div');
    w3.textContent = `You picked ${r.picked}${r.pickedText && r.pickedText !== r.picked ? ` (${r.pickedText})` : ''} — compare the readings above.`;
    w3.className = 'tests-explain-picked';
    panel.appendChild(w1);
    panel.appendChild(w2);
    panel.appendChild(w3);
    const loading = document.createElement('div');
    loading.className = 'tests-explain-loading';
    loading.textContent = 'Loading example...';
    panel.appendChild(loading);
    row.after(panel);
    try {
        const res = await fetch(`/api/search/sentences?keyword=${encodeURIComponent(r.answer)}`);
        if (!res.ok) throw new Error('sentences failed');
        const data = await res.json();
        const first = (data.data || [])[0];
        loading.remove();
        if (first) {
            // Display plain text (raw) — no furigana pipeline changes
            const jp = document.createElement('div');
            jp.className = 'tests-explain-jp';
            jp.textContent = (first.japanese && (first.japanese.raw || first.japanese.cleaned || first.japanese)) || '';
            if (typeof jp.textContent !== 'string') jp.textContent = String(first.japanese || '');
            // Strip any HTML tags just in case
            jp.textContent = jp.textContent.replace(/<[^>]*>/g, '');
            const en = document.createElement('div');
            en.className = 'tests-explain-en';
            en.textContent = first.english || '';
            panel.appendChild(jp);
            panel.appendChild(en);
        } else {
            loading.textContent = 'No example found.';
        }
    } catch (e) {
        loading.textContent = 'Could not load example.';
    }
}

function testsNext() {
    if (testsExam && !testsQuestion) {
        // Exam finished
        testsExam = null;
        testsInViewer = false;
        setFavView('tests');
        return;
    }
    if (testsExam && testsQuestion && testsQuestion.done) {
        testsExam.idx++; // advance — this was missing, counter never moved
    }
    nextTestsQuestion();
}

// === Mined sentences (save from Sentence Examples, review in History) ===
function loadMines() {
    try {
        const m = JSON.parse(localStorage.getItem('minedSentences') || '[]');
        return Array.isArray(m) ? m : [];
    } catch (e) { return []; }
}
function saveMines(mines) {
    try { localStorage.setItem('minedSentences', JSON.stringify(mines)); } catch (e) {}
    try {
        fetch('/api/mines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mines })
        }).catch(() => {});
    } catch (e) {}
}
async function loadMinesFromServer() {
    try {
        if (loadMines().length > 0) return;
        const res = await fetch('/api/mines');
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            try { localStorage.setItem('minedSentences', JSON.stringify(data)); } catch (e) {}
        }
    } catch (e) {}
}
function mineKey(jp, en) {
    return `${jp}|||${en}`;
}
function isMined(jp, en) {
    const k = mineKey(jp, en);
    return loadMines().some(m => mineKey(m.jp, m.en) === k);
}
function toggleMine(jp, en) {
    const mines = loadMines();
    const k = mineKey(jp, en);
    const idx = mines.findIndex(m => mineKey(m.jp, m.en) === k);
    if (idx !== -1) {
        mines.splice(idx, 1); // unsave frees space
    } else {
        mines.push({ jp, en, date: getTodayKey() });
        logStudy('favs');
    }
    saveMines(mines);
    renderMinedList();
    return idx === -1;
}
function renderMinedList() {
    const box = document.getElementById('mined-list');
    const counter = document.getElementById('mined-counter');
    if (!box) return;
    const mines = loadMines();
    if (counter) counter.textContent = String(mines.length);
    box.innerHTML = '';
    if (mines.length === 0) {
        box.innerHTML = '<p>No mined sentences yet. Hit the bookmark on any example.</p>';
        return;
    }
    mines.slice().reverse().forEach(m => {
        const card = document.createElement('div');
        card.className = 'mined-card';
        const jp = document.createElement('div');
        jp.className = 'mined-jp';
        jp.textContent = m.jp;
        const en = document.createElement('div');
        en.className = 'mined-en';
        en.textContent = m.en;
        const meta = document.createElement('div');
        meta.className = 'mined-meta';
        meta.textContent = formatDateLabel(m.date || getTodayKey());
        const speak = document.createElement('button');
        speak.className = 'mined-remove';
        speak.style.right = '2.4rem';
        speak.setAttribute('aria-label', 'Play audio');
        speak.innerHTML = '<i class="fas fa-volume-up"></i>';
        speak.addEventListener('click', () => speakJapanese(m.jp));
        const rm = document.createElement('button');
        rm.className = 'mined-remove';
        rm.setAttribute('aria-label', 'Remove');
        rm.innerHTML = '<i class="fas fa-trash"></i>';
        rm.addEventListener('click', () => toggleMine(m.jp, m.en));
        card.appendChild(jp);
        card.appendChild(en);
        card.appendChild(meta);
        card.appendChild(speak);
        card.appendChild(rm);
        box.appendChild(card);
    });
}

// === Grammar notes notebook ===
function loadNotes() {
    try {
        const n = JSON.parse(localStorage.getItem('grammarNotes') || '[]');
        return Array.isArray(n) ? n : [];
    } catch (e) { return []; }
}
function saveNotes(notes) {
    try { localStorage.setItem('grammarNotes', JSON.stringify(notes)); } catch (e) {}
    try {
        fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes })
        }).catch(() => {});
    } catch (e) {}
}
async function loadNotesFromServer() {
    try {
        if (loadNotes().length > 0) return;
        const res = await fetch('/api/notes');
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            try { localStorage.setItem('grammarNotes', JSON.stringify(data)); } catch (e) {}
        }
    } catch (e) {}
}
function renderNotesList(filter) {
    const box = document.getElementById('notes-list');
    if (!box) return;
    const notes = loadNotes();
    const q = (filter || '').trim().toLowerCase();
    const visible = q
        ? notes.filter(n => `${n.pattern} ${n.meaning} ${n.example}`.toLowerCase().includes(q))
        : notes;
    box.innerHTML = '';
    if (visible.length === 0) {
        box.innerHTML = notes.length === 0
            ? '<p>No notes yet. Add your first grammar pattern above.</p>'
            : '<p>No notes match.</p>';
        return;
    }
    visible.slice().reverse().forEach(n => {
        const card = document.createElement('div');
        card.className = 'note-card';
        const pat = document.createElement('div');
        pat.className = 'note-pattern';
        pat.textContent = n.pattern;
        const mean = document.createElement('div');
        mean.className = 'note-meaning';
        mean.textContent = n.meaning;
        card.appendChild(pat);
        card.appendChild(mean);
        if (n.example) {
            const ex = document.createElement('div');
            ex.className = 'note-example';
            ex.textContent = n.example;
            card.appendChild(ex);
        }
        const rm = document.createElement('button');
        rm.className = 'note-remove';
        rm.setAttribute('aria-label', 'Delete note');
        rm.innerHTML = '<i class="fas fa-trash"></i>';
        rm.addEventListener('click', () => {
            saveNotes(loadNotes().filter(x => x.id !== n.id));
            renderNotesList(document.getElementById('note-search').value);
        });
        card.appendChild(rm);
        box.appendChild(card);
    });
}
function addGrammarNote() {
    const pat = document.getElementById('note-pattern');
    const mean = document.getElementById('note-meaning');
    const ex = document.getElementById('note-example');
    if (!pat || !pat.value.trim()) return;
    const notes = loadNotes();
    notes.push({
        id: Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
        pattern: pat.value.trim(),
        meaning: (mean.value || '').trim(),
        example: (ex.value || '').trim(),
        date: getTodayKey()
    });
    saveNotes(notes);
    pat.value = ''; mean.value = ''; ex.value = '';
    renderNotesList('');
    const search = document.getElementById('note-search');
    if (search) search.value = '';
}

// === Weak list (Tests progress: most-missed kanji + drill) ===
function getWeakKanji(limit) {
    const prog = loadPtProgress();
    return Object.keys(prog)
        .filter(k => (prog[k].misses || 0) > 0 || (prog[k].weight || 3) > 3)
        .map(k => ({ ch: k, weight: prog[k].weight || 3, misses: prog[k].misses || 0, hits: prog[k].hits || 0 }))
        .sort((a, b) => (b.weight - a.weight) || (b.misses - a.misses))
        .slice(0, limit || 10);
}

async function renderTestsWeak() {
    let box = document.getElementById('tests-weak');
    if (!box) {
        // Insert weak section between exam button and viewer? Place after exam button.
        const setup = document.getElementById('tests-setup');
        const examBtn = document.getElementById('tests-exam');
        if (!setup || !examBtn) return;
        box = document.createElement('div');
        box.id = 'tests-weak';
        setup.insertBefore(box, examBtn.nextSibling);
    }
    const weak = getWeakKanji(10);
    box.innerHTML = '';
    if (weak.length === 0) {
        box.innerHTML = '<div class="tests-weak-head">Needs work</div><p class="flashcards-hint">Nothing weak yet — misses will land here.</p>';
        return;
    }
    const head = document.createElement('div');
    head.className = 'tests-weak-head';
    head.textContent = 'Needs work';
    box.appendChild(head);
    // Enrich readings for display (parallel, cached)
    const items = await Promise.all(weak.map(w => enrichKanjiChar(w.ch)));
    items.forEach((item, i) => {
        if (!item) return;
        const row = document.createElement('button');
        row.className = 'tests-weak-row';
        const ch = document.createElement('span');
        ch.textContent = item.word;
        const rd = document.createElement('span');
        rd.className = 'tests-weak-miss';
        rd.style.color = 'var(--text-secondary)';
        rd.style.marginLeft = '0';
        rd.textContent = readingsStr(item);
        const miss = document.createElement('span');
        miss.className = 'tests-weak-miss';
        miss.textContent = `${weak[i].misses} miss${weak[i].misses === 1 ? '' : 'es'}`;
        row.appendChild(ch);
        row.appendChild(rd);
        row.appendChild(miss);
        row.addEventListener('click', () => startWeakDrill());
        box.appendChild(row);
    });
    const drill = document.createElement('button');
    drill.className = 'ghost-btn';
    drill.textContent = `Drill weak (${Math.min(10, weak.length)})`;
    drill.addEventListener('click', () => startWeakDrill());
    box.appendChild(drill);
}

function startWeakDrill() {
    const weak = getWeakKanji(10).map(w => w.ch);
    if (weak.length < 4) return;
    // Restrict to current source pool so distractors exist
    let poolChars;
    if (testsSource === 'mine') {
        poolChars = testsPool.map(k => k.word);
    } else {
        poolChars = testsJlptChars;
    }
    const queueChars = weak.filter(ch => poolChars.includes(ch));
    if (queueChars.length < 4) return;
    let queue;
    if (testsSource === 'mine') {
        queue = queueChars.map(ch => testsPool.find(k => k.word === ch)).filter(Boolean);
    } else {
        queue = queueChars;
    }
    testsExam = { queue: shuffleArray(queue).slice(0, Math.min(10, queue.length)), idx: 0, score: 0, total: 0, results: [], weakDrill: true };
    testsExam.total = testsExam.queue.length;
    testsCurrentMode = TESTS_MODES[Math.floor(Math.random() * TESTS_MODES.length)].id;
    testsInViewer = true;
    prefetchToken++; testsPrefetched = null;
    const setup = document.getElementById('tests-setup');
    const viewer = document.getElementById('tests-viewer');
    if (setup) setup.hidden = true;
    if (viewer) viewer.hidden = false;
    nextTestsQuestion();
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
    if (fcToggle) fcToggle.addEventListener('click', () => setFavView(favView === 'cards' ? 'list' : 'cards'));
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
        cardsInViewer = false;
        const setup = document.getElementById('flashcards-setup');
        const viewer = document.getElementById('flashcards-viewer');
        if (setup) setup.hidden = false;
        if (viewer) viewer.hidden = true;
        renderFlashcardsChecklist();
    });

    // Tests (P.T prep, favorites page only)
    const ptToggle = document.getElementById('tests-toggle');
    if (ptToggle) ptToggle.addEventListener('click', () => setFavView(favView === 'tests' ? 'list' : 'tests'));
    const testsExamBtn = document.getElementById('tests-exam');
    if (testsExamBtn) testsExamBtn.addEventListener('click', startTestsExam);
    const testsExit = document.getElementById('tests-exit');
    if (testsExit) testsExit.addEventListener('click', () => {
        testsExam = null;
        testsQuestion = null;
        testsInViewer = false;
        prefetchToken++; testsPrefetched = null;
        setFavView('tests');
    });
    const testsNextBtn = document.getElementById('tests-next');
    if (testsNextBtn) testsNextBtn.addEventListener('click', testsNext);
    const testsMaybe = document.getElementById('tests-maybe');
    if (testsMaybe) testsMaybe.addEventListener('click', () => submitTestsConfidence('maybe'));
    const testsCertain = document.getElementById('tests-certain');
    if (testsCertain) testsCertain.addEventListener('click', () => submitTestsConfidence('certain'));

    // JLPT level selector (Tests setup): Custom / Mine vs official N5..N1 sets
    document.querySelectorAll('#jlpt-selector .jlpt-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('#jlpt-selector .jlpt-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            testsSource = pill.dataset.source;
            testsExam = null;
            testsQuestion = null;
            prefetchToken++; testsPrefetched = null;
            if (testsSource !== 'custom') testsCustomReady = false;
            renderTestsModes();
        });
    });
    const testsCustomApply = document.getElementById('tests-custom-apply');
    if (testsCustomApply) testsCustomApply.addEventListener('click', applyTestsCustom);

    // Study Tracker: idle-aware activity (leaving the page open doesn't count)
    const markActive = () => { lastActiveTs = Date.now(); };
    document.addEventListener('pointerdown', markActive, { capture: true, passive: true });
    document.addEventListener('keydown', markActive, { capture: true });
    loadStudyStatsFromServer();
    setInterval(() => {
        if (Date.now() - lastActiveTs < TRACKER_IDLE_MS) {
            const stats = loadStudyStats();
            const k = getTodayKey();
            if (!stats[k]) stats[k] = { words: 0, sentences: 0, cards: 0, tests: 0, correct: 0, favs: 0, activeSec: 0 };
            stats[k].activeSec = (stats[k].activeSec || 0) + 30;
            saveStudyStats(stats);
            if (document.getElementById('tracker-page').classList.contains('active')) renderTracker();
        }
    }, 30000);
    const trPrev = document.getElementById('tracker-prev');
    if (trPrev) trPrev.addEventListener('click', () => { trackerYear--; renderTracker(); });
    const trNext = document.getElementById('tracker-next');
    if (trNext) trNext.addEventListener('click', () => { trackerYear++; renderTracker(); });
    const trToday = document.getElementById('tracker-today');
    if (trToday) trToday.addEventListener('click', () => { trackerYear = new Date().getFullYear(); renderTracker(); });

    // Mined sentences + grammar notes
    loadMinesFromServer().then(() => renderMinedList());
    renderMinedList();
    loadNotesFromServer().then(() => renderNotesList(''));
    renderNotesList('');
    const noteAdd = document.getElementById('note-add');
    if (noteAdd) noteAdd.addEventListener('click', addGrammarNote);
    const noteSearch = document.getElementById('note-search');
    if (noteSearch) noteSearch.addEventListener('input', () => renderNotesList(noteSearch.value));

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
