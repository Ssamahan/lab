(function(){
'use strict';
const U=window.LSU, UI=LS.ui, S=LS.store;
let mapTrainingId='';
/* Map searches use the entered place, not assumed coordinates. A broad district is
   explicitly labelled approximate; a third-party map may resolve a different place. */
function trainingMapView(){
  const all=(S.db().trainings||[]).filter(t=>String(t.facilityName||t.location||'').trim()).slice()
    .sort((a,b)=>String(b.start||'').localeCompare(String(a.start||'')));
  const selected=all.find(t=>t.id===mapTrainingId)||all[0];
  if(selected) mapTrainingId=selected.id;
  const query=selected?[selected.facilityName,selected.location,'Rwanda'].filter(Boolean).join(', '):'';
  const routes=selected&&LS.auth.can('revenue')?(S.db().trainingExpenses||[]).filter(x=>!x.deleted&&x.linkedTraining===selected.id)
    .flatMap(x=>(x.expenses||[]).filter(e=>!e.deleted&&e.cat==='Transport'&&e.routeFrom&&e.routeTo)):[];
  const totals=new Map(); let unknown=0;
  (S.db().trainings||[]).forEach(t=>{ const name=String(t.fundingPartner||'').trim();
    if(!name){ unknown++; return; }
    const key=name.toLocaleLowerCase(); const item=totals.get(key)||{name,count:0}; item.count++; totals.set(key,item);
  });
  const partners=Array.from(totals.values()).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
  const max=partners.length?partners[0].count:1;
  const chart=partners.length?'<div role="img" aria-label="Recorded trainings by funding partner">'+partners.map(p=>'<div style="margin-bottom:12px"><div class="row between"><span class="small">'+U.esc(p.name)+'</span><b class="mono xs">'+p.count+'</b></div><div class="meter gold" style="margin-top:5px"><i style="width:'+(p.count/max*100)+'%"></i></div></div>').join('')+'</div>'
    :'<p class="small faint">No funding partners recorded yet. Edit a training to add its funding partner.</p>';
  const map=(selected?'<label class="small" for="trMapSelect">Choose a training</label><select class="select" id="trMapSelect" style="margin:6px 0 8px">'+all.map(t=>'<option value="'+U.esc(t.id)+'"'+(t.id===selected.id?' selected':'')+'>'+U.esc(t.title||'Untitled')+' · '+U.esc(t.facilityName||t.location||'')+'</option>').join('')+'</select>'
    +'<div class="xs faint" style="margin-bottom:8px">'+(selected.facilityName?'Searching for the recorded facility':'Only a general location is recorded; this is not a confirmed venue')+': '+U.esc(query)+'. Confirm the result on the map.</div>'
    :'<p class="small faint">No recorded training location yet. You can still search below.</p>')
    +'<label class="small" for="mapPlaceQuery">Search a venue or place</label><div class="training-map-toolbar"><input class="input training-map-query" id="mapPlaceQuery" value="'+U.esc(query)+'" placeholder="e.g. Nyamata, Bugesera, Rwanda"><button class="btn sm primary" data-find-on-map data-query="'+U.esc(query)+'">Find venue on map</button><a class="btn sm" data-map-google-search target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&amp;query='+encodeURIComponent(query)+'">Open Google Maps ↗</a></div>'
    +'<div class="training-map-wrap"><div data-training-map class="training-map" role="region" aria-label="Interactive training map"></div></div>'
    +'<div class="hint" data-map-status role="status" aria-live="polite">Loading the map…</div><div data-map-results></div>'
    +'<div class="hint">Map tiles and searches use OpenStreetMap; ticket routes use OSRM. Places are sent to those services when searched. Internet is required.</div>'
    +'<div class="training-map-manual"><b class="small">Try a route</b><div class="training-map-toolbar"><label class="small">From <input class="input" data-map-from placeholder="Ruli, Gakenke"></label><label class="small">To <input class="input" data-map-to placeholder="e.g. Musanze"></label><button class="btn sm" data-map-route-manual>Show suggested route</button><a class="btn sm" data-map-google-route target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/dir/?api=1">Open directions ↗</a></div><div class="xs faint">Searches and routes are not saved. Verify both resolved stops; the line is not a GPS record.</div></div>'
    +(routes.length?'<div style="margin-top:12px"><b class="small">Recorded ticket legs</b>'+routes.map(e=>'<div class="small" style="margin-top:8px">'+U.esc(e.routeFrom)+' → '+U.esc(e.routeTo)+' <button class="btn xs" data-map-route data-from="'+U.esc(e.routeFrom)+'" data-to="'+U.esc(e.routeTo)+'">Show route on map</button> · <a target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/dir/?api=1&amp;origin='+encodeURIComponent(e.routeFrom)+'&amp;destination='+encodeURIComponent(e.routeTo)+'&amp;travelmode=driving">Open in Google Maps ↗</a></div>').join('')+'<div class="hint">Suggested driving roads, not the verified bus or taxi route.</div></div>':(LS.auth.can('revenue')?'<div class="hint" style="margin-top:8px">No complete ticket stops linked to this training yet. Add transport tickets in Training Revenue.</div>':''))
;
  return '<div class="grid-12" style="margin-bottom:16px"><div class="c8">'+UI.card({title:'Training locations & travel',sub:'Choose a training to see its venue and ticket legs',icon:'map-pin',body:map})+'</div>'
    +'<div class="c4">'+UI.card({title:'Trainings by funding partner',sub:'Count of training records with an explicitly recorded funder',icon:'chart-bar',body:chart+'<div class="hint">'+unknown+' training'+(unknown===1?'':'s')+' without a recorded funding partner. An organizer is not automatically assumed to be the funder.</div>'})+'</div></div>';
}
/* The map library is local and lazy-loaded. Tiles and named-place search are
   separate services: if either fails, keep the register usable and say why. */
let leafletPromise=null, lastGeoAt=0, geoQueue=Promise.resolve();
function loadLeaflet(){
  if(window.L) return Promise.resolve(window.L);
  if(leafletPromise) return leafletPromise;
  leafletPromise=new Promise((resolve,reject)=>{
    if(!document.getElementById('leaflet-css')){ const link=document.createElement('link'); link.id='leaflet-css'; link.rel='stylesheet'; link.href='assets/vendor/leaflet/leaflet.css'; document.head.appendChild(link); }
    const sc=document.createElement('script'); let done=false;
    const finish=(err)=>{ if(done) return; done=true; clearTimeout(timer); if(err){sc.remove(); leafletPromise=null; reject(err);} else resolve(window.L); };
    const timer=setTimeout(()=>finish(new Error('Map library did not load in time')),15000);
    sc.src='assets/vendor/leaflet/leaflet.js'; sc.onload=()=>window.L?finish():finish(new Error('Map library unavailable')); sc.onerror=()=>finish(new Error('Map library could not be loaded')); document.head.appendChild(sc);
  }); return leafletPromise;
}
function timedJSON(url){
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),12000);
  return fetch(url,{signal:controller.signal,cache:'no-store'}).then(r=>{if(!r.ok) throw new Error('Service returned '+r.status); return r.json();}).finally(()=>clearTimeout(timer));
}
/* The public Nominatim service permits at most one request per second and no autocomplete. */
function findPlace(q){
  const task=geoQueue.catch(()=>{}).then(()=>new Promise(resolve=>setTimeout(resolve,Math.max(0,1100-(Date.now()-lastGeoAt)))))
    .then(()=>{lastGeoAt=Date.now(); return timedJSON('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q='+encodeURIComponent(q));});
  geoQueue=task.catch(()=>{}); return task;
}
function setupTrainingMap(root){
  const target=root.querySelector('[data-training-map]'); if(!target) return;
  const status=root.querySelector('[data-map-status]'), results=root.querySelector('[data-map-results]');
  let map, tiles, layers=[], request=0;
  const alive=()=>target.isConnected;
  const say=msg=>{if(alive()) status.textContent=msg;};
  const clear=()=>{layers.forEach(layer=>map.removeLayer(layer)); layers=[];};
  let ready=loadLeaflet().then(L=>{
    if(!alive()) return null;
    map=L.map(target,{scrollWheelZoom:false}).setView([-1.94,29.87],8);
    tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'}).addTo(map);
    let tileLoaded=false, tileFailed=false;
    const tileTimer=setTimeout(()=>{if(!tileLoaded) say('Map tiles have not arrived. Check your connection or use Open Google Maps.');},12000);
    tiles.on('tileload',()=>{tileLoaded=true; clearTimeout(tileTimer); if(!tileFailed&&/^Loading the map/.test(status.textContent)) say('Map ready. Select Find venue on map to locate the recorded place.');});
    tiles.on('tileerror',()=>{tileFailed=true; clearTimeout(tileTimer); say('Some map tiles could not load. Check your connection or use Open Google Maps.');});
    return L;
  }).catch(err=>{say('Map could not load: '+err.message+'. Reload the page or use Open Google Maps.'); return null;});
  const venue=root.querySelector('[data-find-on-map]'), queryInput=root.querySelector('#mapPlaceQuery'), googleSearch=root.querySelector('[data-map-google-search]');
  const updateSearch=()=>{googleSearch.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(queryInput.value.trim());};
  if(queryInput){queryInput.addEventListener('input',updateSearch);queryInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();venue.click();}});}
  if(venue) venue.onclick=async()=>{
    const query=queryInput.value.trim();if(!query){say('Enter a venue, district or other place to search.');return;}
    updateSearch();
    const seq=++request; results.innerHTML=''; const L=await ready; if(!L||!alive()||seq!==request) return;
    say('Searching OpenStreetMap for the entered place…');
    try{ const places=await findPlace(query); if(!alive()||seq!==request) return;
      const valid=Array.isArray(places)?places.filter(p=>Number.isFinite(+p.lat)&&Number.isFinite(+p.lon)&&p.display_name):[];
      if(!valid.length){say('No matching place found. Check the name or use Open Google Maps.'); return;}
      say('Choose the correct result below. Results are not automatically verified.');
      valid.forEach(p=>{const b=document.createElement('button'); b.type='button'; b.className='btn sm training-map-result'; b.textContent=p.display_name;
        b.onclick=()=>{++request; clear(); const point=[+p.lat,+p.lon]; const marker=L.marker(point).addTo(map); layers.push(marker); marker.bindPopup(document.createTextNode(p.display_name)).openPopup(); map.setView(point,15); results.innerHTML=''; say('Showing selected search result. Verify it is the right venue; it is not saved to the record.');}; results.appendChild(b);});
    }catch(e){if(seq===request) say('Venue search failed. Check your connection or use Open Google Maps.');}
  };
  const fromInput=root.querySelector('[data-map-from]'),toInput=root.querySelector('[data-map-to]'),manual=root.querySelector('[data-map-route-manual]'),googleRoute=root.querySelector('[data-map-google-route]');
  const updateRoute=()=>{googleRoute.href='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(fromInput.value.trim())+'&destination='+encodeURIComponent(toInput.value.trim())+'&travelmode=driving';};
  if(manual){fromInput.addEventListener('input',updateRoute);toInput.addEventListener('input',updateRoute);updateRoute();manual.onclick=()=>drawRoute(fromInput.value.trim(),toInput.value.trim());}
  root.querySelectorAll('[data-map-route]').forEach(b=>b.onclick=()=>drawRoute(b.dataset.from,b.dataset.to));
  async function drawRoute(fromName,toName){
    if(!fromName||!toName){say('Enter both a starting point and destination.');return;}
    const seq=++request; results.innerHTML=''; const L=await ready; if(!L||!alive()||seq!==request) return;
    say('Finding the ticket stops…');
    try{
      const from=await findPlace(fromName+', Rwanda'); if(!alive()||seq!==request) return;
      const to=await findPlace(toName+', Rwanda'); if(!alive()||seq!==request) return;
      const a=from&&from[0], z=to&&to[0];
      if(!a||!z||![a.lat,a.lon,z.lat,z.lon].every(v=>Number.isFinite(+v))) throw new Error('One or both stops were not found');
      say('Finding a suggested driving route…');
      const route=await timedJSON('https://router.project-osrm.org/route/v1/driving/'+[+a.lon,+a.lat].join(',')+';'+[+z.lon,+z.lat].join(',')+'?overview=full&geometries=geojson');
      if(!alive()||seq!==request) return;
      const coords=route.routes&&route.routes[0]&&route.routes[0].geometry&&route.routes[0].geometry.coordinates;
      if(!Array.isArray(coords)||coords.length<2) throw new Error('No road route found');
      const points=coords.filter(c=>Array.isArray(c)&&Number.isFinite(+c[0])&&Number.isFinite(+c[1])).map(c=>[+c[1],+c[0]]);
      if(points.length<2) throw new Error('No road route found');
      clear(); const start=L.marker(points[0]).addTo(map), end=L.marker(points[points.length-1]).addTo(map); layers.push(start,end);
      start.bindPopup(document.createTextNode('Start: '+a.display_name)); end.bindPopup(document.createTextNode('End: '+z.display_name));
      const line=L.polyline(points,{color:'#ba8b29',weight:5,opacity:.9}).addTo(map); layers.push(line); map.fitBounds(line.getBounds(),{padding:[22,22],maxZoom:15});
      if(!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
        const path=line.getElement(); if(path&&path.animate) path.animate([{strokeDasharray:'0 2000'},{strokeDasharray:'2000 0'}],{duration:1600,easing:'ease-out'});
      }
      say('Suggested road route, not a GPS record. Check the resolved stops: '+a.display_name+' → '+z.display_name+'.');
    }catch(e){ if(alive()&&seq===request) say('Could not draw the route: '+(e.name==='AbortError'?'the service timed out':e.message)+'. Check the stop names or use Open in Google Maps.'); }
  }
}

/* District choropleth: only explicit district/city names or well-known local
   aliases are resolved. Ambiguous and missing places remain visible for review. */
const districts=['Bugesera','Burera','Gakenke','Gasabo','Gatsibo','Gicumbi','Gisagara','Huye','Kamonyi','Karongi','Kayonza','Kicukiro','Kirehe','Muhanga','Musanze','Ngoma','Ngororero','Nyabihu','Nyagatare','Nyamagabe','Nyamasheke','Nyanza','Nyarugenge','Nyaruguru','Rubavu','Ruhango','Rulindo','Rusizi','Rutsiro','Rwamagana'];
function districtOf(t){
 const raw=[t.location,t.facilityName].filter(Boolean).join(' ').toLowerCase();
 if(!raw||/\b(catchment|online|virtual)\b/.test(raw))return null;
 const found=new Set();
 districts.forEach(n=>{if(new RegExp('\\b'+n.toLowerCase()+'\\b').test(raw))found.add(['Gasabo','Kicukiro','Nyarugenge'].includes(n)?'Kigali':n);});
 if(/\bkigali\b/.test(raw))found.add('Kigali');
 if(/\bnyamata\b/.test(raw))found.add('Bugesera');
 if(/\bruli\b/.test(raw))found.add('Gakenke');
 return found.size===1?Array.from(found)[0]:null;
}
function districtSummary(trainings,today){
 const counts={},unknown=[];let upcoming=0,excluded=0;
 trainings.forEach(t=>{
  if(t.deleted||/^(cancelled|canceled|postponed)$/i.test(String(t.status||''))){excluded++;return;}
  const end=String(t.end||t.start||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(end)){unknown.push(t);return;}
  if(end>today){upcoming++;return;}
  const district=districtOf(t);
  if(!district){unknown.push(t);return;}
  counts[district]=(counts[district]||0)+1;
 });
 return {counts,unknown,upcoming,excluded};
}
function districtCard(){return UI.card({title:'Where trainings were held',sub:'Recorded past sessions by district · Kigali grouped as one',icon:'map',body:'<div data-district-map class="district-map" role="img" aria-label="Map of training locations by district"></div><div class="hint" data-district-status>Loading district boundaries…</div><div data-district-summary></div><div class="hint">Lines point one way from Ruli District Hospital to an approximate point in each district, not an actual road or journey. Counts are sessions, not people. Districts: geoBoundaries / Open Data Rwanda and NISR, CC BY 4.0.</div>'});}
function districtSVG(data,summary){
 const W=760,H=560, minX=28.75,maxX=30.98,minY=-2.85,maxY=-1.02;
 const xy=p=>[(p[0]-minX)/(maxX-minX)*W,(maxY-p[1])/(maxY-minY)*H];
 const path=geometry=>{
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
  return polygons.map(poly=>poly.map(ring=>ring.map((p,i)=>{const z=xy(p);return (i?'L':'M')+z[0].toFixed(1)+' '+z[1].toFixed(1);}).join('')+'Z').join('')).join('');
 };
 const max=Math.max(1,...Object.values(summary.counts));let points={};
 let g='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Rwanda districts coloured by recorded past training sessions, with one-way arrows from Ruli District Hospital" xmlns="http://www.w3.org/2000/svg"><defs><marker id="district-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#946b17"/></marker></defs><rect width="100%" height="100%" fill="#f6f8fa"/>';
 data.features.forEach(f=>{const name=f.properties.name,key=['Gasabo','Kicukiro','Nyarugenge'].includes(name)?'Kigali':name,n=summary.counts[key]||0;
  if(!points[key]||name==='Nyarugenge')points[key]=f.properties.point;
  const color=n?'#d6a641':'#e2e7e9',opacity=n?(0.35+0.6*n/max):1;
  g+='<path d="'+path(f.geometry)+'" fill="'+color+'" fill-opacity="'+opacity+'" stroke="#fff" stroke-width="1.3" fill-rule="evenodd"><title>'+U.esc(key)+': '+n+' recorded past session'+(n===1?'':'s')+'</title></path>';
 });
 const origin=xy([29.84939,-1.82962]);
 Object.keys(summary.counts).forEach(name=>{if(!points[name])return;const p=xy(points[name]);
  g+='<line x1="'+origin[0].toFixed(1)+'" y1="'+origin[1].toFixed(1)+'" x2="'+p[0].toFixed(1)+'" y2="'+p[1].toFixed(1)+'" stroke="#946b17" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#district-arrow)"/><circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="5" fill="#946b17"><title>'+U.esc(name)+': '+summary.counts[name]+'</title></circle>';});
 return g+'<circle cx="'+origin[0].toFixed(1)+'" cy="'+origin[1].toFixed(1)+'" r="7" fill="#173354" stroke="#fff" stroke-width="2"><title>Ruli District Hospital (approximate)</title></circle></svg>';
}
async function setupDistrictMap(root){
 const target=root.querySelector('[data-district-map]'),status=root.querySelector('[data-district-status]'),list=root.querySelector('[data-district-summary]');if(!target)return;
 const summary=districtSummary(S.db().trainings||[],U.todayISO());
 const ordered=Object.entries(summary.counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 list.innerHTML='<div class="district-ranking">'+(ordered.length?ordered.map(([name,n])=>'<span class="district-chip">'+U.esc(name)+' <b>'+n+'</b></span>').join(''):'<span class="small faint">No past sessions with a recognised district.</span>')+'</div>'+(summary.unknown.length?'<details class="hint"><summary>'+summary.unknown.length+' session'+(summary.unknown.length===1?'':'s')+' need a clear district or date</summary><ul>'+summary.unknown.map(t=>'<li>'+U.esc(t.title||'Untitled')+' · '+U.esc(t.location||t.facilityName||'No location')+' · '+U.esc(t.end||t.start||'No date')+'</li>').join('')+'</ul></details>':'')+'<div class="hint">'+(summary.excluded?summary.excluded+' cancelled, postponed or deleted session(s) excluded. ':'')+summary.upcoming+' ongoing or future session'+(summary.upcoming===1?' is':'s are')+' excluded. Darker gold means more sessions. Ruli / Nyamata are grouped with Gakenke / Bugesera; Kigali combines Gasabo, Kicukiro and Nyarugenge.</div>';
 try{const response=await fetch('assets/data/rwanda-districts.geojson?v='+encodeURIComponent(LS.shell.version()));if(!response.ok)throw Error('Boundary file could not be loaded');const data=await response.json();if(!target.isConnected)return;if(!Array.isArray(data.features))throw Error('Invalid boundary data');target.innerHTML=districtSVG(data,summary);status.textContent='District shading reflects recorded past sessions. Blue dot: Ruli District Hospital.';}catch(e){if(target.isConnected)status.textContent='District map unavailable: '+e.message+'. The counts below are still available.';}
}
LS.trainingMaps={trainingMapView,setupTrainingMap,districtCard,setupDistrictMap,districtSummary,districtOf,districtSVG,setSelection:id=>{mapTrainingId=id;}};
})();
