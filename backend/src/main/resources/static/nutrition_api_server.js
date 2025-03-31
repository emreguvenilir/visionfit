const express = require('express');
const axios = require('axios');
const qs = require('qs');

const app = express();
const PORT = 3000;

// Your API credentials
const CLIENT_ID = "20d01056ddb348178df32763e5fe1874";
const CLIENT_SECRET = "a2b014f52b0e443c86b506ec591aa8f7";

// FatSecret API endpoints
const TOKEN_URL = "https://oauth.fatsecret.com/connect/token";
const API_URL = "https://platform.fatsecret.com/rest/server.api";

// Function to get an OAuth 2.0 token
async function getAccessToken() {
    try {
        const response = await axios.post(
            TOKEN_URL,
            qs.stringify({
                grant_type: "client_credentials",
                scope: "premier",
            }),
            {
                auth: {
                    username: CLIENT_ID,
                    password: CLIENT_SECRET,
                },
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );
        return response.data.access_token;
    } catch (error) {
        console.error("Error obtaining access token:", error.message);
        return null;
    }
}

// API route for autocomplete
app.get('/api/autocomplete', async (req, res) => {
    const expression = req.query.expression || "chicken"; // Default to "chicken" if no input
    const max_results = req.query.max_results || 4; // Default to 4 results

    const accessToken = await getAccessToken();
    if (!accessToken) {
        return res.status(500).json({ error: "Failed to get access token" });
    }

    try {
        const response = await axios.get(API_URL, {
            params: {
                method: "foods.autocomplete.v2",
                expression: expression,
                max_results: max_results,
                format: "json",
            },
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        res.json(response.data);
    } catch (error) {
        console.error("API error:", error.message);
        res.status(500).json({ error: "Failed to fetch data from API" });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

