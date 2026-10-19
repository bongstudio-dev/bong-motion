(function(){
var OUT = File($.fileName).parent.parent.fsName + "/fixtures/";
var L=[]; function w(s){L.push(s);}
function sv(v){ if(v instanceof Array){var a=[];for(var i=0;i<v.length;i++)a.push(sv(v[i]));return "["+a.join(",")+"]";} if(typeof v==="number") return String(Math.round(v*10000)/10000); return String(v); }
function tr(ly){ try{ var t=ly.property("ADBE Transform Group"); var g=function(n){var p=t.property(n); return p?sv(p.valueAtTime(0,false)):"-";}; return ly.name+" anchor="+g("ADBE Anchor Point")+" pos="+g("ADBE Position")+" x="+g("ADBE Position_0")+" y="+g("ADBE Position_1")+" scale="+g("ADBE Scale")+" rot="+g("ADBE Rotate Z"); }catch(e){ return ly.name+" ERR "+e.message; } return ly.name+" anchor="+sv(t.anchorPoint.value)+" pos="+sv(t.position.value)+" scale="+sv(t.scale.value)+" rot="+sv(t.rotation.value)+" sep="+t.position.dimensionsSeparated; }
app.beginUndoGroup("tween sample");
try{
  var main=app.project.itemByID(312), base=app.project.itemByID(1);
  w("ENUM B="+KeyframeInterpolationType.BEZIER+" L="+KeyframeInterpolationType.LINEAR+" H="+KeyframeInterpolationType.HOLD);
  var Z=main.layer("CONTROL").effect("Zoom")(1);
  w("zoom k2 interp in/out = "+Z.keyInInterpolationType(2)+"/"+Z.keyOutInterpolationType(2));
  for (var i=1;i<=main.numLayers;i++) w("MAIN "+tr(main.layer(i)));
  w("BASE "+tr(base.layer("NULL CONTROL ")));
  w("BASE "+tr(base.layer("Floss logo")));
  // temp null with toComp of a few child-space points
  var nl=main.layers.addNull(); nl.name="__probe";
  var pts=[[0,0],[100,0],[0,100]];
  var ex='var B=thisComp.layer("base"); var c=comp("base").layer("NULL CONTROL "); var p=c.toComp([PX,PY]); B.toComp([p[0],p[1],0]);';
  var fps=main.frameRate, n=Math.ceil(12.4*fps);
  var cols=[];
  for (var j=0;j<pts.length;j++){
    nl.transform.position.expression = ex.replace("PX",pts[j][0]).replace("PY",pts[j][1]);
    var col=[]; for (var f=0;f<=n;f++){ var v=nl.transform.position.valueAtTime(f/fps,false); col.push(sv(v[0])+","+sv(v[1])); } cols.push(col);
  }
  var C=main.layer("CONTROL"), NC=main.layer("NULL CONTROL ");
  w("SAMPLES t,zoom,focoX,focoY,AF,AS1,AS2,ncScale,p00x,p00y,p100x,p100y,p0_100x,p0_100y");
  for (var f=0;f<=n;f++){ var t=f/fps;
    w(sv(t)+","+sv(C.effect("Zoom")(1).valueAtTime(t,false))+","+C.effect("Foco")(1).valueAtTime(t,false).toString()+","+sv(C.effect("Ajuste F")(1).valueAtTime(t,false))+","+sv(C.effect("Ajuste S1")(1).valueAtTime(t,false))+","+sv(C.effect("Ajuste S2")(1).valueAtTime(t,false))+","+sv(NC.transform.scale.valueAtTime(t,false)[0])+","+cols[0][f]+","+cols[1][f]+","+cols[2][f]);
  }
  nl.remove();
  var fo=new File(OUT+"after-samples.txt"); fo.encoding="UTF-8"; fo.lineFeed="Unix"; fo.open("w"); fo.write(L.join("\n")); fo.close();
}catch(e){ var fe=new File(OUT+"err.txt"); fe.open("w"); fe.write(e.message+" line "+String(e.line)); fe.close(); }
app.endUndoGroup();
})();
