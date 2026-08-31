-- ============================================================================
-- SEP-MM (Sistemi e-Poslovanja - Materials Management)
-- Enterprise SAP MM / WM Dual-Ledger Arhitektura (MATDOC + MARD)
-- Baza Podataka: MySQL 8.0
-- ============================================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

CREATE DATABASE IF NOT EXISTS sep_mm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sep_mm;

-- Brisanje postojećih tabela
DROP TABLE IF EXISTS current_stock;
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS warehouses;
DROP TABLE IF EXISTS users;

-- ----------------------------------------------------------------------------
-- Tabela 1: users (Korisnici sistema sa JWT autentifikacijom)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'MAGACIONER') NOT NULL DEFAULT 'MAGACIONER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Tabela 2: warehouses (Skladišne lokacije - Beograd, Niš, Vršac, Novi Sad)
-- ----------------------------------------------------------------------------
CREATE TABLE warehouses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    city VARCHAR(60) NOT NULL,
    address VARCHAR(180) NOT NULL,
    capacity_sqm INT NOT NULL DEFAULT 1000,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Tabela 3: products (Katalog artikala i materijala)
-- ----------------------------------------------------------------------------
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'kom',
    unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    min_threshold INT NOT NULL DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Tabela 4: stock_movements (Append-Only Ledger - SAP MATDOC / MSEG)
-- Nepromenljivi hronološki zapis svakog pojedinačnog prijema, izdavanja, prenosa ili otpisa
-- ----------------------------------------------------------------------------
CREATE TABLE stock_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    user_id INT NOT NULL,
    movement_type VARCHAR(30) NOT NULL, -- '101_INBOUND', '201_OUTBOUND', '551_SCRAP', '301_TRANSFER_OUT', '301_TRANSFER_IN'
    quantity INT NOT NULL,
    reference_doc VARCHAR(100) NULL,
    notes TEXT NULL,
    movement_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_movement_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_movement_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    CONSTRAINT fk_movement_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_product_warehouse (product_id, warehouse_id),
    INDEX idx_movement_date (movement_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Tabela 5: current_stock (Fast Snapshot Table - SAP MARD / MBEW)
-- Denormalizovano trenutno stanje po artiklu i skladištu radi O(1) brzine čitanja
-- ----------------------------------------------------------------------------
CREATE TABLE current_stock (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_product_warehouse UNIQUE (product_id, warehouse_id),
    CONSTRAINT fk_stock_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_stock_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Inicijalni podaci (Seed Data)
-- Lozinka za admin@sep-mm.rs i marko@sep-mm.rs je: admin123
-- ----------------------------------------------------------------------------
INSERT INTO users (name, email, password_hash, role) VALUES
('Administrator', 'admin@sep-mm.rs', '$2a$10$cWWf6j3F4327dkLcK1AZ7esSpP6hrUhzt5bxynQF4IktQjODRFo8u', 'ADMIN'),
('Marko Petrović', 'marko@sep-mm.rs', '$2a$10$cWWf6j3F4327dkLcK1AZ7esSpP6hrUhzt5bxynQF4IktQjODRFo8u', 'MAGACIONER');

-- 4 Lokacije: Beograd, Niš, Vršac, Novi Sad
INSERT INTO warehouses (code, name, city, address, capacity_sqm, is_active) VALUES
('WH-BG-01', 'Glavni distributivni centar Beograd', 'Beograd', 'Autoput za Zagreb 18', 5000, 1),
('WH-NI-01', 'Regionalni magacin Niš', 'Niš', 'Bulevar 12. Februar bb', 2500, 1),
('WH-VS-01', 'Pogonsko skladište Vršac', 'Vršac', 'Industrijska zona sever 4', 1800, 1),
('WH-NS-01', 'Logistički centar Novi Sad', 'Novi Sad', 'Temerinski put 48', 3200, 1);

-- Inicijalni artikli
INSERT INTO products (sku, name, category, unit_of_measure, unit_price, min_threshold) VALUES
('MAT-1001', 'Elektromotor 1.5kW 3-fazni', 'Pogonska oprema', 'kom', 24500.00, 5),
('MAT-1002', 'Mikrokontroler ESP32 NodeMCU', 'Elektronika', 'kom', 850.00, 20),
('MAT-1003', 'Industrijski PLC Siemens S7-1200', 'Automatizacija', 'kom', 48000.00, 3),
('MAT-1004', 'Senzor pritiska 0-10 bar 4-20mA', 'Senzorika', 'kom', 6200.00, 10),
('MAT-1005', 'Industrijski kabl LiYCY 4x0.75mm2', 'Kablovi', 'm', 140.00, 100);

-- Inicijalna knjiženja u Dnevnik sa istorijskim datumima (28.08.2026, 29.08.2026, 31.08.2026)
INSERT INTO stock_movements (product_id, warehouse_id, user_id, movement_type, quantity, reference_doc, notes, movement_date) VALUES
-- 28.08.2026: Inicijalni prijemi (101)
(1, 1, 1, '101_INBOUND', 20, 'PR-2026-001', 'Inicijalni prijem sa carine - Beograd', '2026-08-28 08:30:00'),
(2, 1, 1, '101_INBOUND', 150, 'PR-2026-002', 'Isporuka distributera - Beograd', '2026-08-28 09:15:00'),
(3, 2, 2, '101_INBOUND', 10, 'PR-2026-003', 'Prijem Siemens opreme - Niš', '2026-08-28 11:00:00'),
(4, 3, 2, '101_INBOUND', 40, 'PR-2026-004', 'Prijem senzora za pogon - Vršac', '2026-08-28 13:45:00'),
(5, 4, 1, '101_INBOUND', 600, 'PR-2026-005', 'Prijem kablova u logistički centar - Novi Sad', '2026-08-28 15:30:00'),

-- 29.08.2026: Izdavanja (201), Otpis (551) i Međuskladišni prenos (301)
(2, 1, 1, '201_OUTBOUND', 30, 'OTP-2026-001', 'Izdavanje za servisnu mrežu Beograd', '2026-08-29 10:00:00'),
(3, 2, 2, '201_OUTBOUND', 2, 'OTP-2026-002', 'Isporuka za klijenta EPS Niš', '2026-08-29 11:30:00'),
(4, 3, 2, '551_SCRAP', 2, 'RASH-2026-001', 'Otpis neispravnih senzora oštećenih u transportu', '2026-08-29 14:00:00'),
(1, 1, 1, '301_TRANSFER_OUT', 5, 'TR-2026-001', 'Prenos na lokaciju: Logistički centar Novi Sad (Novi Sad) | Popuna zaliha za severni region', '2026-08-29 16:00:00'),
(1, 4, 1, '301_TRANSFER_IN', 5, 'TR-2026-001', 'Prijem sa lokacije: Glavni distributivni centar Beograd (Beograd) | Popuna zaliha za severni region', '2026-08-29 16:00:00'),

-- 31.08.2026: Dodatna knjiženja (Prijemi 101 i Izdavanje 201)
(1, 1, 1, '101_INBOUND', 10, 'PR-2026-006', 'Dopunska isporuka elektromotora za Beograd', '2026-08-31 08:30:00'),
(4, 2, 2, '101_INBOUND', 15, 'PR-2026-007', 'Prijem senzora za regionalni magacin Niš', '2026-08-31 09:00:00'),
(5, 4, 1, '201_OUTBOUND', 100, 'OTP-2026-003', 'Izdavanje kablova za montažu pogona', '2026-08-31 10:15:00');

-- Inicijalno stanje u Snapshot tabeli (current_stock - SAP MARD)
-- Matematički 100% usklađeno sa zbirom svih gornjih knjiženja
INSERT INTO current_stock (product_id, warehouse_id, quantity) VALUES
(1, 1, 25),  -- MAT-1001 Beograd: 20 - 5 + 10 = 25
(1, 4, 5),   -- MAT-1001 Novi Sad: 5 (prenos) = 5
(2, 1, 120), -- MAT-1002 Beograd: 150 - 30 = 120
(3, 2, 8),   -- MAT-1003 Niš: 10 - 2 = 8
(4, 3, 38),  -- MAT-1004 Vršac: 40 - 2 = 38
(4, 2, 15),  -- MAT-1004 Niš: 15
(5, 4, 500); -- MAT-1005 Novi Sad: 600 - 100 = 500
