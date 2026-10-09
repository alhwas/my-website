/* ───────── history-depth tracker: يرقّم كل عنصر يضيفه الغلاف في سجل التصفح ───────── */
(function(){
  try {
    if (history.__athirIdx) return;
    var P = history.pushState.bind(history), R = history.replaceState.bind(history);
    function cur(){ try { return (history.state && history.state.idx) | 0; } catch(e){ return 0; } }
    history.pushState = function(s,t,u){ var n = Object.assign({}, (s && typeof s === 'object') ? s : {}); n.idx = cur() + 1; return P(n,t,u); };
    history.replaceState = function(s,t,u){ var n = Object.assign({}, (s && typeof s === 'object') ? s : {}); n.idx = cur(); return R(n,t,u); };
    history.__athirIdx = true;
  } catch(e) {}
})();
/* ───────── auth-fetch.js (مضمّن): يُلحق بيانات الجلسة بكل طلب موجّه للـ Worker ───────── */
(function(){
  if (window.__shellAuthFetch) return; window.__shellAuthFetch = true;
  function toB64(s){ try { return 'b64:' + btoa(unescape(encodeURIComponent(String(s)))); } catch(e){ return String(s); } }
  function creds(){
    try {
      var s = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
      if (!s || !s.userName) return null;
      var pin = s.pin || s.secret || '';
      return pin ? { user: String(s.userName), secret: String(pin) } : null;
    } catch(e){ return null; }
  }
  var orig = window.fetch;
  window.fetch = function(input, init){
    try {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      if (String(url).indexOf('workers.dev') === -1) return orig.apply(this, arguments);
      var c = creds(); if (!c) return orig.apply(this, arguments);
      init = init ? Object.assign({}, init) : {};
      var h = init.headers, has = false;
      if (typeof Headers !== 'undefined' && h instanceof Headers) { has = h.has('X-App-User'); if (!has) { h = new Headers(h); h.set('X-App-User', toB64(c.user)); h.set('X-App-Secret', toB64(c.secret)); } }
      else { h = Object.assign({}, h || {}); has = !!(h['X-App-User'] || h['x-app-user']); if (!has) { h['X-App-User'] = toB64(c.user); h['X-App-Secret'] = toB64(c.secret); } }
      init.headers = h;
      return orig.call(this, input, init);
    } catch(e) { return orig.apply(this, arguments); }
  };
})();

(function(){
  if (window.__athirKeepSession) return;
  window.__athirKeepSession = true;
  function toB64(str){
    try { return "b64:" + btoa(unescape(encodeURIComponent(String(str||"")))); }
    catch(e){ try { return "b64:" + btoa(String(str||"")); } catch(e2){ return String(str||""); } }
  }
  function creds(){
    try {
      var s = JSON.parse(localStorage.getItem("loggedInUser")||"null");
      if (!s || !s.userName) return null;
      var pin = s.pin || s.secret || "";
      if (!pin) return null;
      return { user: String(s.userName), secret: String(pin) };
    } catch(e){ return null; }
  }
  var orig = window.fetch;
  window.fetch = function(input, init){
    try {
      var url = (typeof input === "string") ? input : (input && input.url) || "";
      if (String(url).indexOf("workers.dev") === -1) return orig.apply(this, arguments);
      init = init ? Object.assign({}, init) : {};
      var headers = init.headers || {};
      var c = creds();
      if (c && !headers["X-App-User"] && !headers["x-app-user"]) {
        headers = Object.assign({}, headers);
        headers["X-App-User"] = toB64(c.user);
        headers["X-App-Secret"] = toB64(c.secret);
        init.headers = headers;
      }
      return orig.call(this, input, init);
    } catch(e) {
      return orig.apply(this, arguments);
    }
  };
})();

(function(){
  'use strict';
  function isBenignNoise(msg, src, err){
    msg = String(msg || '');
    src = String(src || '');
    var stack = '';
    try { stack = String((err && err.stack) || ''); } catch(e) {}
    // WebView / DownloadBridge / PrintBridge noise
    if (/Cannot assign to read only property ['"]?reload['"]? of object/i.test(msg)) return true;
    if (/reload/i.test(msg) && /read only/i.test(msg)) return true;
    if (/DownloadBridge/i.test(msg) || /PrintBridge/i.test(msg)) return true;
    if (/about:srcdoc/i.test(src) && /Invalid or unexpected token/i.test(msg)) return true;
    if (/Invalid or unexpected token/i.test(msg) && /srcdoc/i.test(stack + src)) return true;
    // بعض WebView ترمي هذا عند حقن الجسور
    if (/Failed to set the ['"]reload['"] property/i.test(msg)) return true;
    return false;
  }
  window.addEventListener('error', function(ev){
    try{
      var msg = (ev && ev.message) || (ev && ev.error && ev.error.message) || '';
      var src = (ev && ev.filename) || '';
      if (isBenignNoise(msg, src, ev && ev.error)) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        return false;
      }
    }catch(e){}
  }, true);
  window.addEventListener('unhandledrejection', function(ev){
    try{
      var reason = ev && ev.reason;
      var msg = (reason && reason.message) ? reason.message : String(reason || '');
      if (isBenignNoise(msg, '', reason)) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
      }
    }catch(e){}
  });
  // حماية استباقية: لا تسمح بإعادة تعريف location.reload إن كان مقفولاً
  try {
    var desc = Object.getOwnPropertyDescriptor(Location.prototype, 'reload') ||
               Object.getOwnPropertyDescriptor(window.location, 'reload');
    if (desc && desc.configurable === false) {
      // لا شيء — فقط نمنع الكود الخارجي من كسر الصفحة
    }
  } catch(e){}
})();

(function(){
  try{
    var _err = console.error;
    var _warn = console.warn;
    function noisy(args){
      try{
        var s = Array.prototype.slice.call(args).map(function(x){
          if (x && x.message) return String(x.message);
          return String(x);
        }).join(' ');
        if (/Cannot assign to read only property ['"]?reload['"]?/i.test(s)) return true;
        if (/reload/i.test(s) && /read only/i.test(s)) return true;
        if (/DownloadBridge/i.test(s) && /Injection/i.test(s)) return false; // keep logs if wanted
        return false;
      }catch(e){ return false; }
    }
    console.error = function(){
      if (noisy(arguments)) return;
      return _err.apply(console, arguments);
    };
  }catch(e){}
})();

(function(){
  if (window.AthirCore) return;
  var CF = "https://snowy-art-30d9.inventory-510.workers.dev";
  var memory = Object.create(null);
  var state = { net: "sync", db: "…", inventory: "…", maintenance: "…", lastSync: "—", channel: "طلب جزئي" };
  function label(){ return state.net === "online" ? "متصل" : state.net === "off" ? "غير متصل" : "مزامنة"; }
  function paint(){
    var pill = document.getElementById("athirStatusPill");
    var lab = document.getElementById("athirStatusLabel");
    if (pill) pill.setAttribute("data-state", state.net === "online" ? "on" : state.net === "off" ? "off" : "sync");
    if (lab) lab.textContent = label();
  }
  function cacheGet(key){
    if (memory[key] !== undefined) return memory[key];
    try { var raw = localStorage.getItem("athir-cache:"+key); if (raw) return JSON.parse(raw).value; } catch(e){}
    return null;
  }
  function cacheSet(key, value){
    memory[key] = value;
    try { localStorage.setItem("athir-cache:"+key, JSON.stringify({value:value, at:Date.now()})); } catch(e){}
  }
  var layers = [];
  function openLayer(name){
    if (layers[layers.length-1] !== name) layers.push(name);
  }
  function closeLayer(name){
    layers = layers.filter(function(x){ return x !== name; });
  }
  function closeTopLayer(){
    var sheet = document.getElementById("athirStatusSheet");
    if (sheet && sheet.classList.contains("show")) { sheet.classList.remove("show"); closeLayer("status"); return true; }
    var visit = document.getElementById("appVisitOverlay");
    if (visit && visit.classList.contains("show") && typeof closeAppVisitOverlay === "function") { closeAppVisitOverlay(); closeLayer("visits"); return true; }
    var del = document.getElementById("accountDeleteOverlay");
    if (del && del.classList.contains("show")) { del.classList.remove("show"); closeLayer("account-delete"); return true; }
    return false;
  }
  async function ping(){
    if (state.net !== "online") { state.net = "sync"; paint(); }
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 4500);
    try {
      var res = await fetch(CF + "/health", {signal: ctrl.signal, headers:{Accept:"application/json"}});
      clearTimeout(timer);
      state.net = res.ok ? "online" : "off";
      state.db = res.ok ? "متصلة" : "لا استجابة";
      state.inventory = "جاهز محلياً";
      state.maintenance = "جاهز محلياً";
      state.lastSync = new Date().toLocaleTimeString("ar");
      cacheSet("health", {ok: res.ok, at: Date.now()});
    } catch(e) {
      clearTimeout(timer);
      state.net = "off";
      state.db = "غير متصلة";
      var cached = cacheGet("health");
      state.lastSync = cached && cached.at ? new Date(cached.at).toLocaleTimeString("ar") : "لا توجد";
    }
    paint();
  }
  window.AthirCore = {
    state: state,
    cacheGet: cacheGet,
    cacheSet: cacheSet,
    openLayer: openLayer,
    closeLayer: closeLayer,
    closeTopLayer: closeTopLayer,
    setSync: function(mode){ state.net = mode; if (mode === "online") state.lastSync = new Date().toLocaleTimeString("ar"); paint(); },
    openStatus: function(){
      var list = document.getElementById("athirStatusList");
      if (list) list.innerHTML = [
        ["الاتصال", label()],
        ["قاعدة البيانات", state.db],
        ["المخزون", state.inventory],
        ["الصيانة", state.maintenance],
        ["آخر مزامنة", state.lastSync],
        ["القناة", state.channel]
      ].map(function(row){ return "<li><span>"+row[0]+"</span><b>"+row[1]+"</b></li>"; }).join("");
      document.getElementById("athirStatusSheet").classList.add("show");
      openLayer("status");
    },
    closeStatus: function(){ document.getElementById("athirStatusSheet").classList.remove("show"); closeLayer("status"); },
    syncPartsDelta: async function(patches){
      this.setSync("sync");
      var failed = 0;
      for (var i = 0; i < patches.length; i++) {
        var p = patches[i];
        if (!p || !p.delta) continue;
        try {
          var res = await fetch(CF + "/inventory/movement", {
            method: "POST",
            headers: {"Content-Type":"application/json", Accept:"application/json"},
            body: JSON.stringify({
              itemId: p.id || 0,
              itemName: p.name_ar,
              barcode: p.barcode || "",
              delta: p.delta,
              operation: "maintenance_use",
              note: "استخدام من الصيانة"
            })
          });
          if (!res.ok) failed++;
          else {
            var data = await res.json();
            if (data && data.item) cacheSet("item:"+p.name_ar, data.item);
          }
        } catch(e) { failed++; }
      }
      state.inventory = failed ? "خصم محلي بانتظار الشبكة" : "تحديث جزئي";
      this.setSync(failed ? "off" : "online");
      return failed === 0;
    }
  };
  window.decorateFrameHtml = function(html, type){
    if (!html || html.indexOf("athir-core-bridge") !== -1) return html;
    var bridge = '<style id="athir-oos">tr.out-of-stock{background:rgba(239,91,91,.08)} .oos-badge{display:inline-block;margin-right:6px;padding:1px 6px;border-radius:999px;background:#ef5b5b;color:#fff;font-size:10px;font-weight:800}</style>'
      + '<script id="athir-core-bridge">(function(){if(window.__athirCoreBridge)return;window.__athirCoreBridge=true;'
      + 'function markRow(row,qty){if(!row)return;row.classList.toggle("out-of-stock",Number(qty)===0);var badge=row.querySelector(".oos-badge");if(Number(qty)===0){if(!badge){badge=document.createElement("span");badge.className="oos-badge";badge.textContent="نفد المخزون";var cell=row.cells&&row.cells[0];if(cell)cell.appendChild(badge);}}else if(badge)badge.remove();}'
      + 'window.applyInventoryPatch=function(patch){try{var name=String(patch.name_ar||"");if(typeof inventoryData!=="undefined"&&Array.isArray(inventoryData)){var item=inventoryData.find(function(x){return String(x.name_ar||x.name)===name;});if(item)item.qty=patch.qty;try{localStorage.setItem("inventoryData",JSON.stringify(inventoryData));}catch(e){}}'
      + 'var row=document.querySelector(\'tr[data-name-ar="\'+name.replace(/"/g,"\\\\\\"")+\'"]\');if(row){var input=row.querySelector("input[type=number]");if(input){input.value=patch.qty;input.dataset.oldQty=patch.qty;}markRow(row,patch.qty);return true;}}catch(e){}return false;};'
      + 'window.refreshInventoryFromSharedStorage=function(){try{var raw=localStorage.getItem("inventoryData");var data=raw?JSON.parse(raw):[];if(typeof inventoryData!=="undefined"&&Array.isArray(inventoryData)){inventoryData.splice(0,inventoryData.length);Array.prototype.push.apply(inventoryData,data);}if(typeof renderInventorySmooth==="function")renderInventorySmooth(typeof inventoryData!=="undefined"?inventoryData:data);document.querySelectorAll("tr[data-name-ar]").forEach(function(row){var input=row.querySelector("input[type=number]");if(input)markRow(row,input.value);});}catch(e){}};'
      + 'window.__athirCloseTopModal=function(){var nodes=Array.prototype.slice.call(document.querySelectorAll("body *")).filter(function(el){var id=el.id||"";var cls=typeof el.className==="string"?el.className:"";if(!/modal|overlay|popup|sheet/i.test(id+" "+cls))return false;var s=getComputedStyle(el);if(s.display==="none"||s.visibility==="hidden")return false;if(s.position!=="fixed"&&s.position!=="absolute")return false;if(parseFloat(s.opacity)===0||s.pointerEvents==="none")return false;var r=el.getBoundingClientRect();return r.width>40&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth;});if(!nodes.length)return false;nodes.sort(function(a,b){return (parseInt(getComputedStyle(b).zIndex)||0)-(parseInt(getComputedStyle(a).zIndex)||0);});var top=nodes[0];var btn=top.querySelector("[id*=close i],.close,.btn-close,[onclick*=close]");if(btn){btn.click();return true;}top.style.display="none";top.classList.remove("show","active","open");return true;};'
      + 'if(typeof handleBackAction==="function"&&!handleBackAction.__athir){var prev=handleBackAction;window.handleBackAction=function(){if(window.__athirCloseTopModal())return true;return prev();};window.handleBackAction.__athir=true;}else if(typeof handleBackAction!=="function"){window.handleBackAction=function(){return window.__athirCloseTopModal();};}'
      + 'try{if(window.parent&&window.parent.AthirCore)window.parent.AthirCore.setSync(navigator.onLine?"online":"off");}catch(e){}'
      + '})();'+'<'+'/script>';
    if (html.indexOf("</body>") !== -1) return html.replace("</body>", bridge + "</body>");
    return html + bridge;
  };
  var oldConsume = null;
  window.__athirInstallConsume = function(html){
    var start = html.indexOf("async function updateInventoryForMaintenance");
    if (start < 0) start = html.indexOf("function updateInventoryForMaintenance");
    if (start < 0) return html;
    var end = html.indexOf("function bindPartsPicker", start);
    if (end < 0) return html;
    var fn = 'async function updateInventoryForMaintenance(oldParts,newParts){\n'
      + 'let inv=readInventoryParts();\n'
      + 'const oldMap=new Map((oldParts||[]).map(p=>[String(p.name_ar||p.name),Number(p.qty)||0]));\n'
      + 'const newMap=new Map((newParts||[]).map(p=>[String(p.name_ar||p.name),Number(p.qty)||0]));\n'
      + 'const names=new Set([...oldMap.keys(),...newMap.keys()]);\n'
      + 'const logs=(()=>{try{return JSON.parse(localStorage.getItem("inventoryLogs")||"[]")}catch(e){return []}})();\n'
      + 'const patches=[];\n'
      + 'for(const name of names){\n'
      + 'const item=inv.find(x=>String(x.name_ar||x.name)===name); if(!item)continue;\n'
      + 'const oldQty=Number(item.qty)||0;\n'
      + 'const delta=(oldMap.get(name)||0)-(newMap.get(name)||0);\n'
      + 'const next=Math.max(0,oldQty+delta);\n'
      + 'if(next!==oldQty){item.qty=next;patches.push({name_ar:name,qty:next,delta:delta,barcode:item.barcode||"",id:item.id||0});logs.unshift({timestamp:Date.now(),date:new Date().toLocaleDateString("ar-EG"),time:new Date().toLocaleTimeString("ar-EG"),user:currentUser||"الصيانة",item:name,old_qty:oldQty,new_qty:next,operation:"maintenance_use"});}\n'
      + '}\n'
      + 'if(logs.length>100)logs.splice(100);\n'
      + 'const ts=Date.now();\n'
      + 'localStorage.setItem("inventoryData",JSON.stringify(inv));\n'
      + 'localStorage.setItem("inventoryTimestamp",String(ts));\n'
      + 'localStorage.setItem("inventoryLogs",JSON.stringify(logs));\n'
      + 'try{if(window.parent&&window.parent.localStorage){window.parent.localStorage.setItem("inventoryData",JSON.stringify(inv));window.parent.localStorage.setItem("inventoryTimestamp",String(ts));}}catch(e){}\n'
      + 'try{const invFrame=window.parent&&window.parent.document&&window.parent.document.getElementById("inventoryFrame");const invWin=invFrame&&invFrame.contentWindow;if(invWin){if(typeof invWin.applyInventoryPatch==="function")patches.forEach(p=>invWin.applyInventoryPatch(p));else if(typeof invWin.refreshInventoryFromSharedStorage==="function")invWin.refreshInventoryFromSharedStorage();}}catch(e){}\n'
      + 'try{if(patches.length&&window.parent&&window.parent.AthirCore)await window.parent.AthirCore.syncPartsDelta(patches);}catch(e){}\n'
      + '}\n';
    return html.slice(0, start) + fn + html.slice(end);
  };
  var decorate = window.decorateFrameHtml;
  window.decorateFrameHtml = function(html, type){
    if (type === "maintenance") html = window.__athirInstallConsume(html);
    return decorate(html, type);
  };
  function boot(){
    paint();
    ping();
    setInterval(ping, 30000);
    window.addEventListener("online", ping);
    window.addEventListener("offline", function(){ state.net = "off"; state.db = "غير متصلة"; paint(); });
    if (typeof closeTopOverlay === "function" && !closeTopOverlay.__athir) {
      var prev = closeTopOverlay;
      window.closeTopOverlay = function(){
        if (AthirCore.closeTopLayer()) return true;
        return prev();
      };
      window.closeTopOverlay.__athir = true;
    }
    if (typeof delegateBackToCurrentSystem === "function" && !delegateBackToCurrentSystem.__athir) {
      var prevBack = delegateBackToCurrentSystem;
      window.delegateBackToCurrentSystem = function(){
        try {
          var frame = typeof activeSystemFrame === "function" ? activeSystemFrame() : null;
          if (frame && frame.contentWindow && typeof frame.contentWindow.__athirCloseTopModal === "function" && frame.contentWindow.__athirCloseTopModal()) return true;
        } catch(e){}
        return prevBack();
      };
      window.delegateBackToCurrentSystem.__athir = true;
    }
    ["openSettings","openAppVisitOverlay"].forEach(function(name){
      if (typeof window[name] === "function" && !window[name].__athir) {
        var prevFn = window[name];
        window[name] = function(){
          AthirCore.closeTopLayer();
          AthirCore.openLayer(name);
          return prevFn.apply(this, arguments);
        };
        window[name].__athir = true;
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

    // =========================================================
    // ===== مسح ذاكرة/تخزين النسخة القديمة عند كل تحديث فعلي =====
    // =========================================================
    // كل مرة أرفع لك نسخة جديدة من الملف، سيتغيّر رقم APP_BUILD_VERSION
    // أدناه. عندها فقط (وليس في كل فتح للتطبيق) يتم مسح كل شيء محفوظ من
    // النسخة السابقة (localStorage / sessionStorage / أي Cache API / الكوكيز)
    // مرة واحدة تلقائيًا، حتى تضمن أنك تختبر الكود الجديد فعليًا وليس نسخة
    // قديمة عالقة من WebView. بعد هذا التنظيف لن يُمسح شيء مرة أخرى إلا عند
    // تغيير الرقم في تحديث لاحق، فبيانات المخزون/الصيانة الحقيقية لن تتأثر
    // في الاستخدام العادي.
    (function cleanupOldBuildData(){
        var APP_BUILD_VERSION = 'build-2026-10-07-perf-backup-v31';
        window.APP_BUILD_VERSION = APP_BUILD_VERSION;
        try {
            var savedVersion = null;
            try { savedVersion = localStorage.getItem('__appBuildVersion'); } catch(e) {}

            if (savedVersion !== APP_BUILD_VERSION) {
                // عند التحديث: لا نمسح بيانات الدخول ولا الإعدادات
                // نحفظ المفاتيح المهمة ثم نعيدها بعد أي تنظيف خفيف
                var PRESERVE_KEYS = [
                    'loggedInUser',
                    'currentUser',
                    'unifiedUsers',
                    'currentSystem',
                    'darkMode',
                    'pref_darkMode',
                    'pref_reduceMotion',
                    'pref_keepLastSystem',
                    '__appBuildVersion'
                ];
                // أي مفتاح يبدأ بـ pref_ أيضًا
                var preserved = {};
                try {
                    for (var i = 0; i < localStorage.length; i++) {
                        var k = localStorage.key(i);
                        if (!k) continue;
                        if (PRESERVE_KEYS.indexOf(k) !== -1 || k.indexOf('pref_') === 0) {
                            preserved[k] = localStorage.getItem(k);
                        }
                    }
                } catch(e) {}

                // مسح كاش المتصفح فقط (Cache API) وليس بيانات الدخول
                try {
                    if (window.caches && caches.keys) {
                        caches.keys().then(function(names){
                            names.forEach(function(name){ caches.delete(name); });
                        });
                    }
                } catch(e) {}

                // لا نستدعي localStorage.clear() ولا sessionStorage.clear()
                // حتى لا يُطلب تسجيل الدخول بعد كل تحديث

                // تحديث رقم النسخة فقط
                try { localStorage.setItem('__appBuildVersion', APP_BUILD_VERSION); } catch(e) {}

                // إعادة أي مفتاح محفوظ (احتياط)
                try {
                    Object.keys(preserved).forEach(function(k){
                        if (k === '__appBuildVersion') return;
                        try { localStorage.setItem(k, preserved[k]); } catch(e) {}
                    });
                } catch(e) {}
            }
        } catch(e) {}
    })();

    let currentSystem = null;
    let framesLoaded = { inventory: false, maintenance: false };

    // ===== Enhanced UI helpers =====
    function getPref(key, def) {
        try { const v = localStorage.getItem('pref_' + key); return v === null ? def : v === '1'; } catch(e) { return def; }
    }
    function setPref(key, val) {
        try { localStorage.setItem('pref_' + key, val ? '1' : '0'); } catch(e) {}
    }
    function applyDarkModeToFrame(frame, on) {
        try {
            if (!frame || !frame.contentWindow || !frame.contentDocument) return;
            const doc = frame.contentDocument;
            const html = doc.documentElement;
            const body = doc.body;
            if (!html || !body) return;

            // الوضع الليلي فقط عبر class — لا نلمس data-theme (الأخضر/الأزرق/...) أبداً
            html.classList.toggle('dark-mode', !!on);
            body.classList.toggle('dark-mode', !!on);
            html.classList.toggle('dark', !!on);
            body.classList.toggle('dark', !!on);

            // إن كان data-theme="dark" بالخطأ من نسخة سابقة، أعده للون المحفوظ
            try {
                const themeAttr = body.getAttribute('data-theme') || html.getAttribute('data-theme');
                if (themeAttr === 'dark') {
                    let saved = null;
                    try { saved = frame.contentWindow.localStorage.getItem('selectedTheme') || frame.contentWindow.localStorage.getItem('theme') || frame.contentWindow.localStorage.getItem('appTheme'); } catch(e) {}
                    const restore = saved && saved !== 'dark' ? saved : 'green';
                    body.setAttribute('data-theme', restore);
                    html.setAttribute('data-theme', restore);
                }
            } catch (e) {}

            try {
                frame.contentWindow.localStorage.setItem('darkMode', on ? 'true' : 'false');
                frame.contentWindow.localStorage.setItem('pref_darkMode', on ? '1' : '0');
                // لا نكتب data-theme من الغلاف
            } catch (e) {}
            try {
                frame.contentWindow.postMessage({ type: 'shellDarkMode', enabled: !!on }, '*');
            } catch (e) {}

            // استدعاء دالة الثيم الداخلية إن وُجدت دون تغيير اللون
            try {
                if (typeof frame.contentWindow.toggleDarkMode === 'function') {
                    // بعض التطبيقات تتوقع مزامنة فقط
                }
                if (typeof frame.contentWindow.applyTheme === 'function' && !on) {
                    // لا نجبر تغييراً
                }
            } catch (e) {}
        } catch (e) {}
    }
    function syncDarkModeToAllFrames(on) {
        applyDarkModeToFrame(document.getElementById('inventoryFrame'), on);
        applyDarkModeToFrame(document.getElementById('maintenanceFrame'), on);
    }
    function applyDarkMode(on) {
        on = !!on;
        document.documentElement.classList.toggle('dark-mode', on);
        document.body.classList.toggle('dark-mode', on);
        const icon = document.querySelector('#btnToggleDark i');
        if (icon) icon.className = on ? 'fas fa-sun' : 'fas fa-moon';
        const chk = document.getElementById('setDarkMode');
        if (chk) chk.checked = on;
        setPref('darkMode', on);
        try {
            localStorage.setItem('darkMode', on ? 'true' : 'false');
        } catch (e) {}
        syncDarkModeToAllFrames(on);
    }
    function applyReduceMotion(on) {
        on = !!on;
        document.documentElement.classList.toggle('reduce-motion', on);
        setPref('reduceMotion', on);
        // أزل أي ستايل سابق دائماً ثم أضف عند التفعيل فقط (إصلاح التبديل)
        const old = document.getElementById('reduceMotionStyle');
        if (old) old.remove();
        if (on) {
            const s = document.createElement('style');
            s.id = 'reduceMotionStyle';
            s.textContent = 'html.reduce-motion *:not(#splashScreen):not(#splashScreen *), html.reduce-motion *:not(#splashScreen):not(#splashScreen *)::before, html.reduce-motion *:not(#splashScreen):not(#splashScreen *)::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}';
            document.head.appendChild(s);
        }
    }
    function updateSelUserUI() {
        try {
            const u = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
            const name = u.userName || localStorage.getItem('currentUser') || 'مستخدم';
            const nameEl = document.getElementById('selUserName');
            const avEl = document.getElementById('selUserAvatar');
            if (nameEl) nameEl.textContent = name;
            if (avEl) avEl.textContent = (name.charAt(0) || '?');
        } catch(e) {}
    }
    let __settingsOpen = false;
    function updateSettingsSummary() {
        const text = document.getElementById('settingsStatusText');
        const dot = document.querySelector('.settings-status-dot');
        if (!text) return;
        const label = currentSystem === 'inventory' ? 'المخزون مفتوح' : currentSystem === 'maintenance' ? 'الصيانة مفتوحة' : 'شاشة الأقسام جاهزة';
        const connection = navigator.onLine === false ? ' — دون اتصال' : ' — متصل';
        text.textContent = label + connection;
        if (dot) dot.classList.toggle('offline', navigator.onLine === false);
    }
    function openSectionFromSettings(type) {
        // إغلاق فوري بلا مؤقتات، ثم فتح القسم في frame واحد لتجنب الوميض.
        closeSettings(false);
        requestAnimationFrame(() => openSystem(type));
    }
    function openSettings(fromHistory=false) {
        const ov = document.getElementById('settingsOverlay');
        if (!ov) return;
        document.getElementById('setDarkMode').checked = getPref('darkMode', false);
        document.getElementById('setReduceMotion').checked = getPref('reduceMotion', false);
        document.getElementById('setKeepLastSystem').checked = getPref('keepLastSystem', false);
        document.getElementById('appBuildLabel').textContent = (typeof APP_BUILD_VERSION !== 'undefined' ? APP_BUILD_VERSION.replace('build-','') : '—');
        updateSettingsSummary();
        ov.classList.add('show');
        ov.setAttribute('aria-hidden', 'false');
        __settingsOpen = true;
        if (!fromHistory) {
            try { history.pushState({screen:'settings', parent:currentSystem || 'selection'}, '', '#settings'); } catch(e) {}
        }
    }
    function closeSettings(fromHistory=false) {
        const ov = document.getElementById('settingsOverlay');
        if (ov) {
            ov.classList.remove('show');
            ov.setAttribute('aria-hidden', 'true');
        }
        __settingsOpen = false;
        if (!fromHistory) {
            setHistoryScreen(currentSystem || 'selection', 'replace');
        }
    }
    function showFrameLoading(msg) {
        const el = document.getElementById('frameLoading');
        const t = document.getElementById('frameLoadingText');
        if (t) t.textContent = msg || 'جارِ تجهيز النظام...';
        if (el) el.classList.add('show');
    }
    function hideFrameLoading() {
        const el = document.getElementById('frameLoading');
        if (el) el.classList.remove('show');
    }
    function manualCheckUpdate() {
        closeSettings();
        const toastId = 'doubleBackToast';
        try {
            const old = document.getElementById(toastId);
            if (old) old.remove();
            const toast = document.createElement('div');
            toast.id = toastId;
            toast.setAttribute('role','status');
            toast.style.cssText = 'position:fixed;left:50%;bottom:30px;transform:translateX(-50%);z-index:2147483646;background:rgba(15,23,42,.97);color:#fff;padding:12px 20px;border-radius:28px;font-size:14px;font-weight:800;box-shadow:0 10px 30px rgba(0,0,0,.28);white-space:nowrap;max-width:calc(100vw - 28px);overflow:hidden;text-overflow:ellipsis;';
            toast.textContent = '🔍 جارِ التحقق...';
            document.body.appendChild(toast);

            const setResult = (text, ok) => {
                const el = document.getElementById(toastId);
                if (!el) return;
                el.textContent = text;
                el.style.background = ok === false ? 'rgba(185,28,28,.97)' : (ok === true ? 'rgba(22,101,52,.97)' : 'rgba(15,23,42,.97)');
                setTimeout(() => { try { el.remove(); } catch(e) {} }, 2400);
            };

            const jsonUrl = 'https://alhwas.github.io/app-updates/inventory/version.json?t=' + Date.now();
            fetch(jsonUrl, { cache:'no-store' })
                .then(response => {
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    return response.json();
                })
                .then(data => {
                    const currentVersion = 6.2;
                    if (Number(data && data.version) > currentVersion) {
                        const el = document.getElementById(toastId);
                        if (el) el.remove();
                        if (typeof window.__showUpdateModal === 'function') {
                            window.__showUpdateModal(data.version, data.downloadLink);
                        } else if (typeof window.showUpdateModal === 'function') {
                            window.showUpdateModal(data.version, data.downloadLink);
                        } else {
                            setResult('يوجد تحديث جديد', true);
                        }
                    } else {
                        setResult('أنت على أحدث إصدار', true);
                    }
                })
                .catch(error => {
                    console.log('لا يمكن التحقق من التحديث:', error);
                    setResult('تعذر الاتصال بالخادم', false);
                });
        } catch(e) {
            console.log('manual update check error:', e);
            const el = document.getElementById(toastId);
            if (el) {
                el.textContent = 'تعذر الاتصال بالخادم';
                el.style.background = 'rgba(185,28,28,.97)';
                setTimeout(() => { try { el.remove(); } catch(_) {} }, 2400);
            }
        }
    }
    // Frame decode cache (speed)
    const frameHtmlCache = { inventory: null, maintenance: null };

    function lockSelectionScroll() {
        try {
            // اقفل فقط عندما شاشة الاختيار ظاهرة
            const sel = document.getElementById('selectionScreen');
            if (!sel || !sel.classList.contains('visible')) {
                unlockSelectionScroll();
                return;
            }
            document.documentElement.classList.add('selection-locked');
            document.body.classList.add('selection-locked');
            sel.scrollTop = 0;
            if (!sel._scrollLockBound) {
                sel._scrollLockBound = true;
                sel.addEventListener('touchmove', function(e) {
                    if (document.getElementById('settingsOverlay')?.classList.contains('show')) return;
                    // لا نستدعي preventDefault إلا إذا كان الحدث قابلاً للإلغاء.
                    // أثناء التمرير الفعلي يكون cancelable=false ويستدعي المتصفح خطأً مزعجاً.
                    if (e.cancelable) e.preventDefault();
                }, { passive: false });
            }
            window.scrollTo(0, 0);
        } catch(e) {}
    }
    function unlockSelectionScroll() {
        try {
            document.documentElement.classList.remove('selection-locked');
            document.body.classList.remove('selection-locked');
            // إعادة تفعيل التمرير بالكامل عند دخول أي قسم
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.height = '';
            document.body.style.top = '';
        } catch(e) {}
    }

    // ===== Scroll performance helpers =====
    (function setupScrollPerf(){
        let scrollTimer = null;
        const markScroll = () => {
            document.documentElement.classList.add('is-scrolling');
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                document.documentElement.classList.remove('is-scrolling');
            }, 120);
        };
        window.addEventListener('scroll', markScroll, { passive: true });
        // لا نراقب touchmove على مستوى المستند؛ في Android/WebView هذا يستهلك
        // مسار اللمس أثناء السحب. التمرير الأصلي يبقى مسؤولاً عن السلاسة.
    })();

    // إخفاء زر الخروج الداخلي لكل قسم (نظام المخزون/الصيانة) لأن الخروج أصبح موحّداً من الشاشة الرئيسية فقط.
    function hideInnerLogoutButton(frame) {
        try {
            if (!frame || !frame.contentDocument) return;
            const doc = frame.contentDocument;
            if (doc.getElementById('shell-hide-inner-logout')) return;
            const style = doc.createElement('style');
            style.id = 'shell-hide-inner-logout';
            style.textContent = `#logoutBtn{display:none !important;}`;
            (doc.head || doc.documentElement).appendChild(style);
        } catch(e) {}
    }

    function injectScrollPerfIntoFrame(frame) {
        try {
            if (!frame || !frame.contentDocument) return;
            const doc = frame.contentDocument;
            if (!doc.getElementById('shell-scroll-perf')) {
                const style = doc.createElement('style');
                style.id = 'shell-scroll-perf';
                style.textContent = `
                    html {
                        height: auto !important;
                        min-height: 100% !important;
                        overflow-x: hidden !important;
                        overflow-y: auto !important;
                        -webkit-overflow-scrolling: touch !important;
                        scroll-behavior: auto !important;
                        touch-action: auto !important;
                        overscroll-behavior-y: auto !important;
                    }
                    body {
                        height: auto !important;
                        min-height: 100% !important;
                        overflow-x: hidden !important;
                        overflow-y: auto !important;
                        position: static !important;
                        top: auto !important;
                        -webkit-overflow-scrolling: touch !important;
                        overscroll-behavior-y: auto !important;
                        touch-action: auto !important;
                    }
                    .tab-page {
                        touch-action: auto !important;
                    }
                    /* أثناء السحب نوقف المؤثرات المكلفة فقط، ثم نعيدها فور توقف الإصبع. */
                    .log-card,.ai-card{content-visibility:auto;contain-intrinsic-size:auto 120px;}
html.athir-scrolling *,
                    html.athir-scrolling *::before,
                    html.athir-scrolling *::after {
                        transition: none !important;
                        animation: none !important;
                    }
                    html.athir-scrolling [style*="backdrop-filter"],
                    html.athir-scrolling .glass,
                    html.athir-scrolling .modal,
                    html.athir-scrolling .overlay {
                        backdrop-filter: none !important;
                        -webkit-backdrop-filter: none !important;
                    }
                    html.athir-scrolling input,
                    html.athir-scrolling button,
                    html.athir-scrolling a {
                        -webkit-tap-highlight-color: transparent !important;
                    }
                `;
                (doc.head || doc.documentElement).appendChild(style);
            }

            // الصيانة: لا نطبق طبقة athir-scrolling أثناء السحب.
            // تبديل transition/animation لكل العناصر أثناء touchmove كان يسبب
            // ومضاً وتشتيتاً بصرياً في التصفح داخل الصيانة.
            // نترك تمرير الصيانة Native/سلساً بدون تغيير المؤثرات أثناء السحب.
            if (frame.id === 'maintenanceFrame') {
                return;
            }

            // مستمع واحد passive فقط؛ لا نمنع touchmove ولا نعيد layout أثناء السحب.
            if (!doc.documentElement.__athirScrollPerf) {
                doc.documentElement.__athirScrollPerf = true;
                let raf = 0, timer = 0;
                const start = () => {
                    if (!doc.documentElement.classList.contains('athir-scrolling')) {
                        doc.documentElement.classList.add('athir-scrolling');
                    }
                    clearTimeout(timer);
                    timer = setTimeout(() => {
                        doc.documentElement.classList.remove('athir-scrolling');
                    }, 120);
                };
                // scroll فقط: لا touchmove handler على كل حركة إصبع.
                doc.addEventListener('scroll', () => {
                    if (raf) return;
                    raf = requestAnimationFrame(() => {
                        raf = 0;
                        start();
                    });
                }, {passive:true});
            }
        } catch(e) {}
    }




    // حالة توافق قديمة؛ الخروج من شاشة النظام المتكامل يتم من أول ضغطة.
    let exitBackArmed = false;
    let exitBackTimer = null;

    /* ============================================
       🔗 نظام تسجيل الدخول الموحّد (SSO) بين قسمي المخزون والصيانة
       ============================================ */
    const UNIFIED_USERS_KEY = 'unifiedUsers';
    const ADMIN_ROLE_INV = 'admin';
    const ADMIN_USERNAME_MAIN = 'admin';
    const ADMIN_USERNAME_ASCII = 'admin';
    // بيانات السحابة لكل قسم (تُجلب بالكامل من خادم Athir وقاعدة البيانات)
    const CF_WORKER_API = "https://snowy-art-30d9.inventory-510.workers.dev"; window.CF_WORKER_API = CF_WORKER_API;
    // 🔒 لا توجد كلمة مرور افتراضية في الكود. التحقق من الدخول يتم في الـ Worker (/login).
    // هذا الرمز عشوائي لكل جهاز ولا يعرفه أحد؛ يُستخدم فقط كقيمة شكلية داخل القوائم المحلية.
    const LOCAL_SEED_PIN = (function(){
        try {
            let v = localStorage.getItem('__unifiedSeedPin');
            if (!v) {
                const a = new Uint8Array(16);
                (window.crypto || window.msCrypto).getRandomValues(a);
                v = 'seed-' + Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
                localStorage.setItem('__unifiedSeedPin', v);
            }
            return v;
        } catch(e) { return 'seed-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }
    })();
    // سر المسؤول المحلي: سر جلسته الحالية إن كان هو المسجَّل، وإلا الرمز العشوائي
    function adminLocalSecret() {
        try {
            const s = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
            if (s && s.userName === 'admin' && s.pin) return String(s.pin);
        } catch(e) {}
        return LOCAL_SEED_PIN;
    }
    // القائمة الافتراضية عند تعذّر الوصول للسحابة — المسؤول فقط admin
    const DEFAULT_UNIFIED_USERS = [
        { userName: 'admin', secret: LOCAL_SEED_PIN, isAdmin: true }
    ];
    function getUnifiedUsers() {
        let list = null;
        try { list = JSON.parse(localStorage.getItem(UNIFIED_USERS_KEY)); } catch(e) {}
        if (!list || !Array.isArray(list) || list.length === 0) {
            list = DEFAULT_UNIFIED_USERS;
            try { localStorage.setItem(UNIFIED_USERS_KEY, JSON.stringify(list)); } catch(e) {}
        }
        return list;
    }

    // 🧹 تنظيف لمرة واحدة: إن كانت قائمة الحسابات المحلية تحوي كلمة المرور الافتراضية القديمة تُستبدل بالرمز العشوائي
    (function purgeLegacyDefaultSecret(){
        try {
            if (!(window.crypto && crypto.subtle && window.TextEncoder) || localStorage.getItem('__legacySecretPurged') === '1') return;
            const LEGACY = 'b75e79d6a4efe4da2c961347b127ec0fb1dddb0cbc1e8195af2f6d2ddccc040c';
            const hex = b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
            const list = JSON.parse(localStorage.getItem(UNIFIED_USERS_KEY) || 'null');
            if (!Array.isArray(list)) { localStorage.setItem('__legacySecretPurged', '1'); return; }
            Promise.all(list.map(async u => {
                const v = String(u && (u.secret || u.pin) || '');
                const h = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
                return h === LEGACY ? Object.assign({}, u, { secret: LOCAL_SEED_PIN, pin: undefined }) : u;
            })).then(out => {
                localStorage.setItem(UNIFIED_USERS_KEY, JSON.stringify(out));
                localStorage.setItem('__legacySecretPurged', '1');
            }).catch(() => {});
        } catch(e) {}
    })();
    // ===== دمج مستخدمين محسّن: تطبيع الاسم، إزالة التكرار، دمج الصلاحيات والأسرار =====
    const RESERVED_ADMIN_ALIASES = ['مسؤول', 'admin', 'Admin', 'ADMIN'];
    function normalizeUserName(name) {
        name = String(name || '').trim().replace(/\s+/g, ' ');
        if (!name) return '';
        if (RESERVED_ADMIN_ALIASES.includes(name) || name.toLowerCase() === 'admin') return 'admin';
        return name;
    }
    function pickBetterSecret(a, b) {
        a = String(a || '').trim();
        b = String(b || '').trim();
        if (!a) return b;
        if (!b) return a;
        // تفضيل التجزئة على النص الصريح إن وُجدت
        if (a.startsWith('sha256:') && !b.startsWith('sha256:')) return a;
        if (b.startsWith('sha256:') && !a.startsWith('sha256:')) return b;
        // وإلا نأخذ الأحدث غير الفارغ (b يُفترض أنه الوارد الجديد)
        return b || a;
    }
    function normalizeUserRecord(u) {
        if (!u) return null;
        const userName = normalizeUserName(u.userName || u.name || '');
        if (!userName) return null;
        if (userName === 'alhwas') return null; // محظور نهائياً
        const secret = String(u.secret || u.pin || u.password || '').trim();
        const isAdmin = userName === 'admin' ? true : !!(u.isAdmin === true || u.isAdmin === 1 || u.isAdmin === '1');
        const section = (u.section === 'inventory' || u.section === 'maintenance' || u.section === 'both') ? u.section : 'both';
        return { userName, secret, isAdmin, section };
    }
    /**
     * دمج عدة قوائم مستخدمين في قائمة واحدة بلا تكرار.
     * sources: مصفوفة قوائم (كل عنصر {userName, secret|pin, isAdmin?})
     * options.ensureAdmin: يضمن وجود admin (افتراضي true)
     * options.defaultAdminSecret: سر admin الافتراضي إن لم يوجد
     * options.requireSecret: إن true يتجاهل من بلا سر (افتراضي false عند الدمج الجزئي)
     */
    function mergeUsersLists(sources, options) {
        options = options || {};
        const ensureAdmin = options.ensureAdmin !== false;
        const defaultAdminSecret = options.defaultAdminSecret || adminLocalSecret();
        const requireSecret = !!options.requireSecret;
        const map = new Map();
        const lists = Array.isArray(sources) ? sources : [sources];
        lists.forEach(list => {
            if (!list) return;
            const arr = Array.isArray(list) ? list : [list];
            arr.forEach(raw => {
                const u = normalizeUserRecord(raw);
                if (!u) return;
                if (requireSecret && !u.secret) return;
                const prev = map.get(u.userName);
                if (!prev) {
                    map.set(u.userName, u);
                    return;
                }
                prev.secret = pickBetterSecret(prev.secret, u.secret);
                prev.isAdmin = !!(prev.isAdmin || u.isAdmin || u.userName === 'admin');
                // both يتفوّق على قسم واحد
                if (u.section === 'both' || prev.section === 'both') prev.section = 'both';
                else if (u.section && prev.section && u.section !== prev.section) prev.section = 'both';
                else if (u.section) prev.section = u.section;
            });
        });
        if (ensureAdmin) {
            if (!map.has('admin')) {
                map.set('admin', { userName: 'admin', secret: defaultAdminSecret, isAdmin: true, section: 'both' });
            } else {
                map.get('admin').isAdmin = true;
                map.get('admin').section = 'both';
                if (!map.get('admin').secret) map.get('admin').secret = defaultAdminSecret;
            }
        }
        // ترتيب: admin أولاً ثم أبجدياً
        const out = Array.from(map.values()).sort((a, b) => {
            if (a.userName === 'admin') return -1;
            if (b.userName === 'admin') return 1;
            return String(a.userName).localeCompare(String(b.userName), 'ar');
        });
        return out;
    }
    function mergeIntoUnifiedUsers(newEntries) {
        const current = getUnifiedUsers();
        const merged = mergeUsersLists([current, newEntries], { ensureAdmin: true, requireSecret: false });
        try { localStorage.setItem(UNIFIED_USERS_KEY, JSON.stringify(merged)); } catch(e) {}
        return merged;
    }
    window.mergeUsersLists = mergeUsersLists;
    window.normalizeUserName = normalizeUserName;

    // 🌐 يجلب قائمة الموظفين الحقيقية والكاملة من سحابتي القسمين ويدمجها محليًا
    // (بحيث يعمل تسجيل الدخول الموحّد لكل الموظفين وليس فقط الحسابات الافتراضية)
    async function fetchCloudUsersAndMerge() {
        const entries = [];
        try {
            const res = await fetch(`${CF_WORKER_API}/users`);
            if (res.ok) {
                const rec = await res.json();
                (rec.users || []).forEach(u => {
                    const n = normalizeUserRecord(u);
                    if (n && n.secret) entries.push(n);
                });
            }
        } catch(e) { console.warn('تعذر جلب الموظفين من Cloudflare', e); }
        // الاعتماد على مصدر Athir الرئيسي فقط
        if (entries.length) mergeIntoUnifiedUsers(entries);
        // 🧹 تنظيف: حذف حساب المسؤول القديم "alhwas" نهائياً إن وُجد بالسحابة
        try {
            const cleaned = getUnifiedUsers().filter(u => u.userName !== 'alhwas');
            localStorage.setItem(UNIFIED_USERS_KEY, JSON.stringify(cleaned));
        } catch(e) {}
        return entries.length > 0;
    }
    function isUnifiedLoggedIn() {
        try {
            const inv = JSON.parse(localStorage.getItem('loggedInUser'));
            const main = localStorage.getItem('currentUser');
            return !!(inv && inv.userName && main);
        } catch(e) { return false; }
    }
    let cloudUsersFetched = false;
    // يرجع {kind:'ok',user} عند النجاح، {kind:'denied',status,message} عند الرفض، {kind:'offline'} عند تعذر الوصول
    async function serverLogin(secret) {
        const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        const timer = setTimeout(() => { try { if (ctrl) ctrl.abort(); } catch(e) {} }, 9000);
        try {
            const res = await fetch(`${CF_WORKER_API}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ secret: secret }),
                signal: ctrl ? ctrl.signal : undefined
            });
            let j = null; try { j = await res.json(); } catch(e) {}
            if (res.ok && j && j.user && j.user.userName) return { kind: 'ok', user: j.user };
            if ([401, 403, 409, 429].includes(res.status)) return { kind: 'denied', status: res.status, message: (j && j.message) || '' };
            return { kind: 'offline' };
        } catch(e) { return { kind: 'offline' }; }
        finally { clearTimeout(timer); }
    }
    async function unifiedLogin() {
        const passInput = document.getElementById('unifiedLoginPass');
        const errEl = document.getElementById('unifiedLoginError');
        const btn = document.getElementById('unifiedLoginBtn');
        const statusEl = document.getElementById('unifiedLoginStatus');
        const statusTextEl = document.getElementById('unifiedLoginStatusText');
        const secret = (passInput.value || '').trim();
        if (!secret) return;

        errEl.style.display = 'none';
        btn.disabled = true;
        statusEl.style.display = 'block';

        // خطوة 1: التحقق من الرقم السري عبر الـ Worker (لا مقارنة محلية عند توفر الاتصال)
        statusTextEl.textContent = 'جارِ الاتصال بالسحابة...';
        const srv = await serverLogin(secret);
        let found = null, errMsg = '';
        if (srv.kind === 'ok') {
            found = normalizeUserRecord({ userName: srv.user.userName, secret: secret, isAdmin: srv.user.isAdmin, section: srv.user.section });
            // حفظ نسخة محلية لتمكين الدخول بدون إنترنت لاحقاً على هذا الجهاز (تستبدل أي سر قديم لنفس المستخدم)
            try { mergeIntoUnifiedUsers([found]); } catch(e) {}
        } else if (srv.kind === 'denied') {
            errMsg = (srv.status === 429 || srv.status === 409) ? srv.message : '';
        } else {
            // تعذّر الوصول للسحابة: نتحقق من الحسابات المحفوظة على هذا الجهاز فقط
            statusTextEl.textContent = 'تعذّر الاتصال — التحقق من الحسابات المحفوظة على الجهاز...';
            found = getUnifiedUsers().find(u => u.secret === secret) || null;
        }
        cloudUsersFetched = true;

        statusTextEl.textContent = 'جارِ التحقق من الرقم السري...';
        await new Promise(r => setTimeout(r, 300)); // إتاحة وقت كافٍ لعرض حالة التحقق للمستخدم

        statusEl.style.display = 'none';
        btn.disabled = false;

        if (!errEl.dataset.defaultText) errEl.dataset.defaultText = errEl.textContent;
        errEl.textContent = errMsg || errEl.dataset.defaultText;
        if (!found) {
            errEl.style.display = 'block';
            passInput.style.borderColor = '#ef4444';
            return;
        }

        // تمرير الهوية لكلا القسمين بنفس الوقت (localStorage مشترك بين الـ iframes لأنها بنفس الأصل)
        localStorage.setItem('loggedInUser', JSON.stringify({ userName: found.userName, pin: found.secret, isAdmin: !!found.isAdmin }));
        localStorage.setItem('currentUser', found.userName);
        localStorage.setItem('unifiedSessionRole', found.isAdmin ? 'admin' : 'employee');
        centralAppVisitSessionId = `${found.userName}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
        centralAppVisitRecordedId = null;
        try { if(window.__refreshUnifiedAccountUI) window.__refreshUnifiedAccountUI(); } catch(e) {}
        // إعادة مزامنة القسمين فوراً كي لا يطلب أي منهما تسجيل الدخول مرة أخرى.
        try { resyncEmbeddedFramesLoginState(); } catch(e) {}
        passInput.value = '';

        // خطوة 2: ترحيب بالموظف باسمه قبل المتابعة
        document.getElementById('unifiedLoginCard').style.display = 'none';
        document.getElementById('unifiedWelcomeName').textContent = found.userName;
        document.getElementById('unifiedWelcomeCard').style.display = 'flex';
        setTimeout(() => {
            document.getElementById('unifiedLoginScreen').style.display = 'none';
            document.getElementById('unifiedWelcomeCard').style.display = 'none';
            document.getElementById('unifiedLoginCard').style.display = 'flex';
            showSelectionAfterLogin();
        }, 1400);
    }
    // mode: 'logout' | 'exit'
    var logoutConfirmMode = 'logout';

    function showLogoutOverlay(mode) {
        logoutConfirmMode = mode || 'logout';
        var title = document.getElementById('logoutConfirmTitle');
        var msg = document.getElementById('logoutConfirmMsg');
        var okBtn = document.getElementById('logoutConfirmOkBtn');
        var icon = document.getElementById('logoutConfirmIcon');
        var overlay = document.getElementById('logoutConfirmOverlay');
        if (!overlay) {
            // fallback إذا اختفى العنصر
            if (mode === 'exit') {
                if (window.confirm('هل تريد إغلاق التطبيق الآن؟')) {
                    if (typeof performNativeExit === 'function') performNativeExit();
                }
            } else {
                if (window.confirm('تسجيل الخروج؟\nسيتم إنهاء الجلسة والعودة لشاشة الدخول.')) {
                    unifiedLogout();
                }
            }
            return;
        }
        if (mode === 'exit') {
            if (title) title.textContent = 'إغلاق التطبيق؟';
            if (msg) msg.textContent = 'هل تريد الخروج من التطبيق الآن؟';
            if (okBtn) okBtn.textContent = 'خروج';
            if (icon) icon.innerHTML = '<i class="fas fa-power-off"></i>';
        } else {
            if (title) title.textContent = 'تسجيل الخروج؟';
            if (msg) msg.textContent = 'سيتم إنهاء الجلسة والعودة إلى شاشة تسجيل الدخول. هل تريد المتابعة؟';
            if (okBtn) okBtn.textContent = 'تسجيل الخروج';
            if (icon) icon.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
        }
        overlay.classList.add('show');
        overlay.style.display = 'flex';
        overlay.style.zIndex = '2147483000';
    }

    function confirmUnifiedLogout() {
        showLogoutOverlay('logout');
    }

    function confirmAppExit() {
        // ميزة إغلاق التطبيق أُلغيت — لا تفعل شيئاً
        return false;
    }

    function closeLogoutConfirm() {
        var overlay = document.getElementById('logoutConfirmOverlay');
        if (overlay) {
            overlay.classList.remove('show');
            overlay.style.display = 'none';
        }
        logoutConfirmMode = 'logout';
    }

    function confirmLogoutAction() {
        var mode = logoutConfirmMode;
        closeLogoutConfirm();
        if (mode === 'exit') {
            if (typeof performNativeExit === 'function') {
                if (!performNativeExit()) {
                    try { history.replaceState({screen:'selection', root:1}, '', '#selection'); } catch(e) {}
                }
            }
            return;
        }
        unifiedLogout();
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeLogoutConfirm();
    });

    function resetToLoginScreen() {
        // إعادة ضبط واجهة الغلاف بدون location.reload؛ تحافظ على جلسة WebView مستقرة.
        try { closeSettings(true); } catch(e) {}
        try { closeLogoutConfirm(); } catch(e) {}
        try {
            document.getElementById('inventoryFrame')?.classList.remove('active');
            document.getElementById('maintenanceFrame')?.classList.remove('active');
            document.getElementById('selectionScreen')?.classList.remove('visible');
            document.documentElement.classList.remove('app-open', 'selection-locked');
            document.body.classList.remove('app-open', 'selection-locked');
        } catch(e) {}
        currentSystem = null;
        exitBackArmed = false;
        clearTimeout(exitBackTimer);
        try { history.replaceState({ screen: 'login', root: 1 }, '', '#login'); } catch(e) {}
        const login = document.getElementById('unifiedLoginScreen');
        if (login) login.style.display = 'flex';
        const pass = document.getElementById('unifiedLoginPass');
        if (pass) setTimeout(() => pass.focus(), 80);
    }

    function unifiedLogout() {
        try {
            localStorage.removeItem('loggedInUser');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('currentSystem');
            localStorage.removeItem('unifiedSessionRole');
        } catch(e) {}
        try { if (window.__refreshUnifiedAccountUI) window.__refreshUnifiedAccountUI(); } catch(e) {}
        resetToLoginScreen();
    }

    // ضمان أن الأزرار تقدر تنادي الدوال حتى داخل WebView
    window.confirmUnifiedLogout = confirmUnifiedLogout;
    window.confirmAppExit = confirmAppExit;
    window.closeLogoutConfirm = closeLogoutConfirm;
    window.confirmLogoutAction = confirmLogoutAction;
    window.unifiedLogout = unifiedLogout;

    // ربط أزرار تسجيل الخروج بشكل مباشر (أضمن في WebView)
    document.addEventListener('DOMContentLoaded', function() {
        document.querySelectorAll('.selection-logout, [aria-label="تسجيل الخروج من التطبيق"]').forEach(function(btn) {
            btn.addEventListener('click', function(ev) {
                ev.preventDefault();
                ev.stopPropagation();
                confirmUnifiedLogout();
            }, true);
        });
        var okBtn = document.getElementById('logoutConfirmOkBtn');
        if (okBtn) {
            okBtn.addEventListener('click', function(ev) {
                ev.preventDefault();
                confirmLogoutAction();
            });
        }
    });



        // استقبال طلب طباعة PDF من قسم المخزون وإرساله إلى جسر Android إن وُجد
        window.addEventListener('message', (e) => {
            if (!e.data || e.data.type !== 'printPdf') return;

            const data = e.data;
            let handled = false;

            try {
                if (window.Android && typeof window.Android.printPdf === 'function') {
                    window.Android.printPdf(data.base64, data.fileName || 'document.pdf');
                    handled = true;
                } else if (window.AndroidPrinter && typeof window.AndroidPrinter.printPdf === 'function') {
                    window.AndroidPrinter.printPdf(data.base64, data.fileName || 'document.pdf');
                    handled = true;
                } else if (window.AndroidBridge && typeof window.AndroidBridge.printPdf === 'function') {
                    window.AndroidBridge.printPdf(data.base64, data.fileName || 'document.pdf');
                    handled = true;
                }
            } catch (err) {
                console.error('Android PDF print bridge error:', err);
            }

            if (!handled) {
                // لا نكسر التطبيق إذا لم يوجد جسر Android؛ يبقى تنزيل PDF هو الحل الآمن.
                console.info('No Android print bridge detected; PDF download fallback will be used.');
            }
        });

    // مزامنة قائمة «الإعدادات والخيارات» داخل iframe مع سجل الغلاف؛
    // هذا هو المسار الذي يراه زر الرجوع الأصلي في Android/WebView.
    window.addEventListener('message', (e) => {
        if (!e.data) return;
        if (e.data.type === 'inventoryMoreOpened') {
            try { history.pushState({ screen: currentSystem || 'inventory', overlay: 'inventoryMore' }, '', '#inventory-more'); } catch (err) {}
        } else if (e.data.type === 'inventoryMoreClosed') {
            try { history.replaceState({ screen: currentSystem || 'inventory' }, '', '#' + (currentSystem || 'inventory')); } catch (err) {}
        }
    });

    // 🔗 استقبال إشعار تسجيل الخروج القادم من داخل أي من القسمين (iframe)
    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'unifiedLogout') {
            confirmUnifiedLogout();
        }
        if (e.data && e.data.type === 'openExternal' && e.data.url) {
            openExternalFromShell(e.data.url);
        }
        if (e.data && e.data.type === 'backToSystemSelection') {
            if (currentSystem || document.querySelector('.app-frame.active')) { goBackToSelection(); }
            return;
        }
        if (e.data && e.data.type === 'exitApp') {
            // حتى لو طلبت نافذة داخلية الخروج، لا نسمح بخروج مباشر.
            // الخروج من الجذر يمر دائمًا عبر نظام الضغطتين.
            handleRootBackPress();
        }
    });

    // محاولة إنهاء التطبيق بالتعرّف الذكي على أشهر جسور WebView والهجن.
    function performNativeExit() {
        let called = false;
        const bridges = [window.Android, window.AndroidBridge, window.NativeAndroid, window.AndroidInterface, window.JSBridge, window.WebViewBridge, window.App, window.NativeApp];
        const methods = ['exitApp','closeApp','finish','finishActivity','close','exit','quit','terminate'];
        for (const bridge of bridges) {
            if (!bridge) continue;
            for (const method of methods) {
                try {
                    if (typeof bridge[method] === 'function') {
                        bridge[method]();
                        called = true;
                    }
                } catch (err) {}
            }
        }
        // Cordova / Capacitor
        try {
            if (window.navigator?.app?.exitApp && typeof window.navigator.app.exitApp === 'function') {
                window.navigator.app.exitApp(); called = true;
            }
        } catch (err) {}
        try {
            if (window.Capacitor?.Plugins?.App?.exitApp && typeof window.Capacitor.Plugins.App.exitApp === 'function') {
                window.Capacitor.Plugins.App.exitApp(); called = true;
            }
        } catch (err) {}
        // iOS WKWebView
        try {
            const handlers = window.webkit?.messageHandlers || {};
            for (const name of ['exitApp','closeApp','terminateApp']) {
                if (handlers[name]) { handlers[name].postMessage({type:'exitApp'}); called = true; }
            }
        } catch (err) {}
        // React Native / host WebView fallback signal
        try {
            if (window.ReactNativeWebView?.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({type:'exitApp'})); called = true;
            }
        } catch (err) {}
        try { window.parent?.postMessage({type:'exitAppConfirmed'}, '*'); } catch (err) {}
        return called;
    }

    // الاسم القديم محفوظ للتوافق مع أي كود خارجي، لكنه لا ينفذ الخروج مباشرة.
    function requestNativeExit() {
        return performNativeExit();
    }

    // =========================================================
    // ===== تنقل مركزي وآمن: مالك واحد لسجل الغلاف =====
    // =========================================================
    let backTransitionLock = false;
    let backTransitionTimer = null;
    const BACK_TRANSITION_MS = 420;

    // سجل تنقل هرمي للغلاف: الاختيار هو الجذر، ثم القسم الحالي.
    // لا يسمح هذا السجل بأن تؤدي العودة من قسم إلى خروج التطبيق مباشرة.
    const AppNavigation = window.AppNavigation = window.AppNavigation || {
        stack: ['selection'],
        current(){ return this.stack[this.stack.length - 1] || 'selection'; },
        reset(root='selection'){ this.stack = [root]; },
        enter(screen){
            if (!screen) return;
            if (this.current() !== screen) this.stack.push(screen);
        },
        leave(){
            if (this.stack.length > 1) return this.stack.pop();
            return 'selection';
        },
        canLeave(){ return this.stack.length > 1; }
    };

    function activeSystemFrame() {
        return currentSystem === 'maintenance'
            ? document.getElementById('maintenanceFrame')
            : document.getElementById('inventoryFrame');
    }

    function delegateBackToCurrentSystem() {
        if (!currentSystem) return false;
        const frame = activeSystemFrame();
        try {
            return !!(frame && frame.contentWindow &&
                typeof frame.contentWindow.handleBackAction === 'function' &&
                frame.contentWindow.handleBackAction());
        } catch (e) {
            return false;
        }
    }

    function lockBackTransition() {
        backTransitionLock = true;
        clearTimeout(backTransitionTimer);
        backTransitionTimer = setTimeout(() => { backTransitionLock = false; }, BACK_TRANSITION_MS);
    }

    function setHistoryScreen(screen, mode) {
        if (screen === 'selection' && mode !== 'push') { collapseSelectionHistory(); return; }
        const hash = '#' + screen;
        const state = { screen: screen, guard: 1 };
        try {
            if (mode === 'push') history.pushState(state, '', hash);
            else history.replaceState(state, '', hash);
        } catch (e) {}
    }

    // طبقتان فقط عند الجذر: الأصل + حارس واحد. لا نضيف حالات على كل popstate.
    function ensureSelectionHistoryRoot() {
        // الجذر الوحيد للتطبيق. نحافظ على حارس واحد حتى تكون الضغطة التالية
        // من شاشة النظام المتكامل هي التي تسمح بالخروج الطبيعي.
        // جذر بعنصر واحد بلا حارس: ضغطة الرجوع الأولى تصل مباشرة لـ WebView فيُغلق التطبيق.
        AppNavigation.reset('selection');
        collapseSelectionHistory();
    }

    // يطوي كل عناصر السجل التي أضافها الغلاف فوق الجذر (حراس قديمة، إعدادات، أقسام...)
    var historyCollapsing = false;
    var historyCollapseTries = 0;
    var historyCollapseTimer = null;
    function writeSelectionRoot() {
        try { history.replaceState({ screen: 'selection', root: 1 }, '', '#selection'); } catch (e) {}
    }
    function collapseSelectionHistory() {
        const idx = (history.state && history.state.idx) | 0;
        if (idx <= 0) { writeSelectionRoot(); return; }
        historyCollapsing = true;
        historyCollapseTries = 0;
        clearTimeout(historyCollapseTimer);
        historyCollapseTimer = setTimeout(function () {
            if (!historyCollapsing) return;
            historyCollapsing = false;
            writeSelectionRoot();
        }, 800);
        try { history.go(-idx); } catch (e) { historyCollapsing = false; writeSelectionRoot(); }
    }
    function onCollapsePopstate() {
        const idx = (history.state && history.state.idx) | 0;
        if (idx > 0 && historyCollapseTries < 4) {
            historyCollapseTries++;
            try { history.go(-idx); return; } catch (e) {}
        }
        historyCollapsing = false;
        clearTimeout(historyCollapseTimer);
        writeSelectionRoot();
    }

    // توافق مع الاستدعاءات القديمة: ترميم الحالة الحالية دون تضخيم السجل.
    function repadHistory() {
        setHistoryScreen(currentSystem || 'selection', 'replace');
    }

    function closeTopOverlay() {
        const visit = document.getElementById('appVisitOverlay');
        if (visit && visit.classList.contains('show')) {
            closeAppVisitOverlay();
            repadHistory();
            return true;
        }
        const settings = document.getElementById('settingsOverlay');
        if (settings && settings.classList.contains('show')) {
            closeSettings(true);
            repadHistory();
            return true;
        }
        const accounts = document.getElementById('accountOverlay');
        if (accounts && accounts.classList.contains('show')) {
            try { window.closeAccountManager?.(); } catch (e) {}
            repadHistory();
            return true;
        }
        const logout = document.getElementById('logoutConfirmOverlay');
        if (logout && logout.classList.contains('show')) {
            closeLogoutConfirm();
            repadHistory();
            return true;
        }
        return false;
    }

    // رجوع هرمي صارم: طبقة داخلية ← صفحة القسم ← شاشة اختيار النظام.
    // القسم الداخلي هو المالك الأول للرجوع، والغلاف يعيد تثبيت مساره بعد
    // أي رجوع داخلي حتى لا يسقط Android/WebView إلى خارج التطبيق.
    function processTopbarBack(fromPopState = false) {
        // شاشة «النظام المتكامل» هي الجذر النهائي: إذا كان المستخدم عليها
        // بالفعل ولا توجد نافذة مفتوحة، فلا نسمح لقفل الانتقال أو حارس history
        // باستهلاك ضغطة الرجوع. تُرسل الضغطة مباشرة لمسار الخروج من التطبيق.
        const selectionRoot = !currentSystem && (function(){
            const sel = document.getElementById('selectionScreen');
            const inv = document.getElementById('inventoryFrame');
            const maint = document.getElementById('maintenanceFrame');
            return !!(sel && sel.classList.contains('visible') &&
                !(inv && inv.classList.contains('active')) &&
                !(maint && maint.classList.contains('active')));
        })();
        if (selectionRoot && !closeTopOverlay()) {
            backTransitionLock = false;
            clearTimeout(backTransitionTimer);
            return handleRootBackPress();
        }

        if (backTransitionLock) return true;
        lockBackTransition();

        // قائمة «الإعدادات والخيارات» موجودة داخل iframe المخزون، لذلك لا
        // نعتمد على سجل history الخاص بالـ iframe وحده؛ زر رجوع الهاتف يعمل
        // غالباً على سجل الغلاف الرئيسي. أغلق القائمة أولاً من الغلاف.
        try {
            const frame = activeSystemFrame();
            const child = frame && frame.contentWindow;
            const menu = child && child.document && child.document.getElementById('bottomMenu');
            if (menu && child.getComputedStyle(menu).display !== 'none') {
                if (typeof child.closeBottomMenu === 'function') child.closeBottomMenu(true);
                else menu.style.display = 'none';
                if (fromPopState) setHistoryScreen(currentSystem || 'inventory', 'push');
                return true;
            }
        } catch (e) {}

        // النوافذ العائمة (ومنها إعدادات الغلاف) لها أولوية على رجوع القسم.
        if (closeTopOverlay()) return true;

        if (currentSystem || document.querySelector('.app-frame.active')) {
            const handledInsideSection = delegateBackToCurrentSystem();
            if (handledInsideSection) {
                // عند معالجة popstate داخل الغلاف، نعيد حالة القسم إلى أعلى السجل.
                // أما الاستدعاء المباشر من جسر Android فلا نضيف حالة زائدة.
                if (fromPopState) setHistoryScreen(currentSystem, 'push');
                try { window.__sectionBackConsumedUntil = Date.now() + BACK_TRANSITION_MS; } catch (e) {}
                return true;
            }
            goBackToSelection();
            return true;
        }

        return handleRootBackPress();
    }

    window.handleTopbarBack = () => processTopbarBack(false);
    window.handleAndroidBack = () => processTopbarBack(false);

    // popstate واحد فقط للغلاف، مع إعادة تثبيت المسار عند إغلاق طبقة داخلية.
    window.addEventListener('popstate', function () {
        if (historyCollapsing) { onCollapsePopstate(); return; }
        if (backTransitionLock) return;
        processTopbarBack(true);
    });

    function handleRootBackPress() {
        if (currentSystem) return handleTopbarBack();
        if (closeTopOverlay()) return true;

        // شاشة الاختيار هي الجذر؛ ضغطة واحدة تنفذ الخروج مباشرة.
        let exited = false;
        try { exited = performNativeExit(); } catch (e) {}
        if (!exited) {
            // لا يوجد جسر خروج: نظّف أي عناصر متبقية في السجل ونُرجع false
            // ليتولى WebView الخروج الطبيعي بدل أن نبتلع الضغطة.
            collapseSelectionHistory();
            return false;
        }
        return true;
    }
    // يفتح رابط واتساب/خارجي فعليًا من الغلاف الخارجي (مو محصور بـ sandbox)
    function openExternalFromShell(url) {
        if (!url) return;
        try { const a=document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener noreferrer'; a.style.display='none'; document.body.appendChild(a); a.click(); a.remove(); return; } catch(e) {}
        try { const w=window.open(url,'_blank'); if(w)return; } catch(e) {}
        try { window.location.href=url; } catch(e) {}
    }


    function openAppVisitOverlay(){
        const overlay=document.getElementById('appVisitOverlay'); if(!overlay)return;
        if (overlay.parentElement !== document.body) document.body.appendChild(overlay);
        overlay.style.zIndex = '2147483000';
        overlay.style.display = 'flex';
        overlay.style.visibility = 'visible';
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
        overlay.classList.add('show');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('app-visit-modal-open');
        try { closeSettings(true); } catch(e) {}
        try { renderAppVisitDashboard(); } catch(e) { console.warn('visit render', e); }
        try { loadCentralAppVisits(); } catch(e) {}
    }
    function closeAppVisitOverlay(){
        const overlay=document.getElementById('appVisitOverlay');
        if(overlay){
            overlay.classList.remove('show');
            overlay.style.display = 'none';
            overlay.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('app-visit-modal-open');
    }
    window.openAppVisitOverlay = openAppVisitOverlay;
    window.closeAppVisitOverlay = closeAppVisitOverlay;

    // مصدر الإحصائيات الأساسي: Cloudflare Worker المرتبط بقاعدة D1.
    // localStorage مستخدم كـ offline cache فقط، وليس كمصدر دائم للبيانات.
    const APP_VISITS_D1_API = `${CF_WORKER_API}/visits`;
    const APP_VISITS_CACHE_KEY = 'centralAppVisitCacheV2';
    const APP_VISIT_BOOT_ID = `boot-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let centralAppVisits = {};
    let centralAppVisitSessionId = null;
    let centralAppVisitRecordedId = null;
    let centralAppVisitWriteInFlight = false;
    let centralAppVisitsCloudReady = false;
    let centralAppVisitsOffline = false;

    function readCentralAppVisits(){
        try { centralAppVisits = JSON.parse(localStorage.getItem(APP_VISITS_CACHE_KEY)||'{}') || {}; }
        catch(e){ centralAppVisits = {}; }
        return centralAppVisits;
    }
    function saveCentralAppVisits(){
        try { localStorage.setItem(APP_VISITS_CACHE_KEY, JSON.stringify(centralAppVisits)); } catch(e){}
    }
    function localDateKey(d=new Date()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
    function visitEntryCount(entry){ return typeof entry === 'number' ? entry : Number(entry?.count||0); }
    function visitEntryHours(entry){ return typeof entry === 'object' && entry?.hours ? entry.hours : {}; }
    function mergeCentralVisitData(base, incoming){
        const out=JSON.parse(JSON.stringify(base&&typeof base==='object'?base:{}));
        Object.entries(incoming&&typeof incoming==='object'?incoming:{}).forEach(([user,days])=>{
            if(!out[user])out[user]={};
            Object.entries(days&&typeof days==='object'?days:{}).forEach(([date,val])=>{
                const a=out[user][date], b=val;
                if(a===undefined){out[user][date]=b;return;}
                const av=typeof a==='object'&&a?a:{count:Number(a)||0,hours:{}}, bv=typeof b==='object'&&b?b:{count:Number(b)||0,hours:{}};
                const merged={count:Math.max(Number(av.count)||0,Number(bv.count)||0),hours:{}};
                new Set([...Object.keys(av.hours||{}),...Object.keys(bv.hours||{})]).forEach(h=>merged.hours[h]=Math.max(Number(av.hours?.[h])||0,Number(bv.hours?.[h])||0));
                out[user][date]=merged;
            });
        });
        return out;
    }
    function normalizeD1Visits(payload){
        const root=payload?.data!==undefined?payload.data:(payload?.record||payload||{});
        if(root.appVisits&&typeof root.appVisits==='object')return root.appVisits;
        const rows=Array.isArray(root)?root:(Array.isArray(root.visits)?root.visits:[]), out={};
        rows.forEach(row=>{
            const user=String(row.userName||row.username||row.user||'').trim(); if(!user)return;
            const rawDate=row.visitDate||row.date||row.day||row.visitedAt||row.createdAt; const d=rawDate?new Date(rawDate):new Date();
            const date=/^\d{4}-\d{2}-\d{2}$/.test(String(rawDate||''))?String(rawDate):localDateKey(d);
            const hour=String(Number.isFinite(Number(row.visitHour))?Number(row.visitHour):d.getHours()).padStart(2,'0');
            if(!out[user])out[user]={}; const entry=out[user][date]||{count:0,hours:{}};
            entry.count+=(Number(row.count)||1); entry.hours=entry.hours||{}; entry.hours[hour]=(Number(entry.hours[hour])||0)+(Number(row.count)||1); out[user][date]=entry;
        });
        return out;
    }
    function visitDateInRange(key, range, year){
        const [y,m,d] = String(key).split('-').map(Number); if(!y||!m||!d)return false;
        const date = new Date(y,m-1,d); const now = new Date();
        if(range==='day') return key===localDateKey(now);
        if(range==='week'){ const start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-6); return date>=start && date<=new Date(now.getFullYear(),now.getMonth(),now.getDate()); }
        if(range==='month') return y===now.getFullYear() && m===now.getMonth()+1;
        return y===Number(year);
    }
    function visitsForUser(name, range, year){
        const data=centralAppVisits[name]||{}; let total=0; const hours=Array(24).fill(0);
        Object.entries(data).forEach(([key,entry])=>{ if(!visitDateInRange(key,range,year))return; total+=visitEntryCount(entry); Object.entries(visitEntryHours(entry)).forEach(([h,c])=>{const i=Number(h);if(i>=0&&i<24)hours[i]+=Number(c)||0;}); });
        return {total,hours};
    }
    function allRangeTotal(range,year){ return Object.keys(centralAppVisits).reduce((s,u)=>s+visitsForUser(u,range,year).total,0); }
    function formatVisitNumber(n){ return Number(n||0).toLocaleString('ar-SA'); }
    function currentUnifiedSession(){ try{return JSON.parse(localStorage.getItem('loggedInUser')||'null');}catch(e){return null;} }
    function d1AuthHeaders(session){
        return {Accept:'application/json','Content-Type':'application/json','X-App-User':String(session?.userName||''),'X-App-Secret':String(session?.pin||session?.secret||''),'X-App-Role':viewerIsAdmin()?'admin':'employee'};
    }
    async function loadCentralAppVisits(){
        if (centralAppVisitsUnsupported) { renderAppVisitDashboard(); return centralAppVisits; }
        readCentralAppVisits();
        const localSnapshot=centralAppVisits;
        const session=currentUnifiedSession();
        try{
            const scope=viewerIsAdmin()?'all':'mine';
            const qs=new URLSearchParams({scope,user:String(session?.userName||'')});
            const r=await fetch(`${APP_VISITS_D1_API}?${qs.toString()}`,{headers:d1AuthHeaders(session)});
            if(!r.ok)throw new Error(`D1 GET ${r.status}`);
            const cloud=normalizeD1Visits(await r.json());
            // لا نمسح الكاش المحلي إذا أعادت D1 نتيجة فارغة مؤقتًا.
            centralAppVisits=Object.keys(cloud).length?cloud:localSnapshot;
            saveCentralAppVisits(); centralAppVisitsCloudReady=true; centralAppVisitsOffline=false;
        }catch(e){
            centralAppVisitsOffline=true;
            const missing = /404/.test(String(e && e.message || e));
            if (missing) centralAppVisitsUnsupported = true;
            else console.warn('D1 visits unavailable; offline cache used', e);
        }
        renderAppVisitDashboard(); return centralAppVisits;
    }
    async function recordCentralAppVisit(){
        const session=currentUnifiedSession(); if(!session?.userName)return;
        const visitSessionId=centralAppVisitSessionId||`${APP_VISIT_BOOT_ID}:${session.userName}`;
        if(centralAppVisitRecordedId===visitSessionId){ renderAppVisitDashboard(); return; }
        centralAppVisitRecordedId=visitSessionId;
        const now=new Date(), key=localDateKey(now), hour=String(now.getHours()).padStart(2,'0');
        const body={userName:session.userName,sessionId:visitSessionId,visitedAt:now.toISOString(),visitDate:key,visitHour:Number(hour)};
        if(!centralAppVisits[session.userName])centralAppVisits[session.userName]={};
        const old=centralAppVisits[session.userName][key]; const entry=typeof old==='object'&&old?old:{count:Number(old)||0,hours:{}};
        entry.count=(Number(entry.count)||0)+1; entry.hours=entry.hours||{}; entry.hours[hour]=(Number(entry.hours[hour])||0)+1;
        centralAppVisits[session.userName][key]=entry; saveCentralAppVisits(); renderAppVisitDashboard();
        if(centralAppVisitWriteInFlight)return;
        centralAppVisitWriteInFlight=true;
        try{
            const r=await fetch(APP_VISITS_D1_API,{method:'POST',headers:d1AuthHeaders(session),body:JSON.stringify(body)});
            if(!r.ok)throw new Error(`D1 POST ${r.status}`);
            centralAppVisitsCloudReady=true; centralAppVisitsOffline=false;
        }catch(e){ centralAppVisitsOffline=true; if(!/404/.test(String(e&&e.message||e))) console.warn('D1 visit write deferred; offline cache retained',e); else centralAppVisitsUnsupported=true; }
        finally{ centralAppVisitWriteInFlight=false; }
    }
    function fillAppVisitYears(){ const select=document.getElementById('appVisitYear');if(!select)return;const current=new Date().getFullYear();const years=new Set([current]);Object.values(centralAppVisits).forEach(days=>Object.keys(days||{}).forEach(k=>years.add(Number(String(k).slice(0,4)))));const selected=select.value||String(current);select.innerHTML=[...years].sort((a,b)=>b-a).map(y=>`<option value="${y}">${y}</option>`).join('');select.value=years.has(Number(selected))?selected:String(current); }
    function viewerIsAdmin(){
        try {
            const session=currentUnifiedSession()||{};
            const name=session.userName||localStorage.getItem('currentUser')||'';
            if (typeof isAdminUser==='function' && isAdminUser(name)) return true;
            if (String(name).trim()==='admin' || String(name).trim()==='مسؤول') return true;
            if (session.isAdmin===true && localStorage.getItem('unifiedSessionRole')==='admin') return true;
        } catch(e) {}
        return false;
    }
    function visibleVisitUsers(session){
        const admin=viewerIsAdmin();
        const self=session?.userName;
        if(!admin) return self?[self]:[];
        const unifiedNames=(typeof getUnifiedUsers==='function'?getUnifiedUsers():(typeof safeUsers==='function'?safeUsers():[])).map(u=>u&&u.userName).filter(Boolean);
        return [...new Set([...unifiedNames, ...Object.keys(centralAppVisits||{})])].filter(Boolean);
    }
    function renderAppVisitDashboard(){
        const box=document.getElementById('appVisitDashboard'),session=currentUnifiedSession();if(!box||!session?.userName)return;
        readCentralAppVisits(); box.style.display='block'; fillAppVisitYears(); const range=document.getElementById('appVisitRange')?.value||'day',year=document.getElementById('appVisitYear')?.value||new Date().getFullYear();
        const admin=viewerIsAdmin();
        const visible=visibleVisitUsers(session);
        const sumFor=(r)=>visible.reduce((s,u)=>s+visitsForUser(u,r,year).total,0);
        document.getElementById('appVisitsToday').textContent=formatVisitNumber(admin?sumFor('day'):visitsForUser(session.userName,'day',year).total);
        document.getElementById('appVisitsWeek').textContent=formatVisitNumber(admin?sumFor('week'):visitsForUser(session.userName,'week',year).total);
        document.getElementById('appVisitsMonth').textContent=formatVisitNumber(admin?sumFor('month'):visitsForUser(session.userName,'month',year).total);
        document.getElementById('appVisitsYear').textContent=formatVisitNumber(admin?sumFor('year'):visitsForUser(session.userName,'year',year).total); document.getElementById('appVisitsYearLabel').textContent=admin?`دخول الكل سنة ${year}`:`دخول سنة ${year}`;
        const rows=visible.map(name=>({name,data:visitsForUser(name,range,year)})).sort((a,b)=>b.data.total-a.data.total); const total=rows.reduce((s,r)=>s+r.data.total,0); const body=document.getElementById('appVisitUsersBody');
        body.innerHTML=rows.length?rows.map(r=>`<tr><td><span class="app-visit-user-name"><span class="app-visit-avatar">${String(r.name).slice(0,1)}</span>${r.name}</span></td><td>${range==='day'?'اليوم':range==='week'?'الأسبوع':range==='month'?'الشهر':year}</td><td>${formatVisitNumber(r.data.total)}</td><td><button class="app-visit-mini-share" onclick="shareAppVisitStats('${String(r.name).replace(/'/g,"\\'")}')"><i class="fab fa-whatsapp"></i></button></td></tr>`).join(''):`<tr><td colspan="4" style="text-align:center;color:#94a3b8">لا توجد زيارات مسجلة بعد</td></tr>`;
        const chartUsers=admin?visible:[session.userName], hours=Array(24).fill(0);chartUsers.forEach(u=>visitsForUser(u,range,year).hours.forEach((v,i)=>hours[i]+=v));const max=Math.max(...hours,1);const chart=document.getElementById('appVisitHours');chart.innerHTML=hours.map((v,i)=>`<div class="app-visit-hour" title="${String(i).padStart(2,'0')}:00 — ${formatVisitNumber(v)}" style="height:${Math.max(v?7:2,Math.round(v/max*100))}%"><span>${i%3===0?String(i).padStart(2,'0'):''}</span></div>`).join('');
        document.getElementById('appVisitAccessNote').textContent=admin?`أنت مسؤول التطبيق — تعرض هذه اللوحة ${formatVisitNumber(total)} دخولًا ضمن الفترة المحددة لجميع الحسابات.`:'تظهر لك إحصائيات حسابك فقط، بينما يحتفظ المسؤول بعرض شامل لجميع الحسابات.';
        document.getElementById('appVisitSubtitle').textContent=admin?'لوحة مركزية لجميع زيارات التطبيق مع مشاركة تقرير أي حساب':'ملخص دخولك إلى التطبيق بالكامل، وليس قسم المخزون فقط';
    }
    function shareAppVisitStats(userName){
        const session=currentUnifiedSession(); const admin=viewerIsAdmin(); const name=admin&&userName?userName:session?.userName;if(!name)return;
        if(!admin && name!==session?.userName) return;
        const year=document.getElementById('appVisitYear')?.value||new Date().getFullYear(),range=document.getElementById('appVisitRange')?.value||'day';const d=visitsForUser(name,range,year);const today=visitsForUser(name,'day',year).total,week=visitsForUser(name,'week',year).total,month=visitsForUser(name,'month',year).total,annual=visitsForUser(name,'year',year).total;
        const msg=`📊 تقرير دخول التطبيق\n👤 الحساب: ${name}\n📅 اليوم: ${today}\n🗓️ الأسبوع: ${week}\n📆 الشهر: ${month}\n📌 سنة ${year}: ${annual}\n🔎 الفترة المحددة: ${d.total}`;
        if (typeof openExternalFromShell==='function') openExternalFromShell(`https://wa.me/?text=${encodeURIComponent(msg)}`);
        else window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
    }
    window.renderAppVisitDashboard = renderAppVisitDashboard;
    window.shareAppVisitStats = shareAppVisitStats;

    function showSelectionAfterLogin() {
        try { setTimeout(function(){ if (window.__preloadSystemsIdle) window.__preloadSystemsIdle(); }, 900); } catch(e) {}
        try { loadCentralAppVisits().then(()=>recordCentralAppVisit()).catch(()=>recordCentralAppVisit()); } catch(e) {}
        updateSelUserUI();
        try { if(window.__refreshUnifiedAccountUI) window.__refreshUnifiedAccountUI(); } catch(e) {}

        // إن كان خيار "تذكر آخر قسم" مفعّلاً وكان هناك قسم محفوظ → افتحه مباشرة
        let saved = null;
        try { saved = localStorage.getItem('currentSystem'); } catch(e) {}
        if (getPref('keepLastSystem', false) && (saved === 'inventory' || saved === 'maintenance')) {
            const invF = document.getElementById('inventoryFrame');
            const mainF = document.getElementById('maintenanceFrame');
            if (invF) invF.classList.remove('active');
            if (mainF) mainF.classList.remove('active');
            const sel = document.getElementById('selectionScreen');
            if (sel) sel.classList.remove('visible');
            // تأخير بسيط حتى يكتمل رسم الواجهة ثم فتح القسم
            setTimeout(function(){ openSystem(saved); }, 80);
            return;
        }

        currentSystem = null;
        try { localStorage.removeItem('currentSystem'); } catch(e) {}

        const invF = document.getElementById('inventoryFrame');
        const mainF = document.getElementById('maintenanceFrame');
        if (invF) invF.classList.remove('active');
        if (mainF) mainF.classList.remove('active');

        const sel = document.getElementById('selectionScreen');
        sel.classList.add('visible');

        try {
            if (typeof ensureSelectionHistoryRoot === 'function') {
                ensureSelectionHistoryRoot();
            } else {
                history.replaceState({screen:'selection', root:1}, '', '#selection');
                history.pushState({screen:'selection', root:1}, '', '#selection');
            }
        } catch(e) {}

        window.scrollTo(0, 0);
        try {
            const sel = document.getElementById('selectionScreen');
            if (sel) sel.scrollTop = 0;
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        } catch(e) {}
        lockSelectionScroll();
    }

    // سجل تنقل الغلاف: شاشة اختيار النظام هي الجذر الحقيقي للتطبيق.
    // نضيف عنصرين منذ البداية (وليس عنصرًا واحدًا) حتى تكون
    // webView.canGoBack() = true من أول لحظة تشغيل. لو بقي عنصر واحد فقط،
    // فإن أندرويد يعتبر أنه "لا مزيد من الرجوع" ويُغلق التطبيق مباشرة من أول
    // ضغطة فعلية على زر الرجوع، قبل أن يصل الحدث إلى كود JavaScript أصلاً.
    ensureSelectionHistoryRoot();

    /* ——— تحميل القسمين من ملفين حقيقيين، ثم نفس حقن الجلسة عبر srcdoc ——— */
    function systemFileFor(type) {
        return type === 'inventory' ? 'inventory.html' : 'maintenance.html';
    }
    async function readSystemHtml(type) {
        if (frameHtmlCache[type]) return frameHtmlCache[type];
        const res = await fetch(systemFileFor(type), { cache: 'no-cache' });
        if (!res.ok) throw new Error('system file ' + res.status);
        let html = await res.text();
        if (type === 'inventory') html = html.split('__ADMIN_DEFAULT_SECRET__').join(adminLocalSecret());
        frameHtmlCache[type] = html;
        return html;
    }
    function mountSystemFrame(type, html) {
        const fr = document.getElementById(type === 'inventory' ? 'inventoryFrame' : 'maintenanceFrame');
        if (!fr) return;
        fr.onload = function() {
            hideFrameLoading();
            if (type === 'maintenance') {
                try {
                    const b = fr.contentDocument && fr.contentDocument.body;
                    const h = fr.contentDocument && fr.contentDocument.documentElement;
                    if (b && (!b.getAttribute('data-theme') || b.getAttribute('data-theme') === 'dark')) {
                        let saved = null;
                        try { saved = fr.contentWindow.localStorage.getItem('selectedTheme') || fr.contentWindow.localStorage.getItem('theme'); } catch(e) {}
                        const t = (saved && saved !== 'dark') ? saved : 'green';
                        b.setAttribute('data-theme', t);
                        if (h) h.setAttribute('data-theme', t);
                    }
                } catch(e) {}
            }
            applyDarkModeToFrame(fr, getPref('darkMode', false));
            injectScrollPerfIntoFrame(fr);
            hideInnerLogoutButton(fr);
            try { injectUserSyncIntoFrame(fr); } catch(e) {}
            try { window.__markSplashPreloadReady(type); } catch(e) {}
            fr.onload = null;
        };
        fr.srcdoc = (window.decorateFrameHtml ? decorateFrameHtml(html, type) : html);
        framesLoaded[type] = true;
        setTimeout(hideFrameLoading, 2800);
    }
    function loadFrame(type) {
        if (type !== 'inventory' && type !== 'maintenance') return;
        if (framesLoaded[type]) return;
        if (frameHtmlCache[type + 'Loading']) return;
        frameHtmlCache[type + 'Loading'] = true;
        showFrameLoading(type === 'inventory' ? 'جارِ تجهيز نظام المخزون...' : 'جارِ تجهيز نظام الصيانة...');
        readSystemHtml(type).then(html => {
            frameHtmlCache[type + 'Loading'] = false;
            mountSystemFrame(type, html);
        }).catch(err => {
            frameHtmlCache[type + 'Loading'] = false;
            framesLoaded[type] = false;
            hideFrameLoading();
            console.warn('system load failed', type, err);
        });
    }

        // 🔗 إعادة مزامنة القسمين مع حالة الدخول الموحّد فور تسجيل الدخول.
    // القسمان قد يكونان قد حُمّلا مسبقاً في الخلفية (قبل تسجيل الدخول)، فتُعاد إعادة
    // تحميلهما هنا فقط كي تقرأ نصوصهما البرمجية بيانات الجلسة الجديدة من localStorage
    // ولا يُطلب تسجيل الدخول مرة أخرى داخل أي منهما.
    function resyncEmbeddedFramesLoginState() {
        ['inventory', 'maintenance'].forEach(type => {
            const html = frameHtmlCache[type];
            if (!html || !framesLoaded[type]) return; // لم يُحمَّل بعد؛ سيقرأ الجلسة بشكل صحيح عند أول فتح
            const fr = document.getElementById(type === 'inventory' ? 'inventoryFrame' : 'maintenanceFrame');
            if (!fr) return;
            try { injectUserSyncIntoFrame(fr); } catch(e) {}
            try { if (fr.contentWindow) fr.contentWindow.postMessage({type:'athir-login-refresh'}, '*'); } catch(e) {}
        });
    }

    /* ===== تحميل النظامين في الخلفية أثناء شاشة البداية =====
       يبدأ فور تشغيل التطبيق، ولا يحتاج المستخدم لفتح أي بطاقة.
       شاشة البداية تعرض تقدماً منسقاً مع جاهزية النظامين. */
    const splashPreloadState = {
        inventory: false,
        maintenance: false,
        startedAt: Date.now()
    };

    window.__markSplashPreloadReady = function(type) {
        if (!splashPreloadState.hasOwnProperty(type)) return;
        if (splashPreloadState[type]) return;

        splashPreloadState[type] = true;
        const statusId = type === 'inventory' ? 'splashInventoryStatus' : 'splashMaintenanceStatus';
        const statusCard = document.getElementById(statusId);
        if(statusCard){ statusCard.classList.add('ready'); const icon=statusCard.querySelector('i'); if(icon)icon.className='fas fa-check-circle'; }
        const bar = document.querySelector('.splash-loader-bar');
        const progress = (splashPreloadState.inventory ? 50 : 0) +
                         (splashPreloadState.maintenance ? 50 : 0);

        // شريط الشاشة الافتتاحية غير محدد (indeterminate): لا نربطه بنسبة
        // جاهزية الأنظمة حتى لا يقفز إلى النهاية أو يتوقف قبل الانتقال.
        if (bar) {
            bar.style.width = '38%';
            bar.style.animation = 'splashFireSweep 1.05s cubic-bezier(.45,0,.35,1) infinite';
        }
    };

    function preloadSystemsDuringSplash() {
        const bar = document.querySelector('.splash-loader-bar');
        if (bar) {
            bar.style.animation = 'splashFireSweep 1.05s cubic-bezier(.45,0,.35,1) infinite';
            bar.style.transform = 'translateX(-125%)';
        }

        // لا نفك/نبني iframes الثقيلة أثناء شاشة البداية. كلا القسمين يُحمّلان
        // عند الطلب، ويمكن للمخزون أن يُجهّز لاحقاً في وقت خمول بعد الإقلاع.
        const deferSystems = () => {
            if (currentSystem) return;
            // قبل تسجيل الدخول لا نحمّل شيئاً: كان الإطاران يُحمَّلان ثم يُعاد تحميلهما بعد الدخول
            if (typeof isUnifiedLoggedIn === 'function' && !isUnifiedLoggedIn()) return;
            try { if (!framesLoaded.inventory) loadFrame('inventory'); } catch(e) { console.warn('Inventory idle preload:', e); }
            // الصيانة بعد أن يستقر تحميل المخزون (تحميل الاثنين معاً يجمّد الواجهة)
            setTimeout(() => {
                if (currentSystem) return;
                try { if (!framesLoaded.maintenance) loadFrame('maintenance'); } catch(e) { console.warn('Maintenance idle preload:', e); }
            }, 2500);
        };
        window.__preloadSystemsIdle = deferSystems;
        const scheduleIdleSystems = () => {
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(deferSystems, { timeout: 5000 });
            } else {
                deferSystems();
            }
        };
        setTimeout(scheduleIdleSystems, 450);
    }


    /* ——— Splash + background preload ——— */
    let splashHidden = false;

    function hideSplash() {
        if (splashHidden) return;
        splashHidden = true;

        const splash = document.getElementById('splashScreen');
        if (!splash) return;

        // لا نوقف شريط التحميل ولا نمدده إلى 100%؛ يبقى متحركاً حتى اختفاء الشاشة.
        splash.classList.add('fade-out');

        setTimeout(() => {
            if (splash && splash.parentNode) splash.remove();

            if (isUnifiedLoggedIn()) {
                showSelectionAfterLogin();
            } else {
                document.getElementById('unifiedLoginScreen').style.display = 'flex';
            }
        }, 650);
    }

    // يبدأ تحميل المخزون والصيانة فوراً خلف شاشة البداية.
    // لا ننتظر فتح البطاقات، والحد الأقصى يمنع بقاء شاشة البداية معلقة بسبب الشبكة.
    preloadSystemsDuringSplash();

    // زمن طبيعي قصير للشاشة مع السماح للتحميل الخلفي بالاستفادة من كامل الفترة.
    // زمن طبيعي قصير للشاشة مع السماح للتحميل الخلفي بالاستفادة من كامل الفترة.
    setTimeout(hideSplash, 3050);

    // إغلاق النوافذ المنبثقة من لوحة المفاتيح/زر الرجوع بدون إعادة رسم الصفحة.
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && __settingsOpen) { e.preventDefault(); closeSettings(); }
    }, { passive: false });
    window.addEventListener('online', updateSettingsSummary, { passive: true });
    window.addEventListener('offline', updateSettingsSummary, { passive: true });

    // ===== Init enhanced prefs & UI bindings =====
    (function initEnhancedUI(){
        // restore prefs
        applyDarkMode(getPref('darkMode', false));
        if (getPref('reduceMotion', false)) applyReduceMotion(true);

        document.addEventListener('DOMContentLoaded', () => {
            const darkBtn = document.getElementById('btnToggleDark');
            if (darkBtn) darkBtn.addEventListener('click', () => applyDarkMode(!document.documentElement.classList.contains('dark-mode')));
            const setBtn = document.getElementById('btnOpenSettings');
            if (setBtn) setBtn.addEventListener('click', openSettings);
            const setDark = document.getElementById('setDarkMode');
            if (setDark) setDark.addEventListener('change', (e) => applyDarkMode(e.target.checked));
            const setMotion = document.getElementById('setReduceMotion');
            if (setMotion) setMotion.addEventListener('change', (e) => applyReduceMotion(e.target.checked));
            const setKeep = document.getElementById('setKeepLastSystem');
            if (setKeep) setKeep.addEventListener('change', (e) => setPref('keepLastSystem', e.target.checked));
            updateSelUserUI();
        });
        // also bind immediately if already loaded
        if (document.readyState !== 'loading') {
            setTimeout(() => {
                const darkBtn = document.getElementById('btnToggleDark');
                if (darkBtn && !darkBtn._bound) { darkBtn._bound = 1; darkBtn.addEventListener('click', () => applyDarkMode(!document.documentElement.classList.contains('dark-mode'))); }
                const setBtn = document.getElementById('btnOpenSettings');
                if (setBtn && !setBtn._bound) { setBtn._bound = 1; setBtn.addEventListener('click', openSettings); }
                updateSelUserUI();
            }, 100);
        }
    })();

    // جلب قائمة الموظفين الحقيقية من السحابة بالخلفية فور فتح التطبيق (بدون انتظار)
    if (!isUnifiedLoggedIn()) { fetchCloudUsersAndMerge().then(() => { cloudUsersFetched = true; }); }
    // دعم مفتاح Enter لتسجيل الدخول
    document.addEventListener('DOMContentLoaded', () => {
        const passEl = document.getElementById('unifiedLoginPass');
        if (passEl) passEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') unifiedLogin(); });
    });

    /* ——— فتح نظام سريع: أظهر الحالة أولاً ثم نفّذ الأعمال الثقيلة في frame لاحق ——— */
    let sectionOpenFrame = 0;
    
    function injectUserSyncIntoFrame(frame){
        try{
            if(!frame||!frame.contentWindow) return;
            const list=(function(){
                try{return JSON.parse(localStorage.getItem('unifiedUsers')||'[]');}catch(e){return[];}
            })().filter(u=>u&&u.userName&&u.userName!=='مسؤول');
            const w=frame.contentWindow;
            // أرسل فوراً
            try{ w.postMessage({type:'forceReplaceUsers', users:list}, '*'); }catch(e){}
            try{ w.postMessage({type:'unifiedUsersUpdated', users:list}, '*'); }catch(e){}
            // حقن مستمع داخل الإطار إن أمكن
            try{
                const doc=frame.contentDocument;
                if(doc && !doc.getElementById('shell-user-sync-hook')){
                    const s=doc.createElement('script');
                    s.id='shell-user-sync-hook';
                    s.textContent=`(function(){
                        function applyUsers(users){
                            try{
                                if(!Array.isArray(users)) return;
                                var clean=users.filter(function(u){return u&&u.userName&&u.userName!=='\\u0645\\u0633\\u0624\\u0648\\u0644';});
                                try{ localStorage.setItem('unifiedUsers', JSON.stringify(clean)); }catch(e){}
                                // مخزون
                                try{
                                    var inv=clean.map(function(u){return {userName:u.userName, pin:u.secret||u.pin, isAdmin:!!u.isAdmin};});
                                    localStorage.setItem('mudPumpUsers', JSON.stringify(inv));
                                    if(typeof users!=='undefined'){ try{ users=inv; }catch(e){} }
                                }catch(e){}
                                // صيانة
                                try{
                                    var emp={};
                                    clean.forEach(function(u){ emp[u.userName]=u.secret||u.pin; });
                                    var md=null;
                                    try{ md=JSON.parse(localStorage.getItem('maintenanceData')||'null'); }catch(e){}
                                    if(md&&typeof md==='object'){ md.registeredEmployees=emp; localStorage.setItem('maintenanceData', JSON.stringify(md)); }
                                    if(typeof registeredEmployees!=='undefined'){
                                        try{
                                            Object.keys(registeredEmployees).forEach(function(k){ if(!emp[k]) delete registeredEmployees[k]; });
                                            Object.keys(emp).forEach(function(k){ registeredEmployees[k]=emp[k]; });
                                        }catch(e){}
                                    }
                                }catch(e){}
                            }catch(e){}
                        }
                        window.addEventListener('message', function(ev){
                            if(!ev||!ev.data) return;
                            if(ev.data.type==='forceReplaceUsers'||ev.data.type==='unifiedUsersUpdated'){
                                applyUsers(ev.data.users||[]);
                            }
                        });
                    })();`;
                    (doc.head||doc.documentElement).appendChild(s);
                }
            }catch(e){}
        }catch(e){}
    }

    // ===== System Controller v2 — انتقال فوري وآمن بين النظامين =====
    const SystemController = window.SystemController = (window.SystemController || {
        busy: false,
        lastSwitchAt: 0,
        switchToken: 0,
        open(type, opts) {
            if (type !== 'inventory' && type !== 'maintenance') return;
            const now = performance.now();
            // منع النقرات المكررة السريعة التي كانت تسبب إعادة ترتيب الـiframes.
            if (this.busy && now - this.lastSwitchAt < 450) return;
            if (currentSystem === type && !opts?.force) return;
            this.busy = true;
            this.lastSwitchAt = now;
            const token = ++this.switchToken;
            const sel = document.getElementById('selectionScreen');
            const invF = document.getElementById('inventoryFrame');
            const mainF = document.getElementById('maintenanceFrame');
            const target = type === 'inventory' ? invF : mainF;
            const other = type === 'inventory' ? mainF : invF;
            if (!sel || !target || !other) { this.busy = false; return; }

            closeSettings(true);
            unlockSelectionScroll();
            document.documentElement.classList.add('system-switching');
            document.body.classList.add('system-switching');
            sel.classList.remove('visible');

            // لا نخفي الإطار القديم قبل تجهيز الهدف إذا كان الهدف جاهزاً؛
            // هذا يلغي الوميض الأبيض بين المخزون والصيانة.
            const ready = type === 'inventory' ? framesLoaded.inventory : framesLoaded.maintenance;
            if (!ready) showFrameLoading(type === 'inventory' ? 'جارِ تجهيز نظام المخزون...' : 'جارِ تجهيز نظام الصيانة...');
            else hideFrameLoading();

            // انتقال هرمي حقيقي: selection -> inventory/maintenance.
            // pushState مهم هنا؛ replaceState كان يجعل ضغطة الرجوع تسقط مباشرة
            // إلى جذر WebView في بعض الأجهزة.
            const previousSystem = currentSystem;
            currentSystem = type;
            try {
                if (previousSystem !== type) {
                    AppNavigation.enter(type);
                    history.pushState({screen:type, parent:'selection', guard:1}, '', '#' + type);
                } else {
                    history.replaceState({screen:type, parent:'selection', guard:1}, '', '#' + type);
                }
            } catch(e) {}
            try {
                document.documentElement.classList.add('app-open');
                document.body.classList.add('app-open');
                window.scrollTo(0,0);
                if (getPref('keepLastSystem', false)) localStorage.setItem('currentSystem', type);
                else localStorage.removeItem('currentSystem');
            } catch(e) {}

            requestAnimationFrame(() => {
                if (token !== this.switchToken) return;
                try {
                    // يبقى الإطار السابق موجوداً أثناء تجهيز الهدف، ثم يستبدل فوراً.
                    if (type === 'maintenance' && !framesLoaded.maintenance) loadFrame('maintenance');
                    if (type === 'inventory' && !framesLoaded.inventory) loadFrame('inventory');
                    other.classList.remove('active');
                    target.classList.add('active');
                    applyDarkModeToFrame(target, getPref('darkMode', false));
                    injectScrollPerfIntoFrame(target);
                    injectUserSyncIntoFrame(target);
                    hideInnerLogoutButton(target);
                    try { if (target.contentWindow && target.contentWindow.__athirOnShow) target.contentWindow.__athirOnShow(); } catch(e) {}
                    if (type === 'maintenance') {
                        requestAnimationFrame(() => {
                            try { if (target.contentWindow && typeof target.contentWindow.renderCharts === 'function') target.contentWindow.renderCharts(); } catch(e) {}
                        });
                    }
                } catch(e) {
                    console.warn('SystemController open:', e);
                } finally {
                    setTimeout(() => {
                        if (token !== this.switchToken) return;
                        hideFrameLoading();
                        document.documentElement.classList.remove('system-switching');
                        document.body.classList.remove('system-switching');
                        this.busy = false;
                    }, ready ? 30 : 120);
                }
            });
        },
        back() {
            return processTopbarBack(false);
        }
    });

    function openSystem(type) { SystemController.open(type); }

    /* ——— تبديل بين النظامين ——— */
    function switchSystem() {
        if (currentSystem === 'inventory') SystemController.open('maintenance');
        else if (currentSystem === 'maintenance') SystemController.open('inventory');
    }

    /* ——— العودة للقائمة ——— */
    function goBackToSelection() {
        // هذه الدالة لا تنفذ خروجًا؛ مهمتها الوحيدة الرجوع من القسم إلى
        // شاشة النظام المتكامل (selection). الخروج لا يحدث إلا من الجذر.
        const sel    = document.getElementById('selectionScreen');

        document.getElementById('inventoryFrame').classList.remove('active');
        document.getElementById('maintenanceFrame').classList.remove('active');
        hideFrameLoading();
        closeSettings();
        try {
            document.documentElement.classList.remove('app-open');
            document.body.classList.remove('app-open');
        } catch(e) {}

        sel.classList.add('visible');

        currentSystem = null;
        AppNavigation.reset('selection');
        try {
            if (!getPref('keepLastSystem', false)) localStorage.removeItem('currentSystem');
        } catch(e) {}
        exitBackArmed = false;
        clearTimeout(exitBackTimer);
        const pendingExitToast = document.getElementById('doubleBackToast');
        if (pendingExitToast) { try { pendingExitToast.remove(); } catch(e) {} }
        // مهم: بعد popstate يكون السجل قد نقص عنصراً. نعيد جذراً مزدوجاً
        // حتى لا يخرج Android من أول رجوع تالٍ، وحتى لا يُغلق التطبيق
        // إذا وصلت الضغطة والعمق كان واحداً أثناء القسم.
        try {
            if (typeof ensureSelectionHistoryRoot === 'function') {
                ensureSelectionHistoryRoot();
            } else {
                history.replaceState({ screen: 'selection', root: 1 }, '', '#selection');
                history.pushState({ screen: 'selection', root: 1 }, '', '#selection');
            }
        } catch(e) {}
        updateSelUserUI();
        window.scrollTo(0, 0);
        try {
            const sel = document.getElementById('selectionScreen');
            if (sel) { sel.scrollTop = 0; }
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        } catch(e) {}
        lockSelectionScroll();
    }

    /* ——— استعادة آخر نظام ——— */
    window.addEventListener('DOMContentLoaded', () => {
        // ملاحظة: استعادة آخر نظام تتم الآن بعد التحقق من تسجيل الدخول
        // داخل hideSplash()/showSelectionAfterLogin() فقط، تفاديًا لفتح
        // قسم قبل التأكد من الجلسة.
    });

    /* Android/WebView back uses the single guarded popstate handler above. */

    // إصلاح استباقي: إذا عاد المستخدم للتطبيق وكان السجل ضحلاً، أعد الحارس.
    try {
        document.addEventListener('visibilitychange', function(){
            if (document.visibilityState !== 'visible') return;
            try {
                if (currentSystem) {
                    history.replaceState({screen: currentSystem, guard: 1}, '', '#' + currentSystem);
                } else if (typeof isUnifiedLoggedIn === 'function' && isUnifiedLoggedIn()) {
                    if (typeof ensureSelectionHistoryRoot === 'function') ensureSelectionHistoryRoot();
                }
            } catch(e) {}
        });
    } catch(e) {}

(function(){
    // يجب تعريف عنوان السحابة داخل هذا النطاق (الـ const الخارجي غير مرئي هنا)
    const CF_WORKER_API = (typeof window !== 'undefined' && window.CF_WORKER_API)
        ? window.CF_WORKER_API
        : "https://snowy-art-30d9.inventory-510.workers.dev";
    const ACC_TIMEOUT=20000;
    let accountBusy=false;
    // استعادة دور الجلسة بعد إعادة فتح التطبيق: نأخذ الدور من سجل الحساب المطابق فقط.
    // لا نعتبر أي مستخدم مسؤولاً لمجرد أن اسمه "مسؤول".
    (function restoreUnifiedSessionRole(){
        try{
            const s=JSON.parse(localStorage.getItem('loggedInUser')||'null');
            if(!s || !s.userName) return;
            if(s.userName==='مسؤول'){
                s.userName='admin';
                s.isAdmin=true;
                localStorage.setItem('loggedInUser',JSON.stringify(s));
                localStorage.setItem('currentUser','admin');
                localStorage.setItem('unifiedSessionRole','admin');
                return;
            }
            if(s.userName==='admin'){
                s.isAdmin=true;
                localStorage.setItem('loggedInUser',JSON.stringify(s));
                localStorage.setItem('unifiedSessionRole','admin');
                return;
            }
            const u=safeUsers().find(x=>x.userName===s.userName);
            if(u) {
                s.isAdmin=!!u.isAdmin;
                localStorage.setItem('loggedInUser',JSON.stringify(s));
                localStorage.setItem('unifiedSessionRole',u.isAdmin?'admin':'employee');
            }
        }catch(e){}
    })();
    function safeUsers(){
        try{
            let x=JSON.parse(localStorage.getItem('unifiedUsers')||'[]');
            if(!Array.isArray(x)) x=[];
            const list=mergeUsersLists([x], { ensureAdmin: true, requireSecret: false });
            try{ localStorage.setItem('unifiedUsers', JSON.stringify(list)); }catch(e){}
            return list;
        }catch(e){
            return mergeUsersLists([[]], { ensureAdmin: true });
        }
    }
    function saveUsers(list){
        try{
            const cleaned=mergeUsersLists([list], { ensureAdmin: true, requireSecret: false });
            localStorage.setItem('unifiedUsers', JSON.stringify(cleaned));
            return cleaned;
        }catch(e){ return list||[]; }
    }
    function currentName(){try{const s=JSON.parse(localStorage.getItem('loggedInUser')||'null');return s?.userName||localStorage.getItem('currentUser')||'';}catch(e){return localStorage.getItem('currentUser')||'';}}
    // صلاحية المسؤول مرتبطة بالجلسة الموثقة، وليس بمجرد اسم المستخدم أو أي isAdmin قديم في localStorage.
    function isAdminUser(name){
        name=String(name||'').trim();
        if(!name)return false;
        // ترحيل الجلسة القديمة
        if(name==='مسؤول') name='admin';
        try{
            const s=JSON.parse(localStorage.getItem('loggedInUser')||'null');
            if(s && (s.userName==='مسؤول')){
                s.userName='admin'; s.isAdmin=true;
                try{ localStorage.setItem('loggedInUser', JSON.stringify(s)); localStorage.setItem('currentUser','admin'); localStorage.setItem('unifiedSessionRole','admin'); }catch(e){}
            }
            if(s && (s.userName===name || (name==='admin' && s.userName==='admin')) && name==='admin'){
                try{ if(s.isAdmin!==true){ s.isAdmin=true; localStorage.setItem('loggedInUser', JSON.stringify(s)); } localStorage.setItem('unifiedSessionRole','admin'); }catch(e){}
                return true;
            }
            if(s && s.userName===name && s.isAdmin===true) return true;
            const sessionRole=localStorage.getItem('unifiedSessionRole');
            if(s && s.userName===name && sessionRole==='admin') return true;
            if(sessionRole==='admin' && name===currentName()) return true;
            const u=(typeof safeUsers==='function'?safeUsers():[]).find(x=>x && x.userName===name);
            if(u && (u.isAdmin || name==='admin')) return true;
        }catch(e){}
        return false;
    }
    function refreshAccountButton(){
        const allowed=isAdminUser(currentName());
        const b=document.getElementById('btnOpenAccounts');
        if(b){
            b.style.display=allowed?'flex':'none';
            b.setAttribute('aria-hidden',allowed?'false':'true');
            b.tabIndex=allowed?0:-1;
        }
        const row=document.getElementById('settingsAccountsRow');
        if(row) row.style.display=allowed?'block':'none';
        // احتياط إضافي: إغلاق لوحة الحسابات فوراً إذا تغيرت الصلاحية إلى موظف.
        if(!allowed){
            const ov=document.getElementById('accountOverlay');
            if(ov) ov.classList.remove('show');
        }
    }
    function showAccNotice(title,msg,type){
        try{
            const old=document.getElementById('accountToast');
            if(old) old.remove();
            const d=document.createElement('div');
            d.id='accountToast';
            const isWarn = type==='warning' || type==='error';
            const isOk = type==='success';
            const bg = isOk ? 'linear-gradient(135deg,#059669,#10b981)' : (isWarn ? 'linear-gradient(135deg,#d97706,#f59e0b)' : 'linear-gradient(135deg,#0f172a,#1e293b)');
            d.textContent=(title?title+' — ':'')+msg;
            d.style.cssText='position:fixed;left:50%;bottom:max(28px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483646;background:'+bg+';color:#fff;padding:13px 20px;border-radius:24px;font-size:13px;font-weight:800;box-shadow:0 12px 36px rgba(0,0,0,.35);max-width:92vw;text-align:center;pointer-events:none;direction:rtl;';
            document.body.appendChild(d);
            setTimeout(function(){ try{ d.remove(); }catch(e){} }, 3200);
        }catch(e){ try{ alert((title?title+' — ':'')+msg); }catch(e2){} }
    }
    async function fetchJson(url,opts={}){
        if(!url || String(url).includes('undefined')){
            return {ok:false,status:0,data:null,error:'bad_url'};
        }
        const c=new AbortController();
        const timer=setTimeout(()=>c.abort(), ACC_TIMEOUT);
        try{
            const r=await fetch(url,{...opts, signal:c.signal});
            let data=null;
            try{ data=await r.json(); }catch(e){}
            return {ok:r.ok, status:r.status, data};
        }catch(e){
            const aborted = e && (e.name==='AbortError' || e.code===20);
            return {ok:false, status:0, data:null, error: aborted?'timeout':(e&&e.message)||'fetch_failed'};
        }finally{
            clearTimeout(timer);
        }
    }
    async function loadAllAccountSources(){
        let workerUsers=[];
        try{const r=await fetchJson(`${CF_WORKER_API}/users`);if(r.ok)workerUsers=(r.data?.users||[]).filter(u=>u?.userName&&u?.secret).map(u=>({userName:u.userName,secret:u.secret,isAdmin:!!u.isAdmin}));}catch(e){}
        const local=safeUsers();
        const pending=localStorage.getItem('unifiedUsersPendingSync')==='1';
        if(pending && local.length){
            refreshAccountButton();
            return local.filter(u=>u.userName!=='مسؤول');
        }
        const map=new Map();
        workerUsers.forEach(u=>{
            if(!u||!u.userName) return;
            // تجاهل المسؤول العربي — نعتمد admin فقط
            if(u.userName==='مسؤول') return;
            map.set(u.userName,{userName:u.userName,secret:u.secret,isAdmin:!!u.isAdmin || u.userName==='admin'});
        });
        local.forEach(u=>{if(u&&u.userName&&u.userName!=='مسؤول'&&!map.has(u.userName))map.set(u.userName,u);});
        map.delete('alhwas');
        // ضمان admin
        if(!map.has('admin')){
            map.set('admin',{userName:'admin',secret:adminLocalSecret(),isAdmin:true,section:'both'});
        } else {
            map.get('admin').isAdmin=true;
        }
        const merged=[...map.values()];
        if(merged.length) saveUsers(merged);
        refreshAccountButton();
        return merged;
    }
    function getUnifiedAdminHeaders(){
        try{
            const s=JSON.parse(localStorage.getItem('loggedInUser')||'null');
            if(!s||!s.userName)return null;
            let secret=String(s.pin||s.secret||'').trim();
            if(!secret){
                const u=safeUsers().find(x=>x.userName===s.userName);
                if(u) secret=String(u.secret||u.pin||'').trim();
            }
            // احتياط أخير: كلمة سر المسؤول الافتراضية إن كان الحساب مسؤول
            if(!secret && (s.userName==='مسؤول'||s.userName==='admin')){
                const u=safeUsers().find(x=>x.userName==='مسؤول'||x.userName==='admin');
                if(u) secret=String(u.secret||u.pin||'').trim();
            }
            if(!secret)return null;
            let admin=!!s.isAdmin;
            if(!admin){
                const role=localStorage.getItem('unifiedSessionRole');
                if(role==='admin') admin=true;
            }
            if(!admin){
                const u=safeUsers().find(x=>x.userName===s.userName);
                if(u&&u.isAdmin) admin=true;
            }
            if(!admin && (s.userName==='مسؤول'||s.userName==='admin')) admin=true;
            if(!admin)return null;
            return {
                'Content-Type':'application/json',
                'X-Admin-User':String(s.userName),
                'X-Admin-Secret':String(secret)
            };
        }catch(e){return null;}
    }

    // رفع مباشر عبر XHR كبديل إن فشل fetch (بعض متصفحات الجوال)
    function xhrJson(method, url, headers, body){
        return new Promise((resolve)=>{
            try{
                const xhr=new XMLHttpRequest();
                xhr.open(method, url, true);
                xhr.timeout=ACC_TIMEOUT;
                if(headers){
                    Object.keys(headers).forEach(k=>{
                        try{ xhr.setRequestHeader(k, headers[k]); }catch(e){}
                    });
                }
                xhr.onload=function(){
                    let data=null;
                    try{ data=JSON.parse(xhr.responseText||'{}'); }catch(e){}
                    resolve({ok:xhr.status>=200&&xhr.status<300, status:xhr.status, data});
                };
                xhr.onerror=function(){ resolve({ok:false, status:0, data:null, error:'xhr_error'}); };
                xhr.ontimeout=function(){ resolve({ok:false, status:0, data:null, error:'timeout'}); };
                xhr.send(body?body:null);
            }catch(e){
                resolve({ok:false, status:0, data:null, error:(e&&e.message)||'xhr_fail'});
            }
        });
    }

    function toB64Utf8(str){
        try{
            return 'b64:' + btoa(unescape(encodeURIComponent(String(str||''))));
        }catch(e){
            try{ return 'b64:' + btoa(String(str||'')); }catch(e2){ return String(str||''); }
        }
    }

    async function writeWorkerUsers(list, action, originalName) {
        const API = "https://snowy-art-30d9.inventory-510.workers.dev";
        if (!action) action = 'add';

        function toB64Utf8(str) {
            try { return 'b64:' + btoa(unescape(encodeURIComponent(String(str || '')))); }
            catch (e) { try { return 'b64:' + btoa(String(str || '')); } catch (e2) { return String(str || ''); } }
        }

        function getAdminAuth() {
            try {
                const s = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
                if (!s || !s.userName) return null;
                let secret = String(s.pin || s.secret || '').trim();
                if (!secret) {
                    const u = safeUsers().find(x => x.userName === s.userName);
                    if (u) secret = String(u.secret || u.pin || '').trim();
                }
                if (!secret) return null;
                let admin = !!s.isAdmin || localStorage.getItem('unifiedSessionRole') === 'admin';
                if (!admin) {
                    const u = safeUsers().find(x => x.userName === s.userName);
                    if (u && u.isAdmin) admin = true;
                }
                if (!admin && (s.userName === 'admin' || s.userName === 'مسؤول')) admin = true;
                if (!admin) return null;
                return { userName: s.userName, secret };
            } catch (e) { return null; }
        }

        const auth = getAdminAuth();
        if (!auth) {
            return { ok: false, reason: 'no_auth', message: 'تعذر التحقق من صلاحية المسؤول' };
        }

        let method, endpoint, payload;
        if (action === 'delete') {
            method = 'DELETE';
            endpoint = API + '/users/delete';
            payload = JSON.stringify({ userName: originalName, adminAuth: auth });
        } else if (action === 'update') {
            method = 'PUT';
            endpoint = API + '/users/update';
            payload = JSON.stringify({ originalUserName: originalName, user: list[0], adminAuth: auth });
        } else {
            method = 'POST';
            endpoint = API + '/users/add';
            payload = JSON.stringify({ user: list[0], adminAuth: auth });
        }

        const headers = {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Admin-User': toB64Utf8(auth.userName),
            'X-Admin-Secret': toB64Utf8(auth.secret)
        };

        try {
            let r = await fetchJson(endpoint, { method, headers, body: payload });
            if (r && r.ok) return { ok: true, reason: 'synced', message: (r.data && r.data.message) || 'تمت المزامنة' };
            let x = await xhrJson(method, endpoint, headers, payload);
            if (x && x.ok) return { ok: true, reason: 'synced_xhr', message: (x.data && x.data.message) || 'تمت المزامنة' };
            return {
                ok: false,
                status: (r && r.status) || (x && x.status) || 0,
                message: (r && r.data && r.data.message) || (x && x.data && x.data.message) || 'فشل الاتصال بالسحابة'
            };
        } catch (e) {
            return { ok: false, reason: 'exception', message: (e && e.message) || 'خطأ غير متوقع' };
        }
    }

    // === منع عودة المحذوفين: مزامنة الحذف لكل التخزين المحلي + بيانات الأقسام ===
    function propagateUnifiedUsersToAllApps(list){
        try{
            list = mergeUsersLists([list], { ensureAdmin: true, requireSecret: false });
            saveUsers(list);

            const allowed=new Set(list.map(u=>u.userName));

            // 1) مستخدمو المخزون المحلي
            try{
                let invUsers=JSON.parse(localStorage.getItem('mudPumpUsers')||'[]');
                if(!Array.isArray(invUsers)) invUsers=[];
                invUsers=list.map(u=>({userName:u.userName, pin:u.secret, isAdmin:!!u.isAdmin}));
                localStorage.setItem('mudPumpUsers', JSON.stringify(invUsers));
            }catch(e){}

            // 2) بيانات المخزون داخل الحزمة السحابية المحلية
            try{
                let invData=JSON.parse(localStorage.getItem('inventoryData')||'null');
                // inventoryData قد يكون مصفوفة قطع أو كائن
                // users تُحفظ أيضاً داخل الحزمة عند الرفع — نحدّث مفتاحاً منفصلاً إن وُجد
            }catch(e){}

            // 3) registeredEmployees في الصيانة
            try{
                const emp={};
                list.forEach(u=>{ emp[u.userName]=u.secret; });
                // حدّث maintenanceData إن وُجد
                let md=null;
                try{ md=JSON.parse(localStorage.getItem('maintenanceData')||'null'); }catch(e){}
                if(md && typeof md==='object'){
                    md.registeredEmployees=emp;
                    // راقب المحذوفين
                    if(!Array.isArray(md.deletedEmployees)) md.deletedEmployees=[];
                    // أي اسم كان موجوداً سابقاً ولم يعد مسموحاً → deleted
                    localStorage.setItem('maintenanceData', JSON.stringify(md));
                }
                // مفتاح المحذوفين الخاص بالقسم
                let deleted=[];
                try{ deleted=JSON.parse(localStorage.getItem('maintenanceDeletedEmployees')||'[]'); }catch(e){}
                if(!Array.isArray(deleted)) deleted=[];
                // لا نعرف القديمة هنا بدقة؛ نكتفي بالدفع عبر postMessage
                localStorage.setItem('maintenanceRegisteredEmployees', JSON.stringify(emp));
            }catch(e){}

            // 4) أخبر الـ iframes فوراً
            try{
                ['inventoryFrame','maintenanceFrame'].forEach(id=>{
                    const f=document.getElementById(id);
                    if(f&&f.contentWindow){
                        f.contentWindow.postMessage({type:'unifiedUsersUpdated', users:list}, '*');
                        f.contentWindow.postMessage({type:'forceReplaceUsers', users:list}, '*');
                    }
                });
            }catch(e){}

            return list;
        }catch(e){
            console.warn('propagateUnifiedUsersToAllApps', e);
            return list||[];
        }
    }

    async function pushSanitizedCloudUserLists(list){
        // بعد الحذف: ارفع قوائم منظّفة للمخزون والصيانة حتى لا تُرجع السحابة المحذوفين
        const API = (typeof CF_WORKER_API!=='undefined'&&CF_WORKER_API) ? CF_WORKER_API : "https://snowy-art-30d9.inventory-510.workers.dev";
        const allowed=new Set((list||[]).map(u=>u.userName));
        const emp={};
        (list||[]).forEach(u=>{ emp[u.userName]=u.secret||u.pin; });

        // صيانة
        try{
            let mainData=null;
            try{
                const r=await fetch(API+'/maintenance',{headers:{'Accept':'application/json'}});
                if(r.ok){ const j=await r.json(); mainData=j.data||j; }
            }catch(e){}
            if(!mainData || typeof mainData!=='object'){
                try{ mainData=JSON.parse(localStorage.getItem('maintenanceData')||'{}'); }catch(e){ mainData={}; }
            }
            if(!mainData.registeredEmployees) mainData.registeredEmployees={};
            // استبدال كامل بقائمة موحّدة
            mainData.registeredEmployees=Object.assign({}, emp);
            delete mainData.registeredEmployees['مسؤول'];
            if(!mainData.registeredEmployees['admin']) mainData.registeredEmployees['admin']=adminLocalSecret();
            if(!Array.isArray(mainData.deletedEmployees)) mainData.deletedEmployees=[];
            // أضف أي أسماء كانت في السحابة ولم تعد مسموحة
            // (لا نعرف القديمة هنا بعد الاستبدال)
            mainData.lastSync=new Date().toISOString();
            mainData.maintenanceTimestamp=Date.now();
            localStorage.setItem('maintenanceData', JSON.stringify(mainData));
            await fetch(API+'/maintenance',{
                method:'PUT',
                headers:{'Content-Type':'application/json; charset=utf-8'},
                body:JSON.stringify({data:mainData})
            });
        }catch(e){ console.warn('sanitize maintenance failed', e); }

        // مخزون: حدّث users داخل الحزمة
        try{
            let invPayload=null;
            try{
                const r=await fetch(API+'/inventory',{headers:{'Accept':'application/json'}});
                if(r.ok){ const j=await r.json(); invPayload=j.data||j; }
            }catch(e){}
            if(!invPayload || typeof invPayload!=='object'){
                invPayload={
                    inventory: JSON.parse(localStorage.getItem('inventoryData')||'[]'),
                    visitorLogs: JSON.parse(localStorage.getItem('mudPumpVisitorLogs')||'[]'),
                    inventoryLogs: JSON.parse(localStorage.getItem('inventoryLogs')||'[]'),
                    inventoryTimestamp: Number(localStorage.getItem('inventoryTimestamp')||Date.now())
                };
            }
            invPayload.users=(list||[]).map(u=>({userName:u.userName, pin:u.secret||u.pin, isAdmin:!!u.isAdmin}));
            // ارفع الطابع حتى لا يُعتبر جهاز قديم "أحدث" ويعيد المستخدمين
            invPayload.inventoryTimestamp=Date.now();
            try{ localStorage.setItem('inventoryTimestamp', String(invPayload.inventoryTimestamp)); }catch(e){}
            await fetch(API+'/inventory',{
                method:'PUT',
                headers:{'Content-Type':'application/json; charset=utf-8'},
                body:JSON.stringify({data:invPayload})
            });
        }catch(e){ console.warn('sanitize inventory failed', e); }
    }

    async function persistAccounts(list, action, originalName) {
        if (!action) action = 'syncAll';
        if (action === 'syncAll') return true;
        return await writeWorkerUsers(list, action, originalName || null);
    }
    function syncFrames(list){
        try{
            ['inventoryFrame','maintenanceFrame'].forEach(id=>{
                const f=document.getElementById(id);if(!f?.contentWindow)return;
                f.contentWindow.postMessage({type:'unifiedUsersUpdated',users:list},'*');
            });
        }catch(e){}
    }
    function esc(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
    function shareUnifiedUser(name){
        try{
            name=String(name||'').trim();
            const u=safeUsers().find(x=>x&&x.userName===name);
            if(!u){ if(typeof showAccNotice==='function') showAccNotice('مشاركة','الحساب غير موجود','warning'); return; }
            const pass=String(u.secret||u.pin||'').trim();
            const passLine = pass && !pass.startsWith('sha256:')
                ? ('كلمة المرور: '+pass)
                : 'كلمة المرور: (محمية — اطلب من المسؤول تعيينها)';
            const msg = 'بيانات تسجيل الدخول — النظام المتكامل\n'+
                'الاسم: '+u.userName+'\n'+
                passLine+'\n'+
                'الدور: '+(u.isAdmin||u.userName==='admin'?'مسؤول':'موظف')+'\n'+
                'الوصول: المخزون + الصيانة';
            const url='https://wa.me/?text='+encodeURIComponent(msg);
            try{ window.open(url,'_blank'); }catch(e){ location.href=url; }
        }catch(e){ console.error('shareUnifiedUser',e); }
    }
    window.shareUnifiedUser=shareUnifiedUser;
    function renderAccounts(){
        // حماية من إعادة الرسم أثناء الكتابة في نموذج التعديل
        if(window.__accountEditingName && document.getElementById('editUnifiedName')) return;
        const box=document.getElementById('unifiedUsersList'),count=document.getElementById('accountCount');if(!box)return;
        const list=safeUsers().sort((a,b)=>a.userName.localeCompare(b.userName,'ar'));
        if(count)count.textContent=list.length;
        if(!list.length){box.innerHTML='<div style="text-align:center;color:#64748b;padding:26px;font-size:12px;">لا توجد حسابات</div>';return;}
        box.innerHTML=list.map((u,idx)=>{
            const isMain=(u.userName==='admin');
            const pass=u.secret||u.pin||'';
            const safeName=esc(u.userName);
            return `<div class="unified-user-row" data-idx="${idx}" data-user="${safeName}">
                <div class="unified-user-avatar">${esc((u.userName||'?').charAt(0))}</div>
                <div class="unified-user-main">
                    <div class="unified-user-name">${safeName}</div>
                    <div class="unified-user-meta">${isMain?'المسؤول الرئيسي • وصول للقسمين':'حساب موحّد • وصول للقسمين'}</div>
                    <div class="ua-pass-wrap">
                        <span class="ua-pass-text" id="uaPass_${idx}" data-pass="${esc(pass)}" data-shown="0">••••••</span>
                        <button type="button" class="ua-eye" data-action="toggle-pass" data-idx="${idx}" title="إظهار/إخفاء كلمة المرور"><i class="fas fa-eye"></i></button>
                    </div>
                </div>
                <div class="unified-user-actions">
                    <button type="button" class="ua-share" data-action="share" data-name="${safeName}" title="مشاركة عبر واتساب"><i class="fas fa-share-alt"></i></button>
                    <button type="button" class="ua-edit" data-action="edit" data-name="${safeName}" title="تعديل"><i class="fas fa-pen"></i></button>
                    ${isMain?'':`<button type="button" class="ua-del" data-action="delete" data-name="${safeName}" title="حذف"><i class="fas fa-trash"></i></button>`}
                </div>
            </div>`;
        }).join('');
    }
    function ensureAccountListBound(){
        const box=document.getElementById('unifiedUsersList');
        if(!box || box.dataset.bound==='1')return;
        box.dataset.bound='1';
        box.addEventListener('click',function(e){
            const btn=e.target.closest('[data-action]');
            if(!btn)return;
            e.preventDefault();e.stopPropagation();
            const action=btn.getAttribute('data-action');
            if(action==='toggle-pass'){
                const idx=btn.getAttribute('data-idx');
                const el=document.getElementById('uaPass_'+idx);
                if(!el)return;
                const shown=el.getAttribute('data-shown')==='1';
                if(shown){
                    el.textContent='••••••';
                    el.setAttribute('data-shown','0');
                    btn.innerHTML='<i class="fas fa-eye"></i>';
                }else{
                    el.textContent=el.getAttribute('data-pass')||'';
                    el.setAttribute('data-shown','1');
                    btn.innerHTML='<i class="fas fa-eye-slash"></i>';
                }
                return;
            }
            if(action==='share'){ window.shareUnifiedUser(btn.getAttribute('data-name')); return; }
            if(action==='edit'){ window.editUnifiedUser(btn.getAttribute('data-name')); return; }
            if(action==='delete'){ window.deleteUnifiedUser(btn.getAttribute('data-name')); return; }
            if(action==='save-edit'){ window.saveUnifiedUserEdit(btn.getAttribute('data-name')); return; }
            if(action==='cancel-edit'){ window.__accountEditingName=null; renderAccounts(); return; }
            if(action==='toggle-edit-pass'){
                const inp=document.getElementById('editUnifiedPass');
                if(!inp)return;
                if(inp.type==='password'){inp.type='text';btn.innerHTML='<i class="fas fa-eye-slash"></i>';}
                else{inp.type='password';btn.innerHTML='<i class="fas fa-eye"></i>';}
            }
        });
    }
    // ربط مبكر إن وُجد العنصر
    try{ document.addEventListener('DOMContentLoaded', ensureAccountListBound); ensureAccountListBound(); }catch(e){}


    window.__accountEditingName=null;
    window.openAccountManager=async function(){
        refreshAccountButton();
        if(!isAdminUser(currentName())){showAccNotice('الحسابات','هذه الصفحة للمسؤول فقط','warning');return;}
        const ov=document.getElementById('accountOverlay');if(!ov)return;
        // إخفاء الشاشة الرئيسية بالكامل حتى لا يمكن لمسها
        const sel=document.getElementById('selectionScreen');
        if(sel){ sel.style.visibility='hidden'; sel.style.pointerEvents='none'; }
        document.body.style.overflow='hidden';
        ov.classList.add('show');
        window.__accountEditingName=null;
        ensureAccountListBound();
        renderAccounts();
        const btn=document.getElementById('addUnifiedUserBtn');if(btn)btn.disabled=true;
        try{
            // بعد التعديل/الحذف لا نستبدل القائمة المحلية مباشرةً بنتيجة سحابية قديمة
            // بسبب تأخر المزامنة أو التخزين المؤقت في WebView.
            const hadPending=localStorage.getItem('unifiedUsersPendingSync')==='1';
            if(hadPending){
                const pending=safeUsers();
                renderAccounts(); // أظهر المحلي أولاً (بعد الحذف)
                if(pending.length) {
                    const ok=await persistAccounts(pending);
                    if(!ok) showAccNotice('بانتظار السحابة','الحذف/التعديل محفوظ هنا وسيُرفع عند توفر الاتصال','warning');
                }
                renderAccounts();
            }else{
                const fresh=await loadAllAccountSources();
                if(fresh&&fresh.length && !window.__accountEditingName) renderAccounts();
            }
        }catch(e){ renderAccounts(); }
        if(btn)btn.disabled=false;
    };
    window.closeAccountManager=function(){
        const ov=document.getElementById('accountOverlay');
        if(ov) ov.classList.remove('show');
        window.__accountEditingName=null;
        const sel=document.getElementById('selectionScreen');
        if(sel){ sel.style.visibility=''; sel.style.pointerEvents=''; }
        document.body.style.overflow='';
    };

    window.editUnifiedUser=function(name){
        try{
            if(!isAdminUser(currentName())){showAccNotice('الحسابات','هذه العملية للمسؤول فقط','warning');return;}
            name=String(name||'').trim();
            const list=safeUsers();
            const u=list.find(x=>x.userName===name);
            if(!u){showAccNotice('الحسابات','الحساب غير موجود','warning');return;}
            // أغلق أي صف تعديل مفتوح ثم افتح هذا
            window.__accountEditingName=null;
            renderAccounts();
            window.__accountEditingName=name;
            const row=[...document.querySelectorAll('.unified-user-row')].find(r=>r.getAttribute('data-user')===name);
            if(!row){showAccNotice('الحسابات','تعذر فتح صف التعديل','warning');return;}
            const main=(u.userName==='admin'||u.userName==='مسؤول');
            const pass=u.secret||u.pin||'';
            row.classList.add('is-editing');
            row.innerHTML=`
                <div class="unified-user-avatar">${esc((u.userName||'?').charAt(0))}</div>
                <div class="ua-edit-panel">
                    <label>اسم المستخدم</label>
                    <input class="account-input" id="editUnifiedName" value="${esc(u.userName)}" ${main?'readonly':''} autocomplete="off">
                    <label>كلمة المرور</label>
                    <div class="ua-pass-field">
                        <input class="account-input" id="editUnifiedPass" type="text" value="${esc(pass)}" autocomplete="off">
                        <button type="button" class="ua-eye" data-action="toggle-edit-pass" title="إظهار/إخفاء"><i class="fas fa-eye-slash"></i></button>
                    </div>
                    <div class="ua-edit-actions">
                        <button type="button" class="ua-btn-cancel" data-action="cancel-edit"><i class="fas fa-times"></i> إلغاء</button>
                        <button type="button" class="ua-btn-save" data-action="save-edit" data-name="${esc(name)}"><i class="fas fa-check"></i> حفظ</button>
                    </div>
                </div>`;
            setTimeout(()=>{try{document.getElementById('editUnifiedPass')?.focus();document.getElementById('editUnifiedPass')?.select();}catch(e){}},80);
        }catch(err){
            console.error('editUnifiedUser',err);
            showAccNotice('الحسابات','حدث خطأ أثناء فتح التعديل','warning');
        }
    };

    window.saveUnifiedUserEdit=async function(oldName){
        try{
            if(!isAdminUser(currentName())){showAccNotice('الحسابات','هذه العملية للمسؤول فقط','warning');return;}
            oldName=String(oldName||'').trim();
            const nn=(document.getElementById('editUnifiedName')?.value||'').trim();
            const np=(document.getElementById('editUnifiedPass')?.value||'').trim();
            if(!nn||!np){showAccNotice('الحساب','أدخل الاسم وكلمة المرور','warning');return;}
            const list=safeUsers();
            if(nn!==oldName&&list.some(u=>u.userName===nn)){showAccNotice('الحساب','اسم المستخدم موجود مسبقاً','warning');return;}
            const u=list.find(x=>x.userName===oldName);
            if(!u){showAccNotice('الحساب','الحساب غير موجود','warning');return;}
            u.userName=nn;
            u.secret=np;
            if(u.pin!==undefined) u.pin=np;
            u.isAdmin=(oldName==='مسؤول'||nn==='مسؤول'||!!u.isAdmin);
            if(nn==='مسؤول') u.isAdmin=true;
            saveUsers(list);
            window.__accountEditingName=null;
            renderAccounts();
            showAccNotice('جاري الحفظ','يتم رفع التعديل إلى السحابة...','info');
            const updatedUser = { userName: nn, secret: np, section: u.section || 'both', isAdmin: !!u.isAdmin };
            const ok = await writeWorkerUsers([updatedUser], 'update', oldName);
            if(oldName===currentName() || nn===currentName()){
                localStorage.setItem('currentUser',nn);
                try{
                    const s=JSON.parse(localStorage.getItem('loggedInUser')||'{}');
                    s.userName=nn;s.pin=np;s.secret=np;s.isAdmin=!!u.isAdmin;
                    localStorage.setItem('loggedInUser',JSON.stringify(s));
                }catch(e){}
                localStorage.setItem('unifiedSessionRole',u.isAdmin?'admin':'employee');
                try{ if(typeof updateSelUserUI==='function') updateSelUserUI(); }catch(e){}
            }
            window.__accountEditingName=null;
            renderAccounts();
            if(ok && ok.ok){
                showAccNotice('تم الحفظ','تم التحديث على السحابة','success');
            }else{
                showAccNotice('حُفظ محلياً فقط', (ok && ok.message) || 'سيُزامَن لاحقاً','warning');
            }
        }catch(err){
            console.error('saveUnifiedUserEdit',err);
            showAccNotice('الحسابات','تعذر حفظ التعديل','warning');
        }
    };
    window.__confirmAccountDelete = function(name){
        return new Promise(function(resolve){
            var ov = document.getElementById('accountDeleteOverlay');
            var nameEl = document.getElementById('accountDeleteName');
            var ok = document.getElementById('accountDeleteOk');
            var cancel = document.getElementById('accountDeleteCancel');
            if(!ov || !ok || !cancel){
                resolve(window.confirm('حذف الحساب «'+name+'»؟'));
                return;
            }
            if(nameEl) nameEl.textContent = name;
            function cleanup(result){
                ov.classList.remove('show');
                ov.setAttribute('aria-hidden','true');
                ok.onclick = null;
                cancel.onclick = null;
                ov.onclick = null;
                resolve(result);
            }
            ok.onclick = function(){ cleanup(true); };
            cancel.onclick = function(){ cleanup(false); };
            ov.onclick = function(e){ if(e.target === ov) cleanup(false); };
            ov.classList.add('show');
            ov.setAttribute('aria-hidden','false');
        });
    };
    window.deleteUnifiedUser=async function(name){
        if(!isAdminUser(currentName())){showAccNotice('الحسابات','هذه العملية للمسؤول فقط','warning');return;}
        if(name==='admin'||name==='مسؤول'||name===currentName()){
            showAccNotice('الحسابات',(name==='admin'||name==='مسؤول')?'لا يمكن حذف حساب المسؤول':'لا يمكن حذف الحساب المستخدم حالياً','warning');
            return;
        }
        const confirmed = await window.__confirmAccountDelete(name);
        if(!confirmed) return;
        try{
            let deleted=JSON.parse(localStorage.getItem('maintenanceDeletedEmployees')||'[]');
            if(!Array.isArray(deleted)) deleted=[];
            if(!deleted.includes(name)) deleted.push(name);
            localStorage.setItem('maintenanceDeletedEmployees', JSON.stringify(deleted));
        }catch(e){}
        const list=safeUsers().filter(u=>u.userName!==name && u.userName!=='مسؤول');
        saveUsers(list);
        try{ propagateUnifiedUsersToAllApps(list); }catch(e){}
        renderAccounts();
        showAccNotice('جاري الحذف','يتم مزامنة الحذف مع السحابة...','info');
        const ok = await writeWorkerUsers([], 'delete', name);
        renderAccounts();
        if(ok && ok.ok) showAccNotice('تم الحذف','حُذف من السحابة','success');
        else showAccNotice('حُذف محلياً فقط', (ok && ok.message) || 'سيُزامَن لاحقاً','warning');
    };
    async function addAccount(){
        if(!isAdminUser(currentName())){showAccNotice('الحسابات','هذه العملية للمسؤول فقط','warning');return;}
        const n=(document.getElementById('newUnifiedUserName')?.value||'').trim();
        const p=(document.getElementById('newUnifiedUserPass')?.value||'').trim();
        if(!n||!p){showAccNotice('الحساب','أدخل اسم المستخدم وكلمة المرور','warning');return;}
        if(n==='alhwas'||n==='admin'||n==='مسؤول'){showAccNotice('الحساب','هذا الاسم محجوز','warning');return;}
        const list=safeUsers();
        if(list.some(u=>u.userName===n)){showAccNotice('الحساب','اسم المستخدم موجود مسبقاً','warning');return;}
        const newUser = {userName:n, secret:p, isAdmin:false, section:'both'};
        list.push(newUser);
        saveUsers(list);
        const btn=document.getElementById('addUnifiedUserBtn');
        if(btn)btn.disabled=true;
        document.getElementById('newUnifiedUserName').value='';
        document.getElementById('newUnifiedUserPass').value='';
        renderAccounts();
        showAccNotice('جاري الإضافة','يتم رفع الحساب إلى السحابة...','info');
        const ok = await writeWorkerUsers([newUser], 'add');
        if(btn)btn.disabled=false;
        renderAccounts();
        if(ok && ok.ok) showAccNotice('تمت الإضافة','الحساب متاح الآن على السحابة','success');
        else showAccNotice('أضيف محلياً فقط', (ok && ok.message) || 'سيُرفع لاحقاً عند توفر الاتصال','warning');
    }
    window.addEventListener('message',e=>{if(e.data?.type==='requestUnifiedUsers')syncFrames(safeUsers());if(e.data?.type==='unifiedUsersUpdated'&&Array.isArray(e.data.users)){saveUsers(e.data.users);renderAccounts();}});
    document.addEventListener('DOMContentLoaded',()=>{
        const b=document.getElementById('btnOpenAccounts');if(b)b.addEventListener('click',window.openAccountManager);
        const add=document.getElementById('addUnifiedUserBtn');if(add)add.addEventListener('click',addAccount);
        const p=document.getElementById('newUnifiedUserPass');if(p)p.addEventListener('keydown',e=>{if(e.key==='Enter')addAccount();});
        refreshAccountButton();
    });
    // Keep the account button state synchronized after login/return to the selection screen.
    const oldUpdate=window.updateSelUserUI; if(typeof oldUpdate==='function'){}
    window.__renderUnifiedAccounts=renderAccounts;
    setTimeout(refreshAccountButton,120);setInterval(refreshAccountButton,10000);
    window.__refreshUnifiedAccountUI=refreshAccountButton;
    window.__loadUnifiedAccounts=loadAllAccountSources;
})();

    (function() {
        'use strict';

        var updateDownloadLink = '';

        // عناصر النافذة
        var modal = document.getElementById('updateModal');
        var versionEl = document.getElementById('updateVersion');
        var cancelBtn = document.getElementById('cancelUpdateBtn');
        var confirmBtn = document.getElementById('confirmUpdateBtn');

        // دالة إظهار النافذة
        function showUpdateModal(version, link) {
            updateDownloadLink = String(link || '').trim();
            if (!updateDownloadLink) return;
            versionEl.textContent = 'الإصدار ' + String(version);
            modal.classList.add('show');
        }
        window.__showUpdateModal = showUpdateModal;

        // ✅ دالة إخفاء النافذة (تعمل للزرين)
        function closeUpdateModal() {
            modal.classList.remove('show');
        }

        // ✅ دالة التحميل: تغلق النافذة ثم تنتقل للرابط
        function confirmUpdate() {
            if (updateDownloadLink) {
                // 1. أغلق النافذة أولاً
                modal.classList.remove('show');
                // 2. انتظر قليلاً ثم انتقل للرابط
                setTimeout(function() {
                    window.location.href = updateDownloadLink;
                }, 300);
            }
        }

        // ربط الأزرار (مع حماية من العناصر المفقودة)
        if (cancelBtn) cancelBtn.onclick = closeUpdateModal;
        if (confirmBtn) confirmBtn.onclick = confirmUpdate;

        // دالة التحقق من التحديث
        window.__checkForUpdate = checkForUpdate;
        function checkForUpdate() {
            var jsonUrl = 'https://alhwas.github.io/app-updates/inventory/version.json?t=' + Date.now();

            fetch(jsonUrl)
                .then(function(response) {
                    if (!response.ok) throw new Error('فشل الاتصال');
                    return response.json();
                })
                .then(function(data) {
                    var currentVersion = 6.7;
                    var remoteVersion = Number(data && data.version);
                    var downloadLink = data && (data.downloadLink || data.downloadUrl || data.url);
                    if (Number.isFinite(remoteVersion) && remoteVersion > currentVersion && downloadLink) {
                        showUpdateModal(remoteVersion, downloadLink);
                    }
                })
                .catch(function(error) {
                    console.log('لا يمكن التحقق من التحديث:', error);
                });
        }

        // تشغيل التحقق بعد 3 ثوانٍ
        setTimeout(checkForUpdate, 3000);

    })();

(function(){
  // إشارة موحدة للأقسام: تمنع فتح أكثر من نافذة نظامية من الغلاف في نفس اللحظة.
  window.__systemControllerReady = true;
  window.addEventListener('online', function(){ try{ updateSettingsSummary(); }catch(e){} });
  window.addEventListener('offline', function(){ try{ updateSettingsSummary(); }catch(e){} });
})();

(function(){
  if (window.__athirFinish) return;
  window.__athirFinish = true;
  var pill = document.getElementById('athirStatusPill');
  function paintQuiet(mode){
    if (!pill) return;
    if (mode === 'off') { pill.style.display = 'flex'; pill.setAttribute('data-state','off'); var l=document.getElementById('athirStatusLabel'); if(l) l.textContent='غير متصل'; }
    else if (mode === 'sync') { pill.style.display = 'flex'; pill.setAttribute('data-state','sync'); var l2=document.getElementById('athirStatusLabel'); if(l2) l2.textContent='مزامنة'; }
    else { pill.style.display = 'none'; pill.setAttribute('data-state','on'); }
  }
  if (window.AthirCore && AthirCore.setSync) {
    var prev = AthirCore.setSync;
    AthirCore.setSync = function(mode){ paintQuiet(mode); return prev(mode); };
  }
  paintQuiet('on');
  try {
    var ws = new WebSocket('wss://snowy-art-30d9.inventory-510.workers.dev/sync');
    var gaveUp = false;
    ws.onopen = function(){ if (AthirCore && AthirCore.state) AthirCore.state.channel = 'ويب سوكت متصل'; paintQuiet('on'); };
    ws.onerror = function(){ if (!gaveUp && AthirCore && AthirCore.state) AthirCore.state.channel = 'فحص عادي'; };
    ws.onclose = function(){ gaveUp = true; if (AthirCore && AthirCore.state && AthirCore.state.channel === 'ويب سوكت متصل') AthirCore.state.channel = 'فحص عادي'; };
  } catch(e) {}
  window.decorateFrameHtml = window.decorateFrameHtml;
})();


(function bindAppVisitRow(){
  function bind(){
    var row=document.getElementById('openAppVisitRow');
    if(!row || row.dataset.bound) return;
    row.dataset.bound='1';
    row.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof window.openAppVisitOverlay==='function') window.openAppVisitOverlay();
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
