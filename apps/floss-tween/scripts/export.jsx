// Floss Tween: vuelca la comp "base" (id 1) de "Flos log v7 empujes.aep" a
// fixtures/export-base.json, crudo (valores sin expresión, keys con ease y textos de las
// expresiones). export.mjs lo convierte en src/geometria-floss.json.
// ExtendScript es ES3: sin JSON nativo, por eso el serializador de abajo.
(function(){
var OUT = File($.fileName).parent.parent.fsName + "/fixtures/";

function q(s){ return '"' + String(s).replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\r\n|\r|\n/g,"\\n").replace(/\t/g,"\\t") + '"'; }
function J(v){
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return isFinite(v) ? String(Math.round(v*1e5)/1e5) : "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") return q(v);
  if (v instanceof Array){ var a=[]; for (var i=0;i<v.length;i++) a.push(J(v[i])); return "["+a.join(",")+"]"; }
  var o=[]; for (var k in v) if (v.hasOwnProperty(k)) o.push(q(k)+":"+J(v[k])); return "{"+o.join(",")+"}";
}
function shp(s){ return { v: s.vertices, i: s.inTangents, o: s.outTangents, c: s.closed }; }
function val(p, t, pre){
  var v = p.valueAtTime(t, pre);
  if (p.propertyValueType == PropertyValueType.SHAPE) return shp(v);
  if (p.propertyValueType == PropertyValueType.TEXT_DOCUMENT){
    var d = { text: v.text };
    try { d.font = v.font; d.fontSize = v.fontSize; d.fillColor = v.fillColor; d.tracking = v.tracking; d.justification = String(v.justification); d.applyFill = v.applyFill; } catch(e){}
    return d;
  }
  return v;
}
// Propiedad: valor crudo en t=0, expresión y keys (con ease temporal de la primera dimensión).
function P(p){
  if (!p) return null;
  var r = { v: val(p, 0, true) };
  if (p.canSetExpression && p.expression !== ""){ r.e = p.expression; r.eOn = p.expressionEnabled; r.ve = val(p, 0, false); }
  if (p.numKeys > 0){
    r.k = [];
    for (var k=1;k<=p.numKeys;k++){
      var ki = p.keyInTemporalEase(k)[0], ko = p.keyOutTemporalEase(k)[0];
      r.k.push({ t: p.keyTime(k), v: (p.propertyValueType == PropertyValueType.SHAPE ? shp(p.keyValue(k)) : p.keyValue(k)),
        iI: ki.influence, iS: ki.speed, oI: ko.influence, oS: ko.speed,
        iT: p.keyInInterpolationType(k) == KeyframeInterpolationType.HOLD ? "H" : "B" });
    }
  }
  return r;
}
function sub(g, mn){ try { return g.property(mn); } catch(e){ return null; } }
function xform(t){
  if (!t) return null;
  return { anchor: P(sub(t,"ADBE Vector Anchor")), pos: P(sub(t,"ADBE Vector Position")), scale: P(sub(t,"ADBE Vector Scale")),
    rot: P(sub(t,"ADBE Vector Rotation")), opacity: P(sub(t,"ADBE Vector Group Opacity")) };
}
function contents(g){
  var out = [];
  for (var i=1;i<=g.numProperties;i++){
    var p = g.property(i), mn = p.matchName, it = { mn: mn, name: p.name, enabled: p.enabled };
    if (mn == "ADBE Vector Group"){ it.items = contents(sub(p,"ADBE Vectors Group")); it.xf = xform(sub(p,"ADBE Vector Transform Group")); }
    else if (mn == "ADBE Vector Shape - Group"){ it.path = P(sub(p,"ADBE Vector Shape")); }
    else if (mn == "ADBE Vector Shape - Rect"){ it.size = P(sub(p,"ADBE Vector Rect Size")); it.pos = P(sub(p,"ADBE Vector Rect Position")); it.round = P(sub(p,"ADBE Vector Rect Roundness")); }
    else if (mn == "ADBE Vector Shape - Ellipse"){ it.size = P(sub(p,"ADBE Vector Ellipse Size")); it.pos = P(sub(p,"ADBE Vector Ellipse Position")); }
    else if (mn == "ADBE Vector Graphic - Stroke"){
      it.color = P(sub(p,"ADBE Vector Stroke Color")); it.width = P(sub(p,"ADBE Vector Stroke Width")); it.opacity = P(sub(p,"ADBE Vector Stroke Opacity"));
      it.cap = P(sub(p,"ADBE Vector Stroke Line Cap")); it.join = P(sub(p,"ADBE Vector Stroke Line Join"));
      var D = sub(p,"ADBE Vector Stroke Dashes");
      if (D && D.numProperties > 0){ it.dashes = []; for (var d=1; d<=D.numProperties; d++){ var dp=D.property(d); it.dashes.push({ mn: dp.matchName, p: P(dp) }); } }
    }
    else if (mn == "ADBE Vector Graphic - Fill"){ it.color = P(sub(p,"ADBE Vector Fill Color")); it.opacity = P(sub(p,"ADBE Vector Fill Opacity")); }
    else if (mn == "ADBE Vector Filter - Trim"){ it.start = P(sub(p,"ADBE Vector Trim Start")); it.end = P(sub(p,"ADBE Vector Trim End")); it.offset = P(sub(p,"ADBE Vector Trim Offset")); }
    out.push(it);
  }
  return out;
}
function layerXf(ly){
  var t = ly.property("ADBE Transform Group"), pos = t.property("ADBE Position"), r = {};
  r.anchor = P(t.property("ADBE Anchor Point"));
  if (pos.dimensionsSeparated){ r.x = P(t.property("ADBE Position_0")); r.y = P(t.property("ADBE Position_1")); }
  else r.pos = P(pos);
  r.scale = P(t.property("ADBE Scale")); r.rot = P(t.property("ADBE Rotate Z")); r.opacity = P(t.property("ADBE Opacity"));
  return r;
}
try {
  var base = app.project.itemByID(1);
  var res = { comp: { id: base.id, name: base.name, width: base.width, height: base.height, fps: base.frameRate }, layers: [] };
  for (var l=1;l<=base.numLayers;l++){
    var ly = base.layer(l);
    var L = { index: l, id: ly.id, name: ly.name, enabled: ly.enabled, parent: ly.parent ? ly.parent.index : null,
      inPoint: ly.inPoint, outPoint: ly.outPoint, kind: ly.nullLayer ? "null" : (ly instanceof ShapeLayer ? "shape" : (ly instanceof TextLayer ? "text" : "other")),
      xf: layerXf(ly) };
    if (L.kind == "shape") L.items = contents(ly.property("ADBE Root Vectors Group"));
    if (L.kind == "text") L.text = P(ly.property("ADBE Text Properties").property("ADBE Text Document"));
    if (L.kind == "null"){ var fx = ly.property("ADBE Effect Parade"); L.fx = []; for (var e=1;e<=fx.numProperties;e++) L.fx.push({ name: fx.property(e).name, p: P(fx.property(e).property(1)) }); }
    res.layers.push(L);
  }
  var f = new File(OUT + "export-base.json"); f.encoding = "UTF-8"; f.lineFeed = "Unix"; f.open("w"); f.write(J(res)); f.close();
} catch(e){
  var fe = new File(OUT + "export-err.txt"); fe.open("w"); fe.write(e.message + " line " + String(e.line)); fe.close();
}
})();
