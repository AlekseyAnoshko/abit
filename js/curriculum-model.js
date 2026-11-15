/** Pure curriculum operations, shared by the UI and regression checks. */
export function buildVersion(source, changes, version) {
  const data = structuredClone(source);
  data.version = version;
  data.draft = version === '2027';
  if (data.draft) {
    for (const change of changes) {
      data.subjects = data.subjects.filter(s => s.id !== change.previousId);
      data.edges = data.edges.filter(e => e.from !== change.previousId && e.to !== change.previousId);
    }
  }
  return data;
}
export function relatedIds(id, edges) {
  const result = new Set([id]);
  for (const direction of ['from', 'to']) {
    const visited = new Set([id]), queue = [id];
    while (queue.length) {
      const current = queue.shift();
      for (const edge of edges) {
        if (edge[direction] !== current) continue;
        const next = edge[direction === 'from' ? 'to' : 'from'];
        if (!visited.has(next)) { visited.add(next); result.add(next); queue.push(next); }
      }
    }
  }
  return result;
}
export function selectedSubjects(subjects, choices) {
  return subjects.filter(s => !s.choice || choices[s.choice] === s.id);
}
export function stageEdges(subjects, edges) {
  const result = [];
  const byId = new Map(subjects.map(s => [s.id, s]));
  for (const s of subjects) {
    const stages = s.semesters.map(v => v.semester).sort((a,b) => a-b);
    for (let i=1; i<stages.length; i++) result.push({from:`${s.id}@${stages[i-1]}`, to:`${s.id}@${stages[i]}`, status:'continuation', subjectFrom:s.id, subjectTo:s.id});
  }
  for (const e of edges) {
    const a=byId.get(e.from), b=byId.get(e.to);
    if (!a || !b) continue;
    const target=Math.min(...b.semesters.map(v=>v.semester));
    const prior=a.semesters.map(v=>v.semester).filter(v=>v<target);
    if (!prior.length) continue;
    result.push({...e, from:`${a.id}@${Math.max(...prior)}`, to:`${b.id}@${target}`, subjectFrom:a.id, subjectTo:b.id});
  }
  return result;
}
