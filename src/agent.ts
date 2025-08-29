import { ActivityTypes } from "@microsoft/agents-activity";
import { AgentApplication, MemoryStorage, TurnContext } from "@microsoft/agents-hosting";
import { AzureOpenAI } from "openai";
import config from "./config";

const storage = new MemoryStorage();
export const agentApp = new AgentApplication({ storage });

const systemPrompt = `
You are a helpful, brand-aligned assistant created by Tanner and Backstory to support sales and client-facing teams.
You use a curated message library to generate clear, consistent, benefit-focused one-liners for outbound messages.
Always stay concise, strategic, and on-brand. Do not use quotes or emojis in your responses. And follow up with a question to keep the conversation going.
`;

const client = new AzureOpenAI({
  apiVersion: "2024-12-01-preview",
  apiKey: config.azureOpenAIKey,
  endpoint: config.azureOpenAIEndpoint,
  deployment: config.azureOpenAIDeploymentName,
});

// Current user role for session
let currentUserRole: string | null = null;

// Available indexes - add your other indexes here as they're created
const availableIndexes = [
  "audience-messaging-index",
  "general-audiences-index",    // Add when created
  "brand-foundation-index",    // Add when created  
  "offering-messaging-index"   // Add when created
];

// Greeting patterns
const greetingPatterns = [
  'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
  'greetings', 'howdy', 'what\'s up', 'whats up', 'sup', 'yo', 'hiya',
  'good day', 'morning', 'afternoon', 'evening'
];

// Role setting patterns
const rolePatterns = {
  partner: ['i am a partner', "i'm a partner", 'as a partner', 'partner'],
  manager: ['i am a manager', "i'm a manager", 'as a manager', 'i manage', 'manager'],
  associate: ['i am an associate', "i'm an associate", 'as an associate', 'new to', 'associate']
};

// Helper functions for greetings
function isGreeting(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();

  return greetingPatterns.some(pattern =>
    lowerMessage === pattern ||
    lowerMessage.startsWith(pattern + ' ') ||
    lowerMessage.endsWith(' ' + pattern) ||
    (pattern.length > 3 && lowerMessage.includes(pattern))
  );
}

// Helper functions for role detection
function detectRole(message: string): string | null {
  const lowerMessage = message.toLowerCase();

  for (const [role, patterns] of Object.entries(rolePatterns)) {
    if (patterns.some(pattern => lowerMessage.includes(pattern))) {
      return role;
    }
  }
  return null;
}


// Set user role
function setUserRole(role: string): void {
  currentUserRole = role;
  console.log(`👤 User role set to: ${role}`);
}

// Get current user role details
function getCurrentUserRole(): { role: string; style: string; systemPrompt: string } {
  const roles = {
    partner: {
      role: 'Partner',
      style: 'Peer-to-peer collaboration',
      systemPrompt: `You are speaking to a business partner. Use a collaborative, strategic tone. Treat them as an equal partner in the business. Focus on shared goals, strategic insights, and mutual growth opportunities. Be direct and strategic in your communication.`
    },
    manager: {
      role: 'Manager',
      style: 'Executive support',
      systemPrompt: `You are speaking to a manager or executive. Be concise, professional, and results-oriented. Provide strategic insights and focus on business impact, ROI, and efficiency. Use executive-level language and assume they have decision-making authority.`
    },
    associate: {
      role: 'Associate',
      style: 'Supportive guidance',
      systemPrompt: `You are speaking to a team associate or junior team member. Be supportive, encouraging, and provide clear guidance. Explain things thoroughly and offer helpful context. Use a mentoring tone and be patient with questions.`
    }
  };

  return roles[currentUserRole as keyof typeof roles] || {
    role: 'Team Member',
    style: 'Professional and collaborative',
    systemPrompt: `You are speaking to an internal team member. Be professional, collaborative, and helpful. Provide clear guidance and support their work with the messaging tools and content library.`
  };
}

// Search a single index
async function searchSingleIndex(indexName: string, query: string, top: number = 5) {
  try {
    const searchEndpoint = config.azureSearchEndpoint;
    const searchKey = config.azureSearchApiKey;

    // Fetch index definition
    const indexDefResponse = await fetch(`${searchEndpoint}/indexes/${indexName}?api-version=2023-11-01`, {
      headers: { "api-key": searchKey }
    });
    if (!indexDefResponse.ok) throw new Error(`Failed to fetch index definition: ${indexDefResponse.statusText}`);
    const indexDef = await indexDefResponse.json();

    // Build comma-separated string of searchable string fields
    const highlightFields = indexDef.fields
      .filter((f: any) => f.searchable && f.type === "Edm.String")
      .map((f: any) => f.name)
      .join(",");

    const response = await fetch(
      `${searchEndpoint}/indexes/${indexName}/docs/search?api-version=2023-11-01`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": searchKey
        },
        body: JSON.stringify({
          search: query,
          top,
          select: "*",
          searchMode: "any",
          queryType: "simple",
          highlight: highlightFields // COMMA-SEPARATED STRING
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Search failed for ${indexName}: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();
    console.log(`${indexName}: Found ${result.value?.length || 0} results`);

    return {
      indexName,
      results: result.value || [],
      totalCount: result["@odata.count"] || result.value?.length || 0
    };
  } catch (error) {
    console.error(`Error searching ${indexName}:`, error);
    return null;
  }
}



// Search all indexes and combine results
async function searchAllIndexes(query: string) {
  console.log(`Searching across ${availableIndexes.length} indexes for: "${query}"`);

  const searchPromises = availableIndexes.map(indexName =>
    searchSingleIndex(indexName, query, 4) // Get top 3 from each index
  );

  const searchResults = await Promise.all(searchPromises);

  // Combine and filter successful results
  const combinedResults = searchResults
    .filter(result => result !== null && result.results.length > 0)
    .map(result => ({
      indexName: result.indexName,
      results: result.results,
      count: result.totalCount
    }));

  console.log(`Search Summary:`);
  combinedResults.forEach(result => {
    console.log(`  - ${result.indexName}: ${result.count} results`);
  });

  return combinedResults;
}

// Format search results for AI consumption
function formatSearchResultsForAI(searchResults: any[]): string {
  if (!searchResults || searchResults.length === 0) {
    return "No specific content found. Use general brand messaging principles.";
  }

  let formattedContent = "Available brand content from search:\n\n";

  searchResults.forEach((indexResult, indexNum) => {
    formattedContent += `=== ${indexResult.indexName.toUpperCase()} ===\n`;

    indexResult.results.slice(0, 2).forEach((doc: any, docNum: number) => {
      formattedContent += `Content ${indexNum + 1}.${docNum + 1}:\n`;

      // Dynamically include all non-metadata fields
      Object.keys(doc).forEach(key => {
        // Skip system/metadata fields and empty values
        if (!key.startsWith('@search') &&
          !key.startsWith('metadata_') &&
          !key.includes('AzureSearch') &&
          doc[key] !== null &&
          doc[key] !== undefined &&
          doc[key] !== '') {

          const value = typeof doc[key] === 'string' ? doc[key] : JSON.stringify(doc[key]);
          if (value.length < 500) { // Avoid extremely long content
            formattedContent += `${key}: ${value}\n`;
          }
        }
      });

      formattedContent += "\n";
    });
    formattedContent += "\n";
  });

  return formattedContent;
}

// Bot logic
agentApp.conversationUpdate("membersAdded", async (context: TurnContext) => {
  await context.sendActivity("Hi! I'm the Tanner Branding AI Assistant. I can help you create compelling outbound messages using our brand content library. Type `help` to learn more or just tell me what kind of message you need!");
});

agentApp.activity(ActivityTypes.Message, async (context: TurnContext) => {
  const userMessage = context.activity.text?.trim().toLowerCase() || "";
  const originalMessage = context.activity.text?.trim() || "";

  try {
    // 1. Handle greetings
    if (isGreeting(userMessage)) {
      const userRole = getCurrentUserRole();
      await context.sendActivity(
        `Hello! Great to see you. I'm your Tanner Branding AI Assistant, and I'm here to help you create compelling outbound messages using our content library.\n\n` +
        `**Current Mode:** ${userRole.role} (${userRole.style})\n\n` +
        `**Quick Start:**\n` +
        `\n • Tell me about your target audience (e.g., "growth companies", "tech startups")\n` +
        `\n • Ask for help with specific messaging (e.g., "outbound email for nonprofit leaders")\n` +
        `\n • Type \`help\` for more detailed options\n\n` +
        `What kind of message would you like to create today?`
      );
      return;
    }

    // 2. Help command
    if (userMessage === "help") {
      const userRole = getCurrentUserRole();
      await context.sendActivity(
        `**Tanner Content AI Assistant - What I Can Do:**\n\n` +
        `I search across ${availableIndexes.length} content libraries to generate polished outbound messages.\n\n` +
        `**Current Mode:** ${userRole.role} (${userRole.style})\n\n` +
        `**Set Your Role:** Type one of these to customize my responses:\n` +
        `\n • \`I am a partner\` - Strategic, peer-to-peer communication\n` +
        `\n • \`I am a manager\` - Executive-focused, results-oriented responses\n` +
        `\n • \`I am an associate\` - Supportive guidance with detailed explanations\n` +
        `\n **Try asking me:**\n` +
        `\n • *Create a one-liner for growth company CEOs*\n` +
        `\n • *Help me write messaging for nonprofit organizations*\n` +
        `\n • *Generate an outbound message for tech companies needing R&D credits*\n\n` +
        `**Available Content Libraries:** ${availableIndexes.join(', ')}\n\n` + // for testing purposes only
        `What would you like help with?`
      );
      return;
    }

    // 3. Role setting
    const detectedRole = detectRole(userMessage);
    if (detectedRole) {
      setUserRole(detectedRole);
      const roleResponses = {
        partner: "👤 Perfect! I've set your role as **Partner**. I'll communicate using a strategic, collaborative approach focused on shared business goals. What messaging challenge can I help you tackle?",
        manager: "👤 Excellent! I've set your role as **Manager**. I'll provide executive-level, results-focused responses that emphasize business impact and ROI. What would you like to work on?",
        associate: "👤 Great! I've set your role as **Associate**. I'll provide supportive, detailed guidance to help you succeed with your messaging tasks. How can I help you today?"
      };

      await context.sendActivity(roleResponses[detectedRole as keyof typeof roleResponses]);
      return;
    }

    // 4. Main functionality: Intelligent search across all indexes
    console.log(`Processing user message: "${originalMessage}"`);

    // Search across all available indexes
    const searchResults = await searchAllIndexes(originalMessage);
    const formattedContent = formatSearchResultsForAI(searchResults);

    // Get user role context
    const responseStyle = getCurrentUserRole();
    console.log(`👤 User role: ${responseStyle.role} (${responseStyle.style})`);

    // Generate AI response using search results
    const result = await client.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\n\nAdditional Context: ${responseStyle.systemPrompt}`
        },
        {
          role: "user",
          content: `Here is relevant content from our brand messaging libraries:\n\n${formattedContent}\n\nUser request: ${originalMessage}\n\nUse the most relevant content above to create a compelling, brand-aligned message that addresses the user's specific request. Make it sound natural and engaging, not like a template. End with a follow-up question to continue the conversation.`
        },
      ],
      model: "gpt-4o",
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 500
    });

    const answer = result.choices[0]?.message?.content ?? "I'm not sure how to help with that specific request. Could you provide more details about what kind of message you're looking to create?";

    console.log(`Generated response: ${answer.substring(0, 100)}...`);
    await context.sendActivity(answer);

  } catch (error) {
    console.error("Bot error:", error);
    await context.sendActivity("I apologize, but I encountered an issue processing your request. Please try again or type `help` for assistance.");
  }
});