-- ============================================================
-- AI Smart Complaint Management System - MySQL Schema
-- ============================================================

DROP DATABASE IF EXISTS smart_complaints;
CREATE DATABASE smart_complaints CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smart_complaints;

-- ------------------------------------------------------------
-- Users
-- ------------------------------------------------------------
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role ENUM('USER', 'STAFF', 'ADMIN') NOT NULL DEFAULT 'USER',
    department_id INT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email),
    INDEX idx_users_role (role)
);

-- ------------------------------------------------------------
-- Departments
-- ------------------------------------------------------------
CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    contact_email VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Categories
-- ------------------------------------------------------------
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    default_department_id INT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (default_department_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- Priorities (reference table)
-- ------------------------------------------------------------
CREATE TABLE priorities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    level INT NOT NULL, -- 1=Low, 2=Medium, 3=High, 4=Critical
    sla_hours INT DEFAULT 24
);

-- Add FK for department in users after departments exist
ALTER TABLE users
    ADD CONSTRAINT fk_user_department
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- Complaints
-- ------------------------------------------------------------
CREATE TABLE complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(200),
    image_path VARCHAR(500),

    -- AI predictions (stored at submission time)
    ai_category VARCHAR(100),
    ai_priority VARCHAR(50),
    ai_department VARCHAR(100),
    ai_sentiment VARCHAR(50),
    ai_confidence DECIMAL(5,4),
    ai_raw_prediction JSON,

    -- Final (possibly admin-overridden) fields
    category_id INT NULL,
    priority_id INT NULL,
    department_id INT NULL,
    assigned_to INT NULL,

    status ENUM(
        'SUBMITTED','AI_ANALYZED','CLASSIFIED','ASSIGNED',
        'IN_PROGRESS','RESOLVED','CLOSED','REOPENED'
    ) NOT NULL DEFAULT 'SUBMITTED',

    resolution_message TEXT,
    user_rating INT NULL,           -- 1-5
    user_feedback TEXT,

    -- Duplicate detection
    duplicate_of INT NULL,
    similarity_score DECIMAL(5,4),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    closed_at TIMESTAMP NULL,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE SET NULL,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (duplicate_of) REFERENCES complaints(id) ON DELETE SET NULL,

    INDEX idx_complaints_user (user_id),
    INDEX idx_complaints_status (status),
    INDEX idx_complaints_dept (department_id),
    INDEX idx_complaints_created (created_at)
);

-- ------------------------------------------------------------
-- Complaint status history
-- ------------------------------------------------------------
CREATE TABLE complaint_status_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by INT NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_history_complaint (complaint_id)
);

-- ------------------------------------------------------------
-- Comments / internal notes
-- ------------------------------------------------------------
CREATE TABLE complaint_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    is_internal TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- AI prediction audit log
-- ------------------------------------------------------------
CREATE TABLE ai_predictions_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT NULL,
    input_text TEXT NOT NULL,
    category VARCHAR(100),
    priority VARCHAR(50),
    department VARCHAR(100),
    sentiment VARCHAR(50),
    confidence DECIMAL(5,4),
    latency_ms INT,
    model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE SET NULL
);

-- ============================================================
-- Seed data
-- ============================================================
INSERT INTO departments (name, description, contact_email) VALUES
('Maintenance', 'Building, water, electricity, plumbing', 'maintenance@org.com'),
('IT Support', 'Internet, computers, software, network', 'it@org.com'),
('Hostel Administration', 'Hostel rooms, mess, wardens', 'hostel@org.com'),
('Academic', 'Faculty, courses, exams, results', 'academic@org.com'),
('Security', 'Campus safety, theft, harassment', 'security@org.com'),
('Sanitation', 'Cleaning, garbage, hygiene', 'sanitation@org.com'),
('Transport', 'Buses, parking, vehicles', 'transport@org.com'),
('HR / Administration', 'General admin, staff issues', 'admin@org.com');

INSERT INTO priorities (name, level, sla_hours) VALUES
('Low', 1, 72),
('Medium', 2, 48),
('High', 3, 24),
('Critical', 4, 4);

INSERT INTO categories (name, default_department_id) VALUES
('Water Supply', 1),
('Electricity', 1),
('Plumbing', 1),
('Internet/Wifi', 2),
('Computer/Hardware', 2),
('Hostel Room', 3),
('Mess/Food', 3),
('Academic Issue', 4),
('Faculty Issue', 4),
('Security/Safety', 5),
('Harassment', 5),
('Cleanliness', 6),
('Garbage', 6),
('Transport', 7),
('Parking', 7),
('Administrative', 8),
('Other', 8);

-- Default admin: password = Admin@123 (bcrypt hash generated)
-- Hash for 'Admin@123' generated with bcrypt cost 10
INSERT INTO users (name, email, password_hash, role) VALUES
('Super Admin', 'admin@scms.com',
 '$2b$10$X1jP7Uw3F5J5b9j8u7Y6y.q7XxA6vC3sQ4bN8mVn.iH2gR1yL0Kja', 'ADMIN');
