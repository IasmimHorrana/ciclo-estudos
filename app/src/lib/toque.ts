/** A tela é de toque (celular/tablet)? Serve para não abrir o teclado virtual sozinho com `autoFocus`. */
export const telaDeToque = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
