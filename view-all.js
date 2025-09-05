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
        this.countries = [];
        this.genres = [];
        this.selectedCountry = localStorage.getItem('selectedCountry') || 'all';
        this.selectedGenre = localStorage.getItem('selectedGenre') || null;
        this.isLoading = false;
        
        this.init();
    }

    async init() {
        await this.fetchGenres();
        await this.fetchCountries();
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
            } else {
                console.warn('No movie genres found');
            }

            const tvGenreData = await this.fetchFromAPI('/genre/tv/list');
            if (tvGenreData && tvGenreData.genres) {
                tvGenreData.genres.forEach(genre => {
                    this.tvGenres[genre.id] = genre.name;
                });
            } else {
                console.warn('No TV genres found');
            }

            const allGenres = [...movieGenreData.genres, ...tvGenreData.genres];
            const uniqueGenres = Array.from(new Map(allGenres.map(g => [g.id, g])).values());
            this.genres = uniqueGenres.sort((a, b) => a.name.localeCompare(b.name));
            this.renderGenreModal();
        } catch (error) {
            console.error('Lỗi khi lấy danh sách thể loại:', error);
        }
    }

    async fetchCountries() {
        try {
            const response = await fetch(`${this.baseUrl}/configuration/countries?api_key=${this.apiKey}`);
            if (!response.ok) throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            const data = await response.json();
            this.countries = [
                { iso_3166_1: 'all', english_name: 'All Countries' },
                ...data.sort((a, b) => a.english_name.localeCompare(b.english_name))
            ];
            this.renderCountryModal();
        } catch (error) {
            console.error('Error fetching countries:', error);
        }
    }

    async fetchFromAPI(endpoint, params = {}) {
        try {
            const url = new URL(`${this.baseUrl}${endpoint}`);
            Object.entries({ api_key: this.apiKey, ...params }).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    url.searchParams.append(key, value);
                }
            });
            if (this.selectedCountry && this.selectedCountry !== 'all' && endpoint.includes('discover')) {
                url.searchParams.append('with_origin_country', this.selectedCountry);
            }
            if (this.selectedGenre && endpoint.includes('discover')) {
                url.searchParams.append('with_genres', this.selectedGenre);
            }
            if (this.selectedType === 'Animation' && endpoint.includes('discover')) {
                url.searchParams.append('with_genres', '16');
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Yêu cầu API thất bại: ${response.status} - ${response.statusText}`);
            const data = await response.json();
            if (!data.results && !endpoint.includes('/genre/') && !endpoint.includes('/configuration/') && !endpoint.includes('/movie/') && !endpoint.includes('/tv/')) {
                console.warn(`No results found for endpoint: ${endpoint}`);
            }
            return data;
        } catch (error) {
            console.error('Lỗi API:', error);
            return null;
        }
    }

    async getDetails(id, media_type) {
        const endpoint = media_type === 'tv' ? `/tv/${id}` : `/movie/${id}`;
        return await this.fetchFromAPI(endpoint);
    }

    getUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        this.currentCategory = urlParams.get('category') || 'recommended';
        this.currentPage = parseInt(urlParams.get('page')) || 1;
        
        let typeParam = urlParams.get('type');
        if (typeParam) {
            this.selectedType = this.mapTypeParam(typeParam);
            this.selectedGenre = null;
            this.selectedCountry = null;
            localStorage.removeItem('selectedGenre');
            localStorage.removeItem('selectedCountry');
        } else if (urlParams.get('genre')) {
            this.selectedGenre = urlParams.get('genre');
            this.selectedType = 'all';
            this.selectedCountry = null;
            localStorage.setItem('selectedGenre', this.selectedGenre);
            localStorage.removeItem('selectedCountry');
        } else if (urlParams.get('country')) {
            this.selectedCountry = urlParams.get('country');
            this.selectedType = 'all';
            this.selectedGenre = null;
            localStorage.setItem('selectedCountry', this.selectedCountry);
            localStorage.removeItem('selectedGenre');
        } else {
            this.selectedType = 'all';
            this.selectedGenre = localStorage.getItem('selectedGenre') || null;
            this.selectedCountry = localStorage.getItem('selectedCountry') || 'all';
            localStorage.setItem('selectedCountry', this.selectedCountry);
        }
        
        this.currentEndpoint = this.getEndpoint();
    }

    mapTypeParam(typeParam) {
        if (typeParam === 'movie') return 'Movies';
        if (typeParam === 'tv') return 'Series';
        if (typeParam === 'animation') return 'Animation';
        return 'all';
    }

    getEndpoint() {
        if (this.selectedType !== 'all') {
            switch (this.selectedType) {
                case 'Movies':
                    return '/movie/popular';
                case 'Series':
                    return '/tv/popular';
                case 'Animation':
                    return '/discover/movie';
                default:
                    return '/discover/movie';
            }
        } else if (this.selectedGenre || (this.selectedCountry && this.selectedCountry !== 'all')) {
            return '/discover/movie';
        } else {
            return this.getDefaultEndpoint();
        }
    }

    getDefaultEndpoint() {
        switch(this.currentCategory) {
            case 'trending':
                return '/trending/all/week';
            case 'new-movies':
                return '/movie/now_playing';
            case 'new-series':
                return '/tv/airing_today';
            case 'recommended':
                return '/discover/movie';
            default:
                return '/discover/movie';
        }
    }

    async loadHeroSection() {
        const endpoint = this.selectedGenre ? '/discover/movie' : '/movie/popular';
        const data = await this.fetchFromAPI(endpoint);
        if (data && data.results) {
            this.currentMovies = await Promise.all(data.results.slice(0, 5).map(async (item) => {
                const mediaType = item.media_type || 'movie';
                const details = await this.getDetails(item.id, mediaType);
                return { ...item, media_type: mediaType, details };
            }));
            this.updateHeroSection(this.currentMovies[0]);
        } else {
            console.warn('No hero content loaded');
        }
    }

    async loadCategoryContent() {
        if (this.isLoading) return;
        this.isLoading = true;

        const loadingElement = document.getElementById('viewAllContent');
        loadingElement.innerHTML = '<div class="loading">Đang tải...</div>';
        
        const categoryTitle = document.getElementById('categoryTitle');
        let baseTitle = this.getCategoryName() || 'Xem tất cả';
        
        if (this.selectedType !== 'all') {
            const typeNames = {
                'Movies': 'Phim',
                'Series': 'Series',
                'Animation': 'Hoạt hình'
            };
            baseTitle = `${typeNames[this.selectedType]}`;
        } else if (this.selectedGenre) {
            const genreName = this.movieGenres[this.selectedGenre] || this.tvGenres[this.selectedGenre] || 'Unknown Genre';
            baseTitle = `Thể loại: ${genreName}`;
        } else if (this.selectedCountry && this.selectedCountry !== 'all') {
            const countryName = this.countries.find(c => c.iso_3166_1 === this.selectedCountry)?.english_name || this.selectedCountry;
            baseTitle = `Quốc gia: ${countryName}`;
        } else {
            baseTitle = 'Recommended';
        }
        categoryTitle.textContent = baseTitle;
        
        const typeButtons = document.getElementById('typeButtons');
        if (this.currentCategory === 'recommended' && !this.selectedGenre && (!this.selectedCountry || this.selectedCountry === 'all') && this.selectedType === 'all') {
            typeButtons.style.display = 'flex';
        } else {
            typeButtons.style.display = 'none';
        }

        let params = { page: this.currentPage };
        if (this.selectedType === 'Animation') {
            params.with_genres = '16';
        }

        const data = await this.fetchFromAPI(this.currentEndpoint, params);
        if (data && data.results) {
            const itemsWithDetails = await Promise.all(data.results.map(async (item) => {
                const mediaType = this.currentEndpoint.includes('/tv/') ? 'tv' : 
                                this.currentEndpoint.includes('/movie/') ? 'movie' : 
                                (this.selectedType === 'Series' ? 'tv' : 
                                (this.selectedType === 'Movies' ? 'movie' : (item.media_type || 'movie')));
                const details = await this.getDetails(item.id, mediaType);
                return { ...item, media_type: mediaType, details };
            }));
            this.allItems = itemsWithDetails;
            this.totalPages = data.total_pages || 1;
            this.renderCategoryContent(this.filterItems(this.allItems));
            this.renderPagination();
        } else {
            console.warn('No content loaded for category:', this.currentCategory);
            this.allItems = [];
            this.renderCategoryContent([]);
            this.renderPagination();
        }
        this.isLoading = false;
    }

    filterItems(items) {
        if (this.selectedType === 'all') return items;
        return items.filter(item => {
            const genres = item.genre_ids || [];
            return this.selectedType === 'Movies' ? item.media_type === 'movie' :
                   this.selectedType === 'Series' ? item.media_type === 'tv' :
                   this.selectedType === 'Animation' && genres.some(id => [16, 10762].includes(id));
        });
    }

    renderCategoryContent(items) {
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

    getGenres(item) {
        if (!item.genre_ids || !Array.isArray(item.genre_ids)) return ['N/A'];
        const genres = item.media_type === 'tv' ? this.tvGenres : this.movieGenres;
        return item.genre_ids
            .map(id => genres[id] || 'N/A')
            .filter(genre => genre !== 'N/A')
            .slice(0, 3);
    }

    renderPagination() {
        const pagination = document.getElementById('pagination');
        if (!pagination) return;

        const maxPagesToShow = 5;
        const startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
        const endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);

        pagination.innerHTML = `
            <button class="page-btn" data-page="${Math.max(1, this.currentPage - 1)}" ${this.currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-arrow-left"></i>
            </button>
            ${Array.from({ length: endPage - startPage + 1 }, (_, i) => {
                const page = startPage + i;
                return `<button class="page-btn${page === this.currentPage ? ' active' : ''}" data-page="${page}">${page}</button>`;
            }).join('')}
            <button class="page-btn" data-page="${Math.min(this.totalPages, this.currentPage + 1)}" ${this.currentPage >= this.totalPages ? 'disabled' : ''}>
                <i class="fas fa-arrow-right"></i>
            </button>
        `;
    }

    changePage(page) {
        if (page < 1 || page > this.totalPages || this.isLoading) return;
        this.currentPage = page;
        this.allItems = [];
        this.updateUrlAndReload();
    }

    updateHeroSection(item) {
        if (!item) return;

        const heroTitle = document.getElementById('heroTitle');
        const heroDescription = document.getElementById('heroDescription');
        const heroMeta = document.getElementById('heroMeta');
        const heroSection = document.getElementById('heroSection');

        heroTitle.textContent = item.title || item.name || 'Đang tải...';
        heroDescription.textContent = utils.truncateText(item.overview || 'Không có mô tả', 200);
        
        if (item.backdrop_path) {
            heroSection.style.backgroundImage = `url(${this.backdropBaseUrl}${item.backdrop_path})`;
        } else {
            heroSection.style.backgroundImage = `linear-gradient(135deg, #1a4b84, #2d5aa0, #4a90e2)`;
        }

        const genres = this.getGenres(item);
        const releaseYear = item.release_date || item.first_air_date ? new Date(item.release_date || item.first_air_date).getFullYear() : 'Không rõ';
        let duration = 'N/A';
        if (item.details) {
            if (item.media_type === 'tv' && item.details.episode_run_time && item.details.episode_run_time.length > 0) {
                duration = utils.formatRuntime(item.details.episode_run_time[0]);
            } else if (item.media_type === 'movie' && item.details.runtime) {
                duration = utils.formatRuntime(item.details.runtime);
            }
        }

        heroMeta.innerHTML = `
            ${genres.map(genre => `<span class="meta-tag">${utils.truncateText(genre, 20)}</span>`).join('')}
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

    redirectToMovieDetails(movieId, mediaType) {
        const url = new URL('detail.html', window.location.origin);
        url.searchParams.set('id', movieId);
        url.searchParams.set('type', mediaType);
        if (this.selectedGenre) url.searchParams.set('genre', this.selectedGenre);
        if (this.selectedCountry && this.selectedCountry !== 'all') url.searchParams.set('country', this.selectedCountry);
        window.location.href = url.toString();
    }

    redirectToLogin() {
        const url = new URL('LoSi.html', window.location.origin);
        if (this.selectedGenre) url.searchParams.set('genre', this.selectedGenre);
        if (this.selectedCountry && this.selectedCountry !== 'all') url.searchParams.set('country', this.selectedCountry);
        window.location.href = url.toString();
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
        const modal = document.getElementById('countryModal') || document.createElement('div');
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
                            ${utils.truncateText(country.english_name, 50)}${country.iso_3166_1 !== 'all' ? ` (${country.iso_3166_1})` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
        if (!document.getElementById('countryModal')) {
            document.body.appendChild(modal);
        }
    }

    renderGenreModal() {
        const modal = document.getElementById('genreModal') || document.createElement('div');
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
                            ${utils.truncateText(genre.name, 50)}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
        if (!document.getElementById('genreModal')) {
            document.body.appendChild(modal);
        }
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
        document.querySelectorAll('.country-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.countryCode === countryCode);
        });
        this.hideCountryModal();
        this.allItems = [];
        this.currentPage = 1;
        this.updateUrlAndReload();
    }

    selectGenre(genreId) {
        this.selectedGenre = genreId === 'none' ? null : genreId;
        localStorage.setItem('selectedGenre', this.selectedGenre);
        document.querySelectorAll('.genre-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.genreId === genreId);
        });
        this.hideGenreModal();
        this.allItems = [];
        this.currentPage = 1;
        this.updateUrlAndReload();
    }

    updateUrlAndReload() {
        const url = new URL(window.location);
        url.searchParams.set('category', this.currentCategory);
        url.searchParams.set('page', this.currentPage);
        if (this.selectedType !== 'all') {
            url.searchParams.set('type', this.selectedType.toLowerCase());
        } else {
            url.searchParams.delete('type');
        }
        if (this.selectedCountry && this.selectedCountry !== 'all') {
            url.searchParams.set('country', this.selectedCountry);
            url.searchParams.delete('genre');
        } else if (this.selectedGenre) {
            url.searchParams.set('genre', this.selectedGenre);
            url.searchParams.delete('country');
        } else {
            url.searchParams.delete('country');
            url.searchParams.delete('genre');
        }
        window.history.pushState({}, '', url);
        this.getUrlParams();
        this.loadCategoryContent();
    }

    async handleSearch() {
        const searchInput = document.getElementById('searchInput');
        const query = searchInput.value.trim();
        
        if (!query) return;

        try {
            const data = await this.fetchFromAPI('/search/multi', { 
                query: encodeURIComponent(query), 
                page: this.currentPage 
            });
            if (data && data.results) {
                const itemsWithDetails = await Promise.all(data.results.map(async (item) => {
                    const mediaType = item.media_type || (this.selectedType === 'Series' ? 'tv' : 'movie');
                    const details = await this.getDetails(item.id, mediaType);
                    return { ...item, media_type: mediaType, details };
                }));
                this.allItems = itemsWithDetails;
                this.totalPages = data.total_pages || 1;
                this.renderCategoryContent(this.filterItems(this.allItems));
                this.renderPagination();
            } else {
                console.warn('No search results found');
                this.allItems = [];
                this.renderCategoryContent([]);
                this.renderPagination();
            }
        } catch (error) {
            console.error('Search error:', error);
            this.allItems = [];
            this.renderCategoryContent([]);
            this.renderPagination();
        }
    }

    updateTypeUrlAndReload() {
        const url = new URL(window.location);
        url.searchParams.set('type', this.selectedType.toLowerCase());
        url.searchParams.set('page', 1);
        url.searchParams.delete('genre');
        url.searchParams.delete('country');
        window.history.pushState({}, '', url);
        this.currentPage = 1;
        this.allItems = [];
        this.getUrlParams();
        this.loadCategoryContent();
    }

    getCategoryName() {
        switch(this.currentCategory) {
            case 'trending':
                return 'Xu hướng';
            case 'new-movies':
                return 'Phim mới';
            case 'new-series':
                return 'Series mới';
            case 'recommended':
                return 'Đề xuất';
            default:
                return 'Xem tất cả';
        }
    }

    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        
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

        const heroSection = document.getElementById('heroSection');
        heroSection.addEventListener('click', (e) => {
            if (!e.target.closest('.hero-buttons') && !e.target.closest('.hero-pagination')) {
                let newIndex = (this.currentHeroIndex + 1) % 5;
                this.updateHeroByIndex(newIndex);
            }
        });

        const typeButtons = document.querySelectorAll('.type-button');
        typeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectedType = button.getAttribute('data-type');
                this.selectedGenre = null;
                this.selectedCountry = null;
                localStorage.removeItem('selectedGenre');
                localStorage.removeItem('selectedCountry');
                typeButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                this.currentPage = 1;
                this.allItems = [];
                this.updateTypeUrlAndReload();
            });

            if (button.getAttribute('data-type') === this.selectedType) {
                typeButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.matches('.page-btn:not(.active)')) {
                const page = parseInt(e.target.getAttribute('data-page'));
                this.changePage(page);
            }
        });

        const homeLink = document.querySelector('.nav-links a[href="#"]');
        if (homeLink) {
            homeLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'index.html';
            });
        }

        const countryLink = document.querySelector('.nav-links a[data-category="country"]');
        if (countryLink) {
            countryLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showCountryModal();
            });
        }

        const genreLink = document.querySelector('.nav-links a[data-category="genre"]');
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

        const allHeaderButtons = document.querySelectorAll('.nav-links a, .nav-categories a, #loginBtn');
        allHeaderButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                allHeaderButtons.forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');

                if (e.target.matches('.nav-links a') && e.target.textContent === 'Home') {
                    window.location.href = 'index.html';
                } else if (e.target.matches('.nav-categories a')) {
                    const type = e.target.getAttribute('data-type');
                    const url = new URL('view-all.html', window.location.origin);
                    url.searchParams.set('category', 'recommended');
                    url.searchParams.set('type', type);
                    url.searchParams.set('page', 1);
                    if (this.selectedGenre) url.searchParams.set('genre', this.selectedGenre);
                    if (this.selectedCountry && this.selectedCountry !== 'all') url.searchParams.set('country', this.selectedCountry);
                    window.location.href = url.toString();
                } else if (e.target.matches('#loginBtn')) {
                    this.redirectToLogin();
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
        return date.toLocaleDateString('vi-VN', { 
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
        if (text && text.length > maxLength) return text.substr(0, maxLength) + '...';
        return text || '';
    }
};
