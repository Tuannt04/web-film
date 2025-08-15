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
            const url = `${this.baseUrl}${endpoint}?api_key=${this.apiKey}&append_to_response=credits`;
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
        const details = await this.fetchFromAPI(endpoint);
        if (details) {
            this.renderDetails(details);
            this.loadTrailer();
            if (this.mediaType === 'tv') {
                this.loadSeasons(details.number_of_seasons);
            }
        } else {
            console.error('Failed to load media details. Check API key or ID.');
        }
    }

    async loadTrailer() {
        const endpoint = `/${this.mediaType}/${this.mediaId}/videos`;  // Chỉ endpoint thuần
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

        if (detailTitle && detailDescription && detailTags && detailMeta && detailPoster) {
            detailTitle.textContent = details.title || details.name;
            detailDescription.textContent = details.overview || 'No description';

            if (details.poster_path) {
                detailPoster.src = `${this.imageBaseUrl}${details.poster_path}`;
                detailPoster.style.display = 'block';
            } else {
                detailPoster.style.display = 'none';
            }

            const genres = details.genres.map(genre => `<span>${genre.name}</span>`).join('');
            const year = new Date(details.release_date || details.first_air_date).getFullYear() || 'Unknown';
            const runtime = this.mediaType === 'movie' 
                ? (details.runtime ? `<span class="duration"><i class="fas fa-clock"></i>${utils.formatRuntime(details.runtime)}</span>` : 'N/A')
                : (details.number_of_seasons ? ` season ${details.number_of_seasons}` : 'N/A');
            const rating = details.vote_average ? details.vote_average.toFixed(1) : 'N/A';

            detailTags.innerHTML = `
                ${genres}
                <span>${year}</span>
                ${runtime}
                <span>${rating}</span>
            `;

            const country = details.production_countries?.[0]?.name || 'Unknown';
            const releaseDate = details.release_date || details.first_air_date || 'Unknown';
            const production = details.production_companies?.map(p => p.name).join(', ') || 'Unknown';
            const cast = details.credits?.cast?.slice(0, 5).map(c => c.name).join(', ') || 'Unknown';

            detailMeta.innerHTML = `
                <span>Country: ${country}</span>
                <span>Date Release: ${releaseDate}</span>
                <span>Production: ${production}</span>
                <span>Cast: ${cast}</span>
            `;
        } else {
            console.error('Detail elements not found.');
        }
    }

    loadSeasons(numSeasons) {
        const seasonsList = document.getElementById('seasonsList');
        if (seasonsList) {
            seasonsList.innerHTML = '';
            for (let i = 1; i <= numSeasons; i++) {
                seasonsList.innerHTML += `<button class="season-btn">season ${i}</button>`;
            }
        }
    }

    async loadSimilarMedia() {
    try {
        console.log(`Fetching similar for ${this.mediaType}/${this.mediaId}`);
        
        const url = `${this.baseUrl}/${this.mediaType}/${this.mediaId}/similar?api_key=${this.apiKey}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API request failed: ${response.status}`);
        
        const data = await response.json();
        console.log('Similar data:', data);

        if (data && data.results && data.results.length > 0) {
            const itemsWithDetails = await Promise.all(data.results.slice(0, 8).map(async (item) => {
                const type = this.mediaType; // gán media_type thủ công
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
    meta += `<span class="duration"><i class="fas fa-clock"></i>${utils.formatRuntime(item.details?.runtime || 0)}</span>`;
}

                return `
                    <div class="recommended-item" data-id="${item.id}" data-type="${item.media_type || 'movie'}">
                        <div class="recommended-bg" style="background-image: url(${this.imageBaseUrl}${item.poster_path})"></div>
                        <div class="recommended-info">
                            <h3 class="new-release-title">${title}</h3>
                            <div class="new-release-meta">
                                ${meta}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            document.querySelectorAll('.recommended-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.id;
                    const type = item.dataset.type;
                    window.location.href = `detail.html?id=${id}&type=${type}`;
                });
            });
        } else {
            console.error('Recommendations grid not found.');
        }
    }

    // Hàm quản lý bình luận với màu ngẫu nhiên không lặp lại
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

    // Danh sách 10 màu (lặp lại chu kỳ)
    const colorClasses = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5', 'color-6', 'color-7', 'color-8', 'color-9', 'color-10'];
    commentsList.innerHTML = comments.map((comment, index) => {
        // Gán màu dựa trên chỉ số comment (lặp lại sau 10)
        const colorIndex = index % 10;
        const colorClass = colorClasses[colorIndex];

        // Gán tên user dựa trên chỉ số comment (user1, user2, ...)
        const userName = `user${index + 1}`;

        return `
            <div class="comment" data-comment-id="${index}">
                <div class="comment-user">
                    <span class="${colorClass}"></span>
                    <span>${userName}</span>
                    <span class="comment-time">${comment.time}</span>
                </div>
                <p>${comment.text}</p>
                <div class="comment-actions">
                    <button class="edit-comment-btn" data-comment-id="${index}">Edit</button>
                    <button class="delete-comment-btn" data-comment-id="${index}">Delete</button>
                </div>
            </div>
        `;
    }).join('');

    // Setup edit/delete buttons
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
    // Gán tên user dựa trên số lượng comment hiện tại + 1
    let comments = [];
    try {
        comments = JSON.parse(localStorage.getItem(`comments_${this.mediaId}_${this.mediaType}`) || '[]');
    } catch (error) {
        console.error('Error reading comments from localStorage:', error);
    }
    const userName = `user${comments.length + 1}`;

    const comment = {
        user: userName, // Sử dụng tên user tăng dần
        text: text,
        time: new Date().toLocaleString()
    };

    comments.push(comment);
    localStorage.setItem(`comments_${this.mediaId}_${this.mediaType}`, JSON.stringify(comments));
    this.loadComments();
    this.showNotification('Comment added!', 'success');
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

        // Điền nội dung bình luận vào ô nhập
        commentInput.value = comment.text;
        commentInput.focus();

        // Tạm thời đổi nút Post thành Sửa
        const postCommentBtn = document.getElementById('postComment');
        if (postCommentBtn) {
            postCommentBtn.textContent = 'Save edit';
            postCommentBtn.dataset.editId = commentId;

            // Hủy chỉnh sửa khi nhấn lại
            postCommentBtn.onclick = () => {
                if (commentInput.value.trim()) {
                    comments[commentId].text = commentInput.value;
                    comments[commentId].timestamp = Date.now();
                    localStorage.setItem(`comments_${this.mediaId}_${this.mediaType}`, JSON.stringify(comments));
                    this.loadComments();
                    this.showNotification('Comment edited!', 'success');
                    commentInput.value = '';
                    postCommentBtn.textContent = 'Post';
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
        this.showNotification('Comment deleted!', 'success');
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

    setupEventListeners() {
        const recItems = document.querySelectorAll('.recommended-item');
        recItems.forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const type = item.dataset.type;
                window.location.href = `detail.html?id=${id}&type=${type}`;
            });
        });

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

        this.setupCommentButton();
        this.loadComments();

        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');
        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', () => this.handleSearch());
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });
        }
    }

    async handleSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            const query = searchInput.value.trim();
            if (!query) return;

            try {
                const endpoint = `/search/multi?api_key=${this.apiKey}&query=${encodeURIComponent(query)}`;
                const data = await this.fetchFromAPI(endpoint);
                if (data && data.results) {
                    this.renderSearchSuggestions(data.results.slice(0, 5));
                }
            } catch (error) {
                console.error('Search error:', error);
            }
        }
    }

    renderSearchSuggestions(items) {
        const suggestions = document.getElementById('searchSuggestions');
        if (suggestions) {
            suggestions.innerHTML = items.map(item => `
                <div class="suggestion-item" data-id="${item.id}" data-type="${item.media_type || 'movie'}">
                    <div class="suggestion-poster" style="background-image: url(${this.imageBaseUrl}${item.poster_path})"></div>
                    <div class="suggestion-info">
                        <div class="suggestion-title">${item.title || item.name}</div>
                        <div class="suggestion-meta">${item.media_type === 'tv' ? 'Series' : 'Movie'} • ${new Date(item.release_date || item.first_air_date).getFullYear()}</div>
                    </div>
                </div>
            `).join('');
            suggestions.classList.add('active');

            document.querySelectorAll('.suggestion-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.id;
                    const type = item.dataset.type;
                    window.location.href = `detail.html?id=${id}&type=${type}`;
                    suggestions.classList.remove('active');
                });
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MovieDetailApp();
});

const utils = {
    formatRuntime: (minutes) => {
        if (!minutes || isNaN(minutes)) return 'N/A';
        const hours = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        const secs = 0;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
};