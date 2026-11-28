/* MISK dashboard. Presentation is isolated from the existing operations layer. */
(() => {
  'use strict';
  const preview = document.body.dataset.preview === 'true';
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths = {
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    chart:'<path d="M4 20V10m5 10V4m6 16v-7m5 7V7"/>',
    server:'<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h3M7 17.5h3"/>',
    shield:'<path d="m12 2 9 4v6c0 5-5 8-9 10-4-2-9-5-9-10V6Z"/><path d="m8 12 3 3 5-6"/>',
    box:'<path d="m12 2 9 5v10l-9 5-9-5V7Z M3 7l9 5 9-5M12 12v10M7 4.8l9 5"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3ZM16 4a4 4 0 0 1 0 8m2 3a5 5 0 0 1 3 5"/>',
    archive:'<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v13h14V8M9 12h6"/>',
    settings:'<path d="m9 3-1 3-3 1-2 4 2 2v4l4 3 3-1 3 1 4-3v-4l2-2-2-4-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
    search:'<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
    bell:'<path d="M5 16h14l-2-3V8a5 5 0 0 0-10 0v5ZM10 20h4"/>',
    plus:'<path d="M12 4v16M4 12h16"/>',
    logout:'<path d="M10 4H4v16h6M10 12h11m-4-4 4 4-4 4"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    arrow:'<path d="m10 5 7 7-7 7M17 12H3"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
  };
  const icon = (name, cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
  const nav = [['overview','grid','لوحة التحكم'],['analytics','chart','التحليلات'],['all','server','المهام'],['problem','shield','التنبيهات'],['pending','clock','قيد الانتظار'],['warehouse','box','المخزن'],['team','users','الفريق'],['archive','archive','الأرشيف'],['settings','settings','الإعدادات']];
  const shell = document.createElement('div');
  shell.id = 'dashboardShell'; shell.className = 'hidden'; shell.dataset.view = 'overview';
  shell.innerHTML = `<aside class="sidebar glass" aria-label="القائمة الرئيسية"><a class="brand" href="${preview?'preview':'index'}.html"><img src="assets/logo.svg" alt="شعار مسك"><span>MISK IT<small>INFORMATION TECHNOLOGY</small></span></a><nav>${nav.map(([id,i,label])=>`<button data-route="${id}" class="nav-item ${id==='overview'?'active':''}" ${id==='overview'?'aria-current="page"':''}>${icon(i)}<span>${label}</span>${id==='problem'?'<span id="alertCount" class="nav-count">0</span>':''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="workspace-label">Workspace <span>●</span></div><p class="connection"><i></i><span id="connectionText">${preview?'بيانات تجريبية للمعاينة':'بانتظار تحميل البيانات'}</span></p><div class="profile"><div class="avatar">M</div><div><strong id="profileName">MISK Admin</strong><small id="profileRole">إدارة العمليات</small></div><button class="icon-button" data-action="logout" aria-label="تسجيل الخروج">${icon('logout')}</button></div></div></aside><div class="main-shell"><header class="topbar glass"><div class="breadcrumb"><button class="icon-button mobile-menu" data-action="menu" aria-label="فتح القائمة" aria-expanded="false">${icon('menu')}</button><span>Dashboard</span><b>/</b><strong id="breadcrumbLabel">Overview</strong></div><div class="topbar-tools"><time id="dashboardClock"></time><button class="icon-button" data-action="search" aria-label="البحث في المهام">${icon('search')}</button><button class="icon-button notification-button" data-route="problem" aria-label="عرض التنبيهات">${icon('bell')}<i id="notificationDot"></i></button><button class="icon-button" data-route="settings" aria-label="الإعدادات">${icon('settings')}</button></div></header><main class="main-panel"><div class="page-heading"><div><p class="eyebrow">MISK IT · OPERATIONS CENTER</p><h1 id="pageTitle">نظرة عامة <span>${new Date().getFullYear()}</span></h1><p id="pageSubtitle">متابعة أداء العمليات والمهام والفنيين في مكان واحد</p></div><button class="primary" id="newTask" data-route="create">${icon('plus')} مهمة جديدة</button></div>${preview?'<div class="demo-notice">وضع المعاينة · بيانات تجريبية، ولا يوجد اتصال بقاعدة البيانات <a href="index.html">تسجيل الدخول ←</a></div>':''}<section id="overview"><div class="metrics">${[['total','server','إجمالي المهام','كل المهام المسندة'],['done','shield','نسبة الإنجاز','من إجمالي المهام'],['pending','clock','قيد الانتظار','مهام بانتظار التنفيذ'],['devices','box','الأجهزة بالمخزن','إجمالي العهد المسجلة']].map(([id,i,label,note])=>`<button class="metric glass" data-metric="${id}"><span class="metric-icon">${icon(i)}</span><span class="metric-label">${label}</span><strong id="metric-${id}">—</strong><small id="note-${id}">${note}</small></button>`).join('')}</div><div class="dashboard-grid"><section class="panel traffic glass"><div class="panel-heading"><div><h2>نشاط المهام</h2><p>آخر 14 يومًا · الوارد مقابل التسليم</p></div><span class="panel-tag">14 يومًا</span></div><div id="trafficChart" class="chart-wrap"></div><div class="chart-legend"><span><i class="dot cyan"></i>الوارد <b id="incomingTotal">—</b></span><span><i class="dot purple"></i>تم التسليم <b id="deliveredTotal">—</b></span></div></section><section class="panel health"><div class="panel-heading"><div><h2>حالة العمليات</h2><p>توزيع حالات المهام الحالية</p></div><span class="live-label"><i></i>ملخص</span></div><div class="health-body"><div class="donut" id="healthDonut"><div>${icon('shield')}</div></div><div class="health-value"><strong id="healthPercent">—</strong> <span>مكتمل</span></div><ul class="status-list" id="statusList"></ul></div></section><section class="panel activity"><div class="panel-heading"><div><h2>أحدث المهام</h2><p>آخر المهام المضافة إلى النظام</p></div><button class="text-button" data-route="all">عرض الكل ${icon('arrow')}</button></div><div id="recentActivity"></div></section><section class="panel resources"><div class="panel-heading"><div><h2>توزيع الأجهزة</h2><p>المخزن · أنواع الأجهزة المسجلة</p></div>${icon('server')}</div><div id="deviceDistribution"></div><div class="resource-summary">${icon('shield')}<span>مؤشرات محسوبة من بيانات المخزن</span></div></section></div></section><section id="workspaceContent" class="hidden" aria-label="مساحة إدارة العمليات"></section><section id="settingsPanel" class="panel hidden"><h2>إعدادات مساحة العمل</h2><p>إدارة الحساب وتحديث بيانات لوحة التحكم</p><div class="settings-row"><div><strong>تحديث البيانات</strong><p>جلب أحدث المهام والمخزن من النظام</p></div><button class="primary" data-action="refresh">تحديث الآن</button></div><div class="settings-row"><div><strong>كلمة المرور</strong><p>تغيير كلمة مرور حسابك الحالي</p></div><button class="secondary" data-action="password">تغيير كلمة المرور</button></div><div class="settings-row"><div><strong>الجلسة الحالية</strong><p>الخروج من مساحة العمل على هذا الجهاز</p></div><button class="secondary" data-action="logout">تسجيل الخروج</button></div></section><footer class="page-footer"><span><i class="dot cyan"></i> MISK IT Platform</span><span>${preview?'Design preview':'Operations dashboard'} · v2.0</span></footer></main></div><div id="toast" role="status"></div>`;
  document.body.append(shell);
  shell.querySelector('.page-footer span:last-child').textContent=(preview?'Design preview':'Operations dashboard')+' · v3.0';
  const dedicated=document.createElement('section');dedicated.id='dedicatedView';dedicated.className='hidden';
  $('workspaceContent').before(dedicated);
  $('overview').insertAdjacentHTML('beforeend',`<section class="quick-actions panel"><div><p class="section-kicker">NEXT ACTIONS</p><h2>خطوتك التالية</h2><p>انتقل مباشرة إلى العمل الذي يحتاج انتباهك</p></div><button class="secondary" data-route="problem">${icon('bell')} مراجعة التنبيهات <b id="overviewAlerts">0</b></button><button class="secondary" data-route="pending">${icon('clock')} بدء قائمة التنفيذ</button><button class="secondary" data-route="analytics">${icon('chart')} تقرير الأداء</button></section>`);
  const app = $('appPage');
  if (app) $('workspaceContent').append(app);
  const loadState = {jobs:preview, warehouse:preview};
  const loadErrors = {};
  let demoJobs = [];
  if(preview){
    const names=['أحمد محمد','محمود إبراهيم','سارة خالد','عمر حسن','محمد عبد الله'];
    for(let day=41;day>=0;day--) for(let j=0;j<([7,11,8,17,12,15,10,16,22,18,14,20,17,19][(41-day)%14]-(day>=28?5:day>=14?3:0));j++){
      const date=new Date(); date.setDate(date.getDate()-day); date.setHours(12,0,0,0);
      demoJobs.push({id:`demo-${day}-${j}`,customer_name:names[j%5],order:`MK-${2100+demoJobs.length}`,status:j%7===0?['تأجيل','لم يتم الرد','رفض الزيارة'][day%3]:j%4===0?'جديد':'تم التسليم',created_at:date.toISOString(),device:j%2?'ONT':'ONU',tech:j%13===0?'':['أحمد علي','محمد حسن','محمود سعد','كريم عادل'][(day+j)%4],serial:j%11===0?'':`MK${day}${j}`,address:'منطقة تجريبية — بيانات توضيحية',comment:j%7===0?'يحتاج التواصل مع العميل قبل الزيارة التالية':''});
    }
    demoJobs.reverse();
  }
  const getJobs = () => preview ? demoJobs : (typeof myJobsBase==='function' ? myJobsBase():[]);
  const getDevices = () => preview ? Array.from({length:128},(_,i)=>({id:`device-${i}`,serial:`MSK-${1000+i}`,device:i<74?'ONT':i<111?'ONU':'Router',date_received:new Date(Date.now()-(i<4?65:8)*86400000).toISOString(),tech:'أحمد علي'})) : (typeof myWarehouse==='function' ? myWarehouse():[]);
  const toast = message => { $('toast').textContent=message; $('toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('toast').classList.remove('visible'),3500); };
  const isProblem = j => ['تأجيل','لم يتم الرد','رفض الزيارة'].includes(j.status);
  function openJob(id){
    if(!preview){openDetails(id);return;}
    const j=getJobs().find(row=>String(row.id)===id);if(!j)return;
    let dialog=$('demoDetail');if(!dialog){dialog=document.createElement('dialog');dialog.id='demoDetail';dialog.className='detail-dialog';document.body.append(dialog);dialog.addEventListener('click',e=>{if(e.target===dialog||e.target.closest('[data-close-dialog]'))dialog.close();});}
    dialog.innerHTML=`<div class="panel-heading"><span class="section-kicker">TASK DETAILS</span><button class="icon-button" data-close-dialog aria-label="إغلاق">×</button></div><h2>${escape(j.customer_name)}</h2><p class="method-note">عرض تجريبي؛ تعديل بيانات المهمة متاح في التطبيق بعد تسجيل الدخول.</p><dl>${[['الطلب',j.order],['الحالة',j.status],['الفني',window.MiskDomain.tech(j)],['الجهاز',j.device],['السيريال',j.serial||'غير مسجل'],['العنوان',j.address],['ملاحظة',j.comment||'لا توجد ملاحظات']].map(([k,v])=>`<div><dt>${k}</dt><dd>${escape(v)}</dd></div>`).join('')}</dl>`;dialog.showModal();
  }
  const views=window.MiskViews.create({host:dedicated,getJobs,getDevices,openJob,navigate:route,icon,identity:()=>preview?'preview':String(userObj?.id||userObj?.username||'session'),getLoadState:()=>({jobs:loadState.jobs,warehouse:loadState.warehouse,error:Object.values(loadErrors)[0]||''})});
  function chart(jobs){
    const days=Array.from({length:14},(_,i)=>{const d=new Date(); d.setDate(d.getDate()-13+i);return d;});
    const key=d=>`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const incoming=days.map(d=>jobs.filter(j=>key(new Date(j.created_at))===key(d)).length);
    const done=days.map(d=>jobs.filter(j=>j.status==='تم التسليم'&&key(new Date(j.created_at))===key(d)).length);
    const max=Math.max(4,...incoming,...done); const coords=a=>a.map((n,i)=>[44+i*35.6,160-n/max*128]);
    const line=a=>coords(a).map(p=>p.join(',')).join(' ');
    $('trafficChart').innerHTML=`<svg viewBox="0 0 530 198" role="img" aria-label="عدد المهام المضافة وحالتها الحالية خلال آخر أربعة عشر يومًا"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#55e7ea" stop-opacity=".18"/><stop offset="1" stop-color="#a25beb" stop-opacity=".02"/></linearGradient></defs>${[0,1,2,3,4].map(n=>`<line x1="44" x2="508" y1="${32+n*32}" y2="${32+n*32}" class="grid-line"/><text x="30" y="${36+n*32}" text-anchor="end">${Math.round(max*(1-n/4))}</text>`).join('')}${days.map((d,i)=>`<line x1="${44+i*35.6}" x2="${44+i*35.6}" y1="24" y2="160" class="grid-line vertical"/>`).join('')}<polygon points="44,160 ${line(incoming)} 507,160" fill="url(#chartFill)"/><polyline points="${line(done)}" class="chart-line outgoing"/><polyline points="${line(incoming)}" class="chart-line incoming"/>${[incoming,done].map((a,k)=>coords(a).map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="3" fill="${k?'#b477ed':'#66eeeb'}"><title>${days[i].toLocaleDateString('ar-EG')}: ${a[i]} ${k?'تم التسليم':'مهام واردة'}</title></circle>`).join('')).join('')}${[0,4,8,13].map(i=>`<text x="${44+i*35.6}" y="188" text-anchor="middle">${days[i].toLocaleDateString('en-GB',{month:'short',day:'2-digit'})}</text>`).join('')}</svg>`;
    $('incomingTotal').textContent=incoming.reduce((a,b)=>a+b,0); $('deliveredTotal').textContent=done.reduce((a,b)=>a+b,0);
  }
  function refresh(){
    const jobs=getJobs(), devices=getDevices(), total=jobs.length;
    const done=jobs.filter(j=>j.status==='تم التسليم').length, problem=jobs.filter(isProblem).length, pending=total-done-problem;
    const percent=total?Math.round(done/total*100):0;
    $('metric-total').textContent=total.toLocaleString('en-US'); $('metric-done').textContent=`${percent}%`; $('metric-pending').textContent=pending; $('metric-devices').textContent=devices.length;
    $('note-done').textContent=`${done} مهمة تم تسليمها`; $('note-total').textContent=preview?'بيانات تجريبية للعرض':`${problem} مهمة تحتاج متابعة`;
    const alertTotal=views.countAlerts();$('alertCount').textContent=alertTotal; $('notificationDot').hidden=!alertTotal;$('overviewAlerts').textContent=alertTotal;
    $('healthPercent').textContent=total?`${percent}%`:'—';
    $('healthDonut').style.setProperty('--progress',`${percent}%`);
    $('statusList').innerHTML=[['green','تم التسليم',done],['cyan','قيد الانتظار',pending],['yellow','تحتاج متابعة',problem]].map(([color,label,n])=>`<li><i class="dot ${color}"></i><span>${label}</span><b>${n}</b></li>`).join('');
    chart(jobs);
    const recent=[...jobs].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5);
    $('recentActivity').innerHTML=recent.length?recent.map(j=>`<button class="activity-row" data-job="${escape(j.id)}"><span class="activity-icon ${isProblem(j)?'warning':''}">${icon(j.status==='تم التسليم'?'shield':isProblem(j)?'bell':'server')}</span><span class="activity-copy"><strong>${escape(j.customer_name || 'مهمة جديدة')}</strong><small>${escape(j.order||'—')} · ${escape(new Date(j.created_at).toLocaleDateString('ar-EG'))}</small></span><span class="status-badge ${j.status==='تم التسليم'?'success':isProblem(j)?'warn':''}">${escape(j.status||'جديد')}</span></button>`).join(''):'<div class="empty-state">لا توجد مهام لعرضها بعد</div>';
    const groups=new Map();
    devices.forEach(d=>{const type=String(d.model||d.device||d.device_type||d.type||'غير محدد').trim()||'غير محدد';groups.set(type,(groups.get(type)||0)+1);});
    const sorted=[...groups].sort((a,b)=>b[1]-a[1]);
    const distribution=sorted.length>3?[...sorted.slice(0,2),['أجهزة أخرى',sorted.slice(2).reduce((sum,row)=>sum+row[1],0)]]:sorted;
    $('deviceDistribution').innerHTML=distribution.length?distribution.map(([type,n])=>{const p=devices.length?Math.round(n/devices.length*100):0;return `<div class="resource"><div><span>${escape(type)}</span><strong>${p}%</strong></div><div class="progress-track" role="progressbar" aria-label="${escape(type)}" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><span style="width:${p}%"></span></div><small>${n} / ${devices.length} جهاز</small></div>`;}).join(''):'<div class="empty-state">لا توجد أجهزة مسجلة لعرضها</div>';
    if(!preview){
      $('connectionText').textContent=Object.values(loadErrors)[0] || (loadState.jobs&&loadState.warehouse?'تم تحديث بيانات مساحة العمل':'جارٍ تحميل بيانات مساحة العمل');
      if(!loadState.jobs){['total','done','pending'].forEach(id=>$('metric-'+id).textContent='—');$('healthPercent').textContent='—';$('recentActivity').innerHTML='<div class="empty-state">'+(loadErrors.jobs?'تعذر تحميل المهام. أعد المحاولة من الإعدادات.':'جارٍ تحميل المهام…')+'</div>';}
      if(!loadState.warehouse)$('metric-devices').textContent='—';
    }
    views.refresh();
  }
  function route(id){
    if(!preview && ['team','create','archive'].includes(id) && !userObj?.isAdmin){toast('هذا القسم متاح للمسؤول فقط');return;}
    shell.dataset.view=id; shell.classList.remove('menu-open');
    document.querySelector('.mobile-menu').setAttribute('aria-expanded','false');
    shell.querySelectorAll('[data-route].nav-item').forEach(el=>{const active=el.dataset.route===id; el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    const overview=id==='overview',managed=['analytics','problem','pending'].includes(id);
    dedicated.classList.toggle('hidden',!managed);
    if(managed)views.show(id);else views.hide();
    $('overview').classList.toggle('hidden',!overview); $('settingsPanel').classList.toggle('hidden',id!=='settings'); $('workspaceContent').classList.toggle('hidden',overview||id==='settings'||managed);
    $('pageTitle').textContent=overview?'نظرة عامة '+new Date().getFullYear():id==='create'?'إضافة مهمة جديدة':nav.find(n=>n[0]===id)?.[2]||'المهام';
    $('breadcrumbLabel').textContent=({overview:'Overview',analytics:'Analytics',problem:'Alerts',pending:'Task queue',all:'Tasks',warehouse:'Inventory',team:'Team',archive:'Archive',create:'New task',settings:'Settings'})[id]||id;
    $('pageSubtitle').textContent=overview?'متابعة أداء العمليات والمهام والفنيين في مكان واحد':'مساحة عمل موحدة لإدارة عمليات MISK IT';
    // === التعديل الوحيد: زرار مهمة جديدة يظهر في المهام بس ===
    // نفس الزرار الأصلي، مش زرار جديد
    // id = 'all' هو صفحة المهام، أي id تاني = اخفيه
    var newTaskBtn = $('newTask');
    if(newTaskBtn){
      if(preview){
        newTaskBtn.hidden = (id !== 'all');
      } else {
        newTaskBtn.hidden = (id !== 'all') || !userObj?.isAdmin;
      }
    }
    if(managed){$('pageSubtitle').textContent=({analytics:'تحليل حجم العمل، مقارنة الفترات، وقياس أداء الفنيين',problem:'مركز متابعة المشكلات والأولويات وجودة البيانات',pending:'قائمة التنفيذ اليومية · تصفية المهام وترتيبها حسب عمرها'})[id];return;}
    if(preview && !overview && id!=='settings'){
      const items=id==='pending'?demoJobs.filter(j=>j.status==='جديد'):id==='problem'?demoJobs.filter(isProblem):demoJobs;
      $('workspaceContent').innerHTML=`<div class="panel"><h2>${escape($('pageTitle').textContent)}</h2><p>معاينة التصميم فقط. سجّل الدخول لاستخدام وظائف النظام الفعلية.</p>${['all','pending','problem'].includes(id)?'<label for="demoSearch">بحث في المهام</label><input id="demoSearch" placeholder="ابحث باسم العميل أو رقم الطلب"><div id="demoRows"></div>':'<a class="primary inline-button" href="index.html">الانتقال إلى تسجيل الدخول</a>'}</div>`;
      if($('demoRows')){const render=()=>{$('demoRows').innerHTML=items.filter(j=>(j.customer_name+j.order).includes($('demoSearch').value)).slice(0,20).map(j=>`<div class="demo-job"><strong>${escape(j.customer_name)}</strong><span>${j.order}</span><span class="status-badge">${j.status}</span></div>`).join('')||'<p>لا توجد نتائج</p>';};$('demoSearch').addEventListener('input',render);render();}
    } else if(!preview && !overview && id!=='settings'){
      app.classList.remove('hidden');
      app.dataset.section=['team','create'].includes(id)?'admin':'jobs';
      if(!['team','create'].includes(id)) showTab(id, null);
      if(id==='create') {const boxes=app.querySelectorAll('.admin-box'); boxes.forEach(b=>b.classList.remove('open'));boxes[0]?.classList.add('open');$('a_customer')?.focus();}
    }
  }
  shell.addEventListener('click',event=>{
    const routeButton=event.target.closest('[data-route]'); if(routeButton){route(routeButton.dataset.route);return;}
    const metric=event.target.closest('[data-metric]'); if(metric){route(({total:'all',done:'all',pending:'pending',devices:'warehouse'})[metric.dataset.metric]);if(!preview&&metric.dataset.metric==='done')filterByCircle('done');return;}
    const job=event.target.closest('[data-job]');if(job){openJob(job.dataset.job);return;}
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(action==='menu'){shell.classList.toggle('menu-open');event.target.closest('button').setAttribute('aria-expanded',shell.classList.contains('menu-open'));}
    if(action==='search'){route('all');(preview?$('demoSearch'):$('searchInput'))?.focus();}
    if(action==='logout'){if(preview)location.href='index.html';else logout();}
    if(action==='password'){if(preview)toast('تغيير كلمة المرور متاح بعد تسجيل الدخول');else $('passModal').style.display='flex';}
    if(action==='refresh'){if(preview){refresh();toast('تم تحديث بيانات المعاينة');}else{silentRefreshNow();toast('جارٍ طلب تحديث البيانات');}}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){shell.classList.remove('menu-open');document.querySelector('.mobile-menu').setAttribute('aria-expanded','false');}});
  function tick(){ $('dashboardClock').textContent=new Date().toLocaleString('en-GB',{weekday:'short',month:'short',day:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
  tick();setInterval(tick,30000);
  window.MiskDashboard={refresh(source){if(source){loadState[source]=true;delete loadErrors[source];}refresh();},error(message,source){loadErrors[source]=message;refresh();},show(){shell.classList.remove('hidden');if(!preview){$('profileName').textContent=userObj?.name||userObj?.username||'MISK';$('profileRole').textContent=userObj?.isAdmin?'مسؤول النظام':'فني عمليات';$('newTask').hidden=!userObj?.isAdmin;['team','archive'].forEach(id=>shell.querySelector(`[data-route="${id}"]`).hidden=!userObj?.isAdmin);}route('overview');refresh();}};
  if(preview)window.MiskDashboard.show();
  if(!preview && $('warehouseList'))new MutationObserver(()=>refresh()).observe($('warehouseList'),{childList:true});
})();