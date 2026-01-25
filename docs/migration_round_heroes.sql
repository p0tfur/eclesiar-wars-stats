-- Migration: Add battle hero columns to rounds table
-- Run these commands on your existing database

ALTER TABLE rounds
    ADD COLUMN attackers_hero INT DEFAULT NULL,
    ADD COLUMN defenders_hero INT DEFAULT NULL;
