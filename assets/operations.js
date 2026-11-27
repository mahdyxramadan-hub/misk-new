/* Existing operational workflows, extracted from the supplied HTML. */
localStorage.removeItem("misk_pass");

const SUPABASE_URL = "https://wpbjdxjozibqcoyrmxlc.supabase.co";
const SUPABASE_KEY = "sb_publishable_EpBDoKSZQ6OMZA3wHKd8vg_9_ocCNnm";
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET = "job_photos";
const TABLE = "jobs";
const ARCHIVE_TABLE = "jobs_archive";
const WAREHOUSE_TABLE = "warehouse";
let userObj=null, allJobs=[], allWarehouse=[], archivedJobs=[], searchQ="", activeFilter="all", currentDetailId=null, currentPhotoSlot=null, currentStatusJobId=null, currentStatusCustomer="", currentSerialCamJobId=null, photoRot=0, activeTab="all", visibleCount=10, currentLockId=null, lockStep=0, pendingLockPayload=null, currentUpDownJobId=null, currentRecipientJobId=null, recipientMap={}, upDownMap={}, serialMap={}, photosMap={}, techLeftAlerts=[];
let cachedTechNames=[];
let silentSec = 30;
let jobsRequest=null, warehouseRequest=null;
const miskEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let autoOn = true;
function norm(s){return String(s||"").trim().toLowerCase().replace(/[\u064B-\u0652]/g,"").replace(/أ|إ|آ/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/\s+/g," ")}
function normTechKey(name){ return norm(name).replace(/[^a-z0-9\u0600-\u06FF]/g,"") }
function cleanSerial(s){ return String(s||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"") }
function fmtDate(d){ const x=new Date(d); if(isNaN(x)) return ""; return String(x.getDate()).padStart(2,"0")+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+x.getFullYear() }
function todayStr(){ return fmtDate(new Date()) }
function parseSheetDate(v){
  if(!v) return "";
  if(typeof v==="number"){ const d=new Date(Math.round((v-25569)*86400*1000)); return fmtDate(d) }
  let s=String(v).trim();
  let m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if(m){ let y=+m[3]; if(y<100) y+=2000; return String(m[1]).padStart(2,"0")+"-"+String(m[2]).padStart(2,"0")+"-"+y }
  let d=new Date(s); if(!isNaN(d)) return fmtDate(d);
  return s;
}
function daysBetween(dateStr){
  if(!dateStr) return 9999;
  let p=dateStr.split("-"); if(p.length!==3) return 9999;
  let d=new Date(+p[2], +p[1]-1, +p[0]); if(isNaN(d)) return 9999;
  return Math.floor((new Date().setHours(0,0,0,0)-d.getTime())/86400000);
}
function getVal(id){ return (document.getElementById(id)?.value || "").trim() }
function techDisplayName(t){ return (t.name || t.username || "").trim() }
function getJobTech(j){ return (j.tech || j.tech_name || j.Tech || "").trim() }
function getRoleFromDb(t){
  let r = String(t.role||"").trim().toLowerCase();
  if(r==="super_admin"||r==="superadmin"||r==="super admin") return "super_admin";
  if(r==="admin") return "admin";
  if(r==="tech"||r==="technician") return "tech";
  let n = norm(t.name||"")+" "+norm(t.username||"");
  if(n.includes("admin")||n.includes("ادمن")) return "admin";
  return "tech";
}
    async function getAllJobs(){
  let all = [];
  let from = 0;
  while(true){
    let r = await supabaseClient.from(TABLE).select("*").order("created_at",{ascending:false}).order("id",{ascending:false}).range(from, from + 999);
    if(r.error) throw r.error;
    let data = r.data || [];
    all = all.concat(data);
    if(data.length < 1000) break;
    from += 1000;
  }
  return all;
}
function myJobsBase(){ if(!userObj) return []; if(userObj.isAdmin) return [...allJobs]; return allJobs.filter(j=> normTechKey(getJobTech(j))===normTechKey(userObj.name)); }
async function insertJobSafe(payload){
  let r1 = await supabaseClient.from(TABLE).insert(payload);
  if(!r1.error) return r1;
  let p2 = {...payload}; delete p2.tech_name;
  let r2 = await supabaseClient.from(TABLE).insert(p2);
  if(!r2.error) return r2;
  let p3 = {...payload}; delete p3.tech;
  let r3 = await supabaseClient.from(TABLE).insert(p3);
  return r3;
}
async function login(e){
  if(!supabaseClient){ document.getElementById("loginMsg").textContent="تعذر تحميل خدمة الاتصال. حدّث الصفحة وحاول مجددًا."; return; }
  if(e) e.preventDefault();
  let u = document.getElementById('user').value.trim().toLowerCase();
  let p = document.getElementById('pass').value.trim();
  let msgEl = document.getElementById('loginMsg');
  if(msgEl) msgEl.innerText = 'جاري...';
  try{
    let res = await supabaseClient.from('technicians').select('*');
    if(res.error || !res.data){
      if(msgEl) msgEl.innerText = 'خطأ: ' + (res.error ? res.error.message : 'مفيش داتا');
      return false;
    }
    let found = res.data.find(t => {
      let userInDb = String(t.username || '').trim().toLowerCase();
      let nameInDb = String(t.name || '').trim().toLowerCase().replace(/[\s_]+/g,'');
      let phoneInDb = String(t.phone || '').trim();
      let inputClean = u.replace(/[\s_]+/g,'');
      let passInDb = String(t.password || '').trim();
      let userMatch = (userInDb === u) || (nameInDb === inputClean) || (userInDb.replace(/[\s_]+/g,'') === inputClean) || (phoneInDb === u);
      return userMatch && passInDb === p;
    });
    if(!found){
      if(msgEl) msgEl.innerText = 'الاسم مش موجود';
      return false;
    }
    let display = techDisplayName(found);
    let role = getRoleFromDb(found);
    let isAdmin = (role==="admin"||role==="super_admin");
    userObj = {id: found.id, username: found.username, name: display, role: role, isAdmin: isAdmin, isSuper: role==="super_admin"};
    localStorage.setItem('misk_user', JSON.stringify(userObj));
    localStorage.removeItem('misk_pass');
    afterLogin();
  }catch(err){
    if(msgEl) msgEl.innerText = 'خطأ: ' + err.message;
    console.log(err);
  }
  return false;
}
function afterLogin(){
  let lp = document.getElementById("loginPage");
  if(lp) lp.classList.add("hidden");
  let ap = document.getElementById("appPage");
  if(ap){
    ap.classList.remove("hidden");
    ap.classList.remove("dashboard-enter");
    void ap.offsetWidth;
    ap.classList.add("dashboard-enter");
    setTimeout(function(){ap.classList.remove("dashboard-enter");},1800);
  }
  let w = document.getElementById("welcome");
  let ti = document.getElementById("techInfo");
  let isAdmin = userObj.isAdmin;
  let isSuper = userObj.role === 'super_admin';
  let displayName = (userObj.name || userObj.username || "Mahdy").trim();
  if (w) w.innerText = "أهلاً " + displayName;
  if (ti) {
    if (isSuper) ti.innerText = "Super Admin - " + displayName;
    else if (isAdmin) ti.innerText = "ادمن - " + displayName;
    else ti.innerText = "فني - " + displayName;
  }
  let aa = document.getElementById("adminAdd");
  if(aa) aa.classList.toggle("hidden", !isAdmin);
  let an = document.getElementById("archiveNav");
  if(an) an.style.display = isAdmin ? "" : "none";
  let sdb = document.getElementById("superDeleteBox");
  if(sdb) sdb.style.display = isSuper ? "block" : "none";
  if(isAdmin){loadTechNames();loadTechCount();}
  loadJobs(); loadWarehouse(); loadArchive();
  window.MiskDashboard?.show();
  let pm = document.getElementById("passModal");
  if(pm && !localStorage.getItem("misk_pass_changed_"+userObj.username)) pm.style.display="flex";
}
function logout(){
  Object.keys(localStorage).forEach(k=>{
    if(k.startsWith("misk_")) localStorage.removeItem(k);
  });
  sessionStorage.clear();
  location.reload();
}
async function doChangePass(){
  let np=document.getElementById("newPassInput").value.trim();
  if(!np) return alert("اكتب الباسورد الجديد");
  let {error} = await supabaseClient.from("technicians").update({password:np}).eq("id", userObj.id);
  if(error) return alert("خطأ: "+error.message);
  localStorage.setItem("misk_pass_changed_"+userObj.username,"1");
  localStorage.removeItem("misk_pass");
  closePassModal(); alert("تم تغيير الباسورد");
}
function closePassModal(){ document.getElementById("passModal").style.display="none" }
function loadWarehouse(){
  if(warehouseRequest)return warehouseRequest;
  warehouseRequest=(async()=>{
  try{
  let {data,error}=await supabaseClient.from(WAREHOUSE_TABLE).select("*").order("created_at",{ascending:false}).limit(20000);
  if(error){ window.MiskDashboard?.error("تعذر تحديث المخزن — تحقق من الاتصال", "warehouse"); return; }
  allWarehouse=data||[];
  renderWarehouse(); window.MiskDashboard?.refresh("warehouse");
  }catch(error){window.MiskDashboard?.error("تعذر تحديث المخزن — تحقق من الاتصال","warehouse");}
  })().finally(()=>{warehouseRequest=null;});
  return warehouseRequest;
}
function myWarehouse(){
  if(userObj.isAdmin) return allWarehouse;
  return allWarehouse.filter(w=> normTechKey(w.tech)===normTechKey(userObj.name) && !String(w.customer_phone||"").trim() && !String(w.date_install||"").trim());
}
function renderWarehouse(){
  let mine=myWarehouse();
  let delivered=allWarehouse.filter(w=> String(w.customer_phone||"").trim() || String(w.date_install||"").trim());
  let el=document.getElementById("warehouseSummary");
  if(el) el.innerText = userObj.isAdmin ? `إجمالي المخزن: ${allWarehouse.length} - في العهدة: ${allWarehouse.length-delivered.length} - متسلم: ${delivered.length}` : `عهدتك: ${mine.length} جهاز - اللي معاك بس، المتسلم اتشال من عندك`;
  let old=mine.filter(w=> daysBetween(w.date_received||w.date||"")>=60);
  let box=document.getElementById("stockAlerts");
  if(box){
    if(old.length){
      box.innerHTML=`<div style="background:#fff3cd;border:2px solid #ff7a00;margin:0 12px 12px;border-radius:16px;padding:14px"><h3 style="margin:0">⚠️ جرد - أجهزة بقالها 60 يوم ومركبتش (${old.length})</h3>`+old.map(w=>`<div style="font-size:13px;line-height:2">🔴 سيريال <b>${w.serial}</b> - متسلم بتاريخ <b>${w.date_received||w.date||""}</b> - لم يتم التركيب حتى الآن - الفني: ${w.tech||""} - ${w.comment||""}</div>`).join("")+`</div>`;
    } else box.innerHTML="";
  }
  let prev=document.getElementById("warehousePreview");
  if(prev) prev.innerHTML=mine.slice(0,5).map(w=>`<div style="font-size:12px;line-height:2">📦 ${w.serial} - ${w.model||""} - ${w.tech||""} - ${w.date_received||""}</div>`).join("")+(mine.length>5?`<div style="font-size:12px">... و ${mine.length-5} جهاز تاني</div>`:"");
  if(activeTab==="warehouse") renderWarehouseList();
}
  let warehouseTab='all_pending';
let warehouseSearch='';
function renderWarehouseList(){
  let box=document.getElementById("warehouseList");
  if(!box) return;

  // --- فلتر: كل فني يشوف أجهزته بس، والادمن يشوف الكل ---
  let saved = null;
  try{ saved = JSON.parse(localStorage.getItem('misk_user') || 'null'); }catch(e){ saved = null; }
  let myName = (saved && saved.name) || (typeof userObj !== 'undefined' && userObj && userObj.name) || '';
  let myUsername = (saved && saved.username) || (typeof userObj !== 'undefined' && userObj && userObj.username) || '';
  let isAdmin = (saved && (saved.isAdmin === true || saved.role === 'admin' || saved.role === 'super_admin')) || (typeof userObj !== 'undefined' && userObj && (userObj.isAdmin === true || userObj.role === 'admin' || userObj.role === 'super_admin'));
  let baseWarehouse = allWarehouse;
  if(!isAdmin){
    if(!myName && !myUsername){
      baseWarehouse = [];
    } else {
      baseWarehouse = allWarehouse.filter(w => { let t = String(w.tech || '').trim().toLowerCase(); return t === String(myName).trim().toLowerCase() || (myUsername && t === String(myUsername).trim().toLowerCase()); });
    }
  }
  // --- نهاية الفلتر ---

  // عشان دالة الاكسيل تستخدم المتفلتر مش الكل
  window._warehouseForExcel = baseWarehouse;

  let allStock=baseWarehouse.filter(w=> !String(w.customer_phone||"").trim() && !String(w.date_install||"").trim());
  let allDone=baseWarehouse.filter(w=> String(w.customer_phone||"").trim() || String(w.date_install||"").trim());
  if(warehouseSearch.trim()){
    let s = warehouseSearch.trim();
    allDone=allDone.filter(w=> String(w.customer_phone||"").includes(s) || String(w.serial||"").includes(s) || String(w.tech||"").includes(s));
    allStock=allStock.filter(w=> String(w.serial||"").includes(s) || String(w.tech||"").includes(s));
  }
  if(warehouseTab==='stock'||warehouseTab==='delivered') warehouseTab='all_pending';
  let listToShow = warehouseTab==='all_done' ? allDone : allStock;
  box.innerHTML=`<h3 style="padding:0 12px">📦 المخزن (${baseWarehouse.length})</h3>
  <div style="display:flex;gap:8px;padding:0 12px;flex-wrap:wrap">
    <button onclick="warehouseTab='all_pending';renderWarehouseList()" style="flex:1;padding:12px;border-radius:10px;background:${warehouseTab==='all_pending'?'#7c3aed;color:#fff':'#f3e8ff'}">لم يتم تركيبه - ${allStock.length}</button>
    <button onclick="warehouseTab='all_done';renderWarehouseList()" style="flex:1;padding:12px;border-radius:10px;background:${warehouseTab==='all_done'?'#7c3aed;color:#fff':'#f3e8ff'}">تم تركيبه - ${allDone.length}</button>
  </div>
  <button onclick="downloadWarehouseExcel()" style="width:calc(100% - 24px);margin:10px 12px;padding:12px;border-radius:10px;border:0;background:#111;color:#fff;font-weight:800">⬇️ تحميل شيت اكسيل</button>
  <input placeholder="دور برقم الأرضي أو السيريال أو اسم الفني..." value="${String(warehouseSearch).replace(/"/g,'&quot;')}" oninput="warehouseSearch=this.value;renderWarehouseList()" style="width:calc(100% - 24px);margin:10px 12px;padding:10px;border-radius:10px;border:1px solid #ccc">
  <div style="padding:0 12px">${listToShow.map(w=>`<div class="warehouseCard" style="border:1px solid #ddd;border-radius:12px;padding:10px;margin-bottom:8px">
    <b>${w.serial||''}</b> - ${w.model||''}<br>
    الفني: ${w.tech||''} | المحافظة: ${w.province||''}<br>
    ${warehouseTab==='all_done' ? `العميل: ${w.customer_name||''}<br>رقم العميل (أرضي): ${w.customer_phone||''}<br>تاريخ التركيب: ${w.date_install||''}` : `تاريخ الاستلام: ${w.date_received||''} - الحالة: لم يتم تركيبه`}
  </div>`).join('') || '<p style="text-align:center;opacity:.6">مفيش حاجة هنا</p>'}</div>`;
}
function downloadWarehouseExcel(){
  if(!allWarehouse.length) return alert("مفيش داتا في المخزن");
  let rows = allWarehouse.map(w=>({
    السيريال: w.serial||"",
    الفني: w.tech||"",
    الموديل: w.model||"",
    المحافظة: w.province||"",
    الحالة: (String(w.customer_phone||"").trim() || String(w.date_install||"").trim()) ? "تم تركيبه" : "لم يتم تركيبه",
    اسم_العميل: w.customer_name||"",
    رقم_العميل: w.customer_phone||"",
    تاريخ_الاستلام: w.date_received||"",
    تاريخ_التركيب: w.date_install||""
  }));
  let ws=XLSX.utils.json_to_sheet(rows);
  let wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "المخزن");
  XLSX.writeFile(wb, `المخزن-${todayStr()}.xlsx`);
}
 

   async function uploadWarehouseSheet(){
  let f=document.getElementById("warehouseInput").files[0];
  if(!f) return alert("اختار ملف المخزن الأول");
  if(!userObj.isAdmin) return alert("الأدمن بس اللي بيرفع المخزن");
  document.getElementById("warehouseUploadMsg").innerText="جاري القراءة - كل ورق المحافظات...";
  let buf=await f.arrayBuffer();
  let wb=XLSX.read(buf,{type:"array"});
  let fileProv = f.name.replace(/\.xlsx?|\.csv/gi,"").trim();
  let rowsMap = new Map();
  wb.SheetNames.forEach(sn=>{
    let ws=wb.Sheets[sn];
    let arr=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
    arr.forEach((r,i)=>{
      if(i===0) return;
      let serial=cleanSerial(r[2]);
      if(!serial) return;
      let prov = (/^sheet\d*$/i.test(sn) || sn==="Sheet1") ? fileProv : sn;
      rowsMap.set(serial, {
        sn:String(r[0]||""), date_received:parseSheetDate(r[1]), serial,
        date_install:parseSheetDate(r[3]), customer_phone:String(r[4]||"").trim(),
        model:String(r[5]||"").trim(), tech:String(r[6]||"").trim(), comment:String(r[7]||"").trim(),
        province:prov, status: String(r[3]||"").trim() ? "تم التسليم" : "في العهدة"
      });
    });
  });
  let rows=[...rowsMap.values()];
  if(!rows.length) return alert("مفيش سيريالات في الشيت ده");
  let serials = rows.map(r=>r.serial);
  let oldMap = new Map();
  for(let i=0;i<serials.length;i+=500){
    let {data:ex} = await supabaseClient.from(WAREHOUSE_TABLE).select("*").in("serial", serials.slice(i,i+500));
    (ex||[]).forEach(x=> oldMap.set(String(x.serial), x));
  }
  let finalRows = rows.map(r=>{
    let old = oldMap.get(r.serial);
    if(!old) return r;
    let oldTech = String(old.tech||"").trim();
    let newTech = String(r.tech||"").trim();
    let oldComment = String(old.comment||"").trim();
    let newComment = String(r.comment||"").trim();
    let history = oldComment;
    if(oldTech && newTech && oldTech !== newTech){
      let moveNote = `نقل من ${oldTech} إلى ${newTech} بتاريخ ${todayStr()}`;
      if(!history.includes(moveNote)) history = (history ? history + " | " : "") + moveNote;
    }
    if(newComment && !history.includes(newComment)){
      history = (history ? history + " | " : "") + newComment;
    }
    return {...r, comment: history};
  });
  document.getElementById("warehouseUploadMsg").innerText=`لقيت ${finalRows.length} سيريال - جاري الرفع...`;
  for(let i=0;i<finalRows.length;i+=500){
    let chunk = finalRows.slice(i, i+500);
    let {error} = await supabaseClient.from(WAREHOUSE_TABLE).upsert(chunk, {onConflict:'serial'});
    if(error){ alert("خطأ في الرفع: "+error.message); return; }
    document.getElementById("warehouseUploadMsg").innerText=`جاري... ${Math.min(i+500, finalRows.length)} من ${finalRows.length}`;
  }
  document.getElementById("warehouseUploadMsg").innerText=`تم ✅ ${finalRows.length} سيريال - العهدة اتحدثت من خانة الفني، والكومنت اتحفظ في قصة الجهاز`;
  loadWarehouse();
}

async function transferTechCustody(){
  let from = document.getElementById("custodyFromTech").value.trim();
  let to = document.getElementById("custodyToTech").value.trim();
  if(!from || !to) return alert("اكتب من فني وإلى فني");
  if(!confirm(`هننقل كل أجهزة ${from} إلى ${to} ؟`)) return;
  let {data} = await supabaseClient.from(WAREHOUSE_TABLE).select("*").eq("tech", from);
  if(!data || !data.length) return alert("مفيش أجهزة عند "+from);
  for(let w of data){
    let hist = (w.comment||"") + ` | نقل من ${from} إلى ${to} بتاريخ ${todayStr()}`;
    await supabaseClient.from(WAREHOUSE_TABLE).update({tech: to, comment: hist}).eq("id", w.id);
  }
  document.getElementById("custodyMsg").innerText = `تم ✅ نقل ${data.length} جهاز من ${from} إلى ${to}`;
  loadWarehouse();
}

async function clearTechCustody(){
  let from = document.getElementById("custodyFromTech").value.trim();
  if(!from) return alert("اكتب اسم الفني اللي هتمسح عهدته");
  if(!confirm(`همسح عهدة ${from} ؟ الأجهزة هترجع المخزن من غير فني`)) return;
  let {data} = await supabaseClient.from(WAREHOUSE_TABLE).select("*").eq("tech", from);
  if(!data || !data.length) return alert("مفيش أجهزة عند "+from);
  for(let w of data){
    let hist = (w.comment||"") + ` | اتمسحت عهدة ${from} بتاريخ ${todayStr()}`;
    await supabaseClient.from(WAREHOUSE_TABLE).update({tech: "", comment: hist}).eq("id", w.id);
  }
  document.getElementById("custodyMsg").innerText = `تم ✅ مسح عهدة ${from} - ${data.length} جهاز رجعوا المخزن`;
  loadWarehouse();
}
let allTechs = [];
let selectedTech = "";
function renderTechDropdown(filter=""){
  const dd = document.getElementById("techDropdown");
  const inp = document.getElementById("oneTechSearch");
  if(!dd || !inp) return;
  let list = (allTechs||[]).filter(t=>{
    let n = (t.name||t.username||"").toLowerCase();
    return n.includes(filter.toLowerCase());
  });
  if(list.length===0){
    dd.innerHTML = '<div style="padding:10px;color:#888">لا يوجد فني بهذا الاسم</div>';
  } else {
    dd.innerHTML = list.map(t=>{
      let n = t.name||t.username||"";
      return `<div onclick="selectOneTech('${n}')" ...`
    }).join("");
  }
  dd.style.display = "block";
}
    function selectOneTech(name){
  selectedTech = name;
  document.getElementById('oneTechSearch').value = name;
  document.getElementById('techDropdown').style.display = 'none';
  
}

async function loadTechsForSearch(){
  let all = [];
  let tables = ['users','technicians','profiles','techs'];
  for(let tbl of tables){
    try{
      let { data } = await supabaseClient.from(tbl).select('*');
      if(data && data.length>0){
        data.forEach(r=>{
          let n = r.name || r.username || r.full_name || r.tech_name || r.technician || "";
          if(n) all.push({name:n, username:n});
        });
        if(all.length>0) break;
      }
    }catch(e){}
  }
  if(all.length===0){
    document.querySelectorAll('select option').forEach(o=>{
      let v = (o.value||o.textContent||"").trim();
      if(v && v!=="-- اختر الفني --" && v!=="") all.push({name:v, username:v});
    });
  }
  let seen = {};
  allTechs = all.filter(t=>{ if(seen[t.name]) return false; seen[t.name]=1; return true; });
  const inp = document.getElementById("oneTechSearch");
  if(!inp) return;
  inp.addEventListener("focus", ()=> renderTechDropdown(inp.value));
  inp.addEventListener("input", ()=> renderTechDropdown(inp.value));
  inp.addEventListener("click", ()=> renderTechDropdown(inp.value));
  document.addEventListener("click", (e)=>{
    if(!e.target.closest("#oneTechSearch") && !e.target.closest("#techDropdown")){
      let dd = document.getElementById("techDropdown");
      if(dd) dd.style.display = "none";
    }
  });
}
async function addOneSerial(){
  let serialRaw = document.getElementById("oneSerial").value.trim();
  let serial = cleanSerial(serialRaw);
  let tech = document.getElementById("oneTechSearch").value.trim();
  if(!serial) return alert("اكتب السيريال الأول");
  if(!tech) return alert("اختار الفني من اللستة");
  let found = allTechs.find(t => t.username === tech || t.name === tech);
  let techName = found ? (found.username || found.name) : tech;
  let row = {
    sn: "",
    date_received: todayStr(),
    serial: serial,
    date_install: "",
    customer_phone: document.getElementById("onePhone").value.trim(),
    model: document.getElementById("oneModel").value.trim(),
    tech: techName,
    province: document.getElementById("oneGov").value.trim(),
    status: "في العهدة"
  };
  let { data: ex } = await supabaseClient.from(WAREHOUSE_TABLE).select("id").eq("serial", serial).maybeSingle();
  let res;
  if(ex) res = await supabaseClient.from(WAREHOUSE_TABLE).update(row).eq("serial", serial);
  else res = await supabaseClient.from(WAREHOUSE_TABLE).insert([row]);
  if(res.error) return alert("خطأ: " + res.error.message);
  document.getElementById("oneSerialMsg").innerText = "تم ✅ " + serial + " اتضاف لـ " + techName;
  document.getElementById("oneSerial").value = "";
  document.getElementById("oneTechSearch").value = "";
  loadWarehouse();
}
document.addEventListener("DOMContentLoaded", () => {
  loadTechsForSearch();
});
async function registerDeliveredInWarehouse(job, serial){
  if(!serial) return;
  let clean=cleanSerial(serial);
    let {data:ex}=await supabaseClient.from(WAREHOUSE_TABLE).select("*").eq("serial", clean).maybeSingle();
  let payload={
    serial:clean, model:job.device||ex?.model||"",
    tech: getJobTech(job)||ex?.tech||userObj.name,
    customer_phone: job.landline||job.mobile||ex?.customer_phone||"",
    customer_name: job.customer_name||ex?.customer_name||"",
    date_install: todayStr(), date_received: ex?.date_received||todayStr(),
    comment: (ex?.comment||"")+" | تم التسليم يوم "+todayStr()+" - أوردر "+(job.order||""),
    status:"تم التسليم", province: ex?.province||""
  };
  if(ex) await supabaseClient.from(WAREHOUSE_TABLE).update(payload).eq("id", ex.id);
  else await supabaseClient.from(WAREHOUSE_TABLE).insert(payload);
}
function loadJobs(){
  if(jobsRequest)return jobsRequest;
  jobsRequest=(async()=>{
  try {
   let data = await getAllJobs();
data.sort((a,b)=> new Date(b.created_at)-new Date(a.created_at));
  allJobs=data||[];
  renderJobs(); showLeftAlert(); window.MiskDashboard?.refresh("jobs");
  } catch(error) { window.MiskDashboard?.error("تعذر تحديث المهام — تحقق من الاتصال", "jobs"); }
  })().finally(()=>{jobsRequest=null;});
  return jobsRequest;
}
async function loadTechNames(){
  let {data}=await supabaseClient.from("technicians").select("username,name,role").order("name");
  cachedTechNames=(data||[]).filter(t=> getRoleFromDb(t)==="tech").map(t=>techDisplayName(t)).filter(n=> n);
  let sel=document.getElementById("a_tech");
  if(sel){sel.replaceChildren(new Option('اختر اسم الفني',''),...cachedTechNames.map(n=>new Option(n,n)));}
}
async function loadTechCount(){
  let {data}=await supabaseClient.from("technicians").select("username,name,role");
  let el=document.getElementById("techCount"); if(el) el.innerText=(data||[]).length;
  const list=document.getElementById('techList');
  if(list){list.replaceChildren();for(const t of data||[]){const button=document.createElement('button');button.type='button';button.className='tech-chip';button.textContent=techDisplayName(t)+' · '+getRoleFromDb(t);button.addEventListener('click',()=>openTechDetail(encodeURIComponent(techDisplayName(t))));list.append(button);}}
}
  async function openTechDetail(enc){
  let name=decodeURIComponent(enc);
  let wh=[], jobs=[];
  try{ let r=await supabaseClient.from("warehouse").select("*"); wh=r.data||[]; }catch(e){}
  try{ let r=await supabaseClient.from("jobs").select("*"); jobs=r.data||[]; }catch(e){}
  if(!wh.length){ try{ let r=await supabaseClient.from("inventory").select("*"); wh=r.data||[]; }catch(e){} }
   let inCustody = wh.filter(function(w){ return normTechKey(w.tech||w.technician||w.assigned_to||w.holder||w.custody||w.tech_name||"")===normTechKey(name); });
let myJobs = jobs.filter(function(j){ return normTechKey(getJobTech(j))===normTechKey(name); });
  let custodyHtml = "";
  if(inCustody.length){
    for(let i=0;i<inCustody.length;i++){
      let s = inCustody[i].serial || inCustody[i].serial_number || inCustody[i].code || "";
      custodyHtml += '<span style="background:#eef2ff;padding:4px 8px;border-radius:8px;font-size:12px;display:inline-block;margin:2px">'+s+'</span>';
    }
  } else { custodyHtml = '<span>مفيش أجهزة في العهدة</span>'; }
  let jobsHtml = "";
  if(myJobs.length){
    for(let i=0;i<Math.min(10, myJobs.length);i++){
      let j = myJobs[i];
      jobsHtml += '<div style="border-bottom:1px solid #eee;padding:6px 0;font-size:13px">'+(j.customer_name||j.customer||"")+' - '+(j.serial||"")+' - '+(j.status||"")+'</div>';
    }
  } else { jobsHtml = 'مفيش شغل مسجل'; }
  let old=document.getElementById("techDetailModal"); if(old) old.remove();
  let m=document.createElement("div"); m.id="techDetailModal";
  m.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:12px";
  m.innerHTML='<div style="background:#fff;width:100%;max-width:520px;max-height:85vh;overflow:auto;border-radius:14px;padding:16px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">👨‍🔧 '+name+'</h3><button onclick="document.getElementById(\'techDetailModal\').remove()" style="background:#ff4757;color:#fff;border:0;border-radius:8px;padding:6px 12px">X</button></div>'
    +'<p><b>في العهدة:</b> '+inCustody.length+' جهاز</p>'
    +'<p><b>شغل مسجل:</b> '+myJobs.length+' شغلانة</p>'
    +'<button onclick="showTechJobs(\''+enc+'\')" style="width:100%;background:#4f46e5;color:#fff;border:0;border-radius:10px;padding:10px;font-weight:700;margin:8px 0">عرض شغله في القايمة تحت 👇</button>'
    +'<h4>سيريالات في العهدة:</h4><div>'+custodyHtml+'</div>'
    +'<h4>آخر شغل:</h4><div>'+jobsHtml+'</div></div>';
  m.onclick=function(e){ if(e.target==m) m.remove(); };
  document.body.appendChild(m);
}

   async function showTechJobs(enc){
  let name=decodeURIComponent(enc);
  let old=document.getElementById("techDetailModal"); if(old) old.remove();
  window.techFilter = name;
  let list=document.getElementById("jobsList");
  if(!list) return;
  let r=await supabaseClient.from("jobs").select("*");
  let jobs=(r.data||[]).filter(function(j){ return normTechKey(getJobTech(j))===normTechKey(name); });
  let banner=document.getElementById("techFilterBanner"); if(banner) banner.remove();
  banner=document.createElement("div"); banner.id="techFilterBanner";
  banner.style.cssText="background:#eef2ff;border:1px solid #4f46e5;border-radius:10px;padding:10px;margin:10px 0;display:flex;justify-content:space-between;align-items:center";
    banner.innerHTML='<b>📋 شغل '+name+' - '+jobs.length+' شغلانة</b>'
+'<div style="display:flex;gap:8px;margin-top:8px">'
+'<button onclick="openTransferModal(\''+name.replace(/\'/g,"")+'\')" style="flex:1;background:#dc2626;color:#fff;border:none;padding:10px;border-radius:8px;font-weight:bold">🔀 نقل الشغل</button>'
+'<button onclick="clearTechFilter()" style="flex:1;background:#eee;border:none;padding:10px;border-radius:8px">❌ إلغاء الفلتر</button>'
+'</div>';
  list.parentNode.insertBefore(banner, list);
  let html="";
  if(jobs.length){
    for(let i=0;i<jobs.length;i++){
      let j=jobs[i];
     window._currentTechJobs = jobs;     
      html+='<div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:12px;margin-bottom:8px"><b>'+(j.customer_name||j.customer||"عميل")+'</b> - '+(j.serial||"")+'<br><span style="font-size:13px;color:#555">'+(j.status||"")+' | '+(j.governorate||j.address||"")+'</span></div>';
    }
  } else { html="<div>مفيش شغل مسجل للفني ده</div>"; }
  list.innerHTML=html;
    function addBtns(){
 list.querySelectorAll(":scope > div").forEach(function(card,idx){
  if(!jobs[idx]||card.querySelector(".jobCheck")) return;
  var cb=document.createElement("input");
  cb.type="checkbox"; cb.className="jobCheck"; cb.style.cssText="width:20px;height:20px;accent-color:#16a34a;cursor:pointer;position:relative;z-index:5";
  cb.dataset.jobId=jobs[idx].id;
  cb.onclick=function(e){ e.stopPropagation(); };
  card.prepend(cb);
  var b=document.createElement("button");
  b.textContent="نقل الأوردر"; b.className="transferBtn";
  b.style.cssText="display:block;width:100%;margin-top:8px;padding:8px;background:#2563eb;color:#fff;border:0;border-radius:8px;cursor:pointer;position:relative;z-index:5";
  b.onclick=function(e){
    e.stopPropagation(); e.preventDefault();
    window._currentTechJobs=[jobs[idx]];
    openTransferModal(getJobTech(jobs[idx]));
    setTimeout(function(){
      document.querySelectorAll("input[type=checkbox]").forEach(function(c){ if(c.offsetParent) c.checked=true; });
    },150);
  };
  card.appendChild(b);
 });
}
addBtns();
new MutationObserver(addBtns).observe(list,{childList:true,subtree:true});
  list.scrollIntoView({behavior:"smooth"});
}
    function openTransferModal(fromTech){
  let old=document.getElementById("transferModal"); if(old) old.remove();
   let list = window._currentTechJobs || [];
if(!list.length){ alert("مفيش أوردرات"); return; }
  let allTechs=(typeof cachedTechNames!=="undefined"&&cachedTechNames.length?[...cachedTechNames]:[...new Set((typeof allJobs!=="undefined"?allJobs:[]).map(j=>getJobTech(j))).filter(Boolean)]);
  if(!allTechs.length) allTechs=[fromTech];
   let techOptions=(allTechs.filter(t=>normTechKey(t)!==normTechKey(fromTech)).length?allTechs.filter(t=>normTechKey(t)!==normTechKey(fromTech)):allTechs)
    .map(t=>'<div onclick="selectTransferTech(this,\''+t.replace(/\'/g,"")+'\')" style="padding:12px;border-bottom:1px solid #eee;cursor:pointer">'+t+'</div>').join("");
    let jobsHtml=list.map(j=>{
  let title=(j.customer||j.name||j.title||"أوردر")+" - "+(j.landline||j.phone||j.tel||j.ارضي||j.id||"");
return '<label style="display:flex;gap:8px;align-items:center;padding:10px;border-bottom:1px solid #eee"><input type="checkbox" class="modal-transfer-check" data-jobid="'+j.id+'" style="width:20px;height:20px"> <span style="font-size:13px">'+title+'</span></label>';
}).join("");  
  let m=document.createElement("div"); m.id="transferModal";
  m.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:12px";
  m.innerHTML='<div style="background:#fff;width:100%;max-width:520px;max-height:85vh;overflow:auto;border-radius:14px;padding:16px">'
     +'<h3 style="margin:0">🔀 نقل الشغل من '+fromTech+'</h3>'
     +'<label style="display:flex;gap:8px;align-items:center;background:#fef2f2;padding:10px;border-radius:8px;margin-top:10px"><input type="checkbox" onchange="toggleAllTransfer(this.checked)" style="width:20px;height:20px"> <b>تحديد الكل ('+list.length+' أوردر)</b></label>'
+'<div style="border:1px solid #ddd;border-radius:10px;max-height:200px;overflow:auto;margin-top:10px">'+jobsHtml+'</div>'
  +'<div style="margin:14px 0"><b>انقل لـ:</b><div id="transferTechList" style="border:1px solid #ddd;border-radius:10px;max-height:180px;overflow:auto;margin-top:6px">'+techOptions+'</div><p id="selectedTransferTech" style="color:#dc2626;font-weight:bold"></p></div>'
  +'<div style="display:flex;gap:8px"><button onclick="doTransferJobs(\''+fromTech.replace(/\'/g,"")+'\')" style="flex:1;background:#dc2626;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:bold">نقل المحدد</button>'
  +'<button onclick="document.getElementById(\'transferModal\').remove()" style="flex:1;background:#eee;border:none;padding:12px;border-radius:10px">إلغاء</button></div></div>';
  m.onclick=function(e){ if(e.target===m) m.remove(); };
  document.body.appendChild(m);
  window._transferTo="";
}
function selectTransferTech(el,tech){
  window._transferTo=tech;
  document.querySelectorAll("#transferTechList div").forEach(d=>d.style.background="#fff");
  el.style.background="#fee2e2";
  document.getElementById("selectedTransferTech").textContent="هتنقل لـ: "+tech;
}
function toggleAllTransfer(checked){
  document.querySelectorAll(".modal-transfer-check").forEach(c=>c.checked=checked);
}
 async function doTransferJobs(fromTech){
  let selected=[...document.querySelectorAll(".modal-transfer-check:checked")].map(c=>c.dataset.jobid);
  if(!selected.length){ alert("علّم على أوردر واحد على الأقل"); return; }
  if(!window._transferTo){ alert("اختر الفني اللي هتنقله الأول"); return; }
  if(!confirm("هنقل "+selected.length+" أوردر من "+fromTech+" لـ "+window._transferTo+" ؟")) return;
  for(let i=0;i<selected.length;i+=100){
    let chunk=selected.slice(i,i+100);
    let {error}=await supabaseClient.from("jobs").update({tech:window._transferTo}).in("id",chunk);
    if(error){ alert("حصل خطأ في النقل: "+error.message); return; }
  }
  alert("تم النقل ✅");
  document.getElementById("transferModal").remove();
  showTechJobs(encodeURIComponent(fromTech));
}
  
function clearTechFilter(){
  window.techFilter=null;
  let b=document.getElementById("techFilterBanner"); if(b) b.remove();
  if(typeof renderJobs==="function") renderJobs();
}

function renderJobs(){
  let list=document.getElementById("jobsList"); if(!list) return;
  let mine=myJobsBase();
  let jobs=[...mine];
    if(window.techFilter){ jobs=jobs.filter(function(j){ return normTechKey(getJobTech(j))===normTechKey(window.techFilter); }); }
  if(activeFilter==="done") jobs=jobs.filter(j=>j.status==="تم التسليم");
  if(activeFilter==="pending") jobs=jobs.filter(j=>j.status!=="تم التسليم" && !["تأجيل","لم يتم الرد","رفض الزيارة"].includes(j.status));
  if(activeFilter==="problem") jobs=jobs.filter(j=>["تأجيل","لم يتم الرد","رفض الزيارة"].includes(j.status));
  if(searchQ) jobs=jobs.filter(j=> (j.customer_name+" "+j.serial+" "+j.order+" "+j.landline+" "+(j.code||"")).toLowerCase().includes(searchQ.toLowerCase()));
  document.getElementById("cDone").innerText=mine.filter(j=>j.status==="تم التسليم").length;
  document.getElementById("cPending").innerText=mine.filter(j=>j.status!=="تم التسليم" && !["تأجيل","لم يتم الرد","رفض الزيارة"].includes(j.status)).length;
  document.getElementById("cProblem").innerText=mine.filter(j=>["تأجيل","لم يتم الرد","رفض الزيارة"].includes(j.status)).length;
  let show=jobs.slice(0, visibleCount);
  list.replaceChildren();
  for(const j of show){
    const card=document.createElement('article');card.className='job';
    const button=document.createElement('button');button.type='button';button.className='job-open';
    button.textContent=`${j.customer_name||'عميل غير محدد'} · ${j.order||'—'}`;button.addEventListener('click',()=>openDetails(j.id));card.append(button);
    const meta=document.createElement('div');meta.className='meta';
    meta.textContent=`الكود: ${j.code||'—'}\nالعنوان: ${j.address||'—'}\nالأرضي: ${j.landline||'—'} | الموبايل: ${j.mobile||'—'}\nالفني: ${getJobTech(j)||'غير مسند'} | الجهاز: ${j.device||'—'}\nالسيريال: ${j.serial||'غير مسجل'}\n${j.comment||''}`;
    card.append(meta);const badge=document.createElement('span');badge.className='badge';badge.textContent=j.status||'جديد';card.append(badge);list.append(card);
  }
  if(!show.length){const message=document.createElement('p');message.className='empty-state';message.textContent='لا توجد مهام مطابقة';list.append(message);}
  document.getElementById("loadMoreWrap").innerHTML= jobs.length>visibleCount ? `<button class="btn" onclick="visibleCount+=20;renderJobs()">عرض المزيد (${jobs.length-visibleCount} باقي)</button>` : "";
}
function onSearch(){ searchQ=document.getElementById("searchInput").value; renderJobs() }
function filterByCircle(f){ activeFilter=f; visibleCount=10; renderJobs() }
function showTab(tab, el){
  activeTab=tab;
  document.querySelectorAll(".tabs div").forEach(d=>d.classList.remove("active"));
  if(el) el.classList.add("active");
  document.getElementById("jobsList").classList.toggle("hidden", tab==="warehouse");
  document.getElementById("warehouseList").classList.toggle("hidden", tab!=="warehouse");
  document.getElementById("archiveFilter").classList.toggle("hidden", tab!=="archive");
  if(tab==="all") activeFilter="all";
  if(tab==="pending") activeFilter="pending";
  if(tab==="problem") activeFilter="problem";
  if(tab==="warehouse") renderWarehouseList();
  if(tab!=="warehouse") renderJobs();
     if(tab=="archive"){ loadArchive(); }
}
function showLeftAlert(){
  let box=document.getElementById("leftTechAlerts"); if(!box) return;
  box.innerHTML="";
}
function openDetails(id){
  let j=allJobs.find(x=>String(x.id)===String(id)); if(!j) return;
  currentDetailId=j.id;
  document.getElementById("details").style.display="block";
  document.getElementById("dTitle").innerText=j.customer_name||"";
  document.getElementById("dCustomer").innerText=j.customer_name||"";
  document.getElementById("dMeta").textContent=`العنوان: ${j.address||""}\nالأوردر: ${j.order||""}\nالأرضي: ${j.landline||""}\nالموبايل: ${j.mobile||""}\nالفني: ${getJobTech(j)||""}\nالجهاز: ${j.device||""}\nالحالة: ${j.status||""}`;
  document.getElementById("dComment").innerText=j.comment||"";
  document.getElementById("dSerial").value=j.serial||"";
  renderPhotos(j);
  document.getElementById("dUpDownBtn").innerText=j.up_down ? `⬆️ Up / ⬇️ Down: ${j.up_down} ✅` : "⬆️ Up / ⬇️ Down *";
  document.getElementById("dRecipientBtn").innerText=j.recipient ? `👤 المستلم: ${j.recipient} ✅` : "👤 المستلم *";
}
function closeDetails(){ document.getElementById("details").style.display="none" }
function renderPhotos(j){
  let box=document.getElementById("dPhotos");
  let slots=["وش الجهاز","ضهر الجهاز","الايصال والبطاقة"];
  box.replaceChildren();
  slots.forEach((label,i)=>{
    const button=document.createElement('button');button.type='button';button.className='imgbox';button.setAttribute('aria-label',label);
    const url=String(j['photo'+(i+1)]||'');
    if(/^https?:\/\//i.test(url)){const img=document.createElement('img');img.src=url;img.className='photoThumb';img.alt=label;img.loading='lazy';button.append(img);button.addEventListener('click',()=>showPhoto(url));}
    else{button.textContent='إضافة صورة: '+label;button.addEventListener('click',()=>openPhotoCam(i));}
    box.append(button);
  });
}
function showPhoto(url){ document.getElementById("photoModalImg").src=url; document.getElementById("photoModal").style.display="flex"; photoRot=0 }
function rotatePhotoModal(){ photoRot=(photoRot+90)%360; document.getElementById("photoModalImg").style.transform=`rotate(${photoRot}deg)` }
function openPhotoCam(i){ currentPhotoSlot=i; document.getElementById("photoCamTitle").innerText="📷 صور "+["وش الجهاز","ضهر الجهاز","الايصال والبطاقة"][i]; document.getElementById("photoCamModal").style.display="flex" }
function closePhotoCam(){ document.getElementById("photoCamModal").style.display="none" }
function capturePhoto(){ document.getElementById("photoInput").click() }
function openPhotoFile(){ document.getElementById("photoGalleryInput").click() }
function openUpDownOnly(id, cust){ currentUpDownJobId=id; document.getElementById("upDownCustomer").innerText=cust; document.getElementById("upDownModal").style.display="flex" }
function closeUpDown(){ document.getElementById("upDownModal").style.display="none" }
function chooseUpDown(v){ upDownMap[currentUpDownJobId]=v; document.getElementById("upDownModal").style.display="none"; let j=allJobs.find(x=>String(x.id)===String(currentUpDownJobId)); if(j) j.up_down=v; document.getElementById("dUpDownBtn").innerText=`⬆️ Up / ⬇️ Down: ${v} ✅`; alert("تم تسجيل: "+v) }
function openRecipientOnly(id, cust){ currentRecipientJobId=id; document.getElementById("recipientCustomer").innerText=cust; document.getElementById("recipientModal").style.display="flex" }
function chooseRecipient(v){
  if(v==="الرجوع"){ document.getElementById("recipientModal").style.display="none"; return }
  recipientMap[currentRecipientJobId]=v; document.getElementById("recipientModal").style.display="none";
  let j=allJobs.find(x=>String(x.id)===String(currentRecipientJobId)); if(j) j.recipient=v;
  document.getElementById("dRecipientBtn").innerText=`👤 المستلم: ${v} ✅`; alert("المستلم: "+v);
}
function clearRecipientChoice(){ delete recipientMap[currentRecipientJobId]; document.getElementById("recipientModal").style.display="none"; document.getElementById("dRecipientBtn").innerText="👤 المستلم *"; alert("تم مسح المستلم") }
function openStatusModal(id, cust){
  currentStatusJobId=id; currentStatusCustomer=cust;
  document.getElementById("statusCustomer").innerText=cust;
  document.getElementById("selectedStatusLabel").innerText="";
  document.getElementById("statusComment").value="";
  document.getElementById("statusModal").style.display="flex";
}
function closeStatusModal(){ document.getElementById("statusModal").style.display="none" }
function selectStatusOption(s){ document.getElementById("selectedStatusLabel").innerText="المختار: "+s; document.getElementById("selectedStatusLabel").dataset.val=s }
async function confirmStatus(){
  let st=document.getElementById("selectedStatusLabel").dataset.val;
  let cm=document.getElementById("statusComment").value.trim();
  if(!st) return alert("اختار الحالة الأول");
  let j=allJobs.find(x=>String(x.id)===String(currentStatusJobId)); if(!j) return;
  let {error}=await supabaseClient.from(TABLE).update({status:st, comment:cm}).eq("id", j.id);
  if(error) return alert("خطأ: "+error.message);
  j.status=st; j.comment=cm;
  closeStatusModal(); closeDetails(); renderJobs();
  alert("تم حفظ الحالة: "+st);
}
async function isSerialInWarehouse(serial){
  serial = String(serial || '').trim();
  if(!serial) return false;
  if(Array.isArray(allWarehouse) && allWarehouse.length){
    const found = allWarehouse.some(w => String(w.serial || w.Serial || w.code || '').trim() === serial);
    if(found) return true;
  }
  const { data } = await supabaseClient.from(WAREHOUSE_TABLE).select('serial').eq('serial', serial).maybeSingle();
  return !!data;
}
  async function saveSerial(id){
  let j=allJobs.find(x=>String(x.id)===String(id)); if(!j) return;
  let serial=cleanSerial(document.getElementById("dSerial").value);
  if(!serial) return alert("اكتب السيريال الأول");
    if(!(await isSerialInWarehouse(serial))) return alert("السيريال ده مش موجود في المخزن! راجع السيريال");
  let up=j.up_down||upDownMap[id];
  let rec=j.recipient||recipientMap[id];
  if(!up) return alert("اختار Up / Down الأول");
  if(!rec) return alert("اختار المستلم الأول");
  if(!j.photo1) return alert("📷 صور وش الجهاز الأول - اجباري");
  if(!j.photo2) return alert("📷 صور ضهر الجهاز الأول - اجباري");
  if(!j.photo3) return alert("📷 صور الايصال والبطاقة الأول - اجباري");
  let payload={serial, up_down:up, recipient:rec, status:"تم التسليم"};
  let r1=await supabaseClient.from(TABLE).update({...payload, delivered_at:new Date().toISOString(), delivered_date:todayStr()}).eq("id", id);
  if(r1.error){
    let r2=await supabaseClient.from(TABLE).update(payload).eq("id", id);
    if(r2.error) return alert("خطأ في الحفظ: "+r2.error.message);
  }
  Object.assign(j, payload);
  await registerDeliveredInWarehouse(j, serial);
  await loadWarehouse();
  closeDetails(); renderJobs();
  let txt="تم التسليم ✅ - السيريال: "+serial+" - العميل: "+(j.customer_name||j.customer||"")+" - بتاريخ "+todayStr();
  let phone=getFollowerPhone();
  let msgAfter="✅ تم التسليم - اتسجل في المخزن عند الأدمن بالسيريال "+serial+" وتاريخ "+todayStr()+" واتشال من عهدتك";
  let shown=false;
  let showMsg=function(){ if(shown) return; shown=true; alert(msgAfter); };
  if(!phone){ alert(txt); } else {
    let clean=phone.replace(/\D/g,"");
    if(clean.startsWith("0")) clean="20"+clean.slice(1);
    if(clean.length===10) clean="20"+clean;
    window.open("https://wa.me/"+clean+"?text="+encodeURIComponent(txt),"_blank");
    document.addEventListener("visibilitychange", function h(){ if(!document.hidden){ document.removeEventListener("visibilitychange", h); showMsg(); } });
    setTimeout(showMsg, 10000);
  }
}
async function addJob(){
  if(!userObj.isAdmin) return alert("الأدمن بس");
  let techVal=getVal("a_tech");
  let payload={
    customer_name:getVal("a_customer"),
    landline:getVal("a_landline"),
    mobile:getVal("a_mobile"),
    code:getVal("a_code"),
    address:getVal("a_address"),
    order:getVal("a_order"),
    device:getVal("a_device"),
    tech:techVal,
    tech_name:techVal,
    status:"جديد", date:todayStr()
  };
  if(!payload.customer_name||!payload.tech) return alert("اكتب اسم العميل واختار الفني");
  if(!payload.order) return alert("اكتب رقم الأوردر");
  let r = await insertJobSafe(payload);
  if(r.error){
    let payload2 = {
      customer_name: payload.customer_name,
      address: payload.address,
      order: payload.order,
      landline: payload.landline,
      device: payload.device,
      tech: payload.tech,
      tech_name: payload.tech,
      status:"جديد", date:todayStr(),
      comment: "موبايل: "+payload.mobile+" | كود: "+payload.code
    };
    let r2 = await insertJobSafe(payload2);
    if(r2.error){ alert("مش اتحفظ، السبب: "+r2.error.message); return; }
  }
  alert("تمت الإضافة ✅ - هتلاقيه في قيد الانتظار");
  ["a_customer","a_landline","a_mobile","a_code","a_address","a_order"].forEach(id=>{ let e=document.getElementById(id); if(e) e.value=""; });
  activeFilter="pending"; visibleCount=10;
  await loadJobs();
  showTab('pending', document.querySelectorAll(".tabs div")[1]);
}
async function uploadSheetFast(){
  let files=document.getElementById("sheetInput").files;
  if(!files.length) return alert("اختار ملف الأول");
  autoOn = false;
  let btnAuto = document.getElementById("autoBtn");
  if(btnAuto){ btnAuto.textContent="تشغيل"; btnAuto.style.background="#dcfce7"; btnAuto.style.color="#166534"; }
  document.getElementById("uploadMsg").innerText="جاري الرفع...";
  let prog = document.getElementById("prog");
  let progBar = document.getElementById("progBar");
  if(prog) prog.style.display="block";
  let total=0, skipped=0;
  try{
    for(let f of files){
      let buf=await f.arrayBuffer();
      let wb=XLSX.read(buf,{type:"array"});
      let ws = wb.Sheets["Sheet1"] || wb.Sheets[wb.SheetNames[0]];
      let arr = XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
      let toInsert=[];
      for(let i=1;i<arr.length;i++){
        let r=arr[i];
        let customer=String(r[3]||"").trim();
        let order=String(r[1]||"").trim();
        if(!customer || !order) continue;
        if(customer==="Name") continue;
        let techVal=String(r[16]||"").trim();
        let techPhone=String(r[17]||"").trim();
        toInsert.push({
          customer_name: customer,
          address: String(r[10]||""),
          order: order,
          landline: order,
          mobile: String(r[2]||""),
          device: String(r[4]||""),
          code: String(r[7]||""),
          tech: techVal,
          tech_name: techVal,
          tech_phone: techPhone,
          status: "جديد",
          date: todayStr(),
          comment: String(r[14]||""),
          serial: String(r[13]||"")
        });
      }
      if(toInsert.length){
        let orders = [...new Set(toInsert.map(x=>x.order))];
        let exSet = new Set();
        for(let i=0;i<orders.length;i+=500){
          let chunkOrders = orders.slice(i, i+500);
          let {data:ex} = await supabaseClient.from(TABLE).select("order").in("order", chunkOrders);
          (ex||[]).forEach(x=> exSet.add(String(x.order)));
        }
        let filtered=[];
        for(let x of toInsert){ if(exSet.has(String(x.order))) skipped++; else filtered.push(x); }
        toInsert=filtered;
      }
      for(let i=0;i<toInsert.length;i+=500){
        let chunk = toInsert.slice(i, i+500);
        let {error} = await supabaseClient.from(TABLE).insert(chunk);
        if(error){
          let chunk2 = chunk.map(({tech_name, tech_phone, ...rest})=>rest);
          let r2 = await supabaseClient.from(TABLE).insert(chunk2);
          if(r2.error){
            let chunk3 = chunk.map(({tech, ...rest})=>rest);
            let r3 = await supabaseClient.from(TABLE).insert(chunk3);
            if(!r3.error) total+=chunk3.length;
            else { alert("خطأ: "+r3.error.message); console.log(r3.error); }
          } else total+=chunk2.length;
        } else total+=chunk.length;
        if(progBar) progBar.style.width = Math.round(((i+chunk.length)/Math.max(1,toInsert.length))*100)+"%";
        document.getElementById("uploadMsg").innerText=`جاري... تم رفع ${total} - ملف ${f.name}`;
      }
    }
  }catch(e){ alert("خطأ في الرفع: "+e.message); console.log(e); }
  if(prog) prog.style.display="none";
  if(progBar) progBar.style.width="0%";
  document.getElementById("uploadMsg").innerText=`تم رفع ${total} أوردر - وتخطينا ${skipped} مكرر ✅`;
  autoOn = true;
  if(btnAuto){ btnAuto.textContent="إيقاف"; btnAuto.style.background="#fee2e2"; btnAuto.style.color="#dc2626"; }
  loadJobs();
}
async function loadArchive(){
  let {data}=await supabaseClient.from(ARCHIVE_TABLE).select("*").order("created_at",{ascending:false}).limit(50000);
  archivedJobs=data||[];
  let sel=document.getElementById("archiveDate");
  if(sel){
    let dates=[...new Set(archivedJobs.map(a=>a.archive_date||fmtDate(a.created_at)))];
    sel.innerHTML=`<option value="">كل الأيام</option>`+dates.map(d=>`<option value="${d}">${d}</option>`).join("");
  }
    renderArchive();
}
async function archiveOldJobs(){
  if(!userObj.isAdmin) return alert("الأدمن بس");
  let date = document.getElementById("manualArchiveDate").value.trim() || todayStr();
  if(!allJobs.length) return alert("مفيش شغل عشان يترشف");
  if(!confirm("هترشف كل الشغل اللي موجود دلوقتي ؟\nالعدد: " + allJobs.length + "\nوهيتنقل لأرشيف يوم " + date + " وهيتمسح من اليومي")) return;
  let {data: ex} = await supabaseClient.from(ARCHIVE_TABLE).select("order").eq("archive_date", date).limit(10000);
  let exSet = new Set((ex||[]).map(x => String(x.order)));
  let toArchive = allJobs.filter(j => !exSet.has(String(j.order)));
  if(!toArchive.length) return alert("الشغل ده مترشف قبل كده اصلا");
  let rows = toArchive.map(j => ({
    customer_name: j.customer_name, address: j.address, order: j.order,
    landline: j.landline, mobile: j.mobile, code: j.code,
    device: j.device, tech: getJobTech(j), tech_name: getJobTech(j),
    status: j.status, serial: j.serial||"", comment: j.comment||"",
    date: j.date||date, archive_date: date,
        recipient: j.recipient||"", up_down: j.up_down||"", photo1: j.photo1||"", photo2: j.photo2||"", photo3: j.photo3||"", delivered_at: j.delivered_at||"", delivered_date: j.delivered_date||""
  }));
  for(let i=0;i<rows.length;i+=500){
    let chunk = rows.slice(i, i+500);
    let {error} = await supabaseClient.from(ARCHIVE_TABLE).insert(chunk);
    if(error){
      let chunk2 = chunk.map(({tech_name, ...rest}) => rest);
      let r2 = await supabaseClient.from(ARCHIVE_TABLE).insert(chunk2);
      if(r2.error){ alert("خطأ في الأرشفة: " + r2.error.message); return; }
    }
  }
  let ids = toArchive.map(j => j.id);
  for(let i=0;i<ids.length;i+=500){
    await supabaseClient.from(TABLE).delete().in("id", ids.slice(i, i+500));
  }
  alert("تمام ✅ اترشف " + toArchive.length + " أوردر ليوم " + date + " - واليومي بقى فاضي");
  await loadJobs();
  await loadArchive();

}
  function getArchiveRows(date){
  date = date || document.getElementById("archiveDate").value || todayStr();
  let all = (typeof archivedJobs !== "undefined" && archivedJobs.length) ? archivedJobs : (typeof jobs !== "undefined" ? jobs : []);
  return all.filter(a => (a.archive_date || fmtDate(a.created_at)) === date);
}

function renderArchive(){
  let sel = document.getElementById("archiveDate");
  if(!sel) return;
  let all = (typeof archivedJobs !== "undefined" && archivedJobs.length) ? archivedJobs : (typeof jobs !== "undefined" ? jobs : []);
  // املى قايمة التواريخ
  let dates = [...new Set(all.map(a => a.archive_date || fmtDate(a.created_at)).filter(Boolean))].sort().reverse();
  let cur = sel.value;
  sel.innerHTML = `<option value="">كل الأيام</option>` + dates.map(d => `<option value="${d}" ${d===cur?"selected":""}>${d}</option>`).join("");

  let date = cur || todayStr();
  let rows = getArchiveRows(date);

  let done = rows.filter(r => r.status === "تم التسليم").length;
  let updated = rows.filter(r => r.comment && r.comment.trim() !== "" && r.status !== "تم التسليم").length;
  let empty = rows.filter(r => !r.serial || r.serial === "لسه" || !r.status || r.status === "جديد").length;

  if(document.getElementById("aDone")) document.getElementById("aDone").innerText = done;
  if(document.getElementById("aUpdated")) document.getElementById("aUpdated").innerText = updated;
  if(document.getElementById("aEmpty")) document.getElementById("aEmpty").innerText = empty;
  if(document.getElementById("archiveSummary")) document.getElementById("archiveSummary").innerText = `اليوم ${date} - الاجمالي: ${rows.length} | تم: ${done} | ابديت: ${updated} | فاضي: ${empty}`;
    if(document.getElementById("archiveSheetsList")) document.getElementById("archiveSheetsList").innerHTML = rows.length ? rows.map((r,idx) => `<div style="font-size:13px;padding:8px;border-bottom:1px solid #eee">👤 ${r.customer_name||""} - ${r.order||""} | ${r.status||"جديد"} | ${r.serial||"لسه"}<div style="display:flex;gap:6px;margin-top:6px">${[r.photo1,r.photo2,r.photo3].filter(Boolean).map(p=>`<img src="${p}" onclick="window.open('${p}','_blank')" style="width:70px;height:70px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid #ddd">`).join("")}</div><button onclick="shareArchiveTicket(${idx})" style="margin-top:6px;background:#25D366;color:#fff;border:0;padding:6px 12px;border-radius:8px;cursor:pointer">📤 شير التيكت بالصور</button></div>`).join("") : `<p style="text-align:center;color:#999">مفيش شغل في اليوم ده</p>`;
}
  async function shareArchiveTicket(idx){
  let date = document.getElementById("archiveDate").value || todayStr();
  let rows = getArchiveRows(date);
  let r = rows[idx]; if(!r) return;
  let txt = `📋 تيكت - ${r.customer_name||""}\nالأوردر: ${r.order||""}\nالأرضي: ${r.landline||""}\nالموبايل: ${r.mobile||""}\nالفني: ${getJobTech(r)}\nالسيريال: ${r.serial||"لسه"}\nالحالة: ${r.status||"جديد"}\nالكومنت: ${r.comment||""}\nالتاريخ: ${r.archive_date||""}\n\nالصور:\n${[r.photo1,r.photo2,r.photo3].filter(Boolean).join("\n")}`;
  let photos = [r.photo1,r.photo2,r.photo3].filter(Boolean);
  try{
    if(navigator.share && photos.length){
      let files = [];
      for(let u of photos){
        try{ let res = await fetch(u); let blob = await res.blob(); files.push(new File([blob], "photo.jpg", {type: blob.type||"image/jpeg"})); }catch(e){}
      }
      if(files.length && navigator.canShare && navigator.canShare({files})){
        await navigator.share({title: "تيكت "+r.order, text: txt, files});
        return;
      }
    }
    if(navigator.share){ await navigator.share({title: "تيكت "+r.order, text: txt}); return; }
  }catch(e){}
  try{ await navigator.clipboard.writeText(txt); alert("اتنسخ التيكت بالصور ✅ - الصقه في الواتساب"); }
  catch(e){ prompt("انسخ التيكت:", txt); }
}

function exportArchive(mode){
  let date = document.getElementById("archiveDate").value || todayStr();
  let rows = getArchiveRows(date);
  if(!rows.length) return alert("مفيش أرشيف لليوم ده");

  if(!mode){
    let choice = prompt("هتحمل ايه من يوم " + date + " ؟\n1 = الكل\n2 = تم التسليم بس\n3 = عليه ابديت بس\n4 = فاضي بس", "1");
    if(choice === "2") mode = "done";
    else if(choice === "3") mode = "updated";
    else if(choice === "4") mode = "empty";
    else mode = "all";
  }

  if(mode === "done") rows = rows.filter(r => r.status === "تم التسليم");
  if(mode === "updated") rows = rows.filter(r => r.comment && r.comment.trim() !== "" && r.status !== "تم التسليم");
  if(mode === "empty") rows = rows.filter(r => !r.serial || r.serial === "لسه" || !r.status || r.status === "جديد");

  if(!rows.length) return alert("مفيش شغل بالنوع ده في اليوم ده");

  let ws = XLSX.utils.json_to_sheet(rows.map(r => ({العميل:r.customer_name, الأوردر:r.order, الأرضي:r.landline, الموبايل:r.mobile, الفني:getJobTech(r), السيريال:r.serial, الحالة:r.status, الكومنت:r.comment, التاريخ:(r.archive_date||fmtDate(r.created_at))})));
  let wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "ارشيف");
  XLSX.writeFile(wb, `ارشيف-${date}-${mode}.xlsx`);
}
async function downloadEndOfDay(){
  if(!userObj.isAdmin) return alert("الأدمن بس");
  let date=todayStr();
  let done=allJobs.filter(j=>j.status==="تم التسليم");
  let updated=allJobs.filter(j=>["تأجيل","لم يتم الرد","رفض الزيارة"].includes(j.status) || (j.comment||"").trim()!=="");
  if(!done.length && !updated.length) return alert("مفيش شغل النهاردة عشان ينزل");
  let zip=new JSZip();
  let folder=zip.folder("انهاء-اليوم-"+date);
  let ws1=XLSX.utils.json_to_sheet(done.map(r=>({العميل:r.customer_name, الأوردر:r.order, الأرضي:r.landline, الموبايل:r.mobile, الفني:getJobTech(r), السيريال:r.serial, الجهاز:r.device, تاريخ_القفل:r.delivered_date||date, المستلم:r.recipient, Up_Down:r.up_down})));
  let wb1=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb1, ws1, "تم التسليم");
  let wb1Bin=XLSX.write(wb1,{bookType:"xlsx", type:"array"});
  folder.file(`تم-التسليم-${date}.xlsx`, wb1Bin);
  let ws2=XLSX.utils.json_to_sheet(updated.map(r=>({العميل:r.customer_name, الأوردر:r.order, الأرضي:r.landline, الفني:getJobTech(r), الحالة:r.status, الكومنت:r.comment, السيريال:r.serial||""})));
  let wb2=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb2, ws2, "تأجيل-ابدیت");
  let wb2Bin=XLSX.write(wb2,{bookType:"xlsx", type:"array"});
  folder.file(`تأجيل-ابدیت-${date}.xlsx`, wb2Bin);
  let blob=await zip.generateAsync({type:"blob"});
  let a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`انهاء-اليوم-${date}.zip`; a.click();
  alert(`✅ نزل فولدر ${date} جواه شيتين:\n1. تم التسليم (${done.length})\n2. تأجيل / أبديت (${updated.length})\nعلى اللاب توب`);
}
async function deleteOneJob(){
  if(!userObj.isAdmin) return alert("الأدمن بس");
  let order=document.getElementById("delOrderId").value.trim();
  if(!order) return alert("اكتب رقم الأوردر");
  if(!confirm("متأكد تمسح الأوردر رقم "+order+"؟")) return;
  let {data}=await supabaseClient.from(TABLE).select("id").eq("order", order);
  if(!data || !data.length) return alert("رقم الأوردر ده مش موجود");
  for(let r of data) await supabaseClient.from(TABLE).delete().eq("id", r.id);
  alert("تم مسح الأوردر رقم "+order); loadJobs();
}
async function deleteLandlineOnly(){
  if(!userObj.isAdmin) return alert("الأدمن بس");
  let order=document.getElementById("delOrderId").value.trim();
  if(!order) return alert("اكتب رقم الأوردر");
  if(!confirm("تمسح الرقم الأرضي بس من الأوردر رقم "+order+"؟")) return;
  await supabaseClient.from(TABLE).update({landline:""}).eq("order", order);
  alert("تم مسح الرقم الأرضي بس من الأوردر "+order); loadJobs();
}
async function deleteTableAll(tableName){
  let totalDeleted = 0;
  for(let round=0; round<20; round++){
    let {data, error} = await supabaseClient.from(tableName).select("id").limit(1000);
    if(error) throw error;
    if(!data || !data.length) break;
    let ids = data.map(x=>x.id);
    let {error: delErr} = await supabaseClient.from(tableName).delete().in("id", ids);
    if(delErr) throw delErr;
    totalDeleted += ids.length;
    if(ids.length < 1000) break;
  }
  return totalDeleted;
}
async function deleteAllDataSuper(){
  if(!userObj || !userObj.isSuper) return alert("Super Admin بس");
  if(!confirm("متأكد تمسح كل حاجة؟ كل الشغل + الأرشيف + المخزن هيتمسح")) return;
  if(!confirm("تأكيد أخير - مفيش رجوع - امسح كل حاجة؟")) return;
  try{
    await deleteTableAll(TABLE);
    await deleteTableAll(ARCHIVE_TABLE);
    await deleteTableAll(WAREHOUSE_TABLE);
  }catch(e){
    return alert("خطأ في مسح كل حاجة: "+e.message+" - اتأكد ان صلاحية Delete مفتوحة في Supabase للـ 3 جداول");
  }
  allJobs=[]; archivedJobs=[]; allWarehouse=[];
  renderJobs(); renderWarehouse();
  alert("تم مسح كل حاجة ✅ - الشغل والأرشيف والمخزن بقوا فاضيين");
}
function saveFollowerPhone(){
  let v=document.getElementById("followerPhone").value.trim();
  try{ localStorage.setItem("misk_follower_"+todayStr(), v); }catch(e){}
  try{ localStorage.setItem("misk_follower_phone", v); }catch(e){}
  document.getElementById("followerMsg").innerText=v ? "✅ اتحفظ رقم المتابع: "+v : "";
}
function clearFollowerPhone(){
  try{ localStorage.removeItem("misk_follower_"+todayStr()); }catch(e){}
  try{ localStorage.removeItem("misk_follower_phone"); }catch(e){}
  document.getElementById("followerPhone").value="";
  document.getElementById("followerMsg").innerText="تم مسح رقم المتابع";
}
function getFollowerPhone(){
  try{
    return localStorage.getItem("misk_follower_"+todayStr()) || localStorage.getItem("misk_follower_phone") || "";
  }catch(e){ return ""; }
}
function loadFollowerPhone(){
  let v = getFollowerPhone();
  let el = document.getElementById("followerPhone");
  if(el && v){
    el.value = v;
    document.getElementById("followerMsg").innerText = "✅ اتحفظ رقم المتابع: " + v;
  }
}
loadFollowerPhone();
function doAttendance(){
  let now=new Date().toLocaleTimeString("ar-EG");
  document.getElementById("attendTime").innerText=now;
  alert("تم تسجيل الحضور: "+now);
}
function getLiveLocation(){
  if(!navigator.geolocation) return alert("المتصفح مش بيدعم اللوكيشن");
  navigator.geolocation.getCurrentPosition(p=>{
    document.getElementById("mapLocText").innerText=`📍 ${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`;
  }, ()=>alert("افتح اللوكيشن من المتصفح"));
}
function openManatee(id){ window.open("https://play.google.com/store/search?q=manatee+barcode+scanner&c=apps","_blank") }
function openAzkar(){ document.getElementById("azkarFull").innerHTML=`<b>أذكار الصباح والمساء</b><br>أعوذ بالله من الشيطان الرجيم<br>اللَّهُ لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ<br><br>سبحان الله وبحمده - 100 مرة<br>أستغفر الله العظيم وأتوب إليه<br>اللهم صل وسلم على نبينا محمد`; document.getElementById("azkarModal").style.display="flex" }
function closeAzkar(){ document.getElementById("azkarModal").style.display="none" }
function showAzkar(){ openAzkar() }
function sendToFollowerOnly(){
  let txt=`تم التسليم - ${document.getElementById("dCustomer").innerText} - السيريال: ${document.getElementById("dSerial").value}`;
  let phone = getFollowerPhone();
  if(!phone){ alert("اكتب رقم المتابع الاول فوق"); return; }
  let clean = phone.replace(/\D/g, "");
  if(clean.startsWith("0")) clean = "20" + clean.slice(1);
  if(clean.length === 10) clean = "20" + clean;
  let waLink = "https://wa.me/" + clean + "?text=" + encodeURIComponent(txt);
  window.open(waLink, "_blank");
  document.getElementById("lockConfirmBox").style.display="block";
}
function confirmSendYes(){ document.getElementById("sendLockModal").style.display="none"; alert("تمام ✅") }
function confirmSendNo(){ document.getElementById("sendLockModal").style.display="none" }
function closeLockBack(){ document.getElementById("sendLockModal").style.display="none" }
async function compressImage(file){
  return new Promise((res)=>{
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = ()=>{
      const max = 1000;
      let w = img.width, h = img.height;
      if(w > max){ h = h * max / w; w = max; }
      if(h > max){ w = w * max / h; h = max; }
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url);
      c.toBlob(b=>res(b), "image/jpeg", 0.75);
    };
    img.src = url;
  });
}
async function uploadPhoto(file, jobId, slot){
  const compressed = await compressImage(file);
  file = new File([compressed], "photo.jpg", {type:"image/jpeg"});
  let name=`${jobId}_${slot}_${Date.now()}.jpg`;
  let {error}=await supabaseClient.storage.from(BUCKET).upload(name, file);
  if(error){ alert("خطأ في الرفع: " + error.message); return null; }
  let {data}=supabaseClient.storage.from(BUCKET).getPublicUrl(name);
  return data.publicUrl;
}
document.getElementById("photoInput")?.addEventListener("change", async e=>{
  let f=e.target.files[0]; if(!f) return;
  const tempUrl = URL.createObjectURL(f);
  let j = allJobs.find(x=>String(x.id)===String(currentDetailId));
  if(j){ j["photo"+(currentPhotoSlot+1)] = tempUrl; renderPhotos(j); }
  e.target.value = "";
  document.getElementById("uploadingBanner").style.display="block";
  let url=await uploadPhoto(f, currentDetailId, currentPhotoSlot);
  if(url){
    let j=allJobs.find(x=>String(x.id)===String(currentDetailId));
    let upRes=await supabaseClient.from(TABLE).update({["photo"+(currentPhotoSlot+1)]:url}).eq("id", currentDetailId);
    if(upRes.error) alert("الصورة اترفعت بس متحفظتش - جرب تاني: "+upRes.error.message);
    if(j) j["photo"+(currentPhotoSlot+1)]=url;
    renderPhotos(j);
  } else {
    alert("الصورة متحملتش - اتأكد من النت وجرب تاني");
  }
  document.getElementById("uploadingBanner").style.display="none";
  closePhotoCam();
});
document.getElementById("photoGalleryInput")?.addEventListener("change", async e=>{
  let f=e.target.files[0]; if(!f) return;
  const tempUrl = URL.createObjectURL(f);
  let j = allJobs.find(x=>String(x.id)===String(currentDetailId));
  if(j){ j["photo"+(currentPhotoSlot+1)] = tempUrl; renderPhotos(j); }
  e.target.value = "";
  document.getElementById("uploadingBanner").style.display="block";
  let url=await uploadPhoto(f, currentDetailId, currentPhotoSlot);
  if(url){
    let j=allJobs.find(x=>String(x.id)===String(currentDetailId));
    let upRes=await supabaseClient.from(TABLE).update({["photo"+(currentPhotoSlot+1)]:url}).eq("id", currentDetailId);
    if(upRes.error) alert("الصورة اترفعت بس متحفظتش - جرب تاني: "+upRes.error.message);
    if(j) j["photo"+(currentPhotoSlot+1)]=url;
    renderPhotos(j);
  } else {
    alert("الصورة متحملتش - اتأكد من النت وجرب تاني");
  }
  document.getElementById("uploadingBanner").style.display="none";
  closePhotoCam();
});
function tickClock(){
  let n=new Date();
  let clock=document.getElementById("loginClock"); if(clock) clock.innerText=String(n.getHours()).padStart(2,"0")+":"+String(n.getMinutes()).padStart(2,"0");
  let d=document.getElementById("loginDate"); if(d) d.innerText=todayStr();
  let a=document.getElementById("attendTime"); if(a) a.innerText=n.toLocaleTimeString("ar-EG");
}
setInterval(tickClock, 1000); tickClock();
window.addEventListener("load", ()=>{
  let saved=localStorage.getItem("misk_user");
  if(saved){
    try{ userObj=JSON.parse(saved); afterLogin(); }catch(e){ localStorage.removeItem("misk_user") }
  }
  let fp=getFollowerPhone();
  if(fp) document.getElementById("followerPhone").value=fp;
  if(fp) document.getElementById("followerMsg").innerText="✅ رقم المتابع المحفوظ: "+fp;
});



function normName(s){ return String(s||'').trim().toLowerCase().replace(/\s+/g,' '); }
function getCustodyForTech(techName){
  const devices = window.warehouseDevices || JSON.parse(localStorage.getItem('warehouseDevices')||'[]');
  const n = normName(techName);
  return devices.filter(d => normName(d.Tech || d.tech) === n);
}
function openAddTech(){ document.getElementById('addTechModal').style.display='flex'; }
function closeAddTech(){ document.getElementById('addTechModal').style.display='none'; }
async function saveTechnician(){
  const name = document.getElementById('techName').value.trim();
  const phone = document.getElementById('techPhone').value.trim();
  const pass = document.getElementById('techPass').value.trim() || phone;
  const line = document.getElementById('techLine').value.trim();
  const gov = document.getElementById('techGov').value.trim();
  if(!name || !phone){ alert('اكتب اسم الفني ورقم الموبايل'); return; }
  let {error} = await supabaseClient.from('technicians').insert({username: name, name: name, password: pass, phone: phone, line: line, governorate: gov, role: 'tech'});
  if(error){
    let {error:err2} = await supabaseClient.from('technicians').update({name:name, password:pass, phone:phone, line:line, governorate:gov}).eq('username', name);
    if(err2){
      let {error:err3} = await supabaseClient.from('technicians').update({name:name, password:pass, phone:phone, line:line, governorate:gov}).eq('phone', phone);
      if(err3){ alert('خطأ: '+err3.message); return; }
    }
  }
  const custody = getCustodyForTech(name);
  document.getElementById('techMsg').textContent = 'تم اضافة ' + name + ' ✅ - على عهدته دلوقتي ' + custody.length + ' جهاز - اليوزر: ' + name + ' أو ' + phone;
  loadTechCount(); loadTechNames();
  setTimeout(closeAddTech, 1500);
}

async function silentRefreshNow(){
  if(!userObj) return;
  await Promise.all([loadJobs(),loadWarehouse()]);
  silentSec = 30;
}
function toggleAuto(){
  autoOn = !autoOn;
  const b = document.getElementById("autoBtn");
  if(b){
    b.textContent = autoOn ? "إيقاف" : "تشغيل";
    b.style.background = autoOn ? "#fee2e2" : "#dcfce7";
    b.style.color = autoOn ? "#dc2626" : "#166534";
  }
}
setInterval(()=>{
  if(!userObj || !autoOn || document.hidden || document.querySelector('dialog[open]') || document.getElementById('details')?.style.display==='block') return;
  const ae = document.activeElement;
  if(ae && (ae.tagName==="INPUT" || ae.tagName==="TEXTAREA" || ae.tagName==="SELECT")) return;
  const el = document.getElementById("silentCount");
  silentSec--;
  if(el) el.textContent = silentSec;
  if(silentSec <= 0){
    silentSec = 30;
    silentRefreshNow();
  }
}, 1000);

