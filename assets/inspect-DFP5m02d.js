import{w as X,p as w,f as P,I as F,u as te,g as ne,i as oe,M as ae,A as ie,E as se,k as re,m as le,n as Z,o as ce,q as de,v as W,x as he,y as C,P as ue,t as fe,e as pe,d as ge}from"./solver-BibGwqpk.js";const U={square:"#8a6f4d","half-square":"#a08154",rhombus:"#5e7a8a","half-rhombus":"#6f8fa0",jug:"#7a5e8a","large-biped":"#4d5a66",almond:"#8a5e5e","small-biped":"#66594d","barley-kernel":"#5e8a6f"},K=["#8a6f4d","#5e7a8a","#8a5e5e","#7a5e8a","#5e8a6f","#a08154"];function G(e){let t=1/0,n=1/0,a=-1/0,s=-1/0;for(const o of e){const[i,u]=o.toNumbers();t=Math.min(t,i),n=Math.min(n,u),a=Math.max(a,i),s=Math.max(s,u)}return{minX:t,minY:n,maxX:a,maxY:s}}function D(e,t){return e.map((n,a)=>{const[s,o]=t(n);return`${a===0?"M":"L"}${s.toFixed(4)} ${o.toFixed(4)}`}).join(" ")+" Z"}function j(e,t={}){const n=t.width??640,a=t.margin??16,s=t.colorBy??"kind",o=[...e.sector];for(const r of e.placed)o.push(...X(r).verts);const i=G(o),u=i.maxX-i.minX||1,c=i.maxY-i.minY||1,d=(n-2*a)/Math.max(u,c),h=c*d+2*a,f=r=>{const[p,g]=r.toNumbers();return[a+(p-i.minX)*d,h-a-(g-i.minY)*d]},x=r=>s==="tier"?K[(r.tier??0)%K.length]:U[r.def.kind],T=e.placed.map(r=>{const{verts:p}=X(r);return`<path d="${D(p,f)}" fill="${x(r)}" fill-opacity="0.55" stroke="#e8e2d5" stroke-width="1" stroke-linejoin="round"><title>${r.def.kind} (${r.role}${r.tier!==void 0?`, tier ${r.tier}`:""})</title></path>`}).join(`
  `),S=t.showSector===!1?"":`<path d="${D([...e.sector],f)}" fill="none" stroke="#b7a97f" stroke-width="1.5" stroke-dasharray="6 4"/>`,l=t.background??"none";return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${h.toFixed(2)}" width="${n}" height="${h.toFixed(2)}">
  ${l==="none"?"":`<rect width="100%" height="100%" fill="${l}"/>`}
  ${T}
  ${S}
</svg>`}function me(e,t=160){const n=G(e.verts),a=14,s=Math.max(n.maxX-n.minX,n.maxY-n.minY)||1,o=(t-2*a)/s,i=(n.maxY-n.minY)*o+2*a,u=c=>{const[d,h]=c.toNumbers();return[a+(d-n.minX)*o,i-a-(h-n.minY)*o]};return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${i.toFixed(2)}" width="${t}" height="${i.toFixed(2)}">
  <path d="${D([...e.verts],u)}" fill="${U[e.kind]}" fill-opacity="0.55" stroke="#e8e2d5" stroke-width="1.25" stroke-linejoin="round"/>
</svg>`}function J(){return{sector:[w(0,0),w(2,0),w(2,2)],placed:[P("half-square","cell",F.IDENTITY,2),P("square","cell",F.translation(w(1,0)),1),P("half-square","cell",F.translation(w(1,1)),1)]}}function Q(){const e=[w(-2,-2),w(2,-2),w(2,2),w(-2,2)];return te(J(),ne(4,2),e)}const ee={tierHeight:1.5,facetHeight:1};function $e(e,t,n=ee){const{tierHeight:a,facetHeight:s}=n;if(!(s>0)||!(a>s))throw new Error("liftSimple: need 0 < facetHeight < tierHeight");const o=new ae,i=[],u=new Set;return t.forEach((c,d)=>{const h=e.placed[c.placedIndex];if(!h)throw new Error(`liftSimple: no placed element at index ${c.placedIndex}`);if(u.has(c.placedIndex))throw new Error(`liftSimple: element ${c.placedIndex} lifted twice`);if(u.add(c.placedIndex),h.role!=="cell")throw new Error(`liftSimple: element ${c.placedIndex} is an intermediate; v0 lifts cells only`);const f=c.tier??h.tier;if(f===void 0)throw new Error(`liftSimple: element ${c.placedIndex} has no tier`);const{verts:x}=X(h),T=x.length,S=oe(h,c.frontEdge),l=(f-1)*a,r=l+s,p=f*a,g=m=>`${x[m].key()}@${f-1},0`,v=m=>`${x[m].key()}@${f-1},1`,$=m=>`${x[m].key()}@${f},0`,y=(m,I,L)=>{const[B,N]=x[I].toNumbers();return o.vertex(m,B,N,L)},b=S,k=(S+1)%T,q=y(g(b),b,l),H=y(g(k),k,l),E=y(v(k),k,r),A=y(v(b),b,r);o.quad(q,H,E,A),i.push({role:"facet",cell:d},{role:"facet",cell:d});const M=[A,E];for(let m=2;m<T;m++){const I=(S+m)%T;M.push(y($(I),I,p))}for(let m=1;m+1<M.length;m++)o.tri(M[0],M[m],M[m+1]),i.push({role:"roof",cell:d})}),{mesh:o.build(),tris:i,params:n}}function xe(e=ee){const t=Q(),n=t.placed.map((a,s)=>({placedIndex:s,frontEdge:1}));return{vault:$e(t,n,e),plan:t}}const ve=document.querySelector("#app"),V={square:"murabbaʿ",rhombus:"muʿayyan",jug:"barmak",almond:"bādām"};function we(){return`<section>
    <h2>The alphabet</h2>
    <p class="caption">Eight of the nine shapes, each constructed from the two seeds —
    the square and the 45° rhombus — never traced. The barley kernel waits on its
    measured definition from the sources.</p>
    <div class="gallery">${[...ie.values()].map(t=>{const n=se[t.kind];return`<div class="tile">
        ${me(t,150)}
        <div class="name">${t.kind}${V[t.kind]?` · ${V[t.kind]}`:""}</div>
        <div class="roles">${t.roles.join(" / ")}</div>
        <div class="meta">area = ${n.toString()} ≈ ${n.toNumber().toFixed(5)}</div>
        <div class="meta">${t.derivation}</div>
      </div>`}).join(`
`)}</div>
  </section>`}function ye(){const e=re(),t=200,n=52,a=t+2*n,s=2*t+2*n,o=g=>n+g*t,i=g=>s-n-g*t,{A:u,E:c,Z:d,H:h,T:f,divisions:x}=e.construction,T=x.map(([g,v])=>`<circle cx="${o(g)}" cy="${i(v)}" r="2.6" fill="#b7a97f"/>`).join(""),S=e.polyline(48).map(([g,v],$)=>`${$===0?"M":"L"}${o(g).toFixed(2)} ${i(v).toFixed(2)}`).join(" "),l=Math.hypot(d[0]-c[0],d[1]-c[1])*t,r=`M${o(d[0]).toFixed(2)} ${i(d[1]).toFixed(2)} A ${l.toFixed(2)} ${l.toFixed(2)} 0 0 1 ${o(h[0]).toFixed(2)} ${i(h[1]).toFixed(2)}`,p=(g,v,$,y=6,b=-6)=>`<text x="${o(g)+y}" y="${i(v)+b}" fill="#9a917d" font-size="11" font-family="ui-monospace, monospace">${$}</text>`;return`<section>
    <h2>The module and the profile</h2>
    <p class="caption">Al-Kāshī's "method of the masons," drawn from the construction
    itself, in the 1 : 2 rectangle the excavated Takht-i Sulaymān cells confirm. The 30°
    oblique from the top corner A, five equal parts, and the last two fifths rotated about
    E down onto the vertical give H — the <em>factor</em>, ≈ ${e.factor.toFixed(6)} per
    module (al-Kāshī: 0;57,38,43,14). The arc HZ is exactly one sixth of a circle, radius
    4/5, and the 30° is what makes everything tangent: vertical facet, arc, ramp. Facet +
    half the curve = the <em>taʿdīl</em> ≈ ${e.coefficient.toFixed(6)} (al-Kāshī 1;43,33,45,41),
    the multiplier that turns counted facet bases into vault surface.</p>
    <div class="row">
      <figure class="figure" style="max-width:${a+40}px">
        <svg viewBox="0 0 ${a} ${s}" xmlns="http://www.w3.org/2000/svg">
          <rect x="${o(0)}" y="${i(e.height)}" width="${t}" height="${2*t}" fill="none" stroke="#2c2820"/>
          <line x1="${o(u[0])}" y1="${i(u[1])}" x2="${o(c[0])}" y2="${i(c[1])}" stroke="#6f8fa0" stroke-width="1.2"/>
          ${T}
          <path d="${r}" fill="none" stroke="#6f8fa0" stroke-width="1" stroke-dasharray="4 4"/>
          <line x1="${o(f[0])}" y1="${i(f[1])}" x2="${o(h[0])}" y2="${i(h[1])}" stroke="#3d382e" stroke-width="1"/>
          <line x1="${o(f[0])}" y1="${i(f[1])}" x2="${o(d[0])}" y2="${i(d[1])}" stroke="#3d382e" stroke-width="1"/>
          <circle cx="${o(f[0])}" cy="${i(f[1])}" r="2.4" fill="#3d382e" stroke="#9a917d" stroke-width="0.8"/>
          <path d="${S}" fill="none" stroke="#e8e2d5" stroke-width="2.2"/>
          <circle cx="${o(h[0])}" cy="${i(h[1])}" r="3.2" fill="none" stroke="#b7a97f"/>
          <line x1="${o(0)-7}" y1="${i(0)}" x2="${o(0)-7}" y2="${i(e.factor)}" stroke="#9a917d" stroke-width="1"/>
          <text x="${o(0)-14}" y="${i(e.factor/2)}" fill="#9a917d" font-size="11" font-family="ui-monospace, monospace" text-anchor="end" transform="rotate(-90 ${o(0)-14} ${i(e.factor/2)})">factor</text>
          ${p(u[0],u[1],"A",-14,-8)}
          ${p(c[0],c[1],"E",-16,0)}
          ${p(d[0],d[1],"Z",8,-2)}
          ${p(h[0],h[1],"H",10,12)}
          ${p(f[0],f[1],"T",6,14)}
        </svg>
        <figcaption>Base to top: vertical facet to H, sixty degrees of arc about T, then
        the straight 30° ramp to the apex A. Tangent-continuous throughout — the
        construction's own doing, not an interpolation. Dashed: the two fifths EZ swinging
        down about E onto the vertical.</figcaption>
      </figure>
    </div>
  </section>`}function be(){const e=J(),t=Q(),n=C(e),a=C(t),s=(o,i,u)=>`<span class="status ${i?"ok":"bad"}">${o}: ${i?"exact cover ✓":"INVALID"} · ${u} elements</span>`;return`<section>
    <h2>A first plan, lifted nowhere yet</h2>
    <p class="caption">A deliberately modest two-tier vault plan — squares and half-squares,
    al-Kāshī's simple type — assembled as one eighth and unfolded through the D4
    kaleidoscope. It exists to prove the machinery: assembly, reflection, and the exact
    cover invariant, checked in ℚ(√2) with equality, not epsilon. The Takht-i Sulaymān
    quarter plan takes its place once its element layout is extracted from the sources.</p>
    ${s("wedge",n.ok,e.placed.length)} ${s("full plan",a.ok,t.placed.length)}
    <div class="row">
      <figure class="figure" style="flex:0 1 320px">
        ${j(e,{width:300,colorBy:"tier"})}
        <figcaption>The eighth: crown half-square (tier 2), square and half-square (tier 1).</figcaption>
      </figure>
      <figure class="figure" style="flex:0 1 480px">
        ${j(t,{width:460,colorBy:"tier"})}
        <figcaption>Unfolded: eight copies under rotation and reflection. Seams cancel exactly.</figcaption>
      </figure>
    </div>
  </section>`}function ke(){const e=he(),t=C(e),n={};for(const s of e.placed)n[s.def.kind]=(n[s.def.kind]??0)+1;const a=Object.entries(n).map(([s,o])=>`${o} ${s}${o===1?"":s.endsWith("s")?"es":"s"}`).join(" · ");return`<section>
    <h2>The Takht-i Sulaymān plate</h2>
    <p class="caption">The oldest known muqarnas plan: a quarter-vault ground plan incised
    on a 50 cm gypsum plate found in the Ilkhanid palace ruins (before ca. 1276), here
    assembled from the element alphabet with the arrangement digitized from the vector
    line work of Harmsen's reading. The vault centre is the cut corner, upper right; the
    plan is symmetric about the diagonal through it. And one discovery the exact
    arithmetic forced: the incised design does not quite close — its regular content
    spans 7&#8202;+&#8202;3.5√2 ≈ ${ue.toNumber().toFixed(4)} modules against the plate's
    12, the ≈1.8 mm excess hidden in a bent band of semi-regular quadrangles through the
    central star. Regularized (as the excavated unit-regular cells demand), it covers
    exactly.</p>
    <span class="status ${t.ok?"ok":"bad"}">${t.ok?"exact cover ✓":"INVALID"} · ${e.placed.length} elements · ${a} · area = 61 + 47√2</span>
    <div class="row">
      <figure class="figure" style="flex:0 1 640px">
        ${j(e,{width:620,colorBy:"kind"})}
        <figcaption>Six half eight-pointed stars on the walls, the full star at the
        middle, four four-square combinations, jug composites on the diagonal, and the
        crown bite at the centre. Same plan language as everything above — a building
        seen from above.</figcaption>
      </figure>
    </div>
  </section>`}function R(e,t={}){const n=Math.PI/5.2,a=t.fromBelow?-1:1,s=(l,r,p)=>{const g=p*a,v=l*Math.cos(n)-r*Math.sin(n),$=l*Math.sin(n)+r*Math.cos(n);return[v,$*.5-g*.72,$+g]},o=(()=>{const l=t.fromBelow?[-.35,.25,-.9]:[-.45,.35,.82],r=Math.hypot(...l);return[l[0]/r,l[1]/r,l[2]/r]})(),i=[],u=e.triangles.length/3;for(let l=0;l<u;l++){const[r,p,g]=[e.triangles[l*3],e.triangles[l*3+1],e.triangles[l*3+2]],v=N=>[e.positions[N*3],e.positions[N*3+1],e.positions[N*3+2]],[$,y,b]=[v(r),v(p),v(g)],k=[y[0]-$[0],y[1]-$[1],y[2]-$[2]],q=[b[0]-$[0],b[1]-$[1],b[2]-$[2]];let H=k[1]*q[2]-k[2]*q[1],E=k[2]*q[0]-k[0]*q[2],A=k[0]*q[1]-k[1]*q[0];const M=Math.hypot(H,E,A)||1;H/=M,E/=M,A/=M;const m=Math.abs(H*o[0]+E*o[1]+A*o[2]),I=s(...$),L=s(...y),B=s(...b);i.push({d:`M${I[0].toFixed(3)} ${I[1].toFixed(3)} L${L[0].toFixed(3)} ${L[1].toFixed(3)} L${B[0].toFixed(3)} ${B[1].toFixed(3)} Z`,depth:(I[2]+L[2]+B[2])/3,shade:m})}i.sort((l,r)=>l.depth-r.depth);let c=1/0,d=1/0,h=-1/0,f=-1/0;for(let l=0;l<e.positions.length;l+=3){const[r,p]=s(e.positions[l],e.positions[l+1],e.positions[l+2]);c=Math.min(c,r),h=Math.max(h,r),d=Math.min(d,p),f=Math.max(f,p)}const x=.35,T=`${(c-x).toFixed(2)} ${(d-x).toFixed(2)} ${(h-c+2*x).toFixed(2)} ${(f-d+2*x).toFixed(2)}`,S=i.map(l=>{const r=.28+.62*l.shade,p=`rgb(${Math.round(214*r)}, ${Math.round(205*r)}, ${Math.round(188*r)})`;return`<path d="${l.d}" fill="${p}" stroke="rgba(20,18,14,0.35)" stroke-width="0.008"/>`}).join(`
    `);return`<svg viewBox="${T}" xmlns="http://www.w3.org/2000/svg">
    ${S}
  </svg>`}function Te(){const t={sector:[...le("square").verts],placed:[P("square","cell",F.IDENTITY,1)]},n=Z(t,[{placedIndex:0,centralNode:0}],{arcSegments:20,rampSegments:8}),a=ce(n.mesh),s=de({cells:{square:1}}).total,o=(a-s)/s*100,i={sector:[w(-1,-1),w(1,-1),w(1,1),w(-1,1)],placed:[0,2,4,6].map(d=>P("square","cell",F.rotation(d),1))},u=Z(i,i.placed.map((d,h)=>({placedIndex:h,centralNode:0})),{arcSegments:16,rampSegments:6});return`<section>
    <h2>The curved cell</h2>
    <p class="caption">The profile made flesh. A cell stands on its plan shape with its
    apex at the central node: two vertical facets on the backside edges (height = the
    factor), and a roof of two cylinder panels — al-Kāshī's curve carried along each
    curved side, extruded parallel to the facet — meeting on the ridge over the diameter,
    the "main diagonal" the historical plans draw. Left: one cell on a square. Right:
    four cells closing around a shared apex, boundary only at the springing —
    ${W(u.mesh).nonManifoldEdges.length===0?"watertight":"NOT watertight"}, a
    miniature vault.</p>
    <span class="status ok">oracle: mesh ${a.toFixed(4)} vs al-Kāshī ${s.toFixed(4)}
    (2 × 1;43,33,45,41) · +${o.toFixed(1)}% — his "average depth one" trick, quantified</span>
    <div class="row">
      <figure class="figure" style="flex:0 1 360px">
        ${R(n.mesh)}
        <figcaption>One curved cell on a square: facets, cylinder panels, ridge.</figcaption>
      </figure>
      <figure class="figure" style="flex:0 1 420px">
        ${R(u.mesh)}
        <figcaption>A crown group: four cells, one welded apex, closed to the springing.</figcaption>
      </figure>
    </div>
  </section>`}const Se=[0,2,4,6].flatMap(e=>[F.rotation(e),F.reflection(2).then(F.rotation(e))]),Me=(e,t)=>{const[n,a]=e.toNumbers(),[s,o]=t.toNumbers();return!(Math.hypot(n,a)<4.3&&Math.hypot(s,o)<4.3)};let Y=null;function z(){if(!Y){const e=fe();Y={full:e,report:pe(e,{maxFreeOrbits:20,symmetries:Se})}}return Y}const _=new Map;function O(e){const{full:t,report:n}=z();let a=_.get(e);if(!a){const o=n.solutions[e],i=[];for(const d of o.faces)i[d.placedIndex]=d.tier;const u={sector:t.sector,placed:t.placed.map((d,h)=>({...d,tier:i[h]}))},{mesh:c}=ge(t,o.faces,{arcSegments:2,rampSegments:1,closeBoundary:Me});a={plan:j(u,{width:330,colorBy:"tier",showSector:!1}),above:R(c),below:R(c,{fromBelow:!0}),tris:c.triangles.length/3},_.set(e,a)}document.querySelector("#pick-plan").innerHTML=a.plan,document.querySelector("#pick-above").innerHTML=a.above,document.querySelector("#pick-below").innerHTML=a.below;const s=n.solutions[e];document.querySelector("#pick-status").textContent=`reading ${e+1} of ${n.solutions.length} · crown-rim reach ${s.graphReach} · ${s.faces.filter(o=>o.type==="cell").length} cells, ${s.faces.filter(o=>o.type==="intermediate").length} intermediates · ${a.tris} triangles`,document.querySelectorAll(".pick").forEach(o=>{o.classList.toggle("active",o.dataset.pick===String(e))})}function qe(){const{report:e}=z(),t=(a,s)=>{const o=a.graphReach===17?" — the regular-centre reading":a.graphReach===18?" — Harb’s reading":"";return`Reading ${s+1} · reach ${a.graphReach}${o}`},n=e.solutions.map((a,s)=>`<button class="pick" data-pick="${s}">${t(a,s)}</button>`).join(`
      `);return`<section>
    <h2>The same plan, ${e.solutions.length} vaults</h2>
    <p class="caption">Scene 7, working. Harmsen's rules pin all but ${e.freeOrbits}
    orbits of the plate's muqarnas graph; those ${e.freeOrbits} free choices admit
    exactly ${e.solutions.length} valid vaults — every one starting in the corners
    (the published finding: no regular springing without editing the plan), the published
    17- and 18-tier readings among them. Pick one. The plan holds; the building changes.
    The drawing does not determine the building, and the master's knowledge was never
    fully in the plan.</p>
    <div class="picker">
      ${n}
    </div>
    <span class="status ok" id="pick-status">…</span>
    <div class="row">
      <figure class="figure" style="flex:1 1 300px">
        <div id="pick-plan"></div>
        <figcaption>The plan, tier-banded by the chosen reading.</figcaption>
      </figure>
      <figure class="figure" style="flex:1 1 330px">
        <div id="pick-above"></div>
        <figcaption>The vault it makes, from above.</figcaption>
      </figure>
      <figure class="figure" style="flex:1 1 330px">
        <div id="pick-below"></div>
        <figcaption>And from below — the built-for view.</figcaption>
      </figure>
    </div>
  </section>`}function Ie(){document.querySelectorAll(".pick").forEach(n=>{n.addEventListener("click",()=>{const a=Number(n.dataset.pick);if(_.has(a)){O(a);return}document.querySelector("#pick-above").innerHTML='<p class="caption">raising the vault…</p>',document.querySelector("#pick-below").innerHTML="",setTimeout(()=>O(a),30)})});const{report:e}=z(),t=e.solutions.findIndex(n=>n.graphReach===17);O(t>=0?t:0)}function Fe(){const{vault:e}=xe(),{mesh:t}=e,n=W(t),a=n.nonManifoldEdges.length===0;return`<section>
    <h2>The lift, simple type</h2>
    <p class="caption">The same plan raised: plane facets of constant height on every front
    rib, plane roofs closing to the tier top, tier on tier to a single crown apex. The mesh
    is ${a?"watertight":"NOT watertight"} (${n.boundaryEdges.length} boundary
    edges, all at the springing) and its roofs project back onto the plan exactly — the
    projection identity, tested to 10 decimal places.</p>
    <span class="status ${a?"ok":"bad"}">manifold ${a?"✓":"✗"} · ${t.triangles.length/3} triangles · ${t.positions.length/3} welded vertices</span>
    <div class="row">
      <figure class="figure" style="flex:0 1 640px">
        ${R(t)}
        <figcaption>Painter-sorted flat shading, straight from the mesh — a verification
        view, not the lighting language. From-below and the real materials come with the
        render package.</figcaption>
      </figure>
    </div>
  </section>`}ve.innerHTML=`<main>
  <header class="masthead">
    <h1>Muqarnas</h1>
    <p class="sub">plan inspection — the element alphabet, al-Kāshī's profile, and the exact-cover
    invariant · <a href="/render.html" style="color: var(--accent)">the render stage →</a></p>
  </header>
  ${we()}
  ${ye()}
  ${Te()}
  ${ke()}
  ${qe()}
  ${be()}
  ${Fe()}
</main>`;Ie();
