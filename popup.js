// popup.js
document.addEventListener('DOMContentLoaded', function() {
    // Load saved API key
    chrome.runtime.sendMessage({ action: "getApiKey" })
      .then(response => {
        if (response && response.apiKey) {
          document.getElementById('apiKey').value = response.apiKey;
        }
      })
      .catch(error => {
        console.error("Error getting API key:", error);
      });
    
    // Analyze current page button
    document.getElementById('analyzeCurrentPage').addEventListener('click', function() {
      // Get the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length === 0) {
          showStatus('No active tab found', 'error');
          return;
        }
        
        const activeTab = tabs[0];
        
        // Inject the content script if it's not already there
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          function: injectAnalyzeButton
        })
          .then(() => {
            showStatus('Analysis started on the current page', 'info');
            // Close the popup
            window.close();
          })
          .catch(error => {
            console.error("Error injecting script:", error);
            showStatus('Error starting analysis: ' + error.message, 'error');
          });
      });
    });
    
    // Save API key
    document.getElementById('saveApiKey').addEventListener('click', function() {
      const apiKey = document.getElementById('apiKey').value.trim();
      
      if (!apiKey) {
        showStatus('Please enter an API key', 'error');
        return;
      }
      
      showStatus('Saving API key...', 'info');
      
      chrome.runtime.sendMessage({ 
        action: "updateApiKey", 
        apiKey: apiKey 
      })
        .then(response => {
          if (response && response.status === 'valid') {
            showStatus('API key saved and verified! You can now analyze articles.', 'success');
          } else if (response && response.status === 'invalid') {
            showStatus('Invalid API key. Please check and try again.', 'error');
          } else {
            showStatus('API key saved but not verified.', 'info');
          }
        })
        .catch(error => {
          console.error("Error saving API key:", error);
          showStatus('Error saving API key. Please try again.', 'error');
        });
    });
    
    // Use offline mode
    document.getElementById('useOfflineMode').addEventListener('click', function() {
      chrome.runtime.sendMessage({ action: "useOfflineMode" })
        .then(() => {
          showStatus('Offline mode activated. The extension will use local analysis only.', 'info');
        })
        .catch(error => {
          console.error("Error activating offline mode:", error);
          showStatus('Error activating offline mode.', 'error');
        });
    });
    
    // Get API key link
    document.getElementById('getApiKey').addEventListener('click', function(e) {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://platform.openai.com/account/api-keys' });
    });
    
    function showStatus(message, type) {
      const statusElement = document.getElementById('status');
      statusElement.textContent = message;
      statusElement.className = 'status ' + type;
      statusElement.classList.remove('hidden');
      
      // Hide after 5 seconds
      setTimeout(() => {
        statusElement.classList.add('hidden');
      }, 5000);
    }
  });
  
  // Function to be injected into the page
  function injectAnalyzeButton() {
    // Check if the analyze function already exists
    if (window.trustAnalyzeCurrentPage) {
      // If it exists, just call it
      window.trustAnalyzeCurrentPage();
      return;
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
    
    // Show loading indicator
    function showLoadingIndicator() {
      // Remove any existing indicators
      const existingIndicator = document.getElementById('trust-loading-indicator');
      if (existingIndicator) {
        existingIndicator.remove();
      }
      
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
    }
    
    // Function to analyze the current page
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
      });
    }
    
    // Make the function available globally
    window.trustAnalyzeCurrentPage = analyzeCurrentPage;
    
    // Call it immediately
    analyzeCurrentPage();
  }
  