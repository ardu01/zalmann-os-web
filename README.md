# Zalmann OS

Página pública de presentación de Zalmann OS.

Sitio publicado, solo desde `main`: https://ardu01.github.io/zalmann-os-web/

El catálogo de proyectos está en https://ardu01.github.io/proyectos/#zalmann-os.

El repositorio de la aplicación no es público y no se enlaza desde aquí. No hay ISO ni descarga.

## Procedencia

`assets/autor/` son cuatro capturas reales facilitadas por el autor, copiadas byte a byte: el escritorio, la tienda, Ajustes del Sistema y el lanzador. La página las muestra y no redistribuye el fondo ni el tema de esa instalación. No se etiquetan como la demostración aislada. El texto no transcribe los datos de equipo de Ajustes ni los convierte en requisitos. Los iconos del lanzador no se dan por probados.

`assets/demo/` son los bytes originales de una ejecución en una sesión X11 aislada (cuenta Demo, tema alternativo WhiteSur-Light, fondo generado). No equivalen a las capturas del autor. No se recomprimen ni se retoca la interfaz.

Los SHA-256 viven en `tests/check_site.py`.

GitHub Pages construye el sitio desde la rama `main`. Una rama de revisión no publica la página. Fusionar con `main` sí la publica.

Comprobar la página:

```bash
python3 tests/check_site.py
node tests/browser_check.mjs
```
