ALTER TABLE hits
  ADD INDEX idx_hits_created_round_fighter (created_at, round_id, fighter_id);
