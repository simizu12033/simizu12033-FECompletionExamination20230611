const TERM_STORAGE_KEY="fe-completion-20230611-v1-term-progress";
const termState={
  filter:"すべて",
  query:"",
  active:0,
  flipped:false,
  progress:readJSON(TERM_STORAGE_KEY,{})
};
const termFields=["すべて",...new Set(TERMS.map(t=>t.field))];
const termStatusLabel={known:"説明できた",shaky:"少し不安",weak:"説明できない"};
const termStatusClass={known:"known",shaky:"shaky",weak:"weak"};
const termStatusRank={weak:0,shaky:1,known:2};
const termEsc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function saveTermProgress(){
  storage.setItem(TERM_STORAGE_KEY,JSON.stringify(termState.progress));
}
function termStatus(term){
  return termState.progress[term.id]?.status||"";
}
function termAnswered(term){
  return !!termStatus(term);
}
function filteredTerms(){return TERMS.slice();}
function termReviewContext(){
  if(typeof window.getTermReviewState==="function")return window.getTermReviewState();
  return {graded:false,questionNumbers:[]};
}
function weakTermsFromAnswers(){
  const state=termReviewContext();
  if(!state.graded)return [];
  const selected=new Set(state.questionNumbers.map(Number));
  return TERMS.filter(t=>selected.has(Number(t.q)));
}
function reviewTermMessage(){
  const state=termReviewContext();
  if(!state.graded)return "採点後に、復習におすすめの用語を表示します。";
  if(!state.questionNumbers.length)return "採点対象の全問で正答できました。重要用語カードで理解を深めましょう。";
  return "該当する用語カードはありません。各問題の解説で復習できます。";
}
function setActiveTerm(index){
  const list=filteredTerms();
  termState.active=Math.max(0,Math.min(index,list.length-1));
  termState.flipped=false;
  renderTerms();
}
function jumpToTerm(termId){
  const target=TERMS.find(t=>t.id===termId);
  if(!target)return;
  const index=filteredTerms().findIndex(t=>t.id===termId);
  setActiveTerm(index<0?0:index);
}
function markTerm(status){
  const list=filteredTerms();
  const term=list[termState.active];
  if(!term)return;
  termState.progress[term.id]={status,updatedAt:new Date().toISOString()};
  saveTermProgress();
  const next=Math.min(termState.active+1,Math.max(0,list.length-1));
  termState.active=next;
  termState.flipped=false;
  renderTerms();
}
function renderChoiceExplanations(term){
  const choices=term.choices||[];
  if(!choices.length)return "";
  return `<section class="term-choice-explanations" aria-label="全選択肢の解説">
    <h3>ア〜エの意味と違い</h3>
    <p class="term-choice-intro">用語・記述の要点を比較して、選択肢を判断する理由を確認しましょう。</p>
    ${choices.map(c=>`<article class="term-choice ${c.isCorrect?"correct":""}">
      <h4><span class="term-choice-label">${termEsc(c.label)}</span>${termEsc(c.term)}${c.isCorrect?'<small class="term-choice-answer">正答</small>':""}</h4>
      <p>${termEsc(c.meaning)}</p>
    </article>`).join("")}
  </section>`;
}
function renderTerms(){
  const section=document.querySelector("#termLearning");
  if(!section)return;
  const list=filteredTerms();
  if(termState.active>=list.length)termState.active=0;
  const active=list[termState.active];
  const known=TERMS.filter(t=>termStatus(t)==="known").length;
  const shaky=TERMS.filter(t=>termStatus(t)==="shaky").length;
  const weak=TERMS.filter(t=>termStatus(t)==="weak").length;
  const wrongWeak=weakTermsFromAnswers();
  document.querySelector("#termStats").innerHTML=[
    ["全用語",TERMS.length],
    ["説明できた",known],
    ["少し不安",shaky],
    ["説明できない",weak]
  ].map(([label,value])=>`<div><strong>${value}</strong><span>${label}</span></div>`).join("");
  const filters=document.querySelector("#termFilters");
  if(filters)filters.innerHTML="";
  const card=document.querySelector("#termCard");
  if(!active){
    card.innerHTML=`<p class="term-empty">条件に一致する用語がありません。</p>`;
  }else{
    const status=termStatus(active);
    card.className=`term-card ${termState.flipped?"flipped":""} ${termStatusClass[status]||""}`;
    card.innerHTML=`
      <div class="term-card-top">
        <span>${termEsc(active.field)}</span>
        <a href="#q${active.q}">問${active.q}</a>
      </div>
      <button class="term-flip" type="button" aria-expanded="${termState.flipped}">
        <span class="term-face front">
          <small>この用語を説明できる？</small>
          <strong>${termEsc(active.term)}</strong>
          <em>クリックして説明例を見る</em>
        </span>
        <span class="term-face back">
          <small>説明例</small>
          <strong>${termEsc(active.term)}</strong>
          <b>${termEsc(active.cue)}</b>
          <p>${termEsc(active.meaning)}</p>
          <i>${termEsc(active.trap)}</i>
        </span>
      </button>
      ${termState.flipped?renderChoiceExplanations(active):""}
      <div class="term-tags">${active.tags.map(tag=>`<span>${termEsc(tag)}</span>`).join("")}</div>
      <div class="term-grade">
        <button type="button" data-term-status="known">説明できた</button>
        <button type="button" data-term-status="shaky">少し不安</button>
        <button type="button" data-term-status="weak">説明できない</button>
      </div>
      ${status?`<p class="term-current">現在：${termStatusLabel[status]}</p>`:""}
    `;
  }
  const termList=document.querySelector("#termList");
  if(termList)termList.innerHTML=list.map((t,i)=>{
    const status=termStatus(t);
    return `<button type="button" class="${i===termState.active?"active":""} ${termStatusClass[status]||""}" data-term-index="${i}">
      <b>${termEsc(t.term)}</b><span>問${t.q}</span>
    </button>`;
  }).join("");
  document.querySelector("#termWeakLinks").innerHTML=wrongWeak.length
    ?wrongWeak.map(t=>`<a href="#termLearning" data-term-jump="${t.id}">${termEsc(t.term)}<span>問${t.q}</span></a>`).join("")
    :`<span>${termEsc(reviewTermMessage())}</span>`;
  document.querySelector("#termPosition").textContent=list.length?`${termState.active+1} / ${list.length}`:"0 / 0";
}
function initTerms(){
  const section=document.querySelector("#termLearning");
  if(!section)return;
  document.querySelector("#termCard").onclick=e=>{
    if(e.target.closest("[data-term-status]")){
      markTerm(e.target.closest("[data-term-status]").dataset.termStatus);
      return;
    }
    if(e.target.closest(".term-flip")){
      termState.flipped=!termState.flipped;
      renderTerms();
    }
  };
  const termList=document.querySelector("#termList");
  if(termList)termList.onclick=e=>{
    const button=e.target.closest("[data-term-index]");
    if(button)setActiveTerm(Number(button.dataset.termIndex));
  };
  document.querySelector("#termWeakLinks").onclick=e=>{
    const link=e.target.closest("[data-term-jump]");
    if(!link)return;
    jumpToTerm(link.dataset.termJump);
  };
  document.addEventListener("click",e=>{
    const link=e.target.closest("[data-term-ref]");
    if(!link)return;
    jumpToTerm(link.dataset.termRef);
  });
  document.querySelector("#termPrev").onclick=()=>setActiveTerm(termState.active-1);
  document.querySelector("#termNext").onclick=()=>setActiveTerm(termState.active+1);
  document.querySelector("#termReset").onclick=()=>{
    if(confirm("用語カードの覚えた/あやしい/覚えていないの記録を消しますか？")){
      termState.progress={};
      saveTermProgress();
      renderTerms();
    }
  };
  renderTerms();
}
initTerms();

