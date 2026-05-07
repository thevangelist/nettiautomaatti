const apiKeyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const saveStatus = document.getElementById('saveStatus');

chrome.storage.sync.get('openaiKey', ({ openaiKey }) => {
  if (openaiKey) apiKeyInput.value = openaiKey;
});

saveBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key.startsWith('sk-')) {
    showStatus(saveStatus, 'Invalid key format', true);
    return;
  }
  chrome.storage.sync.set({ openaiKey: key }, () => {
    showStatus(saveStatus, 'Key saved ✓');
  });
});


function showStatus(el, msg, isError = false) {
  el.textContent = msg;
  el.className = 'status' + (isError ? ' status--error' : '');
  if (!isError) setTimeout(() => { el.textContent = ''; }, 3000);
}
