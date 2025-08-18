require('dotenv').config();

import { SearchClient, AzureKeyCredential } from "@azure/search-documents";

const endpoint = process.env.AZURE_SEARCH_ENDPOINT!;
const indexName = process.env.AZURE_SEARCH_INDEX_NAME!;
const apiKey = process.env.AZURE_SEARCH_API_KEY!;

if (!endpoint || !indexName || !apiKey) {
    throw new Error("Missing Azure Search environment variables.");
}

const client = new SearchClient(endpoint, indexName, new AzureKeyCredential(apiKey));

export async function searchDocuments(query: string): Promise<any[]> {
    const results = await client.search(query);
    const documents: any[] = [];

    for await (const result of results.results) {
        documents.push(result.document);
    }

    return documents;
}
