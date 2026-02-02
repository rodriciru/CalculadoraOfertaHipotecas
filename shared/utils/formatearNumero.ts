export const formatearNumero = (numero: number, estilo: 'currency' | 'percent' = 'currency') => {
  if (isNaN(numero)) return 'N/A'

  if (estilo === 'percent') {
    return new Intl.NumberFormat('es-ES', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numero / 100)
  }

  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(numero)
}
