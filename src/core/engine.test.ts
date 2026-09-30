process.env.TZ = 'America/Sao_Paulo';
import test from 'node:test';
import assert from 'node:assert/strict';
import { engineInicial, processar, reatribuirDesconhecidos } from './engine.ts';
import type { EngineState, Lugar, NativeEvent, NativeSample, Registro } from './types.ts';

const T0 = new Date(2026, 8, 28, 8, 0).getTime();
const min = (n: number) => n * 60_000;
const h = (n: number) => n * 3_600_000;

let idc = 0;
const novoId = () => `r${++idc}`;

const lugar = (id: string, raio: number, lat = -19.92, lng = -43.94): Lugar => ({
  id, nome: id, categoria: 'trabalho', latitude: lat, longitude: lng, raio, endereco: '', ativo: true, criadoEm: 0,
});

let seq = 0;
const enter = (placeId: string, ts: number): NativeEvent => ({ seq: ++seq, type: 'ENTER', placeId, ts });
const exit = (placeId: string, ts: number): NativeEvent => ({ seq: ++seq, type: 'EXIT', placeId, ts });
const amostra = (ts: number, lat: number, lng: number, acc = 30): NativeSample => ({ seq: ++seq, ts, lat, lng, acc });

function rodar(
  lugares: Lugar[],
  eventos: NativeEvent[],
  amostras: NativeSample[] = [],
  registros: Registro[] = [],
  engine: EngineState = engineInicial(),
  minutosMinimos = 5,
) {
  return processar({ lugares, registros, engine, eventos, amostras, minutosMinimos, novoId });
}
const resumo = (rs: Registro[]) => rs.map((r) => [r.lugarId, r.inicio, r.fim] as const);

test('visita simples vira um registro fechado', () => {
  const out = rodar([lugar('W', 150)], [enter('W', T0), exit('W', T0 + h(9))]);
  assert.deepEqual(resumo(out.registros), [['W', T0, T0 + h(9)]]);
  assert.equal(out.engine.abertoId, null);
});

test('visita em andamento fica aberta', () => {
  const out = rodar([lugar('W', 150)], [enter('W', T0)]);
  assert.equal(out.registros.length, 1);
  assert.equal(out.registros[0]!.fim, null);
  assert.equal(out.engine.abertoId, out.registros[0]!.id);
});

test('passagem rápida (< mínimo) é descartada', () => {
  const out = rodar([lugar('W', 150)], [enter('W', T0), exit('W', T0 + min(3))]);
  assert.equal(out.registros.length, 0);
});

test('oscilação na borda da cerca funde visitas próximas', () => {
  const out = rodar([lugar('W', 150)], [
    enter('W', T0), exit('W', T0 + min(60)), enter('W', T0 + min(65)), exit('W', T0 + min(120)),
  ]);
  assert.deepEqual(resumo(out.registros), [['W', T0, T0 + min(120)]]);
});

test('lugares sobrepostos: o de menor raio vence e o maior é retomado', () => {
  const out = rodar(
    [lugar('TRAB', 150), lugar('REST', 50)],
    [enter('TRAB', T0), enter('REST', T0 + h(4)), exit('REST', T0 + h(5)), exit('TRAB', T0 + h(9))],
  );
  assert.deepEqual(resumo(out.registros), [
    ['TRAB', T0, T0 + h(4)],
    ['REST', T0 + h(4), T0 + h(5)],
    ['TRAB', T0 + h(5), T0 + h(9)],
  ]);
});

test('EXIT perdido: amostra fora infere a saída (com teto de silêncio)', () => {
  const trab = lugar('W', 150);
  const out = rodar(
    [trab],
    [enter('W', T0)],
    [
      amostra(T0 + min(15), trab.latitude, trab.longitude),
      amostra(T0 + min(30), trab.latitude, trab.longitude),
      amostra(T0 + h(3), trab.latitude + 0.02, trab.longitude), // ~2,2 km longe
    ],
  );
  const w = out.registros.find((r) => r.lugarId === 'W')!;
  assert.equal(w.fim, T0 + min(30) + min(20)); // último sinal + teto, não as 3h inteiras
});

test('amostras imprecisas (acc alto) não mexem na pertinência', () => {
  const trab = lugar('W', 150);
  const out = rodar([trab], [enter('W', T0)], [amostra(T0 + h(1), trab.latitude + 0.05, trab.longitude, 900)]);
  assert.equal(out.registros.length, 1);
  assert.equal(out.registros[0]!.fim, null);
});

test('estadia em local desconhecido é agrupada e mantida aberta', () => {
  const am: NativeSample[] = [];
  for (let i = 0; i <= 12; i++) am.push(amostra(T0 + min(15 * i), -19.9, -43.9 + i * 1e-5));
  const out = rodar([], [], am);
  assert.equal(out.registros.length, 1);
  const r = out.registros[0]!;
  assert.equal(r.lugarId, null);
  assert.equal(r.amostras, 13);
  assert.equal(r.fim, null);
  assert.equal(r.ultimoSinal, T0 + h(3));
});

test('desconhecido fecha no último sinal quando a pessoa se afasta', () => {
  const am: NativeSample[] = [];
  for (let i = 0; i <= 12; i++) am.push(amostra(T0 + min(15 * i), -19.9, -43.9));
  am.push(amostra(T0 + h(3) + min(15), -19.8, -43.9)); // ~11 km
  const out = rodar([], [], am);
  const fechados = out.registros.filter((r) => r.fim !== null);
  assert.equal(fechados.length, 1);
  assert.equal(fechados[0]!.fim, T0 + h(3));
  assert.equal(out.registros.filter((r) => r.fim === null).length, 1);
});

test('trânsito (amostras longe umas das outras) não gera registros', () => {
  const am: NativeSample[] = [];
  for (let i = 0; i < 10; i++) am.push(amostra(T0 + min(15 * i), -19.9 + i * 0.05, -43.9));
  const out = rodar([], [], am);
  assert.equal(out.registros.filter((r) => r.fim !== null).length, 0);
});

test('chegar a um lugar cadastrado encerra a estadia desconhecida', () => {
  const trab = lugar('W', 150, -19.5, -43.5);
  const am: NativeSample[] = [];
  for (let i = 0; i <= 4; i++) am.push(amostra(T0 + min(15 * i), -19.9, -43.9));
  const antes = rodar([trab], [], am);
  const depois = rodar([trab], [enter('W', T0 + h(2))], [], antes.registros, antes.engine);
  const desc = depois.registros.find((r) => r.lugarId === null)!;
  assert.equal(desc.fim, T0 + min(60));
  assert.ok(depois.registros.some((r) => r.lugarId === 'W' && r.fim === null));
});

test('cursores tornam o processamento idempotente', () => {
  const evs = [enter('W', T0), exit('W', T0 + h(2))];
  const a = rodar([lugar('W', 150)], evs);
  const b = rodar([lugar('W', 150)], evs, [], a.registros, a.engine);
  assert.deepEqual(resumo(b.registros), resumo(a.registros));
});

test('processar em dois lotes = processar tudo de uma vez', () => {
  const trab = lugar('W', 150);
  const e1 = [enter('W', T0)];
  const s1 = [amostra(T0 + min(15), trab.latitude, trab.longitude)];
  const e2 = [exit('W', T0 + h(1))];
  const s2 = [amostra(T0 + h(2), -19.7, -43.7), amostra(T0 + h(2) + min(15), -19.7, -43.7)];
  const inteiro = rodar([trab], [...e1, ...e2], [...s1, ...s2]);
  const p1 = rodar([trab], e1, s1);
  const p2 = rodar([trab], e2, s2, p1.registros, p1.engine);
  assert.deepEqual(resumo(p2.registros), resumo(inteiro.registros));
});

test('lugar removido/desativado fecha o registro aberto sem quebrar', () => {
  const w = lugar('W', 150);
  const a = rodar([w], [enter('W', T0)]);
  const b = rodar([{ ...w, ativo: false }], [], [], a.registros, a.engine);
  assert.equal(b.engine.abertoId, null);
  assert.equal(b.registros.filter((r) => r.fim === null).length, 0);
});

test('reatribuirDesconhecidos move estadias passadas para o novo lugar', () => {
  const am: NativeSample[] = [];
  for (let i = 0; i <= 12; i++) am.push(amostra(T0 + min(15 * i), -19.9, -43.9));
  am.push(amostra(T0 + h(4), -19.5, -43.5));
  const out = rodar([], [], am);
  const novo = lugar('VO', 150, -19.9, -43.9);
  const rs = reatribuirDesconhecidos(out.registros, novo);
  assert.equal(rs.filter((r) => r.lugarId === 'VO').length, 1);
  assert.equal(rs.filter((r) => r.lugarId === null).length, 1); // a aberta em outro lugar
});
