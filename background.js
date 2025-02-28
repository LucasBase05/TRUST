// background.js
console.log("Background script loaded");

// Global variables
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
let OPENAI_API_KEY = "";
let USE_OFFLINE_MODE = false;

// Load API key and settings on startup
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed/updated");
  loadApiKeyAndSettings();
});

// popup.js veya background.js
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "SENTRY_DSN_URL",
  tracesSampleRate: 1.0,
});

// Hata kaydı
try {
  // Kod...
} catch (error) {
  Sentry.captureException(error);
}


// Load API key and settings from storage
function loadApiKeyAndSettings() {
  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['openai_api_key', 'offline_mode'], function(result) {
      if (chrome.runtime.lastError) {
        console.error("Error loading settings:", chrome.runtime.lastError);
        return;
      }
      
      if (result.openai_api_key) {
        OPENAI_API_KEY = result.openai_api_key;
        console.log("API key loaded from storage");
      }
      
      if (result.offline_mode) {
        USE_OFFLINE_MODE = result.offline_mode;
        console.log("Offline mode enabled");
      }
    });
  }
}

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background script received message:", request.action);
  
  if (request.action === "analyze") {
    console.log("Starting analysis process");
    
    // Start analysis process
    analyzeArticle(request.content, sender.tab ? sender.tab.id : null)
      .then(result => {
        console.log("Analysis completed:", result);
      })
      .catch(error => {
        console.error("Analysis failed:", error);
      });
    
    sendResponse({ status: "analyzing" });
    return true;
  }

  if (request.action === "getApiKey") {
    sendResponse({ apiKey: OPENAI_API_KEY });
    return true;
  }
  
  if (request.action === "updateApiKey") {
    OPENAI_API_KEY = request.apiKey;
    USE_OFFLINE_MODE = false; // Turn off offline mode when API key is updated
    
    // Test the API key
    testApiKey(OPENAI_API_KEY)
      .then(isValid => {
        if (isValid) {
          // Save valid key to storage
          if (chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ 
              openai_api_key: OPENAI_API_KEY,
              offline_mode: false
            });
          }
          sendResponse({ status: "valid" });
        } else {
          sendResponse({ status: "invalid" });
        }
      })
      .catch(error => {
        console.error("Error testing API key:", error);
        sendResponse({ status: "error", message: error.message });
      });
    
    return true;
  }
  
  if (request.action === "useOfflineMode") {
    USE_OFFLINE_MODE = true;
    
    // Set a flag in storage to indicate offline mode
    if (chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ offline_mode: true });
    }
    
    sendResponse({ status: "offline_mode_activated" });
    return true;
  }
});

// Test if an API key is valid
async function testApiKey(apiKey) {
  if (!apiKey) return false;
  
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error("API key test failed:", error);
    return false;
  }
}

// Main analysis function
async function analyzeArticle(articleData, tabId) {
  try {
    console.log("Analyzing article:", articleData.title);
    
    // Only try to send status message if we have a valid tabId
    if (tabId) {
      try {
        await sendMessageToTab(tabId, {
          action: "analysisStatus",
          status: "inProgress"
        });
      } catch (error) {
        console.warn("Could not send analysis status to tab:", error);
      }
    }
    
    // Check cache if storage is available
    let cachedResult = null;
    if (chrome.storage && chrome.storage.local && articleData.url) {
      try {
        cachedResult = await checkCache(articleData.url);
      } catch (error) {
        console.warn("Error checking cache:", error);
      }
    }
    
    if (cachedResult) {
      console.log("Using cached result for:", articleData.url);
      if (tabId) {
        sendMessageToTab(tabId, {
          action: "displayResults",
          trustScore: cachedResult.trustScore,
          analysis: cachedResult.analysis,
          cached: true
        });
      }
      return cachedResult;
    }
    
    let analysisResult;
    
    // Check if we have a valid API key and not in offline mode
    if (OPENAI_API_KEY && !USE_OFFLINE_MODE) {
      console.log("Attempting to use OpenAI API for analysis");
      try {
        // Get information from reliable sources (simulated)
        const reliableSources = await searchReliableSources(articleData.title);
        
        // Try to analyze with OpenAI
        analysisResult = await analyzeArticleAccuracy(articleData, reliableSources);
        console.log("OpenAI analysis successful");
      } catch (error) {
        console.error("OpenAI analysis failed:", error);
        // Fall back to offline analysis
        analysisResult = enhancedFallbackAnalysis(articleData);
      }
    } else {
      console.log("Using offline analysis mode");
      analysisResult = enhancedFallbackAnalysis(articleData);
    }
    
    // Cache the result if storage is available
    if (chrome.storage && chrome.storage.local && articleData.url) {
      try {
        cacheResult(articleData.url, analysisResult);
      } catch (error) {
        console.warn("Error caching result:", error);
      }
    }
    
    // Send results back to the content script if we have a tabId
    if (tabId) {
      console.log("Sending results to content script");
      sendMessageToTab(tabId, {
        action: "displayResults",
        trustScore: analysisResult.trustScore,
        analysis: analysisResult.analysis
      }).then(response => {
        console.log("Content script acknowledged results");
      }).catch(error => {
        console.error("Error sending results to content script:", error);
      });
    }
    
    return analysisResult;
  } catch (error) {
    console.error("Error analyzing article:", error);
    
    if (tabId) {
      sendMessageToTab(tabId, {
        action: "displayResults",
        trustScore: 0,
        analysis: "Error analyzing article: " + error.message,
        error: true
      });
    }
    
    throw error;
  }
}

// Helper function to safely send messages to tabs
function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tabId, message, response => {
        if (chrome.runtime.lastError) {
          console.warn(`Message send error: ${chrome.runtime.lastError.message}`);
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Check if we have a cached result for this URL
async function checkCache(url) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(['trustAnalysisCache'], function(result) {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        if (!result.trustAnalysisCache) {
          resolve(null);
          return;
        }
        
        const cache = result.trustAnalysisCache;
        // Cache lifetime: 7 days
        if (cache[url] && (Date.now() - cache[url].timestamp < 7 * 24 * 60 * 60 * 1000)) {
          resolve(cache[url]);
        } else {
          resolve(null);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Cache analysis result
function cacheResult(url, result) {
  try {
    chrome.storage.local.get(['trustAnalysisCache'], function(data) {
      if (chrome.runtime.lastError) {
        console.warn("Error getting cache:", chrome.runtime.lastError);
        return;
      }
      
      const cache = data.trustAnalysisCache || {};
      cache[url] = {
        trustScore: result.trustScore,
        analysis: result.analysis,
        timestamp: Date.now()
      };
      
      // Limit cache size to prevent storage issues
      const urls = Object.keys(cache);
      if (urls.length > 100) {
        // Remove oldest entries
        const oldestUrls = urls
          .map(url => ({ url, timestamp: cache[url].timestamp }))
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(0, urls.length - 100)
          .map(item => item.url);
        
        oldestUrls.forEach(url => delete cache[url]);
      }
      
      chrome.storage.local.set({ trustAnalysisCache: cache }, function() {
        if (chrome.runtime.lastError) {
          console.warn("Error setting cache:", chrome.runtime.lastError);
        }
      });
    });
  } catch (error) {
    console.warn("Error in cacheResult:", error);
  }
}

// Search for information from reliable sources (simulated)
async function searchReliableSources(topic) {
  // In a production version, you would implement actual API calls to reliable sources
  // For now, we'll simulate this with a delay
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    sources: [
      {
        name: "Reuters",
        url: "https://www.reuters.com",
        content: "Sample content from Reuters related to " + topic
      },
      {
        name: "Associated Press",
        url: "https://www.ap.org",
        content: "Sample content from AP related to " + topic
      },
      {
        name: "BBC",
        url: "https://www.bbc.com",
        content: "Sample content from BBC related to " + topic
      }
    ],
    summary: "Information gathered from reliable sources about " + topic
  };
}

// Analyze article accuracy using OpenAI API
async function analyzeArticleAccuracy(articleData, reliableSources) {
  if (!OPENAI_API_KEY) {
    throw new Error("No API key available");
  }
  
  // Prepare the prompt for OpenAI
  let prompt;
  try {
    prompt = createAnalysisPrompt(articleData, reliableSources);
  } catch (promptError) {
    console.error("Error creating prompt:", promptError);
    throw new Error("Failed to create analysis prompt: " + promptError.message);
  }
  
  console.log("Sending request to OpenAI API");
  
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert fact-checker and journalist. Your task is to analyze the accuracy of articles by comparing them with reliable sources."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });
    
    console.log("OpenAI API response status:", response.status);
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API error response:", errorText);
        let errorData;
        try {
            errorData = JSON.parse(errorText);
        } catch (e) {
            errorData = { error: { message: "Could not parse error response" } };
        }
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'} (Status: ${response.status})`);
    }
    
    const data = await response.json();
    console.log("OpenAI API response received");
    
    const analysisText = data.choices[0].message.content;
    
    // Parse the analysis to extract the trust score and explanation
    return parseAnalysisResponse(analysisText);
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw error;
  }
}

// Create the prompt for the AI analysis
function createAnalysisPrompt(articleData, reliableSources) {
  // Check for required properties
  if (!articleData) {
    throw new Error("articleData is undefined");
  }
  
  // Provide defaults for missing properties
  const title = articleData.title || 'Unknown Title';
  const url = articleData.url || 'Unknown URL';
  const content = articleData.content || '';
  
  // Limit article content length to avoid token limits
  const truncatedContent = content.substring(0, 3000);
  
  // Check if reliableSources is defined and has the expected structure
  let sourcesText = "No reliable sources available.";
  if (reliableSources && reliableSources.sources && Array.isArray(reliableSources.sources)) {
    sourcesText = reliableSources.sources.map(source => 
      `${source.name || 'Unknown Source'}: ${source.content || 'No content available'}`
    ).join('\n\n');
  }
  
  return `
I need to analyze the accuracy of an article. Here's the article content:

Title: ${title}
URL: ${url}
Content: ${truncatedContent}${content.length > 3000 ? '... (truncated)' : ''}

Here's information from reliable sources:
${sourcesText}

Please analyze the accuracy of the article compared to the reliable sources.
Consider:
1. Factual accuracy (are statements supported by evidence?)
2. Completeness (does it present all relevant facts?)
3. Balance (does it present multiple perspectives?)
4. Source quality (are sources cited reputable?)
5. Emotional language (is the tone neutral or biased?)

Provide a trust score percentage and a detailed explanation.
Format your response as JSON with fields "trustScore" (number 0-100) and "analysis" (string).
`;
}

// Parse the AI response to extract structured data
function parseAnalysisResponse(responseText) {
  try {
    // Try to parse as JSON first
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonData = JSON.parse(jsonMatch[0]);
      return {
        trustScore: jsonData.trustScore || 0,
        analysis: jsonData.analysis || responseText
      };
    }
    
    // Fallback: Extract score using regex
    const scoreMatch = responseText.match(/(\d{1,3})%/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;
    
    return {
      trustScore: score,
      analysis: responseText
    };
  } catch (error) {
    console.error("Error parsing analysis response:", error);
    return {
      trustScore: 50,
      analysis: responseText
    };
  }
}

// Enhanced fallback analysis function
function enhancedFallbackAnalysis(articleData) {
  const content = articleData.content ? articleData.content.toLowerCase() : '';
  const title = articleData.title ? articleData.title.toLowerCase() : '';
  let trustScore = 50; // Start with a neutral score
  let analysis = "TRUST Analysis:\n\n";
  let points = [];
  
  // 1. Check for clickbait title patterns
  const clickbaitPatterns = [
    "you won't believe", "shocking", "mind blowing", "amazing", 
    "incredible", "insane", "unbelievable", "secret", "trick",
    "they don't want you to know", "this one weird", "jaw-dropping",
    "will shock you", "won't believe what happened", "miracle", 
    "stunning", "breathtaking", "never seen before"
  ];
  
  const hasClickbaitTitle = clickbaitPatterns.some(pattern => title.includes(pattern));
  
  if (hasClickbaitTitle) {
    trustScore -= 15;
    points.push("The article has a clickbait-style title which may indicate sensationalism.");
  } else if (title.includes("?") && (title.includes("why") || title.includes("how") || title.includes("what"))) {
    trustScore -= 5;
    points.push("The title is phrased as a question, which can sometimes indicate speculative content.");
  } else if (title.length > 15 && !title.includes(":" || "?" || "!" || "-")) {
    trustScore += 5;
    points.push("The title appears to be straightforward and informative.");
  }
  
  // 2. Check for citation patterns
  const citationPatterns = [
    "according to", "researchers found", "study shows", "experts say",
    "published in", "evidence suggests", "data indicates", "report",
    "survey", "analysis", "research", "professor", "scientist", "expert",
    "study published", "journal", "university", "institute"
  ];
  
  const citationCount = citationPatterns.filter(pattern => content.includes(pattern)).length;
  
  if (citationCount > 5) {
    trustScore += 15;
    points.push("The article frequently cites sources or research, suggesting a commitment to factual reporting.");
  } else if (citationCount > 2) {
    trustScore += 10;
    points.push("The article includes some references to sources or research.");
  } else {
    trustScore -= 5;
    points.push("The article contains few or no references to external sources, which may indicate a lack of factual basis.");
  }
  
  // 3. Check for balanced reporting
  const perspectivePatterns = [
    "on the other hand", "however", "conversely", "alternatively",
    "some argue", "critics say", "proponents suggest", "debate",
    "different perspective", "opposing view", "contrary to", "despite",
    "although", "while some", "others believe", "in contrast"
  ];
  
  const perspectiveCount = perspectivePatterns.filter(pattern => content.includes(pattern)).length;
  
  if (perspectiveCount > 3) {
    trustScore += 15;
    points.push("The article presents multiple perspectives on the topic, suggesting balanced reporting.");
  } else if (perspectiveCount > 1) {
    trustScore += 5;
    points.push("The article acknowledges some alternative viewpoints.");
  } else {
    trustScore -= 10;
    points.push("The article appears to present a single perspective without acknowledging alternative viewpoints.");
  }
  
  // 4. Check for emotional language
  const emotionalPatterns = [
    "outrageous", "terrible", "amazing", "wonderful", "horrific",
    "disgusting", "beautiful", "perfect", "worst", "best ever",
    "disaster", "catastrophe", "miracle", "stunning", "shocking",
    "devastating", "incredible", "unbelievable", "extraordinary"
  ];
  
  const emotionalCount = emotionalPatterns.filter(pattern => content.includes(pattern)).length;
  
  if (emotionalCount > 5) {
    trustScore -= 15;
    points.push("The article contains highly emotional language, which may indicate bias or sensationalism.");
  } else if (emotionalCount > 2) {
    trustScore -= 10;
    points.push("The article uses some emotional language which may affect objectivity.");
  } else {
    trustScore += 5;
    points.push("The article uses mostly neutral language, suggesting an attempt at objectivity.");
  }
  
  // 5. Check for hedging language (indicates uncertainty)
  const hedgingPatterns = [
    "may", "might", "could", "possibly", "perhaps", "allegedly",
    "reportedly", "claimed", "suggested", "appears to", "seems to",
    "is believed to", "sources say", "anonymous", "unconfirmed"
  ];
  
  const hedgingCount = hedgingPatterns.filter(pattern => content.includes(pattern)).length;
  
  if (hedgingCount > 8) {
    trustScore -= 10;
    points.push("The article contains a high amount of uncertain or hedging language, suggesting information may not be verified.");
  } else if (hedgingCount > 4) {
    trustScore -= 5;
    points.push("The article uses some hedging language, indicating some information may be uncertain.");
  }
  
  // 6. Check for article length (more detailed articles tend to be more thorough)
  if (content.length > 3000) {
    trustScore += 5;
    points.push("The article is relatively detailed, suggesting more thorough coverage of the topic.");
  } else if (content.length < 1000) {
    trustScore -= 5;
    points.push("The article is quite brief, which may indicate limited coverage of the topic.");
  }
  
  // 7. Check for numbers and statistics (often indicates factual content)
  const hasNumbers = /\d+%|\d+ percent|\d+ people|\d+ cases|\d+ million|\d+ billion/.test(content);
  if (hasNumbers) {
    trustScore += 5;
    points.push("The article includes specific numbers or statistics, which can indicate factual reporting.");
  }
  
  // 8. Check for quotes (indicates direct sources)
  const hasQuotes = (content.match(/"/g) || []).length > 4;
  if (hasQuotes) {
    trustScore += 5;
    points.push("The article includes quotes, suggesting direct sourcing of information.");
  }
  
  // Ensure score is within 0-100 range
  trustScore = Math.max(0, Math.min(100, trustScore));
  
  // Add all analysis points to the response
  points.forEach(point => {
    analysis += "- " + point + "\n";
  });
  
  // Add trust level description
  let trustLevel;
  if (trustScore >= 80) trustLevel = "Very Trustworthy";
  else if (trustScore >= 60) trustLevel = "Mostly Trustworthy";
  else if (trustScore >= 40) trustLevel = "Somewhat Trustworthy";
  else if (trustScore >= 20) trustLevel = "Not Very Trustworthy";
  else trustLevel = "Untrustworthy";
  
  analysis += `\nOverall Trust Level: ${trustLevel} (${trustScore}%)\n`;
  
  return {
    trustScore,
    analysis
  };
}
