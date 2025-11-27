import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_URL = process.env.ECLESIAR_API_URL;
const API_KEY = process.env.ECLESIAR_API_KEY;

// Rate limiting settings
const REQUEST_DELAY_MS = 50; // Delay between requests (ms)
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 1000; // Initial retry delay (doubles each retry)

// Create axios instance with auth header
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    Authorization: `Bearer ${API_KEY}`,
  },
});

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make API request with retry logic for rate limiting
 * @param {Function} requestFn - Function that returns axios promise
 * @param {string} description - Description for logging
 * @returns {Promise} - Response data
 */
async function requestWithRetry(requestFn, description = "API request") {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Add delay between requests to avoid rate limiting
      await sleep(REQUEST_DELAY_MS);

      const response = await requestFn();
      return response;
    } catch (error) {
      lastError = error;

      if (error.response?.status === 429) {
        const retryDelay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`${description}: Rate limited (429), retry ${attempt}/${MAX_RETRIES} in ${retryDelay}ms...`);
        await sleep(retryDelay);
      } else {
        // Non-rate-limit error, don't retry
        throw error;
      }
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Fetch wars list from Eclesiar API
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} - List of wars
 */
export async function fetchWars(params = {}) {
  try {
    // Exclude event wars by default (only normal wars)
    const queryParams = { event_wars: 0, ...params };

    const response = await requestWithRetry(
      () => apiClient.get("/wars", { params: queryParams }),
      `Fetch war ${params.war_id || "list"}`
    );

    if (response.data.code === 200) {
      return response.data.data;
    }
    throw new Error(response.data.message || response.data.description || "Failed to fetch wars");
  } catch (error) {
    console.log("Error fetching wars:", error.message);
    throw error;
  }
}

/**
 * Fetch rounds for a specific war
 * @param {number} warId - War ID
 * @returns {Promise<Array>} - List of rounds
 */
export async function fetchWarRounds(warId) {
  try {
    const response = await requestWithRetry(
      () => apiClient.get("/war/rounds", { params: { war_id: warId } }),
      `Fetch rounds for war ${warId}`
    );
    if (response.data.code === 200) {
      return response.data.data;
    }
    throw new Error(response.data.message || "Failed to fetch rounds");
  } catch (error) {
    console.log("Error fetching rounds for war", warId, ":", error.message);
    throw error;
  }
}

/**
 * Fetch hits for a specific round (handles pagination)
 * @param {number} roundId - Round ID
 * @returns {Promise<Array>} - List of all hits
 */
export async function fetchRoundHits(roundId) {
  try {
    let allHits = [];
    let page = 1;
    let hasMore = true;

    // Paginate through all hits
    while (hasMore) {
      const response = await requestWithRetry(
        () => apiClient.get("/war/round/hits", { params: { war_round_id: roundId, page } }),
        `Fetch hits for round ${roundId} page ${page}`
      );

      if (response.data.code === 200) {
        const hits = response.data.data;
        if (!hits || hits.length === 0) {
          hasMore = false;
        } else {
          allHits = allHits.concat(hits);
          page++;
        }
      } else {
        console.log(`Round ${roundId} API error:`, response.data);
        hasMore = false;
      }
    }

    return allHits;
  } catch (error) {
    console.log("Error fetching hits for round", roundId, ":", error.message);
    // Return empty array instead of throwing - some rounds may have no hits
    return [];
  }
}

/**
 * Fetch account info by ID
 * @param {number} accountId - Account ID
 * @returns {Promise<Object>} - Account data
 */
export async function fetchAccount(accountId) {
  try {
    const response = await requestWithRetry(
      () => apiClient.get("/account", { params: { account_id: accountId } }),
      `Fetch account ${accountId}`
    );
    if (response.data.code === 200) {
      return response.data.data;
    }
    throw new Error(response.data.message || "Failed to fetch account");
  } catch (error) {
    console.log("Error fetching account", accountId, ":", error.message);
    throw error;
  }
}
