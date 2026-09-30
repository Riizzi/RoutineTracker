import type { Categoria, CategoriaStat } from './types.ts';

export interface CategoriaMeta {
  label: string;
  cor: string;
  icone: string;
}

export const CATEGORIAS: Record<CategoriaStat, CategoriaMeta> = {
  casa: { label: 'Casa', cor: '#5F8575', icone: 'casa' },
  trabalho: { label: 'Trabalho', cor: '#4E6A8A', icone: 'trabalho' },
  saude: { label: 'Saúde / Academia', cor: '#BC5A42', icone: 'saude' },
  lazer: { label: 'Lazer', cor: '#C68B59', icone: 'lazer' },
  estudo: { label: 'Estudo', cor: '#7E6B8F', icone: 'estudo' },
  social: { label: 'Social', cor: '#A0637A', icone: 'social' },
  transporte: { label: 'Transporte', cor: '#78716C', icone: 'transporte' },
  outro: { label: 'Outro', cor: '#8C7B6B', icone: 'outro' },
  desconhecido: { label: 'Sem cadastro', cor: '#B8B0A4', icone: 'desconhecido' },
};

export const ORDEM_CATEGORIAS: Categoria[] = [
  'casa',
  'trabalho',
  'saude',
  'lazer',
  'estudo',
  'social',
  'transporte',
  'outro',
];
