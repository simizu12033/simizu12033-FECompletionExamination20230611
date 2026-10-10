const qs=s=>document.querySelector(s);
const STORAGE_PREFIX="fe-completion-20230611-v1";
const STORAGE={
  phase:`${STORAGE_PREFIX}-phase`,
  answers:`${STORAGE_PREFIX}-answers`,
  done:`${STORAGE_PREFIX}-done`,
  report:`${STORAGE_PREFIX}-first-report`,
  retryAnswers:`${STORAGE_PREFIX}-retry-answers`,
  retryChecked:`${STORAGE_PREFIX}-retry-checked`,
  revealed:`${STORAGE_PREFIX}-revealed`
};

const learningState={
  phase:storage.getItem(STORAGE.phase)||"exam",
  answers:readJSON(STORAGE.answers,{}),
  retryAnswers:readJSON(STORAGE.retryAnswers,{}),
  retryChecked:readJSON(STORAGE.retryChecked,{}),
  revealed:new Set(readJSON(STORAGE.revealed,[])),
  understood:new Set(readJSON(STORAGE.done,[])),
  filter:"すべて",
  query:"",
  onlyUnlearned:false
};
if(learningState.phase==="retry"||learningState.phase==="retryReview")learningState.phase="review";

const reviewFields=["すべて",...new Set(QUESTIONS.map(q=>q.field))];
const saveLearning=()=>{
  storage.setItem(STORAGE.phase,learningState.phase);
  storage.setItem(STORAGE.answers,JSON.stringify(learningState.answers));
  storage.setItem(STORAGE.retryAnswers,JSON.stringify(learningState.retryAnswers));
  storage.setItem(STORAGE.retryChecked,JSON.stringify(learningState.retryChecked));
  storage.setItem(STORAGE.revealed,JSON.stringify([...learningState.revealed]));
  storage.setItem(STORAGE.done,JSON.stringify([...learningState.understood]));
};
const gradedQuestions=QUESTIONS.slice();
const gradedTotal=gradedQuestions.length;
const answeredCount=()=>gradedQuestions.filter(q=>["ア","イ","ウ","エ"].includes(learningState.answers[q.n])).length;
const firstScore=()=>gradedQuestions.filter(q=>learningState.answers[q.n]===q.answer).length;
const isReview=()=>learningState.phase==="review";
const currentAnswer=q=>learningState.retryAnswers[q.n]||learningState.answers[q.n];
const wasWrong=q=>learningState.answers[q.n]!==q.answer;
const retryCheckedAnswer=q=>learningState.retryChecked[q.n];
const retryCheckedCorrect=q=>retryCheckedAnswer(q)===q.answer;
// Use the same current state as scoring; terms do not depend on storage writes.
window.getTermReviewState=()=>({
  graded:isReview(),
  questionNumbers:isReview()?gradedQuestions.filter(wasWrong).map(q=>q.n):[]
});
const retryWasChecked=q=>Object.prototype.hasOwnProperty.call(learningState.retryChecked,q.n);
const needsRetry=q=>isReview()&&wasWrong(q)&&!retryCheckedCorrect(q);
const retryAnswerCount=()=>QUESTIONS.filter(q=>wasWrong(q)&&learningState.retryAnswers[q.n]).length;
const retryCheckedCorrectCount=()=>QUESTIONS.filter(q=>wasWrong(q)&&retryCheckedCorrect(q)).length;

function visible(q){
  return true;
}

function renderLearning(){
  document.body.classList.toggle("review-mode",isReview());
  const root=qs("#questions");
  root.innerHTML="";
  QUESTIONS.forEach(q=>{
    if(!visible(q))return;
    const node=qs("#questionTemplate").content.firstElementChild.cloneNode(true);
    node.id=`q${q.n}`;
    if(learningState.understood.has(q.n))node.classList.add("understood");
    if(needsRetry(q))node.classList.add("retrying");
    if(learningState.revealed.has(q.n))node.classList.add("explanation-open");
    node.querySelector(".number").textContent=`Q${String(q.n).padStart(2,"0")}`;
    node.querySelector(".meta").textContent=q.field;
    node.querySelector("h2").textContent=(isReview()||learningState.revealed.has(q.n))?q.title:`問${q.n}`;
    const revealButton=document.createElement("button");
    revealButton.type="button";
    revealButton.className="explain-toggle";
    revealButton.setAttribute("aria-expanded",learningState.revealed.has(q.n)?"true":"false");
    revealButton.textContent=learningState.revealed.has(q.n)?"解説を閉じる":"解説表示";
    revealButton.onclick=()=>{
      learningState.revealed.has(q.n)?learningState.revealed.delete(q.n):learningState.revealed.add(q.n);
      saveLearning();
      renderLearning();
      document.querySelector(`#q${q.n}`)?.scrollIntoView({block:"center"});
    };
    node.querySelector(".answer-input").after(revealButton);
    const image=node.querySelector(".problem-panel img");
    image.src=`assets/questions/q${String(q.n).padStart(2,"0")}.png`;
    image.alt=`問${q.n}の問題文`;
    image.addEventListener("error",()=>{
      const warning=document.createElement("p");warning.className="asset-warning";warning.setAttribute("role","alert");
      warning.textContent=`問${q.n}の問題画像を読み込めません。assets/questions/q${String(q.n).padStart(2,"0")}.png の配置を確認してください。`;
      image.after(warning);
    },{once:true});
    const zoom=document.createElement("a");zoom.href=image.src;zoom.target="_blank";zoom.rel="noopener";zoom.textContent="問題画像を拡大 ↗";
    image.after(zoom);

    node.querySelectorAll(".answer-input input").forEach(input=>{
      input.name=`answer-${q.n}`;
      input.checked=currentAnswer(q)===input.value;
      input.disabled=isReview()&&!wasWrong(q);
      input.onchange=()=>{
        if(isReview()){
          learningState.retryAnswers[q.n]=input.value;
          delete learningState.retryChecked[q.n];
          saveLearning();
          renderLearning();
          document.querySelector(`#q${q.n}`)?.scrollIntoView({block:"center"});
          return;
        }
        learningState.answers[q.n]=input.value;
        saveLearning();
        updateLearningHeader();
        renderLearningMap();
        updatePhasePanel();
      };
    });

    if(isReview()){
      const line=node.querySelector(".result-line");
      if(wasWrong(q)){
        if(retryWasChecked(q)){
          const ok=retryCheckedCorrect(q);
          line.className=`result-line ${ok?"correct":"wrong"}`;
          line.textContent=ok
            ?`再回答は正解です。解説を確認してください。`
            :`再回答は不正解でした。もう一度考えて選び直してください。`;
        }else{
          line.className="result-line wrong";
          line.textContent=learningState.retryAnswers[q.n]
            ?`初回は不正解でした。再回答を記録しました。正誤はまだ表示していません。「再回答を採点する」を押してください。`
            :`初回は不正解でした。正答は隠しています。必要なら「解説表示」を押して確認し、もう一度選択肢を選んでください。`;
        }
      }else{
        line.className="result-line correct";
        line.textContent=`正解：あなたの回答 ${learningState.answers[q.n]}`;
      }
    }

    node.querySelector(".answer-strip strong").textContent=q.answer;
    node.querySelector(".answer-strip p").textContent=q.answerText;
    node.querySelector(".answer-strip").hidden=false;
    node.querySelector(".summary").textContent=q.summary;
    node.querySelector(".reasoning").innerHTML=q.reasoning.map(x=>`<li>${esc(x)}</li>`).join("");
    node.querySelector(".trap p").textContent=q.trap;
    if(q.deep){
      const more=document.createElement("section");more.className="deep-explanation";
      more.innerHTML=`<h3>確認問題</h3><details><summary>理解を確かめる：${esc(q.deep.check)}</summary><p>${esc(q.deep.answer)}</p></details>`;
      node.querySelector(".explanation").appendChild(more);
    }
    if(q.reference){const ref=document.createElement("p");ref.innerHTML=`<a href="${esc(q.reference[1])}" target="_blank" rel="noopener">参考：${esc(q.reference[0])}</a>`;node.querySelector(".explanation").appendChild(ref);}

    node.querySelector(".diagram").innerHTML=window.renderRichVisual(q);
    node.querySelector("figcaption").textContent=q.caption;
    const check=node.querySelector(".understand-check input");
    check.checked=learningState.understood.has(q.n);
    check.onchange=()=>{
      check.checked?learningState.understood.add(q.n):learningState.understood.delete(q.n);
      saveLearning();
      renderLearning();
      document.querySelector(`#q${q.n}`)?.scrollIntoView({block:"center"});
    };
    root.appendChild(node);
  });
  qs("#emptyState").hidden=!!root.children.length;
  updatePhasePanel();
  renderLearningMap();
  updateLearningHeader();
  renderTerms();
}

function updatePhasePanel(){
  const complete=learningState.understood.size===60;
  const unresolved=QUESTIONS.filter(needsRetry).length;
  const retryAnswers=retryAnswerCount();
  const retryCorrect=retryCheckedCorrectCount();
  const totalCorrect=firstScore()+retryCorrect;
  qs("#reviewToolbar").hidden=true;
  document.querySelectorAll("[data-exam-controls]").forEach(el=>el.hidden=isReview());
  qs("#listTitle").textContent=isReview()?"採点結果と解説":"試験問題";
  qs("#phaseMessage").textContent=isReview()
    ?`採点済みです。初回に正答に至らなかった問題は選択肢を押して再回答できます。正誤は「再回答を採点する」を押した時だけ表示します。（未解決 ${unresolved}問）`
    :`${answeredCount()}問回答済み。迷った問題は「解説表示」を開いて確認してから、改めて回答できます。60問すべてに回答すると採点できます。`;
  document.querySelectorAll(".retry-grade-area").forEach(area=>{
    area.hidden=!isReview()||QUESTIONS.every(q=>!wasWrong(q));
  });
  document.querySelectorAll('[data-action="retry-grade"]').forEach(button=>{
    button.disabled=retryAnswers===0;
  });
  document.querySelectorAll('[data-action="submit"]').forEach(button=>{
    button.textContent="60問を採点する";
    button.disabled=answeredCount()!==gradedTotal;
  });
  document.querySelectorAll("[data-exam-message]").forEach(message=>{
    message.textContent=answeredCount()===gradedTotal?"採点対象の全60問に回答しました。採点できます。":`現在 ${answeredCount()} / ${gradedTotal}問回答済みです。`;
  });
  const summary=qs("#scoreSummary");
  summary.hidden=!isReview();
  qs("#answerLegend").hidden=!isReview();
  if(isReview()){
    summary.innerHTML=`<div><strong>${totalCorrect}</strong><span>正解（60問中）</span></div><div><strong>${gradedTotal-totalCorrect}</strong><span>不正解</span></div><div><strong>${retryCorrect}</strong><span>再回答での正解</span></div><div><strong>${learningState.understood.size}</strong><span>理解済み</span></div>`;
  }
  document.querySelectorAll("#phaseSteps [data-step]").forEach(el=>{
    el.classList.remove("active","finished");
    const step=el.dataset.step;
    if(!isReview()&&step==="exam")el.classList.add("active");
    if(isReview()&&(step==="exam"||step==="score"))el.classList.add("finished");
    if(isReview()&&!complete&&step==="review")el.classList.add("active");
    if(complete&&step!=="complete")el.classList.add("finished");
    if(complete&&step==="complete")el.classList.add("active");
  });
  if(complete)qs("#phaseMessage").innerHTML=`<div class="completion"><strong>学習完了！</strong>60問すべての理解チェックが付きました。</div>`;
  if(isReview()){
    ensureFirstReport();
    renderFirstReport();
  }else{
    qs("#learningReport").hidden=true;
  }
}

function renderLearningMap(){
  qs("#questionMap").innerHTML=QUESTIONS.map(q=>{
    let cls="";
    if(!isReview()&&learningState.answers[q.n])cls="answered";
    if(isReview())cls=wasWrong(q)?(retryCheckedCorrect(q)?"correct":"wrong"):"correct";
    if(learningState.understood.has(q.n))cls+=" done";
    return `<a href="#q${q.n}" class="${cls}">${q.n}</a>`;
  }).join("");
}

function updateLearningHeader(){
  const count=isReview()?learningState.understood.size:answeredCount();
  qs("#progressText").textContent=isReview()?`理解 ${count} / 60`:`試験 ${count} / ${gradedTotal}`;
  qs("#progressBar").style.width=`${count/(isReview()?60:gradedTotal)*100}%`;
}

function makeFirstReport(){
  const fields={};
  gradedQuestions.forEach(q=>{
    if(!fields[q.field])fields[q.field]={correct:0,total:0};
    fields[q.field].total++;
    if(learningState.answers[q.n]===q.answer)fields[q.field].correct++;
  });
  return {
    gradedAt:new Date().toISOString(),
    gradingVersion:3,
    total:gradedTotal,
    score:firstScore(),
    fields,
    wrong:gradedQuestions.filter(q=>learningState.answers[q.n]!==q.answer).map(q=>q.n)
  };
}
function ensureFirstReport(){
  const old=readJSON(STORAGE.report,null);
  if(!old||old.gradingVersion!==3){
    const report=makeFirstReport();
    if(old?.gradedAt)report.gradedAt=old.gradedAt;
    storage.setItem(STORAGE.report,JSON.stringify(report));
  }
}
function formatDate(date){
  return new Intl.DateTimeFormat("ja-JP",{year:"numeric",month:"long",day:"numeric",weekday:"short"}).format(date);
}
function renderFirstReport(){
  const report=JSON.parse(storage.getItem(STORAGE.report));
  if(!report)return;
  qs("#learningReport").hidden=false;
  const graded=new Date(report.gradedAt),retest=new Date(graded);
  retest.setDate(retest.getDate()+7);
  qs("#reportDate").textContent=`初回採点日：${formatDate(graded)}　総合正答率：${Math.round(report.score/report.total*100)}%（${report.score}/${report.total}問）`;
  const entries=Object.entries(report.fields).map(([field,v])=>({field,...v,rate:Math.round(v.correct/v.total*100)}));
  qs("#fieldStats").innerHTML=entries.map(x=>`<div><span>${x.field}</span><div><i style="width:${x.rate}%"></i></div><b>${x.rate}%</b><small>${x.correct}/${x.total}</small></div>`).join("");
  const max=Math.max(...entries.map(x=>x.rate)),min=Math.min(...entries.map(x=>x.rate));
  const strong=entries.filter(x=>x.rate===max).map(x=>x.field).join("・");
  const weak=entries.filter(x=>x.rate===min).map(x=>x.field).join("・");
  qs("#strengthWeakness").innerHTML=`<div class="strength"><b>得意分野</b><strong>${strong}</strong><span>正答率 ${max}%</span></div><div class="weakness"><b>苦手分野</b><strong>${weak}</strong><span>正答率 ${min}%</span></div><p>${min<60?"苦手分野は、正答の根拠を説明できる状態を目指しましょう。":"全分野で60%以上です。復習する問題では、正答に至る考え方を説明できるか確認しましょう。"}</p>`;
  qs("#retestDate").textContent=`推奨再挑戦日：${formatDate(retest)}（初回採点から7日後）`;
  qs("#retestQuestions").innerHTML=report.wrong.length
    ?report.wrong.map(n=>`<a href="#q${n}">問${n}</a>`).join("")
    :`<span>全問正解でした。60問をもう一度通して定着を確認しましょう。</span>`;
  const groupedTerms=TERMS.reduce((acc,t)=>{
    if(!acc[t.field])acc[t.field]=[];
    acc[t.field].push(t);
    return acc;
  },{});
  qs("#importantWords").innerHTML=Object.entries(groupedTerms).map(([field,terms])=>`<div><b>${field}</b>${terms.map(t=>`<a href="#termLearning" data-term-ref="${t.id}">${t.term}</a>`).join("")}</div>`).join("");
}

function jumpUnanswered(){
  const q=gradedQuestions.find(x=>!learningState.answers[x.n]);
  if(q)document.querySelector(`#q${q.n}`)?.scrollIntoView({behavior:"smooth",block:"start"});
}
function gradeRetryAnswers(){
  QUESTIONS.forEach(q=>{
    if(wasWrong(q)&&learningState.retryAnswers[q.n]){
      learningState.retryChecked[q.n]=learningState.retryAnswers[q.n];
    }
  });
  saveLearning();
  renderLearning();
  qs("#resultsTop").scrollIntoView({behavior:"smooth",block:"start"});
}
function resetLearning(){
  if(confirm("解答・採点結果・理解チェックをすべて消して最初からやり直しますか？")){
    Object.values(STORAGE).forEach(k=>storage.removeItem(k));

    location.reload();
  }
}
function initLearning(){
  qs("#filters").innerHTML=reviewFields.map((f,i)=>`<button type="button" data-field="${f}" class="${i===0?"active":""}">${f}</button>`).join("");
  qs("#filters").onclick=e=>{
    if(!e.target.dataset.field)return;
    learningState.filter=e.target.dataset.field;
    document.querySelectorAll("#filters button").forEach(b=>b.classList.toggle("active",b===e.target));
    renderLearning();
  };
  qs("#searchInput").oninput=e=>{learningState.query=e.target.value.replace(/^問/,"");renderLearning()};
  qs("#onlyUnlearned").onchange=e=>{learningState.onlyUnlearned=e.target.checked;renderLearning()};
  document.querySelectorAll('[data-action="retry-grade"]').forEach(button=>button.onclick=gradeRetryAnswers);
  document.querySelectorAll('[data-action="unanswered"]').forEach(button=>button.onclick=jumpUnanswered);
  document.querySelectorAll('[data-action="submit"]').forEach(button=>button.onclick=()=>qs("#confirmDialog").showModal());
  document.querySelectorAll('[data-action="reset"]').forEach(button=>button.onclick=resetLearning);
  qs("#cancelSubmit").onclick=()=>qs("#confirmDialog").close();
  qs("#confirmSubmit").onclick=()=>{
    if(answeredCount()!==gradedTotal)return;
    learningState.phase="review";
    learningState.retryAnswers={};
    learningState.retryChecked={};
    learningState.filter="すべて";
    learningState.query="";
    learningState.onlyUnlearned=false;
    saveLearning();
    ensureFirstReport();
    qs("#confirmDialog").close();
    renderLearning();
    qs("#resultsTop").scrollIntoView({behavior:"smooth",block:"start"});
  };
  renderLearning();
}
initLearning();

