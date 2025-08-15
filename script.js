class MovieApp {
    constructor() {
        this.apiKey = '829a2e466ec427b28631f61e16570988';
        this.baseUrl = 'https://api.themoviedb.org/3';
        this.imageBaseUrl = 'https://image.tmdb.org/t/p/w500';
        this.backdropBaseUrl = 'https://image.tmdb.org/t/p/w1280';
        
        this.movieGenres = {};
        this.tvGenres = {};
        this.currentMovies = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.sectionStates = {
            trendingGrid: false,
            newReleases: false,
            newReleaseSeries: false,
            recommended: false
        };
        this.currentHeroIndex = 0;
        this.currentRecentStart = 0;
        this.selectedType = 'all';
        this.searchTimeout = null;
        this.countries = [];
        this.selectedCountry = 'US';
        this.genres = [];
        this.selectedGenre = null;

        this.init();
    }

    async init() {
        await this.fetchGenres();
        await this.fetchCountries();
        await this.loadPopularMovies();
        await this.loadTrendingMovies();
        await this.loadNewReleases();
        await this.loadNewSeries();
        await this.loadRecommended();
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
            if (endpoint.includes('search') || endpoint.includes('discover') || endpoint.includes('trending') || endpoint.includes('popular') || endpoint.includes('now_playing') || endpoint.includes('airing_today')) {
                url += `&region=${this.selectedCountry}`;
                if (this.selectedGenre && (endpoint.includes('discover'))) {
                    url += `&with_genres=${this.selectedGenre}`;
                }
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error('API request failed');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return null;
        }
    }

    async getDetails(id, media_type) {
        const endpoint = media_type === 'tv' ? `/tv/${id}` : `/movie/${id}`;
        return await this.fetchFromAPI(endpoint);
    }

    async searchMovies(query) {
        const endpoint = `/search/multi`;
        let url = `${this.baseUrl}${endpoint}?api_key=${this.apiKey}&query=${encodeURIComponent(query)}&region=${this.selectedCountry}`;
        if (this.selectedGenre) {
            url += `&with_genres=${this.selectedGenre}`;
        }
        const response = await fetch(url);
        return await response.json();
    }

    async loadPopularMovies() {
        const endpoint = this.selectedGenre ? `/discover/movie` : `/movie/popular`;
        const data = await this.fetchFromAPI(endpoint);
        if (data && data.results) {
            this.currentMovies = await Promise.all(data.results.slice(0, 5).map(async (item) => {
                const details = await this.getDetails(item.id, item.media_type || 'movie');
                return { ...item, details };
            }));
            this.totalPages = data.total_pages;
            this.updateHeroSection(this.currentMovies[0]);
        }
    }

    async loadTrendingMovies() {
        const endpoint = this.selectedGenre ? `/discover/movie` : `/trending/all/week`;
        const data = await this.fetchFromAPI(endpoint);
        if (data && data.results) {
            this.currentMovies = await Promise.all(data.results.slice(0, 3).map(async (item) => {
                const details = await this.getDetails(item.id, item.media_type);
                return { ...item, details };
            }));
            this.renderTrendingMovies(this.currentMovies);
        }
    }

    async loadNewReleases() {
        const endpoint = this.selectedGenre ? `/discover/movie` : `/movie/now_playing`;
        const data = await this.fetchFromAPI(endpoint);
        if (data && data.results) {
            console.log('Raw data from /movie/now_playing:', data.results); // Log để kiểm tra
            const moviesWithDetails = await Promise.all(data.results.slice(0, 4).map(async (movie) => {
                const details = await this.getDetails(movie.id, 'movie');
                return { ...movie, details };
            }));
            this.currentMovies = moviesWithDetails;
            this.recentItems = data.results; // Giữ dữ liệu thô cho tham chiếu nếu cần
            this.renderNewReleases(moviesWithDetails);
            this.renderRecentlyUpdated(moviesWithDetails.slice(0, 3)); // Sử dụng moviesWithDetails cho Recently Updated
        }
    }

    async loadNewSeries() {
        const endpoint = this.selectedGenre ? `/discover/tv` : `/tv/airing_today`;
        const data = await this.fetchFromAPI(endpoint);
        if (data && data.results) {
            const seriesWithDetails = await Promise.all(data.results.slice(0, 4).map(async (item) => {
                const details = await this.getDetails(item.id, 'tv');
                return { ...item, details };
            }));
            this.currentMovies = seriesWithDetails;
            this.renderNewSeries(seriesWithDetails);
        }
    }

    async loadRecommended() {
        const endpoint = this.selectedGenre ? `/discover/movie` : `/trending/all/day`;
        const data = await this.fetchFromAPI(endpoint);
        if (data && data.results) {
            const itemsWithDetails = await Promise.all(data.results.map(async (item) => {
                const details = await this.getDetails(item.id, item.media_type);
                return { ...item, details };
            }));
            this.currentMovies = itemsWithDetails;
            this.filterAndRenderRecommended();
        }
    }

    filterAndRenderRecommended() {
        let filteredItems = this.currentMovies;
        if (this.selectedType !== 'all') {
            filteredItems = this.currentMovies.filter(item => {
                const genres = item.genre_ids || [];
                return this.selectedType === 'Movies' ? item.media_type === 'movie' && genres.length > 0 :
                       this.selectedType === 'Series' ? item.media_type === 'tv' && genres.length > 0 :
                       this.selectedType === 'Animation' && genres.some(id => [16, 10762].includes(id));
            });
        }
        this.renderRecommended(filteredItems.slice(0, 8));
    }

    updateHeroSection(item) {
        if (!item) return;

        const heroTitle = document.getElementById('heroTitle');
        const heroDescription = document.getElementById('heroDescription');
        const heroMeta = document.getElementById('heroMeta');
        const heroSection = document.getElementById('heroSection');

        heroTitle.textContent = item.title || item.name || 'Loading...';
        heroDescription.textContent = item.overview || 'No description available';
        
        if (item.backdrop_path) {
            heroSection.style.backgroundImage = `url(${this.backdropBaseUrl}${item.backdrop_path})`;
        } else {
            heroSection.style.backgroundImage = `linear-gradient(135deg, #1a4b84, #2d5aa0, #4a90e2)`;
        }

        const genres = this.getGenres(item);
        const releaseYear = item.release_date || item.first_air_date ? new Date(item.release_date || item.first_air_date).getFullYear() : 'Unknown';
        let duration = 'N/A';
        if (item.details) {
            if (item.media_type === 'tv' && item.details.episode_run_time && item.details.episode_run_time.length > 0) {
                duration = utils.formatRuntime(item.details.episode_run_time[0]);
            } else if (item.media_type === 'movie' && item.details.runtime) {
                duration = utils.formatRuntime(item.details.runtime);
            }
        }

        heroMeta.innerHTML = `
            ${genres.map(genre => `<span class="meta-tag">${genre}</span>`).join('')}
            <span class="meta-tag"><i class="fas fa-calendar"></i> ${releaseYear}</span>
            <span class="meta-tag"><i class="fas fa-clock"></i> ${duration}</span>
            <span class="meta-tag meta-rating"><i class="fas fa-star"></i> ${item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}</span>
        `;
    }

    renderTrendingMovies(items) {
        const trendingGrid = document.getElementById('trendingGrid');
        
        trendingGrid.innerHTML = items.map(item => {
            let duration = 'N/A';
            if (item.details) {
                if (item.media_type === 'tv' && item.details.episode_run_time && item.details.episode_run_time.length > 0) {
                    duration = utils.formatRuntime(item.details.episode_run_time[0]);
                } else if (item.media_type === 'movie' && item.details.runtime) {
                    duration = utils.formatRuntime(item.details.runtime);
                }
            }
            const rating = item.vote_average ? `★ ${item.vote_average.toFixed(1)}` : '★ N/A';
            const genres = this.getGenres(item);

            return `
                <div class="trending-item" data-movie-id="${item.id}" data-media-type="${item.media_type}">
                    <div class="trending-poster" style="background-image: url(${item.poster_path ? this.imageBaseUrl + item.poster_path : ''})">
                        <div class="movie-duration"><i class="fas fa-clock"></i> ${duration}</div>
                        <div class="movie-rating">${rating}</div>
                        <div class="play-button"><i class="fas fa-play-circle"></i></div>
                    </div>
                    <div class="trending-info">
                        <div class="trending-title-row">
                            <div class="trending-title">${item.title || item.name}</div>
                            <div class="trending-genres">
                                ${genres.map(genre => `<span class="trending-tag ${genre.toLowerCase().replace(' ', '-')}" title="${genre}">${genre}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add click event listeners for trending items
        this.addPosterClickListeners('.trending-item');
    }

    getGenres(item) {
        if (!item.genre_ids || !Array.isArray(item.genre_ids)) return ['N/A'];
        
        const genres = item.media_type === 'tv' ? this.tvGenres : this.movieGenres;
        return item.genre_ids
            .map(id => genres[id] || 'N/A')
            .filter(genre => genre !== 'N/A')
            .slice(0, 3);
    }

    renderNewReleases(movies) {
        const newReleases = document.getElementById('newReleases');
        
        newReleases.innerHTML = movies.map(movie => {
            const duration = movie.details && movie.details.runtime ? utils.formatRuntime(movie.details.runtime) : 'N/A';
            return `
                <div class="new-release-item" data-movie-id="${movie.id}" data-media-type="movie">
                    <div class="new-release-poster" style="background-image: url(${movie.poster_path ? this.imageBaseUrl + movie.poster_path : ''})"></div>
                    <div class="new-release-info">
                        <div class="new-release-title">${movie.title}</div>
                        <div class="new-release-meta">
                            <span class="hd-tag">HD</span>
                            <span class="duration"><i class="fas fa-clock"></i> ${duration}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add click event listeners for new release items
        this.addPosterClickListeners('.new-release-item');
    }

    renderNewSeries(series) {
        const newReleaseSeries = document.getElementById('newReleaseSeries');
        
        newReleaseSeries.innerHTML = series.map(item => {
            const season = item.details && item.details.number_of_seasons ? `Season ${item.details.number_of_seasons}` : 'Season N/A';
            return `
                <div class="new-release-series-item" data-movie-id="${item.id}" data-media-type="tv">
                    <div class="new-release-series-poster" style="background-image: url(${item.poster_path ? this.imageBaseUrl + item.poster_path : ''})"></div>
                    <div class="new-release-series-info">
                        <div class="new-release-series-title">${item.name}</div>
                        <div class="new-release-series-meta">
                            <span class="hd-tag">HD</span>
                            <span class="duration">${season}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add click event listeners for new series items
        this.addPosterClickListeners('.new-release-series-item');
    }

    renderRecommended(items) {
        const recommended = document.getElementById('recommended');
        
        recommended.innerHTML = items.map(item => {
            const isSeries = item.media_type === 'tv';
            const metaContent = isSeries
                ? (item.details && item.details.number_of_seasons ? `Season ${item.details.number_of_seasons}` : 'Season N/A')
                : (item.details && item.details.runtime ? `<i class="fas fa-clock"></i> ${utils.formatRuntime(item.details.runtime)}` : '<i class="fas fa-clock"></i> N/A');
            const icon = isSeries ? '' : '';
            return `
                <div class="recommended-item" data-movie-id="${item.id}" data-media-type="${item.media_type}">
                    <div class="recommended-bg" style="background-image: url(${item.backdrop_path ? this.backdropBaseUrl + item.backdrop_path : ''})"></div>
                    <div class="recommended-info">
                        <div class="new-release-title">${item.title || item.name}</div>
                        <div class="new-release-meta">
                            <span class="hd-tag">HD</span>
                            <span class="duration">${metaContent}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add click event listeners for recommended items
        this.addPosterClickListeners('.recommended-item');
    }

    renderRecentlyUpdated() {
    const recentlyUpdated = document.getElementById('recentlyUpdated');
    const items = this.recentItems || [];
    const start = this.currentRecentStart;
    const end = start + 5;
    const displayItems = items.slice(start, end);
    
    recentlyUpdated.innerHTML = `
        <div class="recent-container">
            ${this.currentRecentStart > 0 ? '<button class="scroll-btn-prev" id="scrollBtnPrev"><i class="fas fa-circle-arrow-left"></i></button>' : ''}
            <div class="recent-items-wrapper" id="recentItemsWrapper">
                ${displayItems.map(item => `
                    <div class="recent-item" data-movie-id="${item.id}" data-media-type="${item.media_type || 'movie'}">
                        <div class="recent-poster" style="background-image: url(${item.poster_path ? this.imageBaseUrl + item.poster_path : ''})"></div>
                        <div class="recent-info">
                            <h4>${item.title || item.name}</h4>
                            <p>Rating: ${item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}</p>
                            <p>${item.release_date || item.first_air_date || 'Unknown'}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
            ${end < items.length ? '<button class="scroll-btn-next" id="scrollBtnNext"><i class="fas fa-circle-arrow-right"></i></button>' : ''}
        </div>
    `;
    
    const scrollBtnNext = document.getElementById('scrollBtnNext');
    if (scrollBtnNext) {
        scrollBtnNext.addEventListener('click', () => {
            this.currentRecentStart += 1;
            this.renderRecentlyUpdated();
        });
    }
    
    const scrollBtnPrev = document.getElementById('scrollBtnPrev');
    if (scrollBtnPrev) {
        scrollBtnPrev.addEventListener('click', () => {
            this.currentRecentStart = Math.max(0, this.currentRecentStart - 1);
            this.renderRecentlyUpdated();
        });
    }

    // Add click event listeners for recent items
    this.addPosterClickListeners('.recent-item');
}

// Define the method to handle poster clicks
addPosterClickListeners(selector) {
    const items = document.querySelectorAll(selector);
    items.forEach(item => {
        item.addEventListener('click', () => {
            const movieId = item.dataset.movieId;
            const mediaType = item.dataset.mediaType;
            if (movieId) {
                this.redirectToMovieDetails(movieId, mediaType);
            } else {
                console.error('Movie ID is missing for item:', item);
            }
        });
    });
}

// Assume redirectToMovieDetails is defined elsewhere
redirectToMovieDetails(movieId, mediaType) {
    window.location.href = `detail.html?id=${movieId}&type=${mediaType}`;
}

    renderSearchSuggestions(items) {
        const suggestionsContainer = document.getElementById('searchSuggestions');
        suggestionsContainer.innerHTML = items.length === 0
            ? '<div class="suggestion-item">No results found</div>'
            : items.slice(0, 8).map(item => {
                const title = item.title || item.name || 'Unknown';
                const year = (item.release_date || item.first_air_date) ? new Date(item.release_date || item.first_air_date).getFullYear() : 'N/A';
                const type = item.media_type === 'tv' ? 'Series' : 'Movie';
                return `
                    <div class="suggestion-item" data-movie-id="${item.id}" data-media-type="${item.media_type}">
                        <div class="suggestion-poster" style="background-image: url(${item.poster_path ? this.imageBaseUrl + item.poster_path : ''})"></div>
                        <div class="suggestion-info">
                            <div class="suggestion-title">${title}</div>
                            <div class="suggestion-meta">${type} • ${year}</div>
                        </div>
                    </div>
                `;
            }).join('');
        suggestionsContainer.classList.add('active');

        // Add click event listeners for search suggestion items
        this.addPosterClickListeners('.suggestion-item');
    }

    hideSearchSuggestions() {
        const suggestionsContainer = document.getElementById('searchSuggestions');
        suggestionsContainer.classList.remove('active');
    }

    updateHeroByIndex(index) {
        if (this.currentMovies[index]) {
            this.currentHeroIndex = index;
            this.updateHeroSection(this.currentMovies[index]);
            const dots = document.querySelectorAll('.pagination-dot');
            dots.forEach(d => d.classList.remove('active'));
            dots[index].classList.add('active');
        }
    }

    redirectToViewAll(category) {
        window.location.href = `view-all.html?category=${category}&page=1`;
    }

    redirectToLogin() {
        window.location.href = 'LoSi.html';
    }

    redirectToMovieDetails(movieId, mediaType) {
        window.location.href = `detail.html?id=${movieId}&type=${mediaType}`;
    }

    addPosterClickListeners(selector) {
        const items = document.querySelectorAll(selector);
        items.forEach(item => {
            item.addEventListener('click', () => {
                const movieId = item.dataset.movieId;
                const mediaType = item.dataset.mediaType;
                this.redirectToMovieDetails(movieId, mediaType);
            });
        });
    }

    renderCountryModal() {
        const modal = document.createElement('div');
        modal.className = 'country-modal';
        modal.id = 'countryModal';
        modal.innerHTML = `
            <div class="country-modal-content">
                <button class="country-modal-close" id="countryModalClose">&times;</button>
                <h2>Chọn Quốc Gia</h2>
                <ul class="country-list">
                    ${this.countries.map(country => `
                        <li class="country-item${country.iso_3166_1 === this.selectedCountry ? ' selected' : ''}" 
                            data-country-code="${country.iso_3166_1}">
                            ${country.english_name} (${country.iso_3166_1})
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
        document.body.appendChild(modal);
    }

    renderGenreModal() {
        const modal = document.createElement('div');
        modal.className = 'genre-modal';
        modal.id = 'genreModal';
        modal.innerHTML = `
            <div class="genre-modal-content">
                <button class="genre-modal-close" id="genreModalClose">&times;</button>
                <h2>Chọn Thể Loại</h2>
                <ul class="genre-list">
                    <li class="genre-item${this.selectedGenre === null ? ' selected' : ''}" data-genre-id="none">Tất Cả</li>
                    ${this.genres.map(genre => `
                        <li class="genre-item${genre.id === this.selectedGenre ? ' selected' : ''}" 
                            data-genre-id="${genre.id}">
                            ${genre.name}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
        document.body.appendChild(modal);
    }

    showCountryModal() {
        const modal = document.getElementById('countryModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    hideCountryModal() {
        const modal = document.getElementById('countryModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    showGenreModal() {
        const modal = document.getElementById('genreModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    hideGenreModal() {
        const modal = document.getElementById('genreModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    selectCountry(countryCode) {
        this.selectedCountry = countryCode;
        localStorage.setItem('selectedCountry', countryCode);
        this.hideCountryModal();
        this.loadPopularMovies();
        this.loadTrendingMovies();
        this.loadNewReleases();
        this.loadNewSeries();
        this.loadRecommended();
    }

    selectGenre(genreId) {
        this.selectedGenre = genreId === 'none' ? null : genreId;
        localStorage.setItem('selectedGenre', this.selectedGenre);
        this.hideGenreModal();
        this.loadPopularMovies();
        this.loadTrendingMovies();
        this.loadNewReleases();
        this.loadNewSeries();
        this.loadRecommended();
    }

    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const heroSection = document.getElementById('heroSection');
        const loginBtn = document.getElementById('loginBtn');
        const suggestionsContainer = document.getElementById('searchSuggestions');
        const countryLink = document.querySelector('.nav-links a[data-category="country"]');
        const genreLink = document.querySelector('.nav-links a[data-category="genre"]');

        if (countryLink) {
            countryLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showCountryModal();
            });
        }

        if (genreLink) {
            genreLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showGenreModal();
            });
        }

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

        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Redirecting to Login/Signup page...');
                this.redirectToLogin();
            });
        }

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

        suggestionsContainer.addEventListener('click', (e) => {
            const suggestionItem = e.target.closest('.suggestion-item');
            if (suggestionItem) {
                const movieId = suggestionItem.dataset.movieId;
                const mediaType = suggestionItem.dataset.mediaType;
                this.redirectToMovieDetails(movieId, mediaType);
                this.hideSearchSuggestions();
                searchInput.value = '';
            }
        });

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                this.hideSearchSuggestions();
            }
        });

        const dots = document.querySelectorAll('.pagination-dot');
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                this.updateHeroByIndex(index);
            });
        });

        heroSection.addEventListener('click', (e) => {
            if (!e.target.closest('.hero-buttons') && !e.target.closest('.hero-pagination')) {
                let newIndex = (this.currentHeroIndex + 1) % 5;
                this.updateHeroByIndex(newIndex);
            }
        });

        document.getElementById('viewAllTrending').addEventListener('click', (e) => {
            e.preventDefault();
            this.redirectToViewAll('trending');
        });

        document.getElementById('viewAllNew').addEventListener('click', (e) => {
            e.preventDefault();
            this.redirectToViewAll('new-movies');
        });

        document.getElementById('viewAllSeries').addEventListener('click', (e) => {
            e.preventDefault();
            this.redirectToViewAll('new-series');
        });

        document.getElementById('viewAllRecommended').addEventListener('click', (e) => {
            e.preventDefault();
            this.redirectToViewAll('recommended');
        });

        const typeButtons = document.querySelectorAll('.type-button');
        typeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectedType = button.getAttribute('data-type');
                typeButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                this.filterAndRenderRecommended();
            });
        });

        const allHeaderButtons = document.querySelectorAll('.nav-links a, .nav-categories a, #loginBtn');
        allHeaderButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                allHeaderButtons.forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');

                if (e.target.matches('.nav-links a')) {
                    const category = e.target.getAttribute('data-category');
                    if (category && category !== 'country' && category !== 'genre') {
                        console.log(`Selected category: ${category}`);
                    } else if (!category) {
                        console.log('Home clicked');
                        this.loadPopularMovies();
                    }
                } else if (e.target.matches('.nav-categories a')) {
                    const type = e.target.getAttribute('data-type');
                    this.loadContentByType(type);
                } else if (e.target.matches('#loginBtn')) {
                    console.log('Login/Signup clicked');
                    this.redirectToLogin();
                }
            });
        });
    }

    async handleSearch() {
        const searchInput = document.getElementById('searchInput');
        const query = searchInput.value.trim();
        
        if (!query) return;

        try {
            const data = await this.searchMovies(query);
            if (data && data.results) {
                this.renderSearchResults(data.results);
                this.hideSearchSuggestions();
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    async handleSearchSuggestions(query) {
        try {
            const data = await this.searchMovies(query);
            if (data && data.results) {
                this.renderSearchSuggestions(data.results);
            }
        } catch (error) {
            console.error('Search suggestions error:', error);
        }
    }

    renderSearchResults(items) {
        const trendingGrid = document.getElementById('trendingGrid');
        const sectionTitle = document.querySelector('#trendingGrid').closest('.section').querySelector('.section-title');
        
        sectionTitle.textContent = 'Search Results';
        
        if (items.length === 0) {
            trendingGrid.innerHTML = '<div class="no-results">No movies or series found</div>';
            return;
        }

        this.renderTrendingMovies(items.slice(0, 3));
    }

    async loadContentByType(type) {
        let endpoint;
        switch (type) {
            case 'movie':
                endpoint = this.selectedGenre ? `/discover/movie` : '/movie/popular';
                break;
            case 'tv':
                endpoint = this.selectedGenre ? `/discover/tv` : '/tv/popular';
                break;
            case 'animation':
                endpoint = '/discover/movie';
                break;
            default:
                endpoint = this.selectedGenre ? `/discover/movie` : '/movie/popular';
        }

        const data = await this.fetchFromAPI(endpoint);
        if (data && data.results) {
            this.renderTrendingMovies(data.results.slice(0, 3));
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MovieApp();
});

const utils = {
    formatDate: (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    },

    formatRuntime: (minutes) => {
        if (!minutes) return 'N/A';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const secs = 0;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    truncateText: (text, maxLength) => {
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength) + '...';
    }
};
