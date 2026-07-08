import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// تهيئة البيانات الافتراضية للـ App
window.appData = {
    installments: [],
    recurring: [],
    cards: [],
    income: [],
    savings: [],
    scheduledDebts: [],
    goals: [],
    memo: ''
};
window.workspaceMeta = {
    name: "Egyup Cloud System",
    currency: "ج",
    alertDays: 3,
    emergencyMonths: 6,
    maxDti: 40
};
window.userRole = 'Owner';
window.livePrices = {
    usdToEGP: 48.00,
    goldOunce: 1950.00,
    silverOunce: 25.00,
    goldPerGram24: 0, goldPerGram21: 0, goldPerGram18: 0,
    silverPerGram: 0,
    lastUpdate: null
};
window.expandedEntities = {};
window.notificationsEnabled = false;
window.notificationInterval = null;

// تهيئة إعدادات Firebase والـ App ID
const appId = typeof __app_id !== 'undefined' ? __app_id : 'egyup-system-v2';
const firebaseConfig = {
    apiKey: "AIzaSyCdrvuLSIhI7Dqa4PVMsUp21sarGeS2gmc",
    authDomain: "my-egyup-system.firebaseapp.com",
    projectId: "my-egyup-system",
    storageBucket: "my-egyup-system.firebasestorage.app",
    messagingSenderId: "92923907638",
    appId: "1:92923907638:web:28b67cf9d2e03f605ed297",
    measurementId: "G-2X50XNEWC5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;
let firestoreUnsubscribe = null;
let firestoreConfigUnsubscribe = null;

// إدارة الصلاحيات في واجهة المستخدم
window.applyPermissionsUI = function() {
    const isReadonly = window.userRole === 'Viewer';
    document.querySelectorAll('.write-action').forEach(btn => {
        if (isReadonly) { 
            btn.classList.add('role-restricted'); 
            btn.setAttribute('disabled','true'); 
            btn.setAttribute('title','صلاحيتك الحالية مشاهدة فقط'); 
        } else { 
            btn.classList.remove('role-restricted'); 
            btn.removeAttribute('disabled'); 
        }
    });
};

// مصادقة المستخدم والربط بالسحابة
async function runCloudAuth() {
    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            try { await signInWithCustomToken(auth, __initial_auth_token); } catch(e) { await signInAnonymously(auth); }
        } else { 
            await signInAnonymously(auth); 
        }
    } catch(err) {
        console.error("Firebase connection error:", err);
        try { await signInAnonymously(auth); } catch(e) { setOfflineUI(); }
    }
}

function setOfflineUI() {
    const connStatus = document.getElementById('userConnectionStatus');
    if (connStatus) connStatus.innerHTML = `<span class="badge bg-danger-soft text-danger p-2"><i class="bi bi-cloud-slash-fill"></i> وضع غير متصل</span>`;
    const syncInd = document.getElementById('syncIndicator');
    if (syncInd) syncInd.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> حفظ محلي نشط`;
    window.userRole = 'Owner';
    window.applyPermissionsUI();
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const activeWorkspaceId = localStorage.getItem('egyup_custom_user_id') || user.uid;
        const connStatus = document.getElementById('userConnectionStatus');
        if (connStatus) {
            connStatus.innerHTML = `
                <span class="badge bg-success-soft text-success p-2"><i class="bi bi-cloud-check-fill"></i> متصل سحابياً</span>
                <span class="ms-1 text-muted small d-none d-md-inline-block">الكود الخاص بك: <code class="user-select-all">${activeWorkspaceId}</code></span>
            `;
        }
        const myCloudIdField = document.getElementById('myCloudIdField');
        if (myCloudIdField) myCloudIdField.value = activeWorkspaceId;
        
        window.userRole = 'Owner';
        const roleIndicator = document.getElementById('roleIndicator');
        if (roleIndicator) {
            roleIndicator.className = 'badge bg-success-soft text-success badge-role';
            roleIndicator.innerHTML = '<i class="bi bi-shield-fill-check"></i> مالك مساحة العمل';
        }
        window.applyPermissionsUI();
        activateCloudSynchronization(activeWorkspaceId);
        activateWorkspaceConfigSync(activeWorkspaceId);
    } else {
        currentUser = null;
        setOfflineUI();
    }
});

// مزامنة حالة البيانات السحابية (قراءة)
function activateCloudSynchronization(workspaceId) {
    if (firestoreUnsubscribe) firestoreUnsubscribe();
    const docRef = doc(db, 'artifacts', appId, 'users', workspaceId, 'financials', 'state');
    firestoreUnsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.metadata.hasPendingWrites) {
            return;
        }
        if (docSnap.exists()) {
            const cloudData = docSnap.data();
            window.appData.installments = cloudData.installments || [];
            window.appData.recurring = cloudData.recurring || [];
            window.appData.cards = cloudData.cards || [];
            window.appData.income = cloudData.income || [];
            window.appData.savings = cloudData.savings || [];
            window.appData.scheduledDebts = cloudData.scheduledDebts || [];
            window.appData.goals = cloudData.goals || [];
            window.appData.memo = cloudData.memo || '';
        } else {
            migrateOldDataToCloud(workspaceId);
        }
        // استدعاء دوال العرض من الملف الآخر (app-logic)
        if (window.renderAllModulesTables) window.renderAllModulesTables();
        if (window.renderGoals) window.renderGoals();
        if (window.calculateFinanceReport) window.calculateFinanceReport();
        if (window.calculateGlobalOverview) window.calculateGlobalOverview();
        if (window.loadMemoData) window.loadMemoData();
        if (window.updateNotificationBadge) window.updateNotificationBadge();
        if (window.renderSmartAlertsPanel) window.renderSmartAlertsPanel();
    }, (error) => console.error("Cloud read error:", error));
}

// مزامنة تهيئة مساحة العمل
function activateWorkspaceConfigSync(workspaceId) {
    if (firestoreConfigUnsubscribe) firestoreConfigUnsubscribe();
    const configRef = doc(db, 'artifacts', appId, 'users', workspaceId, 'config', 'workspace');
    firestoreConfigUnsubscribe = onSnapshot(configRef, (docSnap) => {
        if (docSnap.metadata.hasPendingWrites) {
            return;
        }
        if (docSnap.exists()) {
            const data = docSnap.data();
            window.workspaceMeta = {
                name: data.name || "Egyup Cloud System",
                currency: data.currency || "ج",
                alertDays: parseInt(data.alertDays) || 3,
                emergencyMonths: parseInt(data.emergencyMonths) || 6,
                maxDti: parseInt(data.maxDti) || 40
            };
        } else {
            window.workspaceMeta = { name: "Egyup Cloud System", currency: "ج", alertDays: 3, emergencyMonths: 6, maxDti: 40 };
            saveWorkspaceConfigToCloud(workspaceId);
        }
        const display = document.getElementById('workspaceTitleDisplay');
        if (display) display.textContent = window.workspaceMeta.name;
        const set_name = document.getElementById('set_workspace_name');
        if (set_name) set_name.value = window.workspaceMeta.name;
        const set_currency = document.getElementById('set_currency_symbol');
        if (set_currency) set_currency.value = window.workspaceMeta.currency;
        const set_alert_days = document.getElementById('set_alert_days');
        if (set_alert_days) set_alert_days.value = window.workspaceMeta.alertDays;
        const set_emerg = document.getElementById('set_emergency_months');
        if (set_emerg) set_emerg.value = window.workspaceMeta.emergencyMonths;
        const set_dti = document.getElementById('set_max_dti');
        if (set_dti) set_dti.value = window.workspaceMeta.maxDti;
        
        if (window.calculateFinanceReport) window.calculateFinanceReport();
        if (window.calculateGlobalOverview) window.calculateGlobalOverview();
        if (window.renderSmartAlertsPanel) window.renderSmartAlertsPanel();
    }, (error) => console.error("Config read error:", error));
}

async function migrateOldDataToCloud(workspaceId) {
    let oldDataRaw = localStorage.getItem('egyup_raw_data_v2');
    if (oldDataRaw) { 
        try { 
            let oldData = JSON.parse(oldDataRaw); 
            if (window.validateImportData && window.validateImportData(oldData)) { 
                window.appData = oldData; 
                await saveAppDataToCloud(workspaceId); 
                return; 
            } 
        } catch(e) {} 
    }
    await saveAppDataToCloud(workspaceId);
}

// كتابة وحفظ البيانات سحابياً بشكل مباشر وآمن
async function saveAppDataToCloud(optionalWorkspaceId = null) {
    if (window.userRole === 'Viewer') return;
    const workspaceId = optionalWorkspaceId || localStorage.getItem('egyup_custom_user_id') || (currentUser ? currentUser.uid : null);
    localStorage.setItem('egyup_raw_data_v2', JSON.stringify(window.appData));
    
    if (!workspaceId) return;
    const syncIndicator = document.getElementById('syncIndicator');
    if (syncIndicator) { 
        syncIndicator.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> رفع للتخزين السحابي...'; 
        syncIndicator.className = 'badge bg-body-secondary py-2 px-3 small text-warning fw-bold'; 
    }
    const docRef = doc(db, 'artifacts', appId, 'users', workspaceId, 'financials', 'state');
    try {
        await setDoc(docRef, { 
            installments: window.appData.installments, 
            recurring: window.appData.recurring, 
            cards: window.appData.cards, 
            income: window.appData.income, 
            savings: window.appData.savings, 
            scheduledDebts: window.appData.scheduledDebts, 
            goals: window.appData.goals, 
            memo: window.appData.memo 
        });
        if (syncIndicator) { 
            syncIndicator.innerHTML = '<i class="bi bi-cloud-arrow-up-fill"></i> تمت المزامنة بنجاح'; 
            syncIndicator.className = 'badge bg-body-secondary py-2 px-3 small text-success fw-bold'; 
        }
    } catch(e) { 
        console.error("Save error:", e); 
        if (syncIndicator) { 
            syncIndicator.innerHTML = '<i class="bi bi-cloud-slash-fill"></i> فشل الحفظ السحابي'; 
            syncIndicator.className = 'badge bg-body-secondary py-2 px-3 small text-danger fw-bold'; 
        } 
    }
}

async function saveWorkspaceConfigToCloud(optionalWorkspaceId = null) {
    if (window.userRole !== 'Owner') return;
    const workspaceId = optionalWorkspaceId || localStorage.getItem('egyup_custom_user_id') || (currentUser ? currentUser.uid : null);
    localStorage.setItem('egyup_workspace_meta', JSON.stringify(window.workspaceMeta));
    
    if (!workspaceId) return;
    const configRef = doc(db, 'artifacts', appId, 'users', workspaceId, 'config', 'workspace');
    try { 
        await setDoc(configRef, { 
            name: window.workspaceMeta.name, 
            currency: window.workspaceMeta.currency, 
            alertDays: window.workspaceMeta.alertDays, 
            emergencyMonths: window.workspaceMeta.emergencyMonths, 
            maxDti: window.workspaceMeta.maxDti 
        }); 
    } catch(e) { 
        console.error("Config save error:", e); 
    }
}

// جعل الدوال الأساسية متاحة في window لتستخدمها app-logic
window.saveAppDataToCloud = saveAppDataToCloud;
window.saveWorkspaceConfigToCloud = saveWorkspaceConfigToCloud;
window.runCloudAuth = runCloudAuth;
window.applyPermissionsUI = applyPermissionsUI;
window.db = db;
window.auth = auth;

runCloudAuth();
