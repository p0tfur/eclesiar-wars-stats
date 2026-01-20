-- Migration: Add nationality support and summary caching
-- Run these commands on your existing database

-- 1. Add nationality_id to players table
ALTER TABLE players ADD COLUMN nationality_id INT DEFAULT NULL;

-- 2. Create countries lookup table
CREATE TABLE IF NOT EXISTS countries (
    id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    avatar VARCHAR(500),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Create player_battle_stats cache table
CREATE TABLE IF NOT EXISTS player_battle_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    battle_id INT NOT NULL,
    player_id INT NOT NULL,
    player_name VARCHAR(255),
    player_avatar VARCHAR(500),
    nationality_id INT,
    total_damage BIGINT DEFAULT 0,
    hit_count INT DEFAULT 0,
    side ENUM('ATTACKER', 'DEFENDER'),
    weapons JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (battle_id) REFERENCES battles(id) ON DELETE CASCADE,
    INDEX idx_battle (battle_id),
    UNIQUE KEY unique_player_battle (battle_id, player_id)
);

-- 4. Populate countries table from existing battles data
INSERT IGNORE INTO countries (id, name, avatar)
SELECT DISTINCT attacker_id, attacker_name, attacker_avatar FROM battles
UNION
SELECT DISTINCT defender_id, defender_name, defender_avatar FROM battles;
