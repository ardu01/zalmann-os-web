# Zalmann OS

Página pública de presentación de Zalmann OS.

Sitio publicado, solo desde `main`: https://ardu01.github.io/zalmann-os-web/

El catálogo de proyectos está en https://ardu01.github.io/proyectos/#zalmann-os.

El repositorio de la aplicación no es público y no se enlaza desde aquí. No hay ISO ni descarga.

## Procedencia

`assets/autor/` son las cuatro capturas reales facilitadas por el autor, copiadas byte a byte: el escritorio, la tienda, Ajustes del Sistema y el lanzador. No hay otras imágenes. La página no redistribuye el fondo ni el tema de esa instalación, no transcribe los datos de equipo de Ajustes y no da por probados los iconos del lanzador.

Los SHA-256 viven en `tests/check_site.py`.

GitHub Pages construye el sitio desde la rama `main`. Una rama de revisión no publica la página. Fusionar con `main` sí la publica.

Comprobar la página:

```bash
python3 tests/check_site.py
node tests/browser_check.mjs
```
