// options.js
document.addEventListener('DOMContentLoaded', loadOptions);
document.getElementById('save-options').addEventListener('click', saveOptions);
document.getElementById('add-source').addEventListener('click', addSourceField);

// Default trusted sources
const DEFAULT_TRUSTED_SOURCES = [
  'Reuters',
  'Associated Press',
  'BBC News',
  'The New York Times',
  'The Washington Post'
];

// Load saved options
function loadOptions() {
  chrome.storage.sync.get({
    openai_api_key: '',
    trusted_sources: DEFAULT_TRUSTED_SOURCES,
    auto_analyze: false,
    show_details: true
  }, function(items) {
    document.getElementById('openai-key').value = items.openai_api_key;
    document.getElementById('auto-analyze').checked = items.auto_analyze;
    document.getElementById('show-details').checked = items.show_details;
    
    // Load trusted sources
    const sourcesContainer = document.getElementById('trusted-sources');
    sourcesContainer.innerHTML = ''; // Clear existing sources
    
    items.trusted_sources.forEach(source => {
      addSourceField(source);
    });
  });
}

// Save options
function saveOptions() {
  const apiKey = document.getElementById('openai-key').value.trim();
  const autoAnalyze = document.getElementById('auto-analyze').checked;
  const showDetails = document.getElementById('show-details').checked;
  
  // Collect trusted sources
  const sourceInputs = document.querySelectorAll('.source-input');
  const trustedSources = Array.from(sourceInputs)
    .map(input => input.value.trim())
    .filter(source => source !== '');
  
  // Validate API key
  if (!apiKey) {
    showStatus('Please enter your OpenAI API key.', 'error');
    return;
  }
  
  // Save to storage
  chrome.storage.sync.set({
    openai_api_key: apiKey,
    trusted_sources: trustedSources,
    auto_analyze: autoAnalyze,
    show_details: showDetails
  }, function() {
    showStatus('Options saved successfully!', 'success');
    
    // Update the API key in background script
    chrome.runtime.sendMessage({ 
      action: "updateApiKey", 
      apiKey: apiKey 
    });
  });
}

// Add a new source input field
function addSourceField(sourceValue = '') {
  const sourcesContainer = document.getElementById('trusted-sources');
  
  const sourceItem = document.createElement('div');
  sourceItem.className = 'source-item';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'source-input';
  input.value = sourceValue;
  input.placeholder = 'Enter trusted source name';
  
  const removeButton = document.createElement('button');
  removeButton.className = 'remove-source';
  removeButton.textContent = 'Remove';
  removeButton.addEventListener('click', function() {
    sourcesContainer.removeChild(sourceItem);
  });
  
  sourceItem.appendChild(input);
  sourceItem.appendChild(removeButton);
  sourcesContainer.appendChild(sourceItem);
}

// Show status message
function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = 'status ' + type;
  
  setTimeout(function() {
    status.textContent = '';
    status.className = 'status';
  }, 3000);
}

// Test API key
document.getElementById('openai-key').addEventListener('blur', function() {
  const apiKey = this.value.trim();
  if (apiKey && apiKey.startsWith('sk-')) {
    // Visual indication that the key format looks valid
    this.style.borderColor = '#4CAF50';
  } else if (apiKey) {
    // Key doesn't look valid
    this.style.borderColor = '#f44336';
  } else {
    // No key entered
    this.style.borderColor = '';
  }
});
