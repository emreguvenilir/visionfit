const express = require('express'); // Lightweight server framework
const OAuth = require('oauth-1.0a'); // Library to handle OAuth 1.0a
const crypto = require('crypto');   // For generating HMAC signatures
const axios = require('axios');     // HTTP client to call APIs

const app = express();
const PORT = 3000;

// Your API credentials
const CUSTOMER_KEY = "20d01056ddb348178df32763e5fe1874";
const CUSTOMER_SECRET = "a2b014f52b0e443c86b506ec591aa8f7";

// Initialize OAuth
const oauth = OAuth({
    consumer: {
        key: CUSTOMER_KEY,
        secret: CUSTOMER_SECRET,
    },
    signature_method: "HMAC-SHA1",
    hash_function(baseString, key) {
        return crypto.createHmac('sha1', key).update(baseString).digest('base64');
    },
});

// API proxy route
app.get('/api/resource', async (req, res) => {
    const apiUrl = "https://api.example.com/resource"; // Replace with your actual API endpoint

    const requestData = {
        url: apiUrl,
        method: "GET",
    };

    // Generate OAuth headers
    const authHeaders = oauth.toHeader(oauth.authorize(requestData));

    try {
        // Make the API request
        const response = await axios({
            url: requestData.url,
            method: requestData.method,
            headers: {
                ...authHeaders,
                "Content-Type": "application/json",
            },
        });

        // Send the API response back to the frontend
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
