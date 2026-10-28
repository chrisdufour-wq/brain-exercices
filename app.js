/**
 * Reprendre les Commandes • Moteur Applicatif PWA (CFD / Crises Dissociatives)
 * Conforme aux directives de sécurité, offline-first et accessibilité clinique.
 */

// =============================================================================
// 1. Initialisation Audio & Haptique
// =============================================================================
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq, duration = 0.08, type = 'sine') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn('Audio non disponible', e);
  }
}

function triggerHaptic(pattern = [40]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {}
  }
}

// =============================================================================
// 2. Synthèse Vocale pour Consignes Témoin (Optimisée iOS Safari & Mobile)
// =============================================================================
let isVoiceEnabled = true;
let activeUtterance = null;

// Préchargement préventif des voix de synthèse vocale pour iOS/Safari
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    try { window.speechSynthesis.getVoices(); } catch (e) {}
  };
}

function updateVoiceToggleBtn() {
  const btn = document.getElementById('btnWitnessVoiceToggle');
  if (btn) {
    btn.className = isVoiceEnabled ? 'witness-voice-btn active' : 'witness-voice-btn';
    btn.innerText = isVoiceEnabled ? '🔊 Consignes Vocales : ON' : '🔇 Consignes Vocales : OFF';
  }
}

function toggleWitnessVoice() {
  isVoiceEnabled = !isVoiceEnabled;
  updateVoiceToggleBtn();
  if (isVoiceEnabled) {
    speakWitnessInstruction("Consignes vocales activées.");
  } else {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }
  localStorage.setItem('anti_cfd_voice_enabled', isVoiceEnabled ? '1' : '0');
}

// =============================================================================
// Déverrouillage audio session iOS (force la catégorie Playback)
// =============================================================================
let silentAudioUnlocker = null;
function unlockIOSAudioSession() {
  try {
    if (!silentAudioUnlocker) {
      silentAudioUnlocker = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      silentAudioUnlocker.preload = 'auto';
    }
    silentAudioUnlocker.play().catch(() => {});
  } catch (e) {}

  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  } catch (e) {}
}

function speakWitnessInstruction(text) {
  if (!isVoiceEnabled || !('speechSynthesis' in window)) return;
  try {
    // 1. Débloquer la session audio iOS
    unlockIOSAudioSession();

    // 2. Débloquer l'état en pause sur Safari iOS
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    // 3. Annulation préalable de la diction précédente
    window.speechSynthesis.cancel();

    // 4. Création synchrone de l'énoncé (langue fr-FR native sans forcer un objet voice tiers)
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Référence globale permanente pour empêcher le Garbage Collector d'iOS de couper la parole
    window._activeUtterance = utterance;

    utterance.onend = () => {
      window._activeUtterance = null;
    };
    utterance.onerror = (e) => {
      console.warn('Speech synthesis error:', e);
      window._activeUtterance = null;
    };

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Synthèse vocale indisponible', e);
  }
}

function replayCurrentWitnessVoice() {
  const step = WITNESS_STEPS_CONFIG[witnessCurrentStepIndex];
  if (step) {
    isVoiceEnabled = true;
    updateVoiceToggleBtn();
    localStorage.setItem('anti_cfd_voice_enabled', '1');
    speakWitnessInstruction(step.getVoiceText(getPatientName()));
  }
}

// =============================================================================
// 3. Gestion du Patient & de la Personne Ressource
// =============================================================================
function getPatientFirstName() {
  return localStorage.getItem('anti_cfd_patient_name') || 'Christophe';
}

function getPatientLastName() {
  return localStorage.getItem('anti_cfd_patient_lastname') || 'Dufour';
}

function getPatientFullName() {
  const last = getPatientLastName().trim();
  const first = getPatientFirstName().trim();
  if (!last && !first) return 'Patient';
  if (!last) return first;
  if (!first) return last.toUpperCase();
  return `${last.toUpperCase()} ${first}`;
}

function getPatientName() {
  return getPatientFirstName();
}

function getResourceContact() {
  return {
    name: localStorage.getItem('anti_cfd_contact_name') || 'Personne ressource',
    phone: localStorage.getItem('anti_cfd_contact_phone') || '0600000000'
  };
}

function updateContactDisplayElements() {
  const name = getPatientName();
  const lastName = getPatientLastName();
  document.querySelectorAll('.patient-name-display').forEach(el => el.innerText = name);

  const contact = getResourceContact();
  const labelContact = document.getElementById('labelContactName');
  if (labelContact) labelContact.innerText = `${contact.name} (${contact.phone})`;

  const labelWatchdog = document.getElementById('labelWatchdogContact');
  if (labelWatchdog) labelWatchdog.innerText = `Appeler ${contact.name} (${contact.phone})`;

  const btnCall = document.getElementById('btnCallResourceContact');
  if (btnCall) btnCall.href = `tel:${contact.phone.replace(/\s+/g, '')}`;

  const inPat = document.getElementById('inputSettingPatientName');
  if (inPat) inPat.value = name;
  const inPatLast = document.getElementById('inputSettingPatientLastName');
  if (inPatLast) inPatLast.value = lastName;
  const inCName = document.getElementById('inputSettingContactName');
  if (inCName) inCName.value = contact.name;
  const inCPhone = document.getElementById('inputSettingContactPhone');
  if (inCPhone) inCPhone.value = contact.phone;
}

function openSettingsModal() {
  updateContactDisplayElements();
  document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('active');
}

function saveSettingsFromModal() {
  const inPatLast = document.getElementById('inputSettingPatientLastName');
  const inPat = document.getElementById('inputSettingPatientName');
  const patLast = inPatLast ? inPatLast.value.trim() : '';
  const pat = inPat ? inPat.value.trim() : '';
  const cName = document.getElementById('inputSettingContactName').value.trim();
  const cPhone = document.getElementById('inputSettingContactPhone').value.trim();

  if (patLast) localStorage.setItem('anti_cfd_patient_lastname', patLast);
  if (pat) localStorage.setItem('anti_cfd_patient_name', pat);
  if (cName) localStorage.setItem('anti_cfd_contact_name', cName);
  if (cPhone) localStorage.setItem('anti_cfd_contact_phone', cPhone);

  updateContactDisplayElements();
  closeSettingsModal();
  alert('Paramètres enregistrés avec succès !');
}

// =============================================================================
// PERSISTANCE DU STOCKAGE (navigator.storage.persist)
// =============================================================================
async function initStoragePersistence() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        const granted = await navigator.storage.persist();
        console.log(`[Storage] Persist request granted: ${granted}`);
      } else {
        console.log(`[Storage] Storage is already persisted.`);
      }
    } catch (e) {
      console.warn('[Storage] Error requesting persistence:', e);
    }
  }
}

// =============================================================================
// 4. Base de Données Locale IndexedDB
// =============================================================================
const DB_NAME = 'AntiCFD_LocalVault';
const DB_VERSION = 1;
let db = null;

function initIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains('events')) {
        const store = database.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: false });
      }
      if (!database.objectStoreNames.contains('videos')) {
        database.createObjectStore('videos', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
      loadJournalEntries();
    };
    request.onerror = (e) => reject(e);
  });
}

function saveJournalEvent(eventData) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('DB non initialisée');
    const tx = db.transaction(['events'], 'readwrite');
    const store = tx.objectStore('events');
    const req = store.add(eventData);
    req.onsuccess = () => {
      loadJournalEntries();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

function saveRecordedVideoBlob(videoBlob, metadata = {}) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('DB non initialisée');
    const tx = db.transaction(['videos', 'events'], 'readwrite');
    const videoStore = tx.objectStore('videos');
    const eventStore = tx.objectStore('events');

    const videoReq = videoStore.add({
      blob: videoBlob,
      timestamp: Date.now(),
      mimeType: videoBlob.type,
      duration: metadata.duration || '00:30'
    });

    videoReq.onsuccess = () => {
      const videoId = videoReq.result;
      const eventRecord = {
        date: new Date().toISOString(),
        type: `Vidéo clinique pour ${getPatientName()}`,
        notes: `Enregistrement vidéo (${metadata.duration || 'filmé'}). Protocole témoin.`,
        videoId: videoId
      };
      eventStore.add(eventRecord);
      tx.oncomplete = () => {
        loadJournalEntries();
        resolve(videoId);
      };
    };
    videoReq.onerror = () => reject(videoReq.error);
  });
}

function getVideoById(id) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('DB non initialisée');
    const tx = db.transaction(['videos'], 'readonly');
    const store = tx.objectStore('videos');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deleteJournalEntry(id, videoId) {
  if (!confirm('Supprimer cette entrée du journal ?')) return;
  if (!db) return;
  const stores = videoId ? ['events', 'videos'] : ['events'];
  const tx = db.transaction(stores, 'readwrite');
  tx.objectStore('events').delete(id);
  if (videoId) tx.objectStore('videos').delete(videoId);
  tx.oncomplete = () => loadJournalEntries();
}

// =============================================================================
// 5. Navigation & Gestionnaire de Vues
// =============================================================================
function switchView(viewId) {
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  const targetView = document.getElementById(`view-${viewId}`);
  if (targetView) targetView.classList.add('active');

  if (viewId === 'temoin') {
    renderWitnessCurrentStep();
  } else {
    closeFullScreenCameraOverlay();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }
  if (viewId === 'journal') {
    loadJournalEntries();
  }

  // Arrêter la vidéo ou le métronome si on quitte les exercices moteurs
  if (viewId !== 'swap-task') {
    const exVid = document.getElementById('exVideo');
    if (exVid) {
      exVid.pause();
    }
    if (typeof metronomeInterval !== 'undefined' && metronomeInterval) {
      clearInterval(metronomeInterval);
      metronomeInterval = null;
      const btn = document.getElementById('btnToggleSosMetronome');
      if (btn) btn.innerText = '▶️ Démarrer le Métronome de Swap';
    }
  }

  // Watchdog d'inactivité de 45s pendant les tâches exécutives d'aura
  if (['calc-task', 'quizz-task', 'stroop-task', 'swap-task'].includes(viewId)) {
    startAuraWatchdog();
  } else {
    stopAuraWatchdog();
  }

  window.scrollTo({ top: 0, behavior: 'instant' });
}

function openAuraHub() {
  switchView('aura');
}

function startWitnessWizard() {
  witnessCurrentStepIndex = 0;
  unlockIOSAudioSession();
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.resume();
    } catch (e) {}
  }
  switchView('temoin');
}

function restartWitnessFilming() {
  witnessCurrentStepIndex = 4;
  switchView('temoin');
}

function finishCognitiveTask() {
  stopAuraWatchdog();
  triggerHaptic([60, 40, 60]);
  saveJournalEvent({
    date: new Date().toISOString(),
    type: "Aura interrompue avec succès",
    notes: "Le patient a réalisé des exercices cognitifs exécutifs et a repris le contrôle."
  });
  alert("👏 Excellent ! Vous avez réengagé votre réseau exécutif et repris les commandes.");
  switchView('landing');
}

// =============================================================================
// WATCHDOG D'INACTIVITÉ (45s) EN PHASE D'AURA & TÂCHES COGNITIVES
// =============================================================================
let auraWatchdogTimer = null;
const WATCHDOG_TIMEOUT_MS = 45000;
let watchdogListenersAttached = false;

function resetAuraWatchdog() {
  if (auraWatchdogTimer) {
    clearTimeout(auraWatchdogTimer);
    auraWatchdogTimer = null;
  }
  const currentView = document.querySelector('.view-section.active');
  const isAuraTask = currentView && ['view-calc-task', 'view-quizz-task', 'view-stroop-task', 'view-swap-task'].includes(currentView.id);
  if (!isAuraTask) return;

  auraWatchdogTimer = setTimeout(triggerAuraWatchdogAlert, WATCHDOG_TIMEOUT_MS);
}

function startAuraWatchdog() {
  attachWatchdogActivityListeners();
  resetAuraWatchdog();
}

function stopAuraWatchdog() {
  if (auraWatchdogTimer) {
    clearTimeout(auraWatchdogTimer);
    auraWatchdogTimer = null;
  }
  const modal = document.getElementById('auraWatchdogModal');
  if (modal) modal.classList.remove('active');
}

function attachWatchdogActivityListeners() {
  if (watchdogListenersAttached) return;
  watchdogListenersAttached = true;
  ['touchstart', 'mousedown', 'keydown', 'input'].forEach(evt => {
    window.addEventListener(evt, () => {
      const modal = document.getElementById('auraWatchdogModal');
      if (modal && modal.classList.contains('active')) return;
      resetAuraWatchdog();
    }, { passive: true });
  });
}

function triggerAuraWatchdogAlert() {
  triggerHaptic([200, 100, 200, 100, 400]);
  const modal = document.getElementById('auraWatchdogModal');
  if (modal) {
    const contact = getResourceContact();
    const btnCall = document.getElementById('btnWatchdogCallContact');
    if (btnCall) {
      btnCall.href = `tel:${contact.phone.replace(/\s+/g, '')}`;
    }
    const lblContact = document.getElementById('labelWatchdogContact');
    if (lblContact) {
      lblContact.innerText = `Appeler ${contact.name} (${contact.phone})`;
    }
    modal.classList.add('active');
  }
}

function dismissAuraWatchdog() {
  const modal = document.getElementById('auraWatchdogModal');
  if (modal) modal.classList.remove('active');
  resetAuraWatchdog();
}

function switchFromWatchdogToWitness() {
  stopAuraWatchdog();
  startWitnessWizard();
}

// =============================================================================
// VERROUILLAGE / CODE D'ACCÈS CLINIQUE PRATICIEN (2527)
// =============================================================================
const CLINICAL_ACCESS_CODE = '2527';

function initAccessGate() {
  const overlay = document.getElementById('gateLockOverlay');
  if (!overlay) return;

  // 1. Détection Magic Link via paramètre URL : ?cle=2527 ou ?code=2527 ou ?pin=2527
  const urlParams = new URLSearchParams(window.location.search);
  const paramCode = urlParams.get('cle') || urlParams.get('code') || urlParams.get('token') || urlParams.get('pin');
  if (paramCode && paramCode.trim() === CLINICAL_ACCESS_CODE) {
    localStorage.setItem('cfd_app_unlocked', 'true');
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  // 2. Vérification de la persistance locale
  if (localStorage.getItem('cfd_app_unlocked') === 'true') {
    overlay.classList.add('hidden');
  } else {
    overlay.classList.remove('hidden');
    const pinInput = document.getElementById('gatePinInput');
    if (pinInput) {
      pinInput.value = '';
      setTimeout(() => pinInput.focus(), 300);
      pinInput.addEventListener('input', () => {
        if (pinInput.value.length === 4) {
          submitGateCode();
        }
      });
      pinInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') submitGateCode();
      });
    }
  }
}

function submitGateCode() {
  const pinInput = document.getElementById('gatePinInput');
  const errorMsg = document.getElementById('gateErrorMessage');
  const overlay = document.getElementById('gateLockOverlay');
  if (!pinInput || !overlay) return;

  const entered = pinInput.value.trim();
  if (entered === CLINICAL_ACCESS_CODE) {
    localStorage.setItem('cfd_app_unlocked', 'true');
    if (errorMsg) errorMsg.classList.add('hidden');
    overlay.classList.add('hidden');
    try {
      playTone(880, 0.12);
      triggerHaptic([40, 30, 40]);
    } catch (e) {}
  } else {
    if (errorMsg) errorMsg.classList.remove('hidden');
    pinInput.value = '';
    pinInput.focus();
    try {
      playTone(220, 0.25, 'sawtooth');
      triggerHaptic([80, 40, 80]);
    } catch (e) {}
  }
}

function lockAppAccess() {
  localStorage.removeItem('cfd_app_unlocked');
  closeSettingsModal();
  const overlay = document.getElementById('gateLockOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    const pinInput = document.getElementById('gatePinInput');
    if (pinInput) {
      pinInput.value = '';
      setTimeout(() => pinInput.focus(), 200);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initAccessGate();
  initStoragePersistence();
  initIndexedDB();
  updateContactDisplayElements();

  const savedVoice = localStorage.getItem('anti_cfd_voice_enabled');
  if (savedVoice !== null) {
    isVoiceEnabled = savedVoice === '1';
    const btn = document.getElementById('btnWitnessVoiceToggle');
    if (btn) {
      btn.className = isVoiceEnabled ? 'witness-voice-btn active' : 'witness-voice-btn';
      btn.innerText = isVoiceEnabled ? '🔊 Consignes Vocales : ON' : '🔇 Consignes Vocales : OFF';
    }
  }

  // Prise en charge des raccourcis PWA (App Shortcuts)
  const urlParams = new URLSearchParams(window.location.search);
  const requestedView = urlParams.get('view');
  const requestedAction = urlParams.get('action');

  if (requestedView === 'journal') {
    switchView('journal');
    if (requestedAction === 'add') {
      setTimeout(() => openAddCfdModal(), 250);
    }
  } else if (requestedView === 'aura') {
    openAuraHub();
  } else if (requestedView === 'temoin') {
    startWitnessWizard();
  } else if (requestedView) {
    switchView(requestedView);
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn(err));
  }
});

// =============================================================================
// 6. CALCUL MENTAL SÉQUENTIEL (-7) SANS LIMITE & SOLUTION CHIFFRÉE PURE
// =============================================================================
let calcStartNumber = 45739;
let calcCurrentStep = 1;

function startCalcTask() {
  generateNewCalcNumber();
  switchView('calc-task');
}

function generateNewCalcNumber() {
  calcStartNumber = Math.floor(10000 + Math.random() * 89999);
  calcCurrentStep = 1;
  document.getElementById('calcStartNumberDisplay').innerText = calcStartNumber;
  document.getElementById('calcStepCounter').innerText = `Calcul 1`;
  document.getElementById('calcOperationPrompt').innerText = `− 7`;
  
  const solText = document.getElementById('calcSolutionText');
  solText.style.display = 'none';
  solText.innerText = '';
  document.getElementById('btnRevealCalcSolution').innerText = '👁️ Vérifier la solution';
}

function handleCalcStepCompleted() {
  triggerHaptic([50]);
  playTone(540, 0.05);

  calcCurrentStep++;
  document.getElementById('calcStepCounter').innerText = `Calcul ${calcCurrentStep}`;
  document.getElementById('calcOperationPrompt').innerText = `− 7 (Étape ${calcCurrentStep})`;
  document.getElementById('calcSolutionText').style.display = 'none';
  document.getElementById('btnRevealCalcSolution').innerText = '👁️ Vérifier la solution';
}

function toggleCalcSolution() {
  const solText = document.getElementById('calcSolutionText');
  const btn = document.getElementById('btnRevealCalcSolution');

  if (solText.style.display === 'none') {
    // Affiche UNIQUEMENT le résultat chiffré, pas le détail du calcul
    const result = calcStartNumber - (calcCurrentStep * 7);
    solText.innerText = `${result}`;
    solText.style.display = 'block';
    btn.innerText = '🙈 Masquer la solution';
  } else {
    solText.style.display = 'none';
    btn.innerText = '👁️ Vérifier la solution';
  }
}

// =============================================================================
// 7. QUIZZ FLUIDITÉ SÉMANTIQUE (LETTRE ALÉATOIRE SANS LIMITE)
// =============================================================================
const QUIZZ_CATEGORIES = [
  "3 noms d'ANIMAUX",
  "3 PAYS du monde",
  "3 VILLES",
  "3 MÉTIERS",
  "3 OBJETS de la vie quotidienne",
  "3 FRUITS ou LÉGUMES"
];

const QUIZZ_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'L', 'M', 'P', 'R', 'S', 'T', 'V'];

function startQuizzTask() {
  generateNewQuizzChallenge();
  switchView('quizz-task');
}

function generateNewQuizzChallenge() {
  const cat = QUIZZ_CATEGORIES[Math.floor(Math.random() * QUIZZ_CATEGORIES.length)];
  const letter = QUIZZ_LETTERS[Math.floor(Math.random() * QUIZZ_LETTERS.length)];

  document.getElementById('quizzCategoryPrompt').innerText = `Citez à haute voix ${cat}`;
  document.getElementById('quizzLetterDisplay').innerText = letter;

  playTone(580, 0.06);
  triggerHaptic([40]);
}

// =============================================================================
// 8. TEST DE STROOP PLEIN ÉCRAN (BOUTONS COULEUR NEUTRE IDENTIQUE)
// =============================================================================
const STROOP_COLORS = [
  { name: 'ROUGE', hex: '#DC2626' },
  { name: 'VERT', hex: '#16A34A' },
  { name: 'BLEU', hex: '#2563EB' },
  { name: 'JAUNE', hex: '#CA8A04' }
];

let stroopTrial = 0;
let currentCorrectColor = null;

function startStroopTask() {
  stroopTrial = 0;
  switchView('stroop-task');
  nextStroopTrial();
}

function nextStroopTrial() {
  stroopTrial++;
  document.getElementById('stroopRoundCounter').innerText = `Essai ${stroopTrial}`;

  const wordIdx = Math.floor(Math.random() * STROOP_COLORS.length);
  let colorIdx;
  do {
    colorIdx = Math.floor(Math.random() * STROOP_COLORS.length);
  } while (colorIdx === wordIdx && Math.random() < 0.75);

  const wordObj = STROOP_COLORS[wordIdx];
  const inkObj = STROOP_COLORS[colorIdx];

  const wordElem = document.getElementById('stroopWord');
  wordElem.innerText = wordObj.name;
  wordElem.style.color = inkObj.hex;
  currentCorrectColor = inkObj.name;
}

function submitStroopAnswer(chosenColor) {
  if (chosenColor === currentCorrectColor) {
    playTone(660, 0.05);
    triggerHaptic([30]);
  } else {
    playTone(260, 0.1, 'sawtooth');
    triggerHaptic([80]);
  }
  nextStroopTrial();
}

// =============================================================================
// 9. MOUVEMENTS ASYMÉTRIQUES ALÉATOIRES SANS NUMÉROTATION
// =============================================================================
const EXERCISES_DATA = [
  {
    title: "Le Lapin et le Pistolet",
    target: "Inhibition du réflexe de symétrie.",
    video: "videos/01_lapin_et_pistolet.mp4",
    image: "illustrations/01_lapin_et_pistolet.jpg",
    desc1: "Main gauche : Le Lapin (Index et majeur dressés)",
    desc2: "Main droite : Le Pistolet (Pouce levé, index pointé)",
    swapTip: "Au bip/vibration : la main gauche devient le pistolet, la droite devient le lapin !"
  },
  {
    title: "Index et Auriculaire",
    target: "Dissociation des rayons extrêmes 2 et 5 (médian vs ulnaire).",
    video: "videos/03_index_et_auriculaire.mp4",
    image: "illustrations/05_index_et_auriculaire.jpg",
    desc1: "Main gauche : Index pointé vers le centre",
    desc2: "Main droite : Petit doigt (auriculaire) pointé vers le centre",
    swapTip: "Au bip/vibration : rentrez l'index et sortez le petit doigt, et inversement !"
  }
];

let currentExerciseIndex = 0;

function startSwapTask(exerciseIndex = 0) {
  currentExerciseIndex = exerciseIndex;
  pickExercise(currentExerciseIndex);
  switchView('swap-task');
}

function pickRandomExercise() {
  currentExerciseIndex = (currentExerciseIndex + 1) % EXERCISES_DATA.length;
  pickExercise(currentExerciseIndex);
}

function pickExercise(idx) {
  currentExerciseIndex = idx;
  const ex = EXERCISES_DATA[idx] || EXERCISES_DATA[0];
  const exTitle = document.getElementById('exTitle');
  const exTarget = document.getElementById('exTarget');
  const exImg = document.getElementById('exImage');
  const exVid = document.getElementById('exVideo');
  const exDesc1 = document.getElementById('exDesc1');
  const exDesc2 = document.getElementById('exDesc2');
  const exSwapTip = document.getElementById('exSwapTip');

  if (exTitle) exTitle.innerText = ex.title;
  if (exTarget) exTarget.innerText = ex.target;
  if (exDesc1) exDesc1.innerText = ex.desc1;
  if (exDesc2) exDesc2.innerText = ex.desc2;
  if (exSwapTip) exSwapTip.innerText = ex.swapTip;

  if (ex.video && exVid) {
    exVid.src = ex.video;
    exVid.style.display = 'block';
    if (exImg) exImg.style.display = 'none';
    exVid.play().catch(() => {});
  } else {
    if (exVid) {
      exVid.pause();
      exVid.style.display = 'none';
      exVid.removeAttribute('src');
    }
    if (exImg) {
      exImg.src = ex.image;
      exImg.style.display = 'block';
    }
  }
}

let metronomeInterval = null;
let metronomePhase = 0;

function toggleSosMetronome() {
  const btn = document.getElementById('btnToggleSosMetronome');
  if (metronomeInterval) {
    clearInterval(metronomeInterval);
    metronomeInterval = null;
    btn.innerText = '▶️ Démarrer le Métronome de Swap';
  } else {
    btn.innerText = '⏹️ Arrêter le Métronome';
    getAudioContext();
    metronomePhase = 0;
    metronomeInterval = setInterval(() => {
      const bA = document.getElementById('badgePhaseA');
      const bB = document.getElementById('badgePhaseB');
      if (metronomePhase === 0) {
        bA.className = 'swap-phase-badge active-a';
        bB.className = 'swap-phase-badge';
        playTone(480, 0.07);
        triggerHaptic([45]);
        metronomePhase = 1;
      } else {
        bA.className = 'swap-phase-badge';
        bB.className = 'swap-phase-badge active-b';
        playTone(640, 0.07);
        triggerHaptic([45]);
        metronomePhase = 0;
      }
    }, 1000);
  }
}

// =============================================================================
// 10. MODAL PILIERS D'HYGIÈNE DE VIE (SOMMEIL, RESPIRATION, HYPOTENSION, SPORT)
// =============================================================================
function openPillarModal(pillarType) {
  const modal = document.getElementById('pillarModal');
  const title = document.getElementById('pillarModalTitle');
  const content = document.getElementById('pillarModalContent');

  if (pillarType === 'hypotension') {
    title.innerText = '💧 1. Lutter contre l\'Hypotension & Vertiges';
    content.innerHTML = `
      <div style="font-size: 14.5px; line-height: 1.6; color: var(--text-secondary);">
        <p>Une chute de pression artérielle diminue l'oxygénation du cortex et désorganise immédiatement le réseau exécutif :</p>
        <ul style="margin: 10px 0 16px 18px; line-height: 1.7;">
          <li><strong>Boire 2 à 3 Litres d'eau / jour :</strong> Gardez une gourde toujours visible et buvez régulièrement pour maintenir la volémie circulante.</li>
          <li><strong>Manger davantage salé :</strong> Salez généreusement vos plats, consommez des bouillons ou des eaux riches en sodium pour retenir l'eau dans les artères (sauf contre-indication médicale).</li>
          <li><strong>Lever en 3 temps :</strong> Restez assis au bord du lit 1 minute avant de vous lever pour éviter le décrochage orthostatique.</li>
        </ul>
        <h4 style="color: var(--text-primary); margin-bottom: 6px;">Manœuvres Physiques de Contre-Pression (En cas de vertige) :</h4>
        <div style="background-color: #FEF3C7; border: 1px solid #F59E0B; border-radius: 10px; padding: 12px; color: #92400E; font-size: 13.5px; line-height: 1.5;">
          • <strong>Leg Crossing :</strong> Croisez les jambes fermement et contractez puissamment les cuisses et les fessiers.<br>
          • <strong>Pompe des mollets :</strong> Montez 15 fois d'affilée sur la pointe des pieds.<br>
          • <strong>Accroupissement :</strong> Accroupissez-vous immédiatement au sol si la tête tourne.
        </div>
      </div>
    `;
  } else if (pillarType === 'respiration') {
    title.innerText = '🫁 2. Diminuer votre Stress & Respiration';
    content.innerHTML = `
      <div style="font-size: 14.5px; line-height: 1.6; color: var(--text-secondary);">
        <p>Face au stress, <strong>ne cherchez pas à vous remplir d'air</strong> (risque d'hyperventilation). Relâchez le système nerveux en deux temps :</p>
        <div style="background-color: var(--color-sn-bg); border-radius: 12px; padding: 14px; margin: 14px 0; color: var(--text-primary);">
          <strong>1. Bouche entrouverte :</strong> Laissez passivement l'air s'échapper à son rythme sans forcer. Sentez la cage thoracique descendre et se relâcher.<br><br>
          <strong>2. Par le nez (bouche fermée) :</strong> Petite inspiration douce et naturelle sans ouvrir la bouche.
        </div>
        <div class="respiration-container" style="padding: 16px 0;">
          <div class="resp-circle" id="respCircle">
            <span class="resp-label" id="respLabel">Prêt</span>
            <span class="resp-sub" id="respSub">Appuyez ci-dessous</span>
          </div>
        </div>
        <div style="margin-top: 14px; display: flex; flex-direction: column; gap: 8px;">
          <button class="btn-primary" style="background: linear-gradient(135deg, #059669 0%, #10B981 100%);" onclick="closePillarModal(); playRespirationVideoFullScreen();">
            🎬 Voir la vidéo explicative du Dr Dufour (Plein écran)
          </button>
          <button class="btn-secondary" id="btnToggleResp" onclick="toggleRespiration()">
            ▶️ Lancer le métronome visuel de respiration
          </button>
        </div>
      </div>
    `;
  } else if (pillarType === 'sommeil') {
    title.innerText = '🛏️ 3. Bien Dormir • Hygiène du Sommeil';
    content.innerHTML = `
      <div style="font-size: 14.5px; line-height: 1.6; color: var(--text-secondary);">
        <p>Un sommeil profond et régulier est le premier régénérateur du réseau exécutif frontal. Voici les 4 règles d'or :</p>
        
        <div style="background-color: var(--bg-card-subtle); border-radius: 12px; padding: 14px; margin: 12px 0;">
          <h4 style="color: var(--color-sn); margin-bottom: 4px;">1. Le lit est réservé exclusivement au sommeil</h4>
          <p style="font-size: 13.5px; margin: 0;">Ne travaillez pas, ne regardez pas d'écran, ne mangez pas et ne ruminez pas au lit. Votre cerveau doit associer le matelas au sommeil et à rien d'autre.</p>
        </div>

        <div style="background-color: var(--bg-card-subtle); border-radius: 12px; padding: 14px; margin: 12px 0;">
          <h4 style="color: var(--color-sn); margin-bottom: 4px;">2. La règle des 20 minutes (sans regarder l'heure)</h4>
          <p style="font-size: 13.5px; margin: 0;">Si vous ne dormez pas après environ 20 minutes (à l'estimation, sans vérifier de montre), <strong>levez-vous</strong>. Allez dans une autre pièce calme et faiblement éclairée, lisez un livre papier ou écoutez une musique douce. Ne retournez au lit que lorsque vos yeux piquent et que la somnolence revient.</p>
        </div>

        <div style="background-color: var(--bg-card-subtle); border-radius: 12px; padding: 14px; margin: 12px 0;">
          <h4 style="color: var(--color-sn); margin-bottom: 4px;">3. Fuyez la lumière bleue 1h avant le coucher</h4>
          <p style="font-size: 13.5px; margin: 0;">Éteignez téléphones, tablettes et ordinateurs au moins 60 minutes avant de dormir. La lumière bleue bloque chimiquement la sécrétion de mélatonine naturelle.</p>
        </div>

        <div style="background-color: var(--bg-card-subtle); border-radius: 12px; padding: 14px; margin: 12px 0;">
          <h4 style="color: var(--color-sn); margin-bottom: 4px;">4. Régularité stricte de l'heure du lever</h4>
          <p style="font-size: 13.5px; margin: 0;">Levez-vous tous les jours à la même heure, y compris le week-end. C'est l'heure du lever matinal qui ancre et synchronise votre rythme circadien.</p>
        </div>
      </div>
    `;
  } else if (pillarType === 'cerveau') {
    title.innerText = '🧠 4. Entraîner votre Cerveau au Quotidien';
    content.innerHTML = `
      <div style="font-size: 14.5px; line-height: 1.6; color: var(--text-secondary);">
        <p style="margin-bottom: 12px;">
          Le réseau exécutif cérébral (inhibition, mémoire de travail, flexibilité et planification) se muscle par des défis stimulants dans la vie réelle en <strong>conditions écologiques</strong> :
        </p>

        <div style="background-color: var(--bg-card-subtle); border-radius: 12px; padding: 14px; margin-bottom: 12px;">
          <h4 style="color: var(--color-cen); margin-bottom: 4px;">♟️ 1. Jeux de stratégie et de cartes</h4>
          <p style="font-size: 13.5px; margin: 0;">Échecs, dames, jeux de société modernes de stratégie, tarot, belote ou bridge. Exige d'anticiper plusieurs coups à l'avance et d'inhiber les réactions impulsives.</p>
        </div>

        <div style="background-color: var(--bg-card-subtle); border-radius: 12px; padding: 14px; margin-bottom: 12px;">
          <h4 style="color: var(--color-cen); margin-bottom: 4px;">🍳 2. Recettes complexes & Pâtisserie de précision</h4>
          <p style="font-size: 13.5px; margin: 0;">Cuisinez des plats élaborés ou de la pâtisserie nécessitant le respect strict des étapes, des pesées exactes et la synchronisation de plusieurs cuissons simultanées (attention partagée et séquençage temporel).</p>
        </div>

        <div style="background-color: var(--bg-card-subtle); border-radius: 12px; padding: 14px; margin-bottom: 12px;">
          <h4 style="color: var(--color-cen); margin-bottom: 4px;">🧭 3. Se retrouver en ville sans GPS ni plan</h4>
          <p style="font-size: 13.5px; margin: 0;">Déplacez-vous dans un quartier, une ville ou un parc sans regarder votre smartphone ni carte. Mémorisez au préalable 3 repères visuels clés et orientez-vous grâce à votre carte mentale spatiale.</p>
        </div>

        <div style="background-color: var(--bg-card-subtle); border-radius: 12px; padding: 14px; margin-bottom: 12px;">
          <h4 style="color: var(--color-cen); margin-bottom: 4px;">🛒 4. Courses optimisées « Zéro Aller-Retour »</h4>
          <p style="font-size: 13.5px; margin: 0;">Préparez votre liste et traversez le magasin en suivant un circuit unique sans jamais revenir en arrière sur vos pas, tout en résistant aux rayons distracteurs (inhibition active et mémoire de travail).</p>
        </div>

        <div style="background-color: var(--bg-card-subtle); border-radius: 12px; padding: 14px; margin-bottom: 12px;">
          <h4 style="color: var(--color-cen); margin-bottom: 4px;">✈️ 5. Planification détaillée d'un voyage ou d'un projet</h4>
          <p style="font-size: 13.5px; margin: 0;">Organisez un séjour ou un week-end : étapes, transports, réservations, valise logique et gestion des imprévus (mémoire prospective et organisation séquentielle).</p>
        </div>

        <div style="background-color: var(--bg-card-subtle); border-radius: 12px; padding: 14px; margin-bottom: 6px;">
          <h4 style="color: var(--color-cen); margin-bottom: 4px;">🧶 6. Activités manuelles de minutie (Bricolage, Crochet, Tricot)</h4>
          <p style="font-size: 13.5px; margin: 0;">Travail du bois, modélisme, crochet ou tricot suivant un schéma complexe de mailles. Sollicite l'inhibition motrice, le comptage mental et la coordination bimanuelle fine.</p>
        </div>
      </div>
    `;
  } else if (pillarType === 'sport') {
    title.innerText = '🏃 5. Faire du Sport • Pacing & Régulation';
    content.innerHTML = `
      <div style="font-size: 14.5px; line-height: 1.6; color: var(--text-secondary);">
        <p>L'exercice physique régulier stabilise le système nerveux autonome et élève le seuil de déclenchement des auras :</p>
        <div style="background-color: var(--bg-card-subtle); border-radius: 12px; padding: 14px; margin: 12px 0;">
          <h4 style="color: var(--color-sn); margin-bottom: 4px;">🌲 1. La Marche dans la Nature</h4>
          <p style="font-size: 13.5px; margin: 0;">Stimule la motricité bilatérale alternée, offre une immersion visuo-spatiale apaisante et réduit significativement l'hyperactivité du réseau par défaut (DMN).</p>
        </div>
        <div style="background-color: var(--bg-card-subtle); border-radius: 12px; padding: 14px; margin: 12px 0;">
          <h4 style="color: var(--color-cen); margin-bottom: 4px;">🏊 2. La Natation</h4>
          <p style="font-size: 13.5px; margin: 0;">Excellente régulation cardiovasculaire en décharge articulaire complète, particulièrement adaptée en cas de fragilité orthostatique (la pression hydrostatique favorise le retour veineux cérébral).</p>
        </div>
        <p style="font-size: 13.5px; font-weight: 600; color: var(--color-aura); margin-top: 10px;">
          ⚠️ Règle du Pacing : Pratiquez à intensité modérée et régulière sans chercher l'épuisement physique, qui pourrait déclencher une crise.
        </p>
      </div>
    `;
  }

  modal.classList.add('active');
}

function closePillarModal() {
  document.getElementById('pillarModal').classList.remove('active');
  if (sleepTimerInterval) {
    clearInterval(sleepTimerInterval);
    sleepTimerInterval = null;
  }
  if (respInterval) {
    clearInterval(respInterval);
    respInterval = null;
  }
}

// =============================================================================
// LECTEUR VIDÉO PLEIN ÉCRAN (RESPIRATION DU DR DUFOUR)
// =============================================================================
function playRespirationVideoFullScreen() {
  const overlay = document.getElementById('respirationVideoModal');
  const video = document.getElementById('respirationVideoPlayer');
  if (!overlay || !video) return;

  // Réveiller l'audio iOS
  unlockIOSAudioSession();

  overlay.classList.add('active');
  video.currentTime = 0;
  video.muted = false;
  video.volume = 1.0;

  // Lancement de la lecture avec son
  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise.catch(err => {
      console.warn("Lecture vidéo audio directe restreinte, tentative sonore:", err);
      video.muted = true;
      video.play().then(() => {
        video.muted = false;
      }).catch(() => {});
    });
  }

  // Tenter le plein écran natif iOS/Safari si disponible
  if (video.webkitEnterFullscreen) {
    try {
      video.webkitEnterFullscreen();
    } catch (e) {}
  } else if (video.requestFullscreen) {
    try {
      video.requestFullscreen().catch(() => {});
    } catch (e) {}
  }

  // Écouter la fin de la vidéo ou la sortie du plein écran natif
  video.onended = () => {
    closeRespirationVideo();
  };
  video.onwebkitendfullscreen = () => {
    closeRespirationVideo();
  };
}

function closeRespirationVideo() {
  const overlay = document.getElementById('respirationVideoModal');
  const video = document.getElementById('respirationVideoPlayer');
  if (video) {
    try {
      video.pause();
      video.currentTime = 0;
    } catch (e) {}
  }
  if (overlay) {
    overlay.classList.remove('active');
  }
}

// Minuteur Sommeil TCC-I
let sleepTimerInterval = null;
let sleepTimerRemaining = 20 * 60;

function toggleSleepTimer() {
  const btn = document.getElementById('btnToggleSleepTimer');
  if (sleepTimerInterval) {
    clearInterval(sleepTimerInterval);
    sleepTimerInterval = null;
    if (btn) btn.innerText = '▶️ Lancer Minuteur';
  } else {
    sleepTimerRemaining = 20 * 60;
    if (btn) btn.innerText = '⏹️ Arrêter';
    sleepTimerInterval = setInterval(() => {
      sleepTimerRemaining--;
      const mins = String(Math.floor(sleepTimerRemaining / 60)).padStart(2, '0');
      const secs = String(sleepTimerRemaining % 60).padStart(2, '0');
      const disp = document.getElementById('sleepTimerDisplay');
      if (disp) disp.innerText = `${mins}:${secs}`;

      if (sleepTimerRemaining <= 0) {
        clearInterval(sleepTimerInterval);
        sleepTimerInterval = null;
        playTone(440, 0.4);
        triggerHaptic([200, 100, 200]);
        alert("⏰ Règle des 20 minutes : Si vous ne dormez pas, levez-vous calmement du lit !");
        if (btn) btn.innerText = '▶️ Lancer Minuteur';
      }
    }, 1000);
  }
}

// Guide Respiratoire
let respInterval = null;
let respState = 0;

function toggleRespiration() {
  const circle = document.getElementById('respCircle');
  const label = document.getElementById('respLabel');
  const sub = document.getElementById('respSub');
  const btn = document.getElementById('btnToggleResp');

  if (respInterval) {
    clearInterval(respInterval);
    respInterval = null;
    if (btn) btn.innerText = '▶️ Démarrer le guidage';
    if (label) label.innerText = 'Prêt';
    if (sub) sub.innerText = 'Appuyez ci-dessous';
    if (circle) circle.className = 'resp-circle';
  } else {
    if (btn) btn.innerText = '⏹️ Arrêter';
    const runCycle = () => {
      if (respState === 0) {
        if (circle) circle.className = 'resp-circle exhale';
        if (label) label.innerText = "Laissez l'air s'échapper...";
        if (sub) sub.innerText = "Bouche entrouverte, sans forcer. Détente de la cage thoracique.";
        playTone(320, 0.05);
        respState = 1;
      } else {
        if (circle) circle.className = 'resp-circle inhale';
        if (label) label.innerText = "Petite inspiration par le nez";
        if (sub) sub.innerText = "Bouche fermée, respiration douce et naturelle.";
        playTone(380, 0.05);
        respState = 0;
      }
    };
    runCycle();
    respInterval = setInterval(runCycle, 4500);
  }
}

// =============================================================================
// 11. WIZARD TÉMOIN PLEIN ÉCRAN
// =============================================================================
let witnessCurrentStepIndex = 0;

const WITNESS_STEPS_CONFIG = [
  {
    badge: 'Étape 1 / 8 • Sécurité',
    isCameraRequired: false,
    getTitle: (name) => `1. Gardez votre calme : ce n'est PAS une crise d'épilepsie`,
    getBody: (name) => `
      <div class="witness-alert-box">
        <strong>Ne paniquez pas :</strong> ${name} présente une <strong>Crise Fonctionnelle Dissociative (CFD)</strong>.<br>
        Le cerveau est en surcharge temporaire, mais <strong>il n'y a pas de lésion cérébrale ni de danger vital immédiat</strong>.<br><br>
        Restez calme, ne criez pas et respirez posément.
      </div>
    `,
    getButtonText: (name) => `J'AI COMPRIS, JE GARDE MON CALME ➔`,
    getVoiceText: (name) => `Ne paniquez pas. Ce n'est pas une crise d'épilepsie. ${name} traverse une crise fonctionnelle. Il n'y a aucun danger mortel. Gardez votre calme et validez pour continuer.`
  },
  {
    badge: 'Étape 2 / 8 • Sécurité',
    isCameraRequired: false,
    getTitle: (name) => `2. ${name} est-il(elle) allongé(e) sur un lit ou par terre ?`,
    getBody: (name) => `
      La priorité absolue est <strong>d'éviter toute chute</strong>.<br><br>
      • Allongez ${name} au sol (sur un tapis si possible) ou sur un lit.<br>
      • Ne retenez pas les mouvements de force. Laissez le corps libre sans le contraindre.
    `,
    getButtonText: (name) => `OUI, ${name.toUpperCase()} EST ALLONGÉ(E) ➔`,
    getVoiceText: (name) => `${name} est-il allongé en sécurité sur un lit ou par terre ? Allongez la personne pour éviter toute chute, puis validez.`
  },
  {
    badge: 'Étape 3 / 8 • Sécurité',
    isCameraRequired: false,
    getTitle: (name) => `3. Avez-vous écarté les objets dangereux et protégé la tête ?`,
    getBody: (name) => `
      Dégagez l'espace immédiat :<br><br>
      • Éloignez les tables basses, verres, chaises et meubles d'angle.<br>
      • Si la tête est proche d'un mur ou d'un sol dur, <strong>placez un coussin, un oreiller ou un vêtement replié sous sa tête</strong>.
    `,
    getButtonText: (name) => `OUI, L'ESPACE EST DÉGAGÉ ➔`,
    getVoiceText: (name) => `Avez-vous écarté les objets dangereux et protégé la tête ? Éloignez les meubles et placez un coussin sous sa tête, puis validez.`
  },
  {
    badge: 'Étape 4 / 8 • Sécurité',
    isCameraRequired: false,
    getTitle: (name) => `4. Ne mettez STRICTEMENT RIEN dans sa bouche`,
    getBody: (name) => `
      <div class="witness-alert-box">
        <strong>⚠️ INTERDICTION ABSOLUE :</strong> Ne mettez jamais doigts ou objets dans la bouche. La personne ne peut pas avaler sa langue.
      </div>
      • Si ${name} salive ou vomit, tournez doucement son corps sur le côté en <strong>Position Latérale de Sécurité (PLS)</strong>.<br>
      • Desserrez col et vêtements serrés.
    `,
    getButtonText: (name) => `CONSIGNES APPLIQUÉES • PASSER AU FILMAGE ➔`,
    getVoiceText: (name) => `Ne mettez strictement rien dans sa bouche. Si nécessaire, basculez la personne sur le côté en PLS. Validez pour passer au filmage.`
  },
  {
    badge: 'Étape 5 / 8 • Filmage Médical',
    isCameraRequired: true,
    shortInstruction: 'Filmez TOUT LE CORPS pendant 30 secondes',
    getTitle: (name) => `5. Filmez TOUT LE CORPS de ${name} pendant 30 secondes`,
    getBody: (name) => `
      <strong>Reculez d'environ 1 mètre pour filmer en continu.</strong><br><br>
      Cadrez l'ensemble du corps : la tête, les deux bras, le tronc, le bassin et les jambes. Restez stable pendant 30 secondes.
    `,
    getButtonText: (name) => `C'EST FAIT • CORPS ENTIER FILMÉ (30s) ➔`,
    getVoiceText: (name) => `Étape cinq. Cadrez tout le corps de ${name} pendant 30 secondes. Appuyez sur le gros bouton rouge pour ouvrir la caméra.`
  },
  {
    badge: 'Étape 6 / 8 • Filmage Médical',
    isCameraRequired: true,
    shortInstruction: 'Filmez le VISAGE de près (de face) pendant 30s',
    getTitle: (name) => `6. Filmez le VISAGE de près (de face si possible) pendant 30 secondes`,
    getBody: (name) => `
      <strong>Approchez l'objectif à 30-40 cm du visage de ${name}.</strong><br><br>
      Cadrez de face si possible : filmez les yeux, les paupières et la bouche de façon stable pendant 30 secondes.
    `,
    getButtonText: (name) => `C'EST FAIT • VISAGE FILMÉ DE PRÈS (30s) ➔`,
    getVoiceText: (name) => `Étape six. Approchez-vous et filmez le visage de près, de face si possible, pendant 30 secondes. Ouvrez la caméra.`
  },
  {
    badge: 'Étape 7 / 8 • Manœuvre Motrice',
    isCameraRequired: true,
    shortInstruction: 'Levez un bras et laissez-le retomber',
    getTitle: (name) => `7. Levez un bras de ${name} et laissez-le retomber`,
    getBody: (name) => `
      <strong>Tout en continuant de filmer :</strong><br><br>
      1. Prenez délicatement la main de ${name} et levez son avant-bras au-dessus de son visage.<br>
      2. <strong>Lâchez la main et laissez le bras retomber naturellement.</strong><br>
      3. Filmez simplement ce qui se passe.
    `,
    getButtonText: (name) => `MANŒUVRE EFFECTUÉE ET FILMÉE ➔`,
    getVoiceText: (name) => `Étape sept. Levez un bras de ${name} au-dessus de son visage et laissez-le retomber devant la caméra.`
  },
  {
    badge: 'Étape 8 / 8 • Réactivité & Clôture',
    isCameraRequired: true,
    shortInstruction: 'Appelez son nom 2x (si réponse : date et lieu)',
    getTitle: (name) => `8. Appelez ${name} 2 fois par son nom (si réponse : demandez la date et le lieu)`,
    getBody: (name) => `
      <strong>En continuant de filmer :</strong><br><br>
      1. Dites distinctement à deux reprises à voix normale :<br>
      <em>« ${name} ! ... ${name} ! »</em><br><br>
      2. <strong>Si ${name} répond ou réagit</strong>, posez-lui immédiatement ces 2 questions :<br>
      • <em>« Quel jour sommes-nous ? »</em><br>
      • <em>« Où sommes-nous actuellement ? »</em>
    `,
    getButtonText: (name) => `💾 TERMINER & SAUVEGARDER LA VIDÉO ➔`,
    getVoiceText: (name) => `Étape huit. Appelez ${name} deux fois par son nom. Si vous avez une réponse, demandez la date et le lieu. Validez pour terminer.`
  }
];

function renderWitnessCurrentStep() {
  const container = document.getElementById('witnessStepContainer');
  if (!container) return;

  const name = getPatientName();
  const step = WITNESS_STEPS_CONFIG[witnessCurrentStepIndex];
  const total = WITNESS_STEPS_CONFIG.length;

  const progressPercent = Math.round(((witnessCurrentStepIndex + 1) / total) * 100);
  const barFill = document.getElementById('witnessProgressFill');
  if (barFill) barFill.style.width = `${progressPercent}%`;

  const badgeElem = document.getElementById('witnessStepBadge');
  if (badgeElem) badgeElem.innerText = step.badge;

  let cameraActionBlock = '';
  if (step.isCameraRequired) {
    cameraActionBlock = `
      <div style="margin: 16px 0;">
        <button class="btn-witness-camera-cta" onclick="openFullScreenCameraForStep()">
          📹 OUVRIR LA CAMÉRA PLEIN ÉCRAN (JE LE FAIS) ➔
        </button>
        <button class="btn-witness-secondary" style="width: 100%; margin-top: 6px;" onclick="triggerNativeCameraCapture()">
          📱 Ou utiliser l'appareil photo du téléphone
        </button>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="witness-step-card">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
          <h2 class="witness-instruction-title" style="margin-bottom: 0; flex: 1;">${step.getTitle(name)}</h2>
          <button class="btn-witness-secondary" style="width: auto; padding: 6px 12px; font-size: 13px; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; flex-shrink: 0;" onclick="replayCurrentWitnessVoice()" title="Réécouter la consigne">
            🔊 Écouter
          </button>
        </div>
        <div class="witness-instruction-body">${step.getBody(name)}</div>
        ${cameraActionBlock}
      </div>

      <div style="margin-top: 14px;">
        <button class="btn-witness-confirm" onclick="advanceWitnessStep()">
          ${step.getButtonText(name)}
        </button>

        <div class="witness-nav-buttons">
          <button class="btn-witness-secondary" onclick="previousWitnessStep()" ${witnessCurrentStepIndex === 0 ? 'disabled' : ''}>
            ← Étape précédente
          </button>
          <button class="btn-witness-secondary" onclick="resetWitnessWizard()">
            🔄 Recommencer
          </button>
        </div>
      </div>
    </div>
  `;

  speakWitnessInstruction(step.getVoiceText(name));
}

function advanceWitnessStep() {
  triggerHaptic([60]);
  const total = WITNESS_STEPS_CONFIG.length;

  if (witnessCurrentStepIndex === total - 1) {
    finishWitnessSession();
  } else {
    witnessCurrentStepIndex++;
    renderWitnessCurrentStep();
  }
}

function previousWitnessStep() {
  if (witnessCurrentStepIndex > 0) {
    witnessCurrentStepIndex--;
    renderWitnessCurrentStep();
  }
}

function resetWitnessWizard() {
  if (confirm('Voulez-vous réinitialiser le guide témoin à la première étape ?')) {
    witnessCurrentStepIndex = 0;
    renderWitnessCurrentStep();
  }
}

async function finishWitnessSession() {
  closeFullScreenCameraOverlay();
  if ('speechSynthesis' in window) {
    speakWitnessInstruction("Protocole clinique terminé. Vidéo sauvegardée dans le journal local. Restez calmement auprès de la personne.");
  }
  updateContactDisplayElements();
  switchView('temoin-conclusion');
}

// =============================================================================
// 12. CAMÉRA PLEIN ÉCRAN
// =============================================================================
let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordStartTime = null;
let recordTimerInterval = null;
let currentFacingMode = 'environment';

async function openFullScreenCameraForStep() {
  const step = WITNESS_STEPS_CONFIG[witnessCurrentStepIndex];
  const pill = document.getElementById('fscInstructionPill');
  if (pill && step && step.shortInstruction) {
    pill.innerText = step.shortInstruction;
  }

  if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
    try {
      const constraints = {
        video: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      };
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoElem = document.getElementById('fscVideoPreview');
      if (videoElem) {
        videoElem.srcObject = mediaStream;
        videoElem.play();
      }
      document.getElementById('fullScreenCameraModal').classList.add('active');
      startFscRecording();
      return;
    } catch (err) {
      console.warn("getUserMedia indisponible, bascule sur caméra native", err);
    }
  }

  triggerNativeCameraCapture();
}

function closeFullScreenCameraOverlay() {
  stopFscRecording();
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  const videoElem = document.getElementById('fscVideoPreview');
  if (videoElem) videoElem.srcObject = null;
  document.getElementById('fullScreenCameraModal').classList.remove('active');
}

function finishCurrentStepAndAdvance() {
  closeFullScreenCameraOverlay();
  advanceWitnessStep();
}

function switchWitnessCameraFacing() {
  currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
  if (mediaStream) {
    closeFullScreenCameraOverlay();
    openFullScreenCameraForStep();
  }
}

function toggleFscRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopFscRecording();
  } else {
    startFscRecording();
  }
}

function startFscRecording() {
  if (!mediaStream || (mediaRecorder && mediaRecorder.state === 'recording')) return;
  recordedChunks = [];

  let options = { mimeType: 'video/webm;codecs=vp8,opus' };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    options = { mimeType: 'video/mp4' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) options = {};
  }

  try {
    mediaRecorder = new MediaRecorder(mediaStream, options);
  } catch (e) {
    mediaRecorder = new MediaRecorder(mediaStream);
  }

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) recordedChunks.push(event.data);
  };

  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/webm' });
    const durationText = document.getElementById('fscTimerBadge').innerText;
    clearInterval(recordTimerInterval);
    document.getElementById('fscTimerBadge').innerText = '● REC 00:00';
    try {
      await saveRecordedVideoBlob(blob, { duration: durationText });
    } catch (err) {
      console.error(err);
    }
  };

  mediaRecorder.start(1000);
  recordStartTime = Date.now();
  const btnRec = document.getElementById('btnFscRecord');
  if (btnRec) {
    btnRec.classList.add('recording');
    btnRec.innerText = '⏹️ Arrêter';
  }

  recordTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    const timerElem = document.getElementById('fscTimerBadge');
    if (timerElem) timerElem.innerText = `● REC ${mins}:${secs}`;
  }, 500);
}

function stopFscRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  const btnRec = document.getElementById('btnFscRecord');
  if (btnRec) {
    btnRec.classList.remove('recording');
    btnRec.innerText = '🔴 Enregistrer';
  }
}

function triggerNativeCameraCapture() {
  const fileInput = document.getElementById('nativeCameraInput');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

async function handleNativeCameraFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    await saveRecordedVideoBlob(file, { duration: 'Vidéo mobile' });
    triggerHaptic([80, 40, 80]);
    alert("✅ Vidéo enregistrée et conservée dans l'application !");
    advanceWitnessStep();
  } catch (err) {
    console.error(err);
    advanceWitnessStep();
  }
}

// =============================================================================
// 13. Journal de Bord Clinique, Épisodes CFD & Vidéos
// =============================================================================
let currentSelectedOutcome = true;

function openAddCfdModal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const localIso = `${year}-${month}-${day}T${hours}:${minutes}`;

  const dtInput = document.getElementById('inputCfdDateTime');
  if (dtInput) dtInput.value = localIso;

  selectCfdOutcome(true);

  document.querySelectorAll('#cfdTriggerTags .btn-tag').forEach(b => b.classList.remove('active'));

  const notesInput = document.getElementById('inputCfdNotes');
  if (notesInput) notesInput.value = '';

  const modal = document.getElementById('modalAddCfdEvent');
  if (modal) modal.classList.add('active');
}

function closeAddCfdModal() {
  const modal = document.getElementById('modalAddCfdEvent');
  if (modal) modal.classList.remove('active');
}

function selectCfdOutcome(isStopped) {
  currentSelectedOutcome = isStopped;
  const optStopped = document.getElementById('optCfdStopped');
  const optOccurred = document.getElementById('optCfdOccurred');
  if (isStopped) {
    if (optStopped) optStopped.className = 'cfd-outcome-option selected-stopped';
    if (optOccurred) optOccurred.className = 'cfd-outcome-option';
  } else {
    if (optStopped) optStopped.className = 'cfd-outcome-option';
    if (optOccurred) optOccurred.className = 'cfd-outcome-option selected-occurred';
  }
}

function toggleTriggerTag(button) {
  button.classList.toggle('active');
}

async function saveManualCfdEvent() {
  const dtInput = document.getElementById('inputCfdDateTime');
  const dateValue = dtInput && dtInput.value ? new Date(dtInput.value).toISOString() : new Date().toISOString();
  const notesInput = document.getElementById('inputCfdNotes');
  const notes = notesInput ? notesInput.value.trim() : '';

  const tags = [];
  document.querySelectorAll('#cfdTriggerTags .btn-tag.active').forEach(b => tags.push(b.innerText.trim()));

  const type = currentSelectedOutcome ? "CFD stoppée (Contrôle exécutif)" : "CFD survenue (Non stoppée)";

  const eventData = {
    date: dateValue,
    type: type,
    isStopped: currentSelectedOutcome,
    isCfdEpisode: true,
    tags: tags,
    notes: notes,
    videoId: null
  };

  try {
    await saveJournalEvent(eventData);
    closeAddCfdModal();
    triggerHaptic([60, 40, 60]);
  } catch (err) {
    console.error(err);
    alert("Erreur lors de l'enregistrement de l'événement.");
  }
}

function getAllJournalEvents() {
  return new Promise((resolve) => {
    if (!db) return resolve([]);
    const tx = db.transaction(['events'], 'readonly');
    const req = tx.objectStore('events').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

// =============================================================================
// 12. PÉRIODE & SYNTHÈSE CLINIQUE EXPORTABLE (A4 & TEXTE)
// =============================================================================
let currentExportPeriod = '30d';
let currentExportMonth = '';

function setExportPeriod(periodKey) {
  currentExportPeriod = periodKey;
  document.querySelectorAll('.btn-period-pill').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`btnPeriod${periodKey.charAt(0).toUpperCase() + periodKey.slice(1)}`);
  if (activeBtn) activeBtn.classList.add('active');

  const monthContainer = document.getElementById('exportMonthSelectorContainer');
  if (periodKey === 'month') {
    if (monthContainer) monthContainer.style.display = 'block';
    if (!currentExportMonth) {
      const now = new Date();
      currentExportMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthInput = document.getElementById('exportMonthInput');
      if (monthInput) monthInput.value = currentExportMonth;
    }
  } else {
    if (monthContainer) monthContainer.style.display = 'none';
  }
  updateExportModalPreview();
}

function onExportMonthChanged() {
  const monthInput = document.getElementById('exportMonthInput');
  if (monthInput && monthInput.value) {
    currentExportMonth = monthInput.value;
    updateExportModalPreview();
  }
}

function formatDDMMYY(d) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}${month}${year}`;
}

function formatFrenchDate(d) {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function computePeriodBounds(periodKey, allEvents) {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date(now);

  if (periodKey === '7d') {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  } else if (periodKey === '30d') {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  } else if (periodKey === 'month') {
    const parts = (currentExportMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`).split('-');
    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    startDate = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  } else if (periodKey === 'all') {
    if (allEvents && allEvents.length > 0) {
      const timestamps = allEvents.map(e => new Date(e.date).getTime()).filter(t => !isNaN(t));
      if (timestamps.length > 0) {
        startDate = new Date(Math.min(...timestamps));
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    } else {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    endDate.setHours(23, 59, 59, 999);
  }

  const startDDMMYY = formatDDMMYY(startDate);
  const endDDMMYY = formatDDMMYY(endDate);
  const label = `Du ${formatFrenchDate(startDate)} au ${formatFrenchDate(endDate)}`;

  return { startDate, endDate, startDDMMYY, endDDMMYY, label };
}

function calculateClinicalMetrics(events, startDate, endDate) {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  const periodEvents = events.filter(e => {
    const t = new Date(e.date).getTime();
    return t >= startTime && t <= endTime;
  });

  const cfdEpisodes = periodEvents.filter(e => e.isCfdEpisode || e.isStopped !== undefined);
  const stoppedEpisodes = periodEvents.filter(e => e.isStopped === true || (e.type && (e.type.includes('stoppée') || e.type.includes('interrompue'))));
  const occurredEpisodes = periodEvents.filter(e => e.isStopped === false || (e.type && e.type.includes('survenue')));
  const videosCount = periodEvents.filter(e => Boolean(e.videoId)).length;

  const stoppedRate = cfdEpisodes.length > 0 ? Math.round((stoppedEpisodes.length / cfdEpisodes.length) * 100) : (cfdEpisodes.length === 0 ? 100 : 0);

  // Calcul des jours sans crise sur la période
  const totalDays = Math.max(1, Math.round((endTime - startTime) / (24 * 60 * 60 * 1000)));
  const crisisDaysSet = new Set();
  occurredEpisodes.forEach(e => {
    const d = new Date(e.date);
    const dayKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    crisisDaysSet.add(dayKey);
  });
  const crisisDaysCount = crisisDaysSet.size;
  const crisisFreeDays = Math.max(0, totalDays - crisisDaysCount);
  const crisisFreeRate = Math.round((crisisFreeDays / totalDays) * 100);

  return {
    periodEvents,
    cfdEpisodes,
    stoppedEpisodes,
    occurredEpisodes,
    videosCount,
    stoppedRate,
    totalDays,
    crisisFreeDays,
    crisisFreeRate
  };
}

function getClinicalDocumentFileName(startDDMMYY, endDDMMYY) {
  const rawLast = getPatientLastName().trim() || 'Dufour';
  const rawFirst = getPatientFirstName().trim() || 'Christophe';
  const cleanLast = rawLast.replace(/[\s/\\?%*:|"<>]+/g, '_');
  const cleanFirst = rawFirst.replace(/[\s/\\?%*:|"<>]+/g, '_');
  return `${cleanLast}_${cleanFirst}_${startDDMMYY} au ${endDDMMYY}`;
}

async function updateExportModalPreview() {
  const allEvents = await getAllJournalEvents();
  const bounds = computePeriodBounds(currentExportPeriod, allEvents);
  const metrics = calculateClinicalMetrics(allEvents, bounds.startDate, bounds.endDate);

  const labelEl = document.getElementById('exportPeriodLabel');
  if (labelEl) labelEl.innerText = `Période sélectionnée : ${bounds.label}`;

  const stoppedRateEl = document.getElementById('exportMetricStoppedRate');
  if (stoppedRateEl) stoppedRateEl.innerText = `${metrics.stoppedRate}%`;

  const crisisFreeDaysEl = document.getElementById('exportMetricCrisisFreeDays');
  if (crisisFreeDaysEl) crisisFreeDaysEl.innerText = `${metrics.crisisFreeDays} / ${metrics.totalDays} j`;

  const totalEpisodesEl = document.getElementById('exportMetricTotalEpisodes');
  if (totalEpisodesEl) totalEpisodesEl.innerText = metrics.cfdEpisodes.length;

  const docTitleEl = document.getElementById('exportDocTitlePreview');
  const docTitle = getClinicalDocumentFileName(bounds.startDDMMYY, bounds.endDDMMYY);
  if (docTitleEl) docTitleEl.innerText = `${docTitle}.pdf`;

  const text = await generateJournalReportText(bounds.startDate, bounds.endDate);
  const pre = document.getElementById('exportReportPreview');
  if (pre) pre.innerText = text;
}

async function generateJournalReportText(optStartDate, optEndDate) {
  const events = await getAllJournalEvents();
  const bounds = (optStartDate && optEndDate)
    ? { startDate: optStartDate, endDate: optEndDate, label: `Du ${formatFrenchDate(optStartDate)} au ${formatFrenchDate(optEndDate)}` }
    : computePeriodBounds(currentExportPeriod, events);

  const metrics = calculateClinicalMetrics(events, bounds.startDate, bounds.endDate);
  const patientFullName = getPatientFullName();
  const now = new Date();
  const reportDateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const sorted = [...metrics.periodEvents].sort((a, b) => new Date(b.date) - new Date(a.date));

  let text = `=========================================\n`;
  text += `RELEVÉ CLINIQUE DE SUIVI • PROTOCOLE ANTI-CFD\n`;
  text += `Dr Christophe Dufour • Médecine & Neurosciences\n`;
  text += `=========================================\n\n`;
  text += `Patient : ${patientFullName}\n`;
  text += `Période analysée : ${bounds.label}\n`;
  text += `Date d'édition : ${reportDateStr}\n\n`;

  text += `-----------------------------------------\n`;
  text += `SYNTHÈSE STATISTIQUE SUR LA PÉRIODE\n`;
  text += `-----------------------------------------\n`;
  text += `• Épisodes CFD consignés : ${metrics.cfdEpisodes.length}\n`;
  text += `  - Crises stoppées / évitées : ${metrics.stoppedEpisodes.length} (${metrics.stoppedRate}%)\n`;
  text += `  - Crises survenues : ${metrics.occurredEpisodes.length}\n`;
  text += `• Jours sans crise sur la période : ${metrics.crisisFreeDays} / ${metrics.totalDays} jours (${metrics.crisisFreeRate}%)\n`;
  text += `• Vidéos enregistrées sur l'appareil : ${metrics.videosCount}\n`;
  text += `  (Nota : les vidéos sont conservées sur le téléphone du patient pour analyse en direct en consultation)\n\n`;

  text += `-----------------------------------------\n`;
  text += `CHRONOLOGIE DÉTAILLÉE DU JOURNAL\n`;
  text += `-----------------------------------------\n`;

  if (sorted.length === 0) {
    text += `Aucun événement consigné sur cette période.\n`;
  } else {
    sorted.forEach((ev, idx) => {
      const d = new Date(ev.date);
      const dStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      let statusStr = 'Événement';
      if (ev.isStopped === true || (ev.type && (ev.type.includes('stoppée') || ev.type.includes('interrompue')))) {
        statusStr = '✅ CFD Stoppée / Évitée';
      } else if (ev.isStopped === false || (ev.type && ev.type.includes('survenue'))) {
        statusStr = '⚠️ CFD Survenue (Non stoppée)';
      }
      text += `[${idx + 1}] ${dStr} — ${statusStr}\n`;
      if (ev.tags && ev.tags.length > 0) {
        text += `    • Déclencheurs : ${ev.tags.join(', ')}\n`;
      }
      if (ev.notes) {
        text += `    • Observations : ${ev.notes}\n`;
      }
      if (ev.videoId) {
        text += `    • Vidéo : 1 enregistrement conservé localement sur le téléphone\n`;
      }
      text += `\n`;
    });
  }

  text += `=========================================\n`;
  text += `Document généré depuis l'application Anti-CFD\n`;
  return text;
}

async function openExportModal() {
  await updateExportModalPreview();
  const modal = document.getElementById('modalExportJournal');
  if (modal) modal.classList.add('active');
}

function closeExportModal() {
  const modal = document.getElementById('modalExportJournal');
  if (modal) modal.classList.remove('active');
}

async function printClinicalReportA4() {
  const allEvents = await getAllJournalEvents();
  const bounds = computePeriodBounds(currentExportPeriod, allEvents);
  const metrics = calculateClinicalMetrics(allEvents, bounds.startDate, bounds.endDate);

  const docTitle = getClinicalDocumentFileName(bounds.startDDMMYY, bounds.endDDMMYY);
  const prevTitle = document.title;
  document.title = docTitle;

  const container = document.getElementById('printClinicalReportContainer');
  if (!container) return;

  const patientFullName = getPatientFullName();
  const now = new Date();
  const printDateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Tri antichronologique ou chronologique : chronologique pour lecture clinique
  const sortedEpisodes = [...metrics.periodEvents].sort((a, b) => new Date(a.date) - new Date(b.date));

  let rowsHtml = '';
  if (sortedEpisodes.length === 0) {
    rowsHtml = `<tr><td colspan="5" style="text-align: center; padding: 18px; color: #64748B;">Aucun événement consigné sur cette période (${bounds.label}).</td></tr>`;
  } else {
    sortedEpisodes.forEach((ev) => {
      const d = new Date(ev.date);
      const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

      let outcomeLabel = 'Événement';
      let outcomeClass = '';
      if (ev.isStopped === true || (ev.type && (ev.type.includes('stoppée') || ev.type.includes('interrompue')))) {
        outcomeLabel = '✅ Bloquée / Stoppée';
        outcomeClass = 'print-badge-stopped';
      } else if (ev.isStopped === false || (ev.type && ev.type.includes('survenue'))) {
        outcomeLabel = '⚠️ Survenue (Non stoppée)';
        outcomeClass = 'print-badge-occurred';
      } else if (ev.videoId) {
        outcomeLabel = '📹 Vidéo Seule';
      }

      const triggers = (ev.tags && ev.tags.length > 0) ? ev.tags.join(', ') : '—';
      const videoStatus = ev.videoId ? '📹 Oui (sur smartphone)' : 'Non';
      const notes = ev.notes ? ev.notes : '—';

      rowsHtml += `
        <tr>
          <td style="white-space: nowrap; font-weight: 600;">${dateStr}</td>
          <td class="${outcomeClass}" style="font-weight: 700;">${outcomeLabel}</td>
          <td>${triggers}</td>
          <td style="white-space: nowrap;">${videoStatus}</td>
          <td>${notes}</td>
        </tr>
      `;
    });
  }

  container.innerHTML = `
    <div class="print-header">
      <div>
        <h1 class="print-title">Relevé Clinique • Protocole Anti-CFD</h1>
        <p class="print-subtitle">Neurosciences Cliniques & Réengagement Exécutif • Dr Christophe Dufour</p>
      </div>
      <div style="text-align: right; font-size: 8.5pt; color: #475569;">
        Document confidentiel médical<br>Édité le ${printDateStr}
      </div>
    </div>

    <div class="print-meta-grid">
      <div class="print-meta-item">
        <strong>Patient :</strong> ${patientFullName}
      </div>
      <div class="print-meta-item">
        <strong>Période analysée :</strong> ${bounds.label}
      </div>
    </div>

    <div class="print-gauges-grid">
      <div class="print-gauge-card highlight">
        <div class="print-gauge-value">${metrics.stoppedRate}%</div>
        <div class="print-gauge-label">Crises stoppées / évitées</div>
        <div class="print-bar-container">
          <div class="print-bar-fill" style="width: ${metrics.stoppedRate}%;"></div>
        </div>
        <div style="font-size: 8pt; color: #475569; margin-top: 4px;">
          ${metrics.stoppedEpisodes.length} bloquée(s) sur ${metrics.cfdEpisodes.length} épisode(s)
        </div>
      </div>

      <div class="print-gauge-card">
        <div class="print-gauge-value">${metrics.crisisFreeDays} / ${metrics.totalDays}</div>
        <div class="print-gauge-label">Jours sans crise (${metrics.crisisFreeRate}%)</div>
        <div class="print-bar-container">
          <div class="print-bar-fill" style="width: ${metrics.crisisFreeRate}%; background: #0284C7;"></div>
        </div>
        <div style="font-size: 8pt; color: #475569; margin-top: 4px;">
          Sur l'ensemble de la période
        </div>
      </div>

      <div class="print-gauge-card">
        <div class="print-gauge-value">${metrics.videosCount}</div>
        <div class="print-gauge-label">Vidéos documentées</div>
        <div style="font-size: 8pt; color: #64748B; margin-top: 8px;">
          Conservées sur le smartphone du patient pour consultation
        </div>
      </div>
    </div>

    <h2 style="font-size: 11pt; text-transform: uppercase; margin: 16px 0 6px 0; color: #0F172A; border-bottom: 1px solid #CBD5E1; padding-bottom: 4px;">
      Chronologie détaillée des épisodes
    </h2>

    <table class="print-table">
      <thead>
        <tr>
          <th style="width: 18%;">Date & Heure</th>
          <th style="width: 22%;">Issue clinique</th>
          <th style="width: 20%;">Déclencheurs</th>
          <th style="width: 15%;">Vidéo</th>
          <th style="width: 25%;">Notes & Observations</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="print-footer">
      <span>Application Anti-CFD • Réengagement des Réseaux Attentionnels et Exécutifs</span>
      <span>Titre du document : ${docTitle}.pdf</span>
    </div>
  `;

  // Déclencher l'impression native du navigateur
  window.print();

  // Restaurer le titre d'origine
  setTimeout(() => {
    document.title = prevTitle;
  }, 2500);
}

async function shareJournalReport() {
  const allEvents = await getAllJournalEvents();
  const bounds = computePeriodBounds(currentExportPeriod, allEvents);
  const reportText = await generateJournalReportText(bounds.startDate, bounds.endDate);
  const title = `Relevé Clinique CFD - ${getPatientFullName()}`;
  if (navigator.share) {
    try {
      await navigator.share({
        title: title,
        text: reportText
      });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const mailUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(reportText)}`;
  window.location.href = mailUrl;
}

async function copyJournalReportToClipboard() {
  const allEvents = await getAllJournalEvents();
  const bounds = computePeriodBounds(currentExportPeriod, allEvents);
  const reportText = await generateJournalReportText(bounds.startDate, bounds.endDate);
  try {
    await navigator.clipboard.writeText(reportText);
    alert("✅ Rapport copié dans le presse-papier !");
  } catch (e) {
    prompt("Copiez le texte ci-dessous :", reportText);
  }
}

async function downloadJournalReportTxt() {
  const allEvents = await getAllJournalEvents();
  const bounds = computePeriodBounds(currentExportPeriod, allEvents);
  const reportText = await generateJournalReportText(bounds.startDate, bounds.endDate);
  const docTitle = getClinicalDocumentFileName(bounds.startDDMMYY, bounds.endDDMMYY);
  const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${docTitle}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// =============================================================================
// 13. GESTION DU JOURNAL & FILTRES RAPIDES
// =============================================================================
let currentJournalFilter = 'all';

function setJournalFilter(filterKey) {
  if (currentJournalFilter === filterKey) {
    // Si on reclique sur le filtre actif, on le décoche (retour à l'état par défaut : tout afficher)
    currentJournalFilter = 'all';
    document.querySelectorAll('.btn-filter-pill').forEach(btn => btn.classList.remove('active'));
  } else {
    currentJournalFilter = filterKey;
    document.querySelectorAll('.btn-filter-pill').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btnFilter${filterKey.charAt(0).toUpperCase() + filterKey.slice(1)}`);
    if (activeBtn) activeBtn.classList.add('active');
  }
  loadJournalEntries();
}

async function loadJournalEntries() {
  const container = document.getElementById('journalEntriesList');
  if (!container || !db) return;

  const events = await getAllJournalEvents();
  events.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Statistiques globales
  const totalEpisodesEl = document.getElementById('statTotalEpisodes');
  const stoppedPercentEl = document.getElementById('statStoppedPercent');
  const totalVideosEl = document.getElementById('statTotalVideos');

  const cfdEpisodes = events.filter(e => e.isCfdEpisode || e.isStopped !== undefined);
  const stoppedEpisodes = events.filter(e => e.isStopped === true || (e.type && (e.type.includes('stoppée') || e.type.includes('interrompue'))));
  const occurredEpisodes = events.filter(e => e.isStopped === false || (e.type && e.type.includes('survenue')));
  const videosEpisodes = events.filter(e => Boolean(e.videoId));
  const stoppedRate = cfdEpisodes.length > 0 ? Math.round((stoppedEpisodes.length / cfdEpisodes.length) * 100) : 0;

  if (totalEpisodesEl) totalEpisodesEl.innerText = cfdEpisodes.length;
  if (stoppedPercentEl) stoppedPercentEl.innerText = `${stoppedRate}%`;
  if (totalVideosEl) totalVideosEl.innerText = videosEpisodes.length;

  // Mise à jour des compteurs des 3 filtres
  const cStopped = document.getElementById('countFilterStopped');
  const cOccurred = document.getElementById('countFilterOccurred');
  const cVideo = document.getElementById('countFilterVideo');
  if (cStopped) cStopped.innerText = stoppedEpisodes.length;
  if (cOccurred) cOccurred.innerText = occurredEpisodes.length;
  if (cVideo) cVideo.innerText = videosEpisodes.length;

  if (events.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; color: var(--text-muted); padding: 32px 16px; background-color: var(--bg-card-subtle);">
        <span style="font-size: 32px; display: block; margin-bottom: 8px;">📋</span>
        <p style="margin: 0; font-weight: 600;">Aucun événement noté pour l'instant.</p>
        <p style="font-size: 13px; margin-top: 4px;">Touchez « ➕ Noter un épisode CFD » ci-dessus pour consigner votre premier épisode.</p>
      </div>
    `;
    return;
  }

  // Filtrage selon la sélection active
  let displayedEvents = events;
  if (currentJournalFilter === 'stopped') {
    displayedEvents = stoppedEpisodes;
  } else if (currentJournalFilter === 'occurred') {
    displayedEvents = occurredEpisodes;
  } else if (currentJournalFilter === 'video') {
    displayedEvents = videosEpisodes;
  }

  if (displayedEvents.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; color: var(--text-muted); padding: 24px 16px; background-color: var(--bg-card-subtle);">
        <p style="margin: 0; font-weight: 600;">Aucun événement dans cette catégorie.</p>
      </div>
    `;
    return;
  }

  let html = '';
  for (const ev of displayedEvents) {
    const d = new Date(ev.date);
    const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    let cardClass = 'journal-entry-card';
    let badgeHtml = '';

    if (ev.isStopped === true || (ev.type && (ev.type.includes('stoppée') || ev.type.includes('interrompue')))) {
      cardClass += ' stopped';
      badgeHtml = `<span style="font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 9999px; background: var(--color-sn-bg); color: var(--color-sn);">✅ CFD Stoppée</span>`;
    } else if (ev.isStopped === false || (ev.type && ev.type.includes('survenue'))) {
      cardClass += ' occurred';
      badgeHtml = `<span style="font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 9999px; background: var(--color-aura-bg); color: var(--color-aura);">⚠️ CFD Survenue</span>`;
    } else if (ev.videoId) {
      cardClass += ' video-only';
      badgeHtml = `<span style="font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 9999px; background: var(--color-cen-bg); color: var(--color-cen);">📹 Vidéo Clinique</span>`;
    } else {
      badgeHtml = `<span style="font-size: 11.5px; padding: 3px 10px; border-radius: 9999px; background: var(--bg-card-subtle); color: var(--text-muted);">${ev.type || 'Événement'}</span>`;
    }

    let tagsHtml = '';
    if (ev.tags && ev.tags.length > 0) {
      tagsHtml = `<div class="journal-entry-tags">` +
        ev.tags.map(t => `<span class="journal-entry-tag-chip">⚡ ${t}</span>`).join('') +
        `</div>`;
    }

    let videoBlock = '';
    if (ev.videoId) {
      try {
        const videoRecord = await getVideoById(ev.videoId);
        if (videoRecord && videoRecord.blob) {
          const videoUrl = URL.createObjectURL(videoRecord.blob);
          videoBlock = `
            <div class="journal-video-container">
              <video src="${videoUrl}" controls playsinline preload="metadata" style="width: 100%; max-height: 220px; display: block;"></video>
            </div>
            <div class="journal-video-actions">
              <button class="btn-primary" onclick="shareVideoById(${ev.videoId})">
                📤 Partager cette vidéo
              </button>
              <button class="btn-secondary" onclick="downloadVideoById(${ev.videoId})">
                📥 Télécharger
              </button>
            </div>
          `;
        }
      } catch (e) {}
    }

    html += `
      <div class="${cardClass}">
        <div class="journal-entry-header">
          <span class="journal-entry-date">${dateStr}</span>
          ${badgeHtml}
        </div>
        ${tagsHtml}
        ${ev.notes ? `<p class="journal-entry-notes">${ev.notes}</p>` : ''}
        ${videoBlock}
        <div style="text-align: right; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 8px;">
          <button class="btn-secondary" style="font-size: 11px; padding: 4px 8px; color: #DC2626; border-color: rgba(220, 38, 38, 0.3);" onclick="deleteJournalEntry(${ev.id}, ${ev.videoId || 'null'})">
            🗑️ Supprimer
          </button>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
}

async function downloadVideoById(videoId) {
  try {
    const rec = await getVideoById(videoId);
    if (rec && rec.blob) {
      const ext = rec.blob.type && rec.blob.type.includes('mp4') ? 'mp4' : 'webm';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(rec.blob);
      a.download = `video_clinique_${getPatientName()}_${videoId}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (err) {
    alert('Impossible de télécharger la vidéo');
  }
}

// =============================================================================
// 14. Thème Sombre / Clair
// =============================================================================
function toggleAppTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  const btn = document.getElementById('btnThemeToggle');
  if (btn) btn.innerText = next === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('anti_cfd_theme', next);
}

(function applySavedTheme() {
  const saved = localStorage.getItem('anti_cfd_theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('btnThemeToggle');
    if (btn) btn.innerText = saved === 'dark' ? '☀️' : '🌙';
  }
})();
