// Curvas com profundidade local: segmentos sobrepostos mostram cima e baixo.
// Representacao didatica de duas pontas; nao e um simulador fisico de cordas.
const cores = ['#477fad', '#d47d51'];
const sombras = ['#315e83', '#a85732'];
const bases = {
  livre: [
    [[270,405,0],[265,365,0],[250,325,0],[239,285,0],[230,245,0],[220,205,0],[218,168,0],[225,130,0],[235,95,0]],
    [[450,405,0],[455,365,0],[470,325,0],[481,285,0],[490,245,0],[500,205,0],[502,168,0],[495,130,0],[485,95,0]]
  ],
  cruzado: [
    [[270,405,0],[272,365,0],[290,325,0],[320,285,0],[360,245,1],[400,205,1],[438,168,0],[470,130,0],[495,95,0]],
    [[450,405,0],[448,365,0],[430,325,0],[400,285,0],[360,245,-1],[320,205,-1],[282,168,0],[250,130,0],[225,95,0]]
  ],
  enlacado: [
    [[270,405,0],[285,355,0],[335,300,1],[420,230,1],[474,239,0],[435,312,-2],[360,310,-2],[325,235,2],[407,137,2]],
    [[450,405,0],[434,355,0],[407,310,0],[380,265,0],[353,230,0],[320,198,0],[287,171,0],[255,146,0],[220,120,0]]
  ],
  apertado: [
    [[270,405,0],[295,365,0],[335,318,1],[381,279,1],[414,291,0],[392,320,-2],[355,306,-2],[413,273,2],[520,245,2]],
    [[450,405,0],[425,365,0],[390,320,0],[367,290,0],[350,278,0],[330,273,0],[290,263,0],[245,253,0],[200,245,0]]
  ]
};

function pontos(estado, espelhar) {
  let pose = bases[estado.fase].map(lado => lado.map(p => [...p]));
  if (estado.fase === 'cruzado' && estado.cima === 1) {
    pose.forEach(lado => lado.forEach(p => { p[2] *= -1; }));
  }
  if (['enlacado','apertado'].includes(estado.fase) && estado.cima === estado.ativa) {
    pose[0].forEach(p => { p[2] *= -1; });
  }
  if (['enlacado','apertado'].includes(estado.fase) && estado.ativa === 1) {
    pose = [pose[1], pose[0]].map(lado => lado.map(([x,y,z]) => [720-x,y,z]));
  }
  if (espelhar) pose = pose.map(lado => lado.map(([x,y,z]) => [720-x,y,z]));
  return pose;
}

function amostrar(pontos, cor, voltas, ativa) {
  const linha = [];
  for (let i=0;i<pontos.length-1;i++) {
    const a=pontos[Math.max(0,i-1)], b=pontos[i], c=pontos[i+1], d=pontos[Math.min(pontos.length-1,i+2)];
    for (let j=0;j<12;j++) {
      const t=j/12;
      const p=[0,1,2].map(k=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t));
      // Voltas adicionais aparecem como ondulacoes locais, com profundidade alternada.
      if (ativa && voltas > 0 && i >= 2 && i <= 5) {
        const f=(i-2+t)/4, envoltoria=Math.sin(Math.PI*f);
        p[0] += Math.sin(f*Math.PI*2*Math.min(voltas,6))*13*envoltoria;
        p[1] += Math.cos(f*Math.PI*2*Math.min(voltas,6))*9*envoltoria;
        p[2] += Math.sin(f*Math.PI*2*Math.min(voltas,6))*envoltoria;
      }
      linha.push(p);
    }
  }
  linha.push(pontos.at(-1));
  return linha.slice(1).map((b,i)=>({a:linha[i],b,cor,z:(linha[i][2]+b[2])/2}));
}

export class Cena {
  constructor(canvas) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.estado={fase:'livre',ativa:0,cima:0,voltas:0};
    this.pose=pontos(this.estado,true); this.raf=0; this.mirror=true;
    this.observer=new ResizeObserver(()=>this.redesenhar()); this.observer.observe(canvas);
    this.redesenhar();
  }
  mostrar(estado, nomes, animar=true, velocidade=1) {
    cancelAnimationFrame(this.raf);
    this.mirror=(nomes[0] || '').includes('direita');
    const inicio=this.pose.map(l=>l.map(p=>[...p])), fim=pontos(estado,this.mirror);
    this.estado=estado;
    const reduzido=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animar || reduzido) { this.pose=fim; this.redesenhar(); return; }
    const comeco=performance.now(), duracao=750/velocidade;
    const frame=agora=>{
      const t=Math.min((agora-comeco)/duracao,1), suavizado=t*t*(3-2*t);
      this.pose=inicio.map((lado,c)=>lado.map((p,i)=>p.map((v,k)=>v+(fim[c][i][k]-v)*suavizado)));
      this.redesenhar(); if(t<1)this.raf=requestAnimationFrame(frame);
    };
    this.raf=requestAnimationFrame(frame);
  }
  redesenhar() {
    const c=this.ctx, w=this.canvas.clientWidth, h=this.canvas.clientHeight;
    if(!w||!h)return;
    const dpr=Math.min(devicePixelRatio||1,2);
    if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);}
    c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
    const escala=Math.min(w/720,h/470);c.translate((w-720*escala)/2,(h-470*escala)/2);c.scale(escala,escala);
    // Base sutil do calcado e ilhoses: deixam as pontas ancoradas no desenho.
    c.fillStyle='#e9eade';c.strokeStyle='#d5daca';c.lineWidth=1.5;
    c.beginPath();c.moveTo(210,460);c.bezierCurveTo(220,370,230,359,270,355);c.lineTo(450,355);c.bezierCurveTo(490,359,500,370,510,460);c.closePath();c.fill();c.stroke();
    c.strokeStyle='#d3d8c9';c.setLineDash([3,5]);c.beginPath();c.moveTo(241,460);c.lineTo(264,371);c.lineTo(456,371);c.lineTo(479,460);c.stroke();c.setLineDash([]);
    [270,450].forEach(x=>{c.fillStyle='#cbd0c1';c.beginPath();c.ellipse(x,407,15,9,0,0,Math.PI*2);c.fill();c.fillStyle='#aab29e';c.beginPath();c.ellipse(x,407,8,4,0,0,Math.PI*2);c.fill();});
    const segmentos=this.pose.flatMap((lado,i)=>amostrar(lado,i,this.estado.voltas,i===this.estado.ativa));
    segmentos.sort((a,b)=>a.z-b.z);
    c.lineCap='round';c.lineJoin='round';
    for(const s of segmentos){
      const desenhar=(cor,largura,deslocar=0)=>{c.strokeStyle=cor;c.lineWidth=largura;c.beginPath();c.moveTo(s.a[0]+deslocar,s.a[1]+deslocar);c.lineTo(s.b[0]+deslocar,s.b[1]+deslocar);c.stroke();};
      desenhar('#34452b12',19,3);desenhar(sombras[s.cor],14);desenhar(cores[s.cor],11);desenhar('#ffffff32',2,-2);
    }
    this.pose.forEach((lado,i)=>{
      const p=lado.at(-1),ant=lado.at(-2),ang=Math.atan2(p[1]-ant[1],p[0]-ant[0]);
      c.save();c.translate(p[0],p[1]);c.rotate(ang);c.fillStyle=sombras[i];c.fillRect(-14,-6,21,12);c.fillStyle='#ffffff66';c.fillRect(-10,-4,3,8);c.restore();
    });
    if(this.estado.fase==='apertado'){
      c.strokeStyle='#7c9478';c.lineWidth=1.5;
      for(const [x,sinal]of[[150,-1],[570,1]]){c.beginPath();c.moveTo(x-sinal*23,232);c.lineTo(x+sinal*8,232);c.lineTo(x,226);c.moveTo(x+sinal*8,232);c.lineTo(x,238);c.stroke();}
    }
    if(this.estado.voltas){c.fillStyle='#718168';c.font='13px Segoe UI, sans-serif';c.textAlign='center';c.fillText(`${this.estado.voltas} volta${this.estado.voltas===1?'':'s'} de reforço`,360,85);}
  }
}
