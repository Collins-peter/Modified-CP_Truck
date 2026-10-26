-- ====================================================================
-- CP TRUCK INTELLIGENT DISPATCH DELIVERY SYSTEM
-- B.Sc Project Database Schema & Seed Data
-- Department of Computer Science, University of Nigeria, Nsukka
-- Project Title: DESIGN AND IMPLEMENTATION OF AN INTELLIGENT DISPATCH DELIVERY
--                SYSTEM WITH CHATBOT SUPPORT, FRAUD DETECTION, AND DELIVERY TIME PREDICTION
-- ====================================================================

CREATE DATABASE IF NOT EXISTS `cptruck_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `cptruck_db`;

-- Drop existing tables if they exist in reverse foreign key order
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `chat_messages`;
DROP TABLE IF EXISTS `chat_sessions`;
DROP TABLE IF EXISTS `fraud_logs`;
DROP TABLE IF EXISTS `tracking_history`;
DROP TABLE IF EXISTS `tracking`;
DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `dispatch_requests`;
DROP TABLE IF EXISTS `rider_profiles`;
DROP TABLE IF EXISTS `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- --------------------------------------------------------------------
-- 1. USERS TABLE
-- Stores accounts for Customers, Riders, and System Administrators
-- --------------------------------------------------------------------
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `phone` VARCHAR(20) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('customer', 'rider', 'admin') NOT NULL DEFAULT 'customer',
  `status` ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 2. RIDER PROFILES TABLE
-- Extended operational details for dispatch riders
-- --------------------------------------------------------------------
CREATE TABLE `rider_profiles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL UNIQUE,
  `vehicle_type` VARCHAR(50) NOT NULL DEFAULT 'Motorcycle',
  `plate_number` VARCHAR(30) NOT NULL DEFAULT 'CPT-772-LG',
  `rating` DECIMAL(3,2) NOT NULL DEFAULT 5.00,
  `total_deliveries` INT NOT NULL DEFAULT 0,
  `current_lat` DECIMAL(10,6) NULL,
  `current_lng` DECIMAL(10,6) NULL,
  `availability` ENUM('available', 'busy', 'offline') NOT NULL DEFAULT 'available',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_rider_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 3. DISPATCH REQUESTS TABLE
-- Delivery orders created by customers with route, fee, and risk info
-- --------------------------------------------------------------------
CREATE TABLE `dispatch_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `pickup_address` VARCHAR(255) NOT NULL,
  `pickup_lat` DECIMAL(10,6) NULL,
  `pickup_lng` DECIMAL(10,6) NULL,
  `destination_address` VARCHAR(255) NOT NULL,
  `destination_lat` DECIMAL(10,6) NULL,
  `destination_lng` DECIMAL(10,6) NULL,
  `package_description` TEXT NOT NULL,
  `package_weight` DECIMAL(8,2) NULL,
  `package_value` DECIMAL(12,2) NULL,
  `receiver_name` VARCHAR(100) NOT NULL,
  `receiver_phone` VARCHAR(20) NOT NULL,
  `receiver_address` VARCHAR(255) NULL,
  `distance_km` DECIMAL(8,2) NULL,
  `estimated_duration_minutes` INT NULL,
  `predicted_delivery_time` DATETIME NULL,
  `delivery_fee` DECIMAL(10,2) NULL,
  `request_status` ENUM('pending', 'approved', 'rejected', 'assigned', 'in_transit', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
  `fraud_score` DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  `is_flagged` BOOLEAN NOT NULL DEFAULT FALSE,
  `flag_reason` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_request_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 4. PAYMENTS TABLE
-- Paystack payment logs and verification records
-- --------------------------------------------------------------------
CREATE TABLE `payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `request_id` INT NOT NULL,
  `customer_id` INT NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `payment_method` VARCHAR(50) NOT NULL DEFAULT 'paystack',
  `payment_reference` VARCHAR(100) NOT NULL UNIQUE,
  `payment_status` ENUM('pending', 'successful', 'failed') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_payment_request` FOREIGN KEY (`request_id`) REFERENCES `dispatch_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payment_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 5. TRACKING TABLE
-- Active package tracking records linked to assigned riders
-- --------------------------------------------------------------------
CREATE TABLE `tracking` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `request_id` INT NOT NULL UNIQUE,
  `tracking_id` VARCHAR(50) NOT NULL UNIQUE,
  `rider_id` INT NULL,
  `current_status` ENUM('pending_pickup', 'picked_up', 'in_transit', 'delivered') NOT NULL DEFAULT 'pending_pickup',
  `current_lat` DECIMAL(10,6) NULL,
  `current_lng` DECIMAL(10,6) NULL,
  `picked_up_at` DATETIME NULL,
  `delivered_at` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_tracking_request` FOREIGN KEY (`request_id`) REFERENCES `dispatch_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tracking_rider` FOREIGN KEY (`rider_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 6. TRACKING HISTORY TABLE
-- Step-by-step audit trail of package transit events
-- --------------------------------------------------------------------
CREATE TABLE `tracking_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tracking_id` INT NOT NULL,
  `status` VARCHAR(50) NOT NULL,
  `note` TEXT NULL,
  `lat` DECIMAL(10,6) NULL,
  `lng` DECIMAL(10,6) NULL,
  `updated_by` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_history_tracking` FOREIGN KEY (`tracking_id`) REFERENCES `tracking` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_history_updater` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 7. FRAUD LOGS TABLE
-- Audit logs explaining triggered risk rules and scoring
-- --------------------------------------------------------------------
CREATE TABLE `fraud_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `request_id` INT NOT NULL,
  `customer_id` INT NOT NULL,
  `rule_triggered` VARCHAR(255) NOT NULL,
  `risk_score` DECIMAL(4,2) NOT NULL,
  `details` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_fraud_request` FOREIGN KEY (`request_id`) REFERENCES `dispatch_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fraud_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 8. CHAT SESSIONS TABLE
-- Conversational sessions between customer and Google AI Chatbot
-- --------------------------------------------------------------------
CREATE TABLE `chat_sessions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `started_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_chat_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 9. CHAT MESSAGES TABLE
-- Individual messages exchanged with role tagging
-- --------------------------------------------------------------------
CREATE TABLE `chat_messages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `session_id` INT NOT NULL,
  `sender` ENUM('customer', 'bot') NOT NULL,
  `message` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_chat_session` FOREIGN KEY (`session_id`) REFERENCES `chat_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- SEED DATA (Ready for Demo & Presentation)
-- Passwords:
-- Admin:    admin@cptruck.com    / admin123
-- Riders:   rider1@cptruck.com   / password123
--           rider2@cptruck.com   / password123
-- Customer: customer@cptruck.com / password123
-- ====================================================================

-- Users
INSERT INTO `users` (`id`, `full_name`, `email`, `phone`, `password`, `role`, `status`) VALUES
(1, 'System Administrator', 'admin@cptruck.com', '08011223344', '$2a$10$aOol3j52IzliD0.ZeYjcFeSLsHZ2FzBXNsSxKqi0MFVH1eEGLkuvy', 'admin', 'active'),
(2, 'Emeka Obi (Rider 1)', 'rider1@cptruck.com', '08022334455', '$2a$10$z4BaqwMBaXVW3X.jNKLf3.rtP/5Z0Oy5lvQ1QiaUghBwdAbJJHp9e', 'rider', 'active'),
(3, 'Tunde Bakare (Rider 2)', 'rider2@cptruck.com', '08033445566', '$2a$10$z4BaqwMBaXVW3X.jNKLf3.rtP/5Z0Oy5lvQ1QiaUghBwdAbJJHp9e', 'rider', 'active'),
(4, 'Chioma Adeyemi', 'customer@cptruck.com', '08044556677', '$2a$10$z4BaqwMBaXVW3X.jNKLf3.rtP/5Z0Oy5lvQ1QiaUghBwdAbJJHp9e', 'customer', 'active');

-- Rider Profiles (Enugu Metropolis & Nsukka)
INSERT INTO `rider_profiles` (`user_id`, `vehicle_type`, `plate_number`, `rating`, `total_deliveries`, `current_lat`, `current_lng`, `availability`) VALUES
(2, 'Bajaj Boxer Motorcycle', 'CPT-102-NSK', 4.90, 48, 6.8667, 7.4116, 'available'),
(3, 'Yamaha Crux Motorcycle', 'CPT-304-ENG', 4.85, 32, 6.4385, 7.5255, 'available');

-- Sample Dispatch Requests (Within Enugu State, Nigeria)
INSERT INTO `dispatch_requests` 
(`id`, `customer_id`, `pickup_address`, `pickup_lat`, `pickup_lng`, `destination_address`, `destination_lat`, `destination_lng`, `package_description`, `package_weight`, `package_value`, `receiver_name`, `receiver_phone`, `distance_km`, `estimated_duration_minutes`, `predicted_delivery_time`, `delivery_fee`, `request_status`, `fraud_score`, `is_flagged`, `flag_reason`)
VALUES
(1, 4, 'Faculty of Physical Sciences, UNN, Nsukka, Enugu State', 6.8667, 7.4116, 'Polo Park Mall, GRA, Enugu, Enugu State', 6.4520, 7.5060, 'Sealed Electronics & Examination Result Documents', 2.50, 45000.00, 'Dr. Samuel Okafor', '08055667788', 68.40, 75, DATE_ADD(NOW(), INTERVAL 75 MINUTE), 5500.00, 'in_transit', 0.00, FALSE, NULL),
(2, 4, '12 Chime Avenue, New Haven, Enugu', 6.4468, 7.5186, 'Enugu State Government House, Independence Layout, Enugu', 6.4385, 7.5255, 'Architectural Blueprints & Project Documents', 1.20, 20000.00, 'Amara Johnson', '08066778899', 4.20, 15, DATE_ADD(NOW(), INTERVAL 25 MINUTE), 2500.00, 'approved', 0.00, FALSE, NULL),
(3, 4, 'Ogige Market Main Gate, Nsukka, Enugu', 6.8590, 7.4010, 'Odenigbo Roundabout, Nsukka, Enugu', 6.8510, 7.3920, 'Luxury Smartphone Batch (Sample Flagged)', 5.00, 750000.00, 'Chioma Adeyemi', '08044556677', 2.10, 10, DATE_ADD(NOW(), INTERVAL 25 MINUTE), NULL, 'pending', 0.55, TRUE, 'Customer account is less than 7 days old. | Declared package value is very high (₦750,000). | Receiver phone number is identical to the customer\'s own phone number.');

-- Payment for Request 1
INSERT INTO `payments` (`id`, `request_id`, `customer_id`, `amount`, `payment_method`, `payment_reference`, `payment_status`) VALUES
(1, 1, 4, 5500.00, 'paystack', 'CPT-PAY-DEMO-001', 'successful');

-- Tracking for Request 1
INSERT INTO `tracking` (`id`, `request_id`, `tracking_id`, `rider_id`, `current_status`, `current_lat`, `current_lng`, `picked_up_at`) VALUES
(1, 1, 'CPT-20261024-9A4B', 2, 'in_transit', 6.6500, 7.4500, DATE_SUB(NOW(), INTERVAL 20 MINUTE));

-- Tracking History
INSERT INTO `tracking_history` (`tracking_id`, `status`, `note`, `lat`, `lng`, `updated_by`) VALUES
(1, 'pending_pickup', 'Rider assigned. Awaiting pickup in UNN, Nsukka.', 6.8667, 7.4116, 1),
(1, 'picked_up', 'Package picked up from sender at Faculty of Physical Sciences, UNN.', 6.8667, 7.4116, 2),
(1, 'in_transit', 'Package in transit along Enugu-Nsukka Expressway toward Polo Park Mall.', 6.6500, 7.4500, 2);

-- Fraud Log for Request 3
INSERT INTO `fraud_logs` (`request_id`, `customer_id`, `rule_triggered`, `risk_score`, `details`) VALUES
(3, 4, 'Customer account is less than 7 days old.', 0.10, 'Rule 1 evaluation'),
(3, 4, 'Declared package value is very high (₦750,000).', 0.35, 'Rule 2 evaluation: Value exceeds 500,000 threshold'),
(3, 4, 'Receiver phone number is identical to the customer\'s own phone number.', 0.15, 'Rule 3 evaluation: Self-dealing flag');
