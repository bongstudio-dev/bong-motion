(function(){
var OUT = File($.fileName).parent.parent.fsName + "/fixtures/";
var L = [], P = [];
function w(s){ L.push(s); }
function sv(v){
  if (v === null || v === undefined) return "null";
  if (v instanceof Array){ var a=[]; for (var i=0;i<v.length;i++) a.push(sv(v[i])); return "["+a.join(",")+"]"; }
  if (typeof v === "number") return String(Math.round(v*10000)/10000);
  if (typeof v === "object" && v.vertices){ return "<shape "+v.vertices.length+"pts closed="+v.closed+">"; }
  return String(v);
}
function shapeFull(v){
  return "V="+sv(v.vertices)+" I="+sv(v.inTangents)+" O="+sv(v.outTangents)+" closed="+v.closed;
}
function interp(t){ return t==KeyframeInterpolationType.BEZIER?"B":t==KeyframeInterpolationType.LINEAR?"L":"H"; }
function eases(arr){ var a=[]; for (var i=0;i<arr.length;i++) a.push(sv(arr[i].speed)+"/"+sv(arr[i].influence)); return a.join(";"); }
function walk(g, path, depth, layerName){
  for (var i=1;i<=g.numProperties;i++){
    var p = g.property(i);
    var nm = path+" > "+p.name;
    if (p.propertyType == PropertyType.PROPERTY){
      if (p.propertyValueType == PropertyValueType.NO_VALUE) continue;
      var hasExpr = p.canSetExpression && p.expression !== "";
      var isEffect = path.indexOf("Effects")>=0;
      var v; try { v = p.value; } catch(e){ v = "?"; }
      if (p.propertyValueType == PropertyValueType.SHAPE){
        P.push(layerName+" | "+nm+" | "+(p.numKeys>0?"KEYS "+p.numKeys:"static")+(hasExpr?" EXPR":""));
        if (p.numKeys>0){ for (var k=1;k<=p.numKeys;k++) P.push("  k"+k+" t="+sv(p.keyTime(k))+" "+shapeFull(p.keyValue(k))); }
        else P.push("  "+shapeFull(v));
      }
      if (p.numKeys>0 || hasExpr || isEffect){
        w("  "+nm+" = "+sv(v)+(hasExpr?"  [expr "+(p.expressionEnabled?"on":"OFF")+"]":""));
        if (hasExpr) w("    EXPR: "+p.expression.replace(/\r\n|\r|\n/g," ⏎ "));
        for (var k=1;k<=p.numKeys;k++){
          var line = "    k"+k+" t="+sv(p.keyTime(k))+" v="+sv(p.keyValue(k))+" in="+interp(p.keyInInterpolationType(k))+" out="+interp(p.keyOutInterpolationType(k));
          try { line += " easeIn="+eases(p.keyInTemporalEase(k))+" easeOut="+eases(p.keyOutTemporalEase(k)); } catch(e){}
          try { if (p.isSpatial) line += " spIn="+sv(p.keyInSpatialTangent(k))+" spOut="+sv(p.keyOutSpatialTangent(k)); } catch(e){}
          w(line);
        }
      }
    } else {
      walk(p, nm, depth+1, layerName);
    }
  }
}
try {
  w("PROJECT "+app.project.file.fsName);
  for (var c=1;c<=app.project.numItems;c++){
    var it = app.project.item(c);
    if (!(it instanceof CompItem)) { w("ITEM "+it.id+" "+it.name+" ("+it.typeName+")"+(it.file?" file="+it.file.fsName:"")); continue; }
    w("");
    w("=== COMP id="+it.id+" '"+it.name+"' "+it.width+"x"+it.height+" fps="+it.frameRate+" dur="+sv(it.duration)+" workArea="+sv(it.workAreaStart)+"+"+sv(it.workAreaDuration)+" bg="+sv(it.bgColor));
    for (var l=1;l<=it.numLayers;l++){
      var ly = it.layer(l);
      var kind = ly.nullLayer?"NULL":(ly instanceof ShapeLayer?"SHAPE":(ly instanceof AVLayer?("AV src="+(ly.source?ly.source.name+"#"+ly.source.id:"?")):"OTHER"));
      w("-- L"+l+" id="+ly.id+" '"+ly.name+"' "+kind+" parent="+(ly.parent?ly.parent.index:"-")+" in="+sv(ly.inPoint)+" out="+sv(ly.outPoint)+" enabled="+ly.enabled+(ly.hasTrackMatte?" matte="+ly.trackMatteType:"")+(ly.collapseTransformation?" collapse":"")+(ly.threeDLayer?" 3D":""));
      walk(ly, "", 0, it.name+" / "+ly.name);
    }
  }
  var f = new File(OUT+"rig.txt"); f.encoding="UTF-8"; f.lineFeed="Unix"; f.open("w"); f.write(L.join("\n")); f.close();
  var f2 = new File(OUT+"paths.txt"); f2.encoding="UTF-8"; f2.lineFeed="Unix"; f2.open("w"); f2.write(P.join("\n")); f2.close();
} catch(e){
  var fe = new File(OUT+"err.txt"); fe.open("w"); fe.write(e.message+" line "+String(e.line)); fe.close();
}
})();
