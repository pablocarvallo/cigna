#!/usr/bin/env node
// Publica los datos del artifact «Gastos Médicos Cigna» para la app del iPhone.
//
// Lee una exportación de la base de datos del artifact (una carpeta por colección,
// un archivo JSON por documento, tal como la deja ArtifactData con out_dir), arma
// un resumen sin datos internos y lo cifra con AES-256-GCM en datos/cigna.enc.json.
// La clave nunca se guarda en este repositorio: vive en el artifact (config/clave)
// y en el iPhone, que la recibe con el código «CIGNA1.…».
//
// Uso:
//   node herramientas/publicar.mjs --export <carpeta> --clave <clave o CIGNA1.…> [--cambio <ms>] [--salida datos/cigna.enc.json]

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

function args() {
  const a = process.argv.slice(2), o = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) { o[a[i].slice(2)] = a[i + 1]; i++; }
  }
  return o;
}

function claveDe(texto) {
  const m = /^(?:CIGNA1\.)?([A-Za-z0-9_-]{43})$/.exec(String(texto || '').trim());
  if (!m) throw new Error('La clave debe ser el código CIGNA1.… o 43 caracteres base64url.');
  const k = Buffer.from(m[1], 'base64url');
  if (k.length !== 32) throw new Error('La clave no tiene 32 bytes.');
  return k;
}

function leerColeccion(dir, nombre) {
  const d = join(dir, nombre);
  if (!existsSync(d)) return [];
  return readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => {
    const raw = JSON.parse(readFileSync(join(d, f), 'utf8'));
    const data = raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object' && !('persona' in raw) ? raw.data : raw;
    return { id: f.slice(0, -5), ...data };
  });
}

const num = (v) => (v === null || v === undefined || v === '' || !isFinite(+v) ? null : +v);
const txt = (v) => (v === null || v === undefined ? '' : String(v));

function armar(dir, cambio) {
  const gastos = leerColeccion(dir, 'gastos').filter((g) => g.fecha).map((g) => {
    const o = {
      id: g.id, persona: txt(g.persona), fecha: txt(g.fecha), tipo: txt(g.tipo), detalle: txt(g.detalle),
      clp: num(g.clp), reemb: num(g.reemb), estado: num(g.estado) ?? 0
    };
    if (g.creado) o.creado = txt(g.creado);
    if (g.archivo && g.archivo.id) o.boleta = txt(g.archivo.nombre || 'boleta');
    if (Array.isArray(g.pagos) && g.pagos.length) {
      o.pagos = g.pagos.map((p) => ({ liq: txt(p.liq), sol: num(p.sol), mon: txt(p.mon), usd: num(p.usd), trat: txt(p.trat), prov: txt(p.prov) }));
    }
    return o;
  });
  const copagos = leerColeccion(dir, 'copagos').map((c) => ({
    id: c.id, persona: txt(c.persona), monto: num(c.monto), anio: num(c.anio), nota: txt(c.nota), orden: num(c.orden), creado: txt(c.creado)
  }));
  const egresos = leerColeccion(dir, 'egresos').map((e) => ({ id: e.id, mes: txt(e.mes), monto: num(e.monto), nota: txt(e.nota), creado: txt(e.creado) }));
  const tc = leerColeccion(dir, 'tc').map((t) => ({ id: t.id, fecha: txt(t.fecha), valor: num(t.valor) }));
  const liqs = leerColeccion(dir, 'liquidaciones').map((l) => ({
    fecha: txt(l.fecha), pagado: num(l.pagado), calculado: num(l.calculado), boletas: num(l.boletas), porPersona: l.porPersona || {}
  }));
  const plan = leerColeccion(dir, 'config').find((c) => c.id === 'plan') || {};
  const cfg = {};
  for (const k of ['topePersona', 'topeFamilia', 'cobertura', 'saldoInicial', 'corte']) if (plan[k] !== undefined) cfg[k] = plan[k];
  return { v: 1, at: new Date().toISOString(), cambio: num(cambio), cfg, gastos, copagos, egresos, tc, liqs };
}

function cifrar(obj, key) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  const data = Buffer.concat([ct, c.getAuthTag()]);
  return { v: 1, alg: 'AES-256-GCM', at: obj.at, iv: iv.toString('base64'), data: data.toString('base64') };
}

function comprobar(enc, key) {
  const buf = Buffer.from(enc.data, 'base64');
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(enc.iv, 'base64'));
  d.setAuthTag(buf.subarray(buf.length - 16));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]).toString('utf8'));
}

const o = args();
if (!o.export || !o.clave) {
  console.error('Uso: node herramientas/publicar.mjs --export <carpeta> --clave <CIGNA1.…> [--cambio <ms>] [--salida datos/cigna.enc.json]');
  process.exit(2);
}
const key = claveDe(o.clave);
const datos = armar(o.export, o.cambio);
if (!datos.gastos.length) { console.error('La exportación no trae gastos: no se publica nada.'); process.exit(1); }
const enc = cifrar(datos, key);
const back = comprobar(enc, key);
if (back.gastos.length !== datos.gastos.length) { console.error('La verificación del cifrado falló.'); process.exit(1); }
const salida = o.salida || 'datos/cigna.enc.json';
mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, JSON.stringify(enc) + '\n');
const reemb = datos.gastos.reduce((a, g) => a + (g.reemb || 0), 0);
console.log(`Publicado ${salida}: ${datos.gastos.length} gastos, ${datos.copagos.length} copagos, ${datos.egresos.length} egresos, ${datos.tc.length} tipos de cambio, ${datos.liqs.length} liquidaciones; reembolsado total US$ ${reemb.toFixed(2)}.`);
