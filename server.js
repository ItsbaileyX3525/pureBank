import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql';
import bcrypt from 'bcrypt';
import https from 'https';
import http from 'http';
import fs from 'fs';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();

// Serve static files from /dist as the root
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Serve HTML files from /dist without requiring .html extension
app.use((req, res, next) => {
    if (req.method === 'GET' && !path.extname(req.path)) {
        const htmlFile = path.join(distPath, req.path + '.html');
        if (fs.existsSync(htmlFile)) {
            return res.sendFile(htmlFile);
        }
    }
    next();
});

// Check for SSL certificates
const sslPath = path.join(__dirname, 'ssl');
const certPath = path.join(sslPath, 'cert.pem');
const keyPath = path.join(sslPath, 'key.pem');

let useSSL = false;
let sslOptions = {};

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    try {
        sslOptions = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };
        useSSL = true;
        console.log('SSL certificates found, using HTTPS');
    } catch (error) {
        console.warn('SSL certificates found but could not be read:', error.message);
        console.log('Falling back to HTTP');
    }
} else {
    console.log('No SSL certificates found, using HTTP');
}

const port = useSSL ? 443 : 80;

const saltRounds = 10;

var connection = mysql.createConnection({
    host: 'localhost',
    user: 'adminDude',
    password: process.env.DATABASE_PASSWORD,
    database: 'orders'
})

connection.connect((err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to database');
    }
});


app.get('/hello', (req, res) => {
    const name = 'World';
    res.render('hello', { name });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/signin', (req, res) => {
    const { username, password, profile_image_url } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'username and password are required' });
    }
    
    const imageUrl = profile_image_url || '/assets/man.jpg';
    
    bcrypt.hash(password.trim(), saltRounds, function (err, hash) {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, error: 'failed to hash password' });
        }
        connection.query(
            'INSERT INTO users (username, password, profile_image_url) VALUES (?, ?, ?)',
            [username, hash, imageUrl],
            (err, results) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({ success: false, error: 'Username already exists' });
                    }
                    return res.status(500).json({ success: false, error: 'Database error', details: err });
                }
                return res.json({ success: true, userId: results.insertId });
            }
        );
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'username and password are required' });
    }

    connection.query(
        'SELECT id, password FROM users WHERE username = ?',
        [username],
        (err, results) => {
            if (err) {
                console.error('Database error during login:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            if (!results || results.length === 0) {
                return res.status(401).json({ success: false, error: 'Invalid username or password' });
            }

            const user = results[0];
            const hashedPassword = user.password;

            bcrypt.compare(password, hashedPassword, (err, match) => {
                if (err) {
                    console.error('bcrypt compare error:', err);
                    return res.status(500).json({ success: false, error: 'Authentication failed' });
                }
                if (!match) {
                    return res.status(401).json({ success: false, error: 'Invalid username or password' });
                }
                return res.json({ success: true, userId: user.id });
            });
        }
    );
});

app.post('/submit', (req, res) => {
    const { user_id, model_name, weight, plastic, delivery, price, fulfilled, description, amount, delivery_time, status } = req.body;
    if (!user_id || !model_name || weight === undefined || !plastic || !delivery || price === undefined) {
        return res.status(400).json({ success: false, error: 'Missing required order fields' });
    }
    connection.query(
        'INSERT INTO orders (user_id, model_name, plastic, weight, delivery, price, fulfilled, description, amount, delivery_time, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [user_id, model_name, plastic, weight, delivery, price, !!fulfilled, description || '', amount || price, delivery_time || delivery, status || 'pending'],
        (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'Database error', details: err });
            }
            res.json({ success: true, orderId: results.insertId });
        }
    );
});

app.get('/api/user/:id', (req, res) => {
    const userId = req.params.id;
    
    connection.query(
        'SELECT id, username, profile_image_url, created_at FROM users WHERE id = ?',
        [userId],
        (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            if (!results || results.length === 0) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }
            res.json({ success: true, user: results[0] });
        }
    );
});

app.get('/api/user/:id/orders', (req, res) => {
    const userId = req.params.id;
    
    connection.query(
        'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
        [userId],
        (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            res.json({ success: true, orders: results || [] });
        }
    );
});

app.get('/api/user/:id/orders/active', (req, res) => {
    const userId = req.params.id;
    
    connection.query(
        'SELECT * FROM orders WHERE user_id = ? AND fulfilled = FALSE ORDER BY created_at DESC',
        [userId],
        (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            res.json({ success: true, orders: results || [] });
        }
    );
});

app.get('/api/user/:id/orders/completed', (req, res) => {
    const userId = req.params.id;
    
    connection.query(
        'SELECT * FROM orders WHERE user_id = ? AND fulfilled = TRUE ORDER BY created_at DESC',
        [userId],
        (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            res.json({ success: true, orders: results || [] });
        }
    );
});

app.get('/admin/orders', (req, res) => {
    connection.query(
        `SELECT o.*, u.username 
         FROM orders o 
         LEFT JOIN users u ON o.user_id = u.id 
         ORDER BY o.created_at DESC`,
        (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            res.json({ success: true, orders: results || [] });
        }
    );
});

app.get('/admin/users', (req, res) => {
    connection.query(
        'SELECT id, username, profile_image_url, created_at FROM users ORDER BY created_at DESC',
        (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            res.json({ success: true, users: results || [] });
        }
    );
});

app.post('/admin/orders/:id/confirm', (req, res) => {
    const orderId = req.params.id;
    connection.query(
        'UPDATE orders SET status = "confirmed" WHERE id = ?',
        [orderId],
        (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            if (results.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Order not found' });
            }
            res.json({ success: true, message: 'Order confirmed successfully' });
        }
    );
});

app.post('/admin/orders/:id/complete', (req, res) => {
    const orderId = req.params.id;
    connection.query(
        'UPDATE orders SET status = "completed" WHERE id = ?',
        [orderId],
        (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            if (results.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Order not found' });
            }
            res.json({ success: true, message: 'Order completed successfully' });
        }
    );
});

app.delete('/admin/orders/:id', (req, res) => {
    const orderId = req.params.id;
    connection.query(
        'DELETE FROM orders WHERE id = ?',
        [orderId],
        (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            if (results.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Order not found' });
            }
            res.json({ success: true, message: 'Order deleted successfully' });
        }
    );
});

app.delete('/admin/users/:id', (req, res) => {
    const userId = req.params.id;
    
    connection.query('DELETE FROM orders WHERE user_id = ?', [userId], (err) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, error: 'Database error' });
        }
        
        connection.query('DELETE FROM users WHERE id = ?', [userId], (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            if (results.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }
            res.json({ success: true, message: 'User and all associated orders deleted successfully' });
        });
    });
});

// Create and start the server
const server = useSSL ? https.createServer(sslOptions, app) : http.createServer(app);

server.listen(port, () => {
    const protocol = useSSL ? 'https' : 'http';
    console.log(`Server running at ${protocol}://localhost:${port}`);
});
