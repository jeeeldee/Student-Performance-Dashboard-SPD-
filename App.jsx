import React, { useEffect, useMemo, useState } from "react";
import { supabase, configured } from "./supabase";
import { BookOpen, Users, LayoutDashboard, LogOut, Plus, Download, Printer, RefreshCw, Trash2, Pencil, CheckCircle2, XCircle, Search, ShieldCheck, FileJson, FileSpreadsheet } from "lucide-react";

const pct = (score, total) => total > 0 ? Math.round((Number(score) / Number(total)) * 10000) / 100 : 0;
const csvCell = v => `"${String(v ?? "").replaceAll('"','""')}"`;
function download(name, content, type="text/plain") {
  const a=document.createElement("a"); const u=URL.createObjectURL(new Blob([content],{type}));
  a.href=u; a.download=name; a.click(); URL.revokeObjectURL(u);
}
function App(){
  const [session,setSession]=useState(null), [profile,setProfile]=useState(null), [tab,setTab]=useState("dashboard");
  const [students,setStudents]=useState([]), [activities,setActivities]=useState([]), [scores,setScores]=useState([]);
  const [loading,setLoading]=useState(false), [error,setError]=useState(""), [notice,setNotice]=useState("");
  const [loginEmail,setLoginEmail]=useState(""), [loginPassword,setLoginPassword]=useState("");
  const [studentForm,setStudentForm]=useState({id:null,full_name:"",email:"",student_no:"",grade_section:""});
  const [activityForm,setActivityForm]=useState({id:null,title:"",subject:"",quarter:"1",total_items:20,passing_percentage:75,description:""});
  const [scoreForm,setScoreForm]=useState({student_id:"",activity_id:"",score:0});
  const [search,setSearch]=useState("");
  const [sectionFilter,setSectionFilter]=useState("all");
  const [subjectFilter,setSubjectFilter]=useState("all");
  const isTeacher=profile?.role==="teacher";

  useEffect(()=>{ if(!configured)return; supabase.auth.getSession().then(({data})=>setSession(data.session)); const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s)); return ()=>subscription.unsubscribe();},[]);
  useEffect(()=>{ if(session) loadAll(); else {setProfile(null);setStudents([]);setActivities([]);setScores([]);} },[session]);
  async function loadAll(){
    setLoading(true); setError("");
    try{
      const {data:p,error:pe}=await supabase.from("profiles").select("*").eq("id",session.user.id).single(); if(pe)throw pe; setProfile(p);
      const [st,ac,sc]=await Promise.all([
        supabase.from("students").select("*").order("full_name"),
        supabase.from("activities").select("*").order("created_at",{ascending:false}),
        supabase.from("scores").select("*")
      ]);
      if(st.error)throw st.error;if(ac.error)throw ac.error;if(sc.error)throw sc.error;
      setStudents(st.data||[]);setActivities(ac.data||[]);setScores(sc.data||[]);
    }catch(e){setError(e.message||"Unable to load records.");}finally{setLoading(false);}
  }
  async function signIn(e){e.preventDefault();setError("");const {error}=await supabase.auth.signInWithPassword({email:loginEmail,password:loginPassword});if(error)setError(error.message);}
  async function signOut(){await supabase.auth.signOut();}
  async function saveStudent(e){
    e.preventDefault();setError(""); const payload={full_name:studentForm.full_name,email:studentForm.email,student_no:studentForm.student_no,grade_section:studentForm.grade_section};
    const q=studentForm.id?supabase.from("students").update(payload).eq("id",studentForm.id):supabase.from("students").insert(payload);
    const {error}=await q;if(error){setError(error.message);return;}setNotice("Student record saved.");setStudentForm({id:null,full_name:"",email:"",student_no:"",grade_section:""});loadAll();
  }
  async function deleteStudent(id){if(!confirm("Delete this student and associated scores?"))return;const {error}=await supabase.from("students").delete().eq("id",id);if(error)setError(error.message);else{setNotice("Student deleted.");loadAll();}}
  async function saveActivity(e){
    e.preventDefault();const payload={title:activityForm.title,subject:activityForm.subject,quarter:Number(activityForm.quarter),total_items:Number(activityForm.total_items),passing_percentage:Number(activityForm.passing_percentage),description:activityForm.description};
    const q=activityForm.id?supabase.from("activities").update(payload).eq("id",activityForm.id):supabase.from("activities").insert(payload);
    const {error}=await q;if(error){setError(error.message);return;}setNotice("LAS activity saved.");setActivityForm({id:null,title:"",subject:"",quarter:"1",total_items:20,passing_percentage:75,description:""});loadAll();
  }
  async function deleteActivity(id){if(!confirm("Delete this activity and its scores?"))return;const {error}=await supabase.from("activities").delete().eq("id",id);if(error)setError(error.message);else{setNotice("Activity deleted.");loadAll();}}
  async function saveScore(e){
    e.preventDefault();const existing=scores.find(x=>x.student_id===scoreForm.student_id&&x.activity_id===scoreForm.activity_id);
    const payload={student_id:scoreForm.student_id,activity_id:scoreForm.activity_id,score:Number(scoreForm.score)};
    const q=existing?supabase.from("scores").update({score:payload.score}).eq("id",existing.id):supabase.from("scores").insert(payload);
    const {error}=await q;if(error)setError(error.message);else{setNotice("Score recorded.");loadAll();}
  }
  const summary=useMemo(()=>{
    const completed=scores.filter(s=>activities.some(a=>a.id===s.activity_id));
    const passed=completed.filter(s=>{const a=activities.find(x=>x.id===s.activity_id);return a&&pct(s.score,a.total_items)>=a.passing_percentage;});
    const avg=completed.length?completed.reduce((n,s)=>{const a=activities.find(x=>x.id===s.activity_id);return n+(a?pct(s.score,a.total_items):0);},0)/completed.length:0;
    return {completed:completed.length,passed:passed.length,failed:completed.length-passed.length,avg};
  },[scores,activities]);
  const sectionNames=[...new Set(students.map(s=>s.grade_section).filter(Boolean))].sort();
  const subjectNames=[...new Set(activities.map(a=>a.subject).filter(Boolean))].sort();
  const filteredStudents=students.filter(s=>(sectionFilter==="all"||s.grade_section===sectionFilter)&&`${s.full_name} ${s.student_no} ${s.grade_section}`.toLowerCase().includes(search.toLowerCase()));
  const filteredActivities=activities.filter(a=>(subjectFilter==="all"||a.subject===subjectFilter)&&`${a.title} ${a.subject}`.toLowerCase().includes(search.toLowerCase()));
  function exportCSV(){
    const rows=[["Student No.","Student","Section","Activity","Subject","Score","Items","Percentage","Result"]];
    scores.forEach(s=>{const st=students.find(x=>x.id===s.student_id),a=activities.find(x=>x.id===s.activity_id);if(st&&a)rows.push([st.student_no,st.full_name,st.grade_section,a.title,a.subject,s.score,a.total_items,pct(s.score,a.total_items),pct(s.score,a.total_items)>=a.passing_percentage?"PASS":"FAIL"]);});
    download("LAS-monitoring-report.csv",rows.map(r=>r.map(csvCell).join(",")).join("\n"),"text/csv");
  }
  async function backupJSON(){
    const {data,error}=await supabase.rpc("export_las_backup");if(error){setError(error.message);return;}
    download("LAS-backup-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify(data,null,2),"application/json");
  }
  if(!configured)return <div className="setup"><div className="setup-card"><BookOpen size={42}/><h1>LAS Monitoring System</h1><p>Connect your Supabase cloud database to activate the application.</p><ol><li>Create a Supabase project.</li><li>Run the SQL setup file included in this project.</li><li>Copy your project URL and anon key into <code>.env</code>.</li><li>Run <code>npm install</code> then <code>npm run dev</code>.</li></ol><p className="muted">See README.md for deployment and student-account setup.</p></div></div>;
  if(!session)return <div className="login-wrap"><form className="login-card" onSubmit={signIn}><div className="brand-icon"><BookOpen/></div><h1>LAS Monitoring</h1><p>Learning Activity Sheets Performance Tracker</p>{error&&<div className="alert">{error}</div>}<label>Email address<input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} required/></label><label>Password<input type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} required/></label><button className="primary full">Sign in</button><small>Use the account provided by your teacher or system administrator.</small></form></div>;
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-icon"><BookOpen/></div><div><b>LAS Monitor</b><small>Learning Activity Sheets</small></div></div>
      <div className="user-chip"><div className="avatar">{(profile?.full_name||session.user.email||"U")[0].toUpperCase()}</div><div><b>{profile?.full_name||session.user.email}</b><small>{profile?.role||"user"}</small></div></div>
      <nav>{[["dashboard","Overview",LayoutDashboard],["students","Students",Users],["activities","LAS Activities",BookOpen],["scores","Scores & Reports",FileSpreadsheet]].filter(([k])=>isTeacher||k==="dashboard").map(([k,n,I])=><button className={tab===k?"nav active":"nav"} onClick={()=>setTab(k)} key={k}><I size={18}/>{n}</button>)}</nav>
      <button className="nav logout" onClick={signOut}><LogOut size={18}/>Sign out</button>
      <div className="sidebar-foot"><ShieldCheck size={15}/> Secure cloud records</div>
    </aside>
    <main className="main"><header className="topbar"><div><span className="eyebrow">LEARNING PERFORMANCE</span><h2>{tab==="dashboard"?"Dashboard":tab==="students"?"Student Records":tab==="activities"?"LAS Activities":"Scores & Reports"}</h2></div><div className="top-actions"><span className="online"><i/> Online database</span><button className="icon-btn" title="Refresh" onClick={loadAll}><RefreshCw size={17}/></button></div></header>
      {error&&<div className="alert">{error}</div>}{notice&&<div className="notice" onClick={()=>setNotice("")}>{notice} ×</div>}{loading&&<div className="loading">Loading records…</div>}
      {tab==="dashboard"&&<>{isTeacher?<><div className="stat-grid"><Stat label="Total students" value={students.length} icon={<Users/>}/><Stat label="LAS activities" value={activities.length} icon={<BookOpen/>}/><Stat label="Recorded scores" value={summary.completed} icon={<FileSpreadsheet/>}/><Stat label="Average percentage" value={summary.avg.toFixed(1)+"%"} icon={<LayoutDashboard/>}/></div><div className="two-col"><section className="panel"><div className="panel-head"><h3>Performance summary</h3><span className="muted">All recorded scores</span></div><div className="passfail"><div><strong className="green">{summary.passed}</strong><span>Passed</span></div><div><strong className="red">{summary.failed}</strong><span>Failed</span></div><div><strong>{summary.completed?Math.round(summary.passed/summary.completed*100):0}%</strong><span>Passing rate</span></div></div><div className="bar"><span style={{width:(summary.completed?summary.passed/summary.completed*100:0)+"%"}}/></div></section><section className="panel"><div className="panel-head"><h3>Section overview</h3><span className="muted">Enrollment by section</span></div>{Object.entries(students.reduce((o,s)=>(o[s.grade_section||"Unassigned"]=(o[s.grade_section||"Unassigned"]||0)+1,o),{})).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=><div className="section-row" key={k}><span>{k}</span><b>{v} students</b></div>)}{!students.length&&<Empty text="No student records yet."/>}<div className="panel-head subhead"><h3>Subject coverage</h3><span className="muted">LAS activities per subject</span></div>{Object.entries(activities.reduce((o,a)=>(o[a.subject||"Unassigned"]=(o[a.subject||"Unassigned"]||0)+1,o),{})).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=><div className="section-row" key={k}><span>{k}</span><b>{v} activities</b></div>)}{!activities.length&&<Empty text="No subjects or activities yet."/>}</section></div><section className="panel"><div className="panel-head"><h3>Recent LAS activities</h3><button className="text-btn" onClick={()=>setTab("activities")}>Manage activities →</button></div><ActivityTable activities={activities.slice(0,5)} scores={scores} students={students} onEdit={()=>{}} onDelete={deleteActivity}/></section></>:<StudentDashboard profile={profile} students={students} activities={activities} scores={scores} userId={session.user.id}/>}</>}
      {tab==="students"&&isTeacher&&<section className="panel"><div className="panel-head"><div><h3>Manage students</h3><p className="muted">Create and maintain your class list.</p></div></div><form className="form-grid" onSubmit={saveStudent}><input placeholder="Full name" value={studentForm.full_name} onChange={e=>setStudentForm({...studentForm,full_name:e.target.value})} required/><input placeholder="Student number" value={studentForm.student_no} onChange={e=>setStudentForm({...studentForm,student_no:e.target.value})}/><input type="email" placeholder="Student email / login email" value={studentForm.email} onChange={e=>setStudentForm({...studentForm,email:e.target.value})}/><input placeholder="Grade & section" value={studentForm.grade_section} onChange={e=>setStudentForm({...studentForm,grade_section:e.target.value})}/><button className="primary"><Plus size={16}/> {studentForm.id?"Update student":"Add student"}</button>{studentForm.id&&<button type="button" className="secondary" onClick={()=>setStudentForm({id:null,full_name:"",email:"",student_no:"",grade_section:""})}>Cancel</button>}</form><div className="report-filters"><label>Filter section<select value={sectionFilter} onChange={e=>setSectionFilter(e.target.value)}><option value="all">All sections</option>{sectionNames.map(x=><option key={x}>{x}</option>)}</select></label></div><Toolbar search={search} setSearch={setSearch}/><div className="table-wrap"><table><thead><tr><th>Student</th><th>Student No.</th><th>Email</th><th>Section</th><th>Actions</th></tr></thead><tbody>{filteredStudents.map(s=><tr key={s.id}><td><b>{s.full_name}</b></td><td>{s.student_no||"—"}</td><td>{s.email||"—"}</td><td>{s.grade_section||"—"}</td><td className="actions"><button className="icon-btn" onClick={()=>setStudentForm({...s})}><Pencil size={16}/></button><button className="icon-btn danger" onClick={()=>deleteStudent(s.id)}><Trash2 size={16}/></button></td></tr>)}</tbody></table>{!filteredStudents.length&&<Empty text="No matching students."/>}</div></section>}
      {tab==="activities"&&isTeacher&&<section className="panel"><div className="panel-head"><div><h3>Manage LAS activities</h3><p className="muted">Set item counts and passing thresholds for each activity.</p></div></div><form className="form-grid activity-form" onSubmit={saveActivity}><input placeholder="Activity title" value={activityForm.title} onChange={e=>setActivityForm({...activityForm,title:e.target.value})} required/><input placeholder="Subject" value={activityForm.subject} onChange={e=>setActivityForm({...activityForm,subject:e.target.value})} required/><select value={activityForm.quarter} onChange={e=>setActivityForm({...activityForm,quarter:e.target.value})}><option value="1">Quarter 1</option><option value="2">Quarter 2</option><option value="3">Quarter 3</option><option value="4">Quarter 4</option></select><input type="number" min="1" placeholder="Number of items" value={activityForm.total_items} onChange={e=>setActivityForm({...activityForm,total_items:e.target.value})} required/><input type="number" min="0" max="100" placeholder="Passing %" value={activityForm.passing_percentage} onChange={e=>setActivityForm({...activityForm,passing_percentage:e.target.value})} required/><input placeholder="Description (optional)" value={activityForm.description} onChange={e=>setActivityForm({...activityForm,description:e.target.value})}/><button className="primary"><Plus size={16}/>{activityForm.id?"Update activity":"Add activity"}</button>{activityForm.id&&<button type="button" className="secondary" onClick={()=>setActivityForm({id:null,title:"",subject:"",quarter:"1",total_items:20,passing_percentage:75,description:""})}>Cancel</button>}</form><div className="report-filters"><label>Filter subject<select value={subjectFilter} onChange={e=>setSubjectFilter(e.target.value)}><option value="all">All subjects</option>{subjectNames.map(x=><option key={x}>{x}</option>)}</select></label></div><Toolbar search={search} setSearch={setSearch}/><ActivityTable activities={filteredActivities} scores={scores} students={students} onEdit={a=>setActivityForm({...a,quarter:String(a.quarter)})} onDelete={deleteActivity}/></section>}
      {tab==="scores"&&isTeacher&&<section className="panel"><div className="panel-head"><div><h3>Record and review scores</h3><p className="muted">Enter the student's raw score. Percentage and result are calculated automatically.</p></div><div className="export-actions"><button className="secondary" onClick={exportCSV}><Download size={16}/> CSV</button><button className="secondary" onClick={backupJSON}><FileJson size={16}/> JSON backup</button><button className="secondary" onClick={()=>window.print()}><Printer size={16}/> Print</button></div></div><form className="score-form" onSubmit={saveScore}><select value={scoreForm.student_id} onChange={e=>setScoreForm({...scoreForm,student_id:e.target.value})} required><option value="">Select student</option>{students.map(s=><option value={s.id} key={s.id}>{s.full_name} — {s.grade_section}</option>)}</select><select value={scoreForm.activity_id} onChange={e=>setScoreForm({...scoreForm,activity_id:e.target.value})} required><option value="">Select activity</option>{activities.map(a=><option value={a.id} key={a.id}>{a.title} ({a.total_items} items)</option>)}</select><input type="number" min="0" max={activities.find(a=>a.id===scoreForm.activity_id)?.total_items||9999} placeholder="Raw score" value={scoreForm.score} onChange={e=>setScoreForm({...scoreForm,score:e.target.value})} required/><button className="primary">Save score</button></form><div className="report-filters"><label>Filter section<select value={sectionFilter} onChange={e=>setSectionFilter(e.target.value)}><option value="all">All sections</option>{sectionNames.map(x=><option key={x}>{x}</option>)}</select></label><label>Filter subject<select value={subjectFilter} onChange={e=>setSubjectFilter(e.target.value)}><option value="all">All subjects</option>{subjectNames.map(x=><option key={x}>{x}</option>)}</select></label></div><ScoreTable scores={scores} students={students.filter(s=>sectionFilter==="all"||s.grade_section===sectionFilter)} activities={activities.filter(a=>subjectFilter==="all"||a.subject===subjectFilter)}/><ClassSubjectReport scores={scores} students={students.filter(s=>sectionFilter==="all"||s.grade_section===sectionFilter)} activities={activities.filter(a=>subjectFilter==="all"||a.subject===subjectFilter)}/></section>}
    </main>
  </div>;
}
function Stat({label,value,icon}){return <div className="stat"><div className="stat-icon">{icon}</div><span>{label}</span><strong>{value}</strong></div>}
function Empty({text}){return <div className="empty">{text}</div>}
function Toolbar({search,setSearch}){return <div className="toolbar"><div className="search"><Search size={16}/><input placeholder="Search records…" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>}
function ActivityTable({activities,scores,students,onEdit,onDelete}){return <div className="table-wrap"><table><thead><tr><th>Activity</th><th>Subject</th><th>Quarter</th><th>Items</th><th>Passing</th><th>Scores</th><th>Actions</th></tr></thead><tbody>{activities.map(a=><tr key={a.id}><td><b>{a.title}</b></td><td>{a.subject}</td><td>{a.quarter}</td><td>{a.total_items}</td><td>{a.passing_percentage}%</td><td>{scores.filter(s=>s.activity_id===a.id).length}</td><td className="actions"><button className="icon-btn" onClick={()=>onEdit(a)}><Pencil size={16}/></button><button className="icon-btn danger" onClick={()=>onDelete(a.id)}><Trash2 size={16}/></button></td></tr>)}</tbody></table>{!activities.length&&<Empty text="No LAS activities created yet."/>}</div>}
function ScoreTable({scores,students,activities,onlyStudent}){const rows=scores.filter(s=>!onlyStudent||s.student_id===onlyStudent);return <div className="table-wrap"><table><thead><tr><th>Student</th><th>Section</th><th>Activity</th><th>Score</th><th>Percentage</th><th>Result</th></tr></thead><tbody>{rows.map(s=>{const st=students.find(x=>x.id===s.student_id),a=activities.find(x=>x.id===s.activity_id);if(!st||!a)return null;const p=pct(s.score,a.total_items),pass=p>=a.passing_percentage;return <tr key={s.id}><td><b>{st.full_name}</b></td><td>{st.grade_section}</td><td>{a.title}</td><td>{s.score}/{a.total_items}</td><td>{p.toFixed(2)}%</td><td><span className={pass?"status pass":"status fail"}>{pass?<CheckCircle2 size={14}/>:<XCircle size={14}/>}{pass?"PASS":"FAIL"}</span></td></tr>})}</tbody></table>{!rows.length&&<Empty text="No scores recorded yet."/>}</div>}
function ClassSubjectReport({scores,students,activities}){
  const {rows,subjects,sectionRows}=useMemo(()=>{
    const groups=new Map();
    scores.forEach(score=>{
      const student=students.find(x=>x.id===score.student_id);
      const activity=activities.find(x=>x.id===score.activity_id);
      if(!student||!activity)return;
      const section=student.grade_section||"Unassigned";
      const subject=activity.subject||"Unassigned";
      const key=section+"\u0000"+subject;
      if(!groups.has(key))groups.set(key,{section,subject,percentages:[],passed:0,learners:new Set(),activities:new Set()});
      const group=groups.get(key);
      const percentage=pct(score.score,activity.total_items);
      group.percentages.push(percentage);
      if(percentage>=activity.passing_percentage)group.passed+=1;
      group.learners.add(student.id);
      group.activities.add(activity.id);
    });
    const detail=[...groups.values()].map(g=>({
      section:g.section,subject:g.subject,learners:g.learners.size,
      submissions:g.percentages.length,activities:g.activities.size,
      average:g.percentages.reduce((a,b)=>a+b,0)/g.percentages.length,
      passRate:g.passed/g.percentages.length*100
    })).sort((a,b)=>a.section.localeCompare(b.section)||a.subject.localeCompare(b.subject));
    const subjectList=[...new Set(detail.map(r=>r.subject))].sort((a,b)=>a.localeCompare(b));
    const sectionList=[...new Set(detail.map(r=>r.section))].sort((a,b)=>a.localeCompare(b));
    const pivot=sectionList.map(section=>{
      const entries=detail.filter(r=>r.section===section);
      const allScores=entries.reduce((n,r)=>n+r.submissions,0);
      return {
        section,
        bySubject:Object.fromEntries(entries.map(r=>[r.subject,r.average])),
        overall:allScores?entries.reduce((n,r)=>n+r.average*r.submissions,0)/allScores:0,
        learners:new Set(scores.filter(sc=>students.some(st=>st.id===sc.student_id&&st.grade_section===section)&&activities.some(ac=>ac.id===sc.activity_id)).map(sc=>sc.student_id)).size,
        submissions:allScores
      };
    });
    return {rows:detail,subjects:subjectList,sectionRows:pivot};
  },[scores,students,activities]);
  function exportReport(){
    const data=[["Section","Subject","Learners with scores","Activities assessed","Score submissions","Average performance (%)","Pass rate (%)"],...rows.map(r=>[r.section,r.subject,r.learners,r.activities,r.submissions,r.average.toFixed(2),r.passRate.toFixed(2)])];
    download("LAS-class-subject-performance-detail.csv",data.map(r=>r.map(csvCell).join(",")).join("\n"),"text/csv");
  }
  function exportComparison(){
    const data=[["Section",...subjects.map(s=>`${s} average (%)`),"Overall average (%)","Learners assessed","Score submissions"],...sectionRows.map(r=>[r.section,...subjects.map(s=>r.bySubject[s]===undefined?"":r.bySubject[s].toFixed(2)),r.overall.toFixed(2),r.learners,r.submissions])];
    download("LAS-section-subject-comparison.csv",data.map(r=>r.map(csvCell).join(",")).join("\n"),"text/csv");
  }
  return <div className="performance-report">
    <div className="panel-head report-title"><div><h3>Class and subject performance</h3><p className="muted">Compare section averages side by side by subject. Averages use recorded score percentages; unrecorded activities are excluded.</p></div><div className="export-actions"><button className="secondary" onClick={exportComparison} disabled={!sectionRows.length}><Download size={16}/> Export comparison</button><button className="secondary" onClick={exportReport} disabled={!rows.length}><Download size={16}/> Export details</button></div></div>
    <h4>Section comparison</h4>
    <div className="table-wrap"><table><thead><tr><th>Section</th>{subjects.map(subject=><th key={subject}>{subject}</th>)}<th>Overall average</th><th>Learners assessed</th><th>Score entries</th></tr></thead><tbody>{sectionRows.map(r=><tr key={r.section}><td><b>{r.section}</b></td>{subjects.map(subject=><td key={subject}>{r.bySubject[subject]===undefined?"—":`${r.bySubject[subject].toFixed(2)}%`}</td>)}<td><b>{r.overall.toFixed(2)}%</b></td><td>{r.learners}</td><td>{r.submissions}</td></tr>)}</tbody></table>{!sectionRows.length&&<Empty text="No scored activities are available for the selected section and subject."/>}</div>
    <h4>Detailed subject results</h4>
    <div className="table-wrap"><table><thead><tr><th>Section</th><th>Subject</th><th>Learners</th><th>Activities assessed</th><th>Score entries</th><th>Average performance</th><th>Pass rate</th></tr></thead><tbody>{rows.map(r=><tr key={r.section+"-"+r.subject}><td><b>{r.section}</b></td><td>{r.subject}</td><td>{r.learners}</td><td>{r.activities}</td><td>{r.submissions}</td><td><b>{r.average.toFixed(2)}%</b></td><td>{r.passRate.toFixed(1)}%</td></tr>)}</tbody></table>{!rows.length&&<Empty text="No detailed results available."/>}</div>
  </div>;
}

function StudentDashboard({profile,students,activities,scores,userId}){const st=students.find(s=>s.profile_id===userId);const mine=scores.filter(s=>s.student_id===st?.id);const avg=mine.length?mine.reduce((n,s)=>n+pct(s.score,activities.find(a=>a.id===s.activity_id)?.total_items||1),0)/mine.length:0;return <><div className="welcome"><div><span className="eyebrow">STUDENT PORTAL</span><h2>Welcome, {profile?.full_name||"Learner"}!</h2><p>Your personal LAS performance overview.</p></div><div className="stat-icon large"><BookOpen/></div></div><div className="stat-grid"><Stat label="Activities available" value={activities.length} icon={<BookOpen/>}/><Stat label="Activities completed" value={mine.length} icon={<CheckCircle2/>}/><Stat label="Average percentage" value={avg.toFixed(1)+"%"} icon={<LayoutDashboard/>}/><Stat label="Passed" value={mine.filter(s=>{const a=activities.find(a=>a.id===s.activity_id);return a&&pct(s.score,a.total_items)>=a.passing_percentage;}).length} icon={<ShieldCheck/>}/></div><section className="panel"><h3>My LAS results</h3><ScoreTable scores={scores} students={students} activities={activities} onlyStudent={st?.id}/>{!st&&<p className="muted">Your student record has not yet been linked to this login. Please contact your teacher.</p>}</section></>}
export default App;