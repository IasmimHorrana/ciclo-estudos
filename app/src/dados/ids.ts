/** Id curto e único o bastante para uma pessoa só: "n" + hora em base 36 + 4 letras ao acaso. */
export const novoId = (agora = Date.now()) => 'n' + agora.toString(36) + Math.random().toString(36).slice(2, 6)

const alea = () => Math.random().toString(36).slice(2, 8)
/** Id com prefixo (ex.: "c" de cartão), hora em base 36 e 6 letras ao acaso. */
export const novoIdFc = (prefixo: string, agora = Date.now()) => `${prefixo}${agora.toString(36)}${alea()}`
