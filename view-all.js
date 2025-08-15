class ViewAllApp {
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
        this.currentCategory = '';
        this.currentEndpoint = '';
        this.selectedType = 'all';
        this.allItems = [];
        this.currentHeroIndex = 0;
        
        this.init();
    }

    async init() {
        await this.fetchGenres();
        this.getUrlParams();
        await this.loadHeroSection();
        await this.loadCategoryContent();
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

    async fetchFromAPI(endpoint, params = {}) {
    try {
        const url = new URL(`${this.baseUrl}${endpoint}`);
        Object.entries({ api_key: this.apiKey, ...params }).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API request failed: ${response.status}`);
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

    getUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        this.currentCategory = urlParams.get('category') || 'trending';
        this.currentPage = parseInt(urlParams.get('page')) || 1;
        
        // Set endpoint based on category
        switch(this.currentCategory) {
            case 'trending':
                this.currentEndpoint = '/trending/all/week';
                break;
            case 'new-movies':
                this.currentEndpoint = '/movie/now_playing';
                break;
            case 'new-series':
                this.currentEndpoint = '/tv/airing_today';
                break;
            case 'recommended':
                this.currentEndpoint = '/trending/all/day';
                break;
            default:
                this.currentEndpoint = '/trending/all/week';
                this.currentCategory = 'trending';
        }
    }

    async loadHeroSection() {
        const data = await this.fetchFromAPI('/movie/popular');
        if (data && data.results) {
            this.currentMovies = await Promise.all(data.results.slice(0, 5).map(async (item) => {
                const details = await this.getDetails(item.id, item.media_type || 'movie');
                return { ...item, details };
            }));
            this.updateHeroSection(this.currentMovies[0]);
        }
    }

    async loadCategoryContent() {
        const loadingElement = document.getElementById('viewAllContent');
        loadingElement.innerHTML = '<div class="loading">Loading...</div>';
        
        // Update page title
        const categoryTitle = document.getElementById('categoryTitle');
        const categoryNames = {
            'trending': 'Trending',
            'new-movies': 'New Release - Movies', 
            'new-series': 'New Release - Series',
            'recommended': 'Recommended'
        };
        categoryTitle.textContent = categoryNames[this.currentCategory] || 'View All';
        
        // Show type buttons only for recommended category
        const typeButtons = document.getElementById('typeButtons');
        if (this.currentCategory === 'recommended') {
            typeButtons.style.display = 'flex';
        } else {
            typeButtons.style.display = 'none';
        }

        let allData = [];
        let currentPage = 1;
        
        // Load multiple pages to get more content
        while (currentPage <= 5) { // Load first 5 pages
            const endpoint = `${this.currentEndpoint}?page=${currentPage}`;
            const data = await this.fetchFromAPI(this.currentEndpoint, { page: currentPage });
            
            if (data && data.results && data.results.length > 0) {
                allData = [...allData, ...data.results];
                this.totalPages = data.total_pages;
                currentPage++;
            } else {
                break;
            }
        }

        if (allData.length > 0) {
            // Get details for all items
            this.allItems = await Promise.all(allData.map(async (item) => {
                const details = await this.getDetails(item.id, item.media_type);
                return { ...item, details };
            }));
            
            this.filterAndRenderContent();
        }
    }

    filterAndRenderContent() {
        let filteredItems = this.allItems;
        
        if (this.currentCategory === 'recommended' && this.selectedType !== 'all') {
            filteredItems = this.allItems.filter(item => {
                const genres = item.genre_ids || [];
                switch(this.selectedType) {
                    case 'Movies':
                        return item.media_type === 'movie';
                    case 'Series':
                        return item.media_type === 'tv';
                    case 'Animation':
                        return genres.some(id => [16, 10762].includes(id));
                    default:
                        return true;
                }
            });
        }

        this.renderContent(filteredItems);
        this.renderPagination(filteredItems.length);
    }

    renderContent(items) {
    const contentElement = document.getElementById('viewAllContent');
    const itemsPerPage = 20;
    const startIndex = (this.currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = items.slice(startIndex, endIndex);

    if (pageItems.length === 0) {
        contentElement.innerHTML = '<div class="no-results">No content found</div>';
        return;
    }

    contentElement.innerHTML = pageItems.map(item => {
        const isSeries = item.media_type === 'tv';
        let duration = 'N/A';
        const rating = item.vote_average ? `★ ${item.vote_average.toFixed(1)}` : '★ N/A';
        const genres = this.getGenres(item);
        const title = item.title || item.name;

        // Tính duration giống Home
        if (item.details) {
            if (isSeries && item.details.number_of_seasons) {
                duration = `Season ${item.details.number_of_seasons}`;
            } else if (isSeries && item.details.episode_run_time && item.details.episode_run_time.length > 0) {
                duration = utils.formatRuntime(item.details.episode_run_time[0]);
            } else if (item.details.runtime) {
                duration = utils.formatRuntime(item.details.runtime);
            }
        }

        // Render dựa trên category, copy cấu trúc từ Home
        if (this.currentCategory === 'trending') {
            // Giống renderTrendingMovies ở Home
            return `
                <div class="trending-item" data-movie-id="${item.id}" data-media-type="${item.media_type}">
                    <div class="trending-poster" style="background-image: url(${item.poster_path ? this.imageBaseUrl + item.poster_path : ''})">
                        <div class="movie-duration"><i class="fas fa-clock"></i> ${duration}</div>
                        <div class="movie-rating">${rating}</div>
                        <div class="play-button"><i class="fas fa-play-circle"></i></div>
                    </div>
                    <div class="trending-info">
                        <div class="trending-title-row">
                            <div class="trending-title">${title}</div>
                            <div class="trending-genres">
                                ${genres.map(genre => `<span class="trending-tag ${genre.toLowerCase().replace(' ', '-')}" title="${genre}">${genre}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else if (this.currentCategory === 'new-movies') {
            // Giống renderNewReleases ở Home
            return `
                <div class="new-release-item" data-movie-id="${item.id}" data-media-type="movie">
                    <div class="new-release-poster" style="background-image: url(${item.poster_path ? this.imageBaseUrl + item.poster_path : ''})"></div>
                    <div class="new-release-info">
                        <div class="new-release-title">${title}</div>
                        <div class="new-release-meta">
                            <span class="hd-tag">HD</span>
                            <span class="duration"><i class="fas fa-clock"></i> ${duration}</span>
                        </div>
                    </div>
                </div>
            `;
        } else if (this.currentCategory === 'new-series') {
            // Giống renderNewSeries ở Home
            return `
                <div class="new-release-series-item" data-movie-id="${item.id}" data-media-type="tv">
                    <div class="new-release-series-poster" style="background-image: url(${item.poster_path ? this.imageBaseUrl + item.poster_path : ''})"></div>
                    <div class="new-release-series-info">
                        <div class="new-release-series-title">${title}</div>
                        <div class="new-release-series-meta">
                            <span class="hd-tag">HD</span>
                            <span class="duration">${duration}</span>
                        </div>
                    </div>
                </div>
            `;
        } else if (this.currentCategory === 'recommended') {
            // Giống renderRecommended ở Home
            const metaContent = isSeries
                ? duration
                : `<i class="fas fa-clock"></i> ${duration}`;
            return `
                <div class="recommended-item" data-movie-id="${item.id}" data-media-type="${item.media_type}">
                    <div class="recommended-bg" style="background-image: url(${item.backdrop_path ? this.backdropBaseUrl + item.backdrop_path : ''})"></div>
                    <div class="recommended-info">
                        <div class="new-release-title">${title}</div>
                        <div class="new-release-meta">
                            <span class="hd-tag">HD</span>
                            <span class="duration">${metaContent}</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Default fallback (nếu category mới)
            return `<div>No item template for this category</div>`;
        }
    }).join('');
}

    renderPagination(totalItems) {
        const paginationElement = document.getElementById('pagination');
        const itemsPerPage = 20;
        const totalPagesCalc = Math.ceil(totalItems / itemsPerPage);
        
        if (totalPagesCalc <= 1) {
            paginationElement.innerHTML = '';
            return;
        }

        let paginationHTML = '';
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPagesCalc, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        // Previous button
        if (this.currentPage > 1) {
            paginationHTML += `<button class="page-btn" data-page="${this.currentPage - 1}">‹</button>`;
        }

        // Page numbers
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        // Next button
        if (this.currentPage < totalPagesCalc) {
            paginationHTML += `<button class="page-btn" data-page="${this.currentPage + 1}">›</button>`;
        }

        paginationElement.innerHTML = paginationHTML;
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

    updateHeroByIndex(index) {
        if (this.currentMovies[index]) {
            this.currentHeroIndex = index;
            this.updateHeroSection(this.currentMovies[index]);
            const dots = document.querySelectorAll('.pagination-dot');
            dots.forEach(d => d.classList.remove('active'));
            dots[index].classList.add('active');
        }
    }

    getGenres(item) {
        if (!item.genre_ids || !Array.isArray(item.genre_ids)) return ['N/A'];
        
        const genres = item.media_type === 'tv' ? this.tvGenres : this.movieGenres;
        return item.genre_ids
            .map(id => genres[id] || 'N/A')
            .filter(genre => genre !== 'N/A')
            .slice(0, 3);
    }

    async searchMovies(query) {
        const endpoint = `/search/multi`;
        const response = await fetch(`${this.baseUrl}${endpoint}?api_key=${this.apiKey}&query=${encodeURIComponent(query)}`);
        return await response.json();
    }

    async handleSearch() {
        const searchInput = document.getElementById('searchInput');
        const query = searchInput.value.trim();
        
        if (!query) return;

        try {
            const data = await this.searchMovies(query);
            if (data && data.results) {
                this.allItems = await Promise.all(data.results.map(async (item) => {
                    const details = await this.getDetails(item.id, item.media_type);
                    return { ...item, details };
                }));
                
                document.getElementById('categoryTitle').textContent = `Search Results for "${query}"`;
                this.currentPage = 1;
                this.filterAndRenderContent();
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    changePage(page) {
        this.currentPage = page;
        this.filterAndRenderContent();
        
        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('page', page);
        window.history.pushState({}, '', url);
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        
        searchBtn.addEventListener('click', () => this.handleSearch());
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        // Hero pagination
        const dots = document.querySelectorAll('.pagination-dot');
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                this.updateHeroByIndex(index);
            });
        });

        // Hero section click
        const heroSection = document.getElementById('heroSection');
        heroSection.addEventListener('click', (e) => {
            if (!e.target.closest('.hero-buttons') && !e.target.closest('.hero-pagination')) {
                let newIndex = (this.currentHeroIndex + 1) % 5;
                this.updateHeroByIndex(newIndex);
            }
        });

        // Type buttons for recommended
        if (this.currentCategory === 'recommended') {
            const typeButtons = document.querySelectorAll('.type-button');
            typeButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.selectedType = button.getAttribute('data-type');
                    typeButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    this.currentPage = 1;
                    this.filterAndRenderContent();
                });
            });
        }

        // Pagination
        document.addEventListener('click', (e) => {
            if (e.target.matches('.page-btn:not(.active)')) {
                const page = parseInt(e.target.getAttribute('data-page'));
                this.changePage(page);
            }
        });

        // Back to home
        const homeLink = document.querySelector('.nav-links a[href="#"]');
        if (homeLink) {
            homeLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'index.html';
            });
        }

        // Header navigation
        const allHeaderButtons = document.querySelectorAll('.nav-links a, .nav-categories a, #loginBtn');
        allHeaderButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                allHeaderButtons.forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');

                if (e.target.matches('.nav-links a') && e.target.textContent === 'Home') {
                    window.location.href = 'index.html';
                }
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ViewAllApp();
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