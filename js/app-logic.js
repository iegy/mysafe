// ======== دوال التنبيهات والرسائل التفاعلية المخصصة ========
window.showCustomAlert = function(message, title = "تنبيه") {
    const modalEl = document.getElementById('customAlertModal');
    if (!modalEl) { alert(message); return; }
    document.getElementById('customAlertTitle').textContent = title;
    document.getElementById('customAlertBody').innerHTML = message;
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) { new bootstrap.Modal(modalEl).show(); }
};
window.showCustomConfirm = function(message, callback, title = "تأكيد") {
    const modalEl = document.getElementById('customConfirmModal');
    if (!modalEl) { if (confirm(message)) callback(); return; }
    document.getElementById('customConfirmTitle').textContent = title;
    document.getElementById('customConfirmBody').innerHTML = message;
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const modal = new bootstrap.Modal(modalEl);
        document.getElementById('customConfirmYes').onclick = () => { modal.hide(); callback(); };
        document.getElementById('customConfirmNo').onclick = () => modal.hide();
        modal.show();
    }
};
window.showCustomPrompt = function(message, defaultValue, callback, title = "إدخال") {
    const modalEl = document.getElementById('customPromptModal');
    if (!modalEl) { let val = prompt(message, defaultValue); callback(val); return; }
    document.getElementById('customPromptTitle').textContent = title;
    document.getElementById('customPromptMessage').innerHTML = message;
    document.getElementById('customPromptInput').value = defaultValue || '';
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const modal = new bootstrap.Modal(modalEl);
        document.getElementById('customPromptOk').onclick = () => { modal.hide(); callback(document.getElementById('customPromptInput').value); };
        modal.show();
    }
};

// ======== دوال مساعدة عامة ========
function getCurrency() { return window.workspaceMeta ? window.workspaceMeta.currency : "ج"; }
function backupDataLocally() {
    localStorage.setItem('egyup_raw_data_v2', JSON.stringify(window.appData));
    if (window.saveAppDataToCloud) window.saveAppDataToCloud();
}
function convertToLocalDate(d) { return d ? new Date(d).toLocaleDateString('ar-EG') : ''; }
function calculateCreditCardDueDate(pd) {
    let d = new Date(pd); let m = d.getMonth() + 1; let y = d.getFullYear();
    if (m > 11) { m = 0; y++; } return new Date(y, m, 25);
}
function calculateDaysLeft(td) {
    let t = new Date(); t.setHours(0,0,0,0); td.setHours(0,0,0,0);
    return Math.ceil((td - t) / 86400000);
}
function getNextDateForSpecificDay(day) {
    let t = new Date(); let y = t.getFullYear(), m = t.getMonth();
    let max = new Date(y, m+1, 0).getDate(); let targetDay = Math.min(day, max);
    let target = new Date(y, m, targetDay);
    if (t.getDate() > targetDay) {
        let nmax = new Date(y, m+2, 0).getDate(); target = new Date(y, m+1, Math.min(day, nmax));
    }
    return target;
}
function addMonthsToDateStr(ds, mo) { let d = new Date(ds); d.setMonth(d.getMonth() + mo); return d.toISOString().split('T')[0]; }
function getAssetFinancialValue(item) {
    if (item.assetType === 'gold' || item.assetType === 'silver') {
        return (parseFloat(item.currentAmount)||0) * (parseFloat(item.currentPricePerGram)||0);
    }
    return parseFloat(item.currentAmount)||0;
}
window.validateImportData = function(data) {
    return data && typeof data === 'object' && Array.isArray(data.installments) && Array.isArray(data.recurring) && Array.isArray(data.cards) && Array.isArray(data.income) && Array.isArray(data.savings) && Array.isArray(data.scheduledDebts) && Array.isArray(data.goals);
}

// ======== تجميع وحساب الأقساط حسب الجهة ========
window.groupInstallmentsByEntity = function() {
    const groups = {};
    window.appData.installments.forEach((item, idx) => {
        const entity = item.entity || 'غير محدد';
        if (!groups[entity]) groups[entity] = [];
        groups[entity].push({ ...item, originalIndex: idx });
    });
    return groups;
}

window.getGroupedInstallmentSummary = function(groupItems) {
    let totalAmount = 0, totalPaidCount = 0, totalCountSum = 0, totalPaidAmount = 0;
    let totalMonthly = 0, totalRemaining = 0;
    let nextDueDate = null;

    groupItems.forEach(item => {
        const ta = parseFloat(item.totalAmount) || 0;
        const mo = parseFloat(item.monthlyAmount) || 0;
        const tc = parseInt(item.totalCount) || 0;
        const pc = parseInt(item.paidCount) || 0;
        totalAmount += ta;
        totalPaidCount += pc;
        totalCountSum += tc;
        totalPaidAmount += mo * pc;
        totalMonthly += (pc < tc) ? mo : 0;
        totalRemaining += Math.max(0, ta - (mo * pc));

        for (let i = pc; i < tc; i++) {
            const due = new Date(addMonthsToDateStr(item.startDate, i));
            if (!nextDueDate || due < nextDueDate) nextDueDate = due;
        }
    });

    const progress = totalAmount > 0 ? Math.round((totalPaidAmount / totalAmount) * 100) : 100;
    const isComplete = totalPaidCount >= totalCountSum;
    return {
        totalAmount, totalPaidCount, totalCountSum, totalPaidAmount,
        totalMonthly, totalRemaining, progress, isComplete, nextDueDate
    };
}

// ======== عرض جدول الأقساط ========
window.renderInstallmentsTable = function() {
    const tbody = document.getElementById('installmentsTableBody');
    const summaryCard = document.getElementById('installmentsSummaryCard');
    if (!tbody) return;

    tbody.innerHTML = '';
    let grandTotalRem = 0, grandTotalPaid = 0;

    if (window.appData.installments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="bi bi-credit-card-2-front"></i><p>لا توجد أقساط مسجلة حالياً</p><button class="btn btn-sm btn-success write-action" onclick="showFormModal('installment')"><i class="bi bi-plus-circle"></i> إضافة قسط جديد</button></div></td></tr>`;
        if (summaryCard) summaryCard.innerHTML = '';
        return;
    }

    const groups = window.groupInstallmentsByEntity();
    const entityNames = Object.keys(groups).sort();

    entityNames.forEach(entity => {
        const items = groups[entity];
        const summary = window.getGroupedInstallmentSummary(items);
        grandTotalRem += summary.totalRemaining;
        grandTotalPaid += summary.totalPaidAmount;

        const isExpanded = window.expandedEntities[entity] !== false;
        const rowClass = isExpanded ? 'expanded' : '';
        const iconRotate = isExpanded ? 'transform: rotate(-90deg);' : '';

        let groupRow = `
        <tr class="entity-group-row ${rowClass}" data-entity="${entity}" onclick="toggleEntityGroup('${entity}')" style="cursor:pointer; background:var(--bg-secondary); border-right: 5px solid var(--accent);">
            <td class="text-start">
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-chevron-left group-toggle-icon" style="transition: transform 0.2s ease; ${iconRotate}"></i>
                    <div>
                        <span class="fw-bold fs-6">${entity}</span>
                        <span class="badge bg-accent-soft text-accent ms-2">${items.length} أقساط</span>
                        ${summary.isComplete ? '<span class="badge bg-success-soft text-success ms-1">✅ مكتمل</span>' : ''}
                    </div>
                </div>
            </td>
            <td>
                <div class="fw-bold text-danger">${summary.totalRemaining.toLocaleString()} ${getCurrency()}</div>
                <small class="text-muted">من أصل ${summary.totalAmount.toLocaleString()} ${getCurrency()}</small>
            </td>
            <td>
                <div class="fw-bold text-primary">${summary.totalMonthly.toLocaleString()} ${getCurrency()}</div>
                <small class="badge ${summary.nextDueDate ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'}">
                    ${summary.nextDueDate ? 'استحقاق: ' + convertToLocalDate(summary.nextDueDate) : 'مكتمل ✅'}
                </small>
            </td>
            <td>
                <div class="d-flex align-items-center gap-2 justify-content-center">
                    <div class="progress flex-grow-1" style="height:8px; max-width:120px;">
                        <div class="progress-bar bg-success" style="width:${summary.progress}%"></div>
                    </div>
                    <span class="fw-bold text-success small">${summary.progress}%</span>
                </div>
                <small class="text-muted">تم سداد ${summary.totalPaidCount} من ${summary.totalCountSum} شهور</small>
            </td>
            <td>
                <div class="d-flex gap-1 justify-content-center" onclick="event.stopPropagation()">
                    <button class="btn btn-sm btn-success px-2 py-1 write-action" onclick="incrementFirstUnpaid('${entity}')" title="سداد القسط القادم للجهة">
                        <i class="bi bi-check-circle-fill"></i> سداد قسط
                    </button>
                    <button class="btn btn-sm btn-outline-primary write-action" onclick="showFormModal('installment')">
                        <i class="bi bi-plus-lg"></i> إضافة قسط
                    </button>
                </div>
            </td>
        </tr>`;

        tbody.innerHTML += groupRow;

        items.forEach((item, idx) => {
            const paid = parseInt(item.paidCount) || 0;
            const total = parseInt(item.totalCount) || 0;
            const monthly = parseFloat(item.monthlyAmount) || 0;
            const totalAmt = parseFloat(item.totalAmount) || 0;
            const rem = Math.max(0, totalAmt - (monthly * paid));
            const next = paid < total ? addMonthsToDateStr(item.startDate, paid) : 'مكتمل';
            const prog = total > 0 ? Math.round((paid / total) * 100) : 0;

            let childRow = `
            <tr class="entity-child-row ${isExpanded ? '' : 'collapsed'}" data-parent="${entity}" style="font-size:0.85rem; background: var(--bg-primary);">
                <td class="text-start ps-4 text-muted">
                    ↳ قسط فرعي رقم ${idx + 1}
                </td>
                <td>
                    <span class="text-danger">${rem.toLocaleString()} ${getCurrency()}</span>
                    <span class="text-muted"> / ${totalAmt.toLocaleString()}</span>
                </td>
                <td>
                    <span class="text-primary fw-semibold">${monthly.toLocaleString()} ${getCurrency()}</span>
                    <br>
                    <small class="text-muted">التالي: ${next === 'مكتمل' ? '✅' : convertToLocalDate(next)}</small>
                </td>
                <td>
                    <div class="d-flex align-items-center gap-2 justify-content-center">
                        <div class="progress flex-grow-1" style="height:6px; max-width:80px;">
                            <div class="progress-bar bg-info" style="width:${prog}%"></div>
                        </div>
                        <span class="small text-muted">${prog}% (${paid}/${total})</span>
                    </div>
                </td>
                <td>
                    <div class="d-flex gap-1 justify-content-center">
                        <button class="btn btn-sm btn-outline-success px-2 py-0 write-action" onclick="incrementInstallment(${item.originalIndex})" title="سداد شهر واحد">+1</button>
                        <button class="btn btn-sm btn-outline-warning p-1 py-0 write-action" onclick="editModuleItem('installment',${item.originalIndex})"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger p-1 py-0 write-action" onclick="deleteModuleItem('installment',${item.originalIndex})"><i class="bi bi-trash"></i></button>
                    </div>
                </td>
            </tr>`;
            tbody.innerHTML += childRow;
        });
    });

    if (summaryCard) {
        summaryCard.innerHTML = `💡 إجمالي ما تم سداده: <b>${grandTotalPaid.toLocaleString()} ${getCurrency()}</b> | المتبقي للالتزامات كاملة: <b class="text-danger">${grandTotalRem.toLocaleString()} ${getCurrency()}</b> | عدد الجهات النشطة: <b>${entityNames.length}</b>`;
    }
    window.applyPermissionsUI();
    if (typeof PrivacySystem !== 'undefined') PrivacySystem.applyState();
}

window.toggleEntityGroup = function(entity) {
    window.expandedEntities[entity] = window.expandedEntities[entity] === false ? true : false;
    const groupRow = document.querySelector(`tr.entity-group-row[data-entity="${entity}"]`);
    const childRows = document.querySelectorAll(`tr.entity-child-row[data-parent="${entity}"]`);
    const icon = groupRow ? groupRow.querySelector('.group-toggle-icon') : null;

    if (window.expandedEntities[entity] !== false) {
        childRows.forEach(r => r.classList.remove('collapsed'));
        if (groupRow) groupRow.classList.add('expanded');
        if (icon) icon.style.transform = 'rotate(-90deg)';
    } else {
        childRows.forEach(r => r.classList.add('collapsed'));
        if (groupRow) groupRow.classList.remove('expanded');
        if (icon) icon.style.transform = 'rotate(0deg)';
    }
}

window.expandAllEntities = function() {
    const groups = window.groupInstallmentsByEntity();
    Object.keys(groups).forEach(entity => {
        window.expandedEntities[entity] = true;
        const groupRow = document.querySelector(`tr.entity-group-row[data-entity="${entity}"]`);
        const childRows = document.querySelectorAll(`tr.entity-child-row[data-parent="${entity}"]`);
        const icon = groupRow ? groupRow.querySelector('.group-toggle-icon') : null;
        childRows.forEach(r => r.classList.remove('collapsed'));
        if (groupRow) groupRow.classList.add('expanded');
        if (icon) icon.style.transform = 'rotate(-90deg)';
    });
}

window.collapseAllEntities = function() {
    const groups = window.groupInstallmentsByEntity();
    Object.keys(groups).forEach(entity => {
        window.expandedEntities[entity] = false;
        const groupRow = document.querySelector(`tr.entity-group-row[data-entity="${entity}"]`);
        const childRows = document.querySelectorAll(`tr.entity-child-row[data-parent="${entity}"]`);
        const icon = groupRow ? groupRow.querySelector('.group-toggle-icon') : null;
        childRows.forEach(r => r.classList.add('collapsed'));
        if (groupRow) groupRow.classList.remove('expanded');
        if (icon) icon.style.transform = 'rotate(0deg)';
    });
}

window.incrementFirstUnpaid = function(entity) {
    if (window.userRole === 'Viewer') { showCustomAlert('صلاحية قراءة فقط.', 'خطأ'); return; }
    const groups = window.groupInstallmentsByEntity();
    const items = groups[entity] || [];
    let earliestItem = null;
    let earliestDue = null;

    items.forEach(item => {
        const pc = parseInt(item.paidCount) || 0;
        const tc = parseInt(item.totalCount) || 0;
        for (let i = pc; i < tc; i++) {
            const due = new Date(addMonthsToDateStr(item.startDate, i));
            if (!earliestDue || due < earliestDue) {
                earliestDue = due;
                earliestItem = item;
            }
            break;
        }
    });

    if (earliestItem && (parseInt(earliestItem.paidCount) || 0) < (parseInt(earliestItem.totalCount) || 0)) {
        earliestItem.paidCount = (parseInt(earliestItem.paidCount) || 0) + 1;
        backupDataLocally();
        window.renderAllModulesTables();
        window.calculateFinanceReport();
        window.calculateGlobalOverview();
        window.renderSmartAlertsPanel();
        showCustomAlert('✅ تم تسجيل سداد القسط القادم للجهة: ' + entity, 'نجاح');
    } else {
        showCustomAlert('جميع أقساط هذه الجهة مكتملة ومسددة بالكامل.', 'تنبيه');
    }
}

// ======== نظام التنبيهات الذكي ========
window.collectAllDueItems = function() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const today = now.getTime();
    const alertDaysLimit = window.workspaceMeta.alertDays || 3;
    const allItems = { overdue: [], dueToday: [], dueSoon: [], upcoming: [] };

    window.appData.installments.forEach(item => {
        const total = parseInt(item.totalCount) || 0;
        const paid = parseInt(item.paidCount) || 0;
        const monthly = parseFloat(item.monthlyAmount) || 0;
        for (let i = paid; i < total; i++) {
            const due = new Date(addMonthsToDateStr(item.startDate, i));
            due.setHours(0, 0, 0, 0);
            const diff = Math.ceil((due.getTime() - today) / 86400000);
            const obj = { type: 'قسط', entity: item.entity, description: `${item.entity} (القسط رقم ${i+1}/${total})`, amount: monthly, dueDate: due, daysLeft: diff };
            if (diff < 0) allItems.overdue.push(obj);
            else if (diff === 0) allItems.dueToday.push(obj);
            else if (diff <= alertDaysLimit) allItems.dueSoon.push(obj);
            else if (diff <= 14) allItems.upcoming.push(obj);
        }
    });

    window.appData.cards.forEach(item => {
        const due = calculateCreditCardDueDate(item.purchaseDate);
        due.setHours(0, 0, 0, 0);
        const diff = Math.ceil((due.getTime() - today) / 86400000);
        const obj = { type: 'بطاقة', entity: item.bank, description: `${item.bank} - ${item.cardName}`, amount: parseFloat(item.requiredAmount) || 0, dueDate: due, daysLeft: diff };
        if (diff < 0) allItems.overdue.push(obj);
        else if (diff === 0) allItems.dueToday.push(obj);
        else if (diff <= alertDaysLimit) allItems.dueSoon.push(obj);
        else if (diff <= 14) allItems.upcoming.push(obj);
    });

    window.appData.scheduledDebts.forEach(item => {
        const due = new Date(item.dueDate);
        due.setHours(0, 0, 0, 0);
        const diff = Math.ceil((due.getTime() - today) / 86400000);
        const obj = { type: 'دين', entity: 'ديون مجدولة', description: item.description, amount: parseFloat(item.amount) || 0, dueDate: due, daysLeft: diff };
        if (diff < 0) allItems.overdue.push(obj);
        else if (diff === 0) allItems.dueToday.push(obj);
        else if (diff <= alertDaysLimit) allItems.dueSoon.push(obj);
        else if (diff <= 14) allItems.upcoming.push(obj);
    });

    window.appData.recurring.forEach(item => {
        const expenseType = item.expenseType || 'recurring';
        const amount = parseFloat(item.amount) || 0;
        let dueDate;
        if (expenseType === 'one-time') {
            dueDate = item.dueDate ? new Date(item.dueDate) : null;
        } else {
            dueDate = getNextDateForSpecificDay(item.day);
        }
        if (dueDate) {
            dueDate.setHours(0, 0, 0, 0);
            const diff = Math.ceil((dueDate.getTime() - today) / 86400000);
            const obj = { type: 'مصروف', entity: item.category, description: `${item.category} (${expenseType === 'one-time' ? 'مرة واحدة' : 'دوري'})`, amount: amount, dueDate: dueDate, daysLeft: diff };
            if (diff < 0 && expenseType === 'recurring') allItems.overdue.push(obj);
            else if (diff === 0) allItems.dueToday.push(obj);
            else if (diff > 0 && diff <= alertDaysLimit && expenseType === 'recurring') allItems.dueSoon.push(obj);
            else if (diff > 0 && diff <= 14 && expenseType === 'recurring') allItems.upcoming.push(obj);
            if (expenseType === 'one-time' && diff < 0) allItems.overdue.push(obj);
        }
    });

    allItems.overdue.sort((a, b) => a.daysLeft - b.daysLeft);
    allItems.dueSoon.sort((a, b) => a.daysLeft - b.daysLeft);
    allItems.upcoming.sort((a, b) => a.daysLeft - b.daysLeft);

    return allItems;
}

window.renderSmartAlertsPanel = function() {
    const panel = document.getElementById('smartAlertsPanel');
    if (!panel) return;

    const allItems = window.collectAllDueItems();
    const totalOverdue = allItems.overdue.length;
    const totalDueToday = allItems.dueToday.length;
    const totalDueSoon = allItems.dueSoon.length;
    const totalAlerts = totalOverdue + totalDueToday + totalDueSoon;

    let html = '';

    if (totalAlerts > 0) {
        html += `<div class="alerts-summary-bar">`;
        if (totalOverdue > 0) html += `<span class="alerts-summary-chip bg-overdue-soft text-overdue fw-bold" style="color:var(--overdue);" onclick="scrollToAlerts('overdue')"><i class="bi bi-exclamation-octagon-fill"></i> ${totalOverdue} متأخر</span>`;
        if (totalDueToday > 0) html += `<span class="alerts-summary-chip bg-danger-soft text-danger fw-bold" onclick="scrollToAlerts('today')"><i class="bi bi-calendar-x-fill"></i> ${totalDueToday} استحقاق اليوم</span>`;
        if (totalDueSoon > 0) html += `<span class="alerts-summary-chip bg-warning-soft text-warning fw-bold" style="color:#e0a800;" onclick="scrollToAlerts('soon')"><i class="bi bi-clock-fill"></i> ${totalDueSoon} قريباً</span>`;
        html += `</div>`;
    }

    if (totalOverdue > 0) {
        html += `<div class="mb-3" id="alerts-overdue"><h6 class="fw-bold" style="color:var(--overdue);"><i class="bi bi-exclamation-triangle-fill blink-alert"></i> متأخرات وتأجيل غير مسدد (${totalOverdue})</h6>`;
        allItems.overdue.forEach(item => {
            html += `<div class="alert-item overdue"><div class="d-flex justify-content-between align-items-center"><div><b>${item.type}:</b> ${item.description}</div><div><span class="fw-bold" style="color:var(--overdue);">${item.amount.toLocaleString()} ${getCurrency()}</span> | <span class="badge bg-danger">متأخر ${Math.abs(item.daysLeft)} يوم</span></div></div></div>`;
        });
        html += `</div>`;
    }

    if (totalDueToday > 0) {
        html += `<div class="mb-3" id="alerts-today"><h6 class="fw-bold" style="color:var(--danger);"><i class="bi bi-calendar-check-fill blink-alert"></i> استحقاق اليوم (${totalDueToday})</h6>`;
        allItems.dueToday.forEach(item => {
            html += `<div class="alert-item due-today"><div class="d-flex justify-content-between align-items-center"><div><b>${item.type}:</b> ${item.description}</div><div><span class="fw-bold" style="color:var(--danger);">${item.amount.toLocaleString()} ${getCurrency()}</span> | <span class="badge bg-danger">اليوم</span></div></div></div>`;
        });
        html += `</div>`;
    }

    if (totalDueSoon > 0) {
        html += `<div class="mb-3" id="alerts-soon"><h6 class="fw-bold" style="color:#e0a800;"><i class="bi bi-hourglass-split"></i> قريباً خلال ${window.workspaceMeta.alertDays || 3} أيام (${totalDueSoon})</h6>`;
        allItems.dueSoon.forEach(item => {
            html += `<div class="alert-item due-soon"><div class="d-flex justify-content-between align-items-center"><div><b>${item.type}:</b> ${item.description}</div><div><span class="fw-bold" style="color:#e0a800;">${item.amount.toLocaleString()} ${getCurrency()}</span> | <span class="badge bg-warning text-dark">خلال ${item.daysLeft} يوم</span></div></div></div>`;
        });
        html += `</div>`;
    }

    if (totalAlerts === 0) {
        html = `<div class="alert alert-success text-center mb-3" style="border-radius:var(--radius-lg);"><i class="bi bi-check-circle-fill"></i> <b>لا توجد التزامات قريبة أو متأخرة - وضعك المالي ممتاز ومستقر ✅</b></div>`;
    }

    panel.innerHTML = html;

    const badge = document.getElementById('notificationBadge');
    if (badge) {
        if (totalAlerts > 0) {
            badge.textContent = totalAlerts;
            badge.style.display = 'block';
            badge.classList.toggle('blink-alert', totalOverdue > 0 || totalDueToday > 0);
        } else {
            badge.style.display = 'none';
            badge.classList.remove('blink-alert');
        }
    }
    if (typeof PrivacySystem !== 'undefined') PrivacySystem.applyState();
}

window.scrollToAlerts = function(category) {
    const map = { 'overdue': 'alerts-overdue', 'today': 'alerts-today', 'soon': 'alerts-soon' };
    const targetId = map[category];
    if (targetId) {
        const el = document.getElementById(targetId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

window.showAlertsPanel = function() {
    const allItems = window.collectAllDueItems();
    const modalBody = document.getElementById('alertsModalBody');
    if (!modalBody) return;

    let html = '';
    const totalAlerts = allItems.overdue.length + allItems.dueToday.length + allItems.dueSoon.length;

    if (totalAlerts === 0) {
        html = `<div class="text-center py-4"><i class="bi bi-check-circle-fill text-success" style="font-size:3rem;"></i><h5 class="mt-2">لا توجد تنبيهات حالية</h5><p class="text-muted">وضعك المالي مستقر تماماً ومطمئن ✅</p></div>`;
    } else {
        if (allItems.overdue.length > 0) {
            html += `<h6 class="fw-bold text-danger"><i class="bi bi-exclamation-triangle-fill"></i> متأخرات (${allItems.overdue.length})</h6>`;
            allItems.overdue.forEach(item => {
                html += `<div class="alert alert-danger py-2">🚨 <b>${item.type}:</b> ${item.description} | <b>${item.amount.toLocaleString()} ${getCurrency()}</b> | متأخر ${Math.abs(item.daysLeft)} يوم | ${convertToLocalDate(item.dueDate)}</div>`;
            });
        }
        if (allItems.dueToday.length > 0) {
            html += `<h6 class="fw-bold text-danger mt-3"><i class="bi bi-calendar-x-fill"></i> استحقاق اليوم (${allItems.dueToday.length})</h6>`;
            allItems.dueToday.forEach(item => {
                html += `<div class="alert alert-danger py-2">🔴 <b>${item.type}:</b> ${item.description} | <b>${item.amount.toLocaleString()} ${getCurrency()}</b> | اليوم</div>`;
            });
        }
        if (allItems.dueSoon.length > 0) {
            html += `<h6 class="fw-bold text-warning mt-3"><i class="bi bi-hourglass-split"></i> قريباً (${allItems.dueSoon.length})</h6>`;
            allItems.dueSoon.forEach(item => {
                html += `<div class="alert alert-warning py-2">🟡 <b>${item.type}:</b> ${item.description} | <b>${item.amount.toLocaleString()} ${getCurrency()}</b> | خلال ${item.daysLeft} يوم | ${convertToLocalDate(item.dueDate)}</div>`;
            });
        }
    }

    modalBody.innerHTML = html;
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) { new bootstrap.Modal(document.getElementById('alertsModal')).show(); }
    if (typeof PrivacySystem !== 'undefined') PrivacySystem.applyState();
}

window.requestNotificationPermission = function() {
    if (!('Notification' in window)) { showCustomAlert('المتصفح لا يدعم الإشعارات للأسف.'); return; }
    if (Notification.permission === 'granted') {
        window.notificationsEnabled = true;
        showCustomAlert('الإشعارات مفعلة مسبقاً بنجاح.', 'مؤكد');
        window.updateNotificationBadge();
        startNotificationChecker();
    } else if (Notification.permission === 'denied') {
        showCustomAlert('تم حظر الإشعارات من إعدادات المتصفح.', 'تنبيه');
    } else {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                window.notificationsEnabled = true;
                showCustomAlert('تم تفعيل الإشعارات بنجاح.', 'مكتمل');
                window.updateNotificationBadge();
                startNotificationChecker();
            }
        });
    }
}

window.checkUpcomingDues = function() {
    if (!window.notificationsEnabled && Notification.permission !== 'granted') return;
    const allItems = window.collectAllDueItems();
    const urgentItems = [...allItems.overdue, ...allItems.dueToday, ...allItems.dueSoon];
    const totalUrgent = urgentItems.length;

    const badge = document.getElementById('notificationBadge');
    if (badge) {
        if (totalUrgent > 0) {
            badge.textContent = totalUrgent;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }

    if (totalUrgent > 0 && window.notificationsEnabled) {
        const totalAmount = urgentItems.reduce((sum, item) => sum + item.amount, 0);
        new Notification('📌 تنبيه مالي - Egyup', {
            body: `لديك ${totalUrgent} التزامات بقيمة ${totalAmount.toLocaleString()} ${getCurrency()}. المتأخرات: ${allItems.overdue.length}`,
            icon: 'https://i.ibb.co/9mj4x6NH/Chat-GPT-Image-26-2026-06-28-40.png',
            tag: 'egyup-dues',
            requireInteraction: true
        });
    }
}

function startNotificationChecker() {
    window.checkUpcomingDues();
    if (window.notificationInterval) clearInterval(window.notificationInterval);
    window.notificationInterval = setInterval(window.checkUpcomingDues, 900000);
}

window.updateNotificationBadge = function() {
    window.checkUpcomingDues();
    window.renderSmartAlertsPanel();
}

// ======== عرض جميع الجداول والموديولات ========
window.renderAllModulesTables = function() {
    window.renderInstallmentsTable();

    let rb = document.getElementById('recurringTableBody');
    if (rb) {
        rb.innerHTML = '';
        if (window.appData.recurring.length === 0) {
            rb.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="bi bi-receipt-cutoff"></i><p>لا توجد مصروفات دورية مسجلة</p><button class="btn btn-sm btn-success write-action" onclick="showFormModal('recurring')"><i class="bi bi-plus-circle"></i> إضافة مصروف</button></div></td></tr>`;
        } else {
            window.appData.recurring.forEach((item, idx) => {
                const expenseType = item.expenseType || 'recurring';
                let dateDisplay = '';
                let statusDisplay = '';
                if (expenseType === 'one-time') {
                    dateDisplay = convertToLocalDate(item.dueDate);
                    const due = new Date(item.dueDate);
                    due.setHours(0,0,0,0);
                    const diff = calculateDaysLeft(due);
                    statusDisplay = diff < 0 ? '<span class="badge bg-danger">متأخر</span>' : (diff === 0 ? '<span class="badge bg-warning text-dark">اليوم</span>' : '<span class="badge bg-success">قادم</span>');
                } else {
                    const nd = getNextDateForSpecificDay(item.day);
                    dateDisplay = `يوم ${item.day} (${convertToLocalDate(nd)})`;
                    statusDisplay = '<span class="badge bg-info">دوري نشط</span>';
                }

                const isPaid = item.isPaid || false;
                const statusBadge = isPaid
                    ? '<span class="badge bg-success">🟢 مدفوع</span>'
                    : '<span class="badge bg-danger">🔴 غير مدفوع</span>';

                rb.innerHTML += `
                    <tr>
                        <td>${item.category}</td>
                        <td><span class="expense-type-badge ${expenseType==='one-time'?'bg-warning text-dark':'bg-primary'}">${expenseType==='one-time'?'مرة واحدة':'دوري شهري'}</span></td>
                        <td class="fw-bold">${parseFloat(item.amount).toLocaleString()} ${getCurrency()}</td>
                        <td>${dateDisplay}</td>
                        <td>
                            ${statusBadge}
                            <button class="btn btn-sm btn-outline-secondary px-2 py-0 write-action" onclick="toggleRecurringPaid(${idx})" title="تبديل حالة الدفع">🔁</button>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-outline-warning write-action" onclick="editModuleItem('recurring',${idx})"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger write-action" onclick="deleteModuleItem('recurring',${idx})"><i class="bi bi-trash"></i></button>
                        </td>
                    </tr>`;
            });
        }
    }

    let cb = document.getElementById('cardsTableBody');
    if (cb) {
        cb.innerHTML = '';
        if (window.appData.cards.length === 0) {
            cb.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="bi bi-credit-card"></i><p>لا توجد بطاقات بمديونيات حالية</p><button class="btn btn-sm btn-success write-action" onclick="showFormModal('card')"><i class="bi bi-plus-circle"></i> إضافة</button></div></td></tr>`;
        } else {
            window.appData.cards.forEach((item, idx) => {
                let due = calculateCreditCardDueDate(item.purchaseDate);
                let days = calculateDaysLeft(due);
                cb.innerHTML += `<tr><td><b>${item.bank}</b></td><td>${item.cardName}</td><td>${convertToLocalDate(item.purchaseDate)}</td><td class="text-danger fw-bold">${parseFloat(item.requiredAmount).toLocaleString()} ${getCurrency()}</td><td>${convertToLocalDate(due)}</td><td><span class="badge ${days<0?'bg-danger':(days<=3?'bg-warning text-dark':'bg-success')}">${days<0?'متأخر':days+' يوم'}</span></td><td><button class="btn btn-sm btn-outline-primary px-2 py-0 write-action" onclick="clearCardDebt(${idx})">✅ سداد</button> <button class="btn btn-sm btn-outline-warning write-action" onclick="editModuleItem('card',${idx})"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger write-action" onclick="deleteModuleItem('card',${idx})"><i class="bi bi-trash"></i></button></td></tr>`;
            });
        }
    }

    let inb = document.getElementById('incomeTableBody');
    if (inb) {
        inb.innerHTML = '';
        if (window.appData.income.length === 0) {
            inb.innerHTML = `<tr><td colspan="4"><div class="empty-state"><i class="bi bi-cash-stack"></i><p>لا توجد مصادر دخل مضافة</p><button class="btn btn-sm btn-success write-action" onclick="showFormModal('income')"><i class="bi bi-plus-circle"></i> إضافة</button></div></td></tr>`;
        } else {
            window.appData.income.forEach((item, idx) => {
                inb.innerHTML += `<tr><td>${item.source}</td><td class="text-success fw-bold">${parseFloat(item.amount).toLocaleString()} ${getCurrency()}</td><td>يوم ${item.day}</td><td><button class="btn btn-sm btn-outline-warning write-action" onclick="editModuleItem('income',${idx})"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger write-action" onclick="deleteModuleItem('income',${idx})"><i class="bi bi-trash"></i></button></td></tr>`;
            });
        }
    }

    let sb = document.getElementById('savingsTableBody');
    if (sb) {
        sb.innerHTML = '';
        if (window.appData.savings.length === 0) {
            sb.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="bi bi-safe2"></i><p>لا توجد مدخرات أو وعاء استثماري</p><button class="btn btn-sm btn-success write-action" onclick="showFormModal('savings')"><i class="bi bi-plus-circle"></i> إضافة أصل</button></div></td></tr>`;
        } else {
            window.appData.savings.forEach((item, idx) => {
                let assetType = item.assetType || 'cash';
                let tgt = parseFloat(item.targetAmount) || 0;
                let finValue = getAssetFinancialValue(item);
                let purchasePrice = parseFloat(item.purchasePrice) || 0;
                let purchaseDate = item.purchaseDate ? convertToLocalDate(item.purchaseDate) : '-';
                let pct = tgt > 0 ? Math.min(100, Math.round((finValue / tgt) * 100)) : 100;
                let badgeColor = assetType === 'gold' ? 'bg-warning text-dark' : (assetType === 'silver' ? 'bg-light text-dark border' : 'bg-primary text-white');
                let purityText = assetType === 'gold' ? ` عيار ${item.karat||24}` : (assetType === 'silver' ? ` عيار ${item.silverPurity||'999'}` : '');
                let assetName = assetType === 'gold' ? `ذهب${purityText}` : (assetType === 'silver' ? `فضة${purityText}` : 'كاش');
                let priceInfo = (assetType === 'gold' || assetType === 'silver') ? `<br><small class="text-muted">سعر الجرام: ${(parseFloat(item.currentPricePerGram)||0).toLocaleString()} ${getCurrency()}</small>` : '';
                let purchaseInfo = assetType === 'cash' ? '-' : (purchasePrice > 0 ? purchasePrice.toLocaleString() + ' ' + getCurrency() : '-');
                let profitHtml = '';
                if (assetType !== 'cash' && purchasePrice > 0) {
                    let profit = finValue - purchasePrice;
                    let profitClass = profit >= 0 ? 'text-success' : 'text-danger';
                    let profitSign = profit >= 0 ? '+' : '';
                    profitHtml = `<br><small class="${profitClass} fw-bold">${profitSign}${profit.toLocaleString()} ${getCurrency()}</small>`;
                }
                let purchaseCell = assetType === 'cash' ? '-' : `${purchaseInfo}${profitHtml}`;
                let dateInfo = assetType === 'cash' ? '-' : purchaseDate;
                sb.innerHTML += `
                    <tr>
                        <td><span class="badge ${badgeColor}">${assetName}</span></td>
                        <td><b>${item.goalName}</b>${priceInfo}</td>
                        <td>${tgt>0?tgt.toLocaleString()+' (مستهدف)':finValue.toLocaleString()}</td>
                        <td class="text-success fw-bold">${finValue.toLocaleString()} ${getCurrency()}</td>
                        <td>${purchaseCell}</td>
                        <td>${dateInfo}</td>
                        <td>${tgt>0?`<div class="progress" style="height:8px;"><div class="progress-bar bg-info" style="width:${pct}%"></div></div><small>${pct}%</small>`:'<span class="text-muted">أصل مادي</span>'}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-success px-2 py-0 write-action" onclick="quickDepositSavings(${idx})">➕</button>
                            <button class="btn btn-sm btn-outline-warning write-action" onclick="editModuleItem('savings',${idx})"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger write-action" onclick="deleteModuleItem('savings',${idx})"><i class="bi bi-trash"></i></button>
                        </td>
                    </tr>`;
            });
        }
    }

    let sdb = document.getElementById('scheduledDebtsTableBody');
    if (sdb) {
        sdb.innerHTML = '';
        if (window.appData.scheduledDebts.length === 0) {
            sdb.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="bi bi-calendar-x"></i><p>لا توجد ديون مجدولة مضافة</p><button class="btn btn-sm btn-success write-action" onclick="showFormModal('scheduledDebt')"><i class="bi bi-plus-circle"></i> إضافة</button></div></td></tr>`;
        } else {
            window.appData.scheduledDebts.forEach((item, idx) => {
                sdb.innerHTML += `<tr><td><b>${item.description}</b></td><td class="text-danger fw-bold">${parseFloat(item.amount).toLocaleString()} ${getCurrency()}</td><td>${convertToLocalDate(item.dueDate)}</td><td class="text-muted small">${item.notes||'-'}</td><td><button class="btn btn-sm btn-outline-warning write-action" onclick="editModuleItem('scheduledDebt',${idx})"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger write-action" onclick="deleteModuleItem('scheduledDebt',${idx})"><i class="bi bi-trash"></i></button></td></tr>`;
            });
        }
    }

    window.applyPermissionsUI();
    if (typeof PrivacySystem !== 'undefined') PrivacySystem.applyState();
}

// ======== دوال النماذج الذكية ========
let currentEditType = '';
let currentEditIndex = null;

window.showFormModal = function(type, editIndex = null) {
    if (window.userRole === 'Viewer') { showCustomAlert('صلاحية قراءة فقط.', 'خطأ'); return; }
    currentEditType = type;
    currentEditIndex = editIndex;
    let isEdit = editIndex !== null;
    document.getElementById('formModalTitle').textContent = isEdit ? 'تعديل البيانات' : 'إضافة بند جديد';
    let body = document.getElementById('formModalBody');
    body.innerHTML = '';

    if (type === 'installment') {
        let item = isEdit ? window.appData.installments[editIndex] : {};
        body.innerHTML = `
            <input type="text" id="in_ent" class="form-control mb-2" placeholder="الجهة (مثال: البنك الأهلي، تمويل سيارة)" value="${item.entity||''}">
            <input type="number" id="in_tot" class="form-control mb-2" placeholder="المبلغ الكلي الكلي" min="0" step="0.01" value="${item.totalAmount||''}">
            <input type="number" id="in_mon" class="form-control mb-2" placeholder="القسط الشهري" min="0" step="0.01" value="${item.monthlyAmount||''}">
            <input type="number" id="in_cnt" class="form-control mb-2" placeholder="عدد الشهور الكلية" min="1" step="1" value="${item.totalCount||''}">
            <input type="number" id="in_pad" class="form-control mb-2" placeholder="عدد الأقساط المسددة حالياً" min="0" step="1" value="${item.paidCount||0}">
            <label class="small text-muted">تاريخ سداد أول قسط:</label><input type="date" id="in_str" class="form-control" value="${item.startDate||''}">
        `;
    } else if (type === 'recurring') {
        let item = isEdit ? window.appData.recurring[editIndex] : {};
        const currentType = item.expenseType || 'recurring';
        body.innerHTML = `
            <label class="small fw-bold mb-1">نوع المصروف:</label>
            <select id="re_expenseType" class="form-select mb-2" onchange="toggleExpenseDateFields()">
                <option value="recurring" ${currentType==='recurring'?'selected':''}>دوري متكرر شهرياً</option>
                <option value="one-time" ${currentType==='one-time'?'selected':''}>مصروف لمرة واحدة فقط</option>
            </select>
            <input type="text" id="re_cat" class="form-control mb-2" placeholder="الفئة (مثال: إيجار، كهرباء، إنترنت)" value="${item.category||''}">
            <input type="number" id="re_amt" class="form-control mb-2" placeholder="المبلغ" min="0" step="0.01" value="${item.amount||''}">
            <div id="expenseDateFields">
                ${currentType === 'one-time' ? `
                <label class="small text-muted">تاريخ الاستحقاق:</label><input type="date" id="re_dueDate" class="form-control" value="${item.dueDate||''}">
                ` : `
                <input type="number" id="re_day" class="form-control" placeholder="يوم الاستحقاق الشهري (1-31)" min="1" max="31" value="${item.day||''}">
                `}
            </div>
            <div class="form-check mt-2">
                <input class="form-check-input" type="checkbox" id="re_isPaid" ${item.isPaid ? 'checked' : ''}>
                <label class="form-check-label fw-bold" for="re_isPaid">✅ تم الدفع</label>
            </div>
        `;
    } else if (type === 'card') {
        let item = isEdit ? window.appData.cards[editIndex] : {};
        body.innerHTML = `
            <input type="text" id="ca_bnk" class="form-control mb-2" placeholder="البنك المصدر للبطاقة" value="${item.bank||''}">
            <input type="text" id="ca_nam" class="form-control mb-2" placeholder="نوع الكارت (مثال: كاش باك، ميزة)" value="${item.cardName||''}">
            <input type="number" id="ca_req" class="form-control mb-2" placeholder="المبلغ المطلوب سداده" min="0" step="0.01" value="${item.requiredAmount||''}">
            <label class="small text-muted">تاريخ الشراء / العملية المحددة:</label><input type="date" id="ca_pdt" class="form-control" value="${item.purchaseDate||''}">
        `;
    } else if (type === 'income') {
        let item = isEdit ? window.appData.income[editIndex] : {};
        body.innerHTML = `
            <input type="text" id="inc_src" class="form-control mb-2" placeholder="مصدر الدخل (مثال: راتب، أرباح عمل)" value="${item.source||''}">
            <input type="number" id="inc_amt" class="form-control mb-2" placeholder="المبلغ" min="0" step="0.01" value="${item.amount||''}">
            <input type="number" id="inc_day" class="form-control" placeholder="يوم الإيداع الشهري (1-31)" min="1" max="31" value="${item.day||''}">
        `;
    } else if (type === 'savings') {
        let item = isEdit ? window.appData.savings[editIndex] : {};
        body.innerHTML = `
            <label class="small fw-bold mb-1">نوع الأصل مادي/ادخاري:</label>
            <select id="sav_type" class="form-select mb-2" onchange="adjustSavingsInputs()">
                <option value="cash" ${item.assetType==='cash'?'selected':''}>كاش (عملة ورقية)</option>
                <option value="gold" ${item.assetType==='gold'?'selected':''}>ذهب (معدن مادي)</option>
                <option value="silver" ${item.assetType==='silver'?'selected':''}>فضة (معدن مادي)</option>
            </select>
            <input type="text" id="sav_nam" class="form-control mb-2" placeholder="اسم صندوق الادخار أو الأصل" value="${item.goalName||''}">
            <input type="number" id="sav_cur" class="form-control mb-2" placeholder="الرصيد الكاش / وزن الجرامات" min="0" step="any" value="${item.currentAmount||0}">
            <input type="number" id="sav_tgt" class="form-control mb-2" placeholder="المستهدف المالي للادخار (أو 0 للأصل)" min="0" step="any" value="${item.targetAmount||0}">
            <div id="sav_extra_fields"></div>
        `;
        setTimeout(window.adjustSavingsInputs, 50);
    } else if (type === 'scheduledDebt') {
        let item = isEdit ? window.appData.scheduledDebts[editIndex] : {};
        body.innerHTML = `
            <input type="text" id="sd_desc" class="form-control mb-2" placeholder="الوصف (مثال: سلفة من صديق)" value="${item.description||''}">
            <input type="number" id="sd_amt" class="form-control mb-2" placeholder="المبلغ" min="0" step="0.01" value="${item.amount||''}">
            <label class="small text-muted">تاريخ استرداد الاستحقاق:</label><input type="date" id="sd_date" class="form-control mb-2" value="${item.dueDate||''}">
            <textarea id="sd_notes" class="form-control" rows="2" placeholder="ملاحظات وتفاصيل إضافية">${item.notes||''}</textarea>
        `;
    }

    document.getElementById('formModalSubmitBtn').onclick = window.processFormSubmit;
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) { new bootstrap.Modal(document.getElementById('formModal')).show(); }
}

window.toggleExpenseDateFields = function() {
    const type = document.getElementById('re_expenseType')?.value;
    const container = document.getElementById('expenseDateFields');
    if (!container) return;
    if (type === 'one-time') {
        container.innerHTML = `<label class="small text-muted">تاريخ الاستحقاق:</label><input type="date" id="re_dueDate" class="form-control">`;
    } else {
        container.innerHTML = `<input type="number" id="re_day" class="form-control" placeholder="يوم الاستحقاق الشهري (1-31)" min="1" max="31">`;
    }
}

window.adjustSavingsInputs = function() {
    let type = document.getElementById('sav_type')?.value;
    let extraDiv = document.getElementById('sav_extra_fields');
    if (!extraDiv) return;
    let item = currentEditIndex !== null ? window.appData.savings[currentEditIndex] : {};
    if (type === 'gold') {
        let defaultKarat = item.karat || 24;
        let defaultPrice = item.currentPricePerGram || window.getLivePriceForGold(defaultKarat);
        extraDiv.innerHTML = `
            <label class="small text-muted">عيار الذهب المقتنى:</label>
            <select id="sav_karat" class="form-select mb-2" onchange="autoSetGoldPriceInForm()">
                <option value="24" ${defaultKarat==24?'selected':''}>24</option>
                <option value="21" ${defaultKarat==21?'selected':''}>21</option>
                <option value="18" ${defaultKarat==18?'selected':''}>18</option>
            </select>
            <input type="number" id="sav_price_gram" class="form-control mb-2" placeholder="سعر الجرام الحالي" min="0" step="0.01" value="${defaultPrice||''}">
            <input type="number" id="sav_purchase" class="form-control mb-2" placeholder="ثمن شراء الأصل الافتراضي" min="0" step="0.01" value="${item.purchasePrice||''}">
            <label class="small text-muted">تاريخ حيازة هذا الأصل:</label><input type="date" id="sav_pdate" class="form-control" value="${item.purchaseDate||''}">
        `;
    } else if (type === 'silver') {
        let defaultPrice = item.currentPricePerGram || window.livePrices.silverPerGram;
        extraDiv.innerHTML = `
            <label class="small text-muted">عيار ونقاوة الفضة:</label>
            <select id="sav_purity" class="form-select mb-2">
                <option value="999" ${(item.silverPurity||'999')=='999'?'selected':''}>999</option>
                <option value="925" ${(item.silverPurity||'999')=='925'?'selected':''}>925</option>
                <option value="900" ${(item.silverPurity||'999')=='900'?'selected':''}>900</option>
            </select>
            <input type="number" id="sav_price_gram" class="form-control mb-2" placeholder="سعر الجرام بالجرام" min="0" step="0.01" value="${defaultPrice||''}">
            <input type="number" id="sav_purchase" class="form-control mb-2" placeholder="ثمن الشراء الكلي" min="0" step="0.01" value="${item.purchasePrice||''}">
            <label class="small text-muted">تاريخ الحيازة المادية:</label><input type="date" id="sav_pdate" class="form-control" value="${item.purchaseDate||''}">
        `;
    } else {
        extraDiv.innerHTML = '';
    }
}

window.autoSetGoldPriceInForm = function() {
    const karatEl = document.getElementById('sav_karat');
    const priceEl = document.getElementById('sav_price_gram');
    if (karatEl && priceEl) {
        priceEl.value = window.getLivePriceForGold(parseInt(karatEl.value)).toFixed(2);
    }
}

window.editModuleItem = function(type, idx) { window.showFormModal(type, idx); }

window.processFormSubmit = function() {
    if (window.userRole === 'Viewer') { showCustomAlert('صلاحية قراءة فقط لا تسمح بالحفظ.', 'خطأ بالصلاحيات'); return; }
    let type = currentEditType, idx = currentEditIndex, isEdit = idx !== null, obj = {};
    const isEmptyOrZero = v => v === null || v === undefined || v === '' || String(v).trim() === '' || Number(v) === 0;
    const showErr = m => showCustomAlert(m, 'تنبيه بالنواقص');

    try {
        if (type === 'installment') {
            let entity = document.getElementById('in_ent')?.value?.trim() || '';
            let totalAmount = parseFloat(document.getElementById('in_tot')?.value) || 0;
            let monthlyAmount = parseFloat(document.getElementById('in_mon')?.value) || 0;
            let totalCount = parseInt(document.getElementById('in_cnt')?.value) || 0;
            let startDate = document.getElementById('in_str')?.value || '';
            if (isEmptyOrZero(entity) || totalAmount <= 0 || monthlyAmount <= 0 || totalCount <= 0 || isEmptyOrZero(startDate)) { showErr('الرجاء التأكد من كتابة البيانات صحيحة ومنع الصفر والسالب!'); return; }
            obj = { entity, totalAmount, monthlyAmount, totalCount, paidCount: Math.max(0, parseInt(document.getElementById('in_pad')?.value) || 0), startDate };
        } else if (type === 'recurring') {
            let category = document.getElementById('re_cat')?.value?.trim() || '';
            let amount = parseFloat(document.getElementById('re_amt')?.value) || 0;
            let expenseType = document.getElementById('re_expenseType')?.value || 'recurring';
            let isPaid = document.getElementById('re_isPaid')?.checked || false;
            if (isEmptyOrZero(category) || amount <= 0) { showErr('المبلغ والفئة غير مكتملين بشكل صحيح!'); return; }
            if (expenseType === 'one-time') {
                let dueDate = document.getElementById('re_dueDate')?.value || '';
                if (isEmptyOrZero(dueDate)) { showErr('تاريخ الاستحقاق ضروري للمصروف المفرد!'); return; }
                obj = { category, amount, expenseType, dueDate, isPaid };
            } else {
                let day = parseInt(document.getElementById('re_day')?.value) || 0;
                if (day <= 0 || day > 31) { showErr('يوم الدفع الشهري يجب أن يكون بين 1 و 31!'); return; }
                obj = { category, amount, expenseType, day, isPaid };
            }
        } else if (type === 'card') {
            let bank = document.getElementById('ca_bnk')?.value?.trim() || '';
            let cardName = document.getElementById('ca_nam')?.value?.trim() || '';
            let requiredAmount = parseFloat(document.getElementById('ca_req')?.value) || 0;
            let purchaseDate = document.getElementById('ca_pdt')?.value || '';
            if (isEmptyOrZero(bank) || isEmptyOrZero(cardName) || requiredAmount <= 0 || isEmptyOrZero(purchaseDate)) { showErr('أدخل بيانات البطاقة ومبالغ السداد بشكل سليم!'); return; }
            obj = { bank, cardName, requiredAmount, purchaseDate };
        } else if (type === 'income') {
            let source = document.getElementById('inc_src')?.value?.trim() || '';
            let amount = parseFloat(document.getElementById('inc_amt')?.value) || 0;
            let day = parseInt(document.getElementById('inc_day')?.value) || 0;
            if (isEmptyOrZero(source) || amount <= 0 || day <= 0 || day > 31) { showErr('الرجاء تعبئة بيانات الدخل بشكل كامل!'); return; }
            obj = { source, amount, day };
        } else if (type === 'savings') {
            let assetType = document.getElementById('sav_type')?.value || 'cash';
            let goalName = document.getElementById('sav_nam')?.value?.trim() || '';
            let currentAmount = parseFloat(document.getElementById('sav_cur')?.value) || 0;
            if (isEmptyOrZero(goalName) || currentAmount < 0) { showErr('ادخل اسم أصل الادخار مع رصيد صحيح غير سالب!'); return; }
            obj = { assetType, goalName, currentAmount, targetAmount: Math.max(0, parseFloat(document.getElementById('sav_tgt')?.value) || 0) };
            if (assetType === 'gold') {
                obj.karat = parseInt(document.getElementById('sav_karat')?.value) || 24;
                obj.currentPricePerGram = Math.max(0, parseFloat(document.getElementById('sav_price_gram')?.value) || window.getLivePriceForGold(obj.karat));
                obj.purchasePrice = Math.max(0, parseFloat(document.getElementById('sav_purchase')?.value) || 0);
                obj.purchaseDate = document.getElementById('sav_pdate')?.value || '';
            } else if (assetType === 'silver') {
                obj.silverPurity = document.getElementById('sav_purity')?.value || '999';
                obj.currentPricePerGram = Math.max(0, parseFloat(document.getElementById('sav_price_gram')?.value) || window.livePrices.silverPerGram);
                obj.purchasePrice = Math.max(0, parseFloat(document.getElementById('sav_purchase')?.value) || 0);
                obj.purchaseDate = document.getElementById('sav_pdate')?.value || '';
            }
        } else if (type === 'scheduledDebt') {
            let description = document.getElementById('sd_desc')?.value?.trim() || '';
            let amount = parseFloat(document.getElementById('sd_amt')?.value) || 0;
            let dueDate = document.getElementById('sd_date')?.value || '';
            let notes = document.getElementById('sd_notes')?.value?.trim() || '';
            if (isEmptyOrZero(description) || amount <= 0 || isEmptyOrZero(dueDate)) { showErr('البيانات غير مكتملة لتسجيل الدين المجدول!'); return; }
            obj = { description, amount, dueDate, notes };
        }

        const key = type === 'installment' ? 'installments' : type === 'recurring' ? 'recurring' : type === 'card' ? 'cards' : type === 'income' ? 'income' : type === 'savings' ? 'savings' : 'scheduledDebts';
        if (isEdit) {
            window.appData[key][idx] = obj;
        } else {
            window.appData[key].push(obj);
        }

        backupDataLocally();
        window.renderAllModulesTables();
        window.calculateFinanceReport();
        window.calculateGlobalOverview();
        window.renderSmartAlertsPanel();
        bootstrap.Modal.getInstance(document.getElementById('formModal')).hide();
    } catch (e) {
        console.error(e);
        showCustomAlert('حدث خطأ أثناء حفظ التعديلات.', 'خطأ');
    }
}

window.incrementInstallment = function(idx) {
    if (window.userRole === 'Viewer') { showCustomAlert('صلاحية قراءة فقط لا تكفي لتغيير البيانات.', 'خطأ بالصلاحية'); return; }
    if ((parseInt(window.appData.installments[idx].paidCount) || 0) < (parseInt(window.appData.installments[idx].totalCount) || 0)) {
        window.appData.installments[idx].paidCount = (parseInt(window.appData.installments[idx].paidCount) || 0) + 1;
        backupDataLocally();
        window.renderAllModulesTables();
        window.calculateFinanceReport();
        window.calculateGlobalOverview();
        window.renderSmartAlertsPanel();
    }
}

window.clearCardDebt = function(idx) {
    if (window.userRole === 'Viewer') { showCustomAlert('صلاحية قراءة فقط.', 'خطأ'); return; }
    showCustomConfirm('هل تم سداد مديونية الكارت بالكامل؟', () => {
        window.appData.cards.splice(idx, 1);
        backupDataLocally();
        window.renderAllModulesTables();
        window.calculateFinanceReport();
        window.calculateGlobalOverview();
        window.renderSmartAlertsPanel();
    });
}

window.quickDepositSavings = function(idx) {
    if (window.userRole === 'Viewer') { showCustomAlert('صلاحية قراءة فقط.', 'خطأ'); return; }
    showCustomPrompt('أدخل الرصيد المالي الجديد لتسجيله:', window.appData.savings[idx].currentAmount, (val) => {
        if (val && !isNaN(val) && parseFloat(val) >= 0) {
            window.appData.savings[idx].currentAmount = parseFloat(val);
            backupDataLocally();
            window.renderAllModulesTables();
            window.calculateFinanceReport();
            window.calculateGlobalOverview();
        } else if (val) {
            showCustomAlert('الرصيد المدخل غير صحيح أو سالب!');
        }
    });
}

window.deleteModuleItem = function(type, idx) {
    if (window.userRole === 'Viewer') { showCustomAlert('صلاحية قراءة فقط.', 'خطأ'); return; }
    showCustomConfirm('حذف هذا البند بشكل نهائي وتطهير السجلات؟', () => {
        const key = type === 'installment' ? 'installments' : type === 'recurring' ? 'recurring' : type === 'card' ? 'cards' : type === 'income' ? 'income' : type === 'savings' ? 'savings' : 'scheduledDebts';
        window.appData[key].splice(idx, 1);
        backupDataLocally();
        window.renderAllModulesTables();
        window.calculateFinanceReport();
        window.calculateGlobalOverview();
        window.renderSmartAlertsPanel();
    });
}

// ===== الدالة الجديدة لتبديل حالة دفع المصروف =====
window.toggleRecurringPaid = function(idx) {
    if (window.userRole === 'Viewer') {
        showCustomAlert('صلاحية قراءة فقط.', 'خطأ');
        return;
    }
    window.appData.recurring[idx].isPaid = !window.appData.recurring[idx].isPaid;
    backupDataLocally();
    window.renderAllModulesTables();
    window.calculateFinanceReport();
    window.calculateGlobalOverview();
    window.renderSmartAlertsPanel();
}

// ======== إدارة ومتابعة الأهداف المكتوبة ========
window.renderGoals = function() {
    const container = document.getElementById('goalsContainer');
    if (!container) return;
    container.innerHTML = '';
    if (window.appData.goals.length === 0) {
        container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i class="bi bi-check2-square"></i><p>لا توجد أهداف نشطة</p><button class="btn btn-sm btn-success write-action" onclick="showGoalFormModal()"><i class="bi bi-plus-circle"></i> إضافة هدف جديد</button></div>`;
        return;
    }
    window.appData.goals.forEach((goal, idx) => {
        const completed = goal.completed || false;
        const card = document.createElement('div');
        card.className = `goal-card ${completed ? 'completed' : ''}`;
        card.innerHTML = `
            <div class="goal-actions">
                <button class="btn btn-sm btn-outline-warning write-action" onclick="showGoalFormModal(${idx})"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger write-action" onclick="deleteGoal(${idx})"><i class="bi bi-trash"></i></button>
            </div>
            <div class="d-flex align-items-center gap-3 mb-2">
                <i class="bi ${completed ? 'bi-check-circle-fill text-success' : 'bi-circle'} goal-check" onclick="toggleGoal(${idx})"></i>
                <span class="goal-title">${goal.title}</span>
            </div>
            <div class="goal-desc">${goal.description || '—'}</div>
            ${goal.dueDate ? `<div class="goal-due"><i class="bi bi-calendar-event"></i> المستهدف: ${convertToLocalDate(goal.dueDate)}</div>` : ''}
        `;
        container.appendChild(card);
    });
    window.applyPermissionsUI();
    if (typeof PrivacySystem !== 'undefined') PrivacySystem.applyState();
}

window.showGoalFormModal = function(index = null) {
    if (window.userRole === 'Viewer') { showCustomAlert('صلاحية مشاهدة فقط.', 'خطأ بالصلاحيات'); return; }
    const isEdit = index !== null;
    const goal = isEdit ? window.appData.goals[index] : {};
    document.getElementById('formModalTitle').textContent = isEdit ? 'تعديل الهدف الهدف النشط' : 'إضافة هدف جديد لمساحتك';
    const body = document.getElementById('formModalBody');
    body.innerHTML = `
        <input type="text" id="goal_title" class="form-control mb-2" placeholder="عنوان الهدف الرئيسي" value="${goal.title||''}">
        <textarea id="goal_desc" class="form-control mb-2" rows="2" placeholder="أضف تفاصيل وخطوات إضافية هنا">${goal.description||''}</textarea>
        <label class="small text-muted">التاريخ المستهدف للتحقيق:</label><input type="date" id="goal_due" class="form-control mb-2" value="${goal.dueDate||''}">
        <div class="form-check"><input class="form-check-input" type="checkbox" id="goal_completed" ${goal.completed?'checked':''}><label class="form-check-label fw-bold">تم إنجاز هذا الهدف بالكامل بنجاح</label></div>
    `;
    currentEditType = 'goal';
    currentEditIndex = index;
    document.getElementById('formModalSubmitBtn').onclick = () => {
        const title = document.getElementById('goal_title').value.trim();
        if (!title) { showCustomAlert('أدخل عنواناً صحيحاً أولاً.', 'خطأ بالبيانات'); return; }
        const goalObj = { title, description: document.getElementById('goal_desc').value.trim(), dueDate: document.getElementById('goal_due').value, completed: document.getElementById('goal_completed').checked };
        if (isEdit) window.appData.goals[index] = goalObj;
        else window.appData.goals.push(goalObj);
        backupDataLocally();
        window.renderGoals();
        bootstrap.Modal.getInstance(document.getElementById('formModal')).hide();
    };
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) { new bootstrap.Modal(document.getElementById('formModal')).show(); }
}

window.toggleGoal = function(idx) {
    if (window.userRole === 'Viewer') { showCustomAlert('صلاحية مشاهدة فقط.', 'خطأ'); return; }
    window.appData.goals[idx].completed = !window.appData.goals[idx].completed;
    backupDataLocally();
    window.renderGoals();
}

window.deleteGoal = function(idx) {
    if (window.userRole === 'Viewer') { showCustomAlert('صلاحية مشاهدة فقط.', 'خطأ'); return; }
    showCustomConfirm('حذف الهدف من القائمة؟', () => { window.appData.goals.splice(idx, 1); backupDataLocally(); window.renderGoals(); });
}

// ======== المذكرة والمذكرات الشخصية ========
window.saveMemoData = function() {
    if (window.userRole === 'Viewer') { showCustomAlert('صلاحية قراءة فقط لا تسمح بحفظ المذكرات.', 'خطأ بالصلاحيات'); return; }
    window.appData.memo = document.getElementById('memoTextarea').value;
    backupDataLocally();
    document.getElementById('memoAlertText').textContent = '✅ تم الحفظ السحابي الآمن بنجاح!';
    setTimeout(() => document.getElementById('memoAlertText').textContent = '', 2500);
}

window.loadMemoData = function() {
    let el = document.getElementById('memoTextarea');
    if (el) el.value = window.appData.memo || '';
}

// ======== التصدير والاستيراد الآمن للملفات المخزنة محلياً ========
window.exportDataJSON = function() {
    let blob = new Blob([JSON.stringify(window.appData, null, 2)], { type: 'application/json' });
    let a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `EGYUP_Backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
}

window.importDataJSON = function(event) {
    if (window.userRole === 'Viewer') { showCustomAlert('صلاحيتك قراءة فقط.', 'خطأ بالصلاحية'); return; }
    let reader = new FileReader();
    reader.onload = function(e) {
        try {
            let parsed = JSON.parse(e.target.result);
            if (window.validateImportData(parsed)) {
                let currentMemo = window.appData.memo || '';
                window.appData = parsed;
                window.appData.memo = currentMemo;
                backupDataLocally();
                window.renderAllModulesTables();
                window.renderGoals();
                window.calculateFinanceReport();
                window.calculateGlobalOverview();
                window.renderSmartAlertsPanel();
                window.loadMemoData();
                showCustomAlert('✅ تم استيراد الملف وقراءته بنجاح وبنية السجلات مطابقة ومتوافقة.', 'نجاح الاستيراد');
            } else { showCustomAlert('⚠️ محتويات الملف المرفوع لا تتطابق مع الهيكل الأساسي لنظام إيجيب أب.', 'بنية غير صالحة'); }
        } catch (err) { showCustomAlert('⚠️ تعذر معالجة الملف، قد يكون تالفاً أو لا يحتوي على بنية سليمة.', 'تنبيه تلف'); }
    };
    if(event.target.files[0]) { reader.readAsText(event.target.files[0]); }
}

// ======== التصفية والبحث في الجداول المختلفة ========
window.filterTable = function(type) {
    if (type === 'installments') {
        let q = document.getElementById('searchInstallments').value.toLowerCase();
        let rows = document.querySelectorAll('#installmentsTableBody tr');
        let entitiesToShow = new Set();
        rows.forEach(r => {
            const text = r.textContent.toLowerCase();
            const isChild = r.classList.contains('entity-child-row');
            if (!isChild && text.includes(q)) { entitiesToShow.add(r.getAttribute('data-entity')); }
            if (isChild && text.includes(q)) { entitiesToShow.add(r.getAttribute('data-parent')); }
        });
        rows.forEach(r => {
            const isGroup = r.classList.contains('entity-group-row');
            const entity = isGroup ? r.getAttribute('data-entity') : r.getAttribute('data-parent');
            if (q === '' || entitiesToShow.has(entity)) { r.style.display = ''; }
            else { r.style.display = 'none'; }
        });
        return;
    }
    let sid = '', tid = '';
    if (type === 'recurring') { sid = 'searchRecurring'; tid = 'recurringTableBody'; }
    else if (type === 'cards') { sid = 'searchCards'; tid = 'cardsTableBody'; }
    else if (type === 'income') { sid = 'searchIncome'; tid = 'incomeTableBody'; }
    else if (type === 'savings') { sid = 'searchSavings'; tid = 'savingsTableBody'; }
    else if (type === 'scheduledDebts') { sid = 'searchScheduledDebts'; tid = 'scheduledDebtsTableBody'; }
    if (!sid || !tid) return;
    let q = document.getElementById(sid).value.toLowerCase();
    let rows = document.getElementById(tid).getElementsByTagName('tr');
    for (let r of rows) r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
}

// ======== أسعار الذهب والفضة التلقائية ========
function recalcLivePriceDerivatives() {
    const ounceToGram = 31.1035;
    const goldPerGramUSD = window.livePrices.goldOunce / ounceToGram;
    const silverPerGramUSD = window.livePrices.silverOunce / ounceToGram;
    window.livePrices.goldPerGram24 = goldPerGramUSD * window.livePrices.usdToEGP;
    window.livePrices.goldPerGram21 = window.livePrices.goldPerGram24 * (21 / 24);
    window.livePrices.goldPerGram18 = window.livePrices.goldPerGram24 * (18 / 24);
    window.livePrices.silverPerGram = silverPerGramUSD * window.livePrices.usdToEGP;
}

function refreshPriceDisplays() {
    document.getElementById('display_gold_24').textContent = window.livePrices.goldPerGram24.toFixed(2);
    document.getElementById('display_gold_21').textContent = window.livePrices.goldPerGram21.toFixed(2);
    document.getElementById('display_gold_18').textContent = window.livePrices.goldPerGram18.toFixed(2);
    document.getElementById('display_silver').textContent = window.livePrices.silverPerGram.toFixed(2);
    document.getElementById('lastPriceUpdateInfo').textContent = `آخر تحديث لأسعار السوق: ${window.livePrices.lastUpdate ? window.livePrices.lastUpdate.toLocaleString('ar-EG') : 'غير محدد'}`;
    document.getElementById('manual_usd_rate').value = window.livePrices.usdToEGP.toFixed(2);
    document.getElementById('manual_gold_ounce').value = window.livePrices.goldOunce.toFixed(2);
    document.getElementById('manual_silver_ounce').value = window.livePrices.silverOunce.toFixed(2);
}

function autoUpdateAllAssetPrices() {
    let changed = false;
    window.appData.savings.forEach((item) => {
        if (item.assetType === 'gold') {
            let karat = parseInt(item.karat) || 24;
            let pricePerGram = window.getLivePriceForGold(karat);
            if (Math.abs((parseFloat(item.currentPricePerGram) || 0) - pricePerGram) > 0.001) { item.currentPricePerGram = pricePerGram; changed = true; }
        } else if (item.assetType === 'silver') {
            if (Math.abs((parseFloat(item.currentPricePerGram) || 0) - window.livePrices.silverPerGram) > 0.001) { item.currentPricePerGram = window.livePrices.silverPerGram; changed = true; }
        }
    });
    if (changed) { backupDataLocally(); window.renderAllModulesTables(); window.calculateFinanceReport(); window.calculateGlobalOverview(); }
}

window.getLivePriceForGold = function(karat) {
    const k = parseInt(karat) || 24;
    if (k === 24) return window.livePrices.goldPerGram24;
    if (k === 21) return window.livePrices.goldPerGram21;
    if (k === 18) return window.livePrices.goldPerGram18;
    return window.livePrices.goldPerGram24 * (k / 24);
}

window.fetchLivePrices = async function() {
    const btn = document.getElementById('refreshPriceBtn');
    if (btn) btn.disabled = true;
    try {
        let usdRate = parseFloat(document.getElementById('manual_usd_rate').value) || 48.00;
        let goldOunce = parseFloat(document.getElementById('manual_gold_ounce').value) || 1950.00;
        let silverOunce = parseFloat(document.getElementById('manual_silver_ounce').value) || 25.00;
        try { const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD'); if (res.ok) { const data = await res.json(); if (data.rates && data.rates.EGP) usdRate = data.rates.EGP; } } catch (e) {}
        try { const res = await fetch('https://api.gold-api.com/price/XAU'); if (res.ok) { const data = await res.json(); if (data.price) goldOunce = data.price; } } catch (e) {}
        try { const res = await fetch('https://api.gold-api.com/price/XAG'); if (res.ok) { const data = await res.json(); if (data.price) silverOunce = data.price; } } catch (e) {}
        window.livePrices.usdToEGP = usdRate; window.livePrices.goldOunce = goldOunce; window.livePrices.silverOunce = silverOunce;
        recalcLivePriceDerivatives(); window.livePrices.lastUpdate = new Date();
        refreshPriceDisplays(); localStorage.setItem('egyup_live_prices', JSON.stringify(window.livePrices));
        autoUpdateAllAssetPrices(); showCustomAlert('✅ تم استدعاء أحدث الأسعار العالمية من البورصة وتحديث كافة الأصول والسبائك فورياً!', 'تحديث وتزامن');
    } catch (err) { console.error(err); showCustomAlert('⚠️ حدث تعذر بالاتصال بالبورصة، تم الاعتماد على المدخلات اليدوية.', 'تنبيه'); }
    finally { if (btn) btn.disabled = false; }
}

window.updateManualRate = function() {
    window.livePrices.usdToEGP = parseFloat(document.getElementById('manual_usd_rate').value) || 48.00;
    window.livePrices.goldOunce = parseFloat(document.getElementById('manual_gold_ounce').value) || 1950.00;
    window.livePrices.silverOunce = parseFloat(document.getElementById('manual_silver_ounce').value) || 25.00;
    recalcLivePriceDerivatives(); window.livePrices.lastUpdate = new Date();
    refreshPriceDisplays(); localStorage.setItem('egyup_live_prices', JSON.stringify(window.livePrices));
    autoUpdateAllAssetPrices();
}

// ======== نسخ الكود السحابي والربط بحسابات أخرى ========
window.copyMyCloudId = function() {
    const field = document.getElementById('myCloudIdField');
    if (field) { field.select(); field.setSelectionRange(0, 99999); document.execCommand('copy'); showCustomAlert('✅ تم نسخ كودك السحابي لحافظة جهازك بنجاح!', 'نسخ مأمون'); }
}

window.connectToCustomCloudId = function() {
    const input = document.getElementById('targetCloudIdInput');
    if (!input) return;
    const targetId = input.value.trim();
    if (!targetId) { showCustomAlert('⚠️ الرجاء التحقق من كتابة كود مألوف وصحيح.', 'حقل فارغ'); return; }
    showCustomConfirm(`تحويل مساحة العمل وربطها بالكود (${targetId}) ومزامنة بياناتها؟`, () => { localStorage.setItem('egyup_custom_user_id', targetId); showCustomAlert('✅ سيتم الآن إعادة تهيئة وتحديث التطبيق للربط السحابي الجديد.', 'ربط ناجح'); setTimeout(() => window.location.reload(), 1500); });
}

window.showCloudSyncModal = function() {
    const modalEl = document.getElementById('cloudModal');
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) new bootstrap.Modal(modalEl).show();
}

window.updateWorkspaceMeta = function() {
    if (window.userRole !== 'Owner') { showCustomAlert('فقط مالك مساحة العمل لديه حق تعديل مساحة العمل.', 'صلاحية مرفوضة'); return; }
    window.workspaceMeta.name = document.getElementById('set_workspace_name').value.trim() || "Egyup Cloud System";
    window.workspaceMeta.currency = document.getElementById('set_currency_symbol').value.trim() || "ج";
    window.workspaceMeta.alertDays = parseInt(document.getElementById('set_alert_days').value) || 3;
    window.workspaceMeta.emergencyMonths = parseInt(document.getElementById('set_emergency_months').value) || 6;
    window.workspaceMeta.maxDti = parseInt(document.getElementById('set_max_dti').value) || 40;
    document.getElementById('workspaceTitleDisplay').textContent = window.workspaceMeta.name;
    if (window.saveWorkspaceConfigToCloud) window.saveWorkspaceConfigToCloud();
    window.calculateFinanceReport(); window.calculateGlobalOverview(); window.renderSmartAlertsPanel();
}

// ======== حساب الموازنة التقارير الذكية وتوليد المخططات البيانية ========
let activeView = 'monthly';
let chartInstanceBar = null, chartInstanceDoughnut = null, chartInstanceNetWorth = null;

window.changeDashboardView = function(view) {
    activeView = view;
    document.getElementById('btnMonthly').classList.toggle('active', view === 'monthly');
    document.getElementById('btnYearly').classList.toggle('active', view === 'yearly');
    document.getElementById('monthSelector').style.display = view === 'monthly' ? 'flex' : 'none';
    destroyAllCharts();
    window.calculateFinanceReport();
}

function destroyAllCharts() {
    if (chartInstanceBar) { chartInstanceBar.destroy(); chartInstanceBar = null; }
    if (chartInstanceDoughnut) { chartInstanceDoughnut.destroy(); chartInstanceDoughnut = null; }
    if (chartInstanceNetWorth) { chartInstanceNetWorth.destroy(); chartInstanceNetWorth = null; }
}

window.calculateFinanceReport = function() {
    let filterMonthSelect = document.getElementById('filterMonth');
    let filterYearInput = document.getElementById('filterYear');
    if (!filterMonthSelect || !filterYearInput) return;
    let selMonth = parseInt(filterMonthSelect.value);
    let selYear = parseInt(filterYearInput.value);
    let totalIn = 0, totalOutInstallments = 0, totalOutRecurring = 0, totalOutCards = 0, totalOutScheduled = 0;
    let tableBody = document.querySelector('#dueTable tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    let alertBox = document.getElementById('todayAlertBox');
    if (alertBox) alertBox.innerHTML = '';
    let todayDay = new Date().getDate();

    const groupedDues = {};

    function addGroupedDue(groupKey, groupLabel, detail, date, amount, status, isPaid = false) {
        if (!groupedDues[groupKey]) {
            groupedDues[groupKey] = { label: groupLabel, total: 0, items: [], minDate: null };
        }
        if (!isPaid) {
            groupedDues[groupKey].total += amount;
        }
        groupedDues[groupKey].items.push({ detail, date, amount, status, isPaid });
        if (!groupedDues[groupKey].minDate || date < groupedDues[groupKey].minDate) {
            groupedDues[groupKey].minDate = date;
        }
    }

    if (activeView === 'monthly') {
        window.appData.income.forEach(item => totalIn += parseFloat(item.amount) || 0);
        
        window.appData.installments.forEach(item => {
            let total = parseInt(item.totalCount) || 0, monthly = parseFloat(item.monthlyAmount) || 0, paid = parseInt(item.paidCount) || 0;
            for (let i = 0; i < total; i++) {
                let due = new Date(addMonthsToDateStr(item.startDate, i));
                if (due.getMonth() + 1 === selMonth && due.getFullYear() === selYear) {
                    const isPaid = i < paid;
                    if (!isPaid) {
                        totalOutInstallments += monthly;
                    }
                    let status = isPaid ? { text: 'مسدد بالكامل ✅', class: 'success-soft text-success' } : getDueStatus(due);
                    addGroupedDue(`installment_${item.entity}`, `📋 أقساط: ${item.entity}`, `${item.entity} (القسط رقم ${i+1}/${total})`, due, monthly, status, isPaid);
                }
            }
        });
        
        window.appData.recurring.forEach(item => {
            let amt = parseFloat(item.amount) || 0;
            const expenseType = item.expenseType || 'recurring';
            let due;
            if (expenseType === 'one-time') {
                due = new Date(item.dueDate);
            } else {
                const day = parseInt(item.day);
                const lastDay = new Date(selYear, selMonth, 0).getDate();
                const dueDay = Math.min(day, lastDay);
                due = new Date(selYear, selMonth - 1, dueDay);
            }
            if (due.getMonth() + 1 === selMonth && due.getFullYear() === selYear) {
                const isPaid = item.isPaid || false;
                if (!isPaid) totalOutRecurring += amt;
                let status = getDueStatus(due);
                let statusText = isPaid ? { text: 'مسدد ✅', class: 'success-soft text-success' } : status;
                addGroupedDue(`expense_${item.category}`, `🧾 مصروفات: ${item.category}`, item.category, due, amt, statusText, isPaid);
            }
            if (expenseType === 'recurring' && parseInt(item.day) === todayDay && alertBox) {
                alertBox.innerHTML += `<div class="today-alert shadow-sm mb-3" style="border-right:4px solid var(--warning);background:var(--warning-soft);padding:14px 18px;border-radius:var(--radius-md);">💡 استحقاق اليوم في مساحتك: مصروف دوري <b>${item.category}</b> بقيمة <b>${amt.toLocaleString()} ${getCurrency()}</b></div>`;
            }
            if (expenseType === 'one-time' && due.toDateString() === new Date().toDateString() && alertBox) {
                alertBox.innerHTML += `<div class="today-alert shadow-sm mb-3" style="border-right:4px solid var(--danger);background:var(--danger-soft);padding:14px 18px;border-radius:var(--radius-md);">🔴 مصروف لمرة واحدة استحقاقه اليوم: <b>${item.category}</b> بقيمة <b>${amt.toLocaleString()} ${getCurrency()}</b></div>`;
            }
        });

        window.appData.cards.forEach(item => {
            let amt = parseFloat(item.requiredAmount) || 0;
            let due = calculateCreditCardDueDate(item.purchaseDate);
            if (due.getMonth() + 1 === selMonth && due.getFullYear() === selYear) {
                totalOutCards += amt;
                let status = getDueStatus(due);
                addGroupedDue(`card_${item.bank}`, `💳 فيزا: ${item.bank}`, `${item.bank} - ${item.cardName}`, due, amt, status);
            }
        });

        window.appData.scheduledDebts.forEach(item => {
            let amt = parseFloat(item.amount) || 0;
            let due = new Date(item.dueDate);
            if (due.getMonth() + 1 === selMonth && due.getFullYear() === selYear) {
                totalOutScheduled += amt;
                let status = getDueStatus(due);
                addGroupedDue(`debt_${item.description}`, `📌 ديون: ${item.description}`, item.description, due, amt, status);
            }
        });
    } else {
        window.appData.income.forEach(item => totalIn += (parseFloat(item.amount) || 0) * 12);
        window.appData.recurring.forEach(item => {
            if ((item.expenseType || 'recurring') === 'recurring') {
                totalOutRecurring += (parseFloat(item.amount) || 0) * 12;
            } else {
                const due = new Date(item.dueDate);
                if (due.getFullYear() === selYear) totalOutRecurring += parseFloat(item.amount) || 0;
            }
        });
        window.appData.installments.forEach(item => {
            let total = parseInt(item.totalCount) || 0, monthly = parseFloat(item.monthlyAmount) || 0, paid = parseInt(item.paidCount) || 0;
            for (let i = 0; i < total; i++) {
                let due = new Date(addMonthsToDateStr(item.startDate, i));
                if (due.getFullYear() === selYear) {
                    const isPaid = i < paid;
                    if (!isPaid) {
                        totalOutInstallments += monthly;
                    }
                }
            }
        });
        window.appData.cards.forEach(item => {
            let amt = parseFloat(item.requiredAmount) || 0;
            let due = calculateCreditCardDueDate(item.purchaseDate);
            if (due.getFullYear() === selYear) totalOutCards += amt;
        });
        window.appData.scheduledDebts.forEach(item => {
            let amt = parseFloat(item.amount) || 0;
            let due = new Date(item.dueDate);
            if (due.getFullYear() === selYear) totalOutScheduled += amt;
        });
    }

    if (activeView === 'monthly') {
        const groupKeys = Object.keys(groupedDues).sort();
        if (groupKeys.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">لا توجد التزامات نشطة متبقية لهذا الشهر.</td></tr>`;
        } else {
            groupKeys.forEach(key => {
                const group = groupedDues[key];
                tableBody.innerHTML += `<tr class="due-table-group-header"><td colspan="5" style="background:var(--bg-secondary);"><i class="bi bi-folder-fill me-2 text-accent"></i> ${group.label} <span class="badge bg-primary ms-2">غير مسدد: ${group.total.toLocaleString()} ${getCurrency()}</span></td></tr>`;
                group.items.forEach(item => {
                    let badgeClass = item.status.class.includes(' ') ? item.status.class : `bg-${item.status.class}`;
                    tableBody.innerHTML += `<tr><td></td><td>${item.detail}</td><td>${convertToLocalDate(item.date)}</td><td class="fw-bold">${item.amount.toLocaleString()} ${getCurrency()}</td><td><span class="badge ${badgeClass}">${item.status.text}</span></td></tr>`;
                });
            });
        }
    } else {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">العرض السنوي يظهر في تبويب الإحصائيات الرئيسي بالتفصيل.</td></tr>`;
    }

    let totalOutAll = totalOutInstallments + totalOutRecurring + totalOutCards + totalOutScheduled;
    let netSavings = totalIn - totalOutAll;

    document.getElementById('statsContainer').innerHTML = `
        <div class="col-md-3 col-6"><div class="glass-card text-center border-success"><h6 style="color:var(--success);">💰 إجمالي الدخل</h6><h4 class="fw-bold" style="color:var(--success);">${totalIn.toLocaleString()} ${getCurrency()}</h4></div></div>
        <div class="col-md-3 col-6"><div class="glass-card text-center border-danger"><h6 style="color:var(--danger);">📋 الأقساط النشطة</h6><h4 class="fw-bold" style="color:var(--danger);">${totalOutInstallments.toLocaleString()} ${getCurrency()}</h4></div></div>
        <div class="col-md-3 col-6"><div class="glass-card text-center border-warning"><h6 style="color:#e0a800;">💳 البطاقات</h6><h4 class="fw-bold" style="color:#e0a800;">${totalOutCards.toLocaleString()} ${getCurrency()}</h4></div></div>
        <div class="col-md-3 col-6"><div class="glass-card text-center border-info"><h6 style="color:var(--info);">🧾 المصروفات الدورية</h6><h4 class="fw-bold" style="color:var(--info);">${totalOutRecurring.toLocaleString()} ${getCurrency()}</h4></div></div>
        <div class="col-12"><div class="glass-card text-center ${netSavings>=0?'border-primary':'border-dark'}"><h5>💵 صافي السيولة المتبقية</h5><h3 class="fw-bold" style="color:${netSavings>=0?'var(--accent)':'var(--danger)'};">${netSavings.toLocaleString()} ${getCurrency()}</h3>${netSavings>0?`<button class="btn btn-sm btn-success mt-2 write-action" onclick="quickSaveSurplus(${netSavings})"><i class="bi bi-safe2"></i> تحويل الفائض للادخار</button>`:''}</div></div>`;

    buildChartsLive(totalIn, totalOutAll, totalOutInstallments, totalOutRecurring, totalOutCards + totalOutScheduled);
    buildNetWorthChart();

    let grandTotalAssets = 0;
    window.appData.savings.forEach(item => grandTotalAssets += getAssetFinancialValue(item));
    runDynamicFinancialDiagnostic(totalIn, totalOutAll, grandTotalAssets);
    window.renderSmartAlertsPanel();
    if (typeof PrivacySystem !== 'undefined') PrivacySystem.applyState();
}

function getDueStatus(dueDate) {
    let due = new Date(dueDate); due.setHours(0,0,0,0);
    let diff = calculateDaysLeft(due);
    if (diff < 0) return { text: 'تنبيه: متأخر 🚨', class: 'overdue-soft text-overdue' };
    if (diff === 0) return { text: 'اليوم مستحق!', class: 'danger' };
    if (diff <= 3) return { text: `خلال ${diff} يوم`, class: 'warning' };
    return { text: 'نشط / قادم', class: 'info' };
}

window.quickSaveSurplus = function(amount) {
    if (window.userRole === 'Viewer') { showCustomAlert('صلاحية قراءة فقط.', 'خطأ'); return; }
    showCustomConfirm(`هل ترغب في توجيه وتحويل ${amount.toLocaleString()} ${getCurrency()} كفائض لوعاء ادخار مخصص؟`, () => showFormModal('savings'));
}

function runDynamicFinancialDiagnostic(totalIncome, totalDebts, totalAssets) {
    const container = document.getElementById('financeDiagnosticContent');
    if (!container) return;
    const dti = totalIncome > 0 ? Math.round((totalDebts / totalIncome) * 100) : (totalDebts > 0 ? 100 : 0);
    const targetDti = window.workspaceMeta.maxDti || 40;
    let dtiColor = 'var(--success)', dtiIcon = 'bi-check-circle-fill', dtiBg = 'var(--success-soft)';
    if (dti > targetDti) { dtiColor = 'var(--danger)'; dtiIcon = 'bi-exclamation-triangle-fill'; dtiBg = 'var(--danger-soft)'; }
    else if (dti > targetDti * 0.75) { dtiColor = '#e0a800'; dtiIcon = 'bi-exclamation-circle-fill'; dtiBg = 'var(--warning-soft)'; }

    let monthlyFixedExpenses = 0;
    window.appData.installments.forEach(i => { if ((parseInt(i.paidCount)||0) < (parseInt(i.totalCount)||0)) monthlyFixedExpenses += parseFloat(i.monthlyAmount)||0; });
    window.appData.recurring.forEach(r => {
        if ((r.expenseType || 'recurring') === 'recurring') monthlyFixedExpenses += parseFloat(r.amount)||0;
    });

    const emergencyFundMonthsTarget = window.workspaceMeta.emergencyMonths || 6;
    const monthsCovered = monthlyFixedExpenses > 0 ? Math.round((totalAssets / monthlyFixedExpenses) * 10) / 10 : '∞';
    let emergencyColor = 'var(--success)', emergencyIcon = 'bi-shield-fill-check', emergencyBg = 'var(--success-soft)', emergencyText = 'مغطي وممتاز ✅';
    if (monthlyFixedExpenses > 0) {
        if (monthsCovered < emergencyFundMonthsTarget / 2) { emergencyColor = 'var(--danger)'; emergencyIcon = 'bi-shield-slash-fill'; emergencyBg = 'var(--danger-soft)'; emergencyText = 'حرج جداً 🚨'; }
        else if (monthsCovered < emergencyFundMonthsTarget) { emergencyColor = '#e0a800'; emergencyIcon = 'bi-shield-exclamation'; emergencyBg = 'var(--warning-soft)'; emergencyText = 'مقبول جزئياً ⚠️'; }
    }

    let netWorth = totalAssets - totalDebts;
    let netWorthColor = netWorth >= 0 ? 'var(--success)' : 'var(--danger)';
    let netWorthIcon = netWorth >= 0 ? 'bi-graph-up-arrow' : 'bi-graph-down-arrow';
    let netWorthBg = netWorth >= 0 ? 'var(--success-soft)' : 'var(--danger-soft)';

    container.innerHTML = `
        <div class="diagnostic-grid">
            <div class="diagnostic-card" style="border-right:4px solid ${dtiColor};"><div class="diag-icon" style="color:${dtiColor};"><i class="bi ${dtiIcon}"></i></div><div class="diag-value" style="color:${dtiColor};">${dti}%</div><div class="diag-label">مؤشر عبء الدين DTI</div><div class="diag-sub">الحد الأقصى للتخطيط الآمن: ${targetDti}%</div><div class="diagnostic-alert-row" style="background:${dtiBg};color:${dtiColor};"><i class="bi ${dtiIcon}"></i> ${dti > targetDti ? 'خطر – تجاوزت حدود الأمان' : (dti > targetDti*0.75 ? 'حذر – تقترب من الخطوط الحمراء' : 'آمن – موازنة ممتازة ومثالية')}</div></div>
            <div class="diagnostic-card" style="border-right:4px solid ${emergencyColor};"><div class="diag-icon" style="color:${emergencyColor};"><i class="bi ${emergencyIcon}"></i></div><div class="diag-value" style="color:${emergencyColor};">${typeof monthsCovered === 'number' ? monthsCovered + ' شهر' : monthsCovered}</div><div class="diag-label">صندوق الطوارئ والأصول</div><div class="diag-sub">المستهدف للوقاية: ${emergencyFundMonthsTarget} شهور</div><div class="diagnostic-alert-row" style="background:${emergencyBg};color:${emergencyColor};"><i class="bi ${emergencyIcon}"></i> ${emergencyText} – الأصول المتاحة: ${totalAssets.toLocaleString()} ${getCurrency()}</div></div>
            <div class="diagnostic-card" style="border-right:4px solid ${netWorthColor};"><div class="diag-icon" style="color:${netWorthColor};"><i class="bi ${netWorthIcon}"></i></div><div class="diag-value" style="color:${netWorthColor};">${netWorth.toLocaleString()} ${getCurrency()}</div><div class="diag-label">صافي الثروة الحقيقية</div><div class="diag-sub">القيمة المالية للأصول − المديونيات</div><div class="diagnostic-alert-row" style="background:${netWorthBg};color:${netWorthColor};"><i class="bi ${netWorthIcon}"></i> ${netWorth>=0 ? 'وضع مالي إيجابي ونمو مستقر' : 'تنبيه: مديونياتك تفوق أصولك الحالية'}</div></div>
            <div class="diagnostic-card" style="border-right:4px solid var(--info);"><div class="diag-icon" style="color:var(--info);"><i class="bi bi-cash-coin"></i></div><div class="diag-value" style="color:var(--info);">${monthlyFixedExpenses.toLocaleString()} ${getCurrency()}</div><div class="diag-label">الالتزامات الشهرية الثابتة</div><div class="diag-sub">الأقساط القائمة + النفقات الدورية</div><div class="diagnostic-alert-row" style="background:var(--info-soft);color:var(--info);"><i class="bi bi-info-circle-fill"></i> إجمالي الدخل: ${totalIncome.toLocaleString()} ${getCurrency()}</div></div>
        </div>`;
    if (typeof PrivacySystem !== 'undefined') PrivacySystem.applyState();
}

function buildChartsLive(income, outAll, inst, rec, crd) {
    let ctxBar = document.getElementById('barChart'), ctxDoughnut = document.getElementById('doughnutChart');
    if (!ctxBar || !ctxDoughnut || typeof Chart === 'undefined') return;
    let isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    let labelColor = isDark ? '#e8e6f0' : '#2d2b32';
    if (chartInstanceBar) chartInstanceBar.destroy();
    if (chartInstanceDoughnut) chartInstanceDoughnut.destroy();
    chartInstanceBar = new Chart(ctxBar, { type: 'bar', data: { labels: ['الدخل الكلي', 'إجمالي الالتزامات'], datasets: [{ data: [income, outAll], backgroundColor: ['#00b894', '#e17055'], borderRadius: 8 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: labelColor } }, x: { ticks: { color: labelColor } } } } });
    chartInstanceDoughnut = new Chart(ctxDoughnut, { type: 'doughnut', data: { labels: ['الأقساط النشطة', 'المصروفات', 'البطاقات والديون'], datasets: [{ data: [inst, rec, crd], backgroundColor: ['#6c5ce7', '#74b9ff', '#fdcb6e'], borderColor: isDark ? '#1a1825' : '#ffffff', borderWidth: 3 }] }, options: { responsive: true, cutout: '65%', plugins: { legend: { labels: { color: labelColor, font: { family: 'Cairo' } } } } } });
}

function buildNetWorthChart() {
    let ctx = document.getElementById('netWorthChart');
    if (!ctx || typeof Chart === 'undefined') return;
    let isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    let labelColor = isDark ? '#e8e6f0' : '#2d2b32';
    let history = JSON.parse(localStorage.getItem('egyup_networth_history') || '[]');
    if (history.length === 0) {
        let netWorth = 0; window.appData.savings.forEach(item => netWorth += getAssetFinancialValue(item));
        let totalDebt = 0;
        window.appData.installments.forEach(item => { let ta = parseFloat(item.totalAmount)||0, mo = parseFloat(item.monthlyAmount)||0, pa = parseInt(item.paidCount)||0; totalDebt += Math.max(0, ta - (mo*pa)); });
        window.appData.cards.forEach(item => totalDebt += parseFloat(item.requiredAmount)||0);
        window.appData.scheduledDebts.forEach(item => totalDebt += parseFloat(item.amount)||0);
        let now = new Date(); let monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        history = [{ month: monthKey, value: netWorth - totalDebt }];
    }
    if (chartInstanceNetWorth) chartInstanceNetWorth.destroy();
    chartInstanceNetWorth = new Chart(ctx, { type: 'line', data: { labels: history.map(h => h.month), datasets: [{ label: `تطور الثروة الصافية (${getCurrency()})`, data: history.map(h => h.value), borderColor: '#6c5ce7', backgroundColor: 'rgba(108,92,231,0.1)', tension: 0.4, fill: true, pointBackgroundColor: '#6c5ce7', pointBorderColor: '#fff', pointHoverRadius: 8, pointRadius: 5, borderWidth: 3 }] }, options: { responsive: true, plugins: { legend: { labels: { color: labelColor, font: { family: 'Cairo' } } } }, scales: { y: { ticks: { color: labelColor }, grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' } }, x: { ticks: { color: labelColor }, grid: { display: false } } } } });
}

window.calculateGlobalOverview = function() {
    let grandTotalDebtOriginal=0, grandTotalDebtRemaining=0, grandTotalCardsDebt=0, grandTotalAssets=0, grandTotalScheduled=0;
    window.appData.installments.forEach(item => { let ta=parseFloat(item.totalAmount)||0, mo=parseFloat(item.monthlyAmount)||0, pa=parseInt(item.paidCount)||0; grandTotalDebtOriginal+=ta; grandTotalDebtRemaining+=Math.max(0, ta-(mo*pa)); });
    window.appData.cards.forEach(item => grandTotalCardsDebt+=parseFloat(item.requiredAmount)||0);
    window.appData.scheduledDebts.forEach(item => grandTotalScheduled+=parseFloat(item.amount)||0);
    let totalWhatYouOwe=grandTotalDebtRemaining+grandTotalCardsDebt+grandTotalScheduled;
    window.appData.savings.forEach(item => grandTotalAssets+=getAssetFinancialValue(item));
    let netWorth=grandTotalAssets-totalWhatYouOwe;
    let totalDebtPaidSoFar=grandTotalDebtOriginal-grandTotalDebtRemaining;
    let debtProgressPercent=grandTotalDebtOriginal>0?Math.round((totalDebtPaidSoFar/grandTotalDebtOriginal)*100):100;
    document.getElementById('globalOverviewCards').innerHTML=`
        <div class="col-md-4"><div class="glass-card text-center border-success h-100"><h5 style="color:var(--success);">💰 أصول ومخزونات الادخار</h5><h3 class="fw-bold" style="color:var(--success);">${grandTotalAssets.toLocaleString()} ${getCurrency()}</h3></div></div>
        <div class="col-md-4"><div class="glass-card text-center border-danger h-100"><h5 style="color:var(--danger);">💸 إجمالي المديونيات والالتزامات</h5><h3 class="fw-bold" style="color:var(--danger);">${totalWhatYouOwe.toLocaleString()} ${getCurrency()}</h3></div></div>
        <div class="col-md-4"><div class="glass-card text-center ${netWorth>=0?'border-primary':'border-dark'} h-100"><h5>⚖️ صافي الثروة الحالية</h5><h2 class="fw-bold" style="color:${netWorth>=0?'var(--accent)':'var(--danger)'};">${netWorth.toLocaleString()} ${getCurrency()}</h2></div></div>`;
    const pBar=document.getElementById('globalDebtProgressBar'); if(pBar) pBar.innerHTML=`<div class="progress-bar bg-success progress-bar-striped progress-bar-animated" role="progressbar" style="width:${debtProgressPercent}%;border-radius:20px;">التقدم المنجز في سداد الديون: ${debtProgressPercent}%</div>`;
    const pText=document.getElementById('globalDebtProgressText'); if(pText) pText.innerHTML=`تم التخلص وسداد <b class="text-success">${totalDebtPaidSoFar.toLocaleString()} ${getCurrency()}</b> من إجمالي الأقساط الأصلي لجميع الجهات <b>${grandTotalDebtOriginal.toLocaleString()} ${getCurrency()}</b>. المتبقي الأقساط القائمة حالياً: <b class="text-danger">${grandTotalDebtRemaining.toLocaleString()} ${getCurrency()}</b>`;
    updateNetWorthHistory();
    if (typeof PrivacySystem !== 'undefined') PrivacySystem.applyState();
}

function updateNetWorthHistory() {
    let netWorth=0; window.appData.savings.forEach(item=>netWorth+=getAssetFinancialValue(item));
    let totalDebt=0; window.appData.installments.forEach(item=>{let ta=parseFloat(item.totalAmount)||0,mo=parseFloat(item.monthlyAmount)||0,pa=parseInt(item.paidCount)||0; totalDebt+=Math.max(0,ta-(mo*pa));});
    window.appData.cards.forEach(item=>totalDebt+=parseFloat(item.requiredAmount)||0);
    window.appData.scheduledDebts.forEach(item=>totalDebt+=parseFloat(item.amount)||0);
    let currentNet=netWorth-totalDebt;
    let history=JSON.parse(localStorage.getItem('egyup_networth_history')||'[]');
    let now=new Date(); let monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    let existing=history.find(h=>h.month===monthKey); if(existing) existing.value=currentNet; else{history.push({month:monthKey,value:currentNet}); if(history.length>12) history.shift();}
    localStorage.setItem('egyup_networth_history',JSON.stringify(history));
    buildNetWorthChart();
}

// ======== المظهر والوضع التلقائي ليلي/نهاري ========
window.toggleTheme = function() {
    let cur=document.documentElement.getAttribute('data-bs-theme'); let target=cur==='dark'?'light':'dark';
    document.documentElement.setAttribute('data-bs-theme',target);
    document.getElementById('darkModeBtn').innerHTML=target==='dark'?'<i class="bi bi-sun-fill text-warning"></i>':'<i class="bi bi-moon-fill"></i>';
    localStorage.setItem('egyup_theme_choice',target);
    destroyAllCharts(); window.calculateFinanceReport(); window.calculateGlobalOverview();
}

function startClock() {
    setInterval(()=>{let el=document.getElementById('liveDateTime'); if(el){let n=new Date(); el.textContent=n.toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+' | '+n.toLocaleTimeString('ar-EG');}},1000);
}

function safeShowPrayerModal() {
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const modalEl = document.getElementById('prayerModal');
        if (modalEl) { new bootstrap.Modal(modalEl).show(); }
    } else {
        setTimeout(safeShowPrayerModal, 200);
    }
}

// ---------------------------------------------------
// محرك البرمجة الخاص بنظام حماية الخصوصية المبتكر
// ---------------------------------------------------
const PrivacySystem = {
    isSetup: false,
    isActive: false,
    style: 'stars',
    pin: '',
    autoLock: false,
    inactivityTimer: null,
    currentMode: 'unlock',

    init() {
        const encodedPin = localStorage.getItem('egyup_privacy_pin') || '';
        this.pin = encodedPin ? atob(encodedPin) : '';
        this.isSetup = this.pin !== '';
        this.isActive = localStorage.getItem('egyup_privacy_active') === 'true';
        this.style = localStorage.getItem('egyup_privacy_style') || 'stars';
        this.autoLock = localStorage.getItem('egyup_privacy_autolock') === 'true';

        this.updateUIElements();
        this.applyState();
        setInterval(() => this.applyState(), 300);
        this.bindEvents();

        if (this.autoLock) {
            this.resetInactivityTimer();
            this.startInactivityTracking();
        }
    },

    bindEvents() {
        const inputs = document.querySelectorAll('.pin-input-field');
        inputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                if (input.value.length === 1) {
                    if (index < inputs.length - 1) {
                        inputs[index + 1].focus();
                    } else {
                        this.handleSubmit();
                    }
                }
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && input.value.length === 0 && index > 0) {
                    inputs[index - 1].focus();
                }
            });
        });

        const confirmInputs = document.querySelectorAll('.pin-confirm-field');
        confirmInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                if (input.value.length === 1 && index < confirmInputs.length - 1) {
                    confirmInputs[index + 1].focus();
                }
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && input.value.length === 0 && index > 0) {
                    confirmInputs[index - 1].focus();
                }
            });
        });

        document.getElementById('privacyToggleButton').addEventListener('click', () => {
            this.handleToggleClick();
        });

        document.getElementById('privacySubmitBtn').addEventListener('click', () => {
            this.handleSubmit();
        });

        document.getElementById('privacyConfigBtn').addEventListener('click', () => {
            const panel = document.getElementById('privacySettingsPanel');
            panel.classList.toggle('d-none');
        });

        document.getElementById('privacyHideStyleSelect').value = this.style;
        document.getElementById('privacyHideStyleSelect').addEventListener('change', (e) => {
            this.style = e.target.value;
            localStorage.setItem('egyup_privacy_style', this.style);
            this.applyState();
        });

        document.getElementById('privacyAutoLockToggle').checked = this.autoLock;
        document.getElementById('privacyAutoLockToggle').addEventListener('change', (e) => {
            this.autoLock = e.target.checked;
            localStorage.setItem('egyup_privacy_autolock', this.autoLock ? 'true' : 'false');
            if (this.autoLock) {
                this.startInactivityTracking();
            } else {
                this.stopInactivityTracking();
            }
        });

        document.getElementById('resetPrivacyPinBtn').addEventListener('click', () => {
            window.showCustomConfirm('هل أنت متأكد من رغبتك في إلغاء قفل الخصوصية بالكامل وإعادة تعيين رمز المرور الجديد؟', () => {
                localStorage.removeItem('egyup_privacy_pin');
                localStorage.removeItem('egyup_privacy_active');
                localStorage.removeItem('egyup_privacy_autolock');
                localStorage.removeItem('egyup_privacy_style');
                this.pin = '';
                this.isSetup = false;
                this.isActive = false;
                this.style = 'stars';
                this.autoLock = false;
                this.updateUIElements();
                this.applyState();
                const modalInstance = bootstrap.Modal.getInstance(document.getElementById('privacyAuthModal'));
                if (modalInstance) modalInstance.hide();
                window.showCustomAlert('تم إزالة تفعيل الخصوصية بالكامل وإعادة تعيين الحماية.', 'إعادة تعيين');
            });
        });
    },

    handleToggleClick() {
        if (!this.isSetup) {
            this.showAuthModal('setup');
        } else {
            if (this.isActive) {
                this.showAuthModal('unlock');
            } else {
                this.isActive = true;
                localStorage.setItem('egyup_privacy_active', 'true');
                this.updateUIElements();
                this.applyState();
                window.showCustomAlert('تم تفعيل وضع الخصوصية وإخفاء جميع الأرصدة.', 'تم التفعيل');
            }
        }
    },

    showAuthModal(mode) {
        this.currentMode = mode;
        const modalEl = document.getElementById('privacyAuthModal');
        const modal = new bootstrap.Modal(modalEl);

        document.querySelectorAll('.pin-input-field, .pin-confirm-field').forEach(el => el.value = '');
        document.getElementById('privacyErrorMessage').classList.add('d-none');
        document.getElementById('privacySettingsPanel').classList.add('d-none');
        document.getElementById('privacyConfigBtn').classList.add('d-none');

        if (mode === 'setup') {
            document.getElementById('privacyModalTitle').textContent = 'إعداد حماية الخصوصية المبتكر';
            document.getElementById('privacyModalDesc').textContent = 'يرجى تعيين رمز مرور (PIN) مكون من 4 أرقام لتأمين وعرض أرصدتك المالية عند الحاجة.';
            document.getElementById('privacyModalIcon').className = 'bi bi-shield-plus-fill text-primary';
            document.getElementById('confirmPinContainer').classList.remove('d-none');
        } else if (mode === 'unlock') {
            document.getElementById('privacyModalTitle').textContent = 'فتح قفل الخصوصية والبيانات';
            document.getElementById('privacyModalDesc').textContent = 'أدخل رمز المرور المكون من 4 أرقام المسبق تحديده لعرض الأرصدة والبيانات الفورية الحالية.';
            document.getElementById('privacyModalIcon').className = 'bi bi-shield-lock-fill text-warning';
            document.getElementById('confirmPinContainer').classList.add('d-none');
            document.getElementById('privacyConfigBtn').classList.remove('d-none');
        }

        modal.show();
        setTimeout(() => {
            document.querySelector('.pin-input-field').focus();
        }, 500);
    },

    handleSubmit() {
        const pinVal = Array.from(document.querySelectorAll('.pin-input-field')).map(i => i.value).join('');

        if (pinVal.length < 4) {
            this.showError('يرجى ملء جميع الخانات لرمز المرور!');
            return;
        }

        if (this.currentMode === 'setup') {
            const confirmVal = Array.from(document.querySelectorAll('.pin-confirm-field')).map(i => i.value).join('');
            if (confirmVal.length < 4) {
                this.showError('يرجى كتابة تأكيد رمز المرور بالأسفل!');
                return;
            }
            if (pinVal !== confirmVal) {
                this.showError('رمزي المرور غير متطابقين بالمرة!');
                return;
            }

            this.pin = pinVal;
            localStorage.setItem('egyup_privacy_pin', btoa(pinVal));
            this.isSetup = true;
            this.isActive = true;
            localStorage.setItem('egyup_privacy_active', 'true');
            this.updateUIElements();
            this.applyState();

            const modalInstance = bootstrap.Modal.getInstance(document.getElementById('privacyAuthModal'));
            if (modalInstance) modalInstance.hide();
            window.showCustomAlert('تم إعداد الكود السري وتأمين جميع الخانات بنجاح!', 'تم الإعداد');

        } else if (this.currentMode === 'unlock') {
            const savedPin = atob(localStorage.getItem('egyup_privacy_pin') || '');
            if (pinVal === savedPin) {
                this.isActive = false;
                localStorage.setItem('egyup_privacy_active', 'false');
                this.updateUIElements();
                this.applyState();

                const modalInstance = bootstrap.Modal.getInstance(document.getElementById('privacyAuthModal'));
                if (modalInstance) modalInstance.hide();
                window.showCustomAlert('تم إظهار جميع الأرقام والأرصدة بنجاح.', 'مرحبا بك');
            } else {
                this.showError('رمز المرور خاطئ! يرجى إعادة المحاولة من جديد.');
                document.querySelectorAll('.pin-input-field').forEach(el => el.value = '');
                document.querySelector('.pin-input-field').focus();
            }
        }
    },

    showError(msg) {
        const errEl = document.getElementById('privacyErrorMessage');
        errEl.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1"></i> ${msg}`;
        errEl.classList.remove('d-none');
    },

    updateUIElements() {
        const btn = document.getElementById('privacyToggleButton');
        const icon = document.getElementById('privacyToggleIcon');

        if (this.isActive) {
            btn.style.background = "linear-gradient(135deg, #e17055, #ff7675)";
            icon.className = "bi bi-eye-slash-fill fs-5";
            btn.setAttribute('title', 'عرض الأرصدة الحالية (محمي برمز سري)');
        } else {
            btn.style.background = "linear-gradient(135deg, #00b894, #55efc4)";
            icon.className = "bi bi-eye-fill fs-5";
            btn.setAttribute('title', 'حماية وإخفاء الأرصدة والبيانات بلمسة واحدة');
        }

        const container = document.getElementById('roleIndicator')?.parentNode;
        if (container) {
            let indicator = document.getElementById('privacyStatusIndicator');
            if (this.isActive) {
                if (!indicator) {
                    indicator = document.createElement('span');
                    indicator.id = 'privacyStatusIndicator';
                    indicator.className = 'privacy-badge-indicator';
                    indicator.innerHTML = '<i class="bi bi-shield-fill-check"></i> الخصوصية نشطة';
                    container.insertBefore(indicator, container.firstChild);
                }
            } else {
                if (indicator) {
                    indicator.remove();
                }
            }
        }
    },

    applyState() {
        const hideStyle = this.style;

        if (!this.isActive) {
            document.querySelectorAll('.privacy-applied').forEach(el => {
                el.classList.remove('privacy-applied', 'privacy-blurred', 'privacy-starred', 'privacy-blur-only');
            });
            return;
        }

        const currencySymbol = window.workspaceMeta ? window.workspaceMeta.currency : "ج";
        const balanceSelectors = [
            '#statsContainer h4', '#statsContainer h3', '#dueTable tbody td:nth-child(4)',
            '.due-table-group-header span.badge', '.diagnostic-card .diag-value',
            '.diagnostic-card .diagnostic-alert-row', '#globalOverviewCards h3',
            '#globalOverviewCards h2', '#globalDebtProgressText b', '#installmentsTableBody td:nth-child(2) div',
            '#installmentsTableBody td:nth-child(2) small', '#installmentsTableBody td:nth-child(3) div',
            '#installmentsTableBody td:nth-child(3) span', '#installmentsSummaryCard b',
            '#recurringTableBody td:nth-child(3)', '#cardsTableBody td:nth-child(4)',
            '#incomeTableBody td:nth-child(2)', '#savingsTableBody td:nth-child(3)',
            '#savingsTableBody td:nth-child(4)', '#savingsTableBody td:nth-child(5)',
            '#scheduledDebtsTableBody td:nth-child(2)', '#manual_usd_rate',
            '#manual_gold_ounce', '#manual_silver_ounce', '#display_gold_24',
            '#display_gold_21', '#display_gold_18', '#display_silver'
        ];

        balanceSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                if (el.tagName.toLowerCase() === 'canvas') return;
                el.classList.add('privacy-applied');
                if (hideStyle === 'stars') {
                    el.classList.add('privacy-starred');
                } else {
                    el.classList.add('privacy-blurred');
                }
            });
        });

        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walk.nextNode()) {
            const text = node.nodeValue.trim();
            if (text.includes(currencySymbol) || text.includes('ج.م') || text.includes('EGP') || text.includes('$') || text.match(/\d+[\d,.]*\s*(ج\.م|EGP|\$|USD)/)) {
                const parent = node.parentNode;
                if (parent &&
                    !parent.closest('.privacy-exclude') &&
                    !parent.closest('button') &&
                    !parent.closest('script') &&
                    !parent.closest('style') &&
                    !parent.closest('.modal')) {

                    parent.classList.add('privacy-applied');
                    if (hideStyle === 'stars') {
                        parent.classList.add('privacy-starred');
                    } else {
                        parent.classList.add('privacy-blurred');
                    }
                }
            }
        }

        document.querySelectorAll('canvas').forEach(el => {
            el.classList.add('privacy-applied', 'privacy-blur-only');
        });
    },

    startInactivityTracking() {
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(name => {
            document.addEventListener(name, () => this.resetInactivityTimer(), true);
        });
    },

    stopInactivityTracking() {
        if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    },

    resetInactivityTimer() {
        if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
        if (this.autoLock && !this.isActive) {
            this.inactivityTimer = setTimeout(() => {
                this.isActive = true;
                localStorage.setItem('egyup_privacy_active', 'true');
                this.updateUIElements();
                this.applyState();
                window.showCustomAlert('تم حظر الأرصدة تلقائياً لترك الهاتف وحماية الخصوصية.', 'تنبيه');
            }, 60000);
        }
    }
};

// ======== التهيئة المبدئية عند الإقلاع وتوليد البيانات ========
function initializeApp() {
    let now=new Date();
    document.getElementById('filterMonth').value=now.getMonth()+1;
    document.getElementById('filterYear').value=now.getFullYear();

    let raw=localStorage.getItem('egyup_raw_data_v2'); if(raw){try{window.appData=JSON.parse(raw);}catch(e){}}
    let meta=localStorage.getItem('egyup_workspace_meta'); if(meta){try{window.workspaceMeta=JSON.parse(meta);}catch(e){}}
    let prices=localStorage.getItem('egyup_live_prices');
    if(prices){try{const p=JSON.parse(prices); window.livePrices=p; document.getElementById('manual_usd_rate').value=p.usdToEGP||48.00; document.getElementById('manual_gold_ounce').value=p.goldOunce||1950.00; document.getElementById('manual_silver_ounce').value=p.silverOunce||25.00; document.getElementById('display_gold_24').textContent=(p.goldPerGram24||0).toFixed(2); document.getElementById('display_gold_21').textContent=(p.goldPerGram21||0).toFixed(2); document.getElementById('display_gold_18').textContent=(p.goldPerGram18||0).toFixed(2); document.getElementById('display_silver').textContent=(p.silverPerGram||0).toFixed(2); if(p.lastUpdate){document.getElementById('lastPriceUpdateInfo').textContent=`آخر تحديث: ${new Date(p.lastUpdate).toLocaleString('ar-EG')}`;}}catch(e){}}

    document.getElementById('set_workspace_name').value=window.workspaceMeta.name;
    document.getElementById('set_currency_symbol').value=window.workspaceMeta.currency;
    document.getElementById('set_alert_days').value=window.workspaceMeta.alertDays;
    document.getElementById('set_emergency_months').value=window.workspaceMeta.emergencyMonths;
    document.getElementById('set_max_dti').value=window.workspaceMeta.maxDti;
    document.getElementById('workspaceTitleDisplay').textContent=window.workspaceMeta.name;

    let localTheme = localStorage.getItem('egyup_theme_choice') || 'light';
    document.documentElement.setAttribute('data-bs-theme', localTheme);
    document.getElementById('darkModeBtn').innerHTML = localTheme === 'dark' ? '<i class="bi bi-sun-fill text-warning"></i>' : '<i class="bi bi-moon-fill"></i>';

    window.renderAllModulesTables(); window.renderGoals();
    window.calculateFinanceReport(); window.calculateGlobalOverview();
    window.loadMemoData(); updateNetWorthHistory();
    window.renderSmartAlertsPanel();
    initNotifications();

    const tips=[
        "الادخار ليس ما يتبقى بعد الإنفاق، بل الإنفاق هو ما يتبقى بعد الادخار الممنهج مسبقاً.",
        "تجنب شراء الأشياء الاستهلاكية التي لا تحتاجها لتثير إعجاب أشخاص لا تكترث لأمرهم.",
        "ابدأ ببناء صندوق طوارئ وقائي أولاً ليغطي مصروفاتك الثابتة لمدة 3 إلى 6 أشهر كدرع واقٍ.",
        "استثمر في الأصول الحقيقية كالمعادن الثمينة أو العقارات دائمًا لحفظ قيمة مدخراتك من موجات التضخم.",
        "حاول دائمًا خفض مديونياتك وقسطك الشهري لأقل من 40% من دخلك الإجمالي السليم.",
        "تتبع كل بند يتم إنفاقه؛ فالتسريبات الصغيرة قادرة على إغراق السفن الكبيرة المترابطة!"
    ];
    document.getElementById('financialTipText').textContent=tips[Math.floor(Math.random()*tips.length)];

    safeShowPrayerModal();
    setTimeout(()=>window.fetchLivePrices(), 1200);

    PrivacySystem.init();
}

function initNotifications() {
    if('Notification' in window && Notification.permission==='granted'){window.notificationsEnabled=true; window.updateNotificationBadge(); startNotificationChecker();}
}

document.addEventListener('DOMContentLoaded',()=>{startClock(); initializeApp();});
