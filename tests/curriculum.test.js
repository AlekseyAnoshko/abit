import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildVersion, relatedIds, selectedSubjects, stageEdges} from '../js/curriculum-model.js';
import {changes, projects} from '../js/data/curriculum-editorial.js';
const source=JSON.parse(fs.readFileSync(new URL('../js/data/evm-curriculum.json',import.meta.url)));
test('source has unique identities, valid semesters and 240 credits without electives double counting',()=>{
 assert.equal(new Set(source.subjects.map(s=>s.id)).size,source.subjects.length);
 const credits=source.subjects.filter(s=>s.selected&&!s.id.startsWith('ФТД')).reduce((sum,s)=>sum+s.credits,0);
 assert.equal(credits,240);
 assert.equal(source.semesterCredits.reduce((a,b)=>a+b,0),240);
 for(const s of source.subjects) for(const v of s.semesters) assert.ok(v.semester>=1&&v.semester<=8);
 assert.ok(source.subjects.find(s=>s.name==='Общая физическая подготовка').semesters.some(v=>v.credits===0&&v.studyHours>0));
 for(const e of source.edges)for(const id of [e.from,e.to])assert.ok(source.subjects.some(s=>s.id===id));
 for(const p of projects)for(const id of p.subjects)assert.ok(source.subjects.some(s=>s.id===id));
});
test('2027 replacement does not inherit old teaching periods, credits or edges, or mutate source',()=>{
 const snapshot=JSON.stringify(source),draft=buildVersion(source,changes,'2027');
 assert.ok(!draft.subjects.some(s=>s.id==='Б1.Б.03.01'));
 assert.ok(!draft.edges.some(e=>e.from==='Б1.Б.03.01'||e.to==='Б1.Б.03.01'));
 assert.equal(JSON.stringify(source),snapshot);
 assert.ok(buildVersion(source,changes,'source').subjects.some(s=>s.name==='Информатика'));
});
test('choices are mutually exclusive and chronological edges point forward',()=>{
 const choices={};for(const s of source.subjects)if(s.choice)choices[s.choice]=s.id;
 const subjects=selectedSubjects(source.subjects,choices);
 for(const id of Object.keys(choices))assert.equal(subjects.filter(s=>s.choice===id).length,1);
 const edges=stageEdges(subjects,source.edges);
 for(const e of edges)assert.ok(Number(e.from.split('@')[1])<Number(e.to.split('@')[1]));
 assert.ok(edges.some(e=>e.status==='continuation'));
});
test('chain follows ancestors and descendants, not siblings; cycles terminate',()=>{
 const edges=[{from:'a',to:'b'},{from:'b',to:'c'},{from:'a',to:'d'}];
 assert.deepEqual([...relatedIds('b',edges)].sort(),['a','b','c']);
 assert.equal(relatedIds('a',[...edges,{from:'c',to:'a'}]).size,4);
});
