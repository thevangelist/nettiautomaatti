const apiKeyInput = document.getElementById('apiKey');
const responseLanguageSelect = document.getElementById('responseLanguage');
const saveBtn = document.getElementById('saveBtn');
const saveStatus = document.getElementById('saveStatus');

chrome.storage.sync.get(['openaiKey', 'responseLanguage'], ({ openaiKey, responseLanguage }) => {
  if (openaiKey) apiKeyInput.value = openaiKey;
  responseLanguageSelect.value = responseLanguage || 'Finnish';
});

saveBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key.startsWith('sk-')) {
    showStatus(saveStatus, 'Invalid key format', true);
    return;
  }
  chrome.storage.sync.set({ openaiKey: key, responseLanguage: responseLanguageSelect.value }, () => {
    showStatus(saveStatus, 'Settings saved');
  });
});

function showStatus(el, msg, isError = false) {
  el.textContent = msg;
  el.className = 'status' + (isError ? ' status--error' : '');
  if (!isError) setTimeout(() => { el.textContent = ''; }, 3000);
}
