process.env.TZ = 'America/Sao_Paulo';
import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularSugestoes } from './discovery.ts';
import type { Lugar, Registro } from './types.ts';

const T0 = new Date(2026, 8, 26, 10, 0).getTime();
const min = (n: number) => n * 60_000;
const h = (n: number) => n * 3_600_000;
let n = 0;
const reg = (ini: number, fim: number | null, lat: number, lng: number, lugarId: string | null = null): Registro => ({
  id: `r${++n}`, lugarId, latitude: lat, longitude: lng, inicio: ini, fim, ultimoSinal: fim ?? ini + h(1), origem: 'amostra', editado: false,
});
const crit = { descobertaMinutos: 30 };

test('fim de semana inteiro num lugar novo gera sugestão', () => {
  const s = calcularSugestoes([reg(T0, T0 + h(40), -19.9, -43.9)], [], [], crit, T0 + h(41));
  assert.equal(s.length, 1);
  assert.ok(s[0]!.minutos >= 2400);
});

test('duas visitas curtas somando o mínimo geram sugestão', () => {
  const rs = [reg(T0, T0 + min(25), -19.9, -43.9), reg(T0 + h(24), T0 + h(24) + min(25), -19.9001, -43.9001)];
  const s = calcularSugestoes(rs, [], [], crit, T0 + h(30));
  assert.equal(s.length, 1);
  assert.equal(s[0]!.visitas, 2);
});

test('uma visita curta só não gera sugestão', () => {
  assert.equal(calcularSugestoes([reg(T0, T0 + min(40), -19.9, -43.9)], [], [], crit, T0 + h(2)).length, 0);
});

test('local ignorado não é sugerido de novo', () => {
  const s = calcularSugestoes([reg(T0, T0 + h(5), -19.9, -43.9)], [], [{ latitude: -19.9002, longitude: -43.9002 }], crit, T0 + h(6));
  assert.equal(s.length, 0);
});

test('estadia dentro de um lugar cadastrado não é sugerida', () => {
  const l: Lugar = { id: 'L', nome: 'L', categoria: 'casa', latitude: -19.9, longitude: -43.9, raio: 150, endereco: '', ativo: true, criadoEm: 0 };
  assert.equal(calcularSugestoes([reg(T0, T0 + h(5), -19.9, -43.9)], [l], [], crit, T0 + h(6)).length, 0);
});

test('estadia atual (aberta) é marcada como atual', () => {
  const r = reg(T0, null, -19.9, -43.9);
  r.ultimoSinal = T0 + h(3);
  const s = calcularSugestoes([r], [], [], crit, T0 + h(3));
  assert.equal(s.length, 1);
  assert.equal(s[0]!.atual, true);
});
