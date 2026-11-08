#!/usr/bin/env node
// Recorre la página en Chrome: claro, oscuro, móvil y el visor con teclado.
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.env.SHOTS || "/tmp/zalmann-shots";
fs.mkdirSync(outDir, { recursive: true });

const types = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".js": "text/javascript",
  ".css": "text/css",
  ".md": "text/plain",
};

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      res.end("no");
      return;
    }
    res.writeHead(200, {
      "content-type": types[path.extname(file)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function launchChrome() {
  return new Promise((resolve, reject) => {
    const chrome = spawn("/usr/local/bin/google-chrome", [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--remote-debugging-port=0",
      "--user-data-dir=/tmp/zalmann-chrome-profile",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let buf = "";
    const timer = setTimeout(() => reject(new Error("Chrome no abrió el puerto de depuración")), 20000);
    const onData = (chunk) => {
      buf += chunk.toString();
      const match = buf.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
      if (match) {
        clearTimeout(timer);
        resolve({ chrome, port: match[1] });
      }
    };
    chrome.stderr.on("data", onData);
    chrome.stdout.on("data", onData);
    chrome.on("exit", (code) => reject(new Error(`Chrome salió con ${code}`)));
  });
}

async function openPage(port, url) {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!res.ok) throw new Error(`json/new ${res.status}`);
  return res.json();
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const waits = [];
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => {
      const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
        const msgId = ++id;
        pending.set(msgId, { res, rej });
        const payload = { id: msgId, method, params };
        if (sessionId) payload.sessionId = sessionId;
        ws.send(JSON.stringify(payload));
      });
      resolve({ ws, send, waitEvent });
    });
    ws.addEventListener("error", () => reject(new Error("WebSocket de Chrome")));
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
        return;
      }
      if (msg.method) {
        for (let i = waits.length - 1; i >= 0; i -= 1) {
          if (waits[i].method === msg.method) {
            const waiter = waits.splice(i, 1)[0];
            waiter.resolve(msg.params);
          }
        }
      }
    });
    function waitEvent(method, timeout = 8000) {
      return new Promise((resolveEvent, rejectEvent) => {
        const timer = setTimeout(() => rejectEvent(new Error(`timeout ${method}`)), timeout);
        waits.push({
          method,
          resolve: (params) => {
            clearTimeout(timer);
            resolveEvent(params);
          },
        });
      });
    }
  });
}

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "excepción en la página");
  }
  return result.result.value;
}

async function prepare(send, { width, height, mobile, scheme }) {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: scheme }],
  });
  await send("Page.navigate", { url: pageUrl });
  await evaluate(send, "document.fonts.ready.then(() => true)");
  const broken = await evaluate(send, `Promise.all([...document.images].filter((img) => !img.src.startsWith("data:")).map((img) => new Promise((resolve) => {
    const done = () => resolve(img.naturalWidth > 0 ? true : img.currentSrc || img.src);
    if (img.complete && img.naturalWidth > 0) { done(); return; }
    img.loading = "eager";
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
    const src = img.getAttribute("src");
    img.removeAttribute("src");
    img.setAttribute("src", src);
  }))).then((items) => items.filter((item) => item !== true))`);
  if (broken.length) throw new Error(`imágenes rotas: ${broken.join(", ")}`);
}

async function shootHero(send, name, width, mobile) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 1500,
    deviceScaleFactor: 1,
    mobile,
  });
  await evaluate(send, "window.scrollTo(0, 0)");
  const bottom = await evaluate(send, "Math.ceil(document.getElementById('escritorio').getBoundingClientRect().bottom + window.scrollY + 36)");
  const height = Math.min(Math.max(bottom, mobile ? 844 : 980), 1600);
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  await evaluate(send, "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  const framed = await evaluate(send, `(() => {
    const img = document.querySelector("#escritorio img");
    const rect = img.getBoundingClientRect();
    const title = document.querySelector("h1").getBoundingClientRect();
    const ratio = rect.width / rect.height;
    return {
      full: rect.top >= 0 && rect.bottom <= window.innerHeight + 1 && rect.width > 240,
      ratio: Math.abs(ratio - (1919 / 1079)) < 0.03,
      overlap: !(rect.bottom < title.top || rect.top > title.bottom),
      natural: img.naturalWidth,
    };
  })()`);
  check(framed.full && framed.ratio && !framed.overlap && framed.natural === 1919, `${name} no muestra el escritorio entero y sin deformar (${JSON.stringify(framed)})`);
  await shoot(send, name);
}

async function shoot(send, name) {
  const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const file = path.join(outDir, name);
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  return file;
}

async function shootFull(send, name, width, mobile) {
  const height = await fullHeight(send);
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: Math.min(height, 12000),
    deviceScaleFactor: 1,
    mobile,
  });
  await evaluate(send, "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  return shoot(send, name);
}

async function fullHeight(send) {
  return evaluate(send, "Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)");
}

const failures = [];
function check(cond, message) {
  if (!cond) failures.push(message);
}

const server = await serve();
const pageUrl = `http://127.0.0.1:${server.address().port}/`;
fs.rmSync("/tmp/zalmann-chrome-profile", { recursive: true, force: true });
const { chrome, port } = await launchChrome();

try {
  const target = await openPage(port, pageUrl);
  const { send } = await connect(target.webSocketDebuggerUrl);

  await prepare(send, { width: 1440, height: 900, mobile: false, scheme: "light" });
  const lightText = await evaluate(send, "document.body.innerText");
  check(lightText.includes("En desarrollo"), "el texto visible no incluye En desarrollo");
  check(lightText.includes("Demostración"), "el texto visible no incluye Demostración");
  check(!lightText.includes("github.com/ardu01/zalmann-os"), "el texto visible enlaza el repositorio no verificado");
  check(lightText.includes("Captura real facilitada por el autor"), "falta la procedencia del autor");
  check(!lightText.includes("no se ha recuperado"), "sigue el aviso de captura pendiente");
  check(!/ARDU|i5-6400|26\.04|980 GB|jerry/.test(lightText), "el texto visible publica datos del equipo");
  const bg = await evaluate(send, "getComputedStyle(document.body).backgroundColor");
  check(bg === "rgb(243, 240, 232)", `fondo claro inesperado: ${bg}`);
  await shootHero(send, "desktop_claro_hero.png", 1440, false);
  await shootFull(send, "desktop_claro_completo.png", 1440, false);
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const realTop = await evaluate(send, "document.getElementById('tienda-autor').getBoundingClientRect().top + window.scrollY");
  await evaluate(send, `window.scrollTo(0, ${Math.max(0, Math.round(realTop) - 80)})`);
  await shoot(send, "desktop_claro_autor_tienda.png");
  const ajustesTop = await evaluate(send, "document.getElementById('ajustes-autor').getBoundingClientRect().top + window.scrollY");
  await evaluate(send, `window.scrollTo(0, ${Math.max(0, Math.round(ajustesTop) - 90)})`);
  await shoot(send, "desktop_claro_autor_ajustes.png");
  const dockTop = await evaluate(send, "document.querySelector('#dock').getBoundingClientRect().top + window.scrollY");
  await evaluate(send, `window.scrollTo(0, ${Math.max(0, Math.round(dockTop) - 90)})`);
  await shoot(send, "desktop_claro_galeria.png");
  for (const id of ["teclado", "app-store", "enlaces"]) {
    const top = await evaluate(send, `document.getElementById(${JSON.stringify(id)}).getBoundingClientRect().top + window.scrollY`);
    await evaluate(send, `window.scrollTo(0, ${Math.max(0, Math.round(top) - 90)})`);
    await evaluate(send, "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    await shoot(send, `desktop_claro_${id}.png`);
  }

  await evaluate(send, "document.querySelector('#dock .shot').focus()");
  const focused = await evaluate(send, "document.activeElement.className");
  check(focused === "shot", `el foco no llegó al dock: ${focused}`);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: "\r" });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await new Promise((r) => setTimeout(r, 150));
  const open1 = await evaluate(send, "document.getElementById('visor').open");
  const title1 = await evaluate(send, "document.getElementById('visor-titulo').textContent");
  check(open1 === true, "Enter no abrió el visor");
  check(title1 === "Dock con ampliación", `título inicial: ${title1}`);
  await evaluate(send, "window.scrollTo(0, 0)");
  await shoot(send, "desktop_claro_visor.png");

  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
  const title2 = await evaluate(send, "document.getElementById('visor-titulo').textContent");
  check(title2 === "Menú de la manzana", `la flecha derecha no avanzó: ${title2}`);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 });
  const title3 = await evaluate(send, "document.getElementById('visor-titulo').textContent");
  check(title3 === "Dock con ampliación", `la flecha izquierda no retrocedió: ${title3}`);

  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await new Promise((r) => setTimeout(r, 100));
  const closed = await evaluate(send, "document.getElementById('visor').open");
  const back = await evaluate(send, "document.activeElement?.closest('figure')?.id || document.activeElement?.className");
  check(closed === false, "Escape no cerró el visor");
  check(back === "dock", `el foco no volvió al dock: ${back}`);

  await evaluate(send, "window.scrollTo(0, 0)");
  await evaluate(send, "document.querySelector('#escritorio .shot').click()");
  await new Promise((r) => setTimeout(r, 200));
  const realVisor = await evaluate(send, `({
    open: document.getElementById('visor').open,
    title: document.getElementById('visor-titulo').textContent,
    procedencia: document.getElementById('visor-procedencia').textContent,
    text: document.getElementById('visor-texto').textContent,
    width: document.getElementById('visor-img').naturalWidth,
    ratio: (() => { const r = document.getElementById('visor-img').getBoundingClientRect(); return r.width / r.height; })()
  })`);
  check(realVisor.open && realVisor.title === "Escritorio", `el visor no abrió el escritorio real: ${realVisor.title}`);
  check(realVisor.procedencia === "Captura real facilitada por el autor", `procedencia del visor: ${realVisor.procedencia}`);
  check(!realVisor.text.includes("WhiteSur") && realVisor.width === 1919, "el visor del escritorio no conserva la captura del autor");
  check(Math.abs(realVisor.ratio - (1919 / 1079)) < 0.03, `el visor deforma el escritorio: ${realVisor.ratio}`);
  await shoot(send, "desktop_claro_visor_escritorio.png");
  await evaluate(send, "document.getElementById('visor').close()");
  await evaluate(send, "document.querySelector('#tienda-autor .shot').click()");
  await new Promise((r) => setTimeout(r, 200));
  const storeVisor = await evaluate(send, `({
    title: document.getElementById('visor-titulo').textContent,
    procedencia: document.getElementById('visor-procedencia').textContent,
    text: document.getElementById('visor-texto').textContent,
    width: document.getElementById('visor-img').naturalWidth
  })`);
  check(storeVisor.title === "App Store y Acerca de" && storeVisor.width === 1919, `el visor no abrió la tienda real: ${JSON.stringify(storeVisor)}`);
  check(storeVisor.procedencia === "Captura real facilitada por el autor" && !storeVisor.text.includes("WhiteSur"), "la tienda real queda etiquetada como demostración");
  check(storeVisor.text.includes("Abrir") && storeVisor.text.includes("no acredita"), "falta el límite del botón Abrir");
  await shoot(send, "desktop_claro_visor_tienda.png");
  await evaluate(send, "document.getElementById('visor').close()");

  await evaluate(send, "window.scrollTo(0, 0)");
  await evaluate(send, "document.querySelector('#ajustes-autor .shot').focus()");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: "\r" });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await new Promise((r) => setTimeout(r, 200));
  const ajustesVisor = await evaluate(send, `({
    title: document.getElementById('visor-titulo').textContent,
    text: document.getElementById('visor-texto').textContent,
    width: document.getElementById('visor-img').naturalWidth,
    height: document.getElementById('visor-img').naturalHeight,
    ratio: (() => { const r = document.getElementById('visor-img').getBoundingClientRect(); return r.width / r.height; })()
  })`);
  check(ajustesVisor.title === "Ajustes del sistema" && ajustesVisor.width === 913 && ajustesVisor.height === 676, `el visor no abrió Ajustes intacto: ${JSON.stringify(ajustesVisor)}`);
  check(ajustesVisor.text.includes("Ajustes del sistema — captura real facilitada por el autor"), "falta el pie de Ajustes");
  check(!/ARDU|jerry|26\.04|i5-6400/.test(ajustesVisor.text), "el visor de Ajustes transcribe el equipo");
  check(Math.abs(ajustesVisor.ratio - (913 / 676)) < 0.03, `el visor deforma Ajustes: ${ajustesVisor.ratio}`);
  await shoot(send, "desktop_claro_visor_ajustes.png");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
  const lanzadorVisor = await evaluate(send, `({
    title: document.getElementById('visor-titulo').textContent,
    text: document.getElementById('visor-texto').textContent,
    width: document.getElementById('visor-img').naturalWidth,
    height: document.getElementById('visor-img').naturalHeight
  })`);
  check(lanzadorVisor.title === "Lanzador de aplicaciones" && lanzadorVisor.width === 1915 && lanzadorVisor.height === 985, `el visor no abrió el lanzador: ${JSON.stringify(lanzadorVisor)}`);
  check(lanzadorVisor.text.includes("Lanzador de aplicaciones — captura real facilitada por el autor") && lanzadorVisor.text.includes("no acredita"), "falta el pie del lanzador");
  await shoot(send, "desktop_claro_visor_lanzador.png");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await new Promise((r) => setTimeout(r, 100));
  const ajustesBack = await evaluate(send, "document.getElementById('visor').open === false && document.activeElement?.closest('figure')?.id");
  check(ajustesBack === "ajustes-autor", `el foco no volvió a Ajustes: ${ajustesBack}`);

  await evaluate(send, "document.querySelector('#menu .shot').click()");
  await new Promise((r) => setTimeout(r, 100));
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 8, y: 8, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 8, y: 8, button: "left", clickCount: 1 });
  await new Promise((r) => setTimeout(r, 100));
  const backdropClosed = await evaluate(send, "document.getElementById('visor').open === false");
  check(backdropClosed, "pulsar fuera del visor no lo cerró");

  await prepare(send, { width: 1440, height: 900, mobile: false, scheme: "dark" });
  const darkBg = await evaluate(send, "getComputedStyle(document.body).backgroundColor");
  check(darkBg === "rgb(19, 18, 16)", `fondo oscuro inesperado: ${darkBg}`);
  await shootHero(send, "desktop_oscuro_hero.png", 1440, false);
  await shootFull(send, "desktop_oscuro_completo.png", 1440, false);

  await prepare(send, { width: 390, height: 844, mobile: true, scheme: "light" });
  await shootHero(send, "movil_claro_hero.png", 390, true);
  await shootFull(send, "movil_claro_completo.png", 390, true);
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const overflow = await evaluate(send, "document.documentElement.scrollWidth > document.documentElement.clientWidth + 1");
  check(!overflow, "la página móvil desborda en horizontal");
  const mobileAjustes = await evaluate(send, "document.getElementById('ajustes-autor').getBoundingClientRect().top + window.scrollY");
  await evaluate(send, `window.scrollTo(0, ${Math.max(0, Math.round(mobileAjustes) - 70)})`);
  await shoot(send, "movil_autor_galeria.png");
  await evaluate(send, "document.querySelector('#lanzador-autor .shot').click()");
  await new Promise((r) => setTimeout(r, 200));
  const mobileLauncher = await evaluate(send, `({
    title: document.getElementById('visor-titulo').textContent,
    fits: document.getElementById('visor-img').getBoundingClientRect().width <= window.innerWidth
  })`);
  check(mobileLauncher.title === "Lanzador de aplicaciones" && mobileLauncher.fits, `el visor móvil del lanzador no cabe: ${JSON.stringify(mobileLauncher)}`);
  await shoot(send, "movil_visor_lanzador.png");
  await evaluate(send, "document.getElementById('visor').close()");
  await evaluate(send, "document.querySelector('#launchpad .shot').click()");
  await new Promise((r) => setTimeout(r, 200));
  const mobileOpen = await evaluate(send, "document.getElementById('visor').open && document.getElementById('visor-titulo').textContent");
  check(mobileOpen === "Launchpad", `el visor móvil no mostró Launchpad: ${mobileOpen}`);
  await shoot(send, "movil_claro_visor.png");

  await prepare(send, { width: 390, height: 844, mobile: true, scheme: "dark" });
  await shootHero(send, "movil_oscuro_hero.png", 390, true);
} finally {
  chrome.kill("SIGKILL");
  server.close();
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`ok: capturas en ${outDir}`);
