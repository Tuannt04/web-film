class MovieDetailApp {
    constructor() {
        this.apiKey = '829a2e466ec427b28631f61e16570988';
        this.baseUrl = 'https://api.themoviedb.org/3';
        this.imageBaseUrl = 'https://image.tmdb.org/t/p/w500';
        this.backdropBaseUrl = 'https://image.tmdb.org/t/p/w1280';
        this.youtubeBaseUrl = 'https://www.youtube.com/embed/';
        this.movieGenres = {};
        this.tvGenres = {};
        this.mediaId = null;
        this.mediaType = null;
        this.countries = [];
        this.selectedCountry = 'US';
        this.genres = [];
        this.selectedGenre = null;
        this.searchTimeout = null;
        this.init();
    }

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.mediaId = urlParams.get('id');
        this.mediaType = urlParams.get('type') || 'movie';
        if (!this.mediaId) {
            console.error('No content ID');
            return;
        }
        await this.fetchGenres();
        await this.fetchCountries();
        await this.loadMediaDetails();
        await this.loadSimilarMedia();
        this.setupEventListeners();
    }

    async fetchGenres() {
        try {
            const movieGenreData = await this.fetchFromAPI('/genre/movie/list');
            if (movieGenreData && movieGenreData.genres) {
                movieGenreData.genres.forEach(genre => {
                    this.movieGenres[genre.id] = genre.name;
                });
                this.genres = movieGenreData.genres.sort((a, b) => a.name.localeCompare(b.name));
                this.renderGenreModal();
            }
            const tvGenreData = await this.fetchFromAPI('/genre/tv/list');
            if (tvGenreData && tvGenreData.genres) {
                tvGenreData.genres.forEach(genre => {
                    this.tvGenres[genre.id] = genre.name;
                });
            }
        } catch (error) {
            console.error('Error fetching genres:', error);
        }
    }

    async fetchCountries() {
        try {
            const response = await fetch(`${this.baseUrl}/configuration/countries?api_key=${this.apiKey}`);
            if (!response.ok) throw new Error('API request failed');
            const data = await response.json();
            this.countries = data.sort((a, b) => a.english_name.localeCompare(b.english_name));
            this.renderCountryModal();
        } catch (error) {
            console.error('Error fetching countries:', error);
        }
    }

    async fetchFromAPI(endpoint) {
        try {
            let url = `${this.baseUrl}${endpoint}?api_key=${this.apiKey}`;
            if (endpoint.includes('search') || endpoint.includes('discover')) {
                url += `&region=${this.selectedCountry}`;
                if (this.selectedGenre) {
                    url += `&with_genres=${this.selectedGenre}`;
                }
            }
            if (!endpoint.includes('videos') && !endpoint.includes('genre') && !endpoint.includes('configuration')) {
                url += '&append_to_response=credits';
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API request failed: ${response.status} - ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error('API error:', error);
            return null;
        }
    }

    async loadMediaDetails() {
        const endpoint = `/${this.mediaType}/${this.mediaId}`;
        console.log('Fetching details for:', endpoint);
        const details = await this.fetchFromAPI(endpoint);
        console.log('API response:', details);
        if (details) {
            this.renderDetails(details);
            this.loadTrailer();
            if (this.mediaType === 'tv') {
                this.loadSeasons(details.number_of_seasons);
            }
        } else {
            console.error('Failed to load media details. Check API key or ID.');
            const detailTitle = document.getElementById('detailTitle');
            const detailDescription = document.getElementById('detailDescription');
            if (detailTitle && detailDescription) {
                detailTitle.textContent = 'Error';
                detailDescription.textContent = 'Failed to load media details. Please check the ID or try again later.';
            }
        }
    }

    async loadTrailer() {
        const endpoint = `/${this.mediaType}/${this.mediaId}/videos`;
        const data = await this.fetchFromAPI(endpoint);
        if (data && data.results && data.results.length > 0) {
            const trailer = data.results.find(video => video.type === 'Trailer' && video.site === 'YouTube');
            if (trailer) {
                const player = document.getElementById('playerSection');
                if (player) {
                    player.innerHTML = `<iframe width="100%" height="500" src="${this.youtubeBaseUrl}${trailer.key}" frameborder="0" allowfullscreen></iframe>`;
                }
            }
        }
    }

    renderDetails(details) {
        const detailTitle = document.getElementById('detailTitle');
        const detailDescription = document.getElementById('detailDescription');
        const detailTags = document.getElementById('detailTags');
        const detailMeta = document.getElementById('detailMeta');
        const detailPoster = document.getElementById('detailPoster');
        const castList = document.getElementById('castList');

        console.log('DOM elements check:', {
            detailTitle: !!detailTitle,
            detailDescription: !!detailDescription,
            detailTags: !!detailTags,
            detailMeta: !!detailMeta,
            detailPoster: !!detailPoster,
            castList: !!castList
        });

        if (detailTitle) {
            detailTitle.textContent = details.title || details.name || 'No title';
        } else {
            console.error('detailTitle not found');
        }

        if (detailDescription) {
            detailDescription.textContent = details.overview || 'No description';
        } else {
            console.error('detailDescription not found');
        }

        if (detailPoster) {
            if (details.poster_path) {
                detailPoster.src = `${this.imageBaseUrl}${details.poster_path}`;
                detailPoster.style.display = 'block';
            } else {
                detailPoster.style.display = 'none';
            }
        } else {
            console.error('detailPoster not found');
        }

        if (detailTags) {
            const genres = details.genres.map(genre => `<span>${genre.name}</span>`).join('');
            const year = new Date(details.release_date || details.first_air_date).getFullYear() || 'Unknown';
            const runtime = this.mediaType === 'movie' 
                ? (details.runtime ? `<span class="duration"><i class="fas fa-clock"></i>${utils.formatRuntime(details.runtime)}</span>` : 'N/A')
                : (details.number_of_seasons ? `<span class="meta-season">${details.number_of_seasons} Season${details.number_of_seasons > 1 ? 's' : ''}</span>` : 'N/A');
            const rating = details.vote_average ? details.vote_average.toFixed(1) : 'N/A';

            detailTags.innerHTML = `
                ${genres}
                <span>${year}</span>
                ${runtime}
                <span class="meta-rating"><i class="fas fa-star"></i> ${rating}</span>
            `;
        } else {
            console.error('detailTags not found');
        }

        if (detailMeta) {
            const country = details.production_countries?.[0]?.name || 'Unknown';
            const releaseDate = details.release_date || details.first_air_date || 'Unknown';
            const production = details.production_companies?.map(p => p.name).join(', ') || 'Unknown';
            detailMeta.innerHTML = `
                <span>Country: ${country}</span>
                <span>Date Release: ${utils.formatDate(releaseDate)}</span>
                <span>Production: ${production}</span>
            `;
        } else {
            console.error('detailMeta not found');
        }

        if (castList) {
            const cast = details.credits?.cast?.slice(0, 10) || []; // Giới hạn 10 người
            if (cast.length > 0) {
                castList.innerHTML = cast.map(actor => `
                    <div class="cast-item">
                        <img class="cast-poster" src="${actor.profile_path ? `${this.imageBaseUrl}${actor.profile_path}` : 'https://via.placeholder.com/80x80?text=No+Image'}" alt="${actor.name || 'Unknown Actor'}">
                        <div class="cast-info">
                            <div class="cast-character">${actor.character || 'Unknown Role'}</div>
                            <div class="cast-name">${actor.name || 'Unknown Actor'}</div>
                        </div>
                    </div>
                `).join('');
            } else {
                castList.innerHTML = '<p>No cast information available.</p>';
            }
        } else {
            console.error('castList not found in DOM');
            castList.innerHTML = '<p>Cast section not loaded properly.</p>'; // Thêm fallback nếu DOM lỗi
        }
    }

    async loadSeasons(numberOfSeasons) {
        const seasonsList = document.getElementById('seasonsList');
        if (!seasonsList || this.mediaType !== 'tv') return;

        seasonsList.innerHTML = '';
        for (let i = 1; i <= numberOfSeasons; i++) {
            const seasonData = await this.fetchFromAPI(`/tv/${this.mediaId}/season/${i}`);
            if (seasonData && seasonData.episodes) {
                seasonsList.innerHTML += `
                    <div class="season">
                        <h3>Season ${i}</h3>
                        <div class="episode-list">
                            ${seasonData.episodes.map(episode => `
                                <div class="episode-item">
                                    <div class="episode-poster" style="background-image: url(${episode.still_path ? this.imageBaseUrl + episode.still_path : 'https://via.placeholder.com/100x56?text=No+Image'})"></div>
                                    <div class="episode-info">
                                        <div class="cast-character">Episode ${episode.episode_number}: ${episode.name}</div>
                                        <div class="episode-meta">${utils.formatDate(episode.air_date)} • ${utils.formatRuntime(episode.runtime)}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }
    }

    async loadSimilarMedia() {
        try {
            console.log(`Fetching similar for ${this.mediaType}/${this.mediaId}`);
            const url = `${this.baseUrl}/${this.mediaType}/${this.mediaId}/similar?api_key=${this.apiKey}&region=${this.selectedCountry}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API request failed: ${response.status}`);
            const data = await response.json();
            console.log('Similar data:', data);
            if (data && data.results && data.results.length > 0) {
                const itemsWithDetails = await Promise.all(data.results.slice(0, 8).map(async (item) => {
                    const type = this.mediaType;
                    const detailsEndpoint = type === 'tv' ? `/tv/${item.id}` : `/movie/${item.id}`;
                    const details = await this.fetchFromAPI(detailsEndpoint);
                    return { ...item, media_type: type, details };
                }));
                this.renderSimilar(itemsWithDetails);
            } else {
                const grid = document.getElementById('recommendationsGrid');
                if (grid) grid.innerHTML = '<p>No similar movies or series found.</p>';
            }
        } catch (error) {
            console.error('Error loading similar:', error);
            const grid = document.getElementById('recommendationsGrid');
            if (grid) grid.innerHTML = '<p>Error loading similar content. Please try again later.</p>';
        }
    }

    renderSimilar(items) {
        const grid = document.getElementById('recommendationsGrid');
        if (grid) {
            grid.innerHTML = items.map(item => {
                const title = item.title || item.name;
                let meta = '<span class="meta-tag hd-tag">HD</span>';
                if (item.media_type === 'tv') {
                    const seasonsCount = item.details?.number_of_seasons || 0;
                    const seasonLabel = seasonsCount > 1 ? 'Seasons' : 'Season';
                    meta += `<span class="meta-season">${seasonLabel} ${seasonsCount}</span>`;
                } else {
                    meta += `<span class="duration"><i class="fas fa-clock"></i>${utils.formatRuntime(item.details?.runtime)}</span>`;
                }
                return `
                    <div class="recommended-item" data-id="${item.id}" data-type="${item.media_type}">
                        <div class="recommended-bg" style="background-image: url(${item.poster_path ? this.imageBaseUrl + item.poster_path : 'https://via.placeholder.com/300x450?text=No+Image'})"></div>
                        <div class="recommended-info">
                            <div class="new-release-title">${title}</div>
                            <div class="new-release-meta">${meta}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    loadComments() {
        const commentsList = document.getElementById('commentsList');
        if (!commentsList) return;
        let comments = [];
        try {
            comments = JSON.parse(localStorage.getItem(`comments_${this.mediaId}_${this.mediaType}`) || '[]');
        } catch (error) {
            console.error('Error reading comments from localStorage:', error);
            commentsList.innerHTML = '<p>No comments yet.</p>';
            return;
        }
        if (comments.length === 0) {
            commentsList.innerHTML = '<p>No comments yet.</p>';
            return;
        }
        const colorClasses = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5', 'color-6', 'color-7', 'color-8', 'color-9', 'color-10'];
        commentsList.innerHTML = comments.map((comment, index) => {
            const colorIndex = index % 10;
            const colorClass = colorClasses[colorIndex];
            const userName = `user${index + 1}`;
            return `
                <div class="comment" data-comment-id="${index}">
                    <div class="comment-user">
                        <span class="${colorClass}"></span>
                        <span>${userName}</span>
                        <span class="comment-time">${new Date(comment.timestamp).toLocaleString()}</span>
                    </div>
                    <p>${comment.text}</p>
                    <div class="comment-actions">
                        <button class="edit-comment-btn" data-comment-id="${index}">Edit</button>
                        <button class="delete-comment-btn" data-comment-id="${index}">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
        document.querySelectorAll('.edit-comment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const commentId = e.target.dataset.commentId;
                this.editComment(commentId);
            });
        });
        document.querySelectorAll('.delete-comment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const commentId = e.target.dataset.commentId;
                this.deleteComment(commentId);
            });
        });
    }

    addComment(text) {
        let comments = [];
        try {
            comments = JSON.parse(localStorage.getItem(`comments_${this.mediaId}_${this.mediaType}`) || '[]');
        } catch (error) {
            console.error('Error reading comments from localStorage:', error);
        }
        const userName = `user${comments.length + 1}`;
        const comment = {
            user: userName,
            text: text,
            timestamp: Date.now()
        };
        comments.push(comment);
        localStorage.setItem(`comments_${this.mediaId}_${this.mediaType}`, JSON.stringify(comments));
        this.loadComments();
        this.showNotification('Bình luận đã được thêm!', 'success');
    }

    editComment(commentId) {
        const commentInput = document.getElementById('commentInput');
        if (!commentInput) return;
        let comments = [];
        try {
            comments = JSON.parse(localStorage.getItem(`comments_${this.mediaId}_${this.mediaType}`) || '[]');
        } catch (error) {
            console.error('Error reading comments from localStorage:', error);
            return;
        }
        const comment = comments[commentId];
        if (!comment) return;
        commentInput.value = comment.text;
        commentInput.focus();
        const postCommentBtn = document.getElementById('postComment');
        if (postCommentBtn) {
            postCommentBtn.textContent = 'Lưu chỉnh sửa';
            postCommentBtn.dataset.editId = commentId;
            postCommentBtn.onclick = () => {
                if (commentInput.value.trim()) {
                    comments[commentId].text = commentInput.value;
                    comments[commentId].timestamp = Date.now();
                    localStorage.setItem(`comments_${this.mediaId}_${this.mediaType}`, JSON.stringify(comments));
                    this.loadComments();
                    this.showNotification('Bình luận đã được chỉnh sửa!', 'success');
                    commentInput.value = '';
                    postCommentBtn.textContent = 'Đăng';
                    delete postCommentBtn.dataset.editId;
                    this.setupCommentButton();
                }
            };
        }
    }

    deleteComment(commentId) {
        let comments = [];
        try {
            comments = JSON.parse(localStorage.getItem(`comments_${this.mediaId}_${this.mediaType}`) || '[]');
        } catch (error) {
            console.error('Error reading comments from localStorage:', error);
            return;
        }
        comments = comments.filter((_, index) => index !== parseInt(commentId));
        localStorage.setItem(`comments_${this.mediaId}_${this.mediaType}`, JSON.stringify(comments));
        this.loadComments();
        this.showNotification('Bình luận đã được xóa!', 'success');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    setupCommentButton() {
        const postCommentBtn = document.getElementById('postComment');
        const commentInput = document.getElementById('commentInput');
        if (postCommentBtn && commentInput) {
            postCommentBtn.onclick = () => {
                if (commentInput.value.trim()) {
                    this.addComment(commentInput.value);
                    commentInput.value = '';
                }
            };
        }
    }

    renderCountryModal() {
        const countryModal = document.getElementById('countryModal');
        if (countryModal) {
            const countryList = countryModal.querySelector('.country-list');
            if (countryList) {
                countryList.innerHTML = this.countries.map(country => `
                    <li class="country-item ${country.iso_3166_1 === this.selectedCountry ? 'selected' : ''}" data-country-code="${country.iso_3166_1}">
                        ${country.english_name}
                    </li>
                `).join('');
            }
        }
    }

    renderGenreModal() {
        const genreModal = document.getElementById('genreModal');
        if (genreModal) {
            const genreList = genreModal.querySelector('.genre-list');
            if (genreList) {
                genreList.innerHTML = this.genres.map(genre => `
                    <li class="genre-item ${genre.id === this.selectedGenre ? 'selected' : ''}" data-genre-id="${genre.id}">
                        ${genre.name}
                    </li>
                `).join('');
            }
        }
    }

    showCountryModal() {
        const countryModal = document.getElementById('countryModal');
        if (countryModal) {
            countryModal.classList.add('active');
        }
    }

    hideCountryModal() {
        const countryModal = document.getElementById('countryModal');
        if (countryModal) {
            countryModal.classList.remove('active');
        }
    }

    selectCountry(countryCode) {
        this.selectedCountry = countryCode;
        this.renderCountryModal();
        this.hideCountryModal();
        this.loadMediaDetails();
        this.loadSimilarMedia();
    }

    showGenreModal() {
        const genreModal = document.getElementById('genreModal');
        if (genreModal) {
            genreModal.classList.add('active');
        }
    }

    hideGenreModal() {
        const genreModal = document.getElementById('genreModal');
        if (genreModal) {
            genreModal.classList.remove('active');
        }
    }

    selectGenre(genreId) {
        this.selectedGenre = genreId ? parseInt(genreId) : null;
        this.renderGenreModal();
        this.hideGenreModal();
        this.loadMediaDetails();
        this.loadSimilarMedia();
    }

    redirectToLogin() {
        window.location.href = 'LoSi.html';
    }

    redirectToMovieDetails(movieId, mediaType) {
        window.location.href = `detail.html?id=${movieId}&type=${mediaType}`;
    }

    setupEventListeners() {
        // Xử lý recommended items
        const recItems = document.querySelectorAll('.recommended-item');
        recItems.forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const type = item.dataset.type;
                this.redirectToMovieDetails(id, type);
            });
        });

        // Xử lý comment input
        const commentInput = document.getElementById('commentInput');
        if (commentInput) {
            commentInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const postCommentBtn = document.getElementById('postComment');
                    if (postCommentBtn.dataset.editId) {
                        postCommentBtn.click();
                    } else if (commentInput.value.trim()) {
                        this.addComment(commentInput.value);
                        commentInput.value = '';
                    }
                }
            });
        }

        // Xử lý search
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');
        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', () => this.handleSearch());
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });
            searchInput.addEventListener('input', () => {
                clearTimeout(this.searchTimeout);
                const query = searchInput.value.trim();
                if (query) {
                    this.searchTimeout = setTimeout(() => this.handleSearchSuggestions(query), 1000);
                } else {
                    this.hideSearchSuggestions();
                }
            });
            searchInput.addEventListener('blur', () => {
                setTimeout(() => this.hideSearchSuggestions(), 200);
            });
            document.addEventListener('click', (e) => {
                if (!searchInput.contains(e.target) && !document.getElementById('searchSuggestions').contains(e.target)) {
                    this.hideSearchSuggestions();
                }
            });
        }

        // Xử lý nav-links (Home, Genre, Country)
        const navLinks = document.querySelectorAll('.nav-links a');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const category = e.target.getAttribute('data-category');
                navLinks.forEach(l => l.classList.remove('active'));
                e.target.classList.add('active');
                if (category === 'home') {
                    window.location.href = 'index.html';
                } else if (category === 'genre') {
                    this.showGenreModal();
                } else if (category === 'country') {
                    this.showCountryModal();
                }
            });
        });

        // Xử lý nav-categories (Movies, Series, Animation)
        const navCategories = document.querySelectorAll('.nav-categories a');
        navCategories.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const type = e.target.getAttribute('data-type');
                navCategories.forEach(l => l.classList.remove('active'));
                e.target.classList.add('active');
                window.location.href = `view-all.html?category=recommended&type=${type}&page=1`;
            });
        });

        // Xử lý loginBtn
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                loginBtn.classList.add('active');
                this.redirectToLogin();
            });
        }

        // Xử lý country modal
        const countryModal = document.getElementById('countryModal');
        if (countryModal) {
            countryModal.addEventListener('click', (e) => {
                if (e.target === countryModal) this.hideCountryModal();
            });
            const countryModalClose = document.getElementById('countryModalClose');
            if (countryModalClose) {
                countryModalClose.addEventListener('click', () => this.hideCountryModal());
            }
            const countryItems = countryModal.querySelectorAll('.country-item');
            countryItems.forEach(item => {
                item.addEventListener('click', () => {
                    this.selectCountry(item.dataset.countryCode);
                });
            });
        }

        // Xử lý genre modal
        const genreModal = document.getElementById('genreModal');
        if (genreModal) {
            genreModal.addEventListener('click', (e) => {
                if (e.target === genreModal) this.hideGenreModal();
            });
            const genreModalClose = document.getElementById('genreModalClose');
            if (genreModalClose) {
                genreModalClose.addEventListener('click', () => this.hideGenreModal());
            }
            const genreItems = genreModal.querySelectorAll('.genre-item');
            genreItems.forEach(item => {
                item.addEventListener('click', () => {
                    this.selectGenre(item.dataset.genreId);
                });
            });
        }

        this.setupCommentButton();
        this.loadComments();
    }

    async handleSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            const query = searchInput.value.trim();
            if (!query) return;
            try {
                const endpoint = `/search/multi?api_key=${this.apiKey}&query=${encodeURIComponent(query)}&region=${this.selectedCountry}`;
                const data = await this.fetchFromAPI(endpoint);
                if (data && data.results) {
                    this.renderSearchSuggestions(data.results.slice(0, 5));
                }
            } catch (error) {
                console.error('Search error:', error);
            }
        }
    }

    async handleSearchSuggestions(query) {
        try {
            const endpoint = `/search/multi?api_key=${this.apiKey}&query=${encodeURIComponent(query)}&region=${this.selectedCountry}`;
            const data = await this.fetchFromAPI(endpoint);
            if (data && data.results) {
                this.renderSearchSuggestions(data.results.slice(0, 5));
            }
        } catch (error) {
            console.error('Search suggestions error:', error);
        }
    }

    renderSearchSuggestions(items) {
        const suggestions = document.getElementById('searchSuggestions');
        if (suggestions) {
            suggestions.innerHTML = items.map(item => `
                <div class="suggestion-item" data-id="${item.id}" data-type="${item.media_type || 'movie'}">
                    <div class="suggestion-poster" style="background-image: url(${item.poster_path ? this.imageBaseUrl + item.poster_path : 'https://via.placeholder.com/40x60?text=No+Image'})"></div>
                    <div class="suggestion-info">
                        <div class="suggestion-title">${item.title || item.name}</div>
                        <div class="suggestion-meta">${item.media_type === 'tv' ? 'Series' : 'Movie'} • ${new Date(item.release_date || item.first_air_date).getFullYear() || 'Unknown'}</div>
                    </div>
                </div>
            `).join('');
            suggestions.classList.add('active');
            document.querySelectorAll('.suggestion-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.id;
                    const type = item.dataset.type;
                    this.redirectToMovieDetails(id, type);
                    suggestions.classList.remove('active');
                });
            });
        }
    }

    hideSearchSuggestions() {
        const suggestions = document.getElementById('searchSuggestions');
        if (suggestions) {
            suggestions.classList.remove('active');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded triggered');
    new MovieDetailApp();
});

const utils = {
    formatDate: (dateString) => {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    },
    formatRuntime: (minutes) => {
        if (!minutes || isNaN(minutes)) return 'N/A';
        const hours = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        const secs = 0;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
};
