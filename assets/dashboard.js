// MISK IT - dashboard.js - قشرة الداشبورد فقط - مش بيلمس الدخول ولا المهام
// الأدوار: فني = مهامه بس | ليدر = الكل + رفع شيت + مسح أوردر | سوبر = + إضافة فني + امسح كل حاجة
(function(){
const $ = id => document.getElementById(id);
const preview = new URLSearchParams(location.search).get('preview') === '1';
let userObj = null;
let loadState = {jobs:false, warehouse:false};
let loadErrors = {};

// ===== الأدوار =====
function getRole(){
  if(preview) return 'super_leader';
  const raw = String(userObj?.role || userObj?.user_type || userObj?.type || '').toLowerCase().trim().replace(/[\s]+/g,'_');
  if(['super_leader','super','super_admin','superadmin'].includes(raw)) return 'super_leader';
  if(['leader','lead','admin'].includes(raw)) return 'leader';
  if(userObj?.isSuper || userObj?.is_super) return 'super_leader';
  // الحسابات القديمة اللي فيها isAdmin=true تفضل سوبر ليدر - عشان mahdy مايقلبش فني
  if(userObj?.isAdmin) return 'super_leader';
  if(!raw) return 'super_leader';
  return 'tech';
}
const isSuper = () => getRole() === 'super_leader';
const isLeader = () => getRole() === 'leader' || isSuper();
const isTech = () => getRole() === 'tech';
function applyRoleUI(){
  const addBtn = document.getElementById('addTechBtn');
  if(addBtn) addBtn.style.display = isSuper() ? '' : 'none';
  const superBox = document.getElementById('superDeleteBox');
  if(superBox) superBox.style.display = isSuper() ? 'block' : 'none';
}
window.getRole = getRole; window.isSuper = isSuper; window.isLeader = isLeader; window.isTech = isTech;

function escape(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function icon(name){
  const paths = {
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    chart:'<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>',
    server:'<rect x="2" y="3" width="20" height="7" rx="2"/><rect x="2" y="14" width="20" height="7" rx="2"/>',
    shield:'<path d="M12 3l7 3v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    box:'<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
    users:'<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5"/><path d="M16 5a3.5 3.5 0 010 6.5"/><path d="M17.5 15c2.5.7 4.5 2.4 4.5 5"/>',
    archive:'<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8"/><path d="M10 12h4"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 10-14 0 7 7 0 0014 0z"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    bell:'<path d="M18 9a6 6 0 10-12 0c0 6-2 6-2 6h16s-2 0-2-6z"/><path d="M10 20a2 2 0 004 0"/>',
    logout:'<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>'
  };
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
}

const nav = [['overview','grid','لوحة التحكم'],['analytics','chart','التحليلات'],['all','server','المهام'],['problem','shield','التنبيهات'],['pending','clock','قيد الانتظار'],['warehouse','box','المخزن'],['team','users','الفريق'],['archive','archive','الأرشيف'],['settings','settings','الإعدادات']];
const shell = document.createElement('div');
shell.id = 'dashboardShell'; shell.className = 'hidden'; shell.dataset.view = 'overview';
shell.innerHTML = `<aside class="sidebar glass"><a class="brand" href="index.html"><img src="assets/logo.svg" alt="شعار مسك"><span>MISK IT<small>INFORMATION TECHNOLOGY</small></span></a><nav>${nav.map(([id,i,label])=>`<button data-route="${id}" class="nav-item ${id==='overview'?'active':''}">${icon(i)}<span>${label}</span>${id==='problem'?'<span id="alertCount" class="nav-count">0</span>':''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="workspace-label">Workspace <span>●</span></div><p class="connection"><i></i><span id="connectionText">بانتظار تحميل البيانات</span></p><div class="profile"><div class="avatar">M</div><div><strong id="profileName">MISK</strong><small id="profileRole">إدارة العمليات</small></div><button class="icon-button" data-action="logout">${icon('logout')}</button></div></div></aside>
<div class="main-shell"><header class="topbar glass"><div class="breadcrumb"><button class="icon-button mobile-menu" data-action="menu">${icon('menu')}</button><span>Dashboard</span><b>/</b><strong id="breadcrumbLabel">Overview</strong></div><div class="topbar-tools"><time id="dashboardClock"></time><button class="icon-button" data-action="search">${icon('search')}</button><button class="icon-button" data-route="problem">${icon('bell')}<i id="notificationDot"></i></button><button class="icon-button" data-route="settings">${icon('settings')}</button></div></header>
<main class="main-panel"><div class="page-heading"><div><p class="eyebrow">MISK IT · OPERATIONS CENTER</p><h1 id="pageTitle">نظرة عامة</h1><p id="pageSubtitle">متابعة أداء العمليات والمهام والفنيين في مكان واحد</p></div><button class="primary" id="newTask" data-route="create">${icon('plus')} مهمة جديدة</button></div>
<section id="overview"><div class="metrics"><button class="metric glass" data-metric="total"><span>إجمالي المهام</span><strong id="metric-total">—</strong></button><button class="metric glass" data-metric="done"><span>نسبة الإنجاز</span><strong id="metric-done">—</strong></button><button class="metric glass" data-metric="pending"><span>قيد الانتظار</span><strong id="metric-pending">—</strong></button><button class="metric glass" data-metric="devices"><span>الأجهزة بالمخزن</span><strong id="metric-devices">—</strong></button></div></section>
<section id="workspaceContent" class="hidden"></section>
<section id="settingsPanel" class="panel hidden"><h2>إعدادات مساحة العمل</h2><div class="settings-row"><div><strong>تحديث البيانات</strong></div><button class="primary" data-action="refresh">تحديث الآن</button></div><div class="settings-row"><div><strong>كلمة المرور</strong></div><button class="secondary" data-action="password">تغيير كلمة المرور</button></div><div class="settings-row"><div><strong>الجلسة</strong></div><button class="secondary" data-action="logout">تسجيل الخروج</button></div></section>
<footer class="page-footer"><span>MISK IT Platform</span><span>Operations dashboard · v3.0</span></footer></main></div><div id="toast" role="status"></div>`;
document.body.append(shell);

const dedicated = document.createElement('section'); dedicated.id='dedicatedView'; dedicated.className='hidden';
$('workspaceContent').before(dedicated);
const app = $('appPage');
if(app) $('workspaceContent').append(app);

function getJobs(){ return (typeof myJobsBase === 'function' ? myJobsBase() : []); }
function getDevices(){ return (typeof myWarehouse === 'function' ? myWarehouse() : []); }
function toast(m){ const t=$('toast'); if(!t) return; t.textContent=m; t.classList.add('visible'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>t.classList.remove('visible'),3500); }
function refresh(){
  const jobs = getJobs(), devices = getDevices();
  const done = jobs.filter(j=>j.status==='تم التسليم' || j.comment==='تم التسليم').length;
  if($('metric-total')) $('metric-total').textContent = jobs.length;
  if($('metric-done')) $('metric-done').textContent = jobs.length ? Math.round(done/jobs.length*100)+'%' : '0%';
  if($('metric-pending')) $('metric-pending').textContent = jobs.length - done;
  if($('metric-devices')) $('metric-devices').textContent = devices.length;
  if(window.MiskViews) window.MiskViews.refresh?.();
}
function route(id){
  if(!preview && ['team','create','archive'].includes(id) && !isLeader()){ toast('هذا القسم متاح لليدر والسوبر ليدر فقط'); return; }
  shell.dataset.view=id; shell.classList.remove('menu-open');
  shell.querySelectorAll('[data-route].nav-item').forEach(el=>{ const a=el.dataset.route===id; el.classList.toggle('active',a); });
  const overview = id==='overview';
  $('overview').classList.toggle('hidden', !overview);
  $('settingsPanel').classList.toggle('hidden', id!=='settings');
  $('workspaceContent').classList.toggle('hidden', overview || id==='settings');
  if($('pageTitle')) $('pageTitle').textContent = overview ? 'نظرة عامة' : id;
  if(!preview && !overview && id!=='settings'){
    if(app){ app.classList.remove('hidden'); app.dataset.section = ['team','create'].includes(id) ? 'admin' : 'jobs'; }
    if(typeof showTab === 'function' && !['team','create'].includes(id)) showTab(id, null);
  }
  refresh();
}
shell.addEventListener('click', e=>{
  const rb = e.target.closest('[data-route]'); if(rb){ route(rb.dataset.route); return; }
  const act = e.target.closest('[data-action]')?.dataset.action;
  if(act==='menu') shell.classList.toggle('menu-open');
  if(act==='logout'){ if(preview) location.href='index.html'; else if(typeof logout==='function') logout(); }
  if(act==='password'){ if(preview) toast('تغيير كلمة المرور متاح بعد تسجيل الدخول'); else { const m=$('passModal'); if(m) m.style.display='flex'; } }
  if(act==='refresh'){ refresh(); toast('تم تحديث البيانات'); }
  if(act==='search'){ route('all'); }
});
function tick(){ const c=$('dashboardClock'); if(c) c.textContent = new Date().toLocaleString('en-GB',{weekday:'short',month:'short',day:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
tick(); setInterval(tick, 30000);

window.MiskDashboard = {
  refresh(source){ if(source){ loadState[source]=true; delete loadErrors[source]; } refresh(); },
  error(message, source){ loadErrors[source]=message; refresh(); },
  show(u){
    userObj = u || window.userObj || null;
    shell.classList.remove('hidden');
    if(!preview){
      if($('profileName')) $('profileName').textContent = userObj?.name || userObj?.username || 'MISK';
      if($('profileRole')) $('profileRole').textContent = isSuper() ? 'سوبر ليدر' : isLeader() ? 'ليدر' : 'فني عمليات';
      if($('newTask')) $('newTask').hidden = !isLeader();
      ['team','archive'].forEach(id=>{ const el=shell.querySelector(`[data-route="${id}"]`); if(el) el.hidden = !isLeader(); });
      applyRoleUI();
    }
    route('overview'); refresh();
  }
};
if(preview) window.MiskDashboard.show({name:'معاينة', role:'super_leader'});
if(!preview && $('warehouseList')) new MutationObserver(()=>refresh()).observe($('warehouseList'), {childList:true});
})();
