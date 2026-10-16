/**
 * Atualização do APK pelo próprio app: compara a versão instalada com a última em Releases do
 * GitHub e abre o download do APK novo. Como todas as builds usam a mesma assinatura, o Android
 * instala por cima e os dados ficam. Só funciona com o repositório público (a API do GitHub não
 * mostra releases de repositório privado sem login).
 */
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export interface InfoAtualizacao {
  instalada: number;
  ultima: number;
  temNova: boolean;
  urlApk?: string;
  pagina: string;
}

const CHAVE = 'apk.atualizacao.v1';

export async function verificarAtualizacao(repo: string, nomeApk: string): Promise<InfoAtualizacao> {
  const pagina = `https://github.com/${repo}/releases/latest`;
  const instalada = Capacitor.isNativePlatform() ? Number((await App.getInfo()).build) || 0 : 0;
  const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (r.status === 404) throw new Error('Releases indisponíveis: o repositório ainda é privado ou não tem versão publicada.');
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status}. Tente de novo mais tarde.`);
  const j = (await r.json()) as { tag_name?: string; assets?: { name: string; browser_download_url: string }[] };
  const ultima = Number((j.tag_name || '').replace(/\D/g, '')) || 0;
  const urlApk = j.assets?.find((a) => a.name === nomeApk)?.browser_download_url;
  const info = { instalada, ultima, temNova: ultima > instalada && Boolean(urlApk), urlApk, pagina };
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ em: Date.now(), ...info }));
  } catch {
    /* sem armazenamento */
  }
  return info;
}

/** Verifica no máximo uma vez por dia (para mostrar um aviso discreto ao abrir o app). */
export async function verificarSeFazUmDia(repo: string, nomeApk: string): Promise<InfoAtualizacao | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const ant = JSON.parse(localStorage.getItem(CHAVE) || 'null') as ({ em: number } & InfoAtualizacao) | null;
    if (ant && Date.now() - ant.em < 86_400_000) return ant.temNova ? ant : null;
  } catch {
    /* segue */
  }
  try {
    const info = await verificarAtualizacao(repo, nomeApk);
    return info.temNova ? info : null;
  } catch {
    return null;
  }
}

/**
 * Abre o download do APK no navegador do celular (no Capacitor, navegar para um endereço de fora
 * abre o navegador do sistema). Ao terminar, toque na notificação do download para instalar por cima.
 */
export function baixarAtualizacao(info: InfoAtualizacao) {
  window.location.href = info.urlApk || info.pagina;
}
