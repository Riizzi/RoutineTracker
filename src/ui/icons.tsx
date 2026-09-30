import { Briefcase, Car, Coffee, CircleHelp, Dumbbell, GraduationCap, House, MapPin, Users } from 'lucide-react';
import type { CSSProperties } from 'react';
import { CATEGORIAS } from '../core/categorias.ts';
import type { CategoriaStat } from '../core/types.ts';

const MAPA = {
  casa: House,
  trabalho: Briefcase,
  saude: Dumbbell,
  lazer: Coffee,
  estudo: GraduationCap,
  social: Users,
  transporte: Car,
  outro: MapPin,
  desconhecido: CircleHelp,
} as const;

export function IconeCategoria({
  categoria,
  className = 'w-5 h-5',
  style,
}: {
  categoria: CategoriaStat;
  className?: string;
  style?: CSSProperties;
}) {
  const C = MAPA[categoria];
  return <C className={className} style={{ color: CATEGORIAS[categoria].cor, ...style }} />;
}
