// MISK IT - dashboard.js - أدوار + شيت يومي + أرشيف كامل
// الفني: مهامه بس | الليدر: كل الفنيين + رفع شيت + مسح أوردر | السوبر: + إضافة فني + امسح كل حاجة
(function(){
const $=id=>document.getElementById(id);
const preview=new URLSearchParams(location.search).get('preview')==='1';
let userObj=null, jobs=[], devices=[], techList=[], pendingSheet=null;
let loadState={jobs:false,warehouse:false}, loadErrors={};

// ===== 1. الأدوار - من Supabase باليوزر والموبايل =====
function getRole(){
  if(preview) return 'super_leader';
  const raw=(userObj?.role||userObj?.user_type||userObj?.type||userObj?.userType||'').toString().trim().toLowerCase();
  if(['super_leader','superleader','super','سوبر ليدر','سوبر','super_admin','superadmin'].includes(raw)) return 'super_leader';
  if(['leader','ليدر','lead','admin','مسؤول','مدير'].includes(raw)) return 'leader';
  if(userObj?.isSuper===true||userObj?.is_super===true) return 'super_leader';
  if(userObj?.isAdmin===true) return 'leader'; // توافق قديم: isAdmin كان = ليدر
  if(['tech','technician','فني','fanny'].includes(raw)) return 'tech';
  return 'tech'; // الافتراضي فني - أمان
}
const isSuper=()=>getRole()==='super_leader';
const isLeader=()=>getRole()==='leader'||isSuper();
const isTech=()=>getRole()==='tech';
const canSeeAll=()=>isLeader();
const canUploadSheet=()=>isLeader();
const canAddSingleOrder=()=>isLeader();
const canDeleteJob=()=>isLeader(); // مسح أوردر واحد: ليدر + سوبر
const canAddTech=()=>isSuper(); // إضافة فني: سوبر بس
const canWipeAll=()=>isSuper(); // امسح كل حاجة: سوبر بس
const canArchive=()=>isLeader();
const canExportReport=()=>isLeader();

// اسم الفني الحالي للمطابقة مع عمود Tech في الشيت
function myTechName(){
  return (userObj?.name||userObj?.username||userObj?.full_name||'').toString().trim();
}
function myPhone(){
  return (userObj?.phone||userObj?.mobile||userObj?.tech_phone||'').toString().replace(/\D/g,'').slice(-10);
}
function isMyJob(j){
  if(!isTech()) return true;
  const t=(j.tech||j.technician||j.tech_name||'').toString().trim();
  const n=myTechName();
  const p=(j.tech_phone||j.techPhone||'').toString().replace(/\D/g,'').slice(-10);
  if(n && t===n) return true;
  if(myPhone() && p && p===myPhone()) return true;
  if(n && t && (t.includes(n)||n.includes(t))) return true;
  return false;
}
function visibleJobs(){ return isTech()? jobs.filter(isMyJob) : jobs; }

// ===== 2. تحميل البيانات =====
async function loadAll(){
  try{
    if(window.MiskOps?.listJobs){ jobs=await window.MiskOps.listJobs(); loadState.jobs=true; }
    if(window.MiskOps?.listWarehouse){ devices=await window.MiskOps.listWarehouse(); loadState.warehouse=true; }
    if(window.MiskOps?.listTechs){ techList=await window.MiskOps.listTechs(); }
    if(window.MiskOps?.getUser){ userObj=await window.MiskOps.getUser(); }
  }catch(e){ loadErrors.jobs=e.message||'تعذر التحميل'; }
  render();
}

// ===== 3. رسم الواجهة حسب الدور =====
function render(){
  const shell=$('app'); if(!shell) return;
  const vJobs=visibleJobs();
  const done=vJobs.filter(j=>j.status==='تم التسليم'||j.comment==='تم التسليم').length;
  const roleLabel=isSuper()?'سوبر ليدر':isLeader()?'ليدر':'فني';

  shell.innerHTML=`
  <header class="topbar"><b>MISK IT</b><span>${userObj?.name||'مستخدم'} - ${roleLabel}</span><button onclick="logout()">خروج</button></header>
  <nav class="tabs">
    <button onclick="showTab('jobs')">📋 ${isTech()?'مهامي':'المهام'} (${vJobs.length})</button>
    ${canSeeAll()?`<button onclick="showTab('team')">👷 الفنيين (${techList.length})</button>`:''}
    ${canUploadSheet()?`<button onclick="openUploadSheet()">📤 رفع شيت اليوم</button>`:''}
    ${canAddSingleOrder()?`<button onclick="openAddOrder()">➕ أوردر واحد</button>`:''}
    <button onclick="showTab('archive')">🗄️ الأرشيف</button>
    ${canExportReport()?`<button onclick="exportTodayReport()">📥 سحب تقرير اليوم</button>`:''}
    ${canArchive()?`<button onclick="archiveToday()" style="background:#7c3aed;color:#fff">🗄️ أرشفة اليوم</button>`:''}
    ${canWipeAll()?`<button onclick="wipeAll()" style="background:#dc2626;color:#fff">🚨 امسح كل حاجة</button>`:''}
  </nav>
  <div id="teamPage" style="display:none"></div>
  <div id="jobsPage"></div>
  <div id="archivePage" style="display:none"></div>
  <div id="toast"></div>`;
  renderJobs(); renderTeam(); renderArchive();
  // إخفاء فعلي مش CSS بس
  if(!canAddTech()){ const m=$('addTechModal'); if(m) m.remove(); }
}

function renderJobs(){
  const el=$('jobsPage'); if(!el) return;
  const vJobs=visibleJobs();
  el.innerHTML=`<h2>${isTech()?'مهامي اليوم':'مهام اليوم - كل الفنيين'}</h2>
  <p style="font-size:13px;color:#666">${isTech()?'بتشوف مهامك انت بس':`إجمالي: ${vJobs.length} | تم: ${vJobs.filter(j=>j.comment==='تم التسليم').length} | متبقي: ${vJobs.filter(j=>j.comment!=='تم التسليم').length}`}</p>
  <input id="searchInput" placeholder="ابحث بالاسم / الأرضي / الفني" oninput="filterJobs(this.value)" style="width:100%;padding:10px;margin:10px 0">
  <div id="jobsList">${vJobs.map(jobCard).join('')||'<p>لا توجد مهام - المهام فاضية، ارفع شيت اليوم</p>'}</div>`;
}
function jobCard(j){
  return `<div class="job-card" data-job="${j.id}">
    <b>${j.customer_name||j.name||''}</b> - <span>${j.tel||j.landline||''}</span><br>
    <small>${j.address||''} | ${j.device||'ONT'} | الفني: ${j.tech||''}</small><br>
    <small>سيريال: <b>${j.serial||'-'}</b> | UP/DOWN: <b>${j.status||'-'}</b> | الحالة: <b>${j.comment||'-'}</b></small><br>
    <button onclick="openJob('${j.id}')">فتح / تعديل</button>
    ${canDeleteJob()?`<button onclick="deleteJob('${j.id}')" style="background:#dc2626;color:#fff">مسح أوردر</button>`:''}
  </div>`;
}
function filterJobs(q){
  q=(q||'').trim();
  document.querySelectorAll('.job-card').forEach(c=>{
    c.style.display=!q||c.textContent.includes(q)?'':'none';
  });
}

// ===== 4. صفحة الفنيين - المكان الوحيد للفنيين =====
function renderTeam(){
  const el=$('teamPage'); if(!el||!canSeeAll()) return;
  el.innerHTML=`<h2>👷 الفنيين</h2>
  ${canAddTech()?`<button onclick="openAddTech()" style="background:#00a651;color:#fff;padding:10px 16px">➕ إضافة فني</button>
  <p style="font-size:12px;color:#666">إضافة الفني مع السوبر ليدر بس</p>`:''}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-top:12px">
  ${techList.map(t=>{
    const tj=jobs.filter(j=>(j.tech||'')===t.name);
    const done=tj.filter(j=>j.comment==='تم التسليم').length;
    const roleAr=t.role==='super_leader'?'سوبر ليدر':t.role==='leader'?'ليدر':'فني';
    return `<div class="tech-card"><b>${t.name}</b> - <span>${roleAr}</span><br><small>${t.phone||''} | ${t.line||''}</small><br><small>أوردرات اليوم: ${tj.length} | تم: ${done} | لسه: ${tj.length-done}</small><br><button onclick="filterByTech('${t.name}')">عرض أوردراته</button></div>`;
  }).join('')||'<p>لا يوجد فنيين</p>'}</div>`;
}
function filterByTech(name){
  showTab('jobs');
  setTimeout(()=>{ const inp=$('searchInput'); if(inp){ inp.value=name; filterJobs(name); } },50);
}

// ===== 5. رفع شيت اليوم - ليدر + سوبر بس =====
function openUploadSheet(){
  if(!canUploadSheet()) return alert('رفع الشيت مع الليدر والسوبر ليدر بس');
  $('uploadSheetModal').style.display='flex';
  $('sheetFile').onchange=e=>{
    const f=e.target.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=ev=>{
      const wb=XLSX.read(ev.target.result,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      pendingSheet=rows;
      const techs=[...new Set(rows.map(r=>r.Tech||r.tech||'').filter(Boolean))];
      const missing=techs.filter(n=>!techList.some(t=>t.name===n));
      $('sheetPreview').innerHTML=`<b>معاينة:</b> ${rows.length} أوردر | ${techs.length} فني<br>الفنيين: ${techs.join(' ، ')}<br>${missing.length?`<span style="color:#f87171">⚠️ فنيين مش موجودين: ${missing.join(' ، ')} - هيتضافوا كفنيين جدد أو اختار بديل قبل الاستيراد</span>`:'<span style="color:#22c55e">✅ كل الفنيين موجودين</span>'}`;
      $('importSheetBtn').style.display='block';
    };
    rd.readAsArrayBuffer(f);
  };
}
function closeUploadSheet(){ $('uploadSheetModal').style.display='none'; pendingSheet=null; }
async function confirmImportSheet(){
  if(!pendingSheet?.length) return alert('ارفع الشيت الأول');
  if(!confirm(`هتستورد ${pendingSheet.length} أوردر؟`)) return;
  // تحويل أعمدة الشيت لنفس حقول السيستم - Serial / Comment / Status فاضيين في الرفع
  const mapped=pendingSheet.map(r=>({
    date:r.Date||r.date||new Date(),
    tel:String(r.Tel||r.tel||''),
    mobile:String(r.Mobile||r.mobile||''),
    customer_name:r.Name||r.name||'',
    device:r['Device type']||r.device||'ONT',
    offer:r['Offer name']||r.offer||'',
    paper_code:r['Paper Code']||'',
    exchange:r['Exchange Name']||'',
    compound:r['Compound Name']||'',
    address:r.Address||r.address||'',
    serial:r.Serial||'', // فاضي - الفني بيملى
    comment:r.Comment||'', // فاضي - الفني بيملى تم التسليم
    status:r.Status||'', // فاضي - الفني بيملى UP / DOWN
    tech:r.Tech||r.tech||'',
    tech_phone:String(r['Tech Phone']||r.tech_phone||''),
    created_at:new Date().toISOString()
  }));
  try{
    for(const j of mapped){ await window.MiskOps.addJob(j); }
    alert('✅ تم استيراد الشيت كله');
    closeUploadSheet(); await loadAll();
  }catch(e){ alert('خطأ في الاستيراد: '+e.message); }
}

// ===== 6. أوردر واحد / إضافة فني =====
function openAddOrder(){
  if(!canAddSingleOrder()) return alert('مع الليدر والسوبر بس');
  $('addOrderModal').style.display='flex';
  $('a_tech').innerHTML=techList.map(t=>`<option value="${t.name}">${t.name} - ${t.role==='super_leader'?'سوبر':t.role==='leader'?'ليدر':'فني'}</option>`).join('');
}
function closeAddOrder(){ $('addOrderModal').style.display='none'; }
async function saveSingleOrder(){
  const j={tel:$('a_tel').value.trim(),mobile:$('a_mobile').value.trim(),customer_name:$('a_customer').value.trim(),device:$('a_device').value.trim()||'ONT',address:$('a_address').value.trim(),tech:$('a_tech').value,serial:'',comment:'',status:'',created_at:new Date().toISOString()};
  if(!j.tel||!j.customer_name) return alert('اكتب الأرضي واسم العميل');
  await window.MiskOps.addJob(j); closeAddOrder(); await loadAll(); alert('✅ تم إضافة الأوردر');
}
function openAddTech(){
  if(!canAddTech()) return alert('إضافة الفني مع السوبر ليدر بس');
  $('addTechModal').style.display='flex';
}
function closeAddTech(){ $('addTechModal').style.display='none'; }
async function saveNewTech(){
  if(!canAddTech()) return alert('مع السوبر بس');
  const t={name:$('tech_name').value.trim(),phone:$('tech_phone').value.trim(),username:$('tech_user').value.trim(),password:$('tech_pass').value,line:$('tech_line').value.trim(),role:$('tech_role').value};
  if(!t.name||!t.phone) return alert('اكتب الاسم والموبايل');
  await window.MiskOps.addTech(t); closeAddTech(); await loadAll(); alert('✅ تم إضافة الفني');
}

// ===== 7. تقرير اليوم + أرشفة الشيت كله =====
async function exportTodayReport(){
  if(!canExportReport()) return alert('مع الليدر والسوبر بس');
  // بنفس أعمدة الشيت الأصلي بالظبط
  const rows=jobs.map(j=>({Date:j.date||new Date(),Tel:j.tel,Mobile:j.mobile,Name:j.customer_name,'Device type':j.device,'Offer name':j.offer,'Returned Rent CPE serial':j.offer,'Paper Code':j.paper_code,'Exchange Name':j.exchange,'Compound Name':j.compound,Address:j.address,'Senior Support':'','Senior Mobile':'',Serial:j.serial||'',Comment:j.comment||'',Status:j.status||'',Tech:j.tech,'Tech Phone':j.tech_phone}));
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Report');
  const d=new Date(); const name=`report_${d.getDate()}-${d.getMonth()+1}-${d.getFullYear()}.xlsx`;
  XLSX.writeFile(wb,name);
  alert('✅ اتسحب تقرير اليوم - دلوقتي تقدر تأرشف');
}
async function archiveToday(){
  if(!canArchive()) return alert('مع الليدر والسوبر بس');
  const d=new Date(); const label=`${d.getDate()}-${d.getMonth()+1}-${d.getFullYear()}`;
  if(!confirm(`هتأرشف الشيت كله بتاريخ ${label}؟\nاللي اتركب واللي اتأجل كله هيروح الأرشيف، والمهام هتفضى لليوم اللي بعده.`)) return;
  try{
    if(window.MiskOps?.archiveAll) await window.MiskOps.archiveAll({date:label,jobs});
    else { for(const j of jobs) await window.MiskOps.archiveJob(j); }
    if(window.MiskOps?.clearJobs) await window.MiskOps.clearJobs();
    jobs=[]; render(); alert('✅ اتأرشف الشيت كله بتاريخ '+label+' - المهام فاضية لليوم اللي بعده');
  }catch(e){ alert('خطأ في الأرشفة: '+e.message); }
}
function renderArchive(){
  const el=$('archivePage'); if(!el) return;
  el.innerHTML=`<h2>🗄️ الأرشيف</h2><p>كل شيت بيروح الأرشيف بتاريخ يومه - اللي اتركب واللي اتأجل</p><div id="archiveList"></div>`;
  if(window.MiskOps?.listArchive) window.MiskOps.listArchive().then(list=>{
    $('archiveList').innerHTML=list.map(a=>`<div>📁 ${a.date} - ${a.count} أوردر <button onclick="downloadArchive('${a.date}')">تحميل</button></div>`).join('')||'<p>لا يوجد أرشيف بعد</p>';
  });
}
async function downloadArchive(date){
  const list=await window.MiskOps.listArchive(); const a=list.find(x=>x.date===date); if(!a) return;
  const ws=XLSX.utils.json_to_sheet(a.jobs); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Archive'); XLSX.writeFile(wb,`archive_${date}.xlsx`);
}

// ===== 8. مسح =====
async function deleteJob(id){
  if(!canDeleteJob()) return alert('مسح الأوردر مع الليدر والسوبر بس');
  if(!confirm('هتمسح الأوردر ده؟')) return;
  await window.MiskOps.deleteJob(id); await loadAll();
}
async function wipeAll(){
  if(!canWipeAll()) return alert('امسح كل حاجة مع السوبر ليدر بس');
  if(!confirm('⚠️ هتمسح كل حاجة؟ المهام + المخزن + الفنيين؟')) return;
  if(!confirm('تأكيد أخير - متأكد 100%؟')) return;
  await window.MiskOps.wipeAll(); jobs=[]; techList=[]; render(); alert('تم مسح كل حاجة');
}

// ===== 9. تبويبات + فتح مهمة =====
function showTab(tab){
  ['jobsPage','teamPage','archivePage'].forEach(id=>{ const el=$(id); if(el) el.style.display='none'; });
  if(tab==='team'){ $('teamPage').style.display='block'; renderTeam(); }
  else if(tab==='archive'){ $('archivePage').style.display='block'; renderArchive(); }
  else { $('jobsPage').style.display='block'; renderJobs(); }
}
function openJob(id){
  const j=jobs.find(x=>String(x.id)===String(id)); if(!j) return;
  // الفني بيضيف Serial + UP/DOWN + تم التسليم عند العميل
  const serial=prompt('السيريال:',j.serial||''); if(serial===null) return;
  const status=prompt('UP / DOWN / تأجيل:',j.status||''); if(status===null) return;
  const comment=prompt('تم التسليم / لم يتم التسليم / تأجيل:',j.comment||''); if(comment===null) return;
  window.MiskOps.updateJob(id,{serial,status,comment}).then(()=>loadAll());
}
function logout(){ if(window.MiskOps?.logout) window.MiskOps.logout(); else location.href='index.html'; }

// تصدير للدوال اللي الـ HTML بيناديها
Object.assign(window,{getRole,isSuper,isLeader,isTech,canAddTech,canWipeAll,canDeleteJob,showTab,openUploadSheet,closeUploadSheet,confirmImportSheet,openAddOrder,closeAddOrder,saveSingleOrder,openAddTech,closeAddTech,saveNewTech,exportTodayReport,archiveToday,deleteJob,wipeAll,filterJobs,filterByTech,openJob,logout});
window.MiskDashboard={show(u){ userObj=u||window.MiskOps?.currentUser||null; loadAll(); }};
if(preview) window.MiskDashboard.show({name:'معاينة',role:'super_leader'});
})();
