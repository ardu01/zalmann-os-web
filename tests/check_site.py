#!/usr/bin/env python3
"""Comprueba la página pública: bytes de las capturas, hechos y enlaces."""

from __future__ import annotations

import hashlib
import pathlib
import re
import struct
import sys
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
AUTOR = ROOT / "assets" / "autor"

# SHA-256 de los PNG originales. Cualquier recomprimido o retoque rompe la prueba.
AUTOR_FILES = {
    "escritorio.png": ("77a6fd2414db86c9fcee7822680004ba8b5cf29e3f4f721234def691dbff8d28", 1919, 1079),
    "tienda-acerca.png": ("439cc60db187980ef319f7c52e3c2cb6bf0c61ad82fdef04e25669fb027d651e", 1919, 1079),
    "ajustes-general.png": ("79f251efa3b975bc99b260666715fd6e666f6bfb1e1f66ad9b37990aef00612c", 913, 676),
    "lanzador.png": ("4c0b17d709fd010d33b2c9f2442b4aeefed764aa12dec99a7d42b76ecb600c4b", 1915, 985),
}

ALLOWED_URLS = {
    "https://ardu01.github.io/zalmann-os-web/",
    "https://ardu01.github.io/proyectos/",
    "https://ardu01.github.io/proyectos/#zalmann-os",
    "https://ardu01.github.io/proyectos/#sopa-ia",
    "https://ardu01.github.io/proyectos/#jerry",
    "https://schema.org",
}

REQUIRED = [
    "En desarrollo",
    "0.8.0",
    "6904271",
    "Ubuntu XFCE",
    "X11",
    "Python 3",
    "GTK 3",
    "Cairo",
    "xprop",
    "xdotool",
    "xrandr",
    "ImageMagick",
    "rofi",
    "MacTahoe-Light-solid",
    "picom",
    "unittest",
    "Waydroid",
    "PhotoCraft",
    "Documents",
    "No es un sistema operativo autónomo",
    "No hay imagen ISO ni descarga",
    "no es público",
    "Miguel Rodríguez Saiz",
    "prefers-color-scheme",
    "prefers-reduced-motion",
    "Saltar al contenido",
    "#zalmann-os",
    "#sopa-ia",
    "#jerry",
    "ArtCraft",
    "cristal en vivo",
    "«pronto»",
    "Captura real facilitada por el autor",
    "1919",
    "1079",
    "1 de 4",
    "Hay cuatro vistas",
    "Ajustes del sistema — captura real facilitada por el autor",
    "Lanzador de aplicaciones — captura real facilitada por el autor",
    "botón Abrir",
]

FORBIDDEN = [
    "github.com/ardu01/zalmann-os",
    ".iso",
    "benchmark",
    "fps",
    "Mbps",
    "/home/",
    "Descargar",
    "descargar",
    "garantizado",
    "con garantía",
    "no se ha recuperado",
    "diseño propio hasta",
    "500 GB",
    "500GB",
    "ARDU",
    "i5-6400",
    "Skylake",
    "980 GB",
    "588 GB",
    "6 h 15",
    "26.04",
    "2.70",
    "WhiteSur",
    "cuenta Demo",
    "Demostración",
    "fondo generado",
    "nota-demo",
    "assets/demo",
    "catorce",
    "1 de 14",
    "Obtener",
    "Flathub",
]


class Page(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.hrefs: list[str] = []
        self.srcs: list[str] = []
        self.alts: list[tuple[str, str | None]] = []
        self.ids: list[str] = []
        self.buttons = 0
        self.dialog = False
        self.skip = False
        self.lang = ""
        self.title = ""
        self._in_title = False
        self.imgs_without_dims = 0
        self.current_img: dict[str, str | None] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {key: value for key, value in attrs}
        if tag == "html":
            self.lang = data.get("lang") or ""
        elif tag == "a":
            href = data.get("href")
            if href:
                self.hrefs.append(href)
            if href == "#contenido":
                self.skip = True
        elif tag == "img":
            src = data.get("src") or ""
            self.srcs.append(src)
            self.alts.append((src, data.get("alt")))
            if not data.get("width") or not data.get("height"):
                self.imgs_without_dims += 1
        elif tag == "button":
            self.buttons += 1
        elif tag == "dialog":
            self.dialog = True
        elif tag == "title":
            self._in_title = True
        if data.get("id"):
            self.ids.append(data["id"])

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data


def png_size(path: pathlib.Path) -> tuple[int, int]:
    blob = path.read_bytes()
    if blob[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"{path.name} no es un PNG")
    length, kind = struct.unpack(">I4s", blob[8:16])
    if kind != b"IHDR" or length < 8:
        raise SystemExit(f"{path.name} no tiene IHDR")
    width, height = struct.unpack(">II", blob[16:24])
    return width, height


def main() -> int:
    errors: list[str] = []
    html = INDEX.read_text(encoding="utf-8")
    page = Page()
    page.feed(html)

    if page.lang != "es":
        errors.append(f"lang={page.lang!r}, se esperaba es")
    if "Zalmann OS" not in page.title:
        errors.append("el título no nombra Zalmann OS")
    if not page.skip:
        errors.append("falta el enlace de saltar al contenido")
    if not page.dialog:
        errors.append("falta el diálogo de la galería")
    if page.buttons != 7:
        errors.append(f"hay {page.buttons} botones; se esperan 4 vistas y los controles del visor")

    for needed in (
        "que-es",
        "recorrido",
        "arquitectura",
        "estado",
        "enlaces",
        "contenido",
        "visor",
        "escritorio",
        "tienda-autor",
        "ajustes-autor",
        "lanzador-autor",
    ):
        if needed not in page.ids:
            errors.append(f"falta el id #{needed}")

    for phrase in REQUIRED:
        if phrase not in html:
            errors.append(f"falta el texto contrastado: {phrase}")

    for phrase in FORBIDDEN:
        if phrase in html:
            errors.append(f"texto no permitido: {phrase}")

    if html.lower().count("en desarrollo") < 2:
        errors.append("el estado En desarrollo debe verse en el inicio y en la sección de estado")

    for href in page.hrefs:
        if href.startswith("#"):
            continue
        if href not in ALLOWED_URLS:
            errors.append(f"enlace no verificado: {href}")

    autor_srcs = [src for src in page.srcs if src.startswith("assets/autor/")]
    if re.search(r"jerry", html.replace("https://ardu01.github.io/proyectos/#jerry", "")):
        errors.append("el texto publica el nombre del equipo")

    if autor_srcs != [f"assets/autor/{name}" for name in AUTOR_FILES]:
        errors.append(f"las capturas del autor no van en orden: {autor_srcs}")
    if any(src.startswith("assets/demo/") for src in page.srcs):
        errors.append("sigue habiendo imágenes de la demostración")

    for src, alt in page.alts:
        if src.startswith("assets/autor/") and (alt is None or len(alt.strip()) < 20):
            errors.append(f"alt insuficiente en {src}")

    def figure_html(figure_id: str) -> str:
        start = html.index(f'id="{figure_id}"')
        return html[start:html.index("</figure>", start)]

    for figure_id in ("escritorio", "tienda-autor", "ajustes-autor", "lanzador-autor"):
        chunk = figure_html(figure_id)
        if "Captura real facilitada por el autor" not in chunk and "captura real facilitada por el autor" not in chunk:
            errors.append(f"#{figure_id} no declara la procedencia del autor")
        for banned in ("WhiteSur", "cuenta Demo", "picom", "Demostración", "ARDU", "jerry", "i5-6400", "26.04"):
            if banned in chunk:
                errors.append(f"#{figure_id} mezcla la captura del autor con datos que no van en el texto ({banned})")

    if page.imgs_without_dims:
        errors.append("hay imágenes sin width y height")

    external_assets = re.findall(r"(?:src|href)=[\"'](https?:[^\"']+)", html)
    for url in external_assets:
        if url not in ALLOWED_URLS and not url.startswith("data:"):
            errors.append(f"recurso externo no verificado: {url}")

    if re.search(r"<script[^>]+src=", html):
        errors.append("hay un script externo")
    if re.search(r"<link[^>]+stylesheet", html):
        errors.append("hay una hoja de estilo externa")

    if (ROOT / "assets" / "demo").exists():
        errors.append("assets/demo sigue en el sitio")
    seen_autor = {path.name for path in AUTOR.glob("*.png")}
    if seen_autor != set(AUTOR_FILES):
        errors.append(f"PNG inesperados en assets/autor: {sorted(seen_autor)}")

    for name, (digest, expect_w, expect_h) in AUTOR_FILES.items():
        path = AUTOR / name
        blob = path.read_bytes()
        found = hashlib.sha256(blob).hexdigest()
        if found != digest:
            errors.append(f"bytes alterados en {name}")
        width, height = png_size(path)
        if (width, height) != (expect_w, expect_h):
            errors.append(f"{name} mide {width}x{height}")
        if b"tEXt" in blob or b"iTXt" in blob or b"zTXt" in blob:
            errors.append(f"{name} incorpora metadatos de texto")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"ok: {len(AUTOR_FILES)} capturas reales, bytes intactos, sin demostración")
    return 0


if __name__ == "__main__":
    sys.exit(main())
