const ICON_CLOSE  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="na-w-4 na-h-4"><path d="M6 18L18 6M6 6l12 12"/></svg>`;
const ICON_PLUS   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="na-w-3.5 na-h-3.5 na-shrink-0 na-mt-px"><path d="M12 5v14M5 12h14"/></svg>`;
const ICON_MINUS  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="na-w-3.5 na-h-3.5 na-shrink-0 na-mt-px"><path d="M5 12h14"/></svg>`;

const PANEL_ID = 'nettiauto-analyser-panel';

function getByXPath(xpath) {
  return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

function extractMakeModelYear() {
  const titleEl = document.querySelector('h1.details-page-header__item-title');
  const full = titleEl ? titleEl.innerText.trim() : '';
  const yearEl = document.querySelector('.details-page__item-main-info_year');
  const year = yearEl ? (yearEl.innerText.trim().match(/\d{4}/) || [])[0] || '' : '';
  const spaceIdx = full.indexOf(' ');
  const make = spaceIdx > 0 ? full.slice(0, spaceIdx) : full;
  const model = spaceIdx > 0 ? full.slice(spaceIdx + 1) : '';
  return { make, model, year };
}

async function fetchTraficomRecalls(make, model) {
  if (!make) return null;
  try {
    const res = await fetch(`https://takaisinkutsut.traficom.fi/api/recall?keyword=${encodeURIComponent(make)}`);
    if (!res.ok) return null;
    const d = await res.json();
    const modelLower = model.toLowerCase();
    // Only filter by model if name is long enough to be meaningful
    const useModelFilter = modelLower.length >= 3;
    const filtered = useModelFilter
      ? (d.itemList || []).filter(r => {
          const models = (r.field_vehicle_models || '').toLowerCase();
          return models.includes(modelLower) ||
            modelLower.split(/[\s-]+/).filter(p => p.length >= 3).some(p => models.includes(p));
        })
      : [];
    // Only show results if model filter found something — never fall back to unrelated models
    if (filtered.length === 0) return { count: 0, items: [], filtered: 0 };
    const items = filtered.slice(0, 5).map(r => `${r.field_fault}: ${r.field_fault_description || ''}`);
    return { count: filtered.length, items, filtered: filtered.length };
  } catch { return null; }
}

async function fetchNHTSA(make, model, year) {
  if (!make || !year) return null;
  const b = 'https://api.nhtsa.gov';
  const m = encodeURIComponent(make);
  const mo = encodeURIComponent(model);
  const y = encodeURIComponent(year);
  try {
    const [recallRes, complaintRes, tsbRes, safetyRes] = await Promise.allSettled([
      fetch(`${b}/recalls/recallsByVehicle?make=${m}&model=${mo}&modelYear=${y}`),
      fetch(`${b}/complaints/complaintsByVehicle?make=${m}&model=${mo}&modelYear=${y}`),
      fetch(`${b}/tsbs/tsbsByVehicle?make=${m}&model=${mo}&modelYear=${y}`),
      fetch(`${b}/SafetyRatings/modelyear/${y}/make/${m}/model/${mo}?format=json`),
    ]);
    let recalls = [], complaintCount = 0, tsbs = [], safetyRating = null;
    if (recallRes.status === 'fulfilled' && recallRes.value.ok) {
      const d = await recallRes.value.json();
      recalls = (d.results || []).slice(0, 5).map(r =>
        `${r.Component}: ${(r.Summary || '').slice(0, 100)}`
      );
    }
    if (complaintRes.status === 'fulfilled' && complaintRes.value.ok) {
      const d = await complaintRes.value.json();
      complaintCount = d.count || 0;
    }
    if (tsbRes.status === 'fulfilled' && tsbRes.value.ok) {
      const d = await tsbRes.value.json();
      tsbs = (d.results || []).slice(0, 5).map(r =>
        `${r.Subject || r.Category || ''}: ${(r.Summary || '').slice(0, 100)}`
      ).filter(Boolean);
    }
    if (safetyRes.status === 'fulfilled' && safetyRes.value.ok) {
      const d = await safetyRes.value.json();
      const r = (d.Results || [])[0];
      if (r) safetyRating = {
        overall: r.OverallRating,
        frontal: r.FrontCrashRating,
        side: r.SideCrashRating,
        rollover: r.RolloverRating,
      };
    }
    return { recalls, complaintCount, tsbs, safetyRating };
  } catch { return null; }
}

function extractCarData() {
  // Title + variant (e.g. "Mercedes-Benz C" + "220 d T Avantgarde 4Matic")
  const titleEl   = document.querySelector('h1.details-page-header__item-title');
  const variantEl = document.querySelector('.details-page-header__item-type');
  const baseTitle = titleEl ? titleEl.innerText.trim() : document.title;
  const variant   = variantEl ? variantEl.innerText.trim() : '';
  const title     = variant ? `${baseTitle} ${variant}` : baseTitle;

  // Price
  const priceEl = document.querySelector('.details-page__header__item-price-main, .details-page-header__item-price-main');
  const price   = priceEl ? `Hinta: ${priceEl.innerText.trim()}` : '';

  // Quick specs row: Diesel · 2022 · 145 000 km · Automaatti
  const pick = (sel) => document.querySelector(sel)?.innerText.trim() ?? '';
  const quickSpecs = [
    pick('.details-page__item-main-info_engine'),
    pick('.details-page__item-main-info_year'),
    pick('.details-page__item-main-info_kilometers'),
    pick('.details-page__item-main-info_gear-type'),
  ].filter(Boolean).join(' · ');

  // Road worthy status
  const roadWorthy = pick('.details-page-header__road-worthy');

  // Seller type (private vs dealer)
  const sellerType = pick('.seller-type, .vif-seller-type');

  // Seller highlight text (e.g. "500€ LAHJAKORTTI / DTR+ ...")
  const sellerNote = pick('.unique-selling-point');

  // Perustiedot + Tekniset tiedot: read all vehicle-info-box label/value pairs
  const infoBoxes = [...document.querySelectorAll('.vehicle-info-box')];
  const infoPairs = infoBoxes.map(box => {
    const label = box.querySelector('.vehicle-info-box__vehicle-info')?.innerText.trim();
    const value = box.querySelector('.vehicle-info-box__vehicle-det')?.innerText.trim();
    return label && value ? `${label}: ${value}` : '';
  }).filter(Boolean);

  // Full description (lisätiedot — prefer fullNote if visible, else shortNote)
  const fullNote  = document.querySelector('#fullNote');
  const shortNote = document.querySelector('#shortNote');
  const desc = (fullNote || shortNote)?.innerText.trim() ?? '';

  const parts = [
    quickSpecs,
    price,
    roadWorthy,
    sellerType,
    sellerNote,
    infoPairs.join('\n'),
    desc,
  ].filter(Boolean);

  return { title, context: parts.join('\n\n') };
}

function starsHTML(score) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="${i < score ? 'na-text-amber-400' : 'na-text-gray-300'} na-text-lg na-leading-none">${i < score ? '★' : '☆'}</span>`
  ).join('');
}

function getPanel() {
  let el = document.getElementById(PANEL_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = PANEL_ID;
    // Gestalt: fixed position, right-side — doesn't interrupt content flow
    el.className = 'na-fixed na-top-20 na-right-4 na-z-[999999] na-w-[340px] na-drop-shadow-[0_4px_24px_rgba(0,0,0,0.15)]';
    document.body.appendChild(el);
  }
  return el;
}

function renderPanel(state) {
  const el = getPanel();

  if (state.type === 'loading') {
    el.innerHTML = `
      <div class="na-bg-white na-rounded-card na-border na-border-border na-overflow-hidden">
        ${headerHTML()}
        <div class="na-flex na-flex-col na-items-center na-justify-center na-gap-3 na-py-10 na-px-4">
          <div class="na-w-6 na-h-6 na-rounded-full na-border-2 na-border-gray-200 na-border-t-brand na-animate-spin"></div>
          <p class="na-text-sm na-text-gray-500">Analysoidaan…</p>
        </div>
      </div>`;
  }

  if (state.type === 'result') {
    const d = state.data;
    el.innerHTML = `
      <div class="na-bg-white na-rounded-card na-border na-border-border na-overflow-hidden">
        ${headerHTML()}
        <div class="na-p-4 na-flex na-flex-col na-gap-4 na-max-h-[72vh] na-overflow-y-auto">

          <!-- Score + summary -->
          <div>
            <p class="na-text-md na-font-bold na-text-gray-900 na-leading-snug na-mb-2">${escHtml(state.carTitle)}</p>
            <div class="na-flex na-items-center na-gap-2 na-mb-2.5">
              <div class="na-flex na-gap-0.5">${starsHTML(d.reliabilityScore)}</div>
              <span class="na-text-sm na-text-gray-500">${d.reliabilityScore}/5</span>
            </div>
            <p class="na-text-sm na-text-gray-600 na-leading-relaxed">${escHtml(d.summary)}</p>
          </div>

          <div class="na-border-t na-border-gray-100"></div>

          <!-- Problems -->
          <div>
            <p class="na-text-sm na-font-bold na-text-gray-800 na-mb-2">Tyypilliset ongelmat</p>
            <ul class="na-flex na-flex-col na-gap-2">
              ${(d.commonProblems || []).map(p => `
                <li class="na-flex na-items-start na-gap-2 na-text-sm na-text-gray-600">
                  <span class="na-text-gray-400">${ICON_MINUS}</span>${escHtml(p)}
                </li>`).join('')}
            </ul>
          </div>

          <div class="na-border-t na-border-gray-100"></div>

          <!-- Benefits -->
          <div>
            <p class="na-text-sm na-font-bold na-text-gray-800 na-mb-2">Vahvuudet</p>
            <ul class="na-flex na-flex-col na-gap-2">
              ${(d.benefits || []).map(b => `
                <li class="na-flex na-items-start na-gap-2 na-text-sm na-text-gray-600">
                  <span class="na-text-gray-500">${ICON_PLUS}</span>${escHtml(b)}
                </li>`).join('')}
            </ul>
          </div>

          <div class="na-border-t na-border-gray-100"></div>

          <!-- Similar cars -->
          <div>
            <p class="na-text-sm na-font-bold na-text-gray-800 na-mb-2">Samankaltaiset autot</p>
            <ul class="na-flex na-flex-col na-gap-2">
              ${(d.similarCars || []).map(c => `
                <li class="na-text-sm na-text-gray-600 na-list-disc na-ml-4">${escHtml(c)}</li>
              `).join('')}
            </ul>
          </div>

          ${state.nhtsa && (state.nhtsa.recalls.length > 0 || state.nhtsa.complaintCount > 0 || state.nhtsa.tsbs.length > 0 || state.nhtsa.safetyRating) ? `
          <div class="na-border-t na-border-gray-100"></div>
          <div>
            <p class="na-text-sm na-font-bold na-text-gray-800 na-mb-2">NHTSA-tiedot (USA, viralliset)</p>
            <div class="na-flex na-flex-wrap na-gap-2 na-mb-2">
              ${state.nhtsa.recalls.length > 0 ? `<span class="na-text-xs na-bg-red-50 na-text-red-700 na-rounded na-px-2 na-py-0.5 na-font-medium">Takaisinkutsut: ${state.nhtsa.recalls.length} kpl</span>` : ''}
              ${state.nhtsa.complaintCount > 0 ? `<span class="na-text-xs na-bg-amber-50 na-text-amber-700 na-rounded na-px-2 na-py-0.5 na-font-medium">Valitukset: ${state.nhtsa.complaintCount} kpl</span>` : ''}
              ${state.nhtsa.tsbs.length > 0 ? `<span class="na-text-xs na-bg-blue-50 na-text-blue-700 na-rounded na-px-2 na-py-0.5 na-font-medium">TSB-tiedotteet: ${state.nhtsa.tsbs.length} kpl</span>` : ''}
              ${state.nhtsa.safetyRating ? `<span class="na-text-xs na-bg-green-50 na-text-green-700 na-rounded na-px-2 na-py-0.5 na-font-medium">Turvallisuus: ${state.nhtsa.safetyRating.overall}/5 ★</span>` : ''}
            </div>
            ${state.nhtsa.recalls.length > 0 ? `<ul class="na-flex na-flex-col na-gap-1 na-mb-1">${state.nhtsa.recalls.map(r => `<li class="na-text-2xs na-text-gray-500 na-leading-snug">🔴 ${escHtml(r)}</li>`).join('')}</ul>` : ''}
            ${state.nhtsa.tsbs.length > 0 ? `<ul class="na-flex na-flex-col na-gap-1">${state.nhtsa.tsbs.map(t => `<li class="na-text-2xs na-text-gray-500 na-leading-snug">🔵 ${escHtml(t)}</li>`).join('')}</ul>` : ''}
          </div>
          ` : ''}
          ${state.traficom && state.traficom.filtered > 0 ? `
          <div class="na-border-t na-border-gray-100"></div>
          <div>
            <p class="na-text-sm na-font-bold na-text-gray-800 na-mb-2">Traficom takaisinkutsut (Suomi)</p>
            <span class="na-text-xs na-bg-red-50 na-text-red-700 na-rounded na-px-2 na-py-0.5 na-font-medium na-mb-2 na-inline-block">${state.traficom.filtered} kampanjaa</span>
            <ul class="na-flex na-flex-col na-gap-1 na-mt-1">${state.traficom.items.map(t => `<li class="na-text-2xs na-text-gray-500 na-leading-snug">🔴 ${escHtml(t)}</li>`).join('')}</ul>
          </div>
          ` : ''}
          <div class="na-border-t na-border-gray-100"></div>
          <p class="na-text-2xs na-text-gray-400">Analysoitu OpenAI:lla • NHTSA • Traficom • Tarkista tiedot myyjältä</p>
        </div>
      </div>`;
  }

  if (state.type === 'error') {
    el.innerHTML = `
      <div class="na-bg-white na-rounded-card na-border na-border-border na-overflow-hidden">
        ${headerHTML()}
        <div class="na-p-4 na-flex na-flex-col na-gap-1.5">
          <p class="na-text-sm na-text-gray-800">${escHtml(state.message)}</p>
          ${state.needsKey ? `<p class="na-text-xs na-text-gray-400">Aseta OpenAI API-avain laajennuksen asetuksissa.</p>` : ''}
        </div>
      </div>`;
  }

  el.querySelector('#na-close')?.addEventListener('click', () => el.remove());
}

function headerHTML() {
  return `
    <div class="na-bg-[#cc3300] na-flex na-items-center na-justify-between na-px-4 na-py-3">
      <span class="na-text-sm na-font-semibold na-text-white na-tracking-tight">Nettiautomaatti</span>
      <button id="na-close" class="na-text-white/70 hover:na-text-white na-transition-colors">
        ${ICON_CLOSE}
      </button>
    </div>`;
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function analyse() {
  const { openaiKey } = await chrome.storage.sync.get('openaiKey');
  if (!openaiKey) {
    renderPanel({ type: 'error', message: 'Ei API-avainta asetettu.', needsKey: true });
    return;
  }

  const car = extractCarData();
  const { make, model, year } = extractMakeModelYear();
  renderPanel({ type: 'loading', carTitle: car.title });

  const [nhtsa, traficom] = await Promise.all([
    Promise.race([fetchNHTSA(make, model, year), new Promise(r => setTimeout(() => r(null), 6000))]),
    Promise.race([fetchTraficomRecalls(make, model), new Promise(r => setTimeout(() => r(null), 6000))]),
  ]);

  let externalContext = '';
  if (nhtsa) {
    if (nhtsa.recalls.length > 0)
      externalContext += `\nNHTSA recall campaigns (USA, official): ${nhtsa.recalls.join(' | ')}`;
    if (nhtsa.complaintCount > 0)
      externalContext += `\nNHTSA registered complaints for this model year: ${nhtsa.complaintCount}`;
    if (nhtsa.tsbs.length > 0)
      externalContext += `\nNHTSA Technical Service Bulletins (known issues acknowledged by manufacturer): ${nhtsa.tsbs.join(' | ')}`;
    if (nhtsa.safetyRating)
      externalContext += `\nNHTSA Safety Ratings: Overall ${nhtsa.safetyRating.overall}/5, Frontal ${nhtsa.safetyRating.frontal}/5, Side ${nhtsa.safetyRating.side}/5, Rollover ${nhtsa.safetyRating.rollover}/5`;
  }
  if (traficom) {
    if (traficom.filtered > 0)
      externalContext += `\nTraficom (Finland) recall campaigns for this model (${traficom.filtered} kpl): ${traficom.items.join(' | ')}`;
  }

  const prompt = `You are an automotive expert. Analyse this Finnish car listing and respond with JSON only (no markdown).

Use ALL available data: engine size, mileage, year, fuel type, CO2 emissions, consumption, transmission, and any other specs present. Factor high mileage, age, and specific engine variants into the reliability score.

IMPORTANT: The seller description is written by the seller and should be read critically — it is marketing text and may downplay problems, exaggerate condition, or omit important issues. Note any red flags or suspiciously positive framing in the summary.

For commonProblems and benefits, return between 1 and 7 items each — only as many as are genuinely relevant for this exact car.
${externalContext ? `\nExternal data from official sources:${externalContext}` : ''}

Title: ${car.title}
Listing data:
${car.context}

Return exactly:
{
  "reliabilityScore": <integer 1-5>,
  "summary": "<3-5 sentences in Finnish: overall reliability verdict, how the mileage and age affect it, any red flags or suspicious phrasing in the seller description, and whether the price seems reasonable for what it is>",
  "commonProblems": ["<Finnish, specific to this engine/gearbox variant>", ...],
  "benefits": ["<Finnish>", ...],
  "similarCars": ["<make model year-range>", "<make model year-range>", "<make model year-range>"]
}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error ${res.status}`);
    }

    const json = await res.json();
    const data = JSON.parse(json.choices?.[0]?.message?.content || '{}');
    renderPanel({ type: 'result', carTitle: car.title, data, nhtsa, traficom });
  } catch (e) {
    renderPanel({ type: 'error', message: e.message });
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'analyse') analyse();
});

// Heroicon: sparkles (magic wand feel, solid white)
const ICON_WAND = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" style="width:18px;height:18px"><path fill-rule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z" clip-rule="evenodd"/></svg>`;

function injectButton() {
  if (document.getElementById('na-trigger-btn')) return;

  const toolbar = document.querySelector('.details-tool-bar__nl');
  if (!toolbar) return;

  const btn = document.createElement('button');
  btn.id = 'na-trigger-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Nettiautomaatti-analyysi');
  btn.className = 'button-to-link details-tool-bar__link';
  btn.style.cssText = `display: inline-flex !important; align-items: center; gap: 5px; color: #cc3300 !important; margin-left: 12px;`;
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;flex-shrink:0"><path fill-rule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z" clip-rule="evenodd"/></svg><span>Analysoi</span>`;
  btn.addEventListener('click', (e) => { e.stopPropagation(); analyse(); });

  toolbar.appendChild(btn);
}

// Run on page load; also watch for SPA navigation
injectButton();
const _observer = new MutationObserver(() => injectButton());
_observer.observe(document.body, { childList: true, subtree: true });
