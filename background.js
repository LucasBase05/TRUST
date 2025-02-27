// background.js
console.log("Service worker çalışıyor!");

document.getElementById('checkFact').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: analyzeContent
    });
  });
  
  function analyzeContent() {
    const articleContent = document.body.innerText;
    console.log("Makale İçeriği:", articleContent); // İçeriği konsola yazdır
    chrome.runtime.sendMessage({ action: "analyze", content: articleContent });
  }
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "analyze") {
      fetchOpenAIResult(request.content).then(result => {
        document.getElementById('result').innerText = result;
      });
    }
  });
  
  async function fetchOpenAIResult(content) {
    const apiKey = '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';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "user", content: `Bu makalenin gerçeklik payını analiz et: ${content}` }
        ],
        max_tokens: 50
      })
    });
    const data = await response.json();
    return data.choices[0].message.content;
  }