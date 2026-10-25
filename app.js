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
// 2. Synthèse Vocale pour Consignes Témoin
// =============================================================================
let isVoiceEnabled = true;

function toggleWitnessVoice() {
  isVoiceEnabled = !isVoiceEnabled;
  const btn = document.getElementById('btnWitnessVoiceToggle');
  if (btn) {
    if (isVoiceEnabled) {
      btn.classList.add('active');
      btn.innerText = '🔊 Consignes Vocales : ON';
      speakWitnessInstruction("Consignes vocales activées.");
    } else {
      btn.classList.remove('active');
      btn.innerText = '🔇 Consignes Vocales : OFF';
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }
  }
  localStorage.setItem('anti_cfd_voice_enabled', isVoiceEnabled ? '1' : '0');
}

function speakWitnessInstruction(text) {
  if (!isVoiceEnabled || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Synthèse vocale indisponible', e);
  }
}

// =============================================================================
// 3. Gestion du Patient & de la Personne Ressource
// =============================================================================
function getPatientName() {
  return localStorage.getItem('anti_cfd_patient_name') || 'Christophe';
}

function getResourceContact() {
  return {
    name: localStorage.getItem('anti_cfd_contact_name') || 'Personne ressource',
    phone: localStorage.getItem('anti_cfd_contact_phone') || '0600000000'
  };
}

function updateContactDisplayElements() {
  const name = getPatientName();
  document.querySelectorAll('.patient-name-display').forEach(el => el.innerText = name);

  const contact = getResourceContact();
  const labelContact = document.getElementById('labelContactName');
  if (labelContact) labelContact.innerText = `${contact.name} (${contact.phone})`;

  const btnCall = document.getElementById('btnCallResourceContact');
  if (btnCall) btnCall.href = `tel:${contact.phone.replace(/\s+/g, '')}`;

  const inPat = document.getElementById('inputSettingPatientName');
  if (inPat) inPat.value = name;
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
  const pat = document.getElementById('inputSettingPatientName').value.trim();
  const cName = document.getElementById('inputSettingContactName').value.trim();
  const cPhone = document.getElementById('inputSettingContactPhone').value.trim();

  if (pat) localStorage.setItem('anti_cfd_patient_name', pat);
  if (cName) localStorage.setItem('anti_cfd_contact_name', cName);
  if (cPhone) localStorage.setItem('anti_cfd_contact_phone', cPhone);

  updateContactDisplayElements();
  closeSettingsModal();
  alert('Paramètres enregistrés avec succès !');
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
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function openAuraHub() {
  switchView('aura');
}

function startWitnessWizard() {
  witnessCurrentStepIndex = 0;
  switchView('temoin');
}

function restartWitnessFilming() {
  witnessCurrentStepIndex = 4;
  switchView('temoin');
}

function finishCognitiveTask() {
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
    playSound('correct');
  } else {
    if (errorMsg) errorMsg.classList.remove('hidden');
    pinInput.value = '';
    pinInput.focus();
    playSound('wrong');
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

function openQrModal() {
  const modal = document.getElementById('qrModal');
  if (modal) modal.classList.add('active');
}

function closeQrModal() {
  const modal = document.getElementById('qrModal');
  if (modal) modal.classList.remove('active');
}

function copyShareLink() {
  const url = 'https://chrisdufour-wq.github.io/brain-exercices/?cle=2527';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      alert('✅ Lien copié dans le presse-papier !');
    }).catch(() => {
      prompt('Copiez ce lien :', url);
    });
  } else {
    prompt('Copiez ce lien :', url);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initAccessGate();
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

  const urlParams = new URLSearchParams(window.location.search);
  const requestedView = urlParams.get('view');
  if (requestedView) switchView(requestedView);

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
    image: "illustrations/01_lapin_et_pistolet.jpg",
    desc1: "Main gauche : Le Lapin (Index et majeur dressés)",
    desc2: "Main droite : Le Pistolet (Pouce levé, index pointé)",
    swapTip: "Au bip/vibration : la main gauche devient le pistolet, la droite devient le lapin !"
  },
  {
    title: "Le Décompte et le Viseur",
    target: "Tâche séquentielle 5-1 vs maintien isométrique de visée.",
    image: "illustrations/02_decompte_et_viseur.jpg",
    desc1: "Main gauche : Viseur fixe (index et pouce en cercle)",
    desc2: "Main droite : Décompte digital (5, 4, 3, 2, 1)",
    swapTip: "Au swap : la main droite se fige en viseur, la gauche reprend le décompte !"
  },
  {
    title: "Cercle et Carré Graphomoteur",
    target: "Tracé continu fluide curviligne vs tracé segmenté orthogonal.",
    image: "illustrations/03_cercle_et_carre.jpg",
    desc1: "Main gauche : Trace un cercle continu dans l'air",
    desc2: "Main droite : Trace un carré avec 4 arrêts nets",
    swapTip: "Permutez les formes au signal !"
  },
  {
    title: "Pistolet vers le Ciel",
    target: "Dissociation du pouce vs index vertical pur.",
    image: "illustrations/04_pistolet_ciel.jpg",
    desc1: "Main gauche : Index dressé pur (pouce replié)",
    desc2: "Main droite : L parfait (index vertical + pouce horizontal)",
    swapTip: "Inhibez le réflexe de déplier le pouce des deux côtés !"
  },
  {
    title: "Index et Auriculaire",
    target: "Dissociation des rayons 2 et 5 (médian vs ulnaire).",
    image: "illustrations/05_index_et_auriculaire.jpg",
    desc1: "Main gauche : Seul l'index est levé",
    desc2: "Main droite : Seul l'auriculaire est levé",
    swapTip: "Exercice distal d'urgence idéal, réalisable discrètement."
  },
  {
    title: "Doigts Fléchis Croisés",
    target: "Flexion isolée du pouce vs flexion de l'auriculaire.",
    image: "illustrations/06_doigts_flechis_croises.jpg",
    desc1: "Main gauche : Pouce plié sur la paume",
    desc2: "Main droite : Auriculaire plié sur la paume",
    swapTip: "Conservez les autres doigts parfaitement droits !"
  },
  {
    title: "Trajectoires Spatiales Croisées",
    target: "Mouvement 1D oscillatoire vs trajectoire 2D rectangulaire.",
    image: "illustrations/07_trajectoires_spatiales.jpg",
    desc1: "Main gauche : Oscillation verticale de haut en bas",
    desc2: "Main droite : Parcours horizontal et vertical formant un rectangle",
    swapTip: "Sature l'attention visuo-spatiale !"
  }
];

function startSwapTask() {
  pickRandomExercise();
  switchView('swap-task');
}

function pickRandomExercise() {
  const randIdx = Math.floor(Math.random() * EXERCISES_DATA.length);
  const ex = EXERCISES_DATA[randIdx];
  document.getElementById('exTitle').innerText = ex.title;
  document.getElementById('exTarget').innerText = ex.target;
  document.getElementById('exImage').src = ex.image;
  document.getElementById('exDesc1').innerText = ex.desc1;
  document.getElementById('exDesc2').innerText = ex.desc2;
  document.getElementById('exSwapTip').innerText = ex.swapTip;
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

  if (pillarType === 'sommeil') {
    title.innerText = '🛏️ Sommeil de Qualité & TCC-I';
    content.innerHTML = `
      <div style="font-size: 14.5px; line-height: 1.6; color: var(--text-secondary);">
        <p><strong>1. Le lit est réservé exclusivement au sommeil :</strong> Ne travaillez pas, ne regardez pas d'écran et ne ruminez pas au lit.</p>
        <p><strong>2. Fuyez la lumière bleue 1h avant de dormir :</strong> Éteignez téléphones, tablettes et ordinateurs pour libérer la mélatonine naturelle.</p>
        
        <div style="background-color: var(--bg-card-subtle); border-radius: 12px; padding: 16px; margin: 16px 0;">
          <h4 style="color: var(--color-sn); margin-bottom: 6px;">⏱️ La Règle des 20 Minutes :</h4>
          <p style="margin-bottom: 12px;">Si le sommeil ne vient pas après 20 minutes, <strong>levez-vous</strong>. Allez dans une pièce sombre, faites une activité calme et ne retournez au lit que lorsque la somnolence réapparaît.</p>
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-family: var(--font-mono); font-size: 26px; font-weight: 800; color: var(--color-sn);" id="sleepTimerDisplay">20:00</span>
            <button class="btn-primary" id="btnToggleSleepTimer" style="width: auto; padding: 8px 16px;" onclick="toggleSleepTimer()">
              ▶️ Lancer Minuteur
            </button>
          </div>
        </div>
      </div>
    `;
  } else if (pillarType === 'respiration') {
    title.innerText = '🫁 Technique Respiratoire Apaisante';
    content.innerHTML = `
      <div style="font-size: 14.5px; line-height: 1.6; color: var(--text-secondary);">
        <p>Face au stress, <strong>ne cherchez pas à vous remplir d'air</strong> (risque d'hyperventilation). Relâchez le système nerveux en deux temps :</p>
        <div style="background-color: var(--color-sn-bg); border-radius: 12px; padding: 14px; margin: 14px 0; color: var(--text-primary);">
          <strong>1. Bouche entrouverte :</strong> Laissez passivement l'air s'échapper à son rythme sans forcer. Sentez la décrispation thoracique.<br><br>
          <strong>2. Par le nez (bouche fermée) :</strong> Petite inspiration douce et naturelle sans ouvrir la bouche.
        </div>
        <div class="respiration-container" style="padding: 16px 0;">
          <div class="resp-circle" id="respCircle">
            <span class="resp-label" id="respLabel">Prêt</span>
            <span class="resp-sub" id="respSub">Appuyez ci-dessous</span>
          </div>
        </div>
        <button class="btn-primary" id="btnToggleResp" onclick="toggleRespiration()">
          ▶️ Démarrer le guidage respiratoire
        </button>
      </div>
    `;
  } else if (pillarType === 'hypotension') {
    title.innerText = '💧 Hypotension, Sel & Volémie Cérébrale';
    content.innerHTML = `
      <div style="font-size: 14.5px; line-height: 1.6; color: var(--text-secondary);">
        <p>Une chute de pression artérielle diminue l'oxygénation du cortex et désorganise le réseau exécutif :</p>
        <ul style="margin: 10px 0 16px 18px; line-height: 1.7;">
          <li><strong>Boire 2 à 3 Litres d'eau / jour :</strong> Gardez une gourde toujours visible pour maintenir la volémie.</li>
          <li><strong>Manger davantage salé :</strong> Salez vos plats, consommez des bouillons ou des eaux riches en sodium pour retenir l'eau dans les artères (sauf avis médical contraire).</li>
          <li><strong>Lever en 3 temps :</strong> Restez assis au bord du lit 1 minute avant de vous lever.</li>
        </ul>
        <h4 style="color: var(--text-primary); margin-bottom: 6px;">Manœuvres Physiques de Contre-Pression (En cas de vertige) :</h4>
        <div style="background-color: #FEF3C7; border: 1px solid #F59E0B; border-radius: 10px; padding: 12px; color: #92400E; font-size: 13.5px;">
          • <strong>Leg Crossing :</strong> Croisez les jambes fermement et contractez puissamment les cuisses et les fessiers.<br>
          • <strong>Pompe des mollets :</strong> Montez 15 fois sur la pointe des pieds.<br>
          • <strong>Accroupissement :</strong> Accroupissez-vous immédiatement si la tête tourne.
        </div>
      </div>
    `;
  } else if (pillarType === 'sport') {
    title.innerText = '🏃 Activité Physique Régulière & Pacing';
    content.innerHTML = `
      <div style="font-size: 14.5px; line-height: 1.6; color: var(--text-secondary);">
        <p>L'exercice physique régulier stabilise le système nerveux autonome et élève le seuil de déclenchement des auras :</p>
        <div style="background-color: var(--bg-card-subtle); border-radius: 12px; padding: 14px; margin: 12px 0;">
          <h4 style="color: var(--color-sn); margin-bottom: 4px;">🌲 1. La Marche dans la Nature</h4>
          <p style="font-size: 13.5px; margin: 0;">Stimule la motricité bilatérale alternée, offre une immersion visuo-spatiale apaisante et réduit significativement l'hyperactivité du réseau par défaut (DMN).</p>
        </div>
        <div style="background-color: var(--bg-card-subtle); border-radius: 12px; padding: 14px; margin: 12px 0;">
          <h4 style="color: var(--color-cen); margin-bottom: 4px;">🏊 2. La Natation</h4>
          <p style="font-size: 13.5px; margin: 0;">Excellente régulation cardiovasculaire en décharge articulaire complète, particulièrement adaptée en cas de fragilité orthostatique (la pression hydrostatique de l'eau favorise le retour veineux cérébral).</p>
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
        <h2 class="witness-instruction-title">${step.getTitle(name)}</h2>
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
// 13. Journal de Bord & Vidéos
// =============================================================================
async function loadJournalEntries() {
  const container = document.getElementById('journalEntriesList');
  if (!container || !db) return;

  const tx = db.transaction(['events'], 'readonly');
  const store = tx.objectStore('events');
  const req = store.getAll();

  req.onsuccess = async () => {
    const events = req.result.reverse();
    if (events.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; color: var(--text-muted); padding: 24px 16px;">
          <p>Aucun événement enregistré pour l'instant.</p>
        </div>
      `;
      return;
    }

    let html = '';
    for (const ev of events) {
      const d = new Date(ev.date);
      const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      
      let videoBlock = '';
      if (ev.videoId) {
        try {
          const videoRecord = await getVideoById(ev.videoId);
          if (videoRecord && videoRecord.blob) {
            const videoUrl = URL.createObjectURL(videoRecord.blob);
            videoBlock = `
              <div style="margin-top: 10px; border-radius: 8px; overflow: hidden; background: #000;">
                <video src="${videoUrl}" controls playsinline preload="metadata" style="width: 100%; max-height: 220px; display: block;"></video>
              </div>
              <div style="margin-top: 8px;">
                <button class="btn-secondary" style="font-size: 12.5px; padding: 6px 10px;" onclick="downloadVideoById(${ev.videoId})">
                  📥 Télécharger la vidéo
                </button>
              </div>
            `;
          }
        } catch (e) {}
      }

      html += `
        <div style="background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong style="font-size: 14px;">${dateStr}</strong>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 9999px; background: var(--bg-card-subtle);">${ev.type || 'Événement'}</span>
          </div>
          <p style="font-size: 13.5px; margin-bottom: 6px; color: var(--text-secondary);">${ev.notes || ''}</p>
          ${videoBlock}
          <div style="text-align: right; margin-top: 8px;">
            <button class="btn-secondary" style="font-size: 11px; padding: 4px 8px; color: #DC2626;" onclick="deleteJournalEntry(${ev.id}, ${ev.videoId || 'null'})">
              Supprimer
            </button>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  };
}

async function downloadVideoById(videoId) {
  try {
    const rec = await getVideoById(videoId);
    if (rec && rec.blob) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(rec.blob);
      a.download = `video_clinique_${getPatientName()}_${videoId}.webm`;
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
