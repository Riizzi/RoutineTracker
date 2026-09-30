import { addDias, inicioDoDia } from '../core/time.ts';
import { importarBackupJSON } from './store.ts';

/** Dados fictícios para pré-visualizar a interface no navegador (npm run dev). */
export function carregarDemo() {
  const hoje = inicioDoDia(Date.now());
  const lugares = [
    { id: 'casa', nome: 'Casa', categoria: 'casa', latitude: -19.92, longitude: -43.94, raio: 120, endereco: 'Rua Exemplo, 100', ativo: true, criadoEm: hoje },
    { id: 'trab', nome: 'Escritório', categoria: 'trabalho', latitude: -19.93, longitude: -43.93, raio: 150, endereco: 'Av. Exemplo, 900', ativo: true, criadoEm: hoje },
    { id: 'gym', nome: 'Academia', categoria: 'saude', latitude: -19.925, longitude: -43.935, raio: 100, endereco: 'Rua da Academia, 50', ativo: true, criadoEm: hoje },
  ];
  const registros: object[] = [];
  const h = (d: number, hora: number) => addDias(hoje, -d) + hora * 3_600_000;
  const add = (id: string, d: number, a: number, b: number) => {
    const l = lugares.find((x) => x.id === id)!;
    registros.push({ id: `${id}-${d}-${a}`, lugarId: id, latitude: l.latitude, longitude: l.longitude, inicio: h(d, a), fim: h(d, b), ultimoSinal: h(d, b), origem: 'geofence', editado: false });
  };
  for (let d = 1; d <= 20; d++) {
    add('casa', d, 0, 7.5);
    if (new Date(addDias(hoje, -d)).getDay() % 6 !== 0) {
      add('trab', d, 8.5, 18 + (d % 3) * 0.5);
      if (d % 2 === 0) add('gym', d, 19, 20.2);
    }
    add('casa', d, 21, 24);
  }
  importarBackupJSON(JSON.stringify({ tipo: 'routinetracker-backup', versao: 1, lugares, registros, ignorados: [], config: {} }));
}
