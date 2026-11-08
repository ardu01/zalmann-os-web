# Zalmann OS

Página pública de presentación de Zalmann OS.

Sitio publicado, solo desde `main`: https://ardu01.github.io/zalmann-os-web/

El catálogo de proyectos está en https://ardu01.github.io/proyectos/#zalmann-os.

El repositorio de la aplicación no es público y no se enlaza desde aquí. No hay ISO ni descarga.

Las imágenes de `assets/demo/` son los bytes originales de una ejecución real en una sesión X11 aislada (cuenta Demo, tema alternativo WhiteSur-Light, fondo generado). No son la instalación de Miguel ni el aspecto final. No se recomprimen ni se retoca la interfaz.

GitHub Pages construye el sitio desde la rama `main`. Una rama de revisión no publica la página. Fusionar con `main` sí la publica.

Comprobar la página:

```bash
python3 tests/check_site.py
node tests/browser_check.mjs
```
