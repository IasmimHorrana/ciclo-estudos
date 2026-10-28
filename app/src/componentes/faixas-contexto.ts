import { createContext, useContext } from 'react'
import { FAIXAS_PADRAO, type Faixas } from '@/dominio/desempenho'

/** Faixas de acerto escolhidas pela pessoa (o App lê do banco uma vez e repassa a todos os selos). */
export const FaixasContexto = createContext<Faixas>(FAIXAS_PADRAO)
export const useFaixas = () => useContext(FaixasContexto)
