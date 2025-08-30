import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql';
import bcrypt from 'bcrypt';
import https from 'https';
import http from 'http';
import fs from 'fs';
import 'dotenv/config';
import session from 'express-session';
import MySQLStore from 'express-mysql-session';

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

const port = useSSL ? 443 : 3000;

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

// Admin: Get all discount codes
app.get('/admin/discounts', (req, res) => {
    connection.query('SELECT * FROM discount_codes ORDER BY created_at DESC', [], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Database error', details: err });
        }
        res.json({ success: true, discounts: results });
    });
});

// Admin: Create a new discount code
app.post('/admin/discounts', (req, res) => {
    const { code, description, discount_type, discount_value, active, expires_at, max_uses } = req.body;
    if (!code || !discount_type || discount_value === undefined) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    connection.query(
        'INSERT INTO discount_codes (code, description, discount_type, discount_value, active, expires_at, max_uses) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [code, description || '', discount_type, discount_value, active !== undefined ? !!active : true, expires_at || null, max_uses !== undefined ? parseInt(max_uses) : -1],
        (err, results) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ success: false, error: 'Discount code already exists' });
                }
                return res.status(500).json({ success: false, error: 'Database error', details: err });
            }
            res.json({ success: true, id: results.insertId });
        }
    );
});

// Admin: Delete a discount code
app.delete('/admin/discounts/:id', (req, res) => {
    const id = req.params.id;
    connection.query('DELETE FROM discount_codes WHERE id = ?', [id], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Database error', details: err });
        }
        res.json({ success: true });
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


// Validate discount code (check usage limit)
app.get('/api/discount/:code', (req, res) => {
    const code = req.params.code;
    connection.query(
        'SELECT * FROM discount_codes WHERE code = ? AND active = TRUE AND (expires_at IS NULL OR expires_at > NOW())',
        [code],
        (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'Database error', details: err });
            }
            if (!results || results.length === 0) {
                return res.json({ success: false, error: 'Invalid or expired code' });
            }
            const discount = results[0];
            if (discount.max_uses !== -1 && discount.uses >= discount.max_uses) {
                return res.json({ success: false, error: 'Discount code usage limit reached' });
            }
            res.json({ success: true, discount });
        }
    );
});

// Order submission with discount code
app.post('/submit', (req, res) => {
    const { user_id, model_name, weight, plastic, delivery, shipping_location, price, fulfilled, description, amount, delivery_time, status, discount_code } = req.body;
    if (!user_id || !model_name || weight === undefined || !plastic || !delivery || !shipping_location || price === undefined) {
        return res.status(400).json({ success: false, error: 'Missing required order fields' });
    }

    function insertOrder(discount_code_id = null, discount_applied = 0, incrementDiscount = false) {
        const orderData = [user_id, model_name, plastic, weight, delivery, shipping_location, price, !!fulfilled, description || '', amount || price, delivery_time || delivery, status || 'pending', discount_code_id, discount_applied];
        connection.query(
            'INSERT INTO orders (user_id, model_name, plastic, weight, delivery, shipping_location, price, fulfilled, description, amount, delivery_time, status, discount_code_id, discount_applied) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            orderData,
            (err, results) => {
                if (err) {
                    console.error('Order insert error:', err, '\nOrder data:', orderData);
                    return res.status(500).json({ success: false, error: 'Database error', details: err });
                }
                if (incrementDiscount && discount_code_id) {
                    connection.query('UPDATE discount_codes SET uses = uses + 1 WHERE id = ?', [discount_code_id], (err2) => {
                        if (err2) {
                            console.error('Failed to increment discount uses:', err2, 'for discount_code_id:', discount_code_id);
                        }
                    });
                }
                res.json({ success: true, orderId: results.insertId });
            }
        );
    }

    if (discount_code) {
        connection.query(
            'SELECT * FROM discount_codes WHERE code = ? AND active = TRUE AND (expires_at IS NULL OR expires_at > NOW())',
            [discount_code],
            (err, results) => {
                if (err) {
                    return res.status(500).json({ success: false, error: 'Database error', details: err });
                }
                if (!results || results.length === 0) {
                    // Invalid code, insert order without discount
                    insertOrder();
                } else {
                    const discount = results[0];
                    if (discount.max_uses !== -1 && discount.uses >= discount.max_uses) {
                        // Usage limit reached, insert order without discount
                        insertOrder();
                    } else {
                        let discount_applied = 0;
                        if (discount.discount_type === 'percent') {
                            discount_applied = price * (discount.discount_value / 100);
                        } else {
                            discount_applied = discount.discount_value;
                        }
                        insertOrder(discount.id, discount_applied, true);
                    }
                }
            }
        );
    } else {
        insertOrder();
    }
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
        'SELECT * FROM orders WHERE user_id = ? AND (status = "pending" OR status = "confirmed") ORDER BY created_at DESC',
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
        'SELECT * FROM orders WHERE user_id = ? AND status = "completed" ORDER BY created_at DESC',
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

// Add session configuration after app initialization
const MySQLStoreSession = MySQLStore(session);
const sessionStore = new MySQLStoreSession({
    host: 'localhost',
    user: 'adminDude',
    password: process.env.DATABASE_PASSWORD,
    database: 'orders'
});

app.use(session({
    key: 'admin_session',
    secret: process.env.SESSION_SECRET || 'your-super-secret-key-change-this',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        secure: useSSL, // Use secure cookies in production
        httpOnly: true
    }
}));

// Middleware to check admin authentication
const requireAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next();
    } else {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
};

// Admin authentication endpoint
app.post('/admin/auth', (req, res) => {
    const { password } = req.body;
    
    // Store admin password in environment variable
    const adminPassword = process.env.ADMIN_PASSWORD || 'FuckGhost44';
    
    if (password === adminPassword) {
        req.session.isAdmin = true;
        res.json({ success: true, message: 'Authentication successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});

// Admin logout endpoint
app.post('/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.status(500).json({ success: false, message: 'Could not log out' });
        } else {
            res.json({ success: true, message: 'Logged out successfully' });
        }
    });
});

// Check admin session status
app.get('/admin/status', (req, res) => {
    if (req.session && req.session.isAdmin) {
        res.json({ success: true, isAuthenticated: true });
    } else {
        res.json({ success: true, isAuthenticated: false });
    }
});

app.get('/admin/orders', requireAdmin, (req, res) => {
    connection.query(
        'SELECT o.*, u.username FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC',
        (err, results) => {
            if (err) {
                console.error('Error fetching orders:', err);
                res.status(500).json({ success: false, message: 'Database error' });
            } else {
                res.json({ success: true, orders: results });
            }
        }
    );
});

app.get('/admin/users', requireAdmin, (req, res) => {
    connection.query(
        'SELECT id, username, profile_image_url, created_at FROM users ORDER BY created_at DESC',
        (err, results) => {
            if (err) {
                console.error('Error fetching users:', err);
                res.status(500).json({ success: false, message: 'Database error' });
            } else {
                res.json({ success: true, users: results });
            }
        }
    );
});

app.post('/admin/orders/:id/confirm', requireAdmin, (req, res) => {
    const orderId = req.params.id;
    
    connection.query(
        'UPDATE orders SET status = ?, fulfilled = ? WHERE id = ?',
        ['confirmed', true, orderId],
        (err, results) => {
            if (err) {
                console.error('Error confirming order:', err);
                res.status(500).json({ success: false, message: 'Database error' });
            } else if (results.affectedRows === 0) {
                res.status(404).json({ success: false, message: 'Order not found' });
            } else {
                res.json({ success: true, message: 'Order confirmed successfully' });
            }
        }
    );
});

app.post('/admin/orders/:id/complete', requireAdmin, (req, res) => {
    const orderId = req.params.id;
    
    connection.query(
        'UPDATE orders SET status = ?, fulfilled = ? WHERE id = ?',
        ['completed', true, orderId],
        (err, results) => {
            if (err) {
                console.error('Error completing order:', err);
                res.status(500).json({ success: false, message: 'Database error' });
            } else if (results.affectedRows === 0) {
                res.status(404).json({ success: false, message: 'Order not found' });
            } else {
                res.json({ success: true, message: 'Order completed successfully' });
            }
        }
    );
});

app.delete('/admin/orders/:id', requireAdmin, (req, res) => {
    const orderId = req.params.id;
    
    connection.query(
        'DELETE FROM orders WHERE id = ?',
        [orderId],
        (err, results) => {
            if (err) {
                console.error('Error deleting order:', err);
                res.status(500).json({ success: false, message: 'Database error' });
            } else if (results.affectedRows === 0) {
                res.status(404).json({ success: false, message: 'Order not found' });
            } else {
                res.json({ success: true, message: 'Order deleted successfully' });
            }
        }
    );
});

app.delete('/admin/users/:id', requireAdmin, (req, res) => {
    const userId = req.params.id;
    
    // First delete all orders for this user
    connection.query(
        'DELETE FROM orders WHERE user_id = ?',
        [userId],
        (err) => {
            if (err) {
                console.error('Error deleting user orders:', err);
                res.status(500).json({ success: false, message: 'Database error' });
                return;
            }
            
            // Then delete the user
            connection.query(
                'DELETE FROM users WHERE id = ?',
                [userId],
                (err, results) => {
                    if (err) {
                        console.error('Error deleting user:', err);
                        res.status(500).json({ success: false, message: 'Database error' });
                    } else if (results.affectedRows === 0) {
                        res.status(404).json({ success: false, message: 'User not found' });
                    } else {
                        res.json({ success: true, message: 'User and all orders deleted successfully' });
                    }
                }
            );
        }
    );
});

// Create and start the server
const server = useSSL ? https.createServer(sslOptions, app) : http.createServer(app);

server.listen(port, () => {
    const protocol = useSSL ? 'https' : 'http';
    console.log(`Server running at ${protocol}://localhost:${port}`);
});
