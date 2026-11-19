#!/bin/sh
# Re-render: sh render.sh  (Edge headless desde file://)
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
D="$(pwd -W)"
shot() { # nombre url
  "$EDGE" --headless=new --hide-scrollbars --force-prefers-reduced-motion --window-size=1440,900 --screenshot="$D/previews/$1-desktop.png" "file:///$D/$2" >/dev/null 2>&1
  printf '<!doctype html><body style="margin:0"><iframe src="file:///%s/%s" style="border:0;width:390px;height:844px"></iframe>' "$D" "$2" > "$D/_m.html"
  "$EDGE" --headless=new --hide-scrollbars --force-prefers-reduced-motion --window-size=390,844 --screenshot="$D/previews/$1-mobile.png" "file:///$D/_m.html" >/dev/null 2>&1
}
for e in cargando-estado conexion-estado recarga-aprobado recarga-rechazado pendiente pendiente-aprobado pendiente-rechazado pendiente-a-devolver demorando; do shot "pago-$e" "pago-pedido.html?estado=$e"; done
for p in sin-intentos en-confirmacion aprobado rechazado a-devolver; do shot "confirmacion-$p" "pedido-creado-pago.html?pago=$p"; done
rm -f "$D/_m.html"
