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

let useInMemoryDB = false;
let inMemoryDB = {
    users: [],
    orders: [],
    discount_codes: [],
    nextUserId: 1,
    nextOrderId: 1,
    nextDiscountId: 1
};

const initInMemoryDB = () => {
    console.log('Initializing in-memory database...');
    inMemoryDB.users.push({
        id: 1,
        username: 'admin',
        password: '$2b$10$defaultHashedPassword',
        profile_image_url: '/assets/man.jpg',
        shipping_address: 'Admin Office, Default City',
        created_at: new Date().toISOString()
    });
    inMemoryDB.nextUserId = 2;
    
    inMemoryDB.discount_codes.push({
        id: 1,
        code: 'WELCOME10',
        description: 'Welcome discount',
        discount_type: 'percent',
        discount_value: 10,
        active: true,
        expires_at: null,
        max_uses: -1,
        uses: 0,
        created_at: new Date().toISOString()
    });
    inMemoryDB.nextDiscountId = 2;
};

const pool = mysql.createPool({
    host: 'localhost',
    user: 'adminDude',
    password: process.env.DATABASE_PASSWORD,
    database: 'orders',
    connectionLimit: 10
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection error:', err);
        console.log('Falling back to in-memory database...');
        useInMemoryDB = true;
        initInMemoryDB();
        setupSessionStore();
    } else {
        console.log('Connected to MySQL database');
        connection.release();
        setupSessionStore();
    }
});

const setupSessionStore = () => {
    // Session middleware is already configured above
    // This function now just handles server startup
    console.log('Database initialization complete, starting server...');
    
    startServer();
};

const startServer = () => {
    const server = useSSL ? https.createServer(sslOptions, app) : http.createServer(app);

    server.listen(port, () => {
        const protocol = useSSL ? 'https' : 'http';
        const dbMode = useInMemoryDB ? 'In-Memory Database (non-persistent)' : 'MySQL Database';
        console.log(`Server running at ${protocol}://localhost:${port}`);
        console.log(`Database mode: ${dbMode}`);
        if (useInMemoryDB) {
            console.log('Note: All data will be lost when the server restarts');
            console.log('To use persistent storage, ensure MySQL is running and properly configured');
        }
    });
};

const dbQuery = (query, params, callback) => {
    if (useInMemoryDB) {
        handleInMemoryQuery(query, params, callback);
    } else {
        pool.query(query, params, callback);
    }
};

const handleInMemoryQuery = (query, params, callback) => {
    try {
        const queryLower = query.toLowerCase().trim();
        
        if (queryLower.startsWith('insert into users')) {
            const [username, password, profile_image_url, shipping_address] = params;
            
            if (inMemoryDB.users.find(u => u.username === username)) {
                const error = new Error('Duplicate entry');
                error.code = 'ER_DUP_ENTRY';
                return callback(error);
            }
            
            const newUser = {
                id: inMemoryDB.nextUserId++,
                username,
                password,
                profile_image_url,
                shipping_address,
                created_at: new Date().toISOString()
            };
            inMemoryDB.users.push(newUser);
            callback(null, { insertId: newUser.id });
            
        } else if (queryLower.startsWith('select id, password from users where username')) {
            const username = params[0];
            const user = inMemoryDB.users.find(u => u.username === username);
            callback(null, user ? [{ id: user.id, password: user.password }] : []);
            
        } else if (queryLower.startsWith('select id, username, profile_image_url, shipping_address, created_at from users where id')) {
            const userId = parseInt(params[0]);
            const user = inMemoryDB.users.find(u => u.id === userId);
            callback(null, user ? [user] : []);
            
        } else if (queryLower.startsWith('insert into orders')) {
            const [user_id, model_name, plastic, weight, delivery, shipping_location, price, fulfilled, description, amount, delivery_time, status, discount_code_id, discount_applied] = params;
            const newOrder = {
                id: inMemoryDB.nextOrderId++,
                user_id: parseInt(user_id),
                model_name,
                plastic,
                weight: parseInt(weight),
                delivery,
                shipping_location,
                price: parseFloat(price),
                fulfilled: !!fulfilled,
                description,
                amount: parseFloat(amount),
                delivery_time,
                status,
                discount_code_id: discount_code_id ? parseInt(discount_code_id) : null,
                discount_applied: parseFloat(discount_applied) || 0,
                created_at: new Date().toISOString()
            };
            inMemoryDB.orders.push(newOrder);
            callback(null, { insertId: newOrder.id });
            
        } else if (queryLower.includes('from orders where user_id')) {
            const userId = parseInt(params[0]);
            let orders = inMemoryDB.orders.filter(o => o.user_id === userId);
            
            if (queryLower.includes('status = "pending" or status = "confirmed"')) {
                orders = orders.filter(o => o.status === 'pending' || o.status === 'confirmed');
            } else if (queryLower.includes('status = "completed"')) {
                orders = orders.filter(o => o.status === 'completed');
            }
            
            callback(null, orders);
            
        } else if (queryLower.startsWith('select * from discount_codes')) {
            if (queryLower.includes('where code = ?')) {
                const code = params[0];
                const discount = inMemoryDB.discount_codes.find(d => 
                    d.code === code && 
                    d.active && 
                    (!d.expires_at || new Date(d.expires_at) > new Date())
                );
                callback(null, discount ? [discount] : []);
            } else {
                callback(null, inMemoryDB.discount_codes);
            }
            
        } else if (queryLower.startsWith('insert into discount_codes')) {
            const [code, description, discount_type, discount_value, active, expires_at, max_uses] = params;
            
            if (inMemoryDB.discount_codes.find(d => d.code === code)) {
                const error = new Error('Duplicate entry');
                error.code = 'ER_DUP_ENTRY';
                return callback(error);
            }
            
            const newDiscount = {
                id: inMemoryDB.nextDiscountId++,
                code,
                description,
                discount_type,
                discount_value: parseFloat(discount_value),
                active: !!active,
                expires_at,
                max_uses: parseInt(max_uses),
                uses: 0,
                created_at: new Date().toISOString()
            };
            inMemoryDB.discount_codes.push(newDiscount);
            callback(null, { insertId: newDiscount.id });
            
        } else if (queryLower.startsWith('update discount_codes set uses')) {
            const discountId = parseInt(params[0]);
            const discount = inMemoryDB.discount_codes.find(d => d.id === discountId);
            if (discount) {
                discount.uses += 1;
            }
            callback(null, { affectedRows: discount ? 1 : 0 });
            
        } else if (queryLower.startsWith('delete from discount_codes')) {
            const id = parseInt(params[0]);
            const index = inMemoryDB.discount_codes.findIndex(d => d.id === id);
            if (index !== -1) {
                inMemoryDB.discount_codes.splice(index, 1);
            }
            callback(null, { affectedRows: index !== -1 ? 1 : 0 });
            
        } else if (queryLower.includes('orders o join users u')) {
            const ordersWithUsers = inMemoryDB.orders.map(order => {
                const user = inMemoryDB.users.find(u => u.id === order.user_id);
                return { ...order, username: user ? user.username : 'Unknown' };
            });
            callback(null, ordersWithUsers);
            
        } else if (queryLower.startsWith('select id, username, profile_image_url, shipping_address, created_at from users order by')) {
            callback(null, inMemoryDB.users);
            
        } else if (queryLower.startsWith('update orders set status')) {
            const [status, fulfilled, orderId] = params;
            const order = inMemoryDB.orders.find(o => o.id === parseInt(orderId));
            if (order) {
                order.status = status;
                order.fulfilled = !!fulfilled;
            }
            callback(null, { affectedRows: order ? 1 : 0 });
            
        } else if (queryLower.startsWith('delete from orders where id')) {
            const orderId = parseInt(params[0]);
            const index = inMemoryDB.orders.findIndex(o => o.id === orderId);
            if (index !== -1) {
                inMemoryDB.orders.splice(index, 1);
            }
            callback(null, { affectedRows: index !== -1 ? 1 : 0 });
            
        } else if (queryLower.startsWith('delete from orders where user_id')) {
            const userId = parseInt(params[0]);
            const initialLength = inMemoryDB.orders.length;
            inMemoryDB.orders = inMemoryDB.orders.filter(o => o.user_id !== userId);
            callback(null, { affectedRows: initialLength - inMemoryDB.orders.length });
            
        } else if (queryLower.startsWith('delete from users where id')) {
            const userId = parseInt(params[0]);
            const index = inMemoryDB.users.findIndex(u => u.id === userId);
            if (index !== -1) {
                inMemoryDB.users.splice(index, 1);
            }
            callback(null, { affectedRows: index !== -1 ? 1 : 0 });
            
        } else if (queryLower.startsWith('update orders set amount')) {
            const [amount, price, orderId] = params;
            const order = inMemoryDB.orders.find(o => o.id === parseInt(orderId));
            if (order) {
                order.amount = parseFloat(amount);
                order.price = parseFloat(price);
            }
            callback(null, { affectedRows: order ? 1 : 0 });
            
        } else if (queryLower.startsWith('update orders set discount_applied')) {
            const [discount_applied, orderId] = params;
            const order = inMemoryDB.orders.find(o => o.id === parseInt(orderId));
            if (order) {
                order.discount_applied = parseFloat(discount_applied);
            }
            callback(null, { affectedRows: order ? 1 : 0 });
            
        } else {
            console.log('Unhandled query:', query);
            callback(null, []);
        }
    } catch (error) {
        callback(error);
    }
};


app.get('/hello', (req, res) => {
    const name = 'World';
    res.render('hello', { name });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure session middleware immediately with memory store
app.use(session({
    key: 'admin_session',
    secret: process.env.SESSION_SECRET || 'your-super-secret-key-change-this',
    store: undefined, // Use memory store by default
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        secure: false, // Will be set to true if SSL is used
        httpOnly: true
    }
}));

app.post('/signin', (req, res) => {
    const { username, password, profile_image_url, shipping_address } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'username and password are required' });
    }
    
    const imageUrl = profile_image_url || '/assets/man.jpg';
    
    bcrypt.hash(password.trim(), saltRounds, function (err, hash) {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, error: 'failed to hash password' });
        }
        dbQuery(
            'INSERT INTO users (username, password, profile_image_url, shipping_address) VALUES (?, ?, ?, ?)',
            [username, hash, imageUrl, shipping_address],
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

app.get('/admin/discounts', (req, res) => {
    dbQuery('SELECT * FROM discount_codes ORDER BY created_at DESC', [], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Database error', details: err });
        }
        res.json({ success: true, discounts: results });
    });
});

app.post('/admin/discounts', (req, res) => {
    const { code, description, discount_type, discount_value, active, expires_at, max_uses } = req.body;
    if (!code || !discount_type || discount_value === undefined) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    dbQuery(
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

app.delete('/admin/discounts/:id', (req, res) => {
    const id = req.params.id;
    dbQuery('DELETE FROM discount_codes WHERE id = ?', [id], (err, results) => {
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

    dbQuery(
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


app.get('/api/discount/:code', (req, res) => {
    const code = req.params.code;
    dbQuery(
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

app.post('/submit', (req, res) => {
    const { user_id, model_name, weight, plastic, delivery, shipping_location, price, fulfilled, description, amount, delivery_time, status, discount_code } = req.body;
    if (!user_id || !model_name || weight === undefined || !plastic || !delivery || !shipping_location || price === undefined) {
        return res.status(400).json({ success: false, error: 'Missing required order fields' });
    }

    function insertOrder(discount_code_id = null, discount_applied = 0, incrementDiscount = false) {
        const orderData = [user_id, model_name, plastic, weight, delivery, shipping_location, price, !!fulfilled, description || '', amount || price, delivery_time || delivery, status || 'pending', discount_code_id, discount_applied];
        dbQuery(
            'INSERT INTO orders (user_id, model_name, plastic, weight, delivery, shipping_location, price, fulfilled, description, amount, delivery_time, status, discount_code_id, discount_applied) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            orderData,
            (err, results) => {
                if (err) {
                    console.error('Order insert error:', err, '\nOrder data:', orderData);
                    return res.status(500).json({ success: false, error: 'Database error', details: err });
                }
                if (incrementDiscount && discount_code_id) {
                    dbQuery('UPDATE discount_codes SET uses = uses + 1 WHERE id = ?', [discount_code_id], (err2) => {
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
        dbQuery(
            'SELECT * FROM discount_codes WHERE code = ? AND active = TRUE AND (expires_at IS NULL OR expires_at > NOW())',
            [discount_code],
            (err, results) => {
                if (err) {
                    return res.status(500).json({ success: false, error: 'Database error', details: err });
                }
                if (!results || results.length === 0) {
                    insertOrder();
                } else {
                    const discount = results[0];
                    if (discount.max_uses !== -1 && discount.uses >= discount.max_uses) {
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
    
    dbQuery(
        'SELECT id, username, profile_image_url, shipping_address, created_at FROM users WHERE id = ?',
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
    
    dbQuery(
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
    
    dbQuery(
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
    
    dbQuery(
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

const requireAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next();
    } else {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
};

app.post('/admin/auth', (req, res) => {
    const { password } = req.body;
    
    const adminPassword = process.env.ADMIN_PASSWORD || 'FuckGhost44';
    
    if (password === adminPassword) {
        req.session.isAdmin = true;
        res.json({ success: true, message: 'Authentication successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});

app.post('/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.status(500).json({ success: false, message: 'Could not log out' });
        } else {
            res.json({ success: true, message: 'Logged out successfully' });
        }
    });
});

app.get('/admin/status', (req, res) => {
    if (req.session && req.session.isAdmin) {
        res.json({ success: true, isAuthenticated: true });
    } else {
        res.json({ success: true, isAuthenticated: false });
    }
});

app.post('/admin/orders', requireAdmin, (req, res) => {
    const { user_id, model_name, plastic, weight, delivery, shipping_location, price, amount, fulfilled, description, delivery_time, status, discount_code } = req.body;
    const uid = user_id || 1;
    const orderData = [
        uid,
        model_name,
        plastic,
        weight,
        delivery,
        shipping_location,
        price,
        !!fulfilled,
        description || '',
        amount || price,
        delivery_time || delivery,
        status || 'pending',
        null,
        0.00
    ];
    dbQuery(
        'INSERT INTO orders (user_id, model_name, plastic, weight, delivery, shipping_location, price, fulfilled, description, amount, delivery_time, status, discount_code_id, discount_applied) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        orderData,
        (err, results) => {
            if (err) {
                console.error('Admin order insert error:', err, '\nOrder data:', orderData);
                return res.status(500).json({ success: false, error: 'Database error', details: err });
            }
            res.json({ success: true, orderId: results.insertId });
        }
    );
});

app.get('/admin/orders', requireAdmin, (req, res) => {
    dbQuery(
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
    dbQuery(
        'SELECT id, username, profile_image_url, shipping_address, created_at FROM users ORDER BY created_at DESC',
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
    
    dbQuery(
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
    
    dbQuery(
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
    
    dbQuery(
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
    
    dbQuery(
        'DELETE FROM orders WHERE user_id = ?',
        [userId],
        (err) => {
            if (err) {
                console.error('Error deleting user orders:', err);
                res.status(500).json({ success: false, message: 'Database error' });
                return;
            }
            dbQuery(
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

// Get detailed user account information
app.get('/admin/users/:id/details', requireAdmin, (req, res) => {
    const userId = req.params.id;
    
    if (useInMemoryDB) {
        const user = inMemoryDB.users.find(u => u.id === parseInt(userId));
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        const userDetails = {
            id: user.id,
            username: user.username,
            profile_image_url: user.profile_image_url,
            shipping_address: user.shipping_address,
            created_at: user.created_at,
            email: user.email || null,
            phone: user.phone || null,
            balance: user.balance || 0
        };
        
        res.json({ success: true, user: userDetails });
    } else {
        dbQuery(
            'SELECT id, username, profile_image_url, shipping_address, created_at, email, phone, balance FROM users WHERE id = ?',
            [userId],
            (err, results) => {
                if (err) {
                    console.error('Error fetching user details:', err);
                    res.status(500).json({ success: false, message: 'Database error' });
                } else if (results.length === 0) {
                    res.status(404).json({ success: false, message: 'User not found' });
                } else {
                    res.json({ success: true, user: results[0] });
                }
            }
        );
    }
});


app.post('/admin/orders/:id/amount', async (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    const { amount } = req.body;
    if (isNaN(orderId) || typeof amount !== 'number') {
        return res.status(400).json({ success: false, error: 'Invalid input' });
    }
    dbQuery('UPDATE orders SET amount = ?, price = ? WHERE id = ?', [amount, amount, orderId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Database error' });
        }
        res.json({ success: true });
    });
});

app.patch('/admin/order/:id/discount', requireAdmin, (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    const { discount_applied } = req.body;
    if (isNaN(orderId) || typeof discount_applied !== 'number' || discount_applied < 0) {
        return res.status(400).json({ success: false, error: 'Invalid input' });
    }
    dbQuery('UPDATE orders SET discount_applied = ? WHERE id = ?', [discount_applied, orderId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Database error' });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        res.json({ success: true });
    });
});

console.log('Starting application...');
