/* ===== 3D 曲げ工程シミュレーター =====
   プレスブレーキ(ラム・パンチ・ダイ・ベッド)の3Dモデル内で、板金部品を
   1曲げずつ工程順に成形する。曲げごとの持ち替え(位置・姿勢の変更)も再現する。
   依存ライブラリなし(WebGLを直接使用)。 */
(function(){
  /* ---------------- 数学 ---------------- */
  const V3={
    sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
    add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
    mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
    cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
    dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
    len:a=>Math.hypot(a[0],a[1],a[2]),
    norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l];},
  };
  const M4={
    id:()=>[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
    mul(a,b){const o=new Array(16);
      for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;},
    xform(m,p){const x=p[0],y=p[1],z=p[2];
      return[m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]];},
    xform3(m,p){const x=p[0],y=p[1],z=p[2];
      return[m[0]*x+m[4]*y+m[8]*z, m[1]*x+m[5]*y+m[9]*z, m[2]*x+m[6]*y+m[10]*z];},
    trans:(x,y,z)=>[1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1],
    rotX(a){const c=Math.cos(a),s=Math.sin(a);return[1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1];},
    rotY(a){const c=Math.cos(a),s=Math.sin(a);return[c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1];},
    basis(u,v,n){return[u[0],u[1],u[2],0, v[0],v[1],v[2],0, n[0],n[1],n[2],0, 0,0,0,1];},
    /* 任意軸まわりの回転(軸は点pを通り方向d) */
    axisRot(p,d,a){
      const [x,y,z]=V3.norm(d), c=Math.cos(a), s=Math.sin(a), t=1-c;
      const R=[t*x*x+c, t*x*y+s*z, t*x*z-s*y,0,
               t*x*y-s*z, t*y*y+c, t*y*z+s*x,0,
               t*x*z+s*y, t*y*z-s*x, t*z*z+c,0, 0,0,0,1];
      return M4.mul(M4.trans(p[0],p[1],p[2]), M4.mul(R, M4.trans(-p[0],-p[1],-p[2])));
    },
    persp(fov,asp,n,f){const t=1/Math.tan(fov/2);
      return[t/asp,0,0,0, 0,t,0,0, 0,0,(f+n)/(n-f),-1, 0,0,2*f*n/(n-f),0];},
    lookAt(e,c,up){
      const z=V3.norm(V3.sub(e,c)), x=V3.norm(V3.cross(up,z)), y=V3.cross(z,x);
      return[x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
             -V3.dot(x,e),-V3.dot(y,e),-V3.dot(z,e),1];},
  };

  /* ---------------- メッシュ構築 ---------------- */
  function Mesh(){ this.p=[]; this.n=[]; this.c=[]; }
  Mesh.prototype.tri=function(a,b,c,col,nrm){
    const n=nrm||V3.norm(V3.cross(V3.sub(b,a),V3.sub(c,a)));
    for(const v of [a,b,c]){ this.p.push(v[0],v[1],v[2]); this.n.push(n[0],n[1],n[2]); this.c.push(col[0],col[1],col[2]); }
  };
  Mesh.prototype.quad=function(a,b,c,d,col,nrm){ this.tri(a,b,c,col,nrm); this.tri(a,c,d,col,nrm); };
  Mesh.prototype.count=function(){ return this.p.length/3; };

  /* 2D多角形の三角形分割(耳切り法) */
  function earClip(poly){
    const n=poly.length, idx=[...Array(n).keys()], out=[];
    let area=0; for(let i=0;i<n;i++){const j=(i+1)%n; area+=poly[i][0]*poly[j][1]-poly[j][0]*poly[i][1];}
    if(area<0) idx.reverse();
    const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
    const inTri=(p,a,b,c)=>{const d1=cross(a,b,p),d2=cross(b,c,p),d3=cross(c,a,p);
      return !((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0));};
    let guard=0;
    while(idx.length>3 && guard++<3000){
      let cut=false;
      for(let i=0;i<idx.length;i++){
        const a=poly[idx[(i+idx.length-1)%idx.length]], b=poly[idx[i]], c=poly[idx[(i+1)%idx.length]];
        if(cross(a,b,c)<=0) continue;
        let ok=true;
        for(let j=0;j<idx.length;j++){ const q=poly[idx[j]];
          if(q===a||q===b||q===c) continue;
          if(inTri(q,a,b,c)){ ok=false; break; } }
        if(ok){ out.push([a,b,c]); idx.splice(i,1); cut=true; break; }
      }
      if(!cut) break;
    }
    if(idx.length===3) out.push([poly[idx[0]],poly[idx[1]],poly[idx[2]]]);
    return out;
  }

  /* 2D断面(z,y平面)をx方向に押し出す */
  function extrude(mesh,poly,x0,x1,col){
    const tris=earClip(poly);
    for(const t of tris){
      mesh.tri([x1,t[0][1],t[0][0]],[x1,t[1][1],t[1][0]],[x1,t[2][1],t[2][0]],col,[1,0,0]);
      mesh.tri([x0,t[2][1],t[2][0]],[x0,t[1][1],t[1][0]],[x0,t[0][1],t[0][0]],col,[-1,0,0]);
    }
    for(let i=0;i<poly.length;i++){
      const a=poly[i], b=poly[(i+1)%poly.length];
      mesh.quad([x0,a[1],a[0]],[x1,a[1],a[0]],[x1,b[1],b[0]],[x0,b[1],b[0]],col);
    }
  }

  /* 矩形から穴を除いたセル群を返す */
  function cells(x0,y0,x1,y1,holes){
    const xs=[x0,x1], ys=[y0,y1];
    holes.forEach(h=>{ xs.push(h[0],h[2]); ys.push(h[1],h[3]); });
    const ux=[...new Set(xs)].filter(v=>v>=x0-1e-6&&v<=x1+1e-6).sort((a,b)=>a-b);
    const uy=[...new Set(ys)].filter(v=>v>=y0-1e-6&&v<=y1+1e-6).sort((a,b)=>a-b);
    const out=[];
    for(let i=0;i<ux.length-1;i++)for(let j=0;j<uy.length-1;j++){
      const cx=(ux[i]+ux[i+1])/2, cy=(uy[j]+uy[j+1])/2;
      if(holes.some(h=>cx>h[0]&&cx<h[2]&&cy>h[1]&&cy<h[3])) continue;
      if(ux[i+1]-ux[i]<1e-6||uy[j+1]-uy[j]<1e-6) continue;
      out.push([ux[i],uy[j],ux[i+1],uy[j+1]]);
    }
    return out;
  }

  /* 板(局所xy平面、厚さT)をメッシュ化。M で世界座標へ変換 */
  function slab(mesh,M,rect,holes,T,col){
    const h=T/2, [x0,y0,x1,y1]=rect;
    const P=(x,y,z)=>M4.xform(M,[x,y,z]);
    const nUp=M4.xform3(M,[0,0,1]), nDn=M4.xform3(M,[0,0,-1]);
    for(const c of cells(x0,y0,x1,y1,holes)){
      mesh.quad(P(c[0],c[1],h),P(c[2],c[1],h),P(c[2],c[3],h),P(c[0],c[3],h),col,nUp);
      mesh.quad(P(c[0],c[1],-h),P(c[0],c[3],-h),P(c[2],c[3],-h),P(c[2],c[1],-h),col,nDn);
    }
    const side=(ax,ay,bx,by)=>mesh.quad(P(ax,ay,-h),P(bx,by,-h),P(bx,by,h),P(ax,ay,h),col);
    side(x0,y0,x1,y0); side(x1,y0,x1,y1); side(x1,y1,x0,y1); side(x0,y1,x0,y0);
    holes.forEach(q=>{ side(q[0],q[1],q[0],q[3]); side(q[0],q[3],q[2],q[3]); side(q[2],q[3],q[2],q[1]); side(q[2],q[1],q[0],q[1]); });
  }

  /* 曲げ部(円筒帯)。Mj は継手フレーム(曲げ軸=局所x、親はy<0側) */
  function bendStrip(mesh,Mj,xa,xb,ang,R,T,col){
    if(Math.abs(ang)<0.001) return;
    const s=Math.sign(ang), a=Math.abs(ang), rho=R+T/2, t=rho*Math.tan(a/2);
    const C=[0,-t,rho], N=Math.max(4,Math.ceil(a/0.14));
    const pt=(u,rr)=>{ const yy=C[1]+rr*Math.sin(u), zz=C[2]-rr*Math.cos(u); return [yy, s*zz]; };
    const P=(x,y,z)=>M4.xform(Mj,[x,y,z]);
    for(let i=0;i<N;i++){
      const u0=a*i/N, u1=a*(i+1)/N;
      const o0=pt(u0,rho+T/2), o1=pt(u1,rho+T/2), i0=pt(u0,rho-T/2), i1=pt(u1,rho-T/2);
      mesh.quad(P(xa,o0[0],o0[1]),P(xb,o0[0],o0[1]),P(xb,o1[0],o1[1]),P(xa,o1[0],o1[1]),col);
      mesh.quad(P(xa,i1[0],i1[1]),P(xb,i1[0],i1[1]),P(xb,i0[0],i0[1]),P(xa,i0[0],i0[1]),col);
      mesh.quad(P(xa,i0[0],i0[1]),P(xa,i1[0],i1[1]),P(xa,o1[0],o1[1]),P(xa,o0[0],o0[1]),col);
      mesh.quad(P(xb,o0[0],o0[1]),P(xb,o1[0],o1[1]),P(xb,i1[0],i1[1]),P(xb,i0[0],i0[1]),col);
    }
  }

  /* ---------------- 部品モデル ---------------- */
  /* ノード: {rect,holes,children:[{edge,len,ang,inset,holes,children}]} */
  const PARTS={
    tray:{n:'トレイ(4方曲げ)',T:1.6,
      base:{w:130,h:95,holes:[[-38,-12,-20,6],[12,-8,26,6],[-8,20,8,32]]},
      fl:[{e:'y+',len:38,ang:90,in:[8,8],holes:[[-16,12,16,26]]},
          {e:'y-',len:38,ang:90,in:[8,8],holes:[[-16,12,16,26]]},
          {e:'x+',len:26,ang:90,in:[8,8],holes:[]},
          {e:'x-',len:26,ang:90,in:[8,8],holes:[]}]},
    bracket:{n:'L字ブラケット',T:2.0,
      base:{w:90,h:65,holes:[[-28,-14,-14,0],[14,-14,28,0]]},
      fl:[{e:'y+',len:45,ang:90,in:[0,0],holes:[[-12,14,12,28]]}]},
    channel:{n:'コの字チャンネル',T:1.6,
      base:{w:110,h:60,holes:[[-12,-10,12,10]]},
      fl:[{e:'y+',len:32,ang:90,in:[0,0],holes:[]},
          {e:'y-',len:32,ang:90,in:[0,0],holes:[]}]},
    hat:{n:'ハット断面(4曲げ)',T:1.6,
      base:{w:110,h:55,holes:[]},
      fl:[{e:'y+',len:30,ang:90,in:[0,0],holes:[],ch:[{len:22,ang:90,dir:-1,in:[0,0],holes:[]}]},
          {e:'y-',len:30,ang:90,in:[0,0],holes:[],ch:[{len:22,ang:90,dir:-1,in:[0,0],holes:[]}]}]},
    box:{n:'返り付きボックス(6曲げ)',T:1.2,
      base:{w:120,h:85,holes:[[-16,-8,16,8]]},
      fl:[{e:'y+',len:34,ang:90,in:[10,10],holes:[],ch:[{len:12,ang:90,dir:-1,in:[0,0],holes:[]}]},
          {e:'y-',len:34,ang:90,in:[10,10],holes:[],ch:[{len:12,ang:90,dir:-1,in:[0,0],holes:[]}]},
          {e:'x+',len:34,ang:90,in:[10,10],holes:[]},
          {e:'x-',len:34,ang:90,in:[10,10],holes:[]}]},
  };

  /* プリセットからノード木を構築。曲げには通し番号を付ける */
  function buildTree(spec){
    let id=0;
    const root={rect:[-spec.base.w/2,-spec.base.h/2,spec.base.w/2,spec.base.h/2],
                holes:spec.base.holes.slice(),children:[],parent:null};
    const attach=(par,f)=>{
      const [x0,y0,x1,y1]=par.rect;
      let A,u,v,ax0,ax1;
      if(f.e==='y+'){A=[0,y1,0];u=[1,0,0];v=[0,1,0];ax0=x0;ax1=x1;}
      else if(f.e==='y-'){A=[0,y0,0];u=[-1,0,0];v=[0,-1,0];ax0=-x1;ax1=-x0;}
      else if(f.e==='x+'){A=[x1,0,0];u=[0,-1,0];v=[1,0,0];ax0=-y1;ax1=-y0;}
      else {A=[x0,0,0];u=[0,1,0];v=[-1,0,0];ax0=y0;ax1=y1;}
      const nd={A,u,v,ang:f.ang*(f.dir||1),rect:[ax0+f.in[0],0,ax1-f.in[1],f.len],
                holes:(f.holes||[]).slice(),children:[],parent:par,bid:id++,edge:f.e};
      par.children.push(nd);
      (f.ch||[]).forEach(c=>attach(nd,Object.assign({e:'y+'},c)));
      return nd;
    };
    spec.fl.forEach(f=>attach(root,f));
    return root;
  }
  function allBends(root){ const o=[]; (function w(n){n.children.forEach(c=>{o.push(c);w(c);});})(root); return o; }

  /* 各ノードの世界行列を計算。angles[bid] が現在角度(度) */
  function poseTree(root,angles,T,R,extra){
    const set=(n,M)=>{ n.M=M; n.Mj=M;
      n.children.forEach(c=>{
        const B=M4.mul(M4.trans(c.A[0],c.A[1],c.A[2]),M4.basis(c.u,c.v,V3.cross(c.u,c.v)));
        const Mj=M4.mul(M,B);
        const a=(angles[c.bid]||0)*Math.PI/180;
        c.Mj=Mj; c.ang_cur=a;
        set(c, M4.mul(Mj, M4.rotX(a)));
      });
    };
    set(root, extra||M4.id());
  }
  /* 部品メッシュ。trimは曲げR分の切り詰め */
  function partMesh(mesh,root,T,R,col,colOf){
    const walk=n=>{
      let [x0,y0,x1,y1]=n.rect;
      const tr=c=>{ const a=Math.abs(c.ang_cur||0); return (R+T/2)*Math.tan(a/2); };
      if(n.parent) y0 += tr(n);
      n.children.forEach(c=>{
        const t=tr(c);
        if(c.u[0]===1&&c.v[1]===1) y1-=t;
        else if(c.u[0]===-1&&c.v[1]===-1) y0+=t;
        else if(c.v[0]===1) x1-=t;
        else if(c.v[0]===-1) x0+=t;
      });
      slab(mesh,n.M,[x0,y0,x1,y1],n.holes,T,colOf?colOf(n):col);
      n.children.forEach(c=>{
        bendStrip(mesh,c.Mj,c.rect[0],c.rect[2],c.ang_cur||0,R,T,colOf?colOf(c):col);
        walk(c);
      });
    };
    walk(root);
  }

  /* ---------------- 金型断面(2D: [z,y]) ---------------- */
  function dieProfile(V,ang,rs,Dw,Dh){
    const hv=V/2, ha=ang*Math.PI/360, dep=hv/Math.tan(ha), r=Math.min(rs,hv*0.4);
    return [[-Dw/2,0],[-(hv+r),0],[-(hv-r*Math.sin(ha)),-r*Math.cos(ha)],[0,-dep],
            [hv-r*Math.sin(ha),-r*Math.cos(ha)],[hv+r,0],[Dw/2,0],[Dw/2,-Dh-9],[-Dw/2,-Dh-9]];
  }
  function punchProfile(ang,Wp,Hp,goose,gd,gh){
    const ha=ang*Math.PI/360, side=sg=>{
      if(goose){ const t=Math.max(0.6,gd), ht=t/Math.tan(ha);
        return [[sg*t,ht],[sg*t,ht+gh],[sg*Wp/2,ht+gh+(Wp/2-t)],[sg*Wp/2,Hp]]; }
      const h1=(Wp/2)/Math.tan(ha); return [[sg*Wp/2,h1],[sg*Wp/2,Math.max(h1+1,Hp)]];
    };
    return [[0,0]].concat(side(1)).concat(side(-1).reverse());
  }
  const dSeg2=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;
    let t=l2?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2:0; t=Math.max(0,Math.min(1,t));
    return Math.hypot(p[0]-(a[0]+dx*t),p[1]-(a[1]+dy*t));};
  const dPoly2=(po,p)=>{let m=1e9;for(let i=0,j=po.length-1;i<po.length;j=i++)m=Math.min(m,dSeg2(p,po[i],po[j]));return m;};
  const ptIn=(po,p)=>{let c=false;for(let i=0,j=po.length-1;i<po.length;j=i++){const a=po[i],b=po[j];
    if(((a[1]>p[1])!==(b[1]>p[1]))&&(p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;};

  /* ---------------- WebGL ---------------- */
  const VS=`attribute vec3 aP;attribute vec3 aN;attribute vec3 aC;uniform mat4 uVP;
    varying vec3 vN;varying vec3 vC;void main(){gl_Position=uVP*vec4(aP,1.0);vN=aN;vC=aC;}`;
  const FS=`precision mediump float;varying vec3 vN;varying vec3 vC;
    void main(){vec3 n=normalize(vN);
      float d1=max(dot(n,normalize(vec3(0.45,0.85,0.5))),0.0);
      float d2=max(dot(n,normalize(vec3(-0.55,0.35,-0.6))),0.0);
      float l=0.40+0.50*d1+0.20*d2;
      gl_FragColor=vec4(vC*l,1.0);}`;
  function initGL(cv){
    const gl=cv.getContext('webgl',{antialias:true})||cv.getContext('experimental-webgl');
    if(!gl) return null;
    const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);
      if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;};
    const pr=gl.createProgram();
    gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS)); gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));
    gl.linkProgram(pr); gl.useProgram(pr);
    const buf={p:gl.createBuffer(),n:gl.createBuffer(),c:gl.createBuffer()};
    const loc={p:gl.getAttribLocation(pr,'aP'),n:gl.getAttribLocation(pr,'aN'),
               c:gl.getAttribLocation(pr,'aC'),vp:gl.getUniformLocation(pr,'uVP')};
    [loc.p,loc.n,loc.c].forEach(l=>gl.enableVertexAttribArray(l));
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    return {gl,pr,buf,loc};
  }
  function drawMesh(ctx,mesh,vp,clear){
    const {gl,buf,loc}=ctx;
    gl.clearColor(clear[0],clear[1],clear[2],1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const up=(b,arr,l)=>{gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(l,3,gl.FLOAT,false,0,0);};
    up(buf.p,mesh.p,loc.p); up(buf.n,mesh.n,loc.n); up(buf.c,mesh.c,loc.c);
    gl.uniformMatrix4fv(loc.vp,false,new Float32Array(vp));
    gl.drawArrays(gl.TRIANGLES,0,mesh.count());
  }

  window.SM3D={V3,M4,Mesh,extrude,slab,bendStrip,earClip,PARTS,buildTree,allBends,poseTree,partMesh,
               dieProfile,punchProfile,ptIn,dPoly2,initGL,drawMesh};
})();

/* ===== 3D 曲げ工程シミュレーター: シーンと工程アニメーション ===== */
(function(){
  const {V3,M4,Mesh,extrude,PARTS,buildTree,allBends,poseTree,partMesh,
         dieProfile,punchProfile,ptIn,dPoly2,initGL,drawMesh}=window.SM3D;
  const rad=d=>d*Math.PI/180, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const f=(v,d=1)=>{const m=Math.pow(10,d);return (Math.round(v*m)/m).toFixed(d);};

  /* 行列の回転部を転置 */
  const transR=m=>[m[0],m[4],m[8],0, m[1],m[5],m[9],0, m[2],m[6],m[10],0, 0,0,0,1];
  const DIAG=[1,0,0,0, 0,-1,0,0, 0,0,-1,0, 0,0,0,1];
  /* 剛体行列 → クォータニオン+平行移動 */
  function toQT(m){
    const t=m[0]+m[5]+m[10]; let q;
    if(t>0){const s=Math.sqrt(t+1)*2;q=[(m[6]-m[9])/s,(m[8]-m[2])/s,(m[1]-m[4])/s,0.25*s];}
    else if(m[0]>m[5]&&m[0]>m[10]){const s=Math.sqrt(1+m[0]-m[5]-m[10])*2;q=[0.25*s,(m[4]+m[1])/s,(m[8]+m[2])/s,(m[6]-m[9])/s];}
    else if(m[5]>m[10]){const s=Math.sqrt(1+m[5]-m[0]-m[10])*2;q=[(m[4]+m[1])/s,0.25*s,(m[9]+m[6])/s,(m[8]-m[2])/s];}
    else{const s=Math.sqrt(1+m[10]-m[0]-m[5])*2;q=[(m[8]+m[2])/s,(m[9]+m[6])/s,0.25*s,(m[1]-m[4])/s];}
    const l=Math.hypot(q[0],q[1],q[2],q[3])||1;
    return {q:[q[0]/l,q[1]/l,q[2]/l,q[3]/l],t:[m[12],m[13],m[14]]};
  }
  function fromQT(q,t){
    const [x,y,z,w]=q;
    return [1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w),0,
            2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w),0,
            2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y),0, t[0],t[1],t[2],1];
  }
  function slerp(a,b,u){
    let d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3], bb=b.slice();
    if(d<0){d=-d;bb=b.map(v=>-v);}
    if(d>0.9995) return a.map((v,i)=>v+(bb[i]-v)*u);
    const th=Math.acos(d), s=Math.sin(th);
    return a.map((v,i)=>(Math.sin((1-u)*th)/s)*v+(Math.sin(u*th)/s)*bb[i]);
  }

  const COL={part:[0.80,0.83,0.87], hit:[0.88,0.33,0.30], tool:[0.33,0.37,0.44],
             ram:[0.70,0.74,0.79], bed:[0.66,0.70,0.75]};

  /* 曲げ b を加工するときの機械配置(沈み込み前) */
  function basePose(P,b,theta){
    const T=P.T;
    const sg=Math.sign(b.ang)||1;
    const A=M4.xform(b.Mj,[(b.rect[0]+b.rect[2])/2,0,0]);
    const u=V3.norm(M4.xform3(b.Mj,[1,0,0]));
    const G=M4.axisRot(A,u,rad(theta)*sg/2);             // 左右対称に起こす
    const b2=V3.norm(M4.xform3(b.Mj,[0,0,-sg]));         // 外側二等分線
    const w2=V3.cross(u,b2);
    const R=M4.mul(DIAG,transR(M4.basis(u,b2,w2)));      // 曲げ軸→X、二等分線→-Y
    const mold=V3.add(A,V3.mul(b2,(T/2)/Math.cos(rad(theta)/2)));
    const rm=M4.xform(R,mold);
    const Malign=M4.mul(M4.trans(-rm[0],-rm[1],-rm[2]),R);
    return M4.mul(Malign,G);
  }
  /* ダイ上面・V溝に載る高さ。部品頂点から必要な持ち上げ量を求める */
  function seatOffset(P,pts){
    const hv=P.V/2, ha=rad(P.dieAng/2), tn=Math.tan(ha), half=Math.max(P.dieW,P.V*2.2)/2;
    let off=-1e9;
    for(let i=0;i<pts.length;i+=3){
      const y=pts[i+1], z=pts[i+2];
      let allow;
      if(Math.abs(z)<=half) allow=Math.abs(z)>=hv?0:-(hv-Math.abs(z))/tn;   // ダイ上面とV溝
      else if(z>-78&&z<52) allow=-P.dieH;                                    // ベッド上面
      else continue;
      if(allow-y>off) off=allow-y;
    }
    return off===-1e9?0:off;
  }
  /* 部品を機械に載せた姿勢と、そのときの部品メッシュ・パンチ先端高さを返す */
  function seatPart(P,root,angles,b,theta){
    poseTree(root,angles,P.T,P.R);          // 継手フレーム Mj を確定
    const G0=basePose(P,b,theta);
    poseTree(root,angles,P.T,P.R,G0);
    const m0=new Mesh(); partMesh(m0,root,P.T,P.R,COL.part);
    const off=seatOffset(P,m0.p);
    const G=M4.mul(M4.trans(0,off,0),G0);
    poseTree(root,angles,P.T,P.R,G);
    const m=new Mesh(); partMesh(m,root,P.T,P.R,COL.part);
    let tip=1e9;
    for(let i=0;i<m.p.length;i+=3){ if(Math.abs(m.p[i+2])<P.V*0.18) tip=Math.min(tip,m.p[i+1]); }
    return {G,mesh:m,off,punchTip:(tip<1e8?tip:0)+P.T};
  }

  /* 機械(ベッド・ダイ・パンチ・ラム)のメッシュ */
  function machineMesh(P,punchY,showTool,pLen){
    const m=new Mesh(), L=P.toolLen;
    if(!showTool) return m;
    const dp=dieProfile(P.V,P.dieAng,P.rs,P.dieW,P.dieH);
    const seg=6, gap=2.5, sw=(L-gap*(seg-1))/seg;
    for(let i=0;i<seg;i++){ const x0=-L/2+i*(sw+gap); extrude(m,dp,x0,x0+sw,COL.tool); }
    const pp=punchProfile(P.punchAng,P.punchW,P.punchH,P.goose,P.gd,P.gh)
      .map(q=>[q[0],q[1]+punchY]);
    /* パンチは曲げ線の長さに合わせて分割・短く組む(箱曲げの定石) */
    const PL=Math.min(L,pLen||L), pseg=Math.max(1,Math.round(PL/45)), pgap=2.0;
    const pw2=(PL-pgap*(pseg-1))/pseg;
    for(let i=0;i<pseg;i++){ const x0=-PL/2+i*(pw2+pgap); extrude(m,pp,x0,x0+pw2,COL.tool); }
    const box=(x0,x1,y0,y1,z0,z1,col)=>{
      const q=(a,b,c,d,n)=>m.quad(a,b,c,d,col,n);
      q([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],[0,1,0]);
      q([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0]);
      q([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1]);
      q([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1]);
      q([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0]);
      q([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0]);
    };
    box(-L/2-26,L/2+26,-P.dieH-42,-P.dieH,-78,52,COL.bed);
    const ramY=punchY+P.punchH;
    box(-L/2-26,L/2+26,ramY,ramY+32,-78,52,COL.ram);
    return m;
  }

  /* 干渉判定: 部品頂点を機械断面に射影して金型多角形の内外を見る */
  function checkHit(P,pts,punchY,off,seated,pLen){
    const pp=punchProfile(P.punchAng,P.punchW,P.punchH,P.goose,P.gd,P.gh);
    const dp=seated?null:dieProfile(P.V,P.dieAng,P.rs,P.dieW,P.dieH);
    const exP=(P.R+P.T)*1.4+1.0, TOL=0.25;
    const ramY=punchY+P.punchH, bedY=-P.dieH, hx=P.toolLen/2+26, phx=Math.min(P.toolLen,pLen||P.toolLen)/2;
    for(let i=0;i<pts.length;i+=3){
      const x=pts[i],y=pts[i+1],z=pts[i+2];
      /* ラム(上部テーブル)・ベッドは幅の広い直方体なので常に見る */
      if(Math.abs(x)<hx && z>-78 && z<52){
        if(y>ramY+TOL) return {what:'ラム(上部テーブル)',p:[x,y,z]};
        if(y<bedY-TOL) return {what:'ベッド(下部テーブル)',p:[x,y,z]};
      }
      if(i%9) continue;
      const py=y-punchY;
      if(Math.abs(x)<=phx && Math.hypot(z,py)>exP && ptIn(pp,[z,py]) && dPoly2(pp,[z,py])>TOL) return {what:'パンチ',p:[x,y,z]};
      if(dp && Math.abs(x)<=P.toolLen/2 && ptIn(dp,[z,y]) && dPoly2(dp,[z,y])>TOL) return {what:'ダイ',p:[x,y,z]};
    }
    /* 載せた状態で曲げ部以外がダイに当たると部品が浮く */
    if(seated && off>2.0) return {what:'ダイ',p:[0,0,0],off};
    return null;
  }

  /* ---------------- 画面 ---------------- */
  let raf=null, ctx=null, S=null;
  function stop(){ if(raf){cancelAnimationFrame(raf);raf=null;} }

  function render(main){
    stop();
    main.innerHTML=`
<div class="crumb"><a href="#/home">ホーム</a> › 3D曲げ工程シミュレーター</div>
<h1>🏭 3D曲げ工程シミュレーター</h1>
<p>プレスブレーキの3Dモデルの中で、板金部品を<b>1曲げずつ工程順に成形</b>します。曲げごとの持ち替え(位置と向きの変更)も再現し、パンチ・ダイとの干渉があれば部品が赤く表示されます。画面はドラッグで回転、ホイールで拡大縮小できます。</p>
<div class="sim3d-wrap">
  <div class="sim3d-stage card">
    <canvas id="s3canvas"></canvas>
    <div class="sim3d-hud" id="s3hud"></div>
    <div class="sim3d-msg" id="s3msg" hidden></div>
  </div>
  <div class="card sim3d-ctrl" id="s3ctrl"></div>
</div>
<div id="s3steps"></div>
<div class="callout tip"><b>この画面で見てほしいこと</b>曲げのたびに部品の持ち方が変わること、後の曲げほど部品が大きくなって金型に近づくこと、そして最後の曲げで製品がパンチを抱き込む形になることです。正確な展開長・荷重・干渉角度は <a href="#/sim">2D断面の曲げシミュレーター</a> で数値として確認できます。</div>`;

    const cv=document.getElementById('s3canvas');
    ctx=initGL(cv);
    if(!ctx){ document.getElementById('s3msg').hidden=false;
      document.getElementById('s3msg').textContent='このブラウザではWebGLが使えないため3D表示できません。2D断面のシミュレーターをご利用ください。'; return; }

    S={preset:'tray',T:1.6,V:10,R:1.67,toolLen:265,dieAng:88,rs:0.8,dieH:55,dieW:34,
       punchAng:88,punchW:26,punchH:115,goose:true,gd:4,gh:56,
       playing:true,speed:1,step:0,phase:0,tp:0,showTool:true,rev:false,
       az:-38,el:18,dist:540,drag:null};
    buildPart(); buildCtrl(); loop();

    cv.addEventListener('pointerdown',e=>{S.drag={x:e.clientX,y:e.clientY,az:S.az,el:S.el};cv.setPointerCapture(e.pointerId);});
    cv.addEventListener('pointermove',e=>{ if(!S.drag)return;
      S.az=S.drag.az+(e.clientX-S.drag.x)*0.4; S.el=clamp(S.drag.el+(e.clientY-S.drag.y)*0.3,-8,78); });
    cv.addEventListener('pointerup',()=>{S.drag=null;});
    cv.addEventListener('wheel',e=>{e.preventDefault();S.dist=clamp(S.dist*(1+e.deltaY*0.0012),160,1100);},{passive:false});
  }

  function buildPart(){
    const sp=PARTS[S.preset];
    S.T=sp.T; S.R=Math.max(0.8,S.V/6);
    S.root=buildTree(sp);
    S.bends=allBends(S.root);
    S.order=S.bends.map((b,i)=>i);
    if(S.rev) S.order.reverse();
    S.step=0; S.phase=0; S.tp=0;
  }

  function buildCtrl(){
    const c=document.getElementById('s3ctrl');
    c.innerHTML=`<h3 style="margin-top:0">部品と金型</h3>
<div class="calc-form">
<label>部品<select id="s3part">${Object.keys(PARTS).map(k=>`<option value="${k}" ${k===S.preset?'selected':''}>${PARTS[k].n}</option>`).join('')}</select></label>
<label>パンチ<select id="s3pun"><option value="1" ${S.goose?'selected':''}>グースネック</option><option value="0" ${!S.goose?'selected':''}>標準(ストレート)</option></select></label>
<label>V幅 (mm)<input id="s3v" type="number" step="1" min="4" value="${S.V}"></label>
<label>曲げ順<select id="s3rev"><option value="0" ${!S.rev?'selected':''}>1番目から順に</option><option value="1" ${S.rev?'selected':''}>最後から逆に</option></select></label>
</div>
<h3>再生</h3>
<div class="calc-form">
<label>速度<input id="s3sp" type="range" min="0.3" max="2.5" step="0.1" value="${S.speed}"></label>
<label>金型の表示<select id="s3tool"><option value="1" ${S.showTool?'selected':''}>表示する</option><option value="0" ${!S.showTool?'selected':''}>部品だけ</option></select></label>
</div>
<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
<button class="btn small" id="s3play">${S.playing?'⏸ 停止':'▶ 再生'}</button>
<button class="btn small secondary" id="s3prev">‹ 前の曲げ</button>
<button class="btn small secondary" id="s3next">次の曲げ ›</button>
<button class="btn small secondary" id="s3reset">最初から</button>
<button class="btn small secondary" id="s3view">視点を戻す</button>
</div>
<p style="font-size:.8rem;color:var(--muted);margin:.7em 0 0">板厚と曲げ数は部品ごとに決まっています。曲げ内Rは V幅÷6 で近似しています。</p>`;
    const on=(id,ev,fn)=>document.getElementById(id).addEventListener(ev,fn);
    on('s3part','change',e=>{S.preset=e.target.value;buildPart();});
    on('s3pun','change',e=>{S.goose=e.target.value==='1';});
    on('s3v','input',e=>{S.V=Math.max(4,+e.target.value||10);S.R=Math.max(0.8,S.V/6);});
    on('s3rev','change',e=>{S.rev=e.target.value==='1';buildPart();});
    on('s3sp','input',e=>{S.speed=+e.target.value;});
    on('s3tool','change',e=>{S.showTool=e.target.value==='1';});
    on('s3play','click',()=>{S.playing=!S.playing;document.getElementById('s3play').textContent=S.playing?'⏸ 停止':'▶ 再生';});
    on('s3prev','click',()=>{S.step=Math.max(0,S.step-1);S.phase=0;S.tp=0;});
    on('s3next','click',()=>{S.step=Math.min(S.order.length-1,S.step+1);S.phase=0;S.tp=0;});
    on('s3reset','click',()=>{S.step=0;S.phase=0;S.tp=0;});
    on('s3view','click',()=>{S.az=-38;S.el=18;S.dist=540;});
  }

  const PH=[1.25,0.5,1.15,0.3,0.5];   // 持ち替え/下降/成形/保持/上昇

  function stateNow(){
    const k=S.order[S.step], b=S.bends[k];
    const th=Math.abs(b.ang);
    let theta=0, ramPark=false, u=S.tp;
    if(S.phase===0){theta=0;ramPark=true;}
    else if(S.phase===1){theta=0;ramPark=false;}
    else if(S.phase===2){theta=th*u;}
    else if(S.phase===3){theta=th;}
    else {theta=th;ramPark=true;}
    return {k,b,th,theta,ramPark,u};
  }

  function loop(){
    const cv=document.getElementById('s3canvas');
    if(!cv){stop();return;}
    let last=performance.now();
    const frame=now=>{
      const dt=Math.min(0.05,(now-last)/1000); last=now;
      if(S.playing){
        S.tp+=dt*S.speed/PH[S.phase];
        while(S.tp>=1){ S.tp-=1; S.phase++;
          if(S.phase>=PH.length){ S.phase=0; S.step=(S.step+1)%S.order.length; } }
      }
      draw(cv);
      raf=requestAnimationFrame(frame);
    };
    raf=requestAnimationFrame(frame);
  }

  function draw(cv){
    const dpr=Math.min(2,window.devicePixelRatio||1);
    const w=cv.clientWidth||700, h=cv.clientHeight||440;
    if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
    ctx.gl.viewport(0,0,cv.width,cv.height);

    const st=stateNow();
    const angles={};
    S.order.forEach((bi,i)=>{ if(i<S.step) angles[S.bends[bi].bid]=S.bends[bi].ang; });
    const kb=st.b;
    angles[kb.bid]=st.theta*Math.sign(kb.ang);

    let GG, off=0, punchTip=S.T, pm;
    if(S.phase===0 && S.step>0){
      const pb=S.bends[S.order[S.step-1]];
      const A=toQT(seatPart(S,S.root,angles,pb,Math.abs(pb.ang)).G);
      const B=toQT(seatPart(S,S.root,angles,kb,0).G);
      const u=S.tp, bow=Math.sin(Math.PI*u);
      GG=fromQT(slerp(A.q,B.q,u),
        [A.t[0]+(B.t[0]-A.t[0])*u, A.t[1]+(B.t[1]-A.t[1])*u+bow*10, A.t[2]+(B.t[2]-A.t[2])*u+bow*55]);
      poseTree(S.root,angles,S.T,S.R,GG);
      pm=new Mesh(); partMesh(pm,S.root,S.T,S.R,COL.part);
      // 持ち替え中はダイ上面より確実に上へ浮かせる
      let lo=1e9; for(let i=0;i<pm.p.length;i+=3) lo=Math.min(lo,pm.p[i+1]);
      const up=Math.max(0,2.5-lo);
      if(up>0) for(let i=0;i<pm.p.length;i+=3) pm.p[i+1]+=up;
    } else {
      const r=seatPart(S,S.root,angles,kb,st.theta);
      GG=r.G; off=r.off; punchTip=r.punchTip; pm=r.mesh;
    }

    // ラムの退避位置は部品の高さより上に取り、持ち替えで金型に当たらないようにする
    let hi=-1e9; for(let i=0;i<pm.p.length;i+=3) hi=Math.max(hi,pm.p[i+1]);
    const park=Math.max(S.T+S.V*2.8, hi+20);
    let py=punchTip;
    if(S.phase===0) py=park;
    else if(S.phase===1) py=park+(punchTip-park)*S.tp;
    else if(S.phase===4) py=punchTip+(park-punchTip)*S.tp;

    const pLen=Math.min(S.toolLen,(kb.rect[2]-kb.rect[0])+6);
    const hit=S.showTool?checkHit(S,pm.p,py,off,S.phase!==0,pLen):null;
    if(hit){ for(let i=0;i<pm.c.length;i+=3){pm.c[i]=COL.hit[0];pm.c[i+1]=COL.hit[1];pm.c[i+2]=COL.hit[2];} }
    const mm=machineMesh(S,py,S.showTool,pLen);
    const all=new Mesh();
    all.p=mm.p.concat(pm.p); all.n=mm.n.concat(pm.n); all.c=mm.c.concat(pm.c);

    const ar=cv.width/cv.height;
    const a=rad(S.az), e=rad(S.el);
    const eye=[Math.sin(a)*Math.cos(e)*S.dist, Math.sin(e)*S.dist+40, Math.cos(a)*Math.cos(e)*S.dist];
    const vp=M4.mul(M4.persp(rad(34),ar,5,3000),M4.lookAt(eye,[0,26,0],[0,1,0]));
    const cs=getComputedStyle(document.body).backgroundColor.match(/\d+/g)||[245,246,248];
    drawMesh(ctx,all,vp,[cs[0]/255,cs[1]/255,cs[2]/255]);

    const names=['持ち替え(位置と向きを変更)','パンチ下降','成形中','保持','ラム上昇'];
    document.getElementById('s3hud').innerHTML=
      `<b>工程 ${S.step+1} / ${S.order.length}</b> — 曲げ${st.k+1}(${Math.abs(kb.ang)}°)<br>
       <span class="ph">${names[S.phase]}</span> ・ 曲げ角度 ${f(st.theta,0)}° ・ パンチ長さ ${f(pLen,0)}mm
       ${hit?`<br><span class="hit">✕ ${hit.what}と干渉</span>`:''}`;
    const steps=S.order.map((bi,i)=>{
      const b=S.bends[bi];
      return `<tr class="${i===S.step?'cur':''}"><td>${i+1}</td><td>曲げ${bi+1}</td><td>${Math.abs(b.ang)}°</td>
        <td>${b.parent&&b.parent.parent?'2段目(返り)':'1段目'}</td><td>${i<S.step?'完了':i===S.step?'加工中':'未加工'}</td></tr>`;}).join('');
    const el=document.getElementById('s3steps');
    if(el&&el.dataset.k!==S.order.join(',')+S.step){ el.dataset.k=S.order.join(',')+S.step;
      el.innerHTML=`<h2>曲げ工程</h2><div class="table-wrap"><table class="s3tbl"><tr><th>工程</th><th>曲げ</th><th>角度</th><th>種別</th><th>状態</th></tr>${steps}</table></div>`; }
  }

  window.SM_SIM3D={render,stop};
})();
