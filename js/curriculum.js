import {buildVersion, relatedIds, selectedSubjects, stageEdges} from './curriculum-model.js';
import {changes, explanations, teachers, projects} from './data/curriculum-editorial.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groups = ['Общеобразовательный','Фундаментальный','Базовый','Профильный','Проекты и практика','Факультативы','Дополнительный'];
const groupIndex = s => groups.indexOf(s.group);
export async function initCurriculum() {
  const root = document.querySelector('#learning-map');
  if (!root) return;
  try {
    const response = await fetch(new URL('./data/evm-curriculum.json', import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const source = await response.json();
    mount(root, source);
  } catch (error) {
    root.innerHTML = '<div class="card"><h3>Карта пока не загрузилась</h3><p>Обновите страницу. Для локального просмотра запустите сайт через HTTP-сервер.</p><button type="button" id="retry-map">Повторить загрузку</button></div>';
    root.querySelector('button').onclick = initCurriculum;
    console.error('Curriculum load failed:', error);
  }
}
function mount(root, source) {
  let renderedNodes=new Set(), renderedEdges=new Set();
  let version='source', data, semester=2, selected=null, query='', module='', branch=false, list=false, zoom=1, timer=null;
  const choices={};
  for (const s of source.subjects) if (s.choice && (!choices[s.choice] || s.selected)) choices[s.choice]=s.id;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const mobile=matchMedia('(max-width: 700px)');
  root.innerHTML=`
    <div class="map-heading"><div><span class="eyebrow">09.03.01 · Бакалавриат · 4 года</span><h2>Посмотри, как растут<br>твои возможности.</h2><p>Начни с первого курса. Выбери предмет — и проследи путь от основ до сложных систем.</p></div><label>Версия программы<select id="plan-version"><option value="source">Исходный план · 2022 на титуле</option><option value="2027">Набор 2027 · проект изменений</option></select></label></div>
    <p class="map-notice" id="version-note"></p>
    <div class="map-toolbar"><label class="map-search">Найти дисциплину<input id="subject-search" type="search" placeholder="Например, сети или программирование"></label><label>Модуль<select id="module-filter"><option value="">Все модули</option>${groups.map(g=>`<option>${g}</option>`).join('')}</select></label><label>Курс<select id="course-filter">${[1,2,3,4].map(n=>`<option value="${n}">${n} курс</option>`).join('')}</select></label><label>До семестра<select id="semester-filter">${Array.from({length:8},(_,i)=>`<option value="${i+1}">${i+1} семестр</option>`).join('')}</select></label></div>
    <div class="map-controls"><button data-action="back" type="button">← Назад</button><button data-action="next" class="map-primary" type="button">Следующий семестр →</button><button data-action="play" type="button">▶ Автораскрытие</button><button data-action="all" type="button">Вся карта</button><button data-action="reset" type="button">Сначала</button><button data-action="list" aria-pressed="false" type="button">Список</button></div>
    <div class="map-legend">${groups.map((g,i)=>`<span><i class="group-${i}"></i>${g}</span>`).join('')}<span>━ Продолжение предмета</span><span>┄ Предлагаемая связь знаний</span></div>
    <div class="map-view-tools"><label><input id="branch-only" type="checkbox" disabled> Только выбранная ветвь</label><button data-action="clear" type="button">Снять выделение и фильтры</button><label>Масштаб <input id="map-zoom" type="range" min="60" max="140" step="10" value="100"><output id="zoom-value">100%</output></label></div>
    <p class="map-summary" id="map-status" role="status" aria-live="polite"></p>
    <div class="map-viewport" tabindex="0" role="region" aria-label="Карта дисциплин. Перемещайтесь полосами прокрутки или клавишами со стрелками."><div class="map-size"><div class="map-canvas"></div></div></div>
    <div class="semester-list" hidden></div>
    <div class="map-pending" id="pending-changes" hidden></div>
    <p class="map-footnote">Источник: ${esc(source.sourceFile)}, лист «ПланСвод». Семестры занятий проверены также по часам на листе «План». Пунктирные связи и пояснения к предметам требуют согласования. Варианты выбора не суммируются.</p>
    <dialog class="subject-dialog" aria-labelledby="subject-title"><button class="dialog-close" data-action="close" type="button" aria-label="Закрыть карточку">✕</button><div id="subject-detail"></div></dialog>`;
  const $=selector=>root.querySelector(selector);
  const dialog=$('dialog'), canvas=$('.map-canvas'), viewport=$('.map-viewport');
  dialog.addEventListener('close',()=>{
    const node=[...canvas.querySelectorAll('[data-subject]')].find(n=>n.dataset.subject===selected);
    (node||$('[data-action=next]')).focus({preventScroll:true});
  });
  function stop() { clearInterval(timer); timer=null; $('[data-action="play"]').textContent='▶ Автораскрытие'; $('[data-action="play"]').setAttribute('aria-pressed','false'); }
  function changeVersion() {
    stop(); data=buildVersion(source, changes, version); selected=null; branch=false;
    $('#version-note').textContent=data.draft
      ? 'Проект набора 2027. Показана основа старого плана, а не утверждённое расписание 2027 года. Информатика исключена; новый предмет вынесен ниже карты до уточнения семестров.'
      : 'Исходный план: год на титуле — 2022, учебный год — 2022–2023; в имени файла — ЭВМб-23. Принадлежность набору требует уточнения.';
    document.querySelector('#program-version-label').textContent=data.draft?'Проект набора 2027 · на основе исходного плана':'Исходный план · 2022 на титуле';
    $('#pending-changes').hidden=!data.draft;
    $('#pending-changes').innerHTML=changes.map(c=>`<span class="eyebrow">2027 · Замена содержания</span><h3>${esc(c.newName)}</h3><p>Вместо «${esc(c.previousName)}». ${esc(c.note)}</p><p>${esc(c.source)} · ${esc(c.status)}</p>`).join('');
    render();
  }
  function current() { return selectedSubjects(data.subjects,choices); }
  function scrollToFirstMatch() {
    const first=canvas.querySelector('.discipline-node');
    if(first) viewport.scrollTo({left:Math.max(0,first.offsetLeft*zoom-16),top:Math.max(0,first.offsetTop*zoom-64),behavior:'instant'});
  }
  function render() {
    const subjects=current(), related=selected?relatedIds(selected,data.edges):null;
    const matches=s=>(!query||s.name.toLocaleLowerCase('ru').includes(query))&&(!module||s.group===module)&&(!branch||related?.has(s.id));
    const slots=[]; let maxRows=0; const mobileOffsets=[]; let mobileHeight=0;
    for(let sem=1;sem<=8;sem++) {
      const inSemester=subjects.filter(s=>s.semesters.some(v=>v.semester===sem)).sort((a,b)=>groupIndex(a)-groupIndex(b)||a.id.localeCompare(b.id));
      mobileOffsets.push(mobileHeight); mobileHeight+=80+inSemester.length*112;
      maxRows=Math.max(maxRows,inSemester.length);
      inSemester.forEach((s,row)=>slots.push({s,sem,key:`${s.id}@${sem}`, x:mobile.matches?16:(sem-1)*304+20, y:mobile.matches?mobileOffsets[sem-1]+64+row*112:64+row*112}));
    }
    const width=mobile.matches?Math.max(280,viewport.clientWidth/zoom-4):semester*304+24;
    const height=mobile.matches?mobileHeight:maxRows*112+90;
    canvas.style.width=`${width}px`; canvas.style.height=`${height}px`; canvas.style.transform=`scale(${zoom})`;
    $('.map-size').style.width=`${width*zoom}px`; $('.map-size').style.height=`${height*zoom}px`;
    const shown=slots.filter(n=>n.sem<=semester&&matches(n.s));
    const visible=new Map(shown.map(n=>[n.key,n]));
    const nodeWidth=mobile.matches?width-32:264;
    const edges=stageEdges(subjects,data.edges).filter(e=>visible.has(e.from)&&visible.has(e.to));
    const lineHTML=edges.map(e=>{
      const a=visible.get(e.from),b=visible.get(e.to);
      const path=mobile.matches?`M ${a.x+12} ${a.y+92} C ${a.x-8} ${a.y+130}, ${b.x-8} ${b.y-30}, ${b.x+12} ${b.y}`:`M ${a.x+nodeWidth} ${a.y+46} C ${a.x+nodeWidth+36} ${a.y+46}, ${b.x-36} ${b.y+46}, ${b.x} ${b.y+46}`;
      const active=related&&related.has(e.subjectFrom)&&related.has(e.subjectTo);
      return `<path class="map-edge ${renderedEdges.has(e.from+'>'+e.to)?'':'edge-new'} ${e.status==='continuation'?'continuation':'proposed'} ${active?'edge-active':''} ${related&&!active?'edge-dim':''}" d="${path}"/>`;
    }).join('');
    canvas.innerHTML=`<svg class="map-lines" width="${width}" height="${height}" aria-hidden="true">${lineHTML}</svg>`+
      Array.from({length:semester},(_,i)=>`<div class="semester-heading" style="left:${mobile.matches?16:i*304+20}px;top:${mobile.matches?mobileOffsets[i]:8}px">${i+1} семестр <span> / ${Math.ceil((i+1)/2)} курс</span></div>`).join('')+
      shown.map(n=>`<button type="button" class="discipline-node ${renderedNodes.has(n.key)?'':'node-new'} group-${groupIndex(n.s)} ${selected===n.s.id?'node-selected':''} ${related&&!related.has(n.s.id)?'node-dim':''}" style="left:${n.x}px;top:${n.y}px;width:${nodeWidth}px" data-subject="${esc(n.s.id)}" aria-pressed="${selected===n.s.id}"><span>${esc(n.s.name)}</span><small>${n.s.choice?'По выбору · один вариант':n.s.group==='Факультативы'?'Факультатив':esc(n.s.group)}${n.s.semesters.length>1?` · этап ${n.s.semesters.findIndex(v=>v.semester===n.sem)+1}`:''}</small></button>`).join('');
    renderedNodes=new Set(shown.map(n=>n.key)); renderedEdges=new Set(edges.map(e=>e.from+'>'+e.to));
    $('.semester-list').innerHTML=Array.from({length:semester},(_,i)=>{
      const items=shown.filter(n=>n.sem===i+1);
      return items.length?`<section><h3>${i+1} семестр · ${Math.ceil((i+1)/2)} курс</h3><ul>${items.map(n=>`<li><button type="button" data-subject="${esc(n.s.id)}">${esc(n.s.name)}</button> <small>${esc(n.s.group)}${n.s.choice?' · по выбору':''}</small></li>`).join('')}</ul></section>`:'';
    }).join('');
    $('#map-status').textContent=shown.length?`Раскрыто ${semester} из 8 семестров · ${new Set(shown.map(n=>n.s.id)).size} дисциплин и практик. ${selected?'Выделена цепочка выбранного предмета.':''}`:'Нет дисциплин по этим условиям. Измените поиск или модуль.';
    viewport.hidden=list; $('.semester-list').hidden=!list;
    $('#semester-filter').value=semester; $('#course-filter').value=Math.ceil(semester/2);
    $('#branch-only').disabled=!selected; $('#branch-only').checked=branch;
    $('[data-action="back"]').disabled=semester<=1; $('[data-action="next"]').disabled=semester>=8;
    $('[data-action="list"]').setAttribute('aria-pressed',String(list));
    $('[data-action="play"]').disabled=motion.matches;
    $('[data-action="play"]').title=motion.matches?'Автораскрытие отключено настройкой уменьшения движения':'';
  }
  function reveal(n, scroll=true) {
    semester=Math.min(8,Math.max(1,n)); render();
    if (scroll&&!list) {
      const heading=canvas.querySelectorAll('.semester-heading')[semester-1];
      viewport.scrollTo({left:mobile.matches?0:heading.offsetLeft*zoom-16,top:mobile.matches?heading.offsetTop*zoom:0,behavior:motion.matches?'instant':'smooth'});
    }
    if(semester===8) stop();
  }
  function links(ids) { return ids.map(id=>data.subjects.find(s=>s.id===id)).filter(Boolean).map(s=>`<button type="button" class="text-link" data-subject="${esc(s.id)}">${esc(s.name)}</button>`).join('') || '<p class="muted">Связи ещё не добавлены.</p>'; }
  function showSubject(id) {
    const s=data.subjects.find(s=>s.id===id); if(!s)return;
    if(s.choice) choices[s.choice]=s.id;
    selected=id; semester=Math.max(semester,Math.min(...s.semesters.map(v=>v.semester))); stop(); render();
    const explanation=explanations[s.name];
    const relatedProjects=projects.filter(p=>p.subjects.includes(id));
    const assigned=teachers.filter(t=>t.assignments.some(a=>a.version===version&&a.subject===id));
    $('#subject-detail').innerHTML=`<span class="eyebrow">${esc(s.group)} · ${esc(s.id)}</span><h2 id="subject-title">${esc(s.name)}</h2><p>${explanation?esc(explanation[0]):'Описание содержания будет добавлено после согласования с преподавателем.'}</p>
      ${s.choice?`<label>Альтернативы — выбирается один предмет<select id="choice-select">${data.subjects.filter(x=>x.choice===s.choice).map(x=>`<option value="${esc(x.id)}" ${x.id===id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label><p class="muted">Это варианты одной группы выбора, а не обязательное изучение всех предметов.</p>`:''}
      ${explanation?`<h3>Что предстоит изучить</h3><p>${esc(explanation[1])}</p><h3>Что можно будет сделать</h3><p>${esc(explanation[2])}</p><p class="muted">Редакционное пояснение, требует согласования; не заменяет рабочую программу дисциплины.</p>`:''}
      <details><summary>Семестры и учебная нагрузка</summary><p>${s.hours} академических часов · ${s.credits} з.е. за все этапы</p><ul>${s.semesters.map(v=>`<li>${v.semester} семестр (${Math.ceil(v.semester/2)} курс): ${v.credits} з.е.; ${esc(v.assessment?.join(', ')||'форма контроля не указана')}.</li>`).join('')}</ul><p>Кафедра: ${esc(s.department)}. Строка ${s.sourceRow} исходного плана.</p></details>
      <h3>На что опирается</h3>${links(data.edges.filter(e=>e.to===id).map(e=>e.from))}<h3>Куда ведёт</h3>${links(data.edges.filter(e=>e.from===id).map(e=>e.to))}<p class="muted">Зависимости знаний предлагаются для проверки преподавателями.</p>
      <h3>Кто преподаёт</h3>${assigned.length?assigned.map(t=>`<a class="text-link" href="#teacher-${t.id}">${esc(t.name)}</a>`).join(''):'<p>Назначение преподавателя для этой версии пока не подтверждено.</p>'}
      <h3>Применение знаний</h3>${relatedProjects.length?relatedProjects.map(p=>`<a class="text-link" href="#project-${p.id}">${esc(p.title)} · идея проекта</a>`).join(''):'<p>Подтверждённые проекты пока не добавлены.</p>'}
      <button type="button" class="map-primary" data-action="focus-branch">Посмотреть эту ветвь</button>`;
    $('#choice-select')?.addEventListener('change',event=>showSubject(event.target.value));
    if(!dialog.open) dialog.showModal();
  }
  root.addEventListener('click',event=>{
    const subject=event.target.closest('[data-subject]'); if(subject) {showSubject(subject.dataset.subject);return;}
    if(event.target.closest('a[href^="#"]')&&dialog.open) dialog.close();
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(!action)return;
    if(action==='close'){dialog.close();return;}
    if(action==='play') {
      if(timer){stop();return;}
      if(motion.matches)return;
      if(semester===8)reveal(2,false);
      timer=setInterval(()=>reveal(semester+1),1800);
      $('[data-action="play"]').textContent='Ⅱ Пауза'; $('[data-action="play"]').setAttribute('aria-pressed','true'); return;
    }
    stop();
    if(action==='next')reveal(semester+1);
    if(action==='back')reveal(semester-1);
    if(action==='all')reveal(8,false);
    if(action==='list'){list=!list;render();}
    if(action==='reset'||action==='clear') {
      query='';module='';selected=null;branch=false;$('#subject-search').value='';$('#module-filter').value='';
      if(action==='reset'){zoom=1;$('#map-zoom').value=100;$('#zoom-value').value='100%';reveal(2,false);viewport.scrollTo(0,0);}else render();
    }
    if(action==='focus-branch'){branch=true;query='';module='';$('#subject-search').value='';$('#module-filter').value='';reveal(8,false);scrollToFirstMatch();dialog.close();}
  });
  $('#plan-version').onchange=e=>{version=e.target.value;changeVersion();};
  $('#semester-filter').onchange=e=>{stop();reveal(Number(e.target.value));};
  $('#course-filter').onchange=e=>{stop();reveal(Number(e.target.value)*2);};
  $('#subject-search').oninput=e=>{stop();query=e.target.value.trim().toLocaleLowerCase('ru');
    if(query)for(const s of data.subjects)if(s.choice&&s.name.toLocaleLowerCase('ru').includes(query))choices[s.choice]=s.id;
    if(query)semester=8;render();if(query)scrollToFirstMatch();};
  $('#module-filter').onchange=e=>{stop();module=e.target.value;render();scrollToFirstMatch();};
  $('#branch-only').onchange=e=>{branch=e.target.checked;render();};
  $('#map-zoom').oninput=e=>{zoom=Number(e.target.value)/100;$('#zoom-value').value=`${e.target.value}%`;render();};
  mobile.addEventListener('change',render); motion.addEventListener('change',()=>{stop();render();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  let drag;
  viewport.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&!e.target.closest('button')){drag={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(e.pointerId);}});
  viewport.addEventListener('pointermove',e=>{if(drag){viewport.scrollLeft=drag.left+drag.x-e.clientX;viewport.scrollTop=drag.top+drag.y-e.clientY;}});
  viewport.addEventListener('pointerup',()=>drag=null);viewport.addEventListener('pointercancel',()=>drag=null);
  document.querySelector('#teachers-content').innerHTML=teachers.map(t=>`<article class="card" id="teacher-${t.id}"><div class="teacher-monogram" aria-hidden="true">АФ</div><span class="eyebrow">${esc(t.role)}</span><h3>${esc(t.name)}</h3><p>${esc(t.bio)}</p><p class="muted">${esc(t.source)} Фото, рассказ о профессиональных интересах и назначения на дисциплины будут добавлены после подтверждения.</p><a class="text-link" href="#learning-map">К карте программы →</a></article>`).join('');
  document.querySelector('#projects-content').innerHTML=projects.map((p,i)=>`<article class="card" id="project-${p.id}"><div class="project-number">0${i+1}</div><span class="eyebrow">${esc(p.status)}</span><h3>${esc(p.title)}</h3><p>${esc(p.task)}</p><div class="chips">${p.technologies.map(t=>`<span class="chip">${esc(t)}</span>`).join('')}</div><p>${esc(p.result)}</p><p class="muted">Пример применения знаний. Команда, руководитель и демонстрация пока не заявлены.</p><button class="text-link" type="button" data-project="${p.id}">Какие знания понадобятся →</button></article>`).join('');
  document.querySelector('#projects-content').addEventListener('click',e=>{
    const id=e.target.closest('[data-project]')?.dataset.project; if(!id)return;
    const project=projects.find(p=>p.id===id); const subject=[...project.subjects].reverse().find(id=>data.subjects.some(s=>s.id===id));
    query='';module='';branch=false;$('#subject-search').value='';$('#module-filter').value='';
    root.scrollIntoView({behavior:motion.matches?'instant':'smooth'});showSubject(subject);
  });
  changeVersion();
}
