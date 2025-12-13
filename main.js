// Main JavaScript for ENSTP Yaoundé Website
class ENSTPWebsite {
    constructor() {
        this.apiBaseUrl = 'http://127.0.0.1:8000';
        this.token = localStorage.getItem('authToken');
        this.user = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeAnimations();
        this.checkAuthStatus();
        this.setupScrollAnimations();
        this.initializeParticles();
    }

    setupEventListeners() {
        // Mobile menu toggle
        const mobileToggle = document.querySelector('.mobile-toggle');
        const navMenu = document.querySelector('.nav-menu');
        
        if (mobileToggle) {
            mobileToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });
        }

        // Smooth scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });

        // Header scroll effect
        window.addEventListener('scroll', () => {
            const header = document.querySelector('.header');
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });

        // Form submissions
        document.addEventListener('submit', (e) => {
            if (e.target.classList.contains('auth-form')) {
                e.preventDefault();
                this.handleAuthForm(e.target);
            }
        });

        // Logout
        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
    }

    initializeAnimations() {
        // Animate elements on page load
        const animatedElements = document.querySelectorAll('.animate-on-load');
        animatedElements.forEach((element, index) => {
            setTimeout(() => {
                element.classList.add('animated');
            }, index * 100);
        });

        // Floating animations
        const floatingElements = document.querySelectorAll('.float-animation');
        floatingElements.forEach((element, index) => {
            element.style.animationDelay = `${index * 0.5}s`;
        });
    }

    setupScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animated');
                }
            });
        }, observerOptions);

        document.querySelectorAll('.animate-on-scroll').forEach(el => {
            observer.observe(el);
        });
    }

    initializeParticles() {
        // Particle system for hero section
        const hero = document.querySelector('.hero');
        if (hero) {
            this.createParticles(hero);
        }
    }

    createParticles(container) {
        const particleCount = 50;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.cssText = `
                position: absolute;
                width: 2px;
                height: 2px;
                background: rgba(255, 182, 6, 0.3);
                border-radius: 50%;
                pointer-events: none;
                animation: float ${3 + Math.random() * 4}s ease-in-out infinite;
                animation-delay: ${Math.random() * 2}s;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
            `;
            container.appendChild(particle);
        }
    }

    // API Integration
    async apiRequest(endpoint, options = {}) {
        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Authentication methods
    async login(email, password) {
        try {
            const data = await this.apiRequest('/api/auth/login/', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            
            this.token = data.access;
            localStorage.setItem('authToken', this.token);
            
            await this.getUserProfile();
            this.updateAuthUI();
            
            // Redirect to dashboard
            window.location.href = 'memoire.html';
            
            return data;
        } catch (error) {
            this.showNotification('Login failed: ' + error.message, 'error');
            throw error;
        }
    }

    async register(userData) {
        try {
            const data = await this.apiRequest('/api/auth/register/', {
                method: 'POST',
                body: JSON.stringify(userData)
            });
            
            this.showNotification('Registration successful! Please login.', 'success');
            
            // Redirect to login
            setTimeout(() => {
                window.location.href = 'register.html';
            }, 2000);
            
            return data;
        } catch (error) {
            this.showNotification('Registration failed: ' + error.message, 'error');
            throw error;
        }
    }

    async getUserProfile() {
        try {
            const data = await this.apiRequest('/api/auth/profile/');
            this.user = data;
            return data;
        } catch (error) {
            console.error('Failed to get user profile:', error);
            throw error;
        }
    }

    async changePassword(oldPassword, newPassword) {
        try {
            const data = await this.apiRequest('/api/auth/change-password/', {
                method: 'POST',
                body: JSON.stringify({
                    old_password: oldPassword,
                    new_password: newPassword
                })
            });
            
            this.showNotification('Password changed successfully!', 'success');
            return data;
        } catch (error) {
            this.showNotification('Password change failed: ' + error.message, 'error');
            throw error;
        }
    }

    async resetPassword(email) {
        try {
            const data = await this.apiRequest('/api/auth/reset-password/', {
                method: 'POST',
                body: JSON.stringify({ email })
            });
            
            this.showNotification('Password reset email sent!', 'success');
            return data;
        } catch (error) {
            this.showNotification('Password reset failed: ' + error.message, 'error');
            throw error;
        }
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('authToken');
        
        this.updateAuthUI();
        window.location.href = 'index.html';
    }

    async checkAuthStatus() {
        if (this.token) {
            try {
                await this.getUserProfile();
                this.updateAuthUI();
            } catch (error) {
                this.logout();
            }
        }
    }

    updateAuthUI() {
        const authElements = document.querySelectorAll('.auth-only');
        const guestElements = document.querySelectorAll('.guest-only');
        
        if (this.user) {
            authElements.forEach(el => el.style.display = 'block');
            guestElements.forEach(el => el.style.display = 'none');
            
            // Update user name displays
            document.querySelectorAll('.user-name').forEach(el => {
                el.textContent = this.user.full_name || this.user.email;
            });
        } else {
            authElements.forEach(el => el.style.display = 'none');
            guestElements.forEach(el => el.style.display = 'block');
        }
    }

    handleAuthForm(form) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Add loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.classList.add('loading');
        submitBtn.textContent = 'Processing...';
        
        let promise;
        
        if (form.classList.contains('login-form')) {
            promise = this.login(data.email, data.password);
        } else if (form.classList.contains('register-form')) {
            promise = this.register(data);
        } else if (form.classList.contains('reset-form')) {
            promise = this.resetPassword(data.email);
        }
        
        if (promise) {
            promise.finally(() => {
                submitBtn.classList.remove('loading');
                submitBtn.textContent = originalText;
            });
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        
        // Set background color based on type
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196F3'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 5000);
    }

    // Utility methods
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    truncateText(text, maxLength = 100) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    showLoading(element) {
        element.classList.add('loading');
    }

    hideLoading(element) {
        element.classList.remove('loading');
    }
}

// Initialize the website when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.enstpWebsite = new ENSTPWebsite();
});

// Add custom CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .particle {
        opacity: 0.6;
    }
    
    .notification {
        word-wrap: break-word;
    }
`;
document.head.appendChild(style);