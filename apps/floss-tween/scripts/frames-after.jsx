// Guarda cuadros de la comp "Floss Logo 1920x1080" (id 312) en fixtures/frames/after-<t>.png
// para compararlos con el render del motor (scripts/verificar.mjs). Tiempos en TIEMPOS.
(function(){
var DIR = File($.fileName).parent.parent.fsName + "/fixtures/frames/";
try {
  new Folder(DIR).create();
  var c = app.project.itemByID(312);
  var T = (typeof TIEMPOS !== "undefined") ? TIEMPOS : [0];
  for (var i=0;i<T.length;i++) c.saveFrameToPng(T[i], new File(DIR + "after-" + T[i].toFixed(3) + ".png"));
} catch(e){ var fe = new File(DIR + "err.txt"); fe.open("w"); fe.write(e.message + " line " + String(e.line)); fe.close(); }
})();
