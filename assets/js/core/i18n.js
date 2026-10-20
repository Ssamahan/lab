/* ============================================================================
   LAB SYSTEMS · I18N — English · Kinyarwanda · Français
   Shell, navigation and common actions are fully localised; module copy falls
   back to English where a translation is not yet published (labelled in UI).
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU; const I={}; window.LS=window.LS||{}; LS.i18n=I;
const DICT={
  en:{
    'nav.operations':'Operations','nav.people':'People','nav.scheduling':'Scheduling','nav.quality':'Quality','nav.admin':'Admin',
    'nav.dash':'Dashboard','nav.samples':'Referred Samples','nav.stock':'Stock & Supplies','nav.training':'Training Roster',
    'nav.revenue':'Training Revenue','nav.roster':'Working Plan','nav.leave':'Leave & Timeline','nav.eqa':'EQA / PT Scores',
    'nav.pbf':'PBF Evaluation','nav.staff':'Staff & Settings','nav.equipment':'Equipment','nav.qualityhub':'Quality & Compliance',
    'nav.security':'Security Center','nav.design':'Design System','nav.roadmap':'Premium Roadmap',
    'act.newSample':'New sample','act.export':'Export','act.search':'Search','act.save':'Save','act.cancel':'Cancel',
    'act.approve':'Approve','act.decline':'Decline','act.refresh':'Refresh','act.today':'Today','act.all':'All',
    'act.register':'Register sample','act.new':'New','act.print':'Print','act.close':'Close',
    'ui.online':'All systems operational','ui.offline':'Offline — queued locally','ui.search':'Search or jump to…',
    'ui.fy':'Fiscal year','ui.onDuty':'On duty now','ui.viewAll':'View all'
  },
  rw:{
    'nav.operations':'Ibikorwa','nav.people':'Abakozi','nav.scheduling':'Gahunda','nav.quality':'Ubuziranenge','nav.admin':'Ubuyobozi',
    'nav.dash':'Imbonerahamwe','nav.samples':'Ingero zoherejwe','nav.stock':'Ububiko n\'ibikoresho','nav.training':'Urutonde rw\'amahugurwa',
    'nav.revenue':'Amafaranga y\'amahugurwa','nav.roster':'Gahunda y\'akazi','nav.leave':'Uruhushya n\'ibihe','nav.eqa':'Amanota ya EQA',
    'nav.pbf':'Isuzuma rya PBF','nav.staff':'Abakozi n\'igenamiterere','nav.equipment':'Ibikoresho','nav.qualityhub':'Ubuziranenge n\'ubahiriza',
    'nav.security':'Ikigo cy\'umutekano','nav.design':'Sisitemu y\'imyubakire','nav.roadmap':'Gahunda y\'iterambere',
    'act.newSample':'Ingero nshya','act.export':'Ohereza','act.search':'Shakisha','act.save':'Bika','act.cancel':'Reka',
    'act.approve':'Emeza','act.decline':'Anga','act.refresh':'Vugurura','act.today':'Uyu munsi','act.all':'Byose',
    'act.register':'Andikisha ingero','act.new':'Nshya','act.print':'Capa','act.close':'Funga',
    'ui.online':'Sisitemu zose zirakora','ui.offline':'Nta murandasi — ibitswe aha','ui.search':'Shakisha cyangwa jya kuri…',
    'ui.fy':'Umwaka w\'ingengo','ui.onDuty':'Abari ku kazi ubu','ui.viewAll':'Reba byose'
  },
  fr:{
    'nav.operations':'Opérations','nav.people':'Personnel','nav.scheduling':'Planification','nav.quality':'Qualité','nav.admin':'Administration',
    'nav.dash':'Tableau de bord','nav.samples':'Échantillons référés','nav.stock':'Stock et fournitures','nav.training':'Registre de formation',
    'nav.revenue':'Revenus de formation','nav.roster':'Plan de travail','nav.leave':'Congés et calendrier','nav.eqa':'Scores EEQ',
    'nav.pbf':'Évaluation PBF','nav.staff':'Personnel et paramètres','nav.equipment':'Équipement','nav.qualityhub':'Qualité et conformité',
    'nav.security':'Centre de sécurité','nav.design':'Système de design','nav.roadmap':'Feuille de route',
    'act.newSample':'Nouvel échantillon','act.export':'Exporter','act.search':'Rechercher','act.save':'Enregistrer','act.cancel':'Annuler',
    'act.approve':'Approuver','act.decline':'Refuser','act.refresh':'Actualiser','act.today':'Aujourd\'hui','act.all':'Tous',
    'act.register':'Enregistrer un échantillon','act.new':'Nouveau','act.print':'Imprimer','act.close':'Fermer',
    'ui.online':'Tous les systèmes opérationnels','ui.offline':'Hors ligne — en file locale','ui.search':'Rechercher ou accéder…',
    'ui.fy':'Exercice fiscal','ui.onDuty':'De service','ui.viewAll':'Tout voir'
  }
};
I.lang='en';
I.init=function(){ try{ I.lang=localStorage.getItem('labSystems.lang.v1')||'en'; }catch(e){} I.apply(); return I.lang; };
I.set=function(lang){ I.lang=DICT[lang]?lang:'en'; try{ localStorage.setItem('labSystems.lang.v1',I.lang); }catch(e){} I.apply(); document.dispatchEvent(new CustomEvent('ls:lang')); };
I.t=function(key,fallback){
  const d=DICT[I.lang]||DICT.en;
  return d[key]||DICT.en[key]||fallback||key;
};
I.apply=function(root){
  document.documentElement.lang=I.lang;
  U.$$('[data-i18n]',root||document).forEach(el=>{ el.textContent=I.t(el.dataset.i18n, el.textContent); });
  U.$$('[data-i18n-ph]',root||document).forEach(el=>{ el.placeholder=I.t(el.dataset.i18nPh, el.placeholder); });
};
I.languages=[{code:'en',label:'English',native:'English'},{code:'rw',label:'Kinyarwanda',native:'Ikinyarwanda'},{code:'fr',label:'Français',native:'Français'}];
})();
