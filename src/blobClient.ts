require('dotenv').config();

import { BlobServiceClient } from "@azure/storage-blob";

// Ensure the connection string is set in the environment variables
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (!connectionString) {
    throw new Error("Azure Storage connection string is not set in environment variables.");
}

// Log the connection string for debugging purposes (remove in production)
console.log("Storage connection string:", connectionString);

// Create a BlobServiceClient using the connection string
const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);

// Get a reference to the container
// Ensure the container name is correct and exists in your Azure Storage account

export async function listBlobs(containerName: string): Promise<string[]> {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobNames: string[] = [];

    for await (const blob of containerClient.listBlobsFlat()) {
        blobNames.push(blob.name);
    }

    return blobNames;
}