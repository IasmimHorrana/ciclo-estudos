/** Id curto e único o bastante para uma pessoa só: "n" + hora em base 36 + 4 letras ao acaso. */
export const novoId = (agora = Date.now()) => 'n' + agora.toString(36) + Math.random().toString(36).slice(2, 6)
