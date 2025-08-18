const https = require("https");

const endpoint = "https://tannerbotdevsrch.search.windows.net";
const indexName = "audiencespecific-test-index";
const apiKey = "1tQM2S69vPo0V8OpfR3wici2ed9Z4DwrQjsReTy0ikAzSeAyTbsc"; // Replace with your real Azure Search admin key

async function testSearch() {
    const options = {
        hostname: "tannerbotdevsrch.search.windows.net",
        path: `/indexes/${indexName}/docs/search?api-version=2023-10-01-Preview`,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "api-key": apiKey
        }
    };

    const postData = JSON.stringify({
        search: "*",
        top: 3
    });

    const req = https.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
            data += chunk;
        });

        res.on("end", () => {
            try {
                const json = JSON.parse(data);
                console.log(JSON.stringify(json, null, 2));
            } catch (err) {
                console.error("Failed to parse response", err);
            }
        });
    });

    req.on("error", (err) => {
        console.error("Request error:", err);
    });

    req.write(postData);
    req.end();
}

testSearch();
