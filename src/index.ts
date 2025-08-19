// Import required packages
import dotenv from 'dotenv';
dotenv.config({ path: 'env/.env.local.user' });

console.log("Loading env var AZURE_STORAGE_CONNECTION_STRING:", process.env.AZURE_STORAGE_CONNECTION_STRING);

// Check environment variables AFTER dotenv loads them
console.log("🔍 DEBUG: Environment variables check (AFTER dotenv):");
console.log("SECRET_AZURE_OPENAI_API_KEY:", process.env.SECRET_AZURE_OPENAI_API_KEY ? "✅ Set" : "❌ Missing");
console.log("AZURE_OPENAI_ENDPOINT:", process.env.AZURE_OPENAI_ENDPOINT ? "✅ Set" : "❌ Missing");
console.log("AZURE_OPENAI_DEPLOYMENT_NAME:", process.env.AZURE_OPENAI_DEPLOYMENT_NAME ? "✅ Set" : "❌ Missing");
console.log("AZURE_STORAGE_CONNECTION_STRING:", process.env.AZURE_STORAGE_CONNECTION_STRING ? "✅ Set" : "❌ Missing");
console.log("SECRET_AZURE_SEARCH_API_KEY:", process.env.SECRET_AZURE_SEARCH_API_KEY ? "✅ Set" : "❌ Missing");
console.log("AZURE_SEARCH_SERVICE_NAME:", process.env.AZURE_SEARCH_SERVICE_NAME ? "✅ Set" : "❌ Missing");
console.log("AZURE_SEARCH_INDEX_NAME:", process.env.AZURE_SEARCH_INDEX_NAME ? "✅ Set" : "❌ Missing");

import {
  AuthConfiguration,
  authorizeJWT,
  loadAuthConfigFromEnv,
  Request,
} from "@microsoft/agents-hosting";
import express, { Response } from "express";

// This bot's adapter
import adapter from "./adapter";

// This bot's main dialog.
import { agentApp } from "./agent";

//for testing purposes
process.on("unhandledRejection", (reason) => {
  console.error("🚨 Unhandled Rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("🚨 Uncaught Exception:", error);
});

console.log("Creating auth config...");
// Create authentication configuration
const authConfig: AuthConfiguration = loadAuthConfigFromEnv();


console.log("Creating express app...");
// Create express application.
const expressApp = express();

// Add middleware in the correct order
expressApp.use(express.json({ limit: '50mb' }));
expressApp.use(express.urlencoded({ extended: true }));

// Only use JWT authorization in production, not for local playground testing
if (process.env.NODE_ENV === 'production') {
  expressApp.use(authorizeJWT(authConfig));
  console.log("JWT authorization enabled for production");
} else {
  console.log("JWT authorization disabled for local development");
}

// Add simple test endpoint
expressApp.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

console.log("Starting server...");
// FORCE IPv4 by specifying 127.0.0.1 as the host
const port = parseInt(process.env.port || process.env.PORT || '3978');
const server = expressApp.listen(port, '127.0.0.1', () => {
  console.log(`\nAgent started, ${expressApp.name} listening to`, server.address());
});

// Listen for incoming requests.
expressApp.post("/api/messages", async (req: Request, res: Response) => {
  console.log('📨 Received message request');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('Request headers:', req.headers);
  
  try {
    console.log('🔄 About to call adapter.process...');
    console.log('Adapter type:', typeof adapter);
    console.log('Adapter methods:', Object.getOwnPropertyNames(adapter));
    
    await adapter.process(req, res, async (context) => {
      console.log('📝 Inside adapter callback');
      console.log('Context type:', context?.activity?.type);
      await agentApp.run(context);
    });
    console.log('✅ Message processed successfully');
  } catch (error) {
    console.error('❌ Error processing message:', error);
    console.error('Error stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }
});