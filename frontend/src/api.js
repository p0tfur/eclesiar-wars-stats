import axios from "axios";

// API base URL - uses Vite proxy in development
const api = axios.create({
  baseURL: "/api",
  timeout: 120000, // 60 seconds timeout for fetching battles
});

/**
 * Get all battles from database
 * @returns {Promise<Array>} - List of battles
 */
export async function getBattles() {
  const response = await api.get("/battles");
  return response.data;
}

/**
 * Fetch a battle from Eclesiar API and save to database
 * @param {number} battleId - Battle ID to fetch
 * @param {string} [apiKey] - Optional user API key
 * @returns {Promise<Object>} - Fetched battle data
 */
export async function fetchBattle(battleId, apiKey) {
  const response = await api.post("/battles/fetch", { battleId, apiKey });
  return response.data;
}

/**
 * Fetch a range of battles from Eclesiar API and save to database
 * @param {number} fromId - Start battle ID
 * @param {number} toId - End battle ID
 * @param {string} [apiKey] - Optional user API key
 * @returns {Promise<Object>} - Response
 */
export async function fetchBattleRange(fromId, toId, apiKey) {
  const response = await api.post("/battles/fetch-range", { fromId, toId, apiKey });
  return response.data;
}

/**
 * Get fetch progress for range operation
 * @returns {Promise<Object>} - Progress data
 */
export async function getFetchProgress() {
  const response = await api.get("/battles/fetch-progress");
  return response.data;
}

/**
 * Get war summary for selected battles
 * @param {Array<number>} battleIds - List of battle IDs
 * @returns {Promise<Array>} - Summary data
 */
export async function getWarSummary(battleIds) {
  const response = await api.post("/battles/summary", { battleIds });
  return response.data;
}

/**
 * Delete a battle from database
 * @param {number} battleId - Battle ID to delete
 * @returns {Promise<Object>} - Response
 */
export async function deleteBattle(battleId) {
  const response = await api.delete(`/battles/${battleId}`);
  return response.data;
}
