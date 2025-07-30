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
        this.selectedType = 'all'; // Mặc định hiển thị tất cả
        
        this.init();
    }

    async init() {
        await this.fetchGenres();
        this.createHTML();
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

    async fetchFromAPI(endpoint) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}?api_key=${this.apiKey}`);
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
        const response = await fetch(`${this.baseUrl}${endpoint}?api_key=${this.apiKey}&query=${encodeURIComponent(query)}`);
        return await response.json();
    }

    async loadPopularMovies() {
        const data = await this.fetchFromAPI('/movie/popular');
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
        const data = await this.fetchFromAPI('/trending/all/week');
        if (data && data.results) {
            this.currentMovies = await Promise.all(data.results.slice(0, 3).map(async (item) => {
                const details = await this.getDetails(item.id, item.media_type);
                return { ...item, details };
            }));
            this.renderTrendingMovies(this.currentMovies);
        }
    }

    async loadNewReleases() {
        const data = await this.fetchFromAPI('/movie/now_playing');
        if (data && data.results) {
            console.log('Number of movies:', data.results.length);
            const moviesWithDetails = await Promise.all(data.results.slice(0, 4).map(async (movie) => {
                const details = await this.getDetails(movie.id, 'movie');
                return { ...movie, details };
            }));
            this.currentMovies = moviesWithDetails;
            this.recentItems = data.results;
            this.renderNewReleases(moviesWithDetails);
            this.renderRecentlyUpdated();
        }
    }

    async loadNewSeries() {
        const data = await this.fetchFromAPI('/tv/airing_today');
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
        const data = await this.fetchFromAPI('/trending/all/day');
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
                       this.selectedType === 'Animation' && genres.some(id => [16, 10762].includes(id)); // Animation genre IDs
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
                        <div class="recent-item" data-movie-id="${item.id}" data-media-type="${item.media_type}">
                            <div class="recent-poster" style="background-image: url(${item.poster_path ? this.imageBaseUrl + item.poster_path : ''})"></div>
                            <div class="recent-info">
                                <h4>${item.title || item.name}</h4>
                                <p>Rating: ${item.vote_average.toFixed(1)}</p>
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

    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const heroSection = document.getElementById('heroSection');
        const loginBtn = document.getElementById('loginBtn');
        
        searchBtn.addEventListener('click', () => this.handleSearch());
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
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
            this.toggleMovies('/trending/all/week', 'trendingGrid');
        });

        document.getElementById('viewAllNew').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleMovies('/movie/now_playing', 'newReleases');
        });

        document.getElementById('viewAllSeries').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleMovies('/tv/airing_today', 'newReleaseSeries');
        });

        document.getElementById('viewAllRecommended').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleMovies('/trending/all/day', 'recommended');
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
                    if (category) {
                        console.log(`Selected category: ${category}`);
                    } else {
                        console.log('Home clicked');
                        this.loadPopularMovies();
                    }
                } else if (e.target.matches('.nav-categories a')) {
                    const type = e.target.getAttribute('data-type');
                    this.loadContentByType(type);
                } else if (e.target.matches('#loginBtn')) {
                    console.log('Login/Signup clicked');
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
            }
        } catch (error) {
            console.error('Search error:', error);
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
                endpoint = '/movie/popular';
                break;
            case 'tv':
                endpoint = '/tv/popular';
                break;
            case 'animation':
                endpoint = '/discover/movie';
                break;
            default:
                endpoint = '/movie/popular';
        }

        const data = await this.fetchFromAPI(endpoint);
        if (data && data.results) {
            this.renderTrendingMovies(data.results.slice(0, 3));
        }
    }

    async toggleMovies(endpoint, containerId) {
        const isExpanded = this.sectionStates[containerId];
        const data = await this.fetchFromAPI(endpoint);
        if (!data || !data.results) return;

        const container = document.getElementById(containerId);
        const heroSection = document.getElementById('heroSection');

        if (isExpanded) {
            this.sectionStates[containerId] = false;
            if (containerId === 'trendingGrid') {
                const itemsWithDetails = await Promise.all(data.results.slice(0, 3).map(async (item) => {
                    const details = await this.getDetails(item.id, item.media_type);
                    return { ...item, details };
                }));
                this.renderTrendingMovies(itemsWithDetails);
                if (data.results.length > 0) {
                    this.updateHeroSection(data.results[0]);
                }
            } else if (containerId === 'newReleases') {
                const moviesWithDetails = await Promise.all(data.results.slice(0, 4).map(async (item) => {
                    const details = await this.getDetails(item.id, 'movie');
                    return { ...item, details };
                }));
                this.renderNewReleases(moviesWithDetails);
            } else if (containerId === 'newReleaseSeries') {
                const seriesWithDetails = await Promise.all(data.results.slice(0, 4).map(async (item) => {
                    const details = await this.getDetails(item.id, 'tv');
                    return { ...item, details };
                }));
                this.renderNewSeries(seriesWithDetails);
            } else if (containerId === 'recommended') {
                const itemsWithDetails = await Promise.all(data.results.map(async (item) => {
                    const details = await this.getDetails(item.id, item.media_type);
                    return { ...item, details };
                }));
                this.currentMovies = itemsWithDetails;
                this.filterAndRenderRecommended();
            }
        } else {
            this.sectionStates[containerId] = true;
            if (containerId === 'trendingGrid') {
                container.innerHTML = data.results.map(item => {
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
                    const fullTitle = item.title || item.name || 'Unknown';

                    return `
                        <div class="trending-item" data-movie-id="${item.id}" data-media-type="${item.media_type}">
                            <div class="trending-poster" style="background-image: url(${item.poster_path ? this.imageBaseUrl + item.poster_path : ''})">
                                <div class="movie-duration"><i class="fas fa-clock"></i> ${duration}</div>
                                <div class="movie-rating">${rating}</div>
                                <div class="play-button"><i class="fas fa-play-circle"></i></div>
                            </div>
                            <div class="trending-info">
                                <div class="trending-title-row">
                                    <div class="trending-title" data-tooltip="${fullTitle}">${item.title || item.name}</div>
                                    <div class="trending-genres">
                                        ${genres.map(genre => `<span class="trending-tag ${genre.toLowerCase().replace(' ', '-')}" title="${genre}">${genre}</span>`).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else if (containerId === 'newReleases') {
                const moviesWithDetails = await Promise.all(data.results.map(async (item) => {
                    const details = await this.getDetails(item.id, 'movie');
                    return { ...item, details };
                }));
                container.innerHTML = moviesWithDetails.map(item => {
                    const duration = item.details && item.details.runtime ? utils.formatRuntime(item.details.runtime) : 'N/A';
                    return `
                        <div class="new-release-item" data-movie-id="${item.id}" data-media-type="movie">
                            <div class="new-release-poster" style="background-image: url(${item.poster_path ? this.imageBaseUrl + item.poster_path : ''})"></div>
                            <div class="new-release-info">
                                <div class="new-release-title">${item.title}</div>
                                <div class="new-release-meta">
                                    <span class="hd-tag">HD</span>
                                    <span class="duration"><i class="fas fa-clock"></i> ${duration}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else if (containerId === 'newReleaseSeries') {
                const seriesWithDetails = await Promise.all(data.results.map(async (item) => {
                    const details = await this.getDetails(item.id, 'tv');
                    return { ...item, details };
                }));
                container.innerHTML = seriesWithDetails.map(item => {
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
            } else if (containerId === 'recommended') {
                const itemsWithDetails = await Promise.all(data.results.map(async (item) => {
                    const details = await this.getDetails(item.id, item.media_type);
                    return { ...item, details };
                }));
                this.currentMovies = itemsWithDetails;
                this.filterAndRenderRecommended();
            }
        }
    }

    createHTML() {
        document.body.innerHTML = `
            <!-- Header -->
            <header class="header">
                <div class="nav-left">
                    <nav>
                        <ul class="nav-links">
                            <li><a href="#" class="active">Home</a></li>
                            <li><a href="#" data-category="genre">Genre</a></li>
                            <li><a href="#" data-category="country">Country</a></li>
                        </ul>
                    </nav>
                </div>
                <div class="search-container">
                    <input type="text" class="search-box" placeholder="Search movies..." id="searchInput">
                    <button class="search-btn" id="searchBtn">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
                <div class="nav-categories">
                    <a href="#" data-type="movie">Movies</a>
                    <a href="#" data-type="tv">Series</a>
                    <a href="#" data-type="animation">Animation</a>
                </div>
                <a href="#" id="loginBtn">Login/Signup</a>
                <div class="bell-icon">🔔</div>
            </header>

            <!-- Hero Section -->
            <section class="hero" id="heroSection">
                <div class="hero-info">
                    <h1 class="hero-title" id="heroTitle">Loading...</h1>
                    <div class="hero-meta" id="heroMeta"></div>
                    <p class="hero-description" id="heroDescription">Loading movie details...</p>
                </div>
                <div class="hero-buttons">
                    <button class="btn-primary" id="watchNBtn">
                    Watch Later 
                    <i class="fas fa-play-circle" style="margin-left: 10px;"></i>
                </button>
                    <button class="btn-secondary" id="watchLaterBtn">
                        Watch Later 
                        <i class="fas fa-clock" style="margin-left: 10px;"></i>
                    </button>
                </div>
                <div class="hero-pagination" id="heroPagination">
                    <div class="pagination-dot active"></div>
                    <div class="pagination-dot"></div>
                    <div class="pagination-dot"></div>
                    <div class="pagination-dot"></div>
                    <div class="pagination-dot"></div>
                </div>
            </section>

            <!-- Content Sections -->
            <main class="content">
                <!-- Recently Updated -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Recently Updated</h2>
                    </div>
                    <div class="recently-updated" id="recentlyUpdated">
                        <div class="loading">Loading...</div>
                    </div>
                </section>

                <!-- Trending -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Trending</h2>
                        <a href="#" class="view-all" id="viewAllTrending">View all →</a>
                    </div>
                    <div class="trending-grid" id="trendingGrid">
                        <div class="loading">Loading trending movies...</div>
                    </div>
                </section>

                <!-- New Release Movies -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">New Release - Movies</h2>
                        <a href="#" class="view-all" id="viewAllNew">View all →</a>
                    </div>
                    <div class="new-releases" id="newReleases">
                        <div class="loading">Loading new releases...</div>
                    </div>
                </section>

                <!-- New Release Series -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">New Release - Series</h2>
                        <a href="#" class="view-all" id="viewAllSeries">View all →</a>
                    </div>
                    <div class="new-release-series" id="newReleaseSeries">
                        <div class="loading">Loading new series...</div>
                    </div>
                </section>

                <!-- Recommended -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Recommended</h2>
                        <div class="type-buttons">
                            <a href="#" class="type-button ${this.selectedType === 'all' || this.selectedType === 'Movies' ? 'active' : ''}" data-type="Movies">Movies</a>
                            <a href="#" class="type-button ${this.selectedType === 'Series' ? 'active' : ''}" data-type="Series">Series</a>
                            <a href="#" class="type-button ${this.selectedType === 'Animation' ? 'active' : ''}" data-type="Animation">Animation</a>
                        </div>
                        <a href="#" class="view-all" id="viewAllRecommended">View all →</a>
                    </div>
                    <div class="recommended" id="recommended">
                        <div class="loading">Loading recommended...</div>
                    </div>
                </section>
            </main>
        `;
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
        const secs = 0; // API TMDb cung cấp thời lượng theo phút, nên giây luôn là 0
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    truncateText: (text, maxLength) => {
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength) + '...';
    }
};