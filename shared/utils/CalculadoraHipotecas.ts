import type { OfertaHipotecaTipo, IBonificacion, IGasto, IResultadoCalculo, IProductoPersonal } from '../types/hipotecas'

export function calcularCuotaFrances(capital: number, interesMensual: number, meses: number): number {
  if (interesMensual <= 0) {
    return capital / meses
  }
  return capital * (interesMensual * Math.pow(1 + interesMensual, meses)) / (Math.pow(1 + interesMensual, meses) - 1)
}

export function obtenerInteresMensual(oferta: OfertaHipotecaTipo, euribor: number, conBonificaciones: boolean, mesActual: number): { rate: number, isAssumedBase: boolean } {
  let baseRate = 0
  let isAssumedBase = false

  // Simplified sum function for the new data model
  const sumReductions = (bonificaciones: IBonificacion[]) => {
    return bonificaciones.reduce((acc, b) => acc + (b.reduccion || 0), 0)
  }

  const bonificacionesActivas = oferta.bonificaciones.filter(b => b.enabled !== false)
  let interestType: 'tin' | 'diferencial' | 'tinFijo' = 'tin'

  if (oferta.tipo === 'variable') {
    interestType = 'diferencial'
  } else if (oferta.tipo === 'mixta') {
    const plazoFijoMeses = oferta.plazoFijoAnios * 12
    interestType = (mesActual <= plazoFijoMeses) ? 'tinFijo' : 'diferencial'
  }

  const reduccionParaInferencia = oferta.topeBonificacion !== undefined
    ? oferta.topeBonificacion
    : sumReductions(oferta.bonificaciones)

  let baseValue: number | undefined
  let bonifiedValue: number | undefined

  if (oferta.tipo === 'fija') {
    baseValue = oferta.tin
    bonifiedValue = oferta.tinBonificado
  } else if (oferta.tipo === 'variable') {
    baseValue = oferta.diferencial
    bonifiedValue = oferta.diferencialBonificado
  } else if (oferta.tipo === 'mixta') {
    const plazoFijoMeses = oferta.plazoFijoAnios * 12
    if (mesActual <= plazoFijoMeses) {
      baseValue = oferta.tinFijo
      bonifiedValue = oferta.tinFijoBonificado
    } else {
      baseValue = oferta.diferencial
      bonifiedValue = oferta.diferencialBonificado
    }
  }

  const isEuriborBased = interestType === 'diferencial'

  if (baseValue !== undefined) {
    baseRate = isEuriborBased ? euribor + baseValue : baseValue
  } else if (bonifiedValue !== undefined) {
    const effectiveBonifiedValue = isEuriborBased ? euribor + bonifiedValue : bonifiedValue
    baseRate = effectiveBonifiedValue + reduccionParaInferencia
    isAssumedBase = true
  } else {
    baseRate = isEuriborBased ? euribor : 0
    isAssumedBase = true
  }

  let finalRate = baseRate
  if (conBonificaciones) {
    const reduccionActiva = sumReductions(bonificacionesActivas)
    const reduccionAplicada = oferta.topeBonificacion !== undefined
      ? Math.min(reduccionActiva, oferta.topeBonificacion)
      : reduccionActiva
    finalRate = baseRate - reduccionAplicada
  }

  return { rate: Math.max(0, finalRate) / 100 / 12, isAssumedBase }
}

export function calcularTAE(prestamo: number, numCuotas: number, gastosIniciales: number, flujoCuotas: number[], costeMensualProductos: number): number {
  const importeNetoRecibido = prestamo - gastosIniciales

  const van = (tae: number): number => {
    const tirMensual = Math.pow(1 + tae, 1 / 12) - 1
    let suma = 0
    for (let i = 0; i < numCuotas; i++) {
      const cuota = flujoCuotas[i]
      if (typeof cuota === 'number') {
        suma += (cuota + costeMensualProductos) / Math.pow(1 + tirMensual, i + 1)
      }
    }
    return suma - importeNetoRecibido
  }

  let taeMin = 0.00
  let taeMax = 0.20
  const precision = 1e-7
  let taeMed = 0

  if (van(taeMin) * van(taeMax) >= 0) {
    if (van(taeMin) < 0) {
      taeMax = 0.5
    } else {
      taeMin = -0.05
    }

    if (van(taeMin) * van(taeMax) >= 0) {
      return NaN
    }
  }

  let iter = 0
  const maxIterations = 500
  while ((taeMax - taeMin) >= precision && iter < maxIterations) {
    taeMed = (taeMin + taeMax) / 2
    if (van(taeMed) === 0.0) {
      break
    } else if (van(taeMed) * van(taeMin) < 0) {
      taeMax = taeMed
    } else {
      taeMin = taeMed
    }
    iter++
  }

  return taeMed * 100
}

export function calcularFlujoDeCuotas(oferta: OfertaHipotecaTipo, importe: number, plazoMeses: number, euribor: number, conBonificaciones: boolean): number[] {
  let capitalPendiente = importe
  const cuotas: number[] = []

  if (oferta.tipo === 'fija') {
    const interesMensual = obtenerInteresMensual(oferta, euribor, conBonificaciones, 1)
    const cuotaConstante = calcularCuotaFrances(importe, interesMensual.rate, plazoMeses)
    return Array(plazoMeses).fill(cuotaConstante)
  }

  if (oferta.tipo === 'variable') {
    for (let mes = 1; mes <= plazoMeses; mes++) {
      const interesMensual = obtenerInteresMensual(oferta, euribor, conBonificaciones, mes)
      const cuota = calcularCuotaFrances(capitalPendiente, interesMensual.rate, plazoMeses - mes + 1)
      const interesPagado = capitalPendiente * interesMensual.rate
      const capitalAmortizado = cuota - interesPagado
      capitalPendiente -= capitalAmortizado
      cuotas.push(cuota)
    }
    return cuotas
  }

  if (oferta.tipo === 'mixta') {
    const plazoFijoMeses = oferta.plazoFijoAnios * 12

    const interesFijoMensual = obtenerInteresMensual(oferta, euribor, conBonificaciones, 1)
    const cuotaFija = calcularCuotaFrances(importe, interesFijoMensual.rate, plazoMeses)

    for (let mes = 1; mes <= plazoFijoMeses; mes++) {
      const interesPagado = capitalPendiente * interesFijoMensual.rate
      const capitalAmortizado = cuotaFija - interesPagado
      capitalPendiente -= capitalAmortizado
      cuotas.push(cuotaFija)
    }

    for (let mes = plazoFijoMeses + 1; mes <= plazoMeses; mes++) {
      const interesVariableMensual = obtenerInteresMensual(oferta, euribor, conBonificaciones, mes)
      const cuotaVariable = calcularCuotaFrances(capitalPendiente, interesVariableMensual.rate, plazoMeses - mes + 1)
      const interesPagado = capitalPendiente * interesVariableMensual.rate
      const capitalAmortizado = cuotaVariable - interesPagado
      capitalPendiente -= capitalAmortizado
      cuotas.push(cuotaVariable)
    }
    return cuotas
  }

  return []
}

export function sumGastos(gastos: IGasto[] | undefined): number {
  return gastos?.reduce((acc, gasto) => acc + (gasto.coste || 0), 0) || 0
}

export function calcularResultadoParaOferta(oferta: OfertaHipotecaTipo, importe: number, plazoAnios: number, euribor: number, bonificacionesPersonalesAdiciones: IProductoPersonal[]): IResultadoCalculo {
  const gastosTotalesReales = sumGastos(oferta.gastosAdicionales)
  const gastosParaTAE = gastosTotalesReales
  const plazoMeses = plazoAnios * 12

  const baseRateInfoSinBonif = obtenerInteresMensual(oferta, euribor, false, 1)
  const baseRateInfoConBonif = obtenerInteresMensual(oferta, euribor, true, 1)

  const cuotasSinBonificar = calcularFlujoDeCuotas(oferta, importe, plazoMeses, euribor, false)
  const costeTotalPagadoSinBonificar = cuotasSinBonificar.reduce((acc, cuota) => acc + cuota, 0)
  const costeTotalSinBonificar = costeTotalPagadoSinBonificar + gastosTotalesReales
  const taeSinBonificar = calcularTAE(importe, plazoMeses, gastosParaTAE, cuotasSinBonificar, 0)

  const cuotasConBonificar = calcularFlujoDeCuotas(oferta, importe, plazoMeses, euribor, true)
  const costeTotalBonificaciones = oferta.bonificaciones.filter(b => b.enabled !== false).reduce((acc, b) => acc + (b.costeAnual || 0), 0) * plazoAnios
  const costeTotalPagadoConBonificar = cuotasConBonificar.reduce((acc, cuota) => acc + cuota, 0)
  const costeTotalConBonificar = costeTotalPagadoConBonificar + gastosTotalesReales + costeTotalBonificaciones
  const taeConBonificar = calcularTAE(importe, plazoMeses, gastosParaTAE, cuotasConBonificar, costeTotalBonificaciones / plazoMeses)

  let costeTotalConExtras = costeTotalConBonificar
  const productosPersonalesIncluidos: string[] = []

  bonificacionesPersonalesAdiciones.forEach((boniAdic) => {
    if (boniAdic.enabled) {
      const pBonusNombreNormalizado = boniAdic.nombre.toLowerCase().trim()
      const tieneBonificacionSimilar = oferta.bonificaciones.some(oBonus =>
        oBonus.nombre.toLowerCase().trim().includes(pBonusNombreNormalizado)
      )
      if (!tieneBonificacionSimilar) {
        costeTotalConExtras += boniAdic.costeAnual * plazoAnios
        productosPersonalesIncluidos.push(boniAdic.nombre)
      }
    }
  })

  let tinInicial, tinBonificado, diferencialInicial, diferencialBonificado
  let diferencialInicialVariable: number | undefined
  let diferencialBonificadoVariable: number | undefined
  let isAssumedBaseRate = baseRateInfoSinBonif.isAssumedBase
  let rateMismatchWarning: string | undefined
  const tolerance = 0.001

  if (oferta.tipo === 'fija') {
    tinInicial = baseRateInfoSinBonif.rate * 1200
    tinBonificado = baseRateInfoConBonif.rate * 1200
    if (oferta.tinBonificado !== undefined && Math.abs(tinBonificado - oferta.tinBonificado) > tolerance) {
      rateMismatchWarning = `El TIN bonificado (${oferta.tinBonificado.toFixed(2)}%) no se alcanza con las bonificaciones activas.`
    }
  } else if (oferta.tipo === 'variable') {
    diferencialInicial = (baseRateInfoSinBonif.rate * 1200) - euribor
    diferencialBonificado = Math.max(0, (baseRateInfoConBonif.rate * 1200) - euribor)
    if (oferta.diferencialBonificado !== undefined && Math.abs(diferencialBonificado - oferta.diferencialBonificado) > tolerance) {
      rateMismatchWarning = `El diferencial bonificado (${oferta.diferencialBonificado.toFixed(2)}%) no se alcanza con las bonificaciones activas.`
    }
  } else if (oferta.tipo === 'mixta') {
    tinInicial = (obtenerInteresMensual(oferta, euribor, false, 1).rate * 1200)
    tinBonificado = (obtenerInteresMensual(oferta, euribor, true, 1).rate * 1200)

    const plazoFijoMesesMixta = oferta.plazoFijoAnios * 12
    const baseRateInfoVariableSinBonif = obtenerInteresMensual(oferta, euribor, false, plazoFijoMesesMixta + 1)
    const baseRateInfoVariableConBonif = obtenerInteresMensual(oferta, euribor, true, plazoFijoMesesMixta + 1)

    diferencialInicialVariable = (baseRateInfoVariableSinBonif.rate * 1200) - euribor
    diferencialBonificadoVariable = Math.max(0, (baseRateInfoVariableConBonif.rate * 1200) - euribor)

    if (baseRateInfoVariableSinBonif.isAssumedBase) {
      isAssumedBaseRate = true
    }

    if (oferta.tinFijoBonificado !== undefined && tinBonificado !== undefined && Math.abs(tinBonificado - oferta.tinFijoBonificado) > tolerance) {
      rateMismatchWarning = `El TIN Fijo bonificado (${oferta.tinFijoBonificado.toFixed(2)}%) no se alcanza con las bonificaciones activas.`
    }
    if (!rateMismatchWarning && oferta.diferencialBonificado !== undefined && diferencialBonificadoVariable !== undefined && Math.abs(diferencialBonificadoVariable - oferta.diferencialBonificado) > tolerance) {
      rateMismatchWarning = `El diferencial variable bonificado (${oferta.diferencialBonificado.toFixed(2)}%) no se alcanza con las bonificaciones activas.`
    }
  }

  let bonusCapWarning: string | undefined
  const bonificacionesActivas = oferta.bonificaciones.filter(b => b.enabled !== false)
  const reduccionActiva = bonificacionesActivas.reduce((acc, b) => acc + (b.reduccion || 0), 0)

  if (oferta.topeBonificacion !== undefined && reduccionActiva.toFixed(2) < oferta.topeBonificacion.toFixed(2)) {
    bonusCapWarning = `No se alcanza el máximo de bonificación posible. Bonificación activa: ${reduccionActiva.toFixed(2)}%, Tope: ${oferta.topeBonificacion.toFixed(2)}%`
  }

  let cuotaMensualVariableSinBonificar: number | undefined
  let cuotaMensualVariableConBonificar: number | undefined

  if (oferta.tipo === 'mixta') {
    const primerMesVariableIndex = oferta.plazoFijoAnios * 12
    if (plazoMeses > primerMesVariableIndex) {
      cuotaMensualVariableSinBonificar = cuotasSinBonificar[primerMesVariableIndex]
      cuotaMensualVariableConBonificar = cuotasConBonificar[primerMesVariableIndex]
    }
  }

  return {
    banco: oferta.banco,
    tipo: `${oferta.tipo.charAt(0).toUpperCase()}${oferta.tipo.slice(1)}`,
    taeSinBonificar,
    taeConBonificar,
    cuotaMensualSinBonificar: cuotasSinBonificar[0] ?? 0,
    cuotaMensualConBonificar: cuotasConBonificar[0] ?? 0,
    costeTotalSinBonificar: costeTotalSinBonificar,
    costeTotalConBonificar: costeTotalConBonificar,
    costeTotalBonificaciones,
    bonificaciones: oferta.bonificaciones,
    desgloseGastos: {
      total: gastosTotalesReales,
      detalles: oferta.gastosAdicionales || []
    },
    oferta: oferta,
    tinInicial,
    tinBonificado,
    diferencialInicial,
    diferencialBonificado,
    isAssumedBaseRate,
    costeTotalConExtras,
    productosPersonalesIncluidos,
    cuotaMensualVariableSinBonificar,
    cuotaMensualVariableConBonificar,
    diferencialInicialVariable,
    diferencialBonificadoVariable,
    rateMismatchWarning,
    bonusCapWarning
  }
}
