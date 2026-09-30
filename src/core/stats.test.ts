process.env.TZ = 'America/Sao_Paulo';
import test from 'node:test';
import assert from 'node:assert/strict';
import { estatisticasPorDia, diasNaSemana, periodo } from './stats.ts';
import { diaKey, fatiarPorDia, fmtDuracao, inicioDaSemana } from './time.ts';
import type { Lugar, Registro } from './types.ts';

const h = (n: number) => n * 3_600_000;
const lug = (id: string, categoria: Lugar['categoria']): Lugar => ({
  id, nome: id, categoria, latitude: 0, longitude: 0, raio: 100, endereco: '', ativo: true, criadoEm: 0,
});
const reg = (lugarId: string | null, ini: number, fim: number | null): Registro => ({
  id: `${lugarId}-${ini}`, lugarId, latitude: 0, longitude: 0, inicio: ini, fim, ultimoSinal: fim ?? ini, origem: 'geofence', editado: false,
});

test('diaKey usa o fuso local (regressão do bug do toISOString)', () => {
  const t = new Date(2026, 8, 28, 23, 30).getTime(); // 23:30 em São Paulo = 02:30Z do dia 29
  assert.equal(diaKey(t), '2026-09-28');
  assert.equal(new Date(t).toISOString().slice(0, 10), '2026-09-29'); // o que o app antigo usava
});

test('registro que cruza a meia-noite é dividido entre os dois dias', () => {
  const ini = new Date(2026, 8, 27, 22, 0).getTime();
  const fim = new Date(2026, 8, 28, 6, 0).getTime();
  const dias = estatisticasPorDia([reg('C', ini, fim)], [lug('C', 'casa')], fim + h(1), ini, fim);
  assert.equal(Math.round(dias[0]!.porCategoria.casa!), 120);
  assert.equal(Math.round(dias[1]!.porCategoria.casa!), 360);
});

test('registro aberto conta até agora', () => {
  const ini = new Date(2026, 8, 28, 9, 0).getTime();
  const now = new Date(2026, 8, 28, 11, 30).getTime();
  const dias = estatisticasPorDia([reg('T', ini, null)], [lug('T', 'trabalho')], now, ini, now);
  assert.equal(Math.round(dias[0]!.total), 150);
});

test('estadias sem cadastro entram como "desconhecido"', () => {
  const ini = new Date(2026, 8, 28, 9, 0).getTime();
  const dias = estatisticasPorDia([reg(null, ini, ini + h(2))], [], ini + h(3), ini, ini);
  assert.equal(Math.round(dias[0]!.porCategoria.desconhecido!), 120);
});

test('período compara com o anterior sem sobreposição', () => {
  const now = new Date(2026, 8, 28, 12, 0).getTime();
  const ini = new Date(2026, 8, 20, 9, 0).getTime(); // dentro do período anterior (7 dias)
  const atual = periodo([reg('T', ini, ini + h(2))], [lug('T', 'trabalho')], now, 7, 0);
  const anterior = periodo([reg('T', ini, ini + h(2))], [lug('T', 'trabalho')], now, 7, 1);
  assert.equal(atual.total, 0);
  assert.equal(Math.round(anterior.total), 120);
});

test('meta semanal conta dias distintos (segunda a domingo)', () => {
  const now = new Date(2026, 8, 30, 20, 0).getTime(); // quarta
  const seg = inicioDaSemana(now);
  assert.equal(new Date(seg).getDay(), 1);
  const rs = [0, 2].map((d) => reg('G', seg + d * 86_400_000 + h(18), seg + d * 86_400_000 + h(19)));
  assert.equal(diasNaSemana(rs, [lug('G', 'saude')], 'saude', now), 2);
});

test('fatiarPorDia e fmtDuracao', () => {
  const a = new Date(2026, 8, 27, 23, 0).getTime();
  assert.equal(fatiarPorDia(a, a + h(3)).length, 2);
  assert.equal(fmtDuracao(125), '2h05');
  assert.equal(fmtDuracao(45), '45min');
  assert.equal(fmtDuracao(120), '2h');
});
