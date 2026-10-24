"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {MessagesSquare,Send,Play,Square,Trash2,Volume2,Mic,MicOff,ShieldCheck,ClipboardCheck,AlertCircle} from "lucide-react";
import {PageHeader} from "@/components/ui/page-header";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {Input} from "@/components/ui/input";

type Rubric={relevance:number;specificity:number;structure:number;clarity:number};
type Feedback={status:"evaluated"|"unavailable";score:number|null;criteria:Rubric|null;strength:string;improvement:string;nextExercise:string;evidenceQuote:string;disclaimer:string};
type Question={question:string;suggestedAnswer:string;focus:string};
type Message={id:string;role:string;content:string;score?:number|null;feedback?:Feedback|null};
type Report={summary:string;answers:number;evaluatedAnswers:number;ungradedAnswers:number;overallScore:number|null;dimensions:Record<keyof Rubric,number|null>;strengths:string[];improvements:string[];exercises:string[]};
type Session={id:string;title:string;type:string;status:string;currentQuestion:number;overallScore:number|null;messages?:Message[];configuration?:{language?:"fr"|"en";questionSet?:{questions:Question[];recruiterQuestions:string[]}};report?:Report|null};
type Recognition={lang:string;continuous:boolean;interimResults:boolean;onresult:((event:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void};
type SpeechWindow=Window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
const labels:Record<keyof Rubric,string>={relevance:"Pertinence",specificity:"Exemples concrets",structure:"Structure",clarity:"Clarté"};

export default function Interviews(){
  const [sessions,setSessions]=useState<Session[]>([]),[current,setCurrent]=useState<Session|null>(null),[answer,setAnswer]=useState(""),[prep,setPrep]=useState<Session|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[isListening,setIsListening]=useState(false),[speechAvailable,setSpeechAvailable]=useState(false);
  const [form,setForm]=useState({role:"",level:"",language:"fr" as "fr"|"en",questionCount:10,jobDescription:""});
  const listening=useRef<Recognition|null>(null);
  const [applicationId, setApplicationId] = useState("");
  const load=useCallback(async()=>{try{const r=await fetch("/api/interviews",{cache:"no-store"});if(r.ok)setSessions(await r.json());}catch{/* retry on navigation */}},[]);
  useEffect(()=>{void load();const w=window as SpeechWindow;setSpeechAvailable(!!(w.SpeechRecognition||w.webkitSpeechRecognition));return ()=>{listening.current?.stop();window.speechSynthesis?.cancel();};},[load]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("applicationId");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    const controller = new AbortController();
    void fetch(`/api/applications/${encodeURIComponent(id)}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("APPLICATION_NOT_FOUND");
      return response.json();
    }).then(application => {
      if (controller.signal.aborted) return;
      setApplicationId(application.id);
      setForm(previous => ({ ...previous, role: application.jobTitle?.slice(0,160) || previous.role, jobDescription: application.job?.description?.slice(0,12000) || previous.jobDescription }));
    }).catch(() => { /* User can still prepare an independent interview. */ });
    return () => controller.abort();
  }, []);
  const request=async(url:string,method="POST",body?:unknown)=>{
    const r=await fetch(url,{method,headers:body===undefined?undefined:{"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
    const value=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(typeof value.error==="string"?value.error:"REQUEST_FAILED");
    return value;
  };
  const guard=async(fn:()=>Promise<void>)=>{setBusy(true);setError("");try{await fn();}catch(e){setError(e instanceof Error?e.message:"Action indisponible.");}finally{setBusy(false);}};
  const prepare=async(e:React.FormEvent)=>{e.preventDefault();await guard(async()=>{const next:Session=await request("/api/interviews","POST",{...form,...(applicationId ? { applicationId } : {}),questionCount:Number(form.questionCount),mode:"PREPARATION"});setPrep(next);setSessions(v=>[next,...v]);});};
  const start=async(s:Session)=>guard(async()=>{const started:Session=await request(`/api/interviews/${s.id}/start`);setCurrent(started);setPrep(null);setSessions(v=>v.map(item=>item.id===started.id?started:item));});
  const send=async()=>{
    if(!current||!answer.trim())return;
    stopListening();
    await guard(async()=>{
      const response:{answer:Message;next:Message|null;feedback:Feedback;overallScore:number|null;status:string;progress:{answered:number;total:number;completed:boolean}}=await request(`/api/interviews/${current.id}/message`,"POST",{answer:answer.trim()});
      setCurrent(v=>v&&v.id===current.id?{...v,messages:[...(v.messages||[]),response.answer,...(response.next?[response.next]:[])],currentQuestion:response.progress.answered,status:response.status,overallScore:response.overallScore}:v);
      setAnswer("");void load();
    });
  };
  const finish=async()=>{if(!current)return;stopListening();await guard(async()=>{const updated:Session=await request(`/api/interviews/${current.id}/finish`);setCurrent(updated);void load();});};
  const remove=async(id:string)=>guard(async()=>{await fetch(`/api/interviews/${id}`,{method:"DELETE"}).then(r=>{if(!r.ok)throw new Error("DELETE_FAILED");});if(current?.id===id)setCurrent(null);if(prep?.id===id)setPrep(null);void load();});
  const readQuestion=()=>{
    if(typeof window==="undefined"||!("speechSynthesis" in window))return;
    const latest=[...(current?.messages||[])].reverse().find(m=>m.role==="assistant");if(!latest)return;
    window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(latest.content);
    utterance.lang=current?.configuration?.language==="en"?"en-US":"fr-FR";utterance.rate=0.94;window.speechSynthesis.speak(utterance);
  };
  const stopListening=()=>{listening.current?.stop();listening.current=null;setIsListening(false);};
  const toggleDictation=()=>{
    if(isListening){stopListening();return;}
    const w=window as SpeechWindow,Ctor=w.SpeechRecognition||w.webkitSpeechRecognition;
    if(!Ctor){setError("La dictée vocale n'est pas prise en charge par ce navigateur.");return;}
    try{
      const rec=new Ctor();rec.lang=current?.configuration?.language==="en"?"en-US":"fr-FR";rec.continuous=false;rec.interimResults=false;
      rec.onresult=event=>{const transcript=Array.from(event.results).map(row=>row[0]?.transcript||"").join(" ").trim();if(transcript)setAnswer(v=>(v?`${v.trim()} `:"")+transcript);};
      rec.onerror=event=>{setError(`Dictée interrompue : ${event.error}. Vous pouvez toujours écrire votre réponse.`);setIsListening(false);};
      rec.onend=()=>{setIsListening(false);listening.current=null;};
      listening.current=rec;rec.start();setIsListening(true);
    }catch{setError("Impossible d'activer le micro. Vérifiez les permissions du navigateur.");setIsListening(false);}
  };
  const answers=current?.messages?.filter(m=>m.role==="user")||[];
  const questions=current?.configuration?.questionSet?.questions||[];
  const activeQuestion=current?.messages?.filter(m=>m.role==="assistant").at(-1)?.content;
  if(current)return <div className="mx-auto max-w-4xl space-y-5">
    <PageHeader title={current.title} description="Entraînement pédagogique. Les scores ne prédisent ni l'embauche ni la valeur d'un candidat."/>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <div className="text-sm"><strong>{answers.length} réponse{answers.length>1?"s":""}</strong> / {questions.length||5} questions · <span className="text-muted-foreground">{current.status}</span></div>
      <div className="flex gap-2"><Button variant="outline" onClick={()=>{stopListening();setCurrent(null);}} disabled={busy}>Historique</Button>{current.status!=="COMPLETED"&&<Button variant="outline" disabled={busy} onClick={()=>void finish()}><Square className="size-4"/>Terminer</Button>}</div>
    </div>
    <section className="space-y-4" aria-label="Conversation d'entretien">
      {current.messages?.map(m=><article key={m.id} className={`rounded-xl border p-4 ${m.role==="assistant"?"mr-5 bg-muted/50":"ml-5 bg-card"}`}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
        {m.role==="user"&&m.feedback&&<div className="mt-3 space-y-2 border-t pt-3 text-sm">
          {m.feedback.status==="evaluated"?<><p className="font-semibold">Score pédagogique : {m.feedback.score}/100</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(Object.entries(labels) as Array<[keyof Rubric,string]>).map(([key,label])=><p key={key} className="rounded bg-muted p-2 text-xs">{label} : {m.feedback?.criteria?.[key]??"—"}/4</p>)}</div>
            {m.feedback.evidenceQuote&&<p className="text-muted-foreground">Extrait considéré : « {m.feedback.evidenceQuote} »</p>}
            {m.feedback.strength&&<p><strong>Point fort : </strong>{m.feedback.strength}</p>}
          </>:<p className="text-muted-foreground">Évaluation indisponible — aucune note attribuée.</p>}
          <p><strong>À améliorer : </strong>{m.feedback.improvement}</p>
          <p><strong>Exercice : </strong>{m.feedback.nextExercise}</p>
        </div>}
      </article>)}
    </section>
    {current.status==="ACTIVE"?<section className="app-section space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Votre réponse</h2><Button size="sm" variant="outline" onClick={readQuestion} disabled={!activeQuestion}><Volume2 className="size-4"/>Écouter la question</Button></div>
      <Textarea rows={6} value={answer} onChange={e=>setAnswer(e.target.value)} maxLength={8000} placeholder="Décrivez une situation réelle, votre action et un résultat vérifiable." aria-label="Votre réponse à la question"/>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-md text-xs text-muted-foreground">La dictée utilise le moteur vocal du navigateur, qui peut transmettre la voix à son fournisseur. CVComet conserve le texte envoyé dans votre session, jamais le fichier audio.</p>
        <div className="flex flex-wrap gap-2">{speechAvailable&&<Button variant="outline" disabled={busy} onClick={toggleDictation}>{isListening?<><MicOff/>Arrêter</>:<><Mic/>Dicter</>}</Button>}<Button disabled={busy||isListening||!answer.trim()} onClick={()=>void send()}><Send/>Envoyer</Button></div>
      </div>
    </section>:current.status==="READY_TO_FINISH"?<section className="app-section"><p className="mb-3">Toutes les questions sont terminées. Générez votre bilan pédagogique.</p><Button disabled={busy} onClick={()=>void finish()}><ClipboardCheck/>Voir le bilan</Button></section>:current.report?<section className="app-section space-y-4">
      <h2 className="type-h2">Bilan pédagogique</h2><p className="text-sm text-muted-foreground">{current.report.summary}</p>
      <p className="font-semibold">{current.report.overallScore===null?"Aucun score disponible":`Score indicatif : ${current.report.overallScore}/100`} · {current.report.evaluatedAnswers}/{current.report.answers} réponses évaluées</p>
      <div className="grid gap-3 sm:grid-cols-2">{(Object.entries(labels) as Array<[keyof Rubric,string]>).map(([key,label])=><div key={key} className="rounded border p-3"><span className="text-sm text-muted-foreground">{label}</span><p className="font-semibold">{current.report?.dimensions?.[key]??"—"}{current.report?.dimensions?.[key]!==null&&current.report?.dimensions?.[key]!==undefined?"/100":""}</p></div>)}</div>
      {([ ["Points forts",current.report.strengths],["Pistes d'amélioration",current.report.improvements],["Exercices conseillés",current.report.exercises]] as const).map(([heading,items])=><div key={heading}><h3 className="font-semibold">{heading}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{items.map((item,i)=><li key={i}>{item}</li>)}</ul></div>)}
    </section>:null}
    {error&&<p role="alert" className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="size-4"/>{error}</p>}
  </div>;
  return <div className="space-y-7">
    <PageHeader title="Interview Coach 2.0" description="Simulations contextualisées, retours précis et progression. Évaluation pédagogique, jamais un pronostic de recrutement."/>
    <form onSubmit={prepare} className="app-section grid gap-3 md:grid-cols-2">
      <Input required value={form.role} onChange={e=>setForm({...form,role:e.target.value})} maxLength={160} placeholder="Métier ciblé" aria-label="Métier ciblé"/>
      <Input value={form.level} onChange={e=>setForm({...form,level:e.target.value})} maxLength={80} placeholder="Niveau d'expérience (facultatif)" aria-label="Niveau d'expérience"/>
      <select className="rounded border bg-background p-2" value={form.language} onChange={e=>setForm({...form,language:e.target.value as "fr"|"en"})} aria-label="Langue de l'entretien"><option value="fr">Français</option><option value="en">English</option></select>
      <select className="rounded border bg-background p-2" value={form.questionCount} onChange={e=>setForm({...form,questionCount:Number(e.target.value)})} aria-label="Nombre de questions">{[5,10,15,20].map(n=><option key={n} value={n}>{n} questions</option>)}</select>
      <Textarea className="md:col-span-2" rows={4} value={form.jobDescription} onChange={e=>setForm({...form,jobDescription:e.target.value})} maxLength={12000} placeholder="Description du poste (facultative) : collez ici l'offre pour des questions ciblées." aria-label="Description du poste"/>
      <Button disabled={busy} className="md:col-span-2"><MessagesSquare/>Préparer l'entretien</Button>
    </form>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {prep&&<section className="app-section space-y-4"><h2 className="type-h2">Questions préparées — {prep.title}</h2>
      {prep.configuration?.questionSet?.questions?.map((q,i)=><details key={i} className="rounded border p-3"><summary className="cursor-pointer font-medium">{i+1}. {q.question}</summary><p className="mt-2 text-sm text-muted-foreground">Conseil : {q.suggestedAnswer}</p></details>)}
      {!!prep.configuration?.questionSet?.recruiterQuestions?.length&&<><h3 className="font-semibold">Questions au recruteur</h3><ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{prep.configuration.questionSet.recruiterQuestions.map((q,i)=><li key={i}>{q}</li>)}</ul></>}
      <Button disabled={busy} onClick={()=>void start(prep)}><Play/>Commencer les questions préparées</Button></section>}
    <section className="app-section"><h2 className="type-h2">Historique et progression</h2><p className="mb-4 text-sm text-muted-foreground">Reprenez une session conservée, consultez son évaluation ou supprimez-la.</p>
      {sessions.some(s=>s.status==="COMPLETED"&&typeof s.overallScore==="number")&&<div className="mb-5 space-y-2" aria-label="Progression des entretiens évalués">
        <h3 className="text-sm font-semibold">Progression indicative des dernières simulations</h3>
        {sessions.filter(s=>s.status==="COMPLETED"&&typeof s.overallScore==="number").slice(0,8).reverse().map(s=><div key={s.id} className="flex items-center gap-3 text-xs"><span className="w-36 truncate" title={s.title}>{s.title}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${s.overallScore??0}%`}}/></div><span className="w-12 text-right">{s.overallScore}/100</span></div>)}
        <p className="text-xs text-muted-foreground">Ces notes sont des indications pédagogiques, et ne prédisent pas les chances de recrutement.</p>
      </div>}
      <div className="space-y-2">{sessions.map(s=><div key={s.id} className="flex items-center justify-between gap-2 rounded border p-3"><button type="button" className="min-w-0 text-left" onClick={()=>{setError("");if(s.status==="PREPARATION"){setPrep(s);setCurrent(null);}else{setCurrent(s);setPrep(null);}}}><p className="font-medium">{s.title}</p><p className="text-xs text-muted-foreground">{s.status} · {s.currentQuestion||0} réponse(s){s.overallScore!==null?` · ${s.overallScore}/100`:""}</p></button><Button size="icon" variant="ghost" aria-label={`Supprimer ${s.title}`} disabled={busy} onClick={()=>void remove(s.id)}><Trash2/></Button></div>)}{!sessions.length&&<p className="text-sm text-muted-foreground">Aucun entretien enregistré.</p>}</div>
    </section>
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4"/>Lecture vocale locale via le navigateur, dictée uniquement sur action volontaire et si compatible. Pas de stockage audio sur les serveurs CVComet.</p>
  </div>;
}
