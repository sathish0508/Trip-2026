/**
 * Trip 2026 - Mobile First Application Logic
 * Includes Trip Advance Tracker, Admin Approval Queue, Trip Expense & Budget Ledger, Debt Settlement Matrix, PDF Receipts & Google Sheets Sync.
 */

const STATE = {
    tripTitle: 'Trip 2026',
    adminPassword: '1234',
    isAdminUnlocked: false,
    activeScreen: 'overview',
    members: [],
    receipts: [],
    queue: [],
    expenses: [],
    rejectedQueueIds: [],
    rejectedReceiptNos: [],
    deletedMemberIds: [],
    deletedExpenseIds: [],
    approvedQueueIds: [],
    config: {
        sheetId: '1877_oKGn_ySXxopRfzIP791MCrkZYWMC0eqKIT3EpZ0',
        webAppUrl: 'https://script.google.com/macros/s/AKfycbzeZtp421FySdPbdPkbIDJ9EqlLGJTEo7J7zIJTICgAC0u30XyzuIAzArqoYBqgBLE/exec'
    }
};

const STORAGE_KEY = 'TRIPTRACK_MOBILE_QUEUE_DATA_V8';

const SEED_MEMBERS = [];
const SEED_RECEIPTS = [];
const SEED_QUEUE = [];
const SEED_EXPENSES = [];

let currentUploadedImageBase64 = '';

document.addEventListener('DOMContentLoaded', () => {
    loadStorage();
    initMobileNav();
    initUploadHandler();
    initAdminAuth();
    initForms();
    
    // Restore Last Active Screen on Page Refresh / Load
    const validScreens = ['overview', 'members', 'expenses', 'pay', 'admin'];
    const hash = window.location.hash.replace('#', '');
    const initialScreen = validScreens.includes(hash) ? hash : (validScreens.includes(STATE.activeScreen) ? STATE.activeScreen : 'overview');
    
    switchScreen(initialScreen);
    
    // Initial Fetch on Launch
    fetchLiveFromGoogleSheet();

    // 10-Second Auto Sync Interval
    setInterval(() => {
        fetchLiveFromGoogleSheet();
    }, 10000);

    // Auto-sync when app is brought back to foreground
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            fetchLiveFromGoogleSheet();
        }
    });

    // Make Sync Pill Badge clickable for Manual Sync
    const syncBadge = document.getElementById('syncStatusBadge');
    if (syncBadge) {
        syncBadge.style.cursor = 'pointer';
        syncBadge.title = 'Tap to Sync Now';
        syncBadge.addEventListener('click', () => {
            showToast('Syncing with Google Sheet...', 'info');
            fetchLiveFromGoogleSheet();
        });
    }
});

window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    const validScreens = ['overview', 'members', 'expenses', 'pay', 'admin'];
    if (validScreens.includes(hash)) {
        switchScreen(hash);
    }
});

function loadStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const data = JSON.parse(raw);
            STATE.tripTitle = 'Trip 2026';
            STATE.adminPassword = data.adminPassword || '1234';
            STATE.activeScreen = data.activeScreen || 'overview';
            STATE.members = data.members || SEED_MEMBERS;
            STATE.receipts = data.receipts || SEED_RECEIPTS;
            STATE.queue = data.queue || SEED_QUEUE;
            STATE.expenses = data.expenses || SEED_EXPENSES;
            STATE.rejectedQueueIds = data.rejectedQueueIds || [];
            STATE.rejectedReceiptNos = data.rejectedReceiptNos || [];
            STATE.deletedMemberIds = data.deletedMemberIds || [];
            STATE.deletedExpenseIds = data.deletedExpenseIds || [];
            STATE.approvedQueueIds = data.approvedQueueIds || [];
            STATE.config = data.config || {};
            STATE.config.sheetId = '1877_oKGn_ySXxopRfzIP791MCrkZYWMC0eqKIT3EpZ0';
            STATE.config.webAppUrl = 'https://script.google.com/macros/s/AKfycbzeZtp421FySdPbdPkbIDJ9EqlLGJTEo7J7zIJTICgAC0u30XyzuIAzArqoYBqgBLE/exec';
        } catch (e) {
            STATE.members = SEED_MEMBERS;
            STATE.receipts = SEED_RECEIPTS;
            STATE.queue = SEED_QUEUE;
            STATE.expenses = SEED_EXPENSES;
        }
    } else {
        STATE.members = SEED_MEMBERS;
        STATE.receipts = SEED_RECEIPTS;
        STATE.queue = SEED_QUEUE;
        STATE.expenses = SEED_EXPENSES;
        saveStorage();
    }
}

function saveStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
}

// LIVE GOOGLE SHEET FETCH FUNCTION
function fetchLiveFromGoogleSheet() {
    const url = STATE.config.webAppUrl;
    if (!url) return;

    fetch(url)
        .then(res => res.json())
        .then(res => {
            if (res.success && res.data) {
                const approvedMemberIds = new Set(STATE.receipts.filter(r => r.status === 'Approved').map(r => r.memberId));
                const approvedReceiptNos = new Set(STATE.receipts.filter(r => r.status === 'Approved').map(r => r.receiptNo));
                const approvedQueueIds = new Set((STATE.approvedQueueIds || []).map(id => String(id)));
                const deletedMemberIds = new Set((STATE.deletedMemberIds || []).map(id => String(id)));
                const deletedExpenseIds = new Set((STATE.deletedExpenseIds || []).map(id => String(id)));

                // 1. Sync Members
                if (Array.isArray(res.data.members)) {
                    STATE.members = res.data.members
                        .filter(m => !deletedMemberIds.has(String(m.ID || m.id)))
                        .map((m, idx) => {
                            const mId = String(m.ID || m.id || 'm_' + idx);
                            const isLocallyApproved = approvedMemberIds.has(mId);
                            return {
                                id: mId,
                                name: String(m.Name || m.name || ''),
                                phone: String(m.Phone || m.phone || ''),
                                advance: Number(m['Advance Required'] || m.advance || 5000),
                                days: Number(m['Days Available'] || m.days || 4),
                                status: isLocallyApproved ? 'Paid' : String(m.Status || m.status || 'Not Paid'),
                                utr: String(m.UTR || m.utr || '')
                            };
                        });
                }

                // 2. Sync Queue
                if (Array.isArray(res.data.queue)) {
                    const rejectedQueueIds = new Set((STATE.rejectedQueueIds || []).map(id => String(id)));
                    const rejectedReceiptNos = new Set((STATE.rejectedReceiptNos || []).map(no => String(no)));

                    STATE.queue = res.data.queue
                        .filter(q => String(q.Status || q.status) === 'Pending Approval')
                        .filter(q => !approvedReceiptNos.has(String(q['Receipt No'] || q.receiptNo)))
                        .filter(q => !approvedQueueIds.has(String(q['Queue ID'] || q.id)))
                        .filter(q => !rejectedQueueIds.has(String(q['Queue ID'] || q.id)))
                        .filter(q => !rejectedReceiptNos.has(String(q['Receipt No'] || q.receiptNo)))
                        .map(q => ({
                            id: String(q['Queue ID'] || q.id || ''),
                            receiptNo: String(q['Receipt No'] || q.receiptNo || ''),
                            memberId: String(q['Member ID'] || q.memberId || ''),
                            memberName: String(q['Member Name'] || q.memberName || ''),
                            amount: Number(q.Amount || q.amount || 0),
                            date: String(q.Date || q.date || ''),
                            utr: String(q.UTR || q.utr || ''),
                            proofImg: String(q.proofImg || ''),
                            status: 'Pending Approval'
                        }));
                }

                // 3. Sync Receipts
                if (Array.isArray(res.data.receipts) && res.data.receipts.length > 0) {
                    const sheetReceipts = res.data.receipts.map(r => ({
                        receiptNo: String(r['Receipt No'] || r.receiptNo || ''),
                        memberId: String(r['Member ID'] || r.memberId || ''),
                        memberName: String(r['Member Name'] || r.memberName || ''),
                        amount: Number(r['Amount Paid'] || r.amount || 0),
                        date: String(r['Issued Date'] || r.date || ''),
                        utr: String(r['UTR ID'] || r.utr || ''),
                        status: String(r.Status || r.status || 'Approved')
                    }));

                    sheetReceipts.forEach(sr => {
                        if (!STATE.receipts.some(r => r.receiptNo === sr.receiptNo)) {
                            STATE.receipts.push(sr);
                        }
                    });
                }

                // 4. Sync Expenses
                if (Array.isArray(res.data.expenses)) {
                    const sheetExpenses = res.data.expenses
                        .filter(ex => !deletedExpenseIds.has(String(ex.ID || ex.id)))
                        .map((ex, idx) => {
                            let dStr = String(ex.Date || ex.date || '');
                            if (dStr.includes('T')) dStr = dStr.split('T')[0];
                            return {
                                id: String(ex.ID || ex.id || 'e_' + idx),
                                date: dStr,
                                title: String(ex.Title || ex.title || ''),
                                category: String(ex.Category || ex.category || 'Misc'),
                                amount: Number(ex.Amount || ex.amount || 0),
                                paidBy: String(ex['Paid By'] || ex.paidBy || ex.paid_by || ''),
                                splitAmong: parseSplitAmong(ex['Split Among'] || ex.splitAmong || ex.split_among)
                            };
                        }).filter(ex => ex.title && ex.amount > 0);

                    sheetExpenses.forEach(se => {
                        const existingIdx = STATE.expenses.findIndex(e => e.id === se.id);
                        if (existingIdx !== -1) {
                            STATE.expenses[existingIdx] = se;
                        } else {
                            STATE.expenses.push(se);
                        }
                    });
                }

                saveStorage();
                renderApp();
            }
        })
        .catch(err => console.log('Offline cache mode', err));
}

function parseSplitAmong(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try { return JSON.parse(val); } catch (e) { return val.split(','); }
    }
    return [];
}

// Navigation Engine
function initMobileNav() {
    document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const screen = btn.getAttribute('data-screen');
            switchScreen(screen);
        });
    });

    document.getElementById('btnQuickPay')?.addEventListener('click', () => switchScreen('pay'));
    document.getElementById('btnQuickExpense')?.addEventListener('click', () => openAddExpenseModal());
    document.getElementById('btnOpenAddExpenseModal')?.addEventListener('click', () => openAddExpenseModal());
    document.getElementById('btnAdminAddMember')?.addEventListener('click', openAddMemberModal);
}

function switchScreen(screenId) {
    const validScreens = ['overview', 'members', 'expenses', 'pay', 'admin'];
    if (!validScreens.includes(screenId)) screenId = 'overview';

    STATE.activeScreen = screenId;
    saveStorage();

    if (window.location.hash !== `#${screenId}`) {
        history.replaceState(null, '', `#${screenId}`);
    }

    document.querySelectorAll('.bottom-nav .nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    const targetNav = document.querySelector(`.bottom-nav .nav-item[data-screen="${screenId}"]`);
    const targetScreen = document.getElementById(`screen-${screenId}`);

    if (targetNav) targetNav.classList.add('active');
    if (targetScreen) targetScreen.classList.add('active');

    renderApp();
}

// Admin Auth Lock/Unlock
function initAdminAuth() {
    const lockBtn = document.getElementById('btnLockToggle');
    const lockAdminBtn = document.getElementById('btnLockAdmin');
    const loginForm = document.getElementById('adminLoginForm');

    lockBtn?.addEventListener('click', () => {
        switchScreen('admin');
    });

    lockAdminBtn?.addEventListener('click', () => {
        STATE.isAdminUnlocked = false;
        renderAdminScreen();
        updateAdminLockHeader();
        showToast('Admin Panel locked');
    });

    loginForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const pwd = document.getElementById('adminPasswordInput').value.trim();
        if (pwd === STATE.adminPassword) {
            STATE.isAdminUnlocked = true;
            document.getElementById('adminPasswordInput').value = '';
            renderAdminScreen();
            updateAdminLockHeader();
            showToast('Admin Access Unlocked!', 'success');
        } else {
            showToast('Incorrect Admin Password!', 'error');
        }
    });
}

function updateAdminLockHeader() {
    const icon = document.getElementById('adminLockIcon');
    const text = document.getElementById('adminLockText');
    const btn = document.getElementById('btnLockToggle');

    if (STATE.isAdminUnlocked) {
        icon.className = 'fa-solid fa-unlock';
        text.textContent = 'Unlocked';
        btn.classList.add('unlocked');
    } else {
        icon.className = 'fa-solid fa-lock';
        text.textContent = 'Admin';
        btn.classList.remove('unlocked');
    }
}

// Render All Components
function renderApp() {
    renderOverview();
    renderMembersLists();
    renderExpensesScreen();
    populateMemberSelect();
    renderIssuedReceiptsList();
    renderAdminScreen();
    updateSyncPill();
    updateAdminLockHeader();
}

function updateSyncPill() {
    const text = document.getElementById('syncText');
    const dot = document.querySelector('.sync-pill .dot');
    if (STATE.config.webAppUrl) {
        text.textContent = 'Sheet Synced';
        dot.className = 'dot online';
    } else {
        text.textContent = 'Local';
        dot.className = 'dot offline';
    }
}

// 1. Overview Screen
function renderOverview() {
    const paidMembers = STATE.members.filter(m => m.status === 'Paid');
    const unpaidMembers = STATE.members.filter(m => m.status !== 'Paid');
    const pendingQueueItems = STATE.queue.filter(q => q.status === 'Pending Approval');
    const pendingQueueCount = pendingQueueItems.length;

    const totalCollected = paidMembers.reduce((sum, m) => sum + Number(m.advance), 0);
    const totalTarget = STATE.members.reduce((sum, m) => sum + Number(m.advance), 0);

    const paidPct = totalTarget > 0 ? Math.round((totalCollected / totalTarget) * 100) : 0;

    const elTotal = document.getElementById('totalCollectedAmt');
    if (elTotal) elTotal.textContent = `₹${totalCollected.toLocaleString('en-IN')}`;

    const elRatio = document.getElementById('paidRatioText');
    if (elRatio) elRatio.textContent = `${paidMembers.length} of ${STATE.members.length} Paid`;

    const elPct = document.getElementById('paidPercentText');
    if (elPct) elPct.textContent = `${paidPct}%`;

    const elProgress = document.getElementById('advanceProgressBar');
    if (elProgress) elProgress.style.width = `${paidPct}%`;

    const elCntPaid = document.getElementById('cntPaid');
    if (elCntPaid) elCntPaid.textContent = paidMembers.length;

    const elCntQueue = document.getElementById('cntPendingQueue');
    if (elCntQueue) elCntQueue.textContent = pendingQueueCount;

    const elCntUnpaid = document.getElementById('cntUnpaid');
    if (elCntUnpaid) elCntUnpaid.textContent = unpaidMembers.length;

    const elBadgePending = document.getElementById('badgePendingCount');
    if (elBadgePending) elBadgePending.textContent = `${unpaidMembers.length} Outstanding`;

    const elBadgePaid = document.getElementById('badgePaidCount');
    if (elBadgePaid) elBadgePaid.textContent = `${paidMembers.length} Approved`;

    const elQueueBadge = document.getElementById('queueBadgeCnt');
    if (elQueueBadge) elQueueBadge.textContent = pendingQueueCount;

    // Public Pending Queue Alert
    const alertHeader = document.getElementById('sectionQueueAlert');
    const alertList = document.getElementById('publicQueueAlertList');

    if (pendingQueueCount > 0) {
        alertHeader?.classList.remove('hidden');
        alertList?.classList.remove('hidden');
        document.getElementById('badgeQueueAlert').textContent = `${pendingQueueCount} Pending`;

        alertList.innerHTML = pendingQueueItems.map(item => `
            <div class="member-card">
                <div class="member-card-left">
                    <div class="avatar-circle" style="background: linear-gradient(135deg, var(--amber), #d97706);">${item.memberName.charAt(0)}</div>
                    <div class="member-info">
                        <h4>${item.memberName} — ${item.receiptNo}</h4>
                        <p>Submitted ₹${item.amount} | Awaiting Admin Approval</p>
                    </div>
                </div>
                <div class="member-card-right">
                    <span class="badge-status pending-queue"><i class="fa-solid fa-hourglass-half"></i> In Queue</span>
                </div>
            </div>
        `).join('');
    } else {
        alertHeader?.classList.add('hidden');
        alertList?.classList.add('hidden');
    }

    // Unpaid List
    const unpaidContainer = document.getElementById('unpaidMembersList');
    if (unpaidMembers.length === 0) {
        unpaidContainer.innerHTML = `<div class="card" style="text-align: center; color: var(--emerald); padding: 14px;"><i class="fa-solid fa-circle-check"></i> All trip members have paid & been approved!</div>`;
    } else {
        unpaidContainer.innerHTML = unpaidMembers.map(m => createMemberCardHtml(m)).join('');
    }

    // Paid List
    const paidContainer = document.getElementById('paidMembersList');
    if (paidMembers.length === 0) {
        paidContainer.innerHTML = `<div class="card" style="text-align: center; color: var(--text-secondary); padding: 14px;">No approved payments collected yet.</div>`;
    } else {
        paidContainer.innerHTML = paidMembers.map(m => createMemberCardHtml(m)).join('');
    }
}

// Members Screen
function renderMembersLists() {
    const container = document.getElementById('allMembersList');
    const addBtn = document.getElementById('btnAddMemberScreen');

    if (STATE.isAdminUnlocked) {
        addBtn?.classList.remove('hidden');
    } else {
        addBtn?.classList.add('hidden');
    }

    if (!container) return;
    container.innerHTML = STATE.members.map(m => createMemberCardHtml(m, STATE.isAdminUnlocked)).join('');
}

function createMemberCardHtml(m, canEdit = false) {
    const isPaid = m.status === 'Paid';
    const isQueue = STATE.queue.some(q => q.memberId === m.id && q.status === 'Pending Approval');

    return `
        <div class="member-card">
            <div class="member-card-left">
                <div class="avatar-circle" style="${isPaid ? 'background: linear-gradient(135deg, #10b981, #059669); position: relative;' : ''}">
                    ${m.name.charAt(0)}
                    ${isPaid ? '<span style="position: absolute; bottom: -2px; right: -2px; background: #059669; color: #fff; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; border: 1.5px solid #1e293b;"><i class="fa-solid fa-check"></i></span>' : ''}
                </div>
                <div class="member-info">
                    <h4>${m.name} ${isPaid ? '<i class="fa-solid fa-circle-check" style="color: #34d399; font-size: 13px; margin-left: 4px;" title="Paid & Verified (GPay/PhonePe)"></i>' : ''}</h4>
                    <p><i class="fa-solid fa-calendar-day"></i> ${m.days} Days Available ${m.phone ? `| ${m.phone}` : ''}</p>
                </div>
            </div>
            <div class="member-card-right">
                <span class="advance-amount">₹${Number(m.advance).toLocaleString('en-IN')}</span>
                ${isPaid ? `
                    <span class="badge-status paid" onclick="toggleMemberStatus('${m.id}')" title="Transaction Verified"><i class="fa-solid fa-circle-check"></i> Paid ✔</span>
                ` : (isQueue ? `
                    <span class="badge-status pending-queue"><i class="fa-solid fa-hourglass-half"></i> In Queue</span>
                ` : `
                    <span class="badge-status unpaid" onclick="toggleMemberStatus('${m.id}')"><i class="fa-solid fa-clock"></i> Not Paid</span>
                `)}
            </div>
        </div>
    `;
}

window.toggleMemberStatus = function(id) {
    const m = STATE.members.find(mb => mb.id === id);
    if (!m) return;
    
    m.status = (m.status === 'Paid') ? 'Not Paid' : 'Paid';
    saveStorage();
    renderApp();
    showToast(`${m.name} status updated to ${m.status}`);
    
    postToSheetAsync({ action: 'UPDATE_MEMBER_STATUS', memberId: m.id, status: m.status });
};

// ------------------------------------------
// SCREEN 3: TRIP EXPENSES & SETTLEMENT MATH
// ------------------------------------------
function renderExpensesScreen() {
    const totalExp = STATE.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalMembers = STATE.members.length || 1;
    const avgPerHead = Math.round(totalExp / totalMembers);

    const elExpTotal = document.getElementById('expTotalAmount');
    if (elExpTotal) elExpTotal.textContent = `₹${totalExp.toLocaleString('en-IN')}`;

    const elExpAvg = document.getElementById('expAvgPerHead');
    if (elExpAvg) elExpAvg.textContent = `₹${avgPerHead.toLocaleString('en-IN')}`;

    const elExpCount = document.getElementById('expItemCount');
    if (elExpCount) elExpCount.textContent = STATE.expenses.length;

    renderMemberBalancesList();
    renderSettlementMatrix();
    renderExpenseHistory();
}

// Helper to resolve Member ID from either ID or Name
function resolveMemberId(identifier) {
    if (!identifier) return null;
    const str = String(identifier).trim().toLowerCase();
    const found = STATE.members.find(m => 
        String(m.id).toLowerCase() === str || 
        String(m.name).trim().toLowerCase() === str
    );
    return found ? found.id : null;
}

function renderMemberBalancesList() {
    const container = document.getElementById('memberBalancesList');
    if (!container) return;

    if (STATE.members.length === 0) {
        container.innerHTML = `<p class="text-center" style="color: var(--text-secondary); padding: 10px;">No members added yet.</p>`;
        return;
    }

    // Compute Paid out of pocket vs Fair Share
    const memberPaidMap = {};
    const memberShareMap = {};

    STATE.members.forEach(m => {
        memberPaidMap[m.id] = 0;
        memberShareMap[m.id] = 0;
    });

    // Payer credits & Split debits
    STATE.expenses.forEach(exp => {
        const amt = Number(exp.amount) || 0;
        if (amt <= 0) return;

        const payerId = resolveMemberId(exp.paidBy || exp.paidByName);
        
        const rawSplit = (exp.splitAmong && exp.splitAmong.length > 0) ? exp.splitAmong : STATE.members.map(m => m.id);
        const splitIds = rawSplit.map(s => resolveMemberId(s)).filter(Boolean);
        const finalSplit = splitIds.length > 0 ? splitIds : STATE.members.map(m => m.id);
        const perPersonAmt = amt / finalSplit.length;

        if (payerId && memberPaidMap[payerId] !== undefined) {
            memberPaidMap[payerId] += amt;
        }

        finalSplit.forEach(mId => {
            if (memberShareMap[mId] !== undefined) {
                memberShareMap[mId] += perPersonAmt;
            }
        });
    });

    container.innerHTML = STATE.members.map(m => {
        const outOfPocket = memberPaidMap[m.id] || 0;
        const advancePaid = (m.status === 'Paid') ? Number(m.advance) : 0;
        const totalContributed = outOfPocket + advancePaid;
        const fairShare = memberShareMap[m.id] || 0;
        const netBalance = Math.round(totalContributed - fairShare);

        const isPositive = netBalance >= 0;

        return `
            <div class="member-card">
                <div class="member-card-left">
                    <div class="avatar-circle">${m.name.charAt(0)}</div>
                    <div>
                        <strong>${m.name}</strong>
                        <span style="font-size: 11px; color: var(--text-muted); display: block;">
                            Paid Out: ₹${outOfPocket.toLocaleString('en-IN')} | Advance: ₹${advancePaid.toLocaleString('en-IN')}
                        </span>
                        <span style="font-size: 11px; color: var(--text-secondary); display: block;">
                            Fair Share: ₹${Math.round(fairShare).toLocaleString('en-IN')}
                        </span>
                    </div>
                </div>
                <div class="member-card-right">
                    <strong style="color: ${isPositive ? 'var(--emerald)' : 'var(--rose)'}; font-size: 15px;">
                        ${isPositive ? '+₹' + netBalance.toLocaleString('en-IN') : '-₹' + Math.abs(netBalance).toLocaleString('en-IN')}
                    </strong>
                    <span class="count-badge ${isPositive ? 'success' : 'danger'}">
                        ${isPositive ? 'Gets Refund' : 'Owes Pool'}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

function renderSettlementMatrix() {
    const container = document.getElementById('settlementMatrixList');
    if (!container) return;

    if (STATE.members.length === 0 || STATE.expenses.length === 0) {
        container.innerHTML = `<p class="text-center" style="color: var(--text-secondary); padding: 10px;">Log trip expenses to view settlement matrix.</p>`;
        return;
    }

    // Compute Net Balances
    const memberPaidMap = {};
    const memberShareMap = {};
    STATE.members.forEach(m => { memberPaidMap[m.id] = 0; memberShareMap[m.id] = 0; });

    STATE.expenses.forEach(exp => {
        const amt = Number(exp.amount) || 0;
        if (amt <= 0) return;

        const payerId = resolveMemberId(exp.paidBy || exp.paidByName);
        
        const rawSplit = (exp.splitAmong && exp.splitAmong.length > 0) ? exp.splitAmong : STATE.members.map(m => m.id);
        const splitIds = rawSplit.map(s => resolveMemberId(s)).filter(Boolean);
        const finalSplit = splitIds.length > 0 ? splitIds : STATE.members.map(m => m.id);
        const perPersonAmt = amt / finalSplit.length;

        if (payerId && memberPaidMap[payerId] !== undefined) {
            memberPaidMap[payerId] += amt;
        }

        finalSplit.forEach(mId => {
            if (memberShareMap[mId] !== undefined) {
                memberShareMap[mId] += perPersonAmt;
            }
        });
    });

    const debtors = [];
    const creditors = [];

    STATE.members.forEach(m => {
        const outOfPocket = memberPaidMap[m.id] || 0;
        const advancePaid = (m.status === 'Paid') ? Number(m.advance) : 0;
        const totalContributed = outOfPocket + advancePaid;
        const fairShare = memberShareMap[m.id] || 0;
        const net = totalContributed - fairShare;

        if (net < -1) {
            debtors.push({ id: m.id, name: m.name, amount: Math.abs(net) });
        } else if (net > 1) {
            creditors.push({ id: m.id, name: m.name, amount: net });
        }
    });

    // Settle greedily
    const transactions = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
        const d = debtors[i];
        const c = creditors[j];
        const settle = Math.min(d.amount, c.amount);

        transactions.push({
            from: d.name,
            to: c.name,
            amount: Math.round(settle)
        });

        d.amount -= settle;
        c.amount -= settle;

        if (d.amount < 1) i++;
        if (c.amount < 1) j++;
    }

    if (transactions.length === 0) {
        container.innerHTML = `<div class="card" style="text-align: center; color: var(--emerald); padding: 12px;"><i class="fa-solid fa-circle-check"></i> Perfect balance! All trip expenses are settled.</div>`;
        return;
    }

    container.innerHTML = transactions.map(t => `
        <div class="settlement-item">
            <div class="settlement-party">
                <div class="avatar-circle" style="width: 32px; height: 32px; font-size: 13px;">${t.from.charAt(0)}</div>
                <div>
                    <strong>${t.from}</strong>
                    <span style="font-size: 11px; color: var(--text-muted); display: block;">owes ${t.to}</span>
                </div>
            </div>
            <div class="settlement-amount">₹${t.amount.toLocaleString('en-IN')}</div>
        </div>
    `).join('');
}

function renderExpenseHistory() {
    const container = document.getElementById('expenseHistoryList');
    if (!container) return;

    if (STATE.expenses.length === 0) {
        container.innerHTML = `<p class="text-center" style="color: var(--text-secondary); padding: 10px;">No expenses logged yet. Tap "Add Expense".</p>`;
        return;
    }

    container.innerHTML = STATE.expenses.map(e => {
        const payerId = resolveMemberId(e.paidBy || e.paidByName);
        const payerObj = STATE.members.find(m => m.id === payerId);
        const payerName = payerObj ? payerObj.name : (e.paidByName || e.paidBy || 'Unknown');
        const count = (e.splitAmong && e.splitAmong.length > 0) ? e.splitAmong.length : STATE.members.length;

        return `
            <div class="member-card">
                <div class="member-card-left">
                    <div class="avatar-circle" style="background: linear-gradient(135deg, #059669, #10b981);"><i class="fa-solid fa-receipt"></i></div>
                    <div class="member-info">
                        <h4>${e.title}</h4>
                        <p>${e.date} | Paid by: <strong>${payerName}</strong> (${count} Members Split)</p>
                    </div>
                </div>
                <div class="member-card-right" style="display: flex; align-items: center; gap: 8px;">
                    <div>
                        <strong style="color: var(--emerald); display: block; text-align: right;">₹${Number(e.amount).toLocaleString('en-IN')}</strong>
                        <span class="count-badge success">${e.category}</span>
                    </div>
                    <button class="btn btn-xs btn-secondary" style="color: var(--rose); padding: 6px 8px;" onclick="deleteExpense('${e.id}')" title="Delete Expense"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

function openAddExpenseModal() {
    document.getElementById('expenseForm').reset();
    document.getElementById('expenseIdHidden').value = '';
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];

    // Populate PaidBy select
    const payerSelect = document.getElementById('expensePaidBy');
    if (payerSelect) {
        payerSelect.innerHTML = STATE.members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    }

    // Populate Split Checkboxes
    const splitContainer = document.getElementById('expenseSplitCheckboxes');
    if (splitContainer) {
        splitContainer.innerHTML = STATE.members.map(m => `
            <label class="checkbox-label">
                <input type="checkbox" name="expenseSplitMember" value="${m.id}" checked>
                <span>${m.name}</span>
            </label>
        `).join('');
    }

    openModal('expenseModal');
}

// 2. Admin Screen & Approval Queue
function renderAdminScreen() {
    const lockedView = document.getElementById('adminLockedView');
    const unlockedView = document.getElementById('adminUnlockedView');

    if (!STATE.isAdminUnlocked) {
        lockedView?.classList.remove('hidden');
        unlockedView?.classList.add('hidden');
        return;
    }

    lockedView?.classList.add('hidden');
    unlockedView?.classList.remove('hidden');

    // Render Admin Queue
    const queueContainer = document.getElementById('adminQueueList');
    const queueCountBadge = document.getElementById('adminQueueCount');
    const pendingItems = STATE.queue.filter(q => q.status === 'Pending Approval');

    if (queueCountBadge) queueCountBadge.textContent = pendingItems.length;

    if (!queueContainer) return;

    if (pendingItems.length === 0) {
        queueContainer.innerHTML = `<p class="text-center" style="color: var(--emerald); padding: 14px;"><i class="fa-solid fa-circle-check"></i> Approval Queue is Empty! No pending items.</p>`;
    } else {
        queueContainer.innerHTML = pendingItems.map(item => `
            <div class="queue-card">
                <div class="queue-header">
                    <div>
                        <h4>${item.memberName}</h4>
                        <small>Submitted ${item.date} ${item.utr ? '| UTR: ' + item.utr : ''}</small>
                    </div>
                    <strong style="color: var(--emerald); font-size: 16px;">₹${Number(item.amount).toLocaleString('en-IN')}</strong>
                </div>
                ${item.proofImg ? `
                    <div style="margin: 8px 0;">
                        <small style="color: var(--text-muted); display: block; margin-bottom: 4px;">Attached Payment Screenshot:</small>
                        <img src="${item.proofImg}" class="queue-proof-thumb" onclick="showReceiptModal('${item.receiptNo}')" alt="Payment Screenshot Proof">
                    </div>
                ` : '<small style="color: var(--text-muted); display: block; margin: 6px 0;">No screenshot attached</small>'}
                <div class="queue-actions">
                    <button class="btn-reject" onclick="rejectQueueSubmission('${item.id}')">
                        <i class="fa-solid fa-xmark"></i> Reject
                    </button>
                    <button class="btn-approve" onclick="approveQueueSubmission('${item.id}')">
                        <i class="fa-solid fa-check"></i> Approve & Issue Verified Receipt
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Render Admin Member Controls List
    const adminMembersContainer = document.getElementById('adminMembersList');
    if (adminMembersContainer) {
        adminMembersContainer.innerHTML = STATE.members.map(m => `
            <div class="member-card">
                <div class="member-card-left">
                    <div class="avatar-circle">${m.name.charAt(0)}</div>
                    <div>
                        <strong>${m.name}</strong>
                        <span style="font-size: 12px; color: var(--text-secondary); display: block;">₹${m.advance} | ${m.status}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 6px;">
                    <button class="btn btn-xs btn-secondary" onclick="editMember('${m.id}')"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="btn btn-xs btn-secondary" style="color: var(--rose);" onclick="deleteMember('${m.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    }
}

// Approve Queue Function
window.approveQueueSubmission = function(queueId) {
    const itemIdx = STATE.queue.findIndex(q => q.id === queueId);
    if (itemIdx === -1) return;

    const item = STATE.queue[itemIdx];

    // 1. Update Member Status to Paid
    const member = STATE.members.find(m => m.id === item.memberId);
    if (member) {
        member.status = 'Paid';
        if (item.utr) member.utr = item.utr;
    }

    // 2. Add to Official Verified Receipts List
    const receiptObj = {
        receiptNo: item.receiptNo,
        memberId: item.memberId,
        memberName: item.memberName,
        amount: item.amount,
        date: item.date,
        utr: item.utr,
        proofImg: item.proofImg,
        status: 'Approved'
    };

    const existingIdx = STATE.receipts.findIndex(r => r.receiptNo === item.receiptNo);
    if (existingIdx !== -1) {
        STATE.receipts[existingIdx] = receiptObj;
    } else {
        STATE.receipts.unshift(receiptObj);
    }

    // 3. REMOVE FROM PENDING QUEUE IMMEDIATELY & RECORD APPROVED ID
    STATE.approvedQueueIds = STATE.approvedQueueIds || [];
    if (queueId) STATE.approvedQueueIds.push(String(queueId));
    STATE.queue.splice(itemIdx, 1);

    saveStorage();
    renderApp();

    showToast(`Saving approval to Google Sheet...`, 'info');

    // Async background sync
    postToSheetAsync({ action: 'VERIFY_ADVANCE', memberId: item.memberId, utr: item.utr, receipt: receiptObj, queueId: queueId })
        .then(() => {
            showToast(`Approved & Saved to Google Sheet for ${item.memberName}!`, 'success');
        })
        .catch(err => console.error(err));
};

// Reject Queue Function
window.rejectQueueSubmission = function(queueId) {
    const item = STATE.queue.find(q => q.id === queueId);
    if (!confirm('Reject this payment submission?')) return;

    STATE.rejectedQueueIds = STATE.rejectedQueueIds || [];
    STATE.rejectedReceiptNos = STATE.rejectedReceiptNos || [];

    if (queueId) STATE.rejectedQueueIds.push(String(queueId));
    if (item && item.receiptNo) STATE.rejectedReceiptNos.push(String(item.receiptNo));

    STATE.queue = STATE.queue.filter(q => q.id !== queueId);
    saveStorage();
    renderApp();

    showToast('Rejecting payment submission in Google Sheet...', 'info');

    postToSheetAsync({ 
        action: 'REJECT_ADVANCE', 
        queueId: queueId,
        receiptNo: item ? item.receiptNo : '' 
    })
        .then(() => {
            showToast('Payment submission rejected.', 'info');
        })
        .catch(err => {
            console.error('Failed to update rejection in Google Sheet:', err);
            showToast('Rejected locally, but Google Sheet sync failed.', 'warning');
        });
};

// 3. Upload Screenshot Handler
function initUploadHandler() {
    const fileInput = document.getElementById('screenshotFileInput');
    const defaultState = document.getElementById('uploadDefaultState');
    const previewState = document.getElementById('uploadPreviewState');
    const previewImg = document.getElementById('previewImageThumb');
    const removeBtn = document.getElementById('btnRemovePhoto');

    fileInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (evt) => {
                currentUploadedImageBase64 = evt.target.result;
                previewImg.src = currentUploadedImageBase64;
                defaultState.classList.add('hidden');
                previewState.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    removeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        currentUploadedImageBase64 = '';
        fileInput.value = '';
        defaultState.classList.remove('hidden');
        previewState.classList.add('hidden');
    });
}

function populateMemberSelect() {
    const select = document.getElementById('payMemberSelect');
    if (!select) return;

    select.innerHTML = STATE.members.map(m => `
        <option value="${m.id}">${m.name} (${m.status === 'Paid' ? 'Approved Paid' : 'Not Paid - ₹' + m.advance})</option>
    `).join('');
}

function renderIssuedReceiptsList() {
    const container = document.getElementById('issuedReceiptsList');
    if (!container) return;

    const allSubmissions = [...STATE.queue, ...STATE.receipts];
    const uniqueReceipts = [];
    const seen = new Set();

    allSubmissions.forEach(r => {
        if (!seen.has(r.receiptNo)) {
            seen.add(r.receiptNo);
            uniqueReceipts.push(r);
        }
    });

    if (uniqueReceipts.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-secondary); padding: 10px;">No payment receipts submitted yet.</p>`;
        return;
    }

    container.innerHTML = uniqueReceipts.map(r => {
        const isApproved = r.status === 'Approved';
        return `
            <div class="member-card" style="cursor: pointer;" onclick="showReceiptModal('${r.receiptNo}')">
                <div class="member-card-left">
                    <div class="avatar-circle" style="background: ${isApproved ? 'var(--emerald-gradient)' : 'linear-gradient(135deg, var(--amber), #d97706)'};"><i class="fa-solid fa-receipt"></i></div>
                    <div class="member-info">
                        <h4>${r.receiptNo} — ${r.memberName}</h4>
                        <p>Date: ${r.date} ${r.utr ? '| UTR: ' + r.utr : ''}</p>
                    </div>
                </div>
                <div class="member-card-right">
                    <strong style="color: ${isApproved ? 'var(--emerald)' : 'var(--amber)'};">₹${Number(r.amount).toLocaleString('en-IN')}</strong>
                    <span class="count-badge ${isApproved ? 'success' : 'warning'}">${isApproved ? 'Approved' : 'Pending Queue'}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Form Handlers
function initForms() {
    // Member Form Submit
    document.getElementById('memberForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const idHidden = document.getElementById('memberIdHidden').value;
        const name = document.getElementById('memberName').value.trim();
        const phone = document.getElementById('memberPhone').value.trim();
        const advance = Number(document.getElementById('memberAdvance').value);
        const days = Number(document.getElementById('memberDays').value);
        const status = document.getElementById('memberStatusSelect').value;

        let memberObj = null;

        if (idHidden) {
            const idx = STATE.members.findIndex(m => m.id === idHidden);
            if (idx !== -1) {
                STATE.members[idx] = Object.assign({}, STATE.members[idx], { name, phone, advance, days, status });
                memberObj = STATE.members[idx];
                showToast('Member details updated');
            }
        } else {
            memberObj = { id: 'm_' + Date.now(), name, phone, advance, days, status, utr: '' };
            STATE.members.push(memberObj);
            showToast('New member added!');
        }

        saveStorage();
        closeModal('memberModal');
        renderApp();

        if (memberObj) {
            postToSheetAsync({ action: 'ADD_MEMBER', member: memberObj });
        }
    });

    // Expense Form Submit
    document.getElementById('expenseForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('expenseTitle').value.trim();
        const amount = Number(document.getElementById('expenseAmount').value);
        const category = document.getElementById('expenseCategory').value;
        const paidBy = document.getElementById('expensePaidBy').value;
        const date = document.getElementById('expenseDate').value;

        const checkedBoxes = document.querySelectorAll('input[name="expenseSplitMember"]:checked');
        const splitAmong = Array.from(checkedBoxes).map(cb => cb.value);

        if (splitAmong.length === 0) {
            showToast('Select at least one member to split!', 'error');
            return;
        }

        const payerObj = STATE.members.find(m => m.id === paidBy);
        const paidByName = payerObj ? payerObj.name : paidBy;

        const splitAmongNames = splitAmong.map(mId => {
            const m = STATE.members.find(mb => mb.id === mId);
            return m ? m.name : mId;
        });

        const newExp = {
            id: 'e_' + Date.now(),
            title, amount, category, paidBy, paidByName, date, splitAmong, splitAmongNames
        };

        STATE.expenses.unshift(newExp);
        saveStorage();
        closeModal('expenseModal');
        renderApp();
        showToast(`Trip expense ₹${amount.toLocaleString('en-IN')} recorded!`, 'success');

        // Async post to Google Sheet
        postToSheetAsync({ action: 'ADD_EXPENSE', expense: newExp });
    });

    // Payment Form Submit -> Add to Queue for Admin Approval
    document.getElementById('paymentReceiptForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const memberId = document.getElementById('payMemberSelect').value;
        const amount = Number(document.getElementById('payAmountInput').value);
        const utr = document.getElementById('payUtrInput').value.trim();

        const member = STATE.members.find(m => m.id === memberId);
        if (!member) return;

        const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const receiptNo = `TR-00${STATE.queue.length + STATE.receipts.length + 1}`;

        // Create Pending Queue Entry
        const queueEntry = {
            id: 'q_' + Date.now(),
            receiptNo,
            memberId: member.id,
            memberName: member.name,
            amount: amount,
            date: dateStr,
            utr: utr || '—',
            proofImg: currentUploadedImageBase64,
            status: 'Pending Approval'
        };

        STATE.queue.unshift(queueEntry);
        saveStorage();

        // Reset Form
        document.getElementById('paymentReceiptForm').reset();
        const uploadDefaultState = document.getElementById('uploadDefaultState');
        const uploadPreviewState = document.getElementById('uploadPreviewState');
        uploadDefaultState?.classList.remove('hidden');
        uploadPreviewState?.classList.add('hidden');
        currentUploadedImageBase64 = '';

        renderApp();

        // Show Generated Pending Receipt Modal
        showReceiptModal(receiptNo);
        showToast(`Submitted to Admin Queue for approval!`, 'info');

        // Sync Queue submission to Google Sheet
        postToSheetAsync({ action: 'SUBMIT_PAYMENT_QUEUE', queueItem: queueEntry });
    });

    // Share Receipt on WhatsApp
    document.getElementById('btnShareWhatsApp')?.addEventListener('click', () => {
        const rcptNo = document.getElementById('rcptNumber').textContent;
        const memberName = document.getElementById('rcptMemberName').textContent;
        const amount = document.getElementById('rcptAmount').textContent;
        const date = document.getElementById('rcptDate').textContent;
        const status = document.getElementById('rcptStampBadge').textContent;

        const text = `*TRIP 2026 - PAYMENT RECEIPT*%0A%0A*Receipt No:* ${rcptNo}%0A*Member:* ${memberName}%0A*Amount Paid:* ${amount}%0A*Date:* ${date}%0A*Status:* ${status} 🧾%0A%0ATrip payment submitted for verification.`;
        window.open(`https://wa.me/?text=${text}`, '_blank');
    });

    // Download PDF
    document.getElementById('btnDownloadPdf')?.addEventListener('click', () => {
        const element = document.getElementById('digitalReceiptDoc');
        const rcptNo = document.getElementById('rcptNumber').textContent || 'Receipt';
        const opt = {
            margin: 0.4,
            filename: `${rcptNo}_Receipt.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    });

    // Sheet Config
    document.getElementById('sheetSettingsForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const url = document.getElementById('appScriptUrl').value.trim();
        STATE.config.webAppUrl = url;
        saveStorage();
        updateSyncPill();
        fetchLiveFromGoogleSheet();
        showToast('Google Sheets URL saved!');
    });

    // Close Modals
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-close');
            closeModal(modalId);
        });
    });
}

function showReceiptModal(receiptNo) {
    const item = STATE.queue.find(q => q.receiptNo === receiptNo) || STATE.receipts.find(r => r.receiptNo === receiptNo);
    if (!item) return;

    document.getElementById('rcptNumber').textContent = item.receiptNo;
    document.getElementById('rcptDate').textContent = item.date;
    document.getElementById('rcptMemberName').textContent = item.memberName;
    document.getElementById('rcptUtr').textContent = item.utr || '—';
    document.getElementById('rcptAmount').textContent = `₹${Number(item.amount).toLocaleString('en-IN')}`;

    const stamp = document.getElementById('rcptStampBadge');
    const statusPill = document.getElementById('rcptStatusPill');

    if (item.status === 'Approved') {
        stamp.textContent = 'VERIFIED & PAID';
        stamp.className = 'rcpt-stamp approved';
        statusPill.textContent = 'Approved & Verified';
        statusPill.className = 'badge success';
    } else {
        stamp.textContent = 'PENDING APPROVAL';
        stamp.className = 'rcpt-stamp';
        statusPill.textContent = 'Pending Admin Approval';
        statusPill.className = 'badge warning';
    }

    const proofBox = document.getElementById('rcptScreenshotBox');
    const proofImg = document.getElementById('rcptProofImg');
    if (item.proofImg) {
        proofImg.src = item.proofImg;
        proofBox.classList.remove('hidden');
    } else {
        proofBox.classList.add('hidden');
    }

    openModal('receiptModal');
}

function openAddMemberModal() {
    document.getElementById('memberForm').reset();
    document.getElementById('memberIdHidden').value = '';
    openModal('memberModal');
}

window.editMember = function(id) {
    const m = STATE.members.find(mb => mb.id === id);
    if (!m) return;
    document.getElementById('memberIdHidden').value = m.id;
    document.getElementById('memberName').value = m.name;
    document.getElementById('memberPhone').value = m.phone || '';
    document.getElementById('memberAdvance').value = m.advance;
    document.getElementById('memberDays').value = m.days;
    document.getElementById('memberStatusSelect').value = m.status;
    openModal('memberModal');
};

window.deleteMember = function(id) {
    if (confirm('Delete member?')) {
        STATE.deletedMemberIds = STATE.deletedMemberIds || [];
        if (id) STATE.deletedMemberIds.push(String(id));
        STATE.members = STATE.members.filter(m => m.id !== id);
        saveStorage();
        renderApp();
        showToast('Member deleted', 'info');
        postToSheetAsync({ action: 'DELETE_MEMBER', memberId: id });
    }
};

window.deleteExpense = function(id) {
    if (confirm('Delete this trip expense?')) {
        STATE.deletedExpenseIds = STATE.deletedExpenseIds || [];
        if (id) STATE.deletedExpenseIds.push(String(id));
        STATE.expenses = STATE.expenses.filter(e => e.id !== id);
        saveStorage();
        renderApp();
        showToast('Expense deleted', 'info');
        postToSheetAsync({ action: 'DELETE_EXPENSE', expenseId: id });
    }
};

function openModal(id) {
    document.getElementById(id)?.classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id)?.classList.add('hidden');
}

// ASYNC POST TO GOOGLE SHEETS
function postToSheetAsync(payload) {
    if (!STATE.config.webAppUrl) return Promise.resolve();

    const cleanPayload = JSON.parse(JSON.stringify(payload));
    if (cleanPayload.receipt && cleanPayload.receipt.proofImg) {
        cleanPayload.receipt.proofImg = '[Image Attached]';
    }
    if (cleanPayload.queueItem && cleanPayload.queueItem.proofImg) {
        cleanPayload.queueItem.proofImg = '[Image Attached]';
    }

    return fetch(STATE.config.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(cleanPayload)
    });
}

function showToast(msg, type = 'info') {
    const box = document.getElementById('toastBox');
    if (!box) return;
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = msg;
    box.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}
