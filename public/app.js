// public/app.js - Updated with all features
document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');
    let state = {
        token: localStorage.getItem('token'),
        books: [],
        currentPage: 'login', // or 'books' if token exists
        error: null,
        user: null, // To store user info
        currentTheme: localStorage.getItem('theme') || 'light'
    };

    // --- UTILITY FUNCTIONS ---
    function setToken(token) {
        state.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    }

    function setTheme(theme) {
        state.currentTheme = theme;
        localStorage.setItem('theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    }
    
    // --- API CALLS ---
    const api = {
        async request(endpoint, method = 'GET', body = null) {
            const headers = { 'Content-Type': 'application/json' };
            if (state.token) {
                headers['Authorization'] = `Bearer ${state.token}`;
            }
            try {
                const response = await fetch(`/api${endpoint}`, {
                    method,
                    headers,
                    body: body ? JSON.stringify(body) : null
                });
                if (response.status === 204) return true; // For DELETE
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'An error occurred');
                }
                return data;
            } catch (err) {
                state.error = err.message;
                if (err.message.includes('401') || err.message.includes('403')) {
                    handleLogout(); // Auto-logout on auth error
                }
                render();
                return null;
            }
        },
        login: (email, password) => api.request('/login', 'POST', { email, password }),
        register: (email, password) => api.request('/register', 'POST', { email, password }),
        getBooks: () => api.request('/books'),
        addBook: (book) => api.request('/books', 'POST', book),
        updateBook: (id, book) => api.request(`/books/${id}`, 'PUT', book),
        deleteBook: (id) => api.request(`/books/${id}`, 'DELETE'),
        searchBooks: (query) => api.request(`/search?query=${encodeURIComponent(query)}`)
    };

    // --- RENDER FUNCTIONS ---
    function render() {
        // Clear previous content
        app.innerHTML = '';
        state.error = null; // Clear error on re-render

        // Render based on current page
        if (!state.token) {
            app.innerHTML = renderAuthPage();
        } else {
            app.innerHTML = renderBooksPage();
        }

        // Add event listeners after rendering
        addEventListeners();
    }
    
    function renderAuthPage() {
        const isLogin = state.currentPage === 'login';
        return `
            <div class="auth-container">
                <h2>${isLogin ? 'Login' : 'Register'}</h2>
                <form id="auth-form">
                    <input type="email" id="email" placeholder="Email" required>
                    <input type="password" id="password" placeholder="Password (min 6 chars)" required>
                    <button type="submit">${isLogin ? 'Sign In' : 'Create Account'}</button>
                </form>
                <p>
                    ${isLogin ? "Don't have an account?" : "Already have an account?"}
                    <a href="#" id="toggle-auth">${isLogin ? 'Register' : 'Login'}</a>
                </p>
                ${state.error ? `<p class="error">${state.error}</p>` : ''}
            </div>
        `;
    }

    function renderBooksPage() {
        return `
            <div class="main-container">
                <header>
                    <h1>My Book Checklist</h1>
                    <div>
                        <button id="dark-mode-toggle">Toggle Dark Mode</button>
                        <button id="logout-btn">Logout</button>
                    </div>
                </header>
                
                <div class="actions-container">
                     <input type="search" id="search-input" placeholder="Search by Title, Author, or ISBN...">
                     <button id="add-book-btn">Add New Book</button>
                </div>

                <div id="book-list">
                    ${state.books.map(renderBookItem).join('')}
                </div>
            </div>
        `;
    }

    function renderBookItem(book) {
        return `
            <div class="book-item" data-id="${book.id}">
                <h3>${book.title}</h3>
                <p><strong>Author:</strong> ${book.author}</p>
                <p><strong>ISBN:</strong> ${book.isbn}</p>
                <p><strong>Purchased:</strong> ${book.date_purchased ? new Date(book.date_purchased).toLocaleDateString() : 'N/A'}</p>
                <button class="edit-btn">Edit</button>
                <button class="delete-btn">Delete</button>
            </div>
        `;
    }

    // --- EVENT HANDLERS & LOGIC ---
    function addEventListeners() {
        const authForm = document.getElementById('auth-form');
        if (authForm) authForm.addEventListener('submit', handleAuthSubmit);

        const toggleAuth = document.getElementById('toggle-auth');
        if (toggleAuth) toggleAuth.addEventListener('click', (e) => {
            e.preventDefault();
            state.currentPage = (state.currentPage === 'login') ? 'register' : 'login';
            render();
        });

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
        
        const addBookBtn = document.getElementById('add-book-btn');
        if(addBookBtn) addBookBtn.addEventListener('click', () => showBookModal());

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.book-item').dataset.id;
                const book = state.books.find(b => b.id == id);
                showBookModal(book);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.closest('.book-item').dataset.id;
                if(confirm('Are you sure you want to delete this book?')) {
                    await api.deleteBook(id);
                    await fetchBooks();
                }
            });
        });
        
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('keyup', async (e) => {
                if (e.target.value.length > 2 || e.target.value.length === 0) {
                    if (e.target.value.length === 0) {
                        await fetchBooks();
                    } else {
                        const results = await api.searchBooks(e.target.value);
                        if(results) {
                            state.books = results;
                            render();
                        }
                    }
                }
            });
        }
        
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        if(darkModeToggle) {
            darkModeToggle.addEventListener('click', () => {
                const newTheme = state.currentTheme === 'light' ? 'dark' : 'light';
                setTheme(newTheme);
            });
        }
    }

    async function handleAuthSubmit(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        let result;
        if (state.currentPage === 'login') {
            result = await api.login(email, password);
        } else {
            result = await api.register(email, password);
            if (result) { // auto-login after register
                 result = await api.login(email, password);
            }
        }
        if (result && result.accessToken) {
            setToken(result.accessToken);
            state.currentPage = 'books';
            await fetchBooks();
        }
    }

    function handleLogout() {
        setToken(null);
        state.books = [];
        state.currentPage = 'login';
        render();
    }
    
    async function fetchBooks() {
        const books = await api.getBooks();
        if (books) {
            state.books = books;
        }
        render();
    }

    // Modal for Add/Edit Book
    function showBookModal(book = {}) {
        const isEditing = !!book.id;
        const modalHTML = `
            <div class="modal-backdrop">
                <div class="modal">
                    <h2>${isEditing ? 'Edit Book' : 'Add New Book'}</h2>
                    <form id="book-form">
                         <input type="text" id="title" placeholder="Title*" value="${book.title || ''}" required>
                         <input type="text" id="author" placeholder="Author*" value="${book.author || ''}" required>
                         <input type="text" id="isbn" placeholder="ISBN*" value="${book.isbn || ''}" required>
                         <input type="date" id="date_purchased" value="${book.date_purchased ? book.date_purchased.split('T')[0] : ''}">
                         <input type="text" id="publisher" placeholder="Publisher" value="${book.publisher || ''}">
                         <textarea id="notes" placeholder="Notes...">${book.notes || ''}</textarea>
                         <div class="modal-buttons">
                            <button type="submit">${isEditing ? 'Update' : 'Save'}</button>
                            <button type="button" id="cancel-modal">Cancel</button>
                         </div>
                    </form>
                    <div id="modal-error" class="error"></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        document.getElementById('book-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const bookData = {
                title: document.getElementById('title').value,
                author: document.getElementById('author').value,
                isbn: document.getElementById('isbn').value,
                date_purchased: document.getElementById('date_purchased').value,
                publisher: document.getElementById('publisher').value,
                notes: document.getElementById('notes').value,
            };

            try {
                if (isEditing) {
                    await api.updateBook(book.id, bookData);
                } else {
                    await api.addBook(bookData);
                }
                closeModal();
                await fetchBooks();
            } catch(err) {
                // This is a bit of a hack since api.request handles global state.error
                // For a specific modal error, we can handle it here.
                const modalError = document.getElementById('modal-error');
                if (err.message.includes('already own this book')) {
                     modalError.textContent = err.message;
                } else {
                     modalError.textContent = "An error occurred. Please check your input.";
                }
            }
        });

        document.getElementById('cancel-modal').addEventListener('click', closeModal);
        document.querySelector('.modal-backdrop').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeModal();
        });
    }

    function closeModal() {
        const modal = document.querySelector('.modal-backdrop');
        if (modal) modal.remove();
    }


    // --- INITIALIZATION ---
    function init() {
        setTheme(state.currentTheme);
        if (state.token) {
            state.currentPage = 'books';
            fetchBooks();
        } else {
            state.currentPage = 'login';
            render();
        }
    }

    init();
});
