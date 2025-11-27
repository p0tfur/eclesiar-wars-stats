-- Tworzenie bazy danych
CREATE DATABASE IF NOT EXISTS eclesiar_wars CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE eclesiar_wars;

-- Tabela wojen (bitew)
CREATE TABLE battles (
    id INT PRIMARY KEY,
    attacker_id INT NOT NULL,
    attacker_name VARCHAR(255) NOT NULL,
    attacker_avatar VARCHAR(500),
    defender_id INT NOT NULL,
    defender_name VARCHAR(255) NOT NULL,
    defender_avatar VARCHAR(500),
    region_id INT,
    region_name VARCHAR(255),
    attackers_score INT DEFAULT 0,
    defenders_score INT DEFAULT 0,
    is_revolution TINYINT(1) DEFAULT 0,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela rund
CREATE TABLE rounds (
    id INT PRIMARY KEY,
    battle_id INT NOT NULL,
    end_date DATETIME,
    attackers_score INT DEFAULT 0,
    defenders_score INT DEFAULT 0,
    attackers_points INT DEFAULT 0,
    defenders_points INT DEFAULT 0,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (battle_id) REFERENCES battles(id) ON DELETE CASCADE
);

-- Tabela hitów
CREATE TABLE hits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    round_id INT NOT NULL,
    fighter_id INT NOT NULL,
    fighter_type VARCHAR(50) DEFAULT 'account',
    damage INT NOT NULL,
    side ENUM('ATTACKER', 'DEFENDER') NOT NULL,
    item_id INT DEFAULT NULL,
    created_at DATETIME,
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
    INDEX idx_round_fighter (round_id, fighter_id),
    INDEX idx_fighter (fighter_id)
);

-- Tabela graczy (cache nazw)
CREATE TABLE players (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    avatar VARCHAR(500),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);