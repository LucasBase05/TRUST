// content.js
console.log("TRUST content script loaded");

// Add an analyze button to the page
function addAnalyzeButton() {
  console.log("Adding analyze button to page");
  
  // Check if button already exists
  if (document.getElementById('trust-analyze-button')) {
    console.log("Button already exists");
    return;
  }

  // Dinamik içerik değişimini izlemek için
const observer = new MutationObserver(() => {
    if (!document.getElementById('trust-analyze-button')) {
        addAnalyzeButton();
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

  
  const button = document.createElement('button');
  button.id = 'trust-analyze-button';
  button.textContent = 'Analyze Article';
  button.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #4285f4;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 10px 15px;
    font-size: 14px;
    cursor: pointer;
    z-index: 10000;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;
  
  button.addEventListener('click', analyzeCurrentPage);
  
  document.body.appendChild(button);
  console.log("Button added to page");
}

// Extract article content from the page
function extractArticleContent() {
  // Get the article title
  let title = document.title;
  
  // Try to get a more specific title if available
  const titleElement = document.querySelector('h1') || 
                       document.querySelector('article h1') || 
                       document.querySelector('.article-title') ||
                       document.querySelector('.entry-title');
  
  if (titleElement) {
    title = titleElement.textContent.trim();
  }
  
  // Get the article content
  let content = '';
  
  // Try to find the article content using common selectors
  const articleElement = document.querySelector('article') || 
                         document.querySelector('.article-content') || 
                         document.querySelector('.entry-content') ||
                         document.querySelector('.post-content');
  
  if (articleElement) {
    // Get all paragraphs within the article
    const paragraphs = articleElement.querySelectorAll('p');
    content = Array.from(paragraphs)
      .map(p => p.textContent.trim())
      .filter(text => text.length > 0)
      .join('\n\n');
  } else {
    // Fallback: get all paragraphs on the page
    const paragraphs = document.querySelectorAll('p');
    content = Array.from(paragraphs)
      .map(p => p.textContent.trim())
      .filter(text => text.length > 20) // Filter out very short paragraphs
      .join('\n\n');
  }
  
  return {
    title: title,
    url: window.location.href,
    content: content
  };
}

// Analyze the current page
function analyzeCurrentPage() {
  console.log("Analyzing current page");
  
  // Show loading indicator
  showLoadingIndicator();
  
  // Extract article content
  const articleData = extractArticleContent();
  console.log("Extracted article data:", articleData);
  
  // Send message to background script
  chrome.runtime.sendMessage({
    action: "analyze",
    content: articleData
  })
    .then(response => {
      console.log("Analysis initiated:", response);
    })
    .catch(error => {
      console.error("Error initiating analysis:", error);
      hideLoadingIndicator();
      showError("Error initiating analysis: " + error.message);
    });
}

// Show loading indicator
function showLoadingIndicator() {
  // Remove any existing indicators
  hideLoadingIndicator();
  
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'trust-loading-indicator';
  loadingDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 15px;
    z-index: 10001;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    display: flex;
    align-items: center;
  `;
  
  loadingDiv.innerHTML = `
    <div style="border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; width: 20px; height: 20px; animation: spin 2s linear infinite; margin-right: 10px;"></div>
    <div>Analyzing article...</div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;
  
  document.body.appendChild(loadingDiv);
  
  // Hide the analyze button while loading
  const analyzeButton = document.getElementById('trust-analyze-button');
  if (analyzeButton) {
    analyzeButton.style.display = 'none';
  }
}

// Hide loading indicator
function hideLoadingIndicator() {
  const loadingIndicator = document.getElementById('trust-loading-indicator');
  if (loadingIndicator) {
    loadingIndicator.remove();
  }
  
  // Show the analyze button again
  const analyzeButton = document.getElementById('trust-analyze-button');
  if (analyzeButton) {
    analyzeButton.style.display = 'block';
  }
}

// Show error message
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.id = 'trust-error';
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
    border-radius: 4px;
    padding: 15px;
    z-index: 10001;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  `;
  
  errorDiv.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h3 style="margin-top: 0; margin-bottom: 10px;">TRUST Analysis Error</h3>
      <button id="trust-error-close" style="background: none; border: none; cursor: pointer; font-size: 16px;">×</button>
    </div>
    <p>${message}</p>
  `;
  
  document.body.appendChild(errorDiv);
  
  // Add close button functionality
  document.getElementById('trust-error-close').addEventListener('click', () => {
    errorDiv.remove();
  });
}

// Display analysis results
function displayAnalysisResults(trustScore, analysis, cached = false) {
  // Remove loading indicator
  hideLoadingIndicator();
  
  // Create results container
  const resultsDiv = document.createElement('div');
  resultsDiv.id = 'trust-results';
  resultsDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 15px;
    width: 350px;
    max-height: 80vh;
    overflow-y: auto;
    z-index: 10001;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    font-family: Arial, sans-serif;
  `;
  
  // Determine trust level and color
  let trustLevel, trustColor;
  if (trustScore >= 80) {
    trustLevel = "Very Trustworthy";
    trustColor = "#28a745"; // Green
  } else if (trustScore >= 60) {
    trustLevel = "Mostly Trustworthy";
    trustColor = "#5cb85c"; // Light green
  } else if (trustScore >= 40) {
    trustLevel = "Somewhat Trustworthy";
    trustColor = "#ffc107"; // Yellow
  } else if (trustScore >= 20) {
    trustLevel = "Not Very Trustworthy";
    trustColor = "#f0ad4e"; // Orange
  } else {
    trustLevel = "Untrustworthy";
    trustColor = "#dc3545"; // Red
  }
  
  // Format the analysis text with line breaks
  const formattedAnalysis = analysis.replace(/\n/g, '<br>');
  
  resultsDiv.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h3 style="margin-top: 0; margin-bottom: 10px;">TRUST Analysis</h3>
      <button id="trust-results-close" style="background: none; border: none; cursor: pointer; font-size: 16px;">×</button>
    </div>
    
    <div style="display: flex; align-items: center; margin-bottom: 15px;">
      <div style="position: relative; width: 80px; height: 80px; margin-right: 15px;">
        <svg viewBox="0 0 36 36" style="width: 100%; height: 100%;">
          <path d="M18 2.0845
            a 15.9155 15.9155 0 0 1 0 31.831
            a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="#eee"
            stroke-width="3"
            stroke-dasharray="100, 100"
          />
          <path d="M18 2.0845
            a 15.9155 15.9155 0 0 1 0 31.831
            a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="${trustColor}"
            stroke-width="3"
            stroke-dasharray="${trustScore}, 100"
          />
          <text x="18" y="20.5" text-anchor="middle" font-size="10" font-weight="bold" fill="${trustColor}">${trustScore}%</text>
        </svg>
      </div>
      <div>
        <div style="font-weight: bold; color: ${trustColor};">${trustLevel}</div>
        ${cached ? '<div style="font-size: 12px; color: #666;">(Cached result)</div>' : ''}
      </div>
    </div>
    
    <div style="margin-top: 10px; font-size: 14px; line-height: 1.4;">
      ${formattedAnalysis}
    </div>
  `;
  
  document.body.appendChild(resultsDiv);
  
  // Add close button functionality
  document.getElementById('trust-results-close').addEventListener('click', () => {
    resultsDiv.remove();
    
    // Show the analyze button again
    const analyzeButton = document.getElementById('trust-analyze-button');
    if (!analyzeButton) {
      addAnalyzeButton();
    } else {
      analyzeButton.style.display = 'block';
    }
  });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message.action);
  
  if (message.action === "displayResults") {
    displayAnalysisResults(message.trustScore, message.analysis, message.cached);
    sendResponse({ status: "results_displayed" });
    return true;
  }
  
  if (message.action === "analysisStatus") {
    if (message.status === "inProgress") {
      showLoadingIndicator();
    }
    sendResponse({ status: "status_updated" });
    return true;
  }
});

// Initialize - Make sure this runs
console.log("TRUST content script initializing");
addAnalyzeButton();

// Tekrar eden butonları önlemek için
if (!document.getElementById('trust-analyze-button')) {
    addAnalyzeButton();
}


// Also add the button when the page is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded, adding button");
    setTimeout(addAnalyzeButton, 1000); // Add a delay to ensure DOM is ready
  });
} else {
  console.log("DOM already loaded, adding button");
  setTimeout(addAnalyzeButton, 1000); // Add a delay to ensure DOM is ready
}

// Add button again after a few seconds to handle dynamic pages
setTimeout(addAnalyzeButton, 3000);
