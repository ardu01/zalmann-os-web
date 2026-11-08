# Zalmann OS | Official Website

**Sitio web oficial de Zalmann OS, un proyecto de entorno de escritorio Linux desarrollado por Ardu Solutions.**

[![Website](https://img.shields.io/badge/Website-Online-16A34A?style=flat-square)](https://ardu01.github.io/zalmann-os-web/)
![HTML5](https://img.shields.io/badge/HTML5-Web-E34F26?style=flat-square&logo=html5&logoColor=white)
![GitHub Pages](https://img.shields.io/badge/Hosting-GitHub_Pages-222222?style=flat-square&logo=github)
![Status](https://img.shields.io/badge/Status-Active-2563EB?style=flat-square)

---

## Descripción

**Zalmann OS Web** es la página oficial de presentación del proyecto Zalmann OS.

Su objetivo es ofrecer un espacio público donde conocer el sistema, su filosofía de diseño y su evolución.

Zalmann OS es un entorno de escritorio desarrollado sobre Ubuntu y XFCE que incorpora componentes personalizados, herramientas propias y una experiencia visual inspirada en macOS.

Esta web forma parte del ecosistema tecnológico de **Ardu Solutions**.

**Desarrollador:** Miguel Rodríguez Saiz  
**Organización:** Ardu Solutions  
**Categoría:** Desarrollo Web / Presentación de Producto  
**Publicación:** GitHub Pages

## Acceder a la web

**[Visitar la web oficial de Zalmann OS](https://ardu01.github.io/zalmann-os-web/)**

El catálogo de proyectos está en https://ardu01.github.io/proyectos/#zalmann-os.

El repositorio de la aplicación no es público y no se enlaza desde aquí. No hay ISO ni descarga. GitHub Pages publica solo la rama `main`.

## Tecnologías

| Tecnología | Función |
|---|---|
| HTML5 | Estructura del sitio |
| GitHub Pages | Alojamiento y publicación |
| Git | Control de versiones |
| GitHub | Gestión del repositorio |

## Estructura del repositorio

```text
zalmann-os-web/
│
├── assets/autor/
├── tests/
├── index.html
├── README.md
└── .nojekyll
```

El archivo `index.html` contiene la página principal y `.nojekyll` evita el procesamiento automático mediante Jekyll.

`assets/autor/` son las cuatro capturas reales facilitadas por el autor, copiadas byte a byte: el escritorio, la tienda, Ajustes del Sistema y el lanzador. No hay otras imágenes. La página no redistribuye el fondo ni el tema de esa instalación, no transcribe los datos de equipo de Ajustes y no da por probados los iconos del lanzador. Los SHA-256 viven en `tests/check_site.py`.

## Ejecución local

Clonar el repositorio:

```bash
git clone https://github.com/ardu01/zalmann-os-web.git
cd zalmann-os-web
```

Abrir `index.html` en un navegador o utilizar un servidor HTTP local:

```bash
python3 -m http.server 8000
```

Acceder a `http://localhost:8000`.

Comprobar la página:

```bash
python3 tests/check_site.py
node tests/browser_check.mjs
```

## Proyecto principal

Esta web presenta **Zalmann OS**, un proyecto de escritorio Linux en desarrollo experimental.

La página web y el entorno de escritorio son proyectos independientes: este repositorio contiene únicamente el sitio de presentación.

Para consultar otros desarrollos relacionados, visitar el portfolio de Ardu Solutions.

## Autor

**Miguel Rodríguez Saiz**

Diseño y desarrollo del proyecto.

**Ardu Solutions** — Desarrollo de software, sistemas y soluciones tecnológicas.

- **Web oficial:** https://ardu01.github.io/zalmann-os-web/
- **Portfolio:** https://ardu01.github.io/proyectos/
- **Ardu Solutions:** https://ardusolutions.pages.dev/
- **GitHub:** https://github.com/ardu01

## Licencia

Este repositorio no declara actualmente una licencia de software.

La publicación del código no implica automáticamente autorización para su modificación, redistribución o explotación comercial.

---

**© 2026 Miguel Rodríguez Saiz · Ardu Solutions**

*Zalmann OS — A new desktop experience, built on Linux.*
