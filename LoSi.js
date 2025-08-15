class AuthApp {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const loginSubmit = loginForm.querySelector('.submit-btn');
        const signupSubmit = signupForm.querySelector('.submit-btn');
        const forgotPasswordLink = document.getElementById('forgot-password');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                const tab = button.getAttribute('data-tab');
                loginForm.classList.remove('active');
                signupForm.classList.remove('active');

                if (tab === 'login') {
                    loginForm.classList.add('active');
                } else {
                    signupForm.classList.add('active');
                }
            });
        });

        loginSubmit.addEventListener('click', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            console.log('Login attempt:', { email, password });
            // Thêm logic xử lý đăng nhập ở đây (gọi API hoặc xử lý khác)
            alert('Đăng nhập: ' + email);
        });

        signupSubmit.addEventListener('click', (e) => {
            e.preventDefault();
            const username = document.getElementById('signup-username').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('signup-confirm-password').value;

            if (password !== confirmPassword) {
                alert('Mật khẩu xác nhận không khớp!');
                return;
            }

            console.log('Signup attempt:', { username, email, password });
            // Thêm logic xử lý đăng ký ở đây (gọi API hoặc xử lý khác)
            alert('Đăng ký: ' + username);
        });

        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Forgot password clicked');
            alert('Chức năng quên mật khẩu đang được phát triển!');
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AuthApp();
});