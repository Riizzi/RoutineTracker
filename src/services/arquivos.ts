import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from '../native/bridge.ts';

/** No Android: grava em cache e abre a folha de compartilhamento (Drive, WhatsApp, e-mail…). No navegador: baixa. */
export async function compartilharArquivo(nome: string, conteudo: string, mime: string): Promise<void> {
  if (!isNative) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
    return;
  }
  const r = await Filesystem.writeFile({ path: nome, data: conteudo, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: nome, url: r.uri, dialogTitle: 'Salvar ou enviar' });
}

export function lerArquivoTexto(arquivo: File): Promise<string> {
  return new Promise((ok, erro) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result ?? ''));
    fr.onerror = () => erro(new Error('Não foi possível ler o arquivo.'));
    fr.readAsText(arquivo);
  });
}
