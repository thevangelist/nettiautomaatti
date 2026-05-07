# Nettiautomaatti

Most used cars on nettiauto.fi look fine until they don't. This extension analyses any listing with one click and shows you the reliability score, known problems for that engine, and strengths before you drive two hours to see it.

Costs fractions of a cent per analysis.

![Nettiautomaatti in action](preview.png)

---

## Stack

- Chrome Extension MV3
- OpenAI gpt-4o-mini
- Tailwind CSS (prefixed, no collisions)
- Zero dependencies at runtime

---

## Setup

1. Clone the repo
2. Go to `chrome://extensions`, enable Developer mode
3. Load unpacked → select this folder
4. Click the extension icon, paste your OpenAI API key

You need an OpenAI account. Get a key at [platform.openai.com](https://platform.openai.com). Each analysis costs fractions of a cent.

---

## How it works

Scrapes the listing DOM — title, specs, mileage, engine, transmission, seller notes, all of it. Builds a prompt. Sends it to gpt-4o-mini with `response_format: json_object`. Renders the result in a panel injected into the page.

The Analysoi button sits next to Jaa and Vertaa in the toolbar. No popup, no new tab.

---

## Privacy

Listing data goes to OpenAI. Nothing else. API key lives in `chrome.storage.sync`.
