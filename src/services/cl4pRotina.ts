/** Envia ao hub CL4P-RZ os lugares e as estadias (contrato "routinetracker", schema 1). */
import { getEstado, useEstado } from '../store/store.ts';
import { cl4pPublicar } from './cl4pLink.ts';
import { useEffect } from 'react';

const DIAS_HISTORICO = 400;

function montar() {
  const { lugares, registros, config } = getEstado();
  const limite = Date.now() - DIAS_HISTORICO * 86_400_000;
  return {
    lugares: lugares.map((l) => ({ id: l.id, nome: l.nome, categoria: l.categoria, latitude: l.latitude, longitude: l.longitude, raio: l.raio })),
    registros: registros
      .filter((r) => (r.fim ?? Date.now()) >= limite)
      .map((r) => ({ id: r.id, lugarId: r.lugarId, latitude: r.latitude, longitude: r.longitude, inicio: r.inicio, fim: r.fim })),
    metas: { trabalhoHorasDia: config.metaTrabalhoHoras, academiaSemana: config.metaAcademiaSemana },
  };
}

/** Publica sempre que lugares, registros ou metas mudarem. */
export function usePublicarNoCl4p() {
  const { lugares, registros, config } = useEstado();
  useEffect(() => {
    cl4pPublicar('routinetracker', montar);
  }, [lugares, registros, config]);
}
