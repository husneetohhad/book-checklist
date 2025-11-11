// server.js - Updated for MongoDB Atlas with Mongoose

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// ---- Database Connection ----
mongoose.connect(process.env.DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("Successfully connected to MongoDB Atlas."))
    .catch(err => console.error("Connection error", err));

// ---- Mongoose Schemas & Models ----

// User Schema
const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    }
});

// Hash password before saving the user
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Method to compare passwords
UserSchema.methods.comparePassword = function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);


// Book Schema
const BookSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: { type: String, required: true },
    author: { type: String, required: true },
    isbn: { type: String, required: true },
    date_purchased: { type: Date },
    publisher: { type: String },
    notes: { type: String }
}, { timestamps: true }); // timestamps adds createdAt and updatedAt automatically

const Book = mongoose.model('Book', BookSchema);


// ---- Middleware ----
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for token authentication
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.sendStatus(403);
        req.user = decoded; // decoded payload is { id: user._id, email: user.email }
        next();
    });
};


// ---- API Routes ----

// 1. User Registration
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password || password.length < 6) {
        return res.status(400).json({ message: 'Invalid email or password (must be at least 6 characters).' });
    }
    try {
        const newUser = new User({ email, password });
        await newUser.save();
        res.status(201).json({ message: 'User created successfully.' });
    } catch (error) {
        if (error.code === 11000) { // Duplicate key error
            return res.status(409).json({ message: 'Email already exists.' });
        }
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// 2. User Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const accessToken = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ accessToken });
    } catch (error) {
        res.status(500).json({ message: 'Server error during login.' });
    }
});


// ---- Book Routes (Authenticated) ----

// 3. Get all books for the logged-in user
app.get('/api/books', authenticateToken, async (req, res) => {
    try {
        const books = await Book.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve books.' });
    }
});

// 4. Add a new book
app.post('/api/books', authenticateToken, async (req, res) => {
    const { title, author, isbn, date_purchased, publisher, notes } = req.body;
    if (!title || !author || !isbn) {
        return res.status(400).json({ message: 'Title, Author, and ISBN are required.' });
    }
    try {
        const existingBook = await Book.findOne({ isbn, user: req.user.id });
        if (existingBook) {
            return res.status(409).json({ message: `You already own this book (ISBN: ${isbn}).`, book: existingBook });
        }
        const newBook = new Book({ ...req.body, user: req.user.id });
        await newBook.save();
        res.status(201).json(newBook);
    } catch (error) {
        res.status(500).json({ message: 'Failed to add book.' });
    }
});

// 5. Update a book
app.put('/api/books/:id', authenticateToken, async (req, res) => {
    try {
        const updatedBook = await Book.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            req.body,
            { new: true } // Returns the updated document
        );
        if (!updatedBook) {
            return res.status(404).json({ message: 'Book not found or you do not have permission.' });
        }
        res.json(updatedBook);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update book.' });
    }
});

// 6. Delete a book
app.delete('/api/books/:id', authenticateToken, async (req, res) => {
    try {
        const deletedBook = await Book.findOneAndDelete({ _id: req.params.id, user: req.user.id });
        if (!deletedBook) {
            return res.status(404).json({ message: 'Book not found or you do not have permission.' });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete book.' });
    }
});

// 7. Search for books (Fuzzy Search using Regex)
app.get('/api/search', authenticateToken, async (req, res) => {
    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ message: 'Search query is required.' });
    }
    try {
        const searchRegex = new RegExp(query, 'i'); // 'i' for case-insensitive
        const books = await Book.find({
            user: req.user.id,
            $or: [
                { title: searchRegex },
                { author: searchRegex },
                { isbn: searchRegex }
            ]
        });
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: 'Failed to search for books.' });
    }
});


// ---- Main Route ----
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- Start Server ----
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
