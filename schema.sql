CREATE DATABASE IF NOT EXISTS orders;
USE orders;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    profile_image_url VARCHAR(500) DEFAULT '/assets/man.jpg',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    plastic VARCHAR(50) NOT NULL,
    weight INT NOT NULL,
    delivery VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    fulfilled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
    description TEXT,
    amount DECIMAL(10,2),
    delivery_time VARCHAR(100),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
