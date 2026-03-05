// Estado de la aplicaciÃ³n
const state = {
  user: null,
  tasks: [],
  objetivos: [],
  gym: {},
  gymWorkouts: [],
  notes: [],
  currentView: 'dashboard',
  calMonth: new Date().getMonth(),
  calYear: new Date().getFullYear(),
  theme: localStorage.getItem('theme') || 'dark',
  timerRunning: false,
  timerSeconds: 1500,
  currentStreak: 0,
  currentWorkoutDay: null,
  // CronÃ³metro state
  cronometro: {
    isRunning: false,
    timeLeft: 60,
    totalTime: 60,
    interval: null
  },
  // Mis Datos
  misDatos: {
    nombre: '',
    edad: '',
    genero: '',
    fechaNacimiento: '',
    altura: '',
    peso: '',
    objetivo: '',
    nivelActividad: '',
    // InformaciÃ³n avanzada
    grasaCorporal: '',
    masaMuscular: '',
    grasaVisceral: '',
    aguaCorporal: '',
    masaOsea: '',
    metabolismoBasal: '',
    // PerÃ­metros
    perimetroPecho: '',
    perimetroCintura: '',
    perimetroCadera: '',
    perimetroMuslo: '',
    perimetroBrazo: '',
    perimetroAntebrazo: '',
    perimetroPantorrilla: '',
    perimetroCuello: ''
  },
  // Progreso
  progresos: []
};

const GYM_FOCUS = { pecho: 'Pecho', espalda: 'Espalda', piernas: 'Piernas', hombros: 'Hombros', brazos: 'Brazos', core: 'Core', full: 'Full body', cardio: 'Cardio', otro: 'Otro' };
const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DAY_LABELS = { lunes: 'Lun', martes: 'Mar', miercoles: 'MiÃ©', jueves: 'Jue', viernes: 'Vie', sabado: 'SÃ¡b', domingo: 'Dom' };
const CATEGORIAS = { trabajo: 'Trabajo', personal: 'Personal', estudio: 'Estudio', salud: 'Salud', otros: 'Otros' };
const PRIORIDADES = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const API_BASE_URL = 'https://play.greathost.es:20057/api';
const AUTH_API_BASE = `${API_BASE_URL}/auth`;
const DATA_API_BASE = `${API_BASE_URL}/data`;
const PUSH_API_BASE = `${API_BASE_URL}/push`;
const DEFAULT_VAPID_PUBLIC_KEY = 'BLvNH9ghmTqg5q4ekqiI7gxFIGCXGKBF4ywl8bHM5a3DOhy6SO5x5wJ8_r5jLxRXOPFWRxVZ1O4qckF7U1jLrNA';
const PUSH_VAPID_STORAGE_KEY = 'push_vapid_public_key';
const AUTH_USERNAME_STORAGE_KEY = 'auth_username';
const AUTH_EMAIL_STORAGE_KEY = 'auth_email';

let swRegistration = null;
let deferredInstallPrompt = null;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authDebugPanel = document.getElementById('auth-debug-panel');
const authDebugLog = document.getElementById('auth-debug-log');
const logoutBtn = document.getElementById('logout-btn');
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const cancelTaskBtn = document.getElementById('cancel-task-btn');

// Helpers
function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function today() { return formatDate(new Date()); }
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function getWeekDates(startOnMonday = true) {
  const now = new Date();
  const day = now.getDay();
  const diff = startOnMonday ? (day === 0 ? -6 : 1 - day) : -day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function dateToDayKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  return days[d.getDay()];
}

// === TEMA ===
function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

// === NOTIFICACIONES ===
function showNotification(message, type = 'info', duration = 3000) {
  const container = document.getElementById('notifications-container');
  const notif = document.createElement('div');
  notif.className = `notification notification-${type}`;
  notif.textContent = message;
  notif.style.animation = 'slideInRight 0.3s ease';
  container.appendChild(notif);
  
  setTimeout(() => {
    notif.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notif.remove(), 300);
  }, duration);
}

function clearAuthDebugPanel() {
  if (!authDebugPanel || !authDebugLog) return;
  authDebugLog.textContent = '';
  authDebugPanel.classList.remove('active');
  authDebugPanel.style.display = 'none';
}

function showAuthDebugPanel(context, error, extra = {}) {
  if (!authDebugPanel || !authDebugLog) return;

  const lines = [];
  const ts = new Date().toLocaleString('es-ES');
  lines.push(`[${ts}] ${context}`);

  if (extra.endpoint) lines.push(`Endpoint: ${extra.endpoint}`);
  if (extra.username) lines.push(`Usuario: ${extra.username}`);
  if (typeof error?.status === 'number') lines.push(`HTTP: ${error.status}`);
  if (error?.details?.message) lines.push(`Backend: ${error.details.message}`);
  if (error?.message) lines.push(`Error: ${error.message}`);

  if (error instanceof TypeError) {
    lines.push('Posible causa: API caida, CORS, SSL o red.');
  }

  authDebugLog.textContent = lines.join('\n');
  authDebugPanel.classList.add('active');
  authDebugPanel.style.display = 'block';
  console.error('AUTH_DEBUG', { context, extra, error });
}

function isSecureOriginForPwa() {
  return window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function ensureServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  if (!isSecureOriginForPwa()) return null;
  if (swRegistration) return swRegistration;

  try {
    swRegistration = await navigator.serviceWorker.register('./sw.js');
    return swRegistration;
  } catch (error) {
    console.error('Error registrando service worker:', error);
    return null;
  }
}

function getSavedVapidKey() {
  return (localStorage.getItem(PUSH_VAPID_STORAGE_KEY) || '').trim();
}

function saveVapidKey(vapidKey) {
  if (vapidKey) localStorage.setItem(PUSH_VAPID_STORAGE_KEY, vapidKey);
  else localStorage.removeItem(PUSH_VAPID_STORAGE_KEY);
}

function getVapidKeyFromInput() {
  const input = document.getElementById('push-vapid-key');
  if (!input) return getSavedVapidKey();
  const value = input.value.trim();
  return value || getSavedVapidKey();
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function getCurrentPushSubscription() {
  if (!isPushSupported()) return null;
  const registration = await ensureServiceWorkerRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

async function subscribeUserToPush(vapidPublicKey) {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  if (!vapidPublicKey) return { ok: false, reason: 'missing_vapid' };

  const registration = await ensureServiceWorkerRegistration();
  if (!registration) return { ok: false, reason: 'sw_unavailable' };

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    return { ok: true, subscription: existing, alreadySubscribed: true };
  }

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
    return { ok: true, subscription, alreadySubscribed: false };
  } catch (error) {
    console.error('Error creando suscripciÃ³n push:', error);
    return { ok: false, reason: 'subscribe_error', error };
  }
}

async function requestNativeNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

async function pushApiRequest(endpoint, payload) {
  const response = await fetch(PUSH_API_BASE + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message || 'Error push API');
  }

  return data;
}

async function registerPushSubscriptionOnServer(subscription) {
  if (!subscription || !subscription.endpoint) return false;
  try {
    await pushApiRequest('/subscribe', {
      username: state.user?.username || null,
      subscription
    });
    return true;
  } catch (error) {
    console.error('No se pudo registrar la suscripcion en el backend:', error);
    return false;
  }
}

async function sendRemoteTestPush(subscription) {
  if (!subscription || !subscription.endpoint) {
    throw new Error('No hay suscripcion push activa en el dispositivo');
  }
  return pushApiRequest('/send-test', {
    username: state.user?.username || null,
    subscription,
    title: 'TASKS Pro',
    body: 'Push remoto recibido correctamente.',
    url: './'
  });
}

function setInstallButtonVisibility() {
  const installBtn = document.getElementById('install-app-btn');
  if (!installBtn) return;
  installBtn.style.display = deferredInstallPrompt ? 'inline-flex' : 'none';
}

async function updatePwaPushStatus(extraMessage = '') {
  const statusEl = document.getElementById('push-status-text');
  const testBtn = document.getElementById('test-push-btn');
  if (!statusEl) return;

  if (!isSecureOriginForPwa()) {
    statusEl.textContent = 'Para notificaciones en mÃ³vil necesitas abrir la web en HTTPS.';
    if (testBtn) testBtn.disabled = true;
    return;
  }

  if (!isPushSupported()) {
    statusEl.textContent = 'Este navegador no soporta notificaciones push web.';
    if (testBtn) testBtn.disabled = true;
    return;
  }

  const subscription = await getCurrentPushSubscription();
  const hasSubscription = !!subscription;
  const hasVapid = !!getVapidKeyFromInput();
  const permission = Notification.permission;

  if (permission === 'denied') {
    statusEl.textContent = 'Permiso bloqueado. Debes habilitar notificaciones manualmente en el navegador.';
    if (testBtn) testBtn.disabled = true;
    return;
  }

  if (permission !== 'granted') {
    statusEl.textContent = 'Notificaciones desactivadas. Pulsa "Activar notificaciones" para pedir permiso.';
    if (testBtn) testBtn.disabled = true;
    return;
  }

  let text = hasSubscription
    ? 'Notificaciones activas y suscripciÃ³n push lista.'
    : 'Permiso concedido. Puedes recibir notificaciones locales.';

  if (!hasSubscription && !hasVapid) {
    text += ' Para push en segundo plano aÃ±ade una clave pÃºblica VAPID.';
  }

  if (extraMessage) text += ` ${extraMessage}`;
  statusEl.textContent = text;
  if (testBtn) testBtn.disabled = false;
}

async function enablePushNotifications() {
  if (!isSecureOriginForPwa()) {
    showNotification('Abre la web en HTTPS para activar notificaciones en movil', 'warning');
    updatePwaPushStatus();
    return;
  }

  const permission = await requestNativeNotificationPermission();
  if (permission !== 'granted') {
    if (permission === 'denied') showNotification('Permiso de notificaciones bloqueado', 'warning');
    else showNotification('No se concedio el permiso de notificaciones', 'warning');
    updatePwaPushStatus();
    return;
  }

  const vapidKey = getVapidKeyFromInput();
  saveVapidKey(vapidKey);

  if (!vapidKey) {
    showNotification('Permiso concedido. Anade una clave VAPID si quieres push remoto', 'info');
    updatePwaPushStatus();
    return;
  }

  const result = await subscribeUserToPush(vapidKey);
  if (!result.ok) {
    showNotification('No se pudo crear la suscripcion push. Revisa la clave VAPID.', 'error');
    updatePwaPushStatus();
    return;
  }

  const subscriptionSaved = await registerPushSubscriptionOnServer(result.subscription);
  const subscriptionJson = JSON.stringify(result.subscription);
  try {
    await navigator.clipboard.writeText(subscriptionJson);
    showNotification(
      subscriptionSaved
        ? 'Push activado y suscripcion registrada en servidor.'
        : 'Push activado. Suscripcion copiada al portapapeles.',
      'success'
    );
  } catch (error) {
    showNotification(
      subscriptionSaved
        ? 'Push activado y suscripcion registrada en servidor.'
        : 'Push activado. Suscripcion guardada en el navegador.',
      'success'
    );
  }

  updatePwaPushStatus(result.alreadySubscribed ? 'La suscripcion ya existia.' : 'Suscripcion creada.');
}

async function sendTestNativeNotification() {
  if (!isPushSupported()) {
    showNotification('Este navegador no soporta notificaciones push', 'warning');
    return;
  }

  if (Notification.permission !== 'granted') {
    showNotification('Activa primero el permiso de notificaciones', 'warning');
    return;
  }

  const subscription = await getCurrentPushSubscription();
  if (subscription) {
    try {
      await sendRemoteTestPush(subscription);
      showNotification('Push remoto de prueba enviado', 'success');
      return;
    } catch (error) {
      console.error('No se pudo enviar push remoto de prueba:', error);
      showNotification('No se pudo enviar push remoto. Enviando prueba local...', 'warning');
    }
  }

  const registration = await ensureServiceWorkerRegistration();
  const payload = {
    title: 'TASKS Pro',
    body: 'Notificacion de prueba enviada correctamente.',
    icon: './icons/icon-192.png',
    badge: './icons/badge-96.png',
    tag: 'tasks-pro-test',
    url: './'
  };

  if (registration?.active) {
    registration.active.postMessage({ type: 'SHOW_LOCAL_NOTIFICATION', payload });
    showNotification('Notificacion local de prueba enviada', 'success');
    return;
  }

  if (registration?.showNotification) {
    await registration.showNotification(payload.title, payload);
    showNotification('Notificacion local de prueba enviada', 'success');
    return;
  }

  new Notification(payload.title, payload);
  showNotification('Notificacion local de prueba enviada', 'success');
}

async function promptInstallApp() {
  if (!deferredInstallPrompt) {
    showNotification('InstalaciÃ³n no disponible en este momento', 'warning');
    return;
  }

  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  if (choice?.outcome === 'accepted') showNotification('InstalaciÃ³n iniciada', 'success');
  else showNotification('InstalaciÃ³n cancelada', 'info');
  deferredInstallPrompt = null;
  setInstallButtonVisibility();
}

function setupPwaInstallEvents() {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    setInstallButtonVisibility();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    setInstallButtonVisibility();
    showNotification('La app se instalÃ³ en el dispositivo', 'success');
  });
}

async function initPwaFeatures() {
  const vapidInput = document.getElementById('push-vapid-key');
  const enableBtn = document.getElementById('enable-push-btn');
  const testBtn = document.getElementById('test-push-btn');
  const installBtn = document.getElementById('install-app-btn');

  if (vapidInput) {
    const savedOrDefaultKey = getSavedVapidKey() || DEFAULT_VAPID_PUBLIC_KEY;
    vapidInput.value = savedOrDefaultKey;
    if (!getSavedVapidKey() && DEFAULT_VAPID_PUBLIC_KEY) {
      saveVapidKey(DEFAULT_VAPID_PUBLIC_KEY);
    }
  }
  if (vapidInput) {
    vapidInput.addEventListener('change', () => {
      saveVapidKey(vapidInput.value.trim());
      updatePwaPushStatus();
    });
  }

  if (enableBtn) enableBtn.addEventListener('click', enablePushNotifications);
  if (testBtn) testBtn.addEventListener('click', sendTestNativeNotification);
  if (installBtn) installBtn.addEventListener('click', promptInstallApp);

  setupPwaInstallEvents();
  await ensureServiceWorkerRegistration();
  const existingSubscription = await getCurrentPushSubscription();
  if (existingSubscription) {
    await registerPushSubscriptionOnServer(existingSubscription);
  }
  setInstallButtonVisibility();
  updatePwaPushStatus();
}

// === BÃšSQUEDA ===
function handleSearch(query) {
  if (!query.trim()) {
    switchView(state.currentView);
    return;
  }
  
  const results = state.tasks.filter(t => 
    t.name.toLowerCase().includes(query.toLowerCase()) ||
    t.description.toLowerCase().includes(query.toLowerCase())
  );
  
  const container = document.getElementById('lista-tareas');
  container.innerHTML = results.length === 0 
    ? '<div class="day-empty">No hay resultados</div>' 
    : results.map(t => taskItemHtml(t.date, t)).join('');
  bindTaskListeners(container);
}

// === INICIO ===
async function init() {
  await loadFromStorage();
  setTheme(state.theme);

  if (state.user) showApp();
  else showLogin();

  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);
  document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterForm();
  });
  document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
  });
  logoutBtn.addEventListener('click', showLogoutModal);
  document.getElementById('cancel-logout-btn').addEventListener('click', closeLogoutModal);
  document.getElementById('confirm-logout-btn').addEventListener('click', confirmLogout);
  document.getElementById('logout-modal').addEventListener('click', e => { if (e.target.id === 'logout-modal') closeLogoutModal(); });
  cancelTaskBtn.addEventListener('click', closeTaskModal);
  taskForm.addEventListener('submit', handleTaskSubmit);
  taskModal.addEventListener('click', e => { if (e.target === taskModal) closeTaskModal(); });

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.getElementById('cal-prev').addEventListener('click', () => { state.calMonth--; renderCalendar(); });
  document.getElementById('cal-next').addEventListener('click', () => { state.calMonth++; renderCalendar(); });
  document.getElementById('cal-today').addEventListener('click', () => {
    const now = new Date();
    state.calMonth = now.getMonth();
    state.calYear = now.getFullYear();
    renderCalendar();
  });

  document.getElementById('add-objetivo-btn').addEventListener('click', () => openObjetivoModal());
  document.getElementById('cancel-objetivo-btn').addEventListener('click', () => closeObjetivoModal());
  document.getElementById('objetivo-form').addEventListener('submit', handleObjetivoSubmit);
  document.getElementById('objetivo-modal').addEventListener('click', e => { if (e.target.id === 'objetivo-modal') closeObjetivoModal(); });

  const dashboardFilter = document.getElementById('dashboard-objetivos-filter');
  if (dashboardFilter) dashboardFilter.addEventListener('change', () => renderDashboard());
  const verMisBtn = document.getElementById('ver-mis-objetivos-btn');
  if (verMisBtn) verMisBtn.addEventListener('click', () => switchView('objetivos'));


  document.getElementById('add-gym-btn').addEventListener('click', () => openGymModal());
  document.getElementById('cancel-gym-btn').addEventListener('click', () => closeGymModal());
  // El botÃ³n de agregar ejercicio ya no existe - ahora se agrega automÃ¡ticamente al seleccionar
  // document.getElementById('btn-add-exercise').addEventListener('click', addGymExerciseToList);
  document.getElementById('gym-form').addEventListener('submit', handleGymSubmit);
  document.getElementById('gym-modal').addEventListener('click', e => { if (e.target.id === 'gym-modal') closeGymModal(); });
  document.getElementById('gym-workout-modal').addEventListener('click', e => { if (e.target.id === 'gym-workout-modal') closeWorkoutModal(); });
  document.getElementById('gym-history-modal').addEventListener('click', e => { if (e.target.id === 'gym-history-modal') closeGymHistoryModal(); });
  document.getElementById('exercise-info-modal').addEventListener('click', e => { if (e.target.id === 'exercise-info-modal') closeExerciseInfoModal(); });

  // Actualizar selector de ejercicios cuando cambia el grupo muscular
  document.getElementById('gym-focus').addEventListener('change', () => {
    populateGymExerciseSelector();
  });

  // Custom select toggle
  document.addEventListener('click', (e) => {
    const customSelect = document.getElementById('custom-exercise-select');
    const trigger = customSelect?.querySelector('.custom-select-trigger');
    const searchInput = document.getElementById('gym-exercise-search');

    // Si se hace clic en el trigger, toggle dropdown
    if (e.target === trigger || trigger?.contains(e.target)) {
      if (customSelect.classList.contains('open')) {
        closeCustomSelect();
      } else {
        openCustomSelect();
      }
    }
    // Si se hace clic en el input de bÃºsqueda, no cerrar
    else if (e.target === searchInput || searchInput?.contains(e.target)) {
      return;
    }
    // Si se hace clic fuera del custom select, cerrar
    else if (!customSelect?.contains(e.target)) {
      closeCustomSelect();
    }
  });

  // Buscador de ejercicios - usar event delegation
  document.addEventListener('input', (e) => {
    if (e.target.id === 'gym-exercise-search') {
      filterGymExercises(e.target.value);
    }
  });

  // ConfiguraciÃ³n
  document.getElementById('export-data-btn').addEventListener('click', exportData);
  document.getElementById('import-data-btn').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', importData);
  document.getElementById('clear-data-btn').addEventListener('click', clearAllData);

  // Ejercicios - filtro
  const ejerciciosFilter = document.getElementById('ejercicios-filter');
  if (ejerciciosFilter) {
    ejerciciosFilter.addEventListener('change', renderEjercicios);
  }

  // Timer
  document.getElementById('timer-start').addEventListener('click', startTimer);
  document.getElementById('timer-pause').addEventListener('click', pauseTimer);
  document.getElementById('timer-reset').addEventListener('click', resetTimer);
  document.getElementById('timer-close').addEventListener('click', () => document.getElementById('timer-modal').classList.remove('active'));

  // Notas
  document.getElementById('notes-form').addEventListener('submit', e => { e.preventDefault(); addNote(); });
  document.getElementById('notes-close').addEventListener('click', () => document.getElementById('notes-modal').classList.remove('active'));

  // GYM mejorado
  document.getElementById('gym-history-btn').addEventListener('click', openGymHistoryModal);
  document.getElementById('close-gym-history').addEventListener('click', closeGymHistoryModal);
  document.getElementById('cancel-workout-btn').addEventListener('click', closeWorkoutModal);
  document.getElementById('gym-workout-form').addEventListener('submit', handleWorkoutSubmit);

  await initPwaFeatures();
}

// === AUTENTICACIÃ“N ===

async function authApiRequest(endpoint, payload) {
  const response = await fetch(AUTH_API_BASE + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  if (!response.ok) {
    const err = new Error(data?.message || `Error de autenticacion (${response.status})`);
    err.status = response.status;
    err.details = data;
    err.endpoint = endpoint;
    throw err;
  }

  return data;
}

function authServerUnavailableMessage() {
  return 'API no disponible en play.greathost.es:20057. Revisa que el backend Python este activo.';
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('register-username').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const passwordConfirm = document.getElementById('register-password-confirm').value;

  clearAuthDebugPanel();
  if (password !== passwordConfirm) {
    const mismatchError = new Error('Las contrasenas no coinciden');
    showAuthDebugPanel('Registro fallido', mismatchError, { endpoint: '/register', username });
    showNotification('Las contrasenas no coinciden', 'error');
    return;
  }

  try {
    await authApiRequest('/register', { username, email, password });
    clearAuthDebugPanel();
    showNotification('Cuenta creada exitosamente', 'success');
    registerForm.reset();
    showLoginForm();
  } catch (error) {
    if (error instanceof TypeError) {
      const networkError = new Error(authServerUnavailableMessage());
      showAuthDebugPanel('Registro fallido', networkError, { endpoint: '/register', username });
      showNotification(authServerUnavailableMessage(), 'error', 6000);
      return;
    }
    showAuthDebugPanel('Registro fallido', error, { endpoint: '/register', username });
    showNotification(error.message || 'Error al crear la cuenta', 'error');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  clearAuthDebugPanel();
  try {
    const result = await authApiRequest('/login', { username, password });
    const user = result.user;

    state.user = {
      username: user.username,
      email: user.email,
      authenticated: true
    };
    setCachedAuthUser(state.user);
    await loadFromStorage();
    showApp();
    loginForm.reset();
    clearAuthDebugPanel();
    showNotification('Bienvenido ' + user.username, 'success');
  } catch (error) {
    if (error instanceof TypeError) {
      const networkError = new Error(authServerUnavailableMessage());
      showAuthDebugPanel('Login fallido', networkError, { endpoint: '/login', username });
      showNotification(authServerUnavailableMessage(), 'error', 6000);
      return;
    }
    showAuthDebugPanel('Login fallido', error, { endpoint: '/login', username });
    showNotification(error.message || 'Usuario o contrasena incorrectos', 'error');
  }
}
function showLogoutModal() {
  document.getElementById('logout-modal').classList.add('active');
}

function closeLogoutModal() {
  document.getElementById('logout-modal').classList.remove('active');
}

function confirmLogout() {
  closeLogoutModal();
  handleLogout();
}

function handleLogout() {
  state.user = null;
  state.tasks = [];
  state.objetivos = [];
  state.gym = {};
  state.gymWorkouts = [];
  state.notes = [];
  state.misDatos = buildDefaultMisDatos();
  state.progresos = [];
  clearCachedAuthUser();
  showLogin();
  showNotification('SesiÃ³n cerrada', 'info');
}

function showLogin() {
  clearAuthDebugPanel();
  loginScreen.classList.add('active');
  appScreen.classList.remove('active');
}

function showApp() {
  loginScreen.classList.remove('active');
  appScreen.classList.add('active');
  setTaskDateDefault();
  // Siempre mostrar el dashboard al entrar
  switchView('dashboard');
}

function showLoginForm() {
  clearAuthDebugPanel();
  loginForm.style.display = 'block';
  registerForm.style.display = 'none';
  document.getElementById('auth-title').innerHTML = '<span class="accent">Iniciar</span> sesiÃ³n';
  document.getElementById('auth-subtitle').textContent = 'Planifica tu semana y cumple tus objetivos';
}

function showRegisterForm() {
  clearAuthDebugPanel();
  loginForm.style.display = 'none';
  registerForm.style.display = 'block';
  document.getElementById('auth-title').innerHTML = '<span class="accent">Crear</span> cuenta';
  document.getElementById('auth-subtitle').textContent = 'Ãšnete y comienza a organizarte hoy';
}

// === STORAGE ===
let saveApiTimer = null;

function buildDefaultMisDatos() {
  return {
    nombre: '',
    edad: '',
    genero: '',
    fechaNacimiento: '',
    altura: '',
    peso: '',
    objetivo: '',
    nivelActividad: '',
    grasaCorporal: '',
    masaMuscular: '',
    grasaVisceral: '',
    aguaCorporal: '',
    masaOsea: '',
    metabolismoBasal: '',
    perimetroPecho: '',
    perimetroCintura: '',
    perimetroCadera: '',
    perimetroMuslo: '',
    perimetroBrazo: '',
    perimetroAntebrazo: '',
    perimetroPantorrilla: '',
    perimetroCuello: ''
  };
}

function getCachedAuthUser() {
  const username = (localStorage.getItem(AUTH_USERNAME_STORAGE_KEY) || '').trim();
  if (!username) return null;
  const email = (localStorage.getItem(AUTH_EMAIL_STORAGE_KEY) || '').trim();
  return { username, email, authenticated: true };
}

function setCachedAuthUser(user) {
  if (!user?.username) return;
  localStorage.setItem(AUTH_USERNAME_STORAGE_KEY, String(user.username));
  localStorage.setItem(AUTH_EMAIL_STORAGE_KEY, String(user.email || ''));
}

function clearCachedAuthUser() {
  localStorage.removeItem(AUTH_USERNAME_STORAGE_KEY);
  localStorage.removeItem(AUTH_EMAIL_STORAGE_KEY);
}

function buildUserDataPayload() {
  return {
    tasks: Array.isArray(state.tasks) ? state.tasks : [],
    objetivos: Array.isArray(state.objetivos) ? state.objetivos : [],
    gym: state.gym && typeof state.gym === 'object' ? state.gym : {},
    gymWorkouts: Array.isArray(state.gymWorkouts) ? state.gymWorkouts : [],
    notes: Array.isArray(state.notes) ? state.notes : [],
    misDatos: state.misDatos && typeof state.misDatos === 'object' ? state.misDatos : buildDefaultMisDatos(),
    progresos: Array.isArray(state.progresos) ? state.progresos : []
  };
}

function applyLoadedUserData(data) {
  state.tasks = Array.isArray(data?.tasks) ? data.tasks : [];
  state.objetivos = Array.isArray(data?.objetivos) ? data.objetivos : [];
  state.gym = data?.gym && typeof data.gym === 'object' ? data.gym : {};
  state.gymWorkouts = Array.isArray(data?.gymWorkouts) ? data.gymWorkouts : [];
  state.notes = Array.isArray(data?.notes) ? data.notes : [];
  state.misDatos = {
    ...buildDefaultMisDatos(),
    ...(data?.misDatos && typeof data.misDatos === 'object' ? data.misDatos : {})
  };
  state.progresos = Array.isArray(data?.progresos) ? data.progresos : [];
}

async function dataApiRequest(endpoint, method = 'GET', payload = null) {
  const options = { method, headers: {} };
  if (payload !== null) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(payload);
  }

  const response = await fetch(DATA_API_BASE + endpoint, options);
  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  if (!response.ok) {
    const err = new Error(data?.message || `Error de datos (${response.status})`);
    err.status = response.status;
    err.details = data;
    err.endpoint = endpoint;
    throw err;
  }

  return data;
}

async function loadFromStorage() {
  try {
    if (!state.user) {
      const cached = getCachedAuthUser();
      if (cached) state.user = cached;
    }

    if (!state.user?.username) return;

    const username = encodeURIComponent(state.user.username);
    const result = await dataApiRequest(`/load?username=${username}`, 'GET');
    applyLoadedUserData(result?.data || {});
  } catch (error) {
    console.error('Error cargando datos desde API:', error);
    if (state.user?.username) {
      showNotification('No se pudieron cargar los datos desde la API', 'warning');
    }
  }
}

function saveToStorage() {
  if (!state.user?.username) return;

  const username = state.user.username;
  const data = buildUserDataPayload();

  if (saveApiTimer) clearTimeout(saveApiTimer);
  saveApiTimer = setTimeout(async () => {
    saveApiTimer = null;
    try {
      await dataApiRequest('/save', 'POST', { username, data });
    } catch (error) {
      console.error('Error guardando datos en API:', error);
    }
  }, 180);
}

// === EXPORTAR/IMPORTAR ===
function exportData() {
  const data = {
    tasks: state.tasks,
    objetivos: state.objetivos,
    gym: state.gym,
    gymWorkouts: state.gymWorkouts,
    notes: state.notes,
    misDatos: state.misDatos,
    progresos: state.progresos,
    exportDate: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tasks_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showNotification('Datos exportados correctamente', 'success');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = event => {
    try {
      const imported = JSON.parse(event.target.result);
      state.tasks = imported.tasks || [];
      state.objetivos = imported.objetivos || [];
      state.gym = imported.gym || {};
      state.gymWorkouts = imported.gymWorkouts || [];
      state.notes = imported.notes || [];
      state.misDatos = imported.misDatos || buildDefaultMisDatos();
      state.progresos = imported.progresos || [];
      saveToStorage();
      refreshCurrentView();
      showNotification('Datos importados correctamente', 'success');
    } catch (err) {
      showNotification('Error al importar datos', 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function clearAllData() {
  if (!confirm('Â¿EstÃ¡s seguro? Esta acciÃ³n es irreversible.')) return;
  state.tasks = [];
  state.objetivos = [];
  state.gym = {};
  state.gymWorkouts = [];
  state.notes = [];
  state.misDatos = buildDefaultMisDatos();
  state.progresos = [];
  saveToStorage();
  refreshCurrentView();
  showNotification('Todos los datos han sido eliminados', 'warning');
}

// === TAREAS ===
function getTasksByDate(dateStr) {
  return state.tasks.filter(t => t.date === dateStr);
}

function getTasksForDayOfWeek(dayKey, weekDates) {
  const idx = DAYS.indexOf(dayKey);
  if (idx < 0) return [];
  const dateStr = formatDate(weekDates[idx]);
  return getTasksByDate(dateStr);
}

function getAllTasks() { return [...state.tasks].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)); }

function addTask(data) {
  state.tasks.push({
    id: generateId(),
    name: data.name,
    time: data.time || '09:00',
    date: data.date,
    category: data.category || '',
    priority: data.priority || 'media',
    description: data.description || '',
    completed: false,
    estimado: data.estimado || 0,
    recordatorio: data.recordatorio || false
  });
  saveToStorage();
  showNotification('Tarea aÃ±adida', 'success');
}

function updateTask(id, data) {
  const t = state.tasks.find(x => x.id === id);
  if (t) {
    t.name = data.name;
    t.time = data.time;
    t.date = data.date;
    t.category = data.category || '';
    t.priority = data.priority || 'media';
    t.description = data.description || '';
    t.estimado = data.estimado || 0;
    t.recordatorio = data.recordatorio || false;
    saveToStorage();
    showNotification('Tarea actualizada', 'success');
  }
}

function toggleTask(id) {
  const t = state.tasks.find(x => x.id === id);
  if (t) { 
    t.completed = !t.completed; 
    saveToStorage(); 
    refreshCurrentView();
    calculateStreak();
    if (t.completed) showNotification('Â¡Tarea completada! ðŸŽ‰', 'success');
  }
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveToStorage();
  refreshCurrentView();
  showNotification('Tarea eliminada', 'info');
}

// === NOTAS RÃPIDAS ===
function addNote() {
  const text = document.getElementById('note-text').value.trim();
  if (!text) return;
  
  state.notes.push({
    id: generateId(),
    text: text,
    date: today(),
    time: new Date().toLocaleTimeString()
  });
  
  saveToStorage();
  document.getElementById('notes-form').reset();
  renderNotes();
  showNotification('Nota aÃ±adida', 'success');
}

function deleteNote(id) {
  state.notes = state.notes.filter(n => n.id !== id);
  saveToStorage();
  renderNotes();
}

function renderNotes() {
  const list = document.getElementById('notes-list');
  if (state.notes.length === 0) {
    list.innerHTML = '<p class="day-empty">No hay notas aÃºn</p>';
    return;
  }
  
  list.innerHTML = state.notes.map(n => `
    <div class="note-item">
      <div class="note-content">${escapeHtml(n.text)}</div>
      <div class="note-meta">${n.date} ${n.time}</div>
      <button class="task-delete" onclick="deleteNote('${n.id}')">Ã—</button>
    </div>
  `).join('');
}

// === TIMER POMODORO ===
let timerInterval = null;

function startTimer() {
  if (state.timerRunning) return;
  state.timerRunning = true;
  document.getElementById('timer-start').style.display = 'none';
  document.getElementById('timer-pause').style.display = 'block';
  
  timerInterval = setInterval(() => {
    if (state.timerSeconds > 0) {
      state.timerSeconds--;
      updateTimerDisplay();
    } else {
      pauseTimer();
      showNotification('Â¡Tiempo de descanso! ðŸŽ‰', 'success');
    }
  }, 1000);
}

function pauseTimer() {
  state.timerRunning = false;
  clearInterval(timerInterval);
  document.getElementById('timer-start').style.display = 'block';
  document.getElementById('timer-pause').style.display = 'none';
}

function resetTimer() {
  pauseTimer();
  state.timerSeconds = 1500;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const mins = Math.floor(state.timerSeconds / 60);
  const secs = state.timerSeconds % 60;
  document.getElementById('timer-display').textContent = 
    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// === ESTADÃSTICAS ===
function calculateStreak() {
  let streak = 0;
  const dates = [...new Set(state.tasks.map(t => t.date))].sort().reverse();
  
  for (let date of dates) {
    const tasks = getTasksByDate(date);
    if (tasks.length > 0 && tasks.every(t => t.completed)) {
      streak++;
    } else {
      break;
    }
  }
  
  state.currentStreak = streak;
  return streak;
}

function renderAnalisis() {
  calculateStreak();

  // Destruir grÃ¡ficos anteriores si existen
  const chartIds = ['chart-weekly', 'chart-category', 'chart-priority', 'chart-time', 'chart-monthly-progress', 'chart-trend-30days', 'chart-weekly-comparison', 'chart-heatmap'];
  chartIds.forEach(id => {
    const canvas = document.getElementById(id);
    if (canvas && canvas.chart) {
      canvas.chart.destroy();
    }
  });

  // Datos para grÃ¡ficas
  const weekDates = getWeekDates();
  const weekLabels = weekDates.map(d => ['Lun', 'Mar', 'MiÃ©', 'Jue', 'Vie', 'SÃ¡b', 'Dom'][d.getDay()]);
  const weekCompletedData = weekDates.map(d => {
    const tasks = getTasksByDate(formatDate(d));
    return tasks.filter(t => t.completed).length;
  });

  const categoryData = {};
  Object.keys(CATEGORIAS).forEach(cat => {
    categoryData[CATEGORIAS[cat]] = state.tasks.filter(t => t.category === cat).length;
  });

  const priorityData = {};
  Object.keys(PRIORIDADES).forEach(pri => {
    priorityData[PRIORIDADES[pri]] = state.tasks.filter(t => t.priority === pri).length;
  });

  // === ESTADÃSTICAS PRINCIPALES ===
  const totalCompletadas = state.tasks.filter(t => t.completed).length;
  const tiempoTotal = state.tasks.filter(t => t.completed).reduce((sum, t) => sum + (t.estimado || 0), 0);
  const promedioDia = weekDates.length > 0 ? Math.round(weekCompletedData.reduce((a, b) => a + b, 0) / 7) : 0;
  const totalTareas = state.tasks.length;
  const efectividad = totalTareas > 0 ? Math.round((totalCompletadas / totalTareas) * 100) : 0;

  document.getElementById('analisis-total-completadas').textContent = totalCompletadas;
  document.getElementById('analisis-tiempo-total').textContent = (tiempoTotal / 60).toFixed(1) + 'h';
  document.getElementById('analisis-promedio-dia').textContent = promedioDia;
  document.getElementById('analisis-efectividad').textContent = efectividad + '%';

  // === GRÃFICAS ===

  // GrÃ¡fica de tendencia de 30 dÃ­as
  const ctxTrend = document.getElementById('chart-trend-30days');
  if (ctxTrend && typeof Chart !== 'undefined') {
    const last30Days = [];
    const last30DaysData = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last30Days.push(d.getDate() + '/' + (d.getMonth() + 1));

      const dateStr = formatDate(d);
      const tasks = getTasksByDate(dateStr);
      last30DaysData.push(tasks.filter(t => t.completed).length);
    }

    ctxTrend.chart = new Chart(ctxTrend, {
      type: 'line',
      data: {
        labels: last30Days,
        datasets: [{
          label: 'Tareas completadas',
          data: last30DaysData,
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  // GrÃ¡fica de productividad semanal
  const ctxWeekly = document.getElementById('chart-weekly');
  if (ctxWeekly && typeof Chart !== 'undefined') {
    ctxWeekly.chart = new Chart(ctxWeekly, {
      type: 'bar',
      data: {
        labels: weekLabels,
        datasets: [{
          label: 'Tareas Completadas',
          data: weekCompletedData,
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // GrÃ¡fica por categorÃ­a
  const ctxCategory = document.getElementById('chart-category');
  if (ctxCategory && typeof Chart !== 'undefined') {
    ctxCategory.chart = new Chart(ctxCategory, {
      type: 'doughnut',
      data: {
        labels: Object.keys(categoryData),
        datasets: [{
          data: Object.values(categoryData),
          backgroundColor: ['#3b82f6', '#eab308', '#10b981', '#ef4444', '#8b5cf6']
        }]
      },
      options: { responsive: true, maintainAspectRatio: true }
    });
  }

  // GrÃ¡fica por prioridad
  const ctxPriority = document.getElementById('chart-priority');
  if (ctxPriority && typeof Chart !== 'undefined') {
    ctxPriority.chart = new Chart(ctxPriority, {
      type: 'pie',
      data: {
        labels: Object.keys(priorityData),
        datasets: [{
          data: Object.values(priorityData),
          backgroundColor: ['#ef4444', '#eab308', '#22c55e']
        }]
      },
      options: { responsive: true, maintainAspectRatio: true }
    });
  }

  // GrÃ¡fica de tiempo dedicado
  const ctxTime = document.getElementById('chart-time');
  if (ctxTime && typeof Chart !== 'undefined') {
    const timeData = weekDates.map(d => {
      const tasks = getTasksByDate(formatDate(d)).filter(t => t.completed);
      return tasks.reduce((sum, t) => sum + (t.estimado || 0), 0);
    });

    ctxTime.chart = new Chart(ctxTime, {
      type: 'line',
      data: {
        labels: weekLabels,
        datasets: [{
          label: 'Tiempo (min)',
          data: timeData,
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // GrÃ¡fica de comparativa semanal (esta semana vs semana anterior)
  const ctxComparison = document.getElementById('chart-weekly-comparison');
  if (ctxComparison && typeof Chart !== 'undefined') {
    const lastWeekDates = weekDates.map(d => {
      const lastWeek = new Date(d);
      lastWeek.setDate(d.getDate() - 7);
      return lastWeek;
    });

    const thisWeekData = weekDates.map(d => {
      const tasks = getTasksByDate(formatDate(d));
      return tasks.filter(t => t.completed).length;
    });

    const lastWeekData = lastWeekDates.map(d => {
      const tasks = getTasksByDate(formatDate(d));
      return tasks.filter(t => t.completed).length;
    });

    ctxComparison.chart = new Chart(ctxComparison, {
      type: 'bar',
      data: {
        labels: weekLabels,
        datasets: [
          {
            label: 'Esta semana',
            data: thisWeekData,
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1
          },
          {
            label: 'Semana anterior',
            data: lastWeekData,
            backgroundColor: 'rgba(156, 163, 175, 0.3)',
            borderColor: 'rgba(156, 163, 175, 0.6)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // Heatmap de actividad (radar chart de dÃ­as de la semana)
  const ctxHeatmap = document.getElementById('chart-heatmap');
  if (ctxHeatmap && typeof Chart !== 'undefined') {
    const diasActividad = {};
    DAYS.forEach(day => { diasActividad[day] = 0; });

    state.tasks.filter(t => t.completed).forEach(t => {
      const dayKey = dateToDayKey(t.date);
      if (diasActividad[dayKey] !== undefined) {
        diasActividad[dayKey]++;
      }
    });

    const radarData = DAYS.map(day => diasActividad[day]);
    const radarLabels = DAYS.map(day => DAY_LABELS[day]);

    ctxHeatmap.chart = new Chart(ctxHeatmap, {
      type: 'radar',
      data: {
        labels: radarLabels,
        datasets: [{
          label: 'Tareas completadas',
          data: radarData,
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: 'rgba(59, 130, 246, 1)',
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  }

  // === MEJORAS ===

  // Calcular semana anterior
  const lastWeekDates = weekDates.map(d => {
    const lastWeek = new Date(d);
    lastWeek.setDate(d.getDate() - 7);
    return lastWeek;
  });

  const lastWeekCompleted = lastWeekDates.reduce((sum, d) => {
    const tasks = getTasksByDate(formatDate(d));
    return sum + tasks.filter(t => t.completed).length;
  }, 0);

  const thisWeekCompleted = weekCompletedData.reduce((a, b) => a + b, 0);
  const mejoraCompletadas = thisWeekCompleted - lastWeekCompleted;
  const mejoraPorcentaje = lastWeekCompleted > 0 ? Math.round((mejoraCompletadas / lastWeekCompleted) * 100) : 0;

  document.getElementById('mejora-tareas-completadas').textContent = mejoraCompletadas >= 0 ? `+${mejoraCompletadas}` : mejoraCompletadas;
  document.getElementById('mejora-tareas-comparacion').textContent = `${mejoraPorcentaje >= 0 ? '+' : ''}${mejoraPorcentaje}% vs. semana anterior`;

  // Racha
  const mejorRacha = state.currentStreak; // AquÃ­ podrÃ­as guardar la mejor racha en el storage
  document.getElementById('mejora-racha').textContent = state.currentStreak + ' dÃ­as';
  document.getElementById('mejora-racha-comparacion').textContent = `Mejor racha: ${mejorRacha} dÃ­as`;

  // Puntualidad
  const tareasConFecha = state.tasks.filter(t => t.completed && t.date);
  const tareasATiempo = tareasConFecha.filter(t => t.date <= today()).length;
  const puntualidad = tareasConFecha.length > 0 ? Math.round((tareasATiempo / tareasConFecha.length) * 100) : 0;
  document.getElementById('mejora-puntualidad').textContent = puntualidad + '%';
  document.getElementById('mejora-puntualidad-comparacion').textContent = `${tareasATiempo} de ${tareasConFecha.length} tareas`;

  // Tiempo promedio
  const tareasCompletadasConTiempo = state.tasks.filter(t => t.completed && t.estimado > 0);
  const tiempoPromedio = tareasCompletadasConTiempo.length > 0
    ? Math.round(tareasCompletadasConTiempo.reduce((sum, t) => sum + t.estimado, 0) / tareasCompletadasConTiempo.length)
    : 0;
  document.getElementById('mejora-tiempo-promedio').textContent = tiempoPromedio + ' min';
  document.getElementById('mejora-tiempo-comparacion').textContent = 'por tarea';

  // === ANÃLISIS DE HÃBITOS ===

  // DÃ­as mÃ¡s productivos
  const diasProductividad = {};
  DAYS.forEach(day => { diasProductividad[day] = 0; });

  state.tasks.filter(t => t.completed).forEach(t => {
    const dayKey = dateToDayKey(t.date);
    if (diasProductividad[dayKey] !== undefined) {
      diasProductividad[dayKey]++;
    }
  });

  const maxDiaProductividad = Math.max(...Object.values(diasProductividad), 1);
  const diasProductividadHtml = DAYS.map(day => {
    const count = diasProductividad[day];
    const percentage = (count / maxDiaProductividad) * 100;
    return `<div class="habito-item">
      <span class="habito-dia">${DAY_LABELS[day]}</span>
      <div class="habito-bar"><div class="habito-bar-fill" style="width: ${percentage}%"></div></div>
      <span class="habito-valor">${count}</span>
    </div>`;
  }).join('');
  document.getElementById('habito-dias-productivos').innerHTML = diasProductividadHtml;

  // Horas mÃ¡s productivas
  const horasProductividad = { manana: 0, tarde: 0, noche: 0 };
  state.tasks.filter(t => t.completed && t.time).forEach(t => {
    const hour = parseInt(t.time.split(':')[0]);
    if (hour >= 6 && hour < 12) horasProductividad.manana++;
    else if (hour >= 12 && hour < 18) horasProductividad.tarde++;
    else horasProductividad.noche++;
  });

  const maxHoraProductividad = Math.max(...Object.values(horasProductividad), 1);
  const horasLabels = { manana: 'MaÃ±ana (6-12h)', tarde: 'Tarde (12-18h)', noche: 'Noche (18-6h)' };
  const horasProductividadHtml = Object.keys(horasProductividad).map(periodo => {
    const count = horasProductividad[periodo];
    const percentage = (count / maxHoraProductividad) * 100;
    return `<div class="habito-item">
      <span class="habito-dia">${horasLabels[periodo]}</span>
      <div class="habito-bar"><div class="habito-bar-fill" style="width: ${percentage}%"></div></div>
      <span class="habito-valor">${count}</span>
    </div>`;
  }).join('');
  document.getElementById('habito-horas-productivas').innerHTML = horasProductividadHtml;

  // CategorÃ­as favoritas
  const categoriasCount = {};
  Object.keys(CATEGORIAS).forEach(cat => {
    categoriasCount[CATEGORIAS[cat]] = state.tasks.filter(t => t.category === cat && t.completed).length;
  });

  const maxCategoriaCount = Math.max(...Object.values(categoriasCount), 1);
  const categoriasHtml = Object.keys(categoriasCount).map(catLabel => {
    const count = categoriasCount[catLabel];
    const percentage = (count / maxCategoriaCount) * 100;
    return `<div class="habito-item">
      <span class="habito-dia">${catLabel}</span>
      <div class="habito-bar"><div class="habito-bar-fill" style="width: ${percentage}%"></div></div>
      <span class="habito-valor">${count}</span>
    </div>`;
  }).join('');
  document.getElementById('habito-categorias').innerHTML = categoriasHtml;

  // === EVOLUCIÃ“N MENSUAL ===
  const ctxMonthly = document.getElementById('chart-monthly-progress');
  if (ctxMonthly && typeof Chart !== 'undefined') {
    // Ãšltimos 6 meses
    const monthsLabels = [];
    const monthsData = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthName = d.toLocaleDateString('es-ES', { month: 'short' });
      monthsLabels.push(monthName);

      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      const monthTasks = state.tasks.filter(t => {
        const taskDate = new Date(t.date + 'T12:00:00');
        return taskDate >= monthStart && taskDate <= monthEnd && t.completed;
      });

      monthsData.push(monthTasks.length);
    }

    ctxMonthly.chart = new Chart(ctxMonthly, {
      type: 'line',
      data: {
        labels: monthsLabels,
        datasets: [{
          label: 'Tareas completadas',
          data: monthsData,
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }
}

// === VISTAS ===
const VIEW_TITLES = {
  dashboard: 'Dashboard',
  semana: 'Semana',
  calendario: 'Calendario',
  objetivos: 'Objetivos',
  gym: 'GYM',
  ejercicios: 'Ejercicios',
  analisis: 'AnÃ¡lisis',
  cronometro: 'CronÃ³metro',
  misdatos: 'Mis Datos',
  progreso: 'Progreso',
  config: 'ConfiguraciÃ³n'
};

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => { n.classList.toggle('active', n.dataset.view === view); });

  if (view === 'dashboard') renderDashboard();
  else if (view === 'semana') renderSemana();
  else if (view === 'calendario') renderCalendar();
  else if (view === 'objetivos') renderObjetivos();
  else if (view === 'gym') renderGym();
  else if (view === 'ejercicios') renderEjercicios();
  else if (view === 'analisis') renderAnalisis();
  else if (view === 'cronometro') renderCronometro();
  else if (view === 'misdatos') renderMisDatos();
  else if (view === 'progreso') renderProgreso();
}

function refreshCurrentView() {
  switchView(state.currentView);
}

// === DASHBOARD ===
function renderDashboard() {
  const hoy = today();
  const tasksHoy = getTasksByDate(hoy);
  const completadasHoy = tasksHoy.filter(t => t.completed).length;
  const weekDates = getWeekDates();

  // Calcular progreso semanal
  let totalTasksWeek = 0;
  let completedTasksWeek = 0;
  weekDates.forEach(d => {
    const ts = getTasksByDate(formatDate(d));
    totalTasksWeek += ts.length;
    completedTasksWeek += ts.filter(t => t.completed).length;
  });
  const progresoSemanal = totalTasksWeek > 0 ? Math.round((completedTasksWeek / totalTasksWeek) * 100) : 0;

  // Calcular racha
  calculateStreak();

  // Calcular tiempo estimado pendiente
  const pendientes = state.tasks.filter(t => !t.completed);
  const tiempoEstimado = pendientes.reduce((sum, t) => sum + (t.estimado || 0), 0);
  const tiempoHoras = (tiempoEstimado / 60).toFixed(1);

  // Calcular tareas atrasadas
  const atrasadas = state.tasks.filter(t => !t.completed && t.date < hoy).length;

  // Total de tareas completadas (todas)
  const totalCompletadas = state.tasks.filter(t => t.completed).length;

  // Tasa de efectividad
  const totalTareas = state.tasks.length;
  const efectividad = totalTareas > 0 ? Math.round((totalCompletadas / totalTareas) * 100) : 0;

  // Tiempo invertido en tareas completadas
  const tiempoInvertido = state.tasks.filter(t => t.completed).reduce((sum, t) => sum + (t.estimado || 0), 0);
  const tiempoInvertidoHoras = (tiempoInvertido / 60).toFixed(1);

  // Promedio semanal de tareas completadas
  const promedioSemanal = Math.round(completedTasksWeek / 7);

  // Objetivos completados
  const objetivosCompletados = state.objetivos.filter(o => o.completed).length;

  const elHoy = document.getElementById('stat-hoy'); if (elHoy) elHoy.textContent = tasksHoy.length;
  const elCompletadas = document.getElementById('stat-completadas'); if (elCompletadas) elCompletadas.textContent = completadasHoy;
  const elRacha = document.getElementById('stat-racha'); if (elRacha) elRacha.textContent = state.currentStreak;
  const elProgresoSemana = document.getElementById('stat-progreso-semana'); if (elProgresoSemana) elProgresoSemana.textContent = progresoSemanal + '%';
  const elTiempoEstimado = document.getElementById('stat-tiempo-estimado'); if (elTiempoEstimado) elTiempoEstimado.textContent = tiempoHoras + 'h';
  const elAtrasadas = document.getElementById('stat-atrasadas'); if (elAtrasadas) elAtrasadas.textContent = atrasadas;
  const elTotalCompletadas = document.getElementById('stat-total-completadas'); if (elTotalCompletadas) elTotalCompletadas.textContent = totalCompletadas;
  const elEfectividad = document.getElementById('stat-efectividad'); if (elEfectividad) elEfectividad.textContent = efectividad + '%';
  const elTiempoInvertido = document.getElementById('stat-tiempo-invertido'); if (elTiempoInvertido) elTiempoInvertido.textContent = tiempoInvertidoHoras + 'h';
  const elPromedioSemanal = document.getElementById('stat-promedio-semanal'); if (elPromedioSemanal) elPromedioSemanal.textContent = promedioSemanal;
  const elCompletadasSemana = document.getElementById('stat-completadas-semana'); if (elCompletadasSemana) elCompletadasSemana.textContent = completedTasksWeek;
  const elObjetivosCompletados = document.getElementById('stat-objetivos-completados'); if (elObjetivosCompletados) elObjetivosCompletados.textContent = objetivosCompletados;

  // Preparar objetivos para mostrar
  const objetivosPendientes = state.objetivos.filter(o => !o.completed);
  const objetivosOrdenados = objetivosPendientes
    .filter(o => o.fechaLimite)
    .sort((a, b) => new Date(a.fechaLimite) - new Date(b.fechaLimite))
    .slice(0, 3);

  const proximas = getAllTasks().filter(t => !t.completed).slice(0, 5);
  const proximasEl = document.getElementById('dashboard-proximas');
  proximasEl.innerHTML = proximas.length === 0
    ? '<div class="day-empty">No hay tareas pendientes</div>'
    : proximas.map(t => taskItemHtml(t.date, t)).join('');
  bindTaskListeners(proximasEl);

  const objetivosEl = document.getElementById('dashboard-objetivos');
  if (!objetivosEl) return;
  if (objetivosOrdenados.length === 0) {
    objetivosEl.innerHTML = '<div class="day-empty">No hay objetivos con fecha lÃ­mite</div>';
  } else {
    objetivosEl.innerHTML = objetivosOrdenados.map(obj => {
      const inicio = obj.fechaInicio || '';
      const fin = obj.fechaLimite || '';
      const now = new Date(hoy + 'T00:00:00');
      const finDate = fin ? new Date(fin + 'T00:00:00') : null;
      let tiempo = '';
      if (finDate) {
        const diasRestantes = Math.ceil((finDate - now) / (1000 * 60 * 60 * 24));
        if (diasRestantes < 0) tiempo = `Vencido ${Math.abs(diasRestantes)}d`;
        else if (diasRestantes === 0) tiempo = 'Vence hoy';
        else tiempo = `${diasRestantes}d restantes`;
      }
      return `
        <div class="task-item objetivo-task ${obj.completed ? 'completed' : ''}" data-id="${obj.id}">
          <div class="task-check">${obj.completed ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
          <div class="task-content">
            <div class="task-name">${escapeHtml(obj.text)}</div>
            <div class="task-time">${inicio ? 'Inicio: ' + inicio + (fin ? ' Â· ' : '') : ''}${fin ? 'Fin: ' + fin : ''}${tiempo ? ' Â· ' + tiempo : ''}</div>
          </div>
          <button class="task-delete" data-id="${obj.id}" title="Eliminar">Ã—</button>
        </div>`;
    }).join('');

    // bind listeners for these items
    objetivosEl.querySelectorAll('.task-check').forEach(btn => {
      btn.onclick = e => { e.stopPropagation(); const id = btn.closest('.task-item').dataset.id; toggleObjetivo(id); };
    });
    objetivosEl.querySelectorAll('.task-item').forEach(item => {
      item.onclick = e => { if (e.target.closest('.task-delete')) return; const id = item.dataset.id; toggleObjetivo(id); };
    });
    objetivosEl.querySelectorAll('.task-delete').forEach(btn => { btn.onclick = e => { e.stopPropagation(); deleteObjetivo(btn.dataset.id); }; });
  }

  const resumenEl = document.getElementById('dashboard-resumen');
  resumenEl.innerHTML = weekDates.map((d, i) => {
    const dateStr = formatDate(d);
    const ts = getTasksByDate(dateStr);
    const done = ts.length > 0 && ts.every(t => t.completed);
    return `<div class="week-mini-day ${done ? 'completed' : ''}">
      <span class="day-name">${DAY_LABELS[DAYS[i]]}</span>
      <span class="day-count">${ts.length}</span>
    </div>`;
  }).join('');

  // Renderizar grÃ¡ficas del dashboard solo si Chart.js estÃ¡ disponible
  if (typeof Chart !== 'undefined') {
    try {
      // Destruir grÃ¡ficas previas del dashboard si existen
      ['dashboard-chart-weekly', 'dashboard-chart-priority', 'dashboard-chart-comparison'].forEach(id => {
        if (window[id]) {
          window[id].destroy();
          window[id] = null;
        }
      });

      // GrÃ¡fica 1: Progreso semanal (tareas por dÃ­a)
      const weeklyData = weekDates.map((d) => {
        const dateStr = formatDate(d);
        const ts = getTasksByDate(dateStr);
        return ts.length;
      });

      const weeklyCtx = document.getElementById('dashboard-chart-weekly');
      if (weeklyCtx) {
        window['dashboard-chart-weekly'] = new Chart(weeklyCtx, {
          type: 'bar',
          data: {
            labels: DAYS.map(d => DAY_LABELS[d]),
            datasets: [{
              label: 'Tareas',
              data: weeklyData,
              backgroundColor: 'rgba(59, 130, 246, 0.6)',
              borderColor: 'rgba(59, 130, 246, 1)',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1 }
              }
            }
          }
        });
      }

      // GrÃ¡fica 2: Tareas por prioridad
      const prioridadCounts = {
        alta: state.tasks.filter(t => t.priority === 'alta').length,
        media: state.tasks.filter(t => t.priority === 'media').length,
        baja: state.tasks.filter(t => t.priority === 'baja').length
      };

      const priorityCtx = document.getElementById('dashboard-chart-priority');
      if (priorityCtx) {
        window['dashboard-chart-priority'] = new Chart(priorityCtx, {
          type: 'doughnut',
          data: {
            labels: ['Alta', 'Media', 'Baja'],
            datasets: [{
              data: [prioridadCounts.alta, prioridadCounts.media, prioridadCounts.baja],
              backgroundColor: [
                'rgba(239, 68, 68, 0.7)',
                'rgba(251, 191, 36, 0.7)',
                'rgba(34, 197, 94, 0.7)'
              ],
              borderColor: [
                'rgba(239, 68, 68, 1)',
                'rgba(251, 191, 36, 1)',
                'rgba(34, 197, 94, 1)'
              ],
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                position: 'bottom'
              }
            }
          }
        });
      }

      // GrÃ¡fica 3: ComparaciÃ³n esta semana vs semana pasada
      const lastWeekStart = new Date(weekDates[0]);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekDates = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(lastWeekStart);
        d.setDate(d.getDate() + i);
        lastWeekDates.push(d);
      }

      const lastWeekData = lastWeekDates.map(d => {
        const dateStr = formatDate(d);
        return getTasksByDate(dateStr).length;
      });

      const comparisonCtx = document.getElementById('dashboard-chart-comparison');
      if (comparisonCtx) {
        window['dashboard-chart-comparison'] = new Chart(comparisonCtx, {
          type: 'bar',
          data: {
            labels: DAYS.map(d => DAY_LABELS[d]),
            datasets: [
              {
                label: 'Esta semana',
                data: weeklyData,
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
              },
              {
                label: 'Semana pasada',
                data: lastWeekData,
                backgroundColor: 'rgba(156, 163, 175, 0.4)',
                borderColor: 'rgba(156, 163, 175, 0.8)',
                borderWidth: 1
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                position: 'bottom'
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1 }
              }
            }
          }
        });
      }
    } catch (error) {
      console.error('Error al renderizar grÃ¡ficas del dashboard:', error);
    }
  }
}

// === SEMANA ===
function renderSemana() {
  const weekDates = getWeekDates();
  const container = document.querySelector('#view-semana .week-container');
  container.innerHTML = '';

  DAYS.forEach((dayKey, idx) => {
    const d = weekDates[idx];
    const dateStr = formatDate(d);
    const tasks = getTasksByDate(dateStr).sort((a, b) => a.time.localeCompare(b.time));
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const isComplete = total > 0 && completed === total;
    const dateLabel = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const totalTime = tasks.reduce((sum, t) => sum + (t.estimado || 0), 0);
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Determinar carga de trabajo
    let workloadClass = '';
    let workloadLabel = '';
    if (total >= 6) { workloadClass = 'heavy'; workloadLabel = 'Carga alta'; }
    else if (total >= 3) { workloadClass = 'medium'; workloadLabel = 'Carga media'; }
    else if (total > 0) { workloadClass = 'light'; workloadLabel = 'Carga ligera'; }

    const card = document.createElement('div');
    card.className = `day-card ${isComplete ? 'completed' : ''}`;
    card.dataset.date = dateStr;
    card.innerHTML = `
      <div class="day-header-wrap">
        <div class="day-header">
          <span class="day-name">${DAY_LABELS[dayKey]}</span>
          <span class="day-date">${dateLabel}</span>
          ${workloadLabel ? `<span class="day-workload-badge ${workloadClass}">${workloadLabel}</span>` : ''}
          <span class="day-status ${isComplete ? 'completed-badge' : ''}">${isComplete ? 'âœ“ DÃ­a cumplido' : total > 0 ? completed + '/' + total + ' tareas' : 'Sin tareas'}</span>
          ${totalTime > 0 ? `<span class="day-time-estimate">â±ï¸ ${totalTime} min estimados</span>` : ''}
        </div>
        ${total > 0 ? `
        <div class="day-progress">
          <div class="day-progress-bar">
            <div class="day-progress-fill" style="width: ${progress}%"></div>
          </div>
          <span class="day-progress-text">${progress}% completado</span>
        </div>` : ''}
      </div>
      <div class="day-tasks">
        ${tasks.length === 0 ? '<div class="day-empty">Sin tareas programadas para este dÃ­a</div>' : tasks.map(t => taskItemHtml(dateStr, t)).join('')}
        <div class="day-quick-add" data-date="${dateStr}">+ AÃ±adir tarea rÃ¡pida</div>
      </div>
    `;
    container.appendChild(card);
    bindTaskListeners(card);
  });

  // Bind evento para aÃ±adir tareas rÃ¡pidas
  document.querySelectorAll('.day-quick-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dateStr = btn.dataset.date;
      openTaskModal(null, dateStr);
    });
  });
}

function taskItemHtml(dateStr, task) {
  const prior = task.priority ? `<span class="task-priority ${task.priority}">${PRIORIDADES[task.priority] || ''}</span>` : '';
  const reminder = task.recordatorio ? 'ðŸ”” ' : '';
  return `
    <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}" data-date="${dateStr}">
      <div class="task-check">${task.completed ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
      <div class="task-content">
        <div class="task-name">${reminder}${escapeHtml(task.name)}${prior}</div>
        <div class="task-time">â± ${task.time}${task.category ? ' Â· ' + (CATEGORIAS[task.category] || task.category) : ''}${task.estimado ? ' Â· ' + task.estimado + 'min' : ''}</div>
      </div>
      <button class="task-delete" data-id="${task.id}" title="Eliminar">Ã—</button>
    </div>`;
}

function bindTaskListeners(container) {
  if (!container) return;
  container.querySelectorAll('.task-check').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); toggleTask(btn.closest('.task-item').dataset.id); };
  });
  container.querySelectorAll('.task-item').forEach(item => {
    item.onclick = e => {
      if (e.target.closest('.task-delete')) return;
      if (e.target.closest('.task-check')) return;
      toggleTask(item.dataset.id);
    };
    item.ondblclick = e => {
      if (e.target.closest('.task-delete')) return;
      const task = state.tasks.find(t => t.id === item.dataset.id);
      if (task) openTaskModal(task);
    };
  });
  container.querySelectorAll('.task-delete').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); deleteTask(btn.dataset.id); };
  });
}

// === CALENDARIO ===
function renderCalendar() {
  const m = state.calMonth;
  const y = state.calYear;
  const date = new Date(y, m, 1);
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('cal-month-year').textContent = `${monthNames[m]} ${y}`;

  if (m < 0) { state.calMonth = 11; state.calYear--; renderCalendar(); return; }
  if (m > 11) { state.calMonth = 0; state.calYear++; renderCalendar(); return; }

  const firstDay = date.getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevMonthDays = new Date(y, m, 0).getDate();

  let html = '<div class="cal-day-header">Lun</div><div class="cal-day-header">Mar</div><div class="cal-day-header">MiÃ©</div><div class="cal-day-header">Jue</div><div class="cal-day-header">Vie</div><div class="cal-day-header">SÃ¡b</div><div class="cal-day-header">Dom</div>';

  for (let i = 0; i < startOffset; i++) {
    const dayNum = prevMonthDays - startOffset + i + 1;
    const prevDate = new Date(y, m - 1, dayNum);
    const dateStr = formatDate(prevDate);
    const tasks = getTasksByDate(dateStr);
    const dayCompleted = tasks.length > 0 && tasks.every(t => t.completed);
    html += `<div class="cal-day other-month ${dayCompleted ? 'day-completed' : ''}" data-date="${dateStr}">${buildCalDayContent(dayNum, tasks)}</div>`;
  }

  const todayStr = today();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(new Date(y, m, d));
    const tasks = getTasksByDate(dateStr);
    const hasTasks = tasks.length > 0;
    const isToday = dateStr === todayStr;
    const dayCompleted = tasks.length > 0 && tasks.every(t => t.completed);
    html += `<div class="cal-day ${isToday ? 'today' : ''} ${hasTasks ? 'has-tasks' : ''} ${dayCompleted ? 'day-completed' : ''}" data-date="${dateStr}">${buildCalDayContent(d, tasks)}</div>`;
  }

  const totalCells = startOffset + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < remaining; i++) {
    const d = i + 1;
    const nextDate = new Date(y, m + 1, d);
    const dateStr = formatDate(nextDate);
    const tasks = getTasksByDate(dateStr);
    const dayCompleted = tasks.length > 0 && tasks.every(t => t.completed);
    html += `<div class="cal-day other-month ${dayCompleted ? 'day-completed' : ''}" data-date="${dateStr}">${buildCalDayContent(d, tasks)}</div>`;
  }

  document.getElementById('calendar-grid').innerHTML = html;

  document.querySelectorAll('#calendar-grid .cal-day').forEach(el => {
    el.addEventListener('click', () => showCalendarDayTasks(el.dataset.date));
    el.addEventListener('dblclick', () => {
      openTaskModal(null, el.dataset.date);
    });
  });

  const sel = document.querySelector('.cal-day[data-date="' + todayStr + '"]');
  if (sel) showCalendarDayTasks(todayStr);
  else document.getElementById('calendar-day-tasks').innerHTML = '<p class="day-empty">Selecciona un dÃ­a</p>';
}

function buildCalDayContent(dayNum, tasks) {
  const priorityBadges = tasks.slice(0, 5).map(t => `<span class="cal-badge ${t.priority || 'media'}"></span>`).join('');
  const tooltip = tasks.length > 0 ? `<div class="cal-day-tooltip">${tasks.slice(0, 3).map(t => `<div class="tooltip-task">${escapeHtml(t.name)}</div>`).join('')}${tasks.length > 3 ? `<div class="tooltip-task">+${tasks.length - 3} mÃ¡s...</div>` : ''}</div>` : '';
  const taskCountDisplay = tasks.length > 0 ? `<span class="day-task-count-mobile">${tasks.length}</span>` : '';
  return `<div class="cal-day-inner"><span class="day-num">${dayNum}</span>${taskCountDisplay}</div><div class="cal-day-badges">${priorityBadges}</div>${tooltip}`;
}

function showCalendarDayTasks(dateStr) {
  const tasks = getTasksByDate(dateStr).sort((a, b) => a.time.localeCompare(b.time));
  const d = new Date(dateStr + 'T12:00:00');
  const label = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  let html = `<h4>${label}</h4>`;

  if (tasks.length === 0) {
    html += '<p class="day-empty">Sin tareas</p>';
  } else {
    html += tasks.map(t => taskItemHtml(dateStr, t)).join('');
  }

  // AÃ±adir botÃ³n de nueva tarea al final
  html += `<button class="btn-primary btn-add-task-day" data-date="${dateStr}" style="margin-top: 1rem;">${tasks.length === 0 ? '+ Nueva tarea' : '+ Agregar mÃ¡s tareas'}</button>`;

  document.getElementById('calendar-day-tasks').innerHTML = html;
  bindTaskListeners(document.getElementById('calendar-day-tasks'));

  // AÃ±adir evento al botÃ³n de nueva tarea
  const btnAddTask = document.querySelector('.btn-add-task-day');
  if (btnAddTask) {
    btnAddTask.addEventListener('click', () => {
      openTaskModal(null, dateStr);
    });
  }
}

// === OBJETIVOS ===
function renderObjetivos() {
  const pendientesEl = document.getElementById('objetivos-pendientes');
  const cumplidosEl = document.getElementById('objetivos-cumplidos');
  const list = state.objetivos || [];
  const hoy = today();

  const pendientes = list.filter(o => !o.completed);
  const cumplidos = list.filter(o => o.completed).sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));

  if (!pendientesEl || !cumplidosEl) return;

  if (pendientes.length === 0) {
    pendientesEl.innerHTML = '<div class="day-empty">No hay objetivos pendientes</div>';
  } else {
    pendientesEl.innerHTML = pendientes.map(obj => {
      const inicio = obj.fechaInicio || '';
      const fin = obj.fechaLimite || '';
      const now = new Date(hoy + 'T00:00:00');
      const finDate = fin ? new Date(fin + 'T00:00:00') : null;
      let tiempo = '';
      if (finDate) {
        const diasRestantes = Math.ceil((finDate - now) / (1000 * 60 * 60 * 24));
        if (diasRestantes < 0) tiempo = `Vencido ${Math.abs(diasRestantes)}d`;
        else if (diasRestantes === 0) tiempo = 'Vence hoy';
        else tiempo = `${diasRestantes}d restantes`;
      }
      return `
        <div class="task-item objetivo-item ${obj.completed ? 'completed' : ''}" data-id="${obj.id}">
          <div class="task-check">${obj.completed ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
          <div class="task-content">
            <div class="task-name">${escapeHtml(obj.text)}</div>
            <div class="task-time">
              ${inicio ? `<span class="meta-chip inicio">Inicio: ${inicio}</span>` : ''}
              ${fin ? `<span class="meta-chip fin">Fin: ${fin}</span>` : ''}
              ${tiempo ? `<span class="meta-chip ${tiempo.startsWith('Vencido') ? 'vencido' : (tiempo==='Vence hoy' ? 'proximo' : '')}">${tiempo}</span>` : ''}
            </div>
          </div>
          <div class="objetivo-actions-inline">
            <button class="btn-secondary btn-sm task-edit" data-id="${obj.id}" title="Editar">Editar</button>
            <button class="task-delete" data-id="${obj.id}" title="Eliminar">Ã—</button>
          </div>
        </div>`;
    }).join('');
  }

  if (cumplidos.length === 0) {
    cumplidosEl.innerHTML = '<div class="day-empty">No hay objetivos cumplidos todavÃ­a</div>';
  } else {
    cumplidosEl.innerHTML = cumplidos.map(obj => {
      const inicio = obj.fechaInicio || '';
      const fin = obj.fechaLimite || '';
      const completedAt = obj.completedAt ? new Date(obj.completedAt).toLocaleString() : 'â€”';
      return `
        <div class="objetivo-cumplido-item" data-id="${obj.id}">
          <div class="objetivo-text"><strong>${escapeHtml(obj.text)}</strong></div>
          <div class="objetivo-detalles">
            ${inicio ? `<span class="meta-chip inicio">Inicio: ${inicio}</span>` : ''}
            ${fin ? `<span class="meta-chip fin">Fin: ${fin}</span>` : ''}
            <span class="meta-chip estado">Completado: ${completedAt}</span>
          </div>
          <div class="objetivo-actions">
            <button class="btn-secondary btn-sm" data-action="reenable" data-id="${obj.id}">Marcar no cumplido</button>
            <button class="btn-secondary btn-sm btn-danger" data-action="eliminar" data-id="${obj.id}">Eliminar</button>
          </div>
        </div>`;
    }).join('');
  }

  // bind events
  pendientesEl.querySelectorAll('.task-check').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); const id = btn.closest('.task-item').dataset.id; toggleObjetivo(id); };
  });
  pendientesEl.querySelectorAll('.task-item').forEach(item => {
    item.onclick = e => { if (e.target.closest('.task-delete')) return; const id = item.dataset.id; toggleObjetivo(id); };
  });
  pendientesEl.querySelectorAll('.task-delete').forEach(btn => { btn.onclick = e => { e.stopPropagation(); deleteObjetivo(btn.dataset.id); }; });
  pendientesEl.querySelectorAll('.task-edit').forEach(btn => { btn.onclick = e => { e.stopPropagation(); openObjetivoModal(btn.dataset.id); }; });

  cumplidosEl.querySelectorAll('[data-action]').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'reenable') {
        const o = state.objetivos.find(x => x.id === id);
        if (o) { o.completed = false; delete o.completedAt; saveToStorage(); renderObjetivos(); renderDashboard(); }
      } else if (action === 'eliminar') { deleteObjetivo(id); }
    };
  });
}

function addObjetivo(text, fechaInicio = null, fechaLimite = null) {
  state.objetivos.push({
    id: generateId(),
    text: text.trim(),
    completed: false,
    fechaInicio: fechaInicio || null,
    fechaLimite: fechaLimite || null
  });
  saveToStorage();
  showNotification('Objetivo aÃ±adido', 'success');
}

function toggleObjetivo(id) {
  const o = state.objetivos.find(x => x.id === id);
  if (o) {
    o.completed = !o.completed;
    if (o.completed) o.completedAt = new Date().toISOString();
    else delete o.completedAt;
    saveToStorage();
    renderObjetivos();
    renderDashboard();
  }
}

function deleteObjetivo(id) {
  state.objetivos = state.objetivos.filter(o => o.id !== id);
  saveToStorage();
  renderObjetivos();
}

function openObjetivoModal(id = null) {
  const modal = document.getElementById('objetivo-modal');
  modal.classList.add('active');
  const textEl = document.getElementById('objetivo-text');
  const inicioEl = document.getElementById('objetivo-fecha-inicio');
  const finEl = document.getElementById('objetivo-fecha');

  if (id) {
    // Edit existing objetivo
    const o = state.objetivos.find(x => x.id === id);
    if (o) {
      modal.dataset.editingId = id;
      textEl.value = o.text || '';
      inicioEl.value = o.fechaInicio || '';
      finEl.value = o.fechaLimite || '';
    }
  } else {
    // New objetivo
    delete modal.dataset.editingId;
    textEl.value = '';
    inicioEl.value = '';
    finEl.value = '';
  }

  textEl.focus();
}

function closeObjetivoModal() {
  document.getElementById('objetivo-modal').classList.remove('active');
  const modal = document.getElementById('objetivo-modal');
  delete modal.dataset.editingId;
  document.getElementById('objetivo-form').reset();
}

function handleObjetivoSubmit(e) {
  e.preventDefault();
  const text = document.getElementById('objetivo-text').value.trim();
  const fechaInicio = document.getElementById('objetivo-fecha-inicio').value || null;
  const fecha = document.getElementById('objetivo-fecha').value || null;
  if (!text) return;
  const modal = document.getElementById('objetivo-modal');
  const editingId = modal.dataset.editingId || null;
  if (editingId) {
    const o = state.objetivos.find(x => x.id === editingId);
    if (o) {
      o.text = text;
      o.fechaInicio = fechaInicio || null;
      o.fechaLimite = fecha || null;
      saveToStorage();
      showNotification('Objetivo actualizado', 'success');
    }
  } else {
    addObjetivo(text, fechaInicio, fecha);
  }

  closeObjetivoModal();
  renderObjetivos();
  renderDashboard();
}

// === GYM ===
function renderGym() {
  const container = document.getElementById('gym-container');
  const routines = state.gym;
  const daysWithRoutine = Object.keys(routines);

  // Calcular estadÃ­sticas de la semana
  const weekDates = getWeekDates();
  const thisWeekWorkouts = state.gymWorkouts.filter(w => {
    const wDate = new Date(w.date);
    return wDate >= weekDates[0] && wDate <= weekDates[6];
  });
  const weekWorkoutCount = thisWeekWorkouts.length;
  const weekVolume = thisWeekWorkouts.reduce((sum, w) => {
    return sum + (w.exercises || []).reduce((exSum, ex) => {
      return exSum + (ex.sets || []).reduce((setSum, set) => setSum + (set.weight * set.reps || 0), 0);
    }, 0);
  }, 0);
  const weekGroups = [...new Set(thisWeekWorkouts.map(w => w.focus).filter(Boolean))].join(', ') || '-';

  document.getElementById('gym-week-workouts').textContent = weekWorkoutCount;
  document.getElementById('gym-week-volume').textContent = Math.round(weekVolume);
  document.getElementById('gym-week-groups').textContent = weekGroups;

  if (daysWithRoutine.length === 0) {
    container.innerHTML = '<div class="day-empty">AÃ±ade tus rutinas de gym por dÃ­a de la semana</div>';
    return;
  }

  container.innerHTML = DAYS.map(dayKey => {
    const r = routines[dayKey];
    if (!r) return '';

    // Soportar ambos formatos: antiguo (string) y nuevo (array)
    let exercisesList = '';
    if (typeof r.exercises === 'string') {
      // Formato antiguo
      const exercises = r.exercises.split('\n').filter(l => l.trim());
      exercisesList = exercises.map(ex => `<li>${escapeHtml(ex.trim())}</li>`).join('');
    } else if (Array.isArray(r.exercises)) {
      // Formato nuevo
      exercisesList = r.exercises.map(ex => {
        const info = `${ex.series}x${ex.reps}${ex.weight > 0 ? ` @ ${ex.weight}kg` : ''}`;
        return `<li>${escapeHtml(ex.name)} - ${info}</li>`;
      }).join('');
    }

    const todayWorkout = thisWeekWorkouts.find(w => w.day === dayKey);
    const hasWorkout = !!todayWorkout;

    return `
      <div class="gym-day-card" data-day="${dayKey}">
        <div class="gym-day-header">
          <span class="day-name">${DAY_LABELS[dayKey]}</span>
          <span class="gym-focus-badge">${GYM_FOCUS[r.focus] || r.focus}</span>
          ${hasWorkout ? '<span class="workout-status completed">âœ“ Completado esta semana</span>' : ''}
          <button class="task-delete gym-delete-btn" data-day="${dayKey}" title="Eliminar">Ã—</button>
        </div>
        <ul class="gym-exercises-list">${exercisesList}</ul>
        <div class="gym-day-actions">
          <button class="btn-start-workout" data-day="${dayKey}">Registrar entrenamiento</button>
          <button class="btn-edit-workout" data-day="${dayKey}">Editar entrenamiento</button>
        </div>
      </div>
    `;
  }).filter(Boolean).join('');

  container.querySelectorAll('.gym-day-card').forEach(card => {
    card.onclick = e => {
      if (e.target.closest('.gym-delete-btn')) return;
      if (e.target.closest('.btn-start-workout')) return;
      if (e.target.closest('.btn-edit-workout')) return;
      showRoutineExercises(card.dataset.day);
    };
  });

  container.querySelectorAll('.gym-delete-btn').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); deleteGymRoutine(btn.dataset.day); };
  });

  container.querySelectorAll('.btn-start-workout').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); quickRegisterWorkout(btn.dataset.day); };
  });

  container.querySelectorAll('.btn-edit-workout').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); openGymModal(btn.dataset.day); };
  });
}

// Registro rÃ¡pido de entrenamiento sin mostrar modal (botÃ³n "Registrar entrenamiento")
function quickRegisterWorkout(day) {
  const routine = state.gym[day];
  if (!routine) return;

  // Normalize exercises to an array of strings (support legacy string format and new array format)
  let exercisesArr = [];
  if (Array.isArray(routine.exercises)) {
    exercisesArr = routine.exercises.map(ex => typeof ex === 'string' ? ex : (ex.name || ''));
  } else if (typeof routine.exercises === 'string') {
    exercisesArr = routine.exercises.split('\n').filter(l => l.trim());
  }

  const workoutData = {
    id: generateId(),
    day: day,
    focus: routine.focus,
    date: today(),
    exercises: exercisesArr.map(ex => {
      const [name, setsPart] = ex.split(/\s+(?=\d+x)/);
      const [setsCount] = setsPart ? setsPart.split('x') : ['3'];
      const numSets = parseInt(setsCount) || 3;
      const sets = Array.from({ length: numSets }, () => ({ reps: 10, weight: 0 }));
      return { name: (name || '').trim(), sets };
    }),
    notes: ''
  };

  state.gymWorkouts.push(workoutData);
  saveToStorage();
  renderGym();
  showNotification('Entrenamiento registrado', 'success');
}

function addGymRoutine(day, focus, exercises) {
  state.gym[day] = { focus, exercises: exercises.trim() };
  saveToStorage();
  showNotification('Rutina de gym aÃ±adida', 'success');
}

function deleteGymRoutine(day) {
  delete state.gym[day];
  saveToStorage();
  renderGym();
}

let selectedGymExercises = [];
let currentSelectedExerciseId = null;

function normalizeSearchText(text = '') {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getGymAllowedGroupsByFocus() {
  const focus = document.getElementById('gym-focus')?.value || 'full';
  const allGroups = [...new Set(EJERCICIOS_DATABASE.map(ej => ej.group))];
  const byFocus = {
    pecho: ['pecho', 'brazos'],
    espalda: ['espalda', 'brazos'],
    piernas: ['piernas'],
    hombros: ['hombros', 'brazos'],
    brazos: ['brazos'],
    core: ['core'],
    full: allGroups,
    cardio: ['piernas', 'core'],
    otro: allGroups
  };

  const allowed = byFocus[focus] || allGroups;
  return allowed.filter(group => allGroups.includes(group));
}

function getGymExercisesForSelector(searchText = '') {
  const allowedGroups = getGymAllowedGroupsByFocus();
  const search = normalizeSearchText(searchText);

  return EJERCICIOS_DATABASE.filter(ej => {
    if (!allowedGroups.includes(ej.group)) return false;
    if (!search) return true;

    const searchableText = normalizeSearchText([
      ej.name,
      ej.group,
      ...(ej.tags || [])
    ].join(' '));

    return searchableText.includes(search);
  });
}

function populateGymExerciseSelector(searchText = '') {
  const optionsList = document.getElementById('gym-exercise-options');
  if (!optionsList) return;

  const exercises = getGymExercisesForSelector(searchText);

  optionsList.innerHTML = '';
  if (exercises.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'custom-option';
    emptyDiv.style.color = 'var(--text-secondary)';
    emptyDiv.style.cursor = 'default';
    emptyDiv.textContent = searchText.trim()
      ? 'No se encontraron ejercicios...'
      : 'No hay ejercicios para este enfoque.';
    optionsList.appendChild(emptyDiv);
    return;
  }

  // Agrupar ejercicios por grupo muscular
  const groups = {};
  exercises.forEach(ej => {
    if (!groups[ej.group]) groups[ej.group] = [];
    groups[ej.group].push(ej);
  });

  // Poblar lista personalizada con grupos
  Object.keys(groups).sort().forEach(group => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'custom-option-group';

    const labelDiv = document.createElement('div');
    labelDiv.className = 'custom-option-group-label';
    labelDiv.textContent = group.toUpperCase();
    groupDiv.appendChild(labelDiv);

    groups[group]
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
      .forEach(ej => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'custom-option';
        optionDiv.textContent = ej.name;
        optionDiv.dataset.id = ej.id;
        optionDiv.addEventListener('click', () => selectExercise(ej.id, ej.name));
        groupDiv.appendChild(optionDiv);
      });

    optionsList.appendChild(groupDiv);
  });
}

function filterGymExercises(searchText) {
  populateGymExerciseSelector(searchText || '');
}

function selectExercise(id, name) {
  currentSelectedExerciseId = id;
  document.querySelector('.custom-select-trigger').textContent = name;
  closeCustomSelect();

  // Agregar automÃ¡ticamente el ejercicio a la lista
  addGymExerciseToList();
}

function openCustomSelect() {
  const customSelect = document.getElementById('custom-exercise-select');
  customSelect.classList.add('open');

  // Focus en el input de bÃºsqueda
  setTimeout(() => {
    document.getElementById('gym-exercise-search').focus();
  }, 100);
}

function closeCustomSelect() {
  const customSelect = document.getElementById('custom-exercise-select');
  customSelect.classList.remove('open');

  // Limpiar bÃºsqueda
  document.getElementById('gym-exercise-search').value = '';
  populateGymExerciseSelector();
}

function addGymExerciseToList() {
  const exerciseId = currentSelectedExerciseId;

  if (!exerciseId) {
    showNotification('Selecciona un ejercicio primero', 'warning');
    return;
  }

  const ejercicio = EJERCICIOS_DATABASE.find(e => String(e.id) === String(exerciseId));
  if (!ejercicio) return;

  // Verificar si ya estÃ¡ agregado
  if (selectedGymExercises.find(e => String(e.id) === String(exerciseId))) {
    showNotification('Este ejercicio ya estÃ¡ en la rutina', 'warning');
    return;
  }

  selectedGymExercises.push({
    id: ejercicio.id,
    name: ejercicio.name,
    series: 3,
    reps: 10,
    weight: 0
  });

  renderSelectedGymExercises();

  // Reset selector
  currentSelectedExerciseId = null;
  document.querySelector('.custom-select-trigger').textContent = 'Seleccionar ejercicio...';

  showNotification(`âœ“ ${ejercicio.name} aÃ±adido a la rutina`, 'success');
}

function removeGymExercise(index) {
  selectedGymExercises.splice(index, 1);
  renderSelectedGymExercises();
}

function updateGymExercise(index, field, value) {
  if (selectedGymExercises[index]) {
    selectedGymExercises[index][field] = parseFloat(value) || 0;
  }
}

function renderSelectedGymExercises() {
  const container = document.getElementById('gym-selected-exercises');
  if (!container) return;

  if (selectedGymExercises.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = selectedGymExercises.map((ex, index) => `
    <div class="gym-exercise-item">
      <div class="gym-exercise-header">
        <span class="gym-exercise-name">${escapeHtml(ex.name)}</span>
        <button type="button" class="gym-exercise-remove" onclick="removeGymExercise(${index})">Eliminar</button>
      </div>
      <div class="gym-exercise-inputs">
        <div class="gym-input-group">
          <label>Series</label>
          <input type="number" min="1" max="50" value="${ex.series}"
                 onchange="updateGymExercise(${index}, 'series', this.value)">
        </div>
        <div class="gym-input-group">
          <label>Repeticiones</label>
          <input type="number" min="1" max="50" value="${ex.reps}"
                 onchange="updateGymExercise(${index}, 'reps', this.value)">
        </div>
        <div class="gym-input-group">
          <label>Peso (kg)</label>
          <input type="number" min="0" step="0.5" value="${ex.weight}"
                 onchange="updateGymExercise(${index}, 'weight', this.value)">
        </div>
      </div>
    </div>
  `).join('');
}

function openGymModal(editDay = null) {
  document.getElementById('gym-modal').classList.add('active');

  selectedGymExercises = [];

  if (editDay) {
    const r = state.gym[editDay];
    document.getElementById('gym-day').value = editDay;
    document.getElementById('gym-focus').value = r?.focus || 'pecho';

    // Cargar ejercicios existentes
    if (r?.exercises) {
      // Si es el formato antiguo (string), convertir
      if (typeof r.exercises === 'string') {
        const lines = r.exercises.split('\n').filter(l => l.trim());
        lines.forEach(line => {
          const match = line.match(/^(.+?)\s+(\d+)x(\d+)$/);
          if (match) {
            selectedGymExercises.push({
              id: Date.now() + Math.random(),
              name: match[1].trim(),
              series: parseInt(match[2]),
              reps: parseInt(match[3]),
              weight: 0
            });
          }
        });
      } else if (Array.isArray(r.exercises)) {
        // Formato nuevo
        selectedGymExercises = [...r.exercises];
      }
    }
  } else {
    document.getElementById('gym-form').reset();
    document.getElementById('gym-day').value = 'lunes';
    document.getElementById('gym-focus').value = 'pecho';
  }

  // Limpiar buscador y poblar selector con todos los ejercicios
  currentSelectedExerciseId = null;
  document.getElementById('gym-exercise-search').value = '';
  const trigger = document.querySelector('.custom-select-trigger');
  if (trigger) trigger.textContent = 'Seleccionar ejercicio...';
  populateGymExerciseSelector();
  renderSelectedGymExercises();
}

function closeGymModal() {
  document.getElementById('gym-modal').classList.remove('active');
  document.getElementById('gym-form').reset();
  selectedGymExercises = [];
}

function handleGymSubmit(e) {
  e.preventDefault();

  if (selectedGymExercises.length === 0) {
    showNotification('Agrega al menos un ejercicio a la rutina', 'warning');
    return;
  }

  const day = document.getElementById('gym-day').value;
  const focus = document.getElementById('gym-focus').value;

  // Guardar en el nuevo formato
  state.gym[day] = {
    focus: focus,
    exercises: selectedGymExercises.map(e => ({
      id: e.id,
      name: e.name,
      series: e.series,
      reps: e.reps,
      weight: e.weight
    }))
  };

  saveToStorage();
  closeGymModal();
  renderGym();
  showNotification('Rutina guardada correctamente', 'success');
}

// === LISTA ===
function renderLista() {
  const cat = document.getElementById('filter-categoria').value;
  const prio = document.getElementById('filter-prioridad').value;
  const estado = document.getElementById('filter-estado').value;
  const fecha = document.getElementById('filter-fecha').value;

  let list = getAllTasks();
  if (cat) list = list.filter(t => t.category === cat);
  if (prio) list = list.filter(t => t.priority === prio);
  if (estado === 'pendientes') list = list.filter(t => !t.completed);
  else if (estado === 'completadas') list = list.filter(t => t.completed);
  if (fecha) list = list.filter(t => t.date === fecha);

  const container = document.getElementById('lista-tareas');
  container.innerHTML = list.length === 0 ? '<div class="day-empty">No hay tareas</div>' : list.map(t => taskItemHtml(t.date, t)).join('');
  bindTaskListeners(container);
}

// === MODAL TAREA ===
function setTaskDateDefault() {
  const el = document.getElementById('task-date');
  if (el && !el.value) el.value = today();
}

function openTaskModal(editTask = null, presetDate = null) {
  setTaskDateDefault();
  taskModal.classList.add('active');
  if (editTask) {
    document.getElementById('task-name').value = editTask.name;
    document.getElementById('task-date').value = editTask.date;
    document.getElementById('task-time').value = editTask.time;
    document.getElementById('task-categoria').value = editTask.category || '';
    document.getElementById('task-prioridad').value = editTask.priority || 'media';
    document.getElementById('task-descripcion').value = editTask.description || '';
    document.getElementById('task-estimado').value = editTask.estimado || '';
    taskForm.dataset.editId = editTask.id;
  } else {
    taskForm.reset();
    if (presetDate) {
      document.getElementById('task-date').value = presetDate;
    } else {
      setTaskDateDefault();
    }
    delete taskForm.dataset.editId;
  }
  document.getElementById('task-name').focus();
}

function closeTaskModal() {
  taskModal.classList.remove('active');
  taskForm.reset();
  delete taskForm.dataset.editId;
}

function handleTaskSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('task-name').value.trim();
  const date = document.getElementById('task-date').value;
  const time = document.getElementById('task-time').value;
  const category = document.getElementById('task-categoria').value;
  const priority = document.getElementById('task-prioridad').value;
  const description = document.getElementById('task-descripcion').value.trim();
  const estimado = parseInt(document.getElementById('task-estimado').value) || 0;

  if (!name || !date) return;

  const data = { name, date, time, category, priority, description, estimado };

  if (taskForm.dataset.editId) {
    updateTask(taskForm.dataset.editId, data);
  } else {
    addTask(data);
  }

  closeTaskModal();
  refreshCurrentView();
}

// === GYM WORKOUT ===
function openWorkoutModal(day) {
  state.currentWorkoutDay = day;
  const routine = state.gym[day];
  if (!routine) return;

  document.getElementById('gym-workout-modal').classList.add('active');
  document.getElementById('workout-day').value = day;

  const exercises = (routine.exercises || '').split('\n').filter(l => l.trim());
  const container = document.getElementById('workout-exercises-list');

  container.innerHTML = exercises.map((ex, idx) => {
    const [name, sets] = ex.split(/\s+(?=\d+x)/);
    const [numSets] = sets ? sets.split('x') : ['3'];
    const setsCount = parseInt(numSets) || 3;

    return `
      <div class="workout-exercise-item">
        <h4>${escapeHtml(name.trim())}</h4>
        <div class="workout-sets">
          ${Array(setsCount).fill(0).map((_, setIdx) => `
            <div class="workout-set-row">
              <label>Serie ${setIdx + 1}</label>
              <input type="number" placeholder="Reps" data-ex="${idx}" data-set="${setIdx}" data-field="reps" min="1" value="10">
              <input type="number" placeholder="Peso (kg)" data-ex="${idx}" data-set="${setIdx}" data-field="weight" min="0" step="0.5" value="0">
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function closeWorkoutModal() {
  document.getElementById('gym-workout-modal').classList.remove('active');
  document.getElementById('gym-workout-form').reset();
}

function handleWorkoutSubmit(e) {
  e.preventDefault();
  const day = document.getElementById('workout-day').value;
  const notes = document.getElementById('workout-notes').value.trim();
  const routine = state.gym[day];

  if (!routine) return;

  const exercises = (routine.exercises || '').split('\n').filter(l => l.trim());
  const workoutData = {
    id: generateId(),
    day: day,
    focus: routine.focus,
    date: today(),
    exercises: exercises.map((ex, idx) => {
      const [name] = ex.split(/\s+(?=\d+x)/);
      const sets = [];
      document.querySelectorAll(`[data-ex="${idx}"]`).forEach(input => {
        const setIdx = parseInt(input.dataset.set);
        const field = input.dataset.field;
        if (!sets[setIdx]) sets[setIdx] = {};
        sets[setIdx][field] = parseFloat(input.value) || 0;
      });
      return { name: name.trim(), sets };
    }),
    notes
  };

  state.gymWorkouts.push(workoutData);
  saveToStorage();
  closeWorkoutModal();
  renderGym();
  showNotification('Â¡Entrenamiento registrado! ðŸ’ª', 'success');
}

function openGymHistoryModal() {
  document.getElementById('gym-history-modal').classList.add('active');
  renderGymHistory();
}

function closeGymHistoryModal() {
  document.getElementById('gym-history-modal').classList.remove('active');
}

function renderGymHistory() {
  const list = document.getElementById('gym-history-list');
  if (state.gymWorkouts.length === 0) {
    list.innerHTML = '<p class="day-empty">No hay entrenamientos registrados</p>';
    return;
  }

  const sorted = [...state.gymWorkouts].sort((a, b) => b.date.localeCompare(a.date));

  list.innerHTML = sorted.map(w => {
    const dateObj = new Date(w.date + 'T12:00:00');
    const dateLabel = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    return `
      <div class="gym-history-item">
        <h4>${GYM_FOCUS[w.focus] || w.focus} - ${DAY_LABELS[w.day] || w.day}</h4>
        <div class="history-date">${dateLabel}</div>
        <div class="history-exercises">
          ${w.exercises.map(ex => {
            const setsInfo = ex.sets.map(s => `${s.reps}x${s.weight}kg`).join(', ');
            return `<div>${escapeHtml(ex.name)}: ${setsInfo}</div>`;
          }).join('')}
        </div>
        ${w.notes ? `<div class="history-notes">${escapeHtml(w.notes)}</div>` : ''}
      </div>
    `;
  }).join('');
}

function showExerciseInfo(exerciseName) {
  // Buscar el ejercicio en la base de datos
  const exercise = EJERCICIOS_DATABASE.find(ex =>
    ex.name.toLowerCase() === exerciseName.toLowerCase() ||
    exerciseName.toLowerCase().includes(ex.name.toLowerCase())
  );

  if (!exercise) {
    showNotification('No se encontrÃ³ informaciÃ³n para este ejercicio', 'warning');
    return;
  }

  // Crear y mostrar el modal con la informaciÃ³n del ejercicio
  const modal = document.getElementById('exercise-info-modal');
  const modalContent = modal.querySelector('.modal-content');

  modalContent.innerHTML = `
    <button class="modal-close" onclick="closeExerciseInfoModal()">Ã—</button>
    <h2><span class="accent">${escapeHtml(exercise.name)}</span></h2>
    <div class="exercise-info-content">
      <div class="exercise-image-container">
        <img src="${exercise.image}" alt="${escapeHtml(exercise.name)}" class="exercise-image" onerror="this.src='https://via.placeholder.com/400x300?text=Imagen+no+disponible'">
      </div>
      <div class="exercise-details">
        <div class="exercise-detail-item">
          <strong>Grupo muscular:</strong> ${escapeHtml(exercise.group.charAt(0).toUpperCase() + exercise.group.slice(1))}
        </div>
        <div class="exercise-detail-item">
          <strong>DescripciÃ³n:</strong> ${escapeHtml(exercise.description)}
        </div>
        <div class="exercise-detail-item">
          <strong>Tags:</strong> ${exercise.tags.map(tag => `<span class="exercise-tag">${escapeHtml(tag)}</span>`).join(' ')}
        </div>
      </div>
    </div>
    <div class="modal-buttons">
      <button type="button" class="btn-secondary" onclick="closeExerciseInfoModal()">Cerrar</button>
    </div>
  `;

  modal.classList.add('active');
}

function closeExerciseInfoModal() {
  document.getElementById('exercise-info-modal').classList.remove('active');
}

function showRoutineExercises(day) {
  const routine = state.gym[day];
  if (!routine) return;

  // Obtener lista de ejercicios
  let exercises = [];
  if (Array.isArray(routine.exercises)) {
    exercises = routine.exercises;
  } else if (typeof routine.exercises === 'string') {
    // Formato antiguo
    const lines = routine.exercises.split('\n').filter(l => l.trim());
    exercises = lines.map(line => {
      const match = line.match(/^(.+?)\s+(\d+)x(\d+)$/);
      if (match) {
        return {
          name: match[1].trim(),
          series: parseInt(match[2]),
          reps: parseInt(match[3]),
          weight: 0
        };
      }
      return null;
    }).filter(Boolean);
  }

  if (exercises.length === 0) {
    showNotification('Esta rutina no tiene ejercicios', 'warning');
    return;
  }

  // Crear el contenido del modal con todos los ejercicios
  const modal = document.getElementById('exercise-info-modal');
  const modalContent = modal.querySelector('.modal-content');

  const exercisesHTML = exercises.map(ex => {
    // Buscar el ejercicio en la base de datos
    const exerciseData = EJERCICIOS_DATABASE.find(e =>
      e.name.toLowerCase() === ex.name.toLowerCase() ||
      ex.name.toLowerCase().includes(e.name.toLowerCase())
    );

    const imageURL = exerciseData?.image || 'https://via.placeholder.com/400x300?text=Imagen+no+disponible';
    const description = exerciseData?.description || 'Sin descripciÃ³n disponible';
    const group = exerciseData?.group || 'general';

    return `
      <div class="routine-exercise-card">
        <div class="routine-exercise-header">
          <h3>${escapeHtml(ex.name)}</h3>
          <span class="routine-exercise-info">${ex.series}x${ex.reps}${ex.weight > 0 ? ` @ ${ex.weight}kg` : ''}</span>
        </div>
        <div class="routine-exercise-content">
          <div class="routine-exercise-image">
            <img src="${imageURL}" alt="${escapeHtml(ex.name)}" onerror="this.src='https://via.placeholder.com/400x300?text=Imagen+no+disponible'">
          </div>
          <div class="routine-exercise-details">
            <div class="routine-detail-item">
              <strong>Grupo muscular:</strong> ${escapeHtml(group.charAt(0).toUpperCase() + group.slice(1))}
            </div>
            <div class="routine-detail-item">
              <strong>DescripciÃ³n:</strong> ${escapeHtml(description)}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  modalContent.innerHTML = `
    <button class="modal-close" onclick="closeExerciseInfoModal()">Ã—</button>
    <h2><span class="accent">${DAY_LABELS[day]}</span> - ${GYM_FOCUS[routine.focus] || routine.focus}</h2>
    <div class="routine-exercises-container">
      ${exercisesHTML}
    </div>
    <div class="modal-buttons">
      <button type="button" class="btn-secondary" onclick="closeExerciseInfoModal()">Cerrar</button>
    </div>
  `;

  modal.classList.add('active');
}

// === EJERCICIOS ===
// ImÃ¡genes: Free Exercise DB (https://github.com/yuhonas/free-exercise-db) - Dominio PÃºblico
const EJERCICIOS_DATABASE = [
  // PECHO
  {
    id: 1,
    name: 'Press Banca',
    group: 'pecho',
    description: 'Ejercicio bÃ¡sico para el desarrollo del pecho. Trabaja pectoral mayor, deltoides anterior y trÃ­ceps.',
    tags: ['compuesto', 'fuerza', 'bÃ¡sico'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg'
  },
  {
    id: 2,
    name: 'Press Inclinado',
    group: 'pecho',
    description: 'Variante del press banca que enfatiza la porciÃ³n superior del pecho.',
    tags: ['compuesto', 'fuerza'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Incline_Bench_Press_-_Medium_Grip/0.jpg'
  },
  {
    id: 3,
    name: 'Aperturas con Mancuernas',
    group: 'pecho',
    description: 'Ejercicio de aislamiento para el pecho. Excelente para el estiramiento muscular.',
    tags: ['aislamiento', 'estiramiento'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Flyes/0.jpg'
  },
  {
    id: 4,
    name: 'Fondos en Paralelas',
    group: 'pecho',
    description: 'Ejercicio con peso corporal que trabaja pecho, trÃ­ceps y hombros.',
    tags: ['compuesto', 'peso corporal'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dips_-_Chest_Version/0.jpg'
  },
  {
    id: 5,
    name: 'Cruces en Polea',
    group: 'pecho',
    description: 'Ejercicio de aislamiento que permite tensiÃ³n constante en el pecho.',
    tags: ['aislamiento', 'cables'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crossover/0.jpg'
  },

  // ESPALDA
  {
    id: 6,
    name: 'Dominadas',
    group: 'espalda',
    description: 'Ejercicio bÃ¡sico para la espalda. Trabaja dorsal ancho, romboides y bÃ­ceps.',
    tags: ['compuesto', 'peso corporal', 'bÃ¡sico'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pullups/0.jpg'
  },
  {
    id: 7,
    name: 'Remo con Barra',
    group: 'espalda',
    description: 'Ejercicio compuesto fundamental para el grosor de la espalda.',
    tags: ['compuesto', 'fuerza', 'bÃ¡sico'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bent_Over_Barbell_Row/0.jpg'
  },
  {
    id: 8,
    name: 'JalÃ³n al Pecho',
    group: 'espalda',
    description: 'Alternativa a las dominadas. Trabaja el dorsal ancho.',
    tags: ['compuesto', 'cables'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Wide-Grip_Lat_Pulldown/0.jpg'
  },
  {
    id: 9,
    name: 'Remo en Polea Baja',
    group: 'espalda',
    description: 'Ejercicio para el grosor de la espalda con tensiÃ³n constante.',
    tags: ['compuesto', 'cables'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Cable_Rows/0.jpg'
  },
  {
    id: 10,
    name: 'Peso Muerto',
    group: 'espalda',
    description: 'Ejercicio compuesto que trabaja toda la cadena posterior.',
    tags: ['compuesto', 'fuerza', 'bÃ¡sico', 'full body'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg'
  },

  // PIERNAS
  {
    id: 11,
    name: 'Sentadilla',
    group: 'piernas',
    description: 'El rey de los ejercicios. Trabaja cuÃ¡driceps, glÃºteos y femorales.',
    tags: ['compuesto', 'fuerza', 'bÃ¡sico'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Full_Squat/0.jpg'
  },
  {
    id: 12,
    name: 'Prensa de Piernas',
    group: 'piernas',
    description: 'Alternativa a la sentadilla con menos carga en la columna.',
    tags: ['compuesto', 'mÃ¡quina'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/0.jpg'
  },
  {
    id: 13,
    name: 'ExtensiÃ³n de CuÃ¡driceps',
    group: 'piernas',
    description: 'Ejercicio de aislamiento para el cuÃ¡driceps.',
    tags: ['aislamiento', 'mÃ¡quina'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Extensions/0.jpg'
  },
  {
    id: 14,
    name: 'Curl Femoral',
    group: 'piernas',
    description: 'Ejercicio de aislamiento para los femorales.',
    tags: ['aislamiento', 'mÃ¡quina'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_Leg_Curls/0.jpg'
  },
  {
    id: 15,
    name: 'Zancadas',
    group: 'piernas',
    description: 'Ejercicio unilateral para piernas y glÃºteos.',
    tags: ['compuesto', 'unilateral'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Lunges/0.jpg'
  },
  {
    id: 16,
    name: 'ElevaciÃ³n de Gemelos',
    group: 'piernas',
    description: 'Ejercicio especÃ­fico para los gemelos.',
    tags: ['aislamiento'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Calf_Raises/0.jpg'
  },

  // HOMBROS
  {
    id: 17,
    name: 'Press Militar',
    group: 'hombros',
    description: 'Ejercicio bÃ¡sico para el desarrollo de hombros.',
    tags: ['compuesto', 'fuerza', 'bÃ¡sico'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Shoulder_Press/0.jpg'
  },
  {
    id: 18,
    name: 'Elevaciones Laterales',
    group: 'hombros',
    description: 'Ejercicio de aislamiento para el deltoides medio.',
    tags: ['aislamiento'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Side_Lateral_Raise/0.jpg'
  },
  {
    id: 19,
    name: 'Elevaciones Frontales',
    group: 'hombros',
    description: 'Ejercicio de aislamiento para el deltoides anterior.',
    tags: ['aislamiento'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Front_Dumbbell_Raise/0.jpg'
  },
  {
    id: 20,
    name: 'PÃ¡jaros',
    group: 'hombros',
    description: 'Ejercicio para el deltoides posterior.',
    tags: ['aislamiento'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_Rear_Delt_Raise/0.jpg'
  },
  {
    id: 21,
    name: 'Face Pulls',
    group: 'hombros',
    description: 'Ejercicio para deltoides posterior y salud del hombro.',
    tags: ['cables', 'salud articular'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Face_Pull/0.jpg'
  },

  // BRAZOS
  {
    id: 22,
    name: 'Curl con Barra',
    group: 'brazos',
    description: 'Ejercicio bÃ¡sico para el desarrollo del bÃ­ceps.',
    tags: ['aislamiento', 'bÃ­ceps', 'bÃ¡sico'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Curl/0.jpg'
  },
  {
    id: 23,
    name: 'Curl con Mancuernas',
    group: 'brazos',
    description: 'Variante del curl que permite mayor rango de movimiento.',
    tags: ['aislamiento', 'bÃ­ceps'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Bicep_Curl/0.jpg'
  },
  {
    id: 24,
    name: 'Curl Martillo',
    group: 'brazos',
    description: 'Ejercicio para bÃ­ceps y braquial.',
    tags: ['aislamiento', 'bÃ­ceps'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hammer_Curls/0.jpg'
  },
  {
    id: 25,
    name: 'Press FrancÃ©s',
    group: 'brazos',
    description: 'Ejercicio de aislamiento para el trÃ­ceps.',
    tags: ['aislamiento', 'trÃ­ceps'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_Triceps_Press/0.jpg'
  },
  {
    id: 26,
    name: 'Extensiones en Polea',
    group: 'brazos',
    description: 'Ejercicio para trÃ­ceps con tensiÃ³n constante.',
    tags: ['aislamiento', 'trÃ­ceps', 'cables'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown/0.jpg'
  },
  {
    id: 27,
    name: 'Fondos para TrÃ­ceps',
    group: 'brazos',
    description: 'Ejercicio con peso corporal para trÃ­ceps.',
    tags: ['aislamiento', 'trÃ­ceps', 'peso corporal'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bench_Dips/0.jpg'
  },

  // CORE
  {
    id: 28,
    name: 'Plancha',
    group: 'core',
    description: 'Ejercicio isomÃ©trico bÃ¡sico para el core.',
    tags: ['isomÃ©trico', 'peso corporal', 'bÃ¡sico'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/0.jpg'
  },
  {
    id: 29,
    name: 'Crunch Abdominal',
    group: 'core',
    description: 'Ejercicio bÃ¡sico para el recto abdominal.',
    tags: ['aislamiento', 'peso corporal'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Crunches/0.jpg'
  },
  {
    id: 30,
    name: 'ElevaciÃ³n de Piernas',
    group: 'core',
    description: 'Ejercicio para la porciÃ³n inferior del core.',
    tags: ['peso corporal'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hanging_Leg_Raise/0.jpg'
  },
  {
    id: 31,
    name: 'Russian Twist',
    group: 'core',
    description: 'Ejercicio para oblicuos y rotaciÃ³n del core.',
    tags: ['peso corporal', 'rotacional'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Russian_Twist/0.jpg'
  },
  {
    id: 32,
    name: 'Rueda Abdominal',
    group: 'core',
    description: 'Ejercicio avanzado para todo el core.',
    tags: ['peso corporal', 'avanzado'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Ab_Roller/0.jpg'
  },

  // MAQUINAS Y POLEAS (NUEVOS)
  {
    id: 33,
    name: 'Chest press mÃ¡quina',
    group: 'pecho',
    description: 'Press de pecho en mÃ¡quina. Rango recomendado: 4x8-12.',
    tags: ['compuesto', 'mÃ¡quina', 'pecho'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Machine_Bench_Press/0.jpg'
  },
  {
    id: 34,
    name: 'Press inclinado mÃ¡quina',
    group: 'pecho',
    description: 'Press inclinado en mÃ¡quina para la porciÃ³n superior del pecho. Rango recomendado: 3x8-12.',
    tags: ['compuesto', 'mÃ¡quina', 'pecho superior'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leverage_Incline_Chest_Press/0.jpg'
  },
  {
    id: 35,
    name: 'Pec deck (aperturas)',
    group: 'pecho',
    description: 'Aislamiento de pecho en mÃ¡quina tipo pec deck. Rango recomendado: 3x10-12.',
    tags: ['aislamiento', 'mÃ¡quina', 'pecho'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Butterfly/0.jpg'
  },
  {
    id: 36,
    name: 'Fondos asistidos mÃ¡quina',
    group: 'pecho',
    description: 'Fondos asistidos en mÃ¡quina con enfoque en pecho y trÃ­ceps. Rango recomendado: 3x8-10.',
    tags: ['compuesto', 'mÃ¡quina', 'asistido'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dip_Machine/0.jpg'
  },
  {
    id: 37,
    name: 'ExtensiÃ³n trÃ­ceps en polea',
    group: 'brazos',
    description: 'Trabajo de trÃ­ceps en polea con tensiÃ³n constante. Rango recomendado: 3x10-12.',
    tags: ['aislamiento', 'trÃ­ceps', 'cables'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown/0.jpg'
  },
  {
    id: 38,
    name: 'JalÃ³n al pecho mÃ¡quina',
    group: 'espalda',
    description: 'JalÃ³n al pecho en mÃ¡quina/polea para dorsal ancho. Rango recomendado: 4x8-12.',
    tags: ['compuesto', 'espalda', 'mÃ¡quina'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Wide-Grip_Lat_Pulldown/0.jpg'
  },
  {
    id: 39,
    name: 'Remo sentado mÃ¡quina',
    group: 'espalda',
    description: 'Remo sentado en mÃ¡quina para dorsales y romboides. Rango recomendado: 4x8-12.',
    tags: ['compuesto', 'espalda', 'mÃ¡quina'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Cable_Rows/0.jpg'
  },
  {
    id: 40,
    name: 'Pullover mÃ¡quina',
    group: 'espalda',
    description: 'Pullover enfocado en dorsal ancho. Rango recomendado: 3x10-12.',
    tags: ['aislamiento', 'espalda', 'mÃ¡quina'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bent-Arm_Dumbbell_Pullover/0.jpg'
  },
  {
    id: 41,
    name: 'Curl bÃ­ceps mÃ¡quina',
    group: 'brazos',
    description: 'Curl de bÃ­ceps en mÃ¡quina. Rango recomendado: 3-4x10-12.',
    tags: ['aislamiento', 'bÃ­ceps', 'mÃ¡quina'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Machine_Bicep_Curl/0.jpg'
  },
  {
    id: 42,
    name: 'Curl bÃ­ceps en polea',
    group: 'brazos',
    description: 'Curl de bÃ­ceps en polea. Rango recomendado: 3x10-12.',
    tags: ['aislamiento', 'bÃ­ceps', 'cables'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/High_Cable_Curls/0.jpg'
  },
  {
    id: 43,
    name: 'Prensa de piernas mÃ¡quina',
    group: 'piernas',
    description: 'Prensa de piernas en mÃ¡quina. Rango recomendado: 4x8-12.',
    tags: ['compuesto', 'piernas', 'mÃ¡quina'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/0.jpg'
  },
  {
    id: 44,
    name: 'Press hombro mÃ¡quina',
    group: 'hombros',
    description: 'Press de hombro en mÃ¡quina. Rango recomendado: 4x8-12.',
    tags: ['compuesto', 'hombros', 'mÃ¡quina'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Machine_Shoulder_Military_Press/0.jpg'
  },
  {
    id: 45,
    name: 'Elevaciones laterales mÃ¡quina',
    group: 'hombros',
    description: 'Elevaciones laterales en mÃ¡quina/cable para deltoide medio. Rango recomendado: 4x10-12.',
    tags: ['aislamiento', 'hombros', 'mÃ¡quina'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Seated_Lateral_Raise/0.jpg'
  },
  {
    id: 46,
    name: 'Deltoide posterior mÃ¡quina',
    group: 'hombros',
    description: 'Trabajo especÃ­fico de deltoide posterior en mÃ¡quina. Rango recomendado: 3x10-12.',
    tags: ['aislamiento', 'hombros', 'posterior'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Rear_Delt_Fly/0.jpg'
  },
  {
    id: 47,
    name: 'Shoulder press convergente mÃ¡quina',
    group: 'hombros',
    description: 'Press convergente en mÃ¡quina para hombros. Rango recomendado: 3x8-12.',
    tags: ['compuesto', 'hombros', 'mÃ¡quina'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leverage_Shoulder_Press/0.jpg'
  },
  {
    id: 48,
    name: 'ExtensiÃ³n cuÃ¡driceps mÃ¡quina',
    group: 'piernas',
    description: 'Aislamiento de cuÃ¡driceps en mÃ¡quina. Rango recomendado: 4x10-12.',
    tags: ['aislamiento', 'piernas', 'cuÃ¡driceps', 'mÃ¡quina'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Extensions/0.jpg'
  },
  {
    id: 49,
    name: 'Curl femoral mÃ¡quina',
    group: 'piernas',
    description: 'Aislamiento de femorales en mÃ¡quina. Rango recomendado: 4x10-12.',
    tags: ['aislamiento', 'piernas', 'femorales', 'mÃ¡quina'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_Leg_Curls/0.jpg'
  },
  {
    id: 50,
    name: 'Abductor mÃ¡quina',
    group: 'piernas',
    description: 'Trabajo de abductores/aductores en mÃ¡quina. Rango recomendado: 3x12.',
    tags: ['aislamiento', 'piernas', 'mÃ¡quina'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Adductor/0.jpg'
  },
  {
    id: 51,
    name: 'Gemelos mÃ¡quina',
    group: 'piernas',
    description: 'Trabajo de gemelos en mÃ¡quina. Rango recomendado: 4x12-15.',
    tags: ['aislamiento', 'piernas', 'gemelos', 'mÃ¡quina'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Calf_Press_On_The_Leg_Press_Machine/0.jpg'
  },
  {
    id: 52,
    name: 'ExtensiÃ³n trÃ­ceps mÃ¡quina',
    group: 'brazos',
    description: 'Aislamiento de trÃ­ceps en mÃ¡quina. Rango recomendado: 3x10-12.',
    tags: ['aislamiento', 'trÃ­ceps', 'mÃ¡quina'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Machine_Triceps_Extension/0.jpg'
  },
  {
    id: 53,
    name: 'TrÃ­ceps polea cuerda',
    group: 'brazos',
    description: 'ExtensiÃ³n de trÃ­ceps en polea con cuerda. Rango recomendado: 3x10-12.',
    tags: ['aislamiento', 'trÃ­ceps', 'cables'],
    image: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Rope_Overhead_Triceps_Extension/0.jpg'
  }
];

function renderEjercicios() {
  const filter = document.getElementById('ejercicios-filter').value;
  const ejerciciosGrid = document.getElementById('ejercicios-grid');

  const ejerciciosFiltrados = filter
    ? EJERCICIOS_DATABASE.filter(e => e.group === filter)
    : EJERCICIOS_DATABASE;

  if (ejerciciosFiltrados.length === 0) {
    ejerciciosGrid.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">No hay ejercicios en esta categorÃ­a.</p>';
    return;
  }

  ejerciciosGrid.innerHTML = ejerciciosFiltrados.map(ejercicio => `
    <div class="ejercicio-card">
      <img src="${ejercicio.image}" alt="${escapeHtml(ejercicio.name)}" class="ejercicio-image">
      <div class="ejercicio-content">
        <h4 class="ejercicio-name">${escapeHtml(ejercicio.name)}</h4>
        <span class="ejercicio-group">${escapeHtml(ejercicio.group.toUpperCase())}</span>
        <p class="ejercicio-description">${escapeHtml(ejercicio.description)}</p>
        <div class="ejercicio-tags">
          ${ejercicio.tags.map(tag => `<span class="ejercicio-tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

// === CRONÃ“METRO ===
let cronometroInterval = null;

function normalizeCronometroState() {
  if (!state.cronometro || typeof state.cronometro !== 'object') {
    state.cronometro = { isRunning: false, timeLeft: 60, totalTime: 60, interval: null };
    return;
  }

  const total = Number(state.cronometro.totalTime);
  const left = Number(state.cronometro.timeLeft);
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 60;
  let safeLeft = Number.isFinite(left) && left >= 0 ? Math.floor(left) : safeTotal;
  if (safeLeft > safeTotal) safeLeft = safeTotal;

  state.cronometro.totalTime = safeTotal;
  state.cronometro.timeLeft = safeLeft;
  state.cronometro.isRunning = state.cronometro.isRunning === true;
}

function renderCronometro() {
  normalizeCronometroState();
  updateCronometroDisplay();
}

function updateCronometroDisplay() {
  normalizeCronometroState();
  const mins = Math.floor(state.cronometro.timeLeft / 60);
  const secs = state.cronometro.timeLeft % 60;
  const timerEl = document.getElementById('cronometro-timer');
  if (timerEl) {
    timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Update progress ring
  const progress = 1 - (state.cronometro.timeLeft / state.cronometro.totalTime);
  const circumference = 2 * Math.PI * 150;
  const offset = circumference * (1 - progress);
  const ringEl = document.getElementById('cronometro-progress-ring-fill');
  if (ringEl) {
    ringEl.style.strokeDashoffset = offset;
  }
}

function startCronometro() {
  normalizeCronometroState();
  if (state.cronometro.isRunning) {
    pauseCronometro();
    return;
  }

  if (state.cronometro.timeLeft <= 0) {
    state.cronometro.timeLeft = state.cronometro.totalTime;
  }

  state.cronometro.isRunning = true;
  const startBtn = document.getElementById('cronometro-start');
  if (startBtn) startBtn.textContent = 'Pausar';

  cronometroInterval = setInterval(() => {
    state.cronometro.timeLeft--;

    if (state.cronometro.timeLeft <= 0) {
      completeCronometro();
    }

    updateCronometroDisplay();
  }, 1000);
}

function pauseCronometro() {
  normalizeCronometroState();
  state.cronometro.isRunning = false;
  clearInterval(cronometroInterval);
  const startBtn = document.getElementById('cronometro-start');
  if (startBtn) startBtn.textContent = 'Reanudar';
}

function resetCronometro() {
  normalizeCronometroState();
  pauseCronometro();
  state.cronometro.isRunning = false;
  clearInterval(cronometroInterval);
  state.cronometro.timeLeft = state.cronometro.totalTime;
  const startBtn = document.getElementById('cronometro-start');
  if (startBtn) startBtn.textContent = 'Iniciar';
  updateCronometroDisplay();
}

function completeCronometro() {
  normalizeCronometroState();
  clearInterval(cronometroInterval);
  state.cronometro.isRunning = false;
  showNotification('Â¡Tiempo completado! â°', 'success');
  playNotificationSound();
  const startBtn = document.getElementById('cronometro-start');
  if (startBtn) startBtn.textContent = 'Iniciar';
  state.cronometro.timeLeft = state.cronometro.totalTime;
  updateCronometroDisplay();
}

function setCronometroTime(totalSeconds) {
  normalizeCronometroState();
  if (state.cronometro.isRunning) {
    showNotification('Pausa el cronÃ³metro antes de cambiar el tiempo', 'warning');
    return;
  }
  const safeSeconds = Math.floor(Number(totalSeconds));
  if (!Number.isFinite(safeSeconds) || safeSeconds <= 0) {
    showNotification('Tiempo no valido para el cronometro', 'warning');
    return;
  }
  state.cronometro.totalTime = safeSeconds;
  state.cronometro.timeLeft = safeSeconds;
  updateCronometroDisplay();
}

function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    const melody = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    const noteDuration = 0.14;
    const noteGap = 0.03;
    const startAt = audioContext.currentTime + 0.02;

    melody.forEach((frequency, index) => {
      const noteStart = startAt + index * (noteDuration + noteGap);
      const noteEnd = noteStart + noteDuration;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, noteStart);

      gainNode.gain.setValueAtTime(0.0001, noteStart);
      gainNode.gain.exponentialRampToValueAtTime(0.22, noteStart + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.01);
    });

    const totalDuration = melody.length * (noteDuration + noteGap) + 0.2;
    setTimeout(() => {
      audioContext.close().catch(() => {});
    }, totalDuration * 1000);
  } catch (e) {
    console.error('Error playing sound:', e);
  }
}

// === MIS DATOS ===
function renderMisDatos() {
  // Cargar datos guardados
  const datos = state.misDatos;

  document.getElementById('misdatos-nombre').value = datos.nombre || '';
  document.getElementById('misdatos-edad').value = datos.edad || '';
  document.getElementById('misdatos-genero').value = datos.genero || '';
  document.getElementById('misdatos-fecha-nacimiento').value = datos.fechaNacimiento || '';
  document.getElementById('misdatos-altura').value = datos.altura || '';
  document.getElementById('misdatos-peso').value = datos.peso || '';
  document.getElementById('misdatos-objetivo').value = datos.objetivo || '';
  document.getElementById('misdatos-nivel-actividad').value = datos.nivelActividad || '';

  // InformaciÃ³n avanzada
  document.getElementById('misdatos-grasa-corporal').value = datos.grasaCorporal || '';
  document.getElementById('misdatos-masa-muscular').value = datos.masaMuscular || '';
  document.getElementById('misdatos-grasa-visceral').value = datos.grasaVisceral || '';
  document.getElementById('misdatos-agua-corporal').value = datos.aguaCorporal || '';
  document.getElementById('misdatos-masa-osea').value = datos.masaOsea || '';
  document.getElementById('misdatos-metabolismo-basal').value = datos.metabolismoBasal || '';

  // PerÃ­metros
  document.getElementById('misdatos-perimetro-pecho').value = datos.perimetroPecho || '';
  document.getElementById('misdatos-perimetro-cintura').value = datos.perimetroCintura || '';
  document.getElementById('misdatos-perimetro-cadera').value = datos.perimetroCadera || '';
  document.getElementById('misdatos-perimetro-muslo').value = datos.perimetroMuslo || '';
  document.getElementById('misdatos-perimetro-brazo').value = datos.perimetroBrazo || '';
  document.getElementById('misdatos-perimetro-antebrazo').value = datos.perimetroAntebrazo || '';
  document.getElementById('misdatos-perimetro-pantorrilla').value = datos.perimetroPantorrilla || '';
  document.getElementById('misdatos-perimetro-cuello').value = datos.perimetroCuello || '';

  // Calcular y mostrar estadÃ­sticas
  actualizarEstadisticasMisDatos();
}

function handleMisDatosSubmit(e) {
  e.preventDefault();

  // Guardar datos en el state
  state.misDatos = {
    nombre: document.getElementById('misdatos-nombre').value.trim(),
    edad: document.getElementById('misdatos-edad').value,
    genero: document.getElementById('misdatos-genero').value,
    fechaNacimiento: document.getElementById('misdatos-fecha-nacimiento').value,
    altura: document.getElementById('misdatos-altura').value,
    peso: document.getElementById('misdatos-peso').value,
    objetivo: document.getElementById('misdatos-objetivo').value,
    nivelActividad: document.getElementById('misdatos-nivel-actividad').value,
    // InformaciÃ³n avanzada
    grasaCorporal: document.getElementById('misdatos-grasa-corporal').value,
    masaMuscular: document.getElementById('misdatos-masa-muscular').value,
    grasaVisceral: document.getElementById('misdatos-grasa-visceral').value,
    aguaCorporal: document.getElementById('misdatos-agua-corporal').value,
    masaOsea: document.getElementById('misdatos-masa-osea').value,
    metabolismoBasal: document.getElementById('misdatos-metabolismo-basal').value,
    // PerÃ­metros
    perimetroPecho: document.getElementById('misdatos-perimetro-pecho').value,
    perimetroCintura: document.getElementById('misdatos-perimetro-cintura').value,
    perimetroCadera: document.getElementById('misdatos-perimetro-cadera').value,
    perimetroMuslo: document.getElementById('misdatos-perimetro-muslo').value,
    perimetroBrazo: document.getElementById('misdatos-perimetro-brazo').value,
    perimetroAntebrazo: document.getElementById('misdatos-perimetro-antebrazo').value,
    perimetroPantorrilla: document.getElementById('misdatos-perimetro-pantorrilla').value,
    perimetroCuello: document.getElementById('misdatos-perimetro-cuello').value
  };

  saveToStorage();
  actualizarEstadisticasMisDatos();
  showNotification('Datos guardados correctamente âœ…', 'success');
}

function actualizarEstadisticasMisDatos() {
  const altura = parseFloat(state.misDatos.altura);
  const peso = parseFloat(state.misDatos.peso);

  if (altura && peso) {
    // Calcular IMC
    const imc = calcularIMC(peso, altura);
    document.getElementById('misdatos-imc').textContent = imc.toFixed(1);

    // Mostrar categorÃ­a del IMC
    let categoria = '';
    let color = '';
    if (imc < 18.5) {
      categoria = 'Bajo peso';
      color = '#fbbf24';
    } else if (imc >= 18.5 && imc < 25) {
      categoria = 'Peso normal';
      color = '#10b981';
    } else if (imc >= 25 && imc < 30) {
      categoria = 'Sobrepeso';
      color = '#f59e0b';
    } else {
      categoria = 'Obesidad';
      color = '#ef4444';
    }

    const descElement = document.getElementById('misdatos-imc-desc');
    descElement.textContent = categoria;
    descElement.style.color = color;

    // Calcular peso ideal (fÃ³rmula de Devine)
    const pesoIdeal = calcularPesoIdeal(altura, state.misDatos.genero);
    if (pesoIdeal) {
      document.getElementById('misdatos-peso-ideal').textContent = pesoIdeal.toFixed(1) + ' kg';
    } else {
      document.getElementById('misdatos-peso-ideal').textContent = '--';
    }
  } else {
    document.getElementById('misdatos-imc').textContent = '--';
    document.getElementById('misdatos-imc-desc').textContent = 'Ingresa altura y peso';
    document.getElementById('misdatos-imc-desc').style.color = '';
    document.getElementById('misdatos-peso-ideal').textContent = '--';
  }
}

function calcularIMC(peso, altura) {
  // Convertir altura de cm a metros
  const alturaMetros = altura / 100;
  return peso / (alturaMetros * alturaMetros);
}

function calcularPesoIdeal(altura, genero) {
  // FÃ³rmula de Devine
  // Hombres: 50 kg + 2.3 kg por cada pulgada sobre 5 pies
  // Mujeres: 45.5 kg + 2.3 kg por cada pulgada sobre 5 pies

  if (!genero) return null;

  const alturaCm = parseFloat(altura);
  if (!alturaCm) return null;

  // Convertir altura a pulgadas
  const pulgadas = alturaCm / 2.54;
  const pulgadasSobre5Pies = pulgadas - 60; // 5 pies = 60 pulgadas

  if (genero === 'masculino') {
    return 50 + (2.3 * pulgadasSobre5Pies);
  } else if (genero === 'femenino') {
    return 45.5 + (2.3 * pulgadasSobre5Pies);
  } else {
    // Para "otro", usar promedio
    return 47.75 + (2.3 * pulgadasSobre5Pies);
  }
}

// === PROGRESO ===
const progresoModal = document.getElementById('progreso-modal');

function renderProgreso() {
  calcularEstadisticasProgreso();
  
  const chartWrapper = document.getElementById('progreso-chart-wrapper');
  if (!chartWrapper) return;
  
  if (state.progresos.length === 0) {
    chartWrapper.innerHTML = `
      <div class="progreso-empty-chart">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
        <p>No tienes ningÃºn progreso aÃ±adido</p>
        <button class="btn-primary" id="empty-progreso-btn" onclick="openProgresoModal()">+ Crear progreso</button>
      </div>
    `;
  } else {
    chartWrapper.innerHTML = '<canvas id="chart-progreso-peso"></canvas>';
    renderGraficaProgreso();
  }

  // Renderizar lista lateral de progresos
  renderProgresoList();
}

function renderProgresoList() {
  const progresoList = document.getElementById('progreso-list');
  if (!progresoList) return;

  if (state.progresos.length === 0) {
    progresoList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem 1rem;">Sin progresos</p>';
    return;
  }

  progresoList.innerHTML = state.progresos.map(progreso => {
    const fechaObj = new Date(progreso.fecha);
    const fechaFormato = formatDate(fechaObj);
    const tieneFoto = progreso.foto !== null && progreso.foto !== undefined && progreso.foto !== '';
    
    // evitar que el click en el ojo active el click del item
    const eyeBtn = tieneFoto ? `<button class="progreso-list-item-eye-btn" onclick="event.stopPropagation(); viewProgresoPhoto('${progreso.id}')" title="Ver foto" aria-label="Ver foto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>` : '';

    return `
      <div class="progreso-list-item" onclick="openProgresoModalForId && openProgresoModalForId('${progreso.id}')">
        <div class="progreso-list-item-header">
          <div class="progreso-list-item-info">
            <div class="progreso-list-item-fecha">${fechaFormato}</div>
            <div class="progreso-list-item-peso">${progreso.peso} kg</div>
          </div>
          ${eyeBtn}
        </div>
      </div>
    `;
  }).join('');
}

function viewProgresoPhoto(id) {
  const progreso = state.progresos.find(p => p.id === id);
  if (!progreso || !progreso.foto) return;
  // Crear modal accesible y con cierre fiable
  const modal = document.createElement('div');
  modal.className = 'progreso-photo-modal';
  modal.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:9999; padding:1rem;`;

  const inner = document.createElement('div');
  inner.style.cssText = 'background: var(--bg-card); border-radius: var(--radius-md); padding: 1rem; max-width: 90vw; max-height: 90vh; overflow: auto; position: relative;';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'progreso-photo-close';
  closeBtn.setAttribute('aria-label', 'Cerrar imagen');
  closeBtn.innerHTML = 'âœ•';
  closeBtn.style.cssText = 'position:absolute; top:0.6rem; right:0.6rem; background: transparent; border: none; font-size: 1.4rem; cursor: pointer; color: var(--text-primary);';
  closeBtn.addEventListener('click', () => modal.remove());

  const img = document.createElement('img');
  img.src = progreso.foto;
  img.style.cssText = 'max-width:100%; height:auto; border-radius: var(--radius-md); display:block; margin: 1.5rem 0 0 0;';

  const fechaP = document.createElement('p');
  fechaP.style.cssText = 'color: var(--text-secondary); margin-top:1rem; font-size:0.9rem;';
  fechaP.textContent = `Fecha: ${formatDate(new Date(progreso.fecha))}`;

  inner.appendChild(closeBtn);
  inner.appendChild(img);
  inner.appendChild(fechaP);
  modal.appendChild(inner);
  document.body.appendChild(modal);

  // cerrar al hacer click fuera
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function openProgresoModal() {
  document.getElementById('progreso-fecha').value = today();
  document.getElementById('progreso-peso-input').value = '';
  document.getElementById('progreso-foto').value = '';
  document.getElementById('progreso-notas-input').value = '';
  document.getElementById('progreso-foto-preview').innerHTML = '';
  document.getElementById('progreso-foto-preview').classList.remove('active');
  progresoModal.classList.add('active');
}

function closeProgresoModal() {
  progresoModal.classList.remove('active');
}

function handleProgresoSubmit(e) {
  e.preventDefault();

  const fecha = document.getElementById('progreso-fecha').value;
  const peso = parseFloat(document.getElementById('progreso-peso-input').value);
  const notas = document.getElementById('progreso-notas-input').value.trim();
  const fotoInput = document.getElementById('progreso-foto');

  const nuevoProgreso = {
    id: generateId(),
    fecha: fecha,
    peso: peso,
    notas: notas,
    foto: null
  };

  // Manejar la foto si se seleccionÃ³
  if (fotoInput.files && fotoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      nuevoProgreso.foto = e.target.result;
      state.progresos.push(nuevoProgreso);
      state.progresos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      saveToStorage();
      closeProgresoModal();
      renderProgreso();
      showNotification('Progreso registrado correctamente âœ…', 'success');
    };
    reader.readAsDataURL(fotoInput.files[0]);
  } else {
    state.progresos.push(nuevoProgreso);
    state.progresos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    saveToStorage();
    closeProgresoModal();
    renderProgreso();
    showNotification('Progreso registrado correctamente âœ…', 'success');
  }
}

function deleteProgreso(id) {
  if (!confirm('Â¿Eliminar este registro de progreso?')) return;
  state.progresos = state.progresos.filter(p => p.id !== id);
  saveToStorage();
  renderProgreso();
  showNotification('Registro eliminado', 'success');
}

function calcularEstadisticasProgreso() {
  const progresos = state.progresos;

  if (progresos.length === 0) {
    document.getElementById('progreso-peso-actual').textContent = '--';
    document.getElementById('progreso-cambio-semana').textContent = 'Sin datos';
    document.getElementById('progreso-cambio-total').textContent = '--';
    document.getElementById('progreso-desde-inicio').textContent = 'Sin datos';
    document.getElementById('progreso-cambio-mes').textContent = '--';
    document.getElementById('progreso-mes-desc').textContent = 'Sin datos';
    document.getElementById('progreso-total-registros').textContent = '0';
    return;
  }

  // Peso actual (registro mÃ¡s reciente)
  const pesoActual = progresos[0].peso;
  document.getElementById('progreso-peso-actual').textContent = pesoActual.toFixed(1) + ' kg';
  document.getElementById('progreso-total-registros').textContent = progresos.length;

  // Cambio desde el inicio
  if (progresos.length > 1) {
    const pesoInicial = progresos[progresos.length - 1].peso;
    const cambioTotal = pesoActual - pesoInicial;
    const cambioTotalEl = document.getElementById('progreso-cambio-total');
    cambioTotalEl.textContent = (cambioTotal >= 0 ? '+' : '') + cambioTotal.toFixed(1) + ' kg';
    document.getElementById('progreso-desde-inicio').textContent = 'Desde ' + formatDate(new Date(progresos[progresos.length - 1].fecha));
  } else {
    document.getElementById('progreso-cambio-total').textContent = '--';
    document.getElementById('progreso-desde-inicio').textContent = 'Primer registro';
  }

  // Cambio Ãºltima semana
  const hace7Dias = new Date();
  hace7Dias.setDate(hace7Dias.getDate() - 7);
  const progresoSemana = progresos.find(p => new Date(p.fecha) <= hace7Dias);

  if (progresoSemana) {
    const cambioSemana = pesoActual - progresoSemana.peso;
    const cambioSemanaEl = document.getElementById('progreso-cambio-semana');
    cambioSemanaEl.textContent = (cambioSemana >= 0 ? '+' : '') + cambioSemana.toFixed(1) + ' kg Ãºltima semana';
    cambioSemanaEl.className = 'progreso-stat-change';
    if (cambioSemana > 0) cambioSemanaEl.classList.add('positive');
    else if (cambioSemana < 0) cambioSemanaEl.classList.add('negative');
  } else {
    document.getElementById('progreso-cambio-semana').textContent = 'Sin datos previos';
    document.getElementById('progreso-cambio-semana').className = 'progreso-stat-change';
  }

  // Cambio Ãºltimo mes
  const hace30Dias = new Date();
  hace30Dias.setDate(hace30Dias.getDate() - 30);
  const progresoMes = progresos.find(p => new Date(p.fecha) <= hace30Dias);

  if (progresoMes) {
    const cambioMes = pesoActual - progresoMes.peso;
    document.getElementById('progreso-cambio-mes').textContent = (cambioMes >= 0 ? '+' : '') + cambioMes.toFixed(1) + ' kg';
    document.getElementById('progreso-mes-desc').textContent = 'Ãšltimo mes';
  } else {
    document.getElementById('progreso-cambio-mes').textContent = '--';
    document.getElementById('progreso-mes-desc').textContent = 'Sin datos suficientes';
  }
}

function renderHistorialProgreso() {
  const container = document.getElementById('progreso-historial-list');
  const progresos = state.progresos;

  if (progresos.length === 0) {
    container.innerHTML = `
      <div class="progreso-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
        <p>No hay registros de progreso aÃºn.</p>
        <p style="font-size: 0.9rem; margin-top: 0.5rem;">Comienza a registrar tu peso para ver tu evoluciÃ³n.</p>
      </div>
    `;
    return;
  }

  let html = '';
  progresos.forEach((progreso, index) => {
    const fecha = new Date(progreso.fecha);
    const fechaStr = fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    let cambioHtml = '';
    if (index < progresos.length - 1) {
      const cambio = progreso.peso - progresos[index + 1].peso;
      const cambioClass = cambio > 0 ? 'positive' : cambio < 0 ? 'negative' : 'neutral';
      const cambioText = cambio > 0 ? `+${cambio.toFixed(1)} kg` : cambio < 0 ? `${cambio.toFixed(1)} kg` : 'Sin cambio';
      cambioHtml = `<span class="progreso-item-cambio ${cambioClass}">${cambioText}</span>`;
    }

    const fotoHtml = progreso.foto
      ? `<img src="${progreso.foto}" alt="Progreso">`
      : `<div class="progreso-item-foto-placeholder">ðŸ“¸</div>`;

    html += `
      <div class="progreso-item">
        <div class="progreso-item-foto">
          ${fotoHtml}
        </div>
        <div class="progreso-item-info">
          <div class="progreso-item-header">
            <span class="progreso-item-peso">${progreso.peso.toFixed(1)} kg</span>
            <span class="progreso-item-fecha">${fechaStr}</span>
            ${cambioHtml}
          </div>
          ${progreso.notas ? `<div class="progreso-item-notas">${escapeHtml(progreso.notas)}</div>` : ''}
        </div>
        <button class="progreso-item-delete" onclick="deleteProgreso('${progreso.id}')" title="Eliminar">ðŸ—‘ï¸</button>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderGraficaProgreso() {
  const canvas = document.getElementById('chart-progreso-peso');
  if (!canvas || typeof Chart === 'undefined') return;

  // Destruir grÃ¡fica previa si existe
  if (window.chartProgresoPeso) {
    window.chartProgresoPeso.destroy();
  }

  const progresos = state.progresos;
  if (progresos.length === 0) return;

  // Ordenar por fecha ascendente para la grÃ¡fica
  const datosOrdenados = [...progresos].reverse();

  const labels = datosOrdenados.map(p => {
    const fecha = new Date(p.fecha);
    return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  });

  const datos = datosOrdenados.map(p => p.peso);

  try {
    window.chartProgresoPeso = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Peso (kg)',
          data: datos,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            displayColors: false,
            callbacks: {
              label: function(context) {
                return `Peso: ${context.parsed.y.toFixed(1)} kg`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            ticks: {
              callback: function(value) {
                return value.toFixed(1) + ' kg';
              }
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error al renderizar grÃ¡fica de progreso:', error);
  }
}

// Event listeners para progreso
document.getElementById('add-progreso-btn')?.addEventListener('click', openProgresoModal);
document.getElementById('cancel-progreso-btn')?.addEventListener('click', closeProgresoModal);
document.getElementById('progreso-form')?.addEventListener('submit', handleProgresoSubmit);
document.getElementById('progreso-modal')?.addEventListener('click', e => {
  if (e.target.id === 'progreso-modal') closeProgresoModal();
});

// Preview de foto
document.getElementById('progreso-foto')?.addEventListener('change', function(e) {
  const preview = document.getElementById('progreso-foto-preview');
  const file = e.target.files[0];

  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
      preview.classList.add('active');
    };
    reader.readAsDataURL(file);
  } else {
    preview.innerHTML = '';
    preview.classList.remove('active');
  }
});

// Event listener para el formulario de Mis Datos
document.getElementById('misdatos-form')?.addEventListener('submit', handleMisDatosSubmit);

// Event listeners para actualizar estadÃ­sticas en tiempo real
document.getElementById('misdatos-altura')?.addEventListener('input', actualizarEstadisticasMisDatos);
document.getElementById('misdatos-peso')?.addEventListener('input', actualizarEstadisticasMisDatos);
document.getElementById('misdatos-genero')?.addEventListener('change', actualizarEstadisticasMisDatos);

// CronÃ³metro Event Listeners
document.getElementById('cronometro-start')?.addEventListener('click', startCronometro);
document.getElementById('cronometro-reset')?.addEventListener('click', resetCronometro);

document.querySelectorAll('.cronometro-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;

    // Remove active class from all buttons
    document.querySelectorAll('.cronometro-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (mode === 'custom') {
      const customInput = document.getElementById('cronometro-custom-input');
      if (customInput) customInput.style.display = 'flex';
    } else {
      const customInput = document.getElementById('cronometro-custom-input');
      if (customInput) customInput.style.display = 'none';
      let presetSeconds = parseInt(btn.dataset.seconds || '0', 10);

      if (!(presetSeconds > 0)) {
        const label = (btn.textContent || '').trim();
        const mmss = label.match(/^(\d+)\s*:\s*(\d{1,2})$/);
        if (mmss) {
          presetSeconds = (parseInt(mmss[1], 10) * 60) + parseInt(mmss[2], 10);
        }
      }

      if (!(presetSeconds > 0)) {
        const legacyMinutes = parseInt(mode, 10);
        if (legacyMinutes > 0) {
          presetSeconds = legacyMinutes * 60;
        }
      }

      if (presetSeconds > 0) {
        setCronometroTime(presetSeconds);
      } else {
        showNotification('No se pudo leer el tiempo predefinido', 'warning');
      }
    }
  });
});

document.getElementById('cronometro-set-custom')?.addEventListener('click', () => {
  const minutesInput = document.getElementById('cronometro-custom-minutes');
  const secondsInput = document.getElementById('cronometro-custom-seconds');
  if (minutesInput) {
    const minutes = parseInt(minutesInput.value, 10) || 0;
    const seconds = secondsInput ? (parseInt(secondsInput.value, 10) || 0) : 0;

    if (minutes < 0 || minutes > 180 || seconds < 0 || seconds > 59) {
      showNotification('Ingresa minutos (0-180) y segundos (0-59)', 'warning');
      return;
    }

    const totalSeconds = (minutes * 60) + seconds;
    if (totalSeconds <= 0) {
      showNotification('El tiempo debe ser mayor que 0 segundos', 'warning');
      return;
    }

    setCronometroTime(totalSeconds);
    document.getElementById('cronometro-custom-input').style.display = 'none';
  }
});

init();
