import { ActivityTypes } from "@microsoft/agents-activity";
import { AgentApplication, MemoryStorage, TurnContext } from "@microsoft/agents-hosting";
import { AzureOpenAI } from "openai";
import config from "./config";

// Removed search client import
const storage = new MemoryStorage();

export const agentApp = new AgentApplication({ storage });

const systemPrompt = `
You are a helpful, brand-aligned assistant created by Tanner and Backstory to support sales and client-facing teams.
You use a curated message library to generate clear, consistent, benefit-focused one-liners for outbound messages.
Always stay concise, strategic, and on-brand. Do not use quotes or emojis in your responses. And followup with a question to keep the conversation going.
`;

const client = new AzureOpenAI({
  apiVersion: "2024-12-01-preview",
  apiKey: config.azureOpenAIKey,
  endpoint: config.azureOpenAIEndpoint,
  deployment: config.azureOpenAIDeploymentName,
});

// Function to parse CSV-like content and find relevant audience data
function parseAudienceData(csvContent: string, userQuery: string): string {
  try {
    // Split into lines and parse the CSV structure
    const lines = csvContent.split('\n').filter(line => line.trim());
    const audiences: { audience: string; keyMessage: string; benefit: string }[] = [];
    
    // Skip header row, parse data rows
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split('\t').map(part => part.trim());
      if (parts.length >= 3 && parts[0]) {
        audiences.push({
          audience: parts[0],
          keyMessage: parts[1],
          benefit: parts[2]
        });
      }
    }
    
    // Find best matching audience based on query
    const query = userQuery.toLowerCase();
    let bestMatch = null;
    
    for (const item of audiences) {
      const audienceLower = item.audience.toLowerCase();
      if (query.includes('saas') && audienceLower.includes('startup')) {
        bestMatch = item;
        break;
      } else if (query.includes('marketing') && audienceLower.includes('marketing')) {
        bestMatch = item;
        break;
      } else if (query.includes('enterprise') && audienceLower.includes('enterprise')) {
        bestMatch = item;
        break;
      } else if (query.includes('ecommerce') || query.includes('e-commerce')) {
        if (audienceLower.includes('e-commerce')) {
          bestMatch = item;
          break;
        }
      }
    }
    
    // If no specific match, use first relevant one
    if (!bestMatch && audiences.length > 0) {
      bestMatch = audiences.find(item => 
        item.audience.toLowerCase().includes('marketing') ||
        item.audience.toLowerCase().includes('startup')
      ) || audiences[0];
    }
    
    if (bestMatch) {
      return `Audience: ${bestMatch.audience}\nKey Message: ${bestMatch.keyMessage}\nBenefit: ${bestMatch.benefit}`;
    }
    
    return csvContent;
  } catch (error) {
    console.log("⚠️ CSV parsing failed, using raw content");
    return csvContent;
  }
}

// Function to determine response style based on WHO is using the agent
function getUserRole(userQuery: string): { role: string; style: string; systemPrompt: string } {
  const query = userQuery.toLowerCase();
  
  // Check for role indicators in the user's message
  if (query.includes('i am a partner') || query.includes("i'm a partner") || query.includes('as a partner')) {
    return {
      role: 'Partner',
      style: 'Peer-to-peer collaboration',
      systemPrompt: `You are speaking to a business partner. Use a collaborative, strategic tone. Treat them as an equal partner in the business. Focus on shared goals, strategic insights, and mutual growth opportunities. Be direct and strategic in your communication.`
    };
  } else if (query.includes('i am a manager') || query.includes("i'm a manager") || query.includes('as a manager') || query.includes('i manage')) {
    return {
      role: 'Manager', 
      style: 'Executive support',
      systemPrompt: `You are speaking to a manager or executive. Be concise, professional, and results-oriented. Provide strategic insights and focus on business impact, ROI, and efficiency. Use executive-level language and assume they have decision-making authority.`
    };
  } else if (query.includes('i am an associate') || query.includes("i'm an associate") || query.includes('as an associate') || query.includes('new to')) {
    return {
      role: 'Associate',
      style: 'Supportive guidance',
      systemPrompt: `You are speaking to a team associate or junior team member. Be supportive, encouraging, and provide clear guidance. Explain things thoroughly and offer helpful context. Use a mentoring tone and be patient with questions.`
    };
  } else if (query.includes('i am a client') || query.includes("i'm a client") || query.includes('external') || query.includes('customer')) {
    return {
      role: 'External Client',
      style: 'Professional service provider',
      systemPrompt: `You are speaking to an external client. Be professional, helpful, and service-oriented. Focus on delivering value and demonstrating expertise. Use a polished, client-facing tone that builds confidence in your capabilities.`
    };
  } else {
    // Default - assume internal team member
    return {
      role: 'Team Member',
      style: 'Professional and collaborative',
      systemPrompt: `You are speaking to an internal team member. Be professional, collaborative, and helpful. Provide clear guidance and support their work with the messaging tools and content library.`
    };
  }
}

// Function to set user role for the session (could be expanded to use session storage)
let currentUserRole: string | null = null;

function setUserRole(role: string): void {
  currentUserRole = role;
  console.log(`👤 User role set to: ${role}`);
}

function getCurrentUserRole(): { role: string; style: string; systemPrompt: string } {
  if (currentUserRole === 'partner') {
    return {
      role: 'Partner',
      style: 'Peer-to-peer collaboration',
      systemPrompt: `You are speaking to a business partner. Use a collaborative, strategic tone. Treat them as an equal partner in the business. Focus on shared goals, strategic insights, and mutual growth opportunities. Be direct and strategic in your communication.`
    };
  } else if (currentUserRole === 'manager') {
    return {
      role: 'Manager',
      style: 'Executive support', 
      systemPrompt: `You are speaking to a manager or executive. Be concise, professional, and results-oriented. Provide strategic insights and focus on business impact, ROI, and efficiency. Use executive-level language and assume they have decision-making authority.`
    };
  } else if (currentUserRole === 'associate') {
    return {
      role: 'Associate',
      style: 'Supportive guidance',
      systemPrompt: `You are speaking to a team associate or junior team member. Be supportive, encouraging, and provide clear guidance. Explain things thoroughly and offer helpful context. Use a mentoring tone and be patient with questions.`
    };
  } else if (currentUserRole === 'client') {
    return {
      role: 'External Client',
      style: 'Professional service provider',
      systemPrompt: `You are speaking to an external client. Be professional, helpful, and service-oriented. Focus on delivering value and demonstrating expertise. Use a polished, client-facing tone that builds confidence in your capabilities.`
    };
  } else {
    return {
      role: 'Team Member',
      style: 'Professional and collaborative', 
      systemPrompt: `You are speaking to an internal team member. Be professional, collaborative, and helpful. Provide clear guidance and support their work with the messaging tools and content library.`
    };
  }
}
async function runAzureSearchQuery(query: string = "marketing content") {
  try {
    const searchEndpoint = config.azureSearchEndpoint;
    const searchKey = config.azureSearchApiKey;
    const indexName = config.azureSearchIndexName;

    console.log(`Testing Azure Search with query: "${query}"`);
    console.log(`Endpoint: ${searchEndpoint}`);
    console.log(`Index: ${indexName}`);

    const response = await fetch(`${searchEndpoint}/indexes/${indexName}/docs/search?api-version=2023-11-01`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': searchKey
      },
      body: JSON.stringify({
        search: query,
        top: 3,
        select: "*", // Get all fields to see what's available
        searchMode: "any"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Azure Search failed: ${response.status} - ${errorText}`);
      throw new Error(`Azure Search failed: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Search successful! Found ${result.value?.length || 0} results`);
    console.log("First result:", JSON.stringify(result.value?.[0], null, 2));

    return result;
  } catch (error) {
    console.error("❌ Azure Search error:", error);
    // Return fallback content if search fails
    return {
      value: [{
        content: "Our services help businesses streamline operations and increase efficiency through strategic solutions tailored to your industry needs."
      }]
    };
  }
}

agentApp.conversationUpdate("membersAdded", async (context: TurnContext) => {
  await context.sendActivity("Hi! I'm the Tanner Branding AI Assistant. Type `help` to learn how I can assist you.");
});

agentApp.activity(ActivityTypes.Message, async (context: TurnContext) => {
  const userMessage = context.activity.text?.trim().toLowerCase() || "";
  const originalMessage = context.activity.text?.trim() || "";

  try {
    // 1. Help command
    if (userMessage === "help") {
      const userRole = getCurrentUserRole();
      await context.sendActivity(
        `**Tanner Content AI Assistant - What I Can Do:**\n
I help you generate polished outbound messages using our content library.

**Current Mode:** ${userRole.role} (${userRole.style})

**Set Your Role:** Type one of these to customize my responses for you:
- \`I am a partner\` - Strategic, peer-to-peer communication
- \`I am a manager\` - Executive-focused, results-oriented responses  
- \`I am an associate\` - Supportive guidance with detailed explanations
- \`I am a client\` - Professional, service-oriented interaction

**Try asking me:**
- *Create a one-liner for a SaaS marketing leader.*
- *Make a message for a healthcare CFO.*
- *Help me write an outbound email for a retail company CEO.*

Let me know what you'd like help with!`
      );
      return;
    }

    // 2. Role setting commands
    if (userMessage.includes('i am a partner') || userMessage.includes("i'm a partner") || userMessage.includes('partner')) {
      setUserRole('partner');
      await context.sendActivity("👤 Great! I've set your role as **Partner**. I'll now communicate with you using a strategic, collaborative approach focused on shared business goals. How can I help you today?");
      return;
    }
    
    if (userMessage.includes('i am a manager') || userMessage.includes("i'm a manager") || userMessage.includes('manager')) {
      setUserRole('manager');
      await context.sendActivity("👤 Perfect! I've set your role as **Manager**. I'll provide executive-level, results-focused responses that emphasize business impact and ROI. What would you like to work on?");
      return;
    }
    
    if (userMessage.includes('i am an associate') || userMessage.includes("i'm an associate") || userMessage.includes('associate')) {
      setUserRole('associate');
      await context.sendActivity("👤 Excellent! I've set your role as **Associate**. I'll provide supportive, detailed guidance to help you succeed with your messaging tasks. What can I help you with?");
      return;
    }
    
    if (userMessage.includes('i am a client') || userMessage.includes("i'm a client") || userMessage.includes('client')) {
      setUserRole('client');
      await context.sendActivity("👤 Thank you! I've set your role as **Client**. I'll provide professional, service-oriented support to help you achieve your goals. How may I assist you?");
      return;
    }

    // 2. Main functionality: test Azure Search index and generate response
    console.log(`Processing user message: "${originalMessage}"`);
    
    const searchResult = await runAzureSearchQuery(originalMessage);
    
    // Extract and parse content from search results
    let structuredContent = "";
    if (searchResult?.value?.length > 0) {
      const firstResult = searchResult.value[0];
      const rawContent = firstResult.content || 
                        firstResult.text || 
                        firstResult.body || 
                        firstResult.message || 
                        JSON.stringify(firstResult);
      
      // Parse the CSV data to find relevant audience info
      structuredContent = parseAudienceData(rawContent, originalMessage);
      console.log(`Parsed structured content: ${structuredContent.substring(0, 200)}...`);
    } else {
      structuredContent = "General business messaging content to help with outbound communications.";
      console.log("No search results found, using fallback content");
    }
    
    // Determine response style based on user role
    const responseStyle = getUserRole(originalMessage);
    console.log(`👤 Detected role: ${responseStyle.role} (${responseStyle.style})`);
    
    const result = await client.chat.completions.create({
      messages: [
        { role: "system", content: `${systemPrompt}\n\nAdditional Context: ${responseStyle.systemPrompt}` },
        { 
          role: "user", 
          content: `Here is structured content from our knowledge base:\n\n${structuredContent}\n\nUser request: ${originalMessage}\n\nCreate a compelling, brand-aligned message that uses the specific key message and benefit from the structured content. Make it sound natural and engaging, not like you're reading from a template.`
        },
      ],
      model: "gpt-4o",
      temperature: 0.7, // Slightly higher for more natural language
      top_p: 0.9,
      max_tokens: 500
    });

    const answer = result.choices[0]?.message?.content ?? "I'm not sure how to help with that specific request.";
    console.log(`Generated response: ${answer.substring(0, 100)}...`);
    await context.sendActivity(answer);

  } catch (error) {
    console.error("Bot error:", error);
    await context.sendActivity("Oops! Something went wrong. Please try again or contact support.");
  }
});