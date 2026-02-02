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
  let totalReduccion = 0

  const sumReductions = (bonificaciones: IBonificacion[], type: 'tin' | 'diferencial' | 'tinFijo') => {
    return bonificaciones.reduce((acc, b) => {
      if (type === 'tin' && b.reduccionTin !== undefined) return acc + b.reduccionTin
      if (type === 'diferencial') {
        if (b.reduccionDiferencial !== undefined) return acc + b.reduccionDiferencial
        if (b.reduccionTin !== undefined) return acc + b.reduccionTin
      }
      if (type === 'tinFijo') {
        if (b.reduccionTinFijo !== undefined) return acc + b.reduccionTinFijo
        if (b.reduccionTin !== undefined) return acc + b.reduccionTin
      }
      return acc
    }, 0)
  }

  switch (oferta.tipo) {
    case 'fija':
      totalReduccion = sumReductions(oferta.bonificaciones, 'tin')
      if (oferta.tin !== undefined) {
        baseRate = oferta.tin
      } else if (oferta.tinBonificado !== undefined) {
        baseRate = oferta.tinBonificado + totalReduccion
        isAssumedBase = true
      } else {
        baseRate = 0
        isAssumedBase = true
      }
      break
    case 'variable':
      totalReduccion = sumReductions(oferta.bonificaciones, 'diferencial')
      if (oferta.diferencial !== undefined) {
        baseRate = euribor + oferta.diferencial
      } else if (oferta.diferencialBonificado !== undefined) {
        baseRate = euribor + oferta.diferencialBonificado + totalReduccion
        isAssumedBase = true
      } else {
        baseRate = euribor
        isAssumedBase = true
      }
      break
    case 'mixta':{
      const plazoFijoMeses = oferta.plazoFijoAnios * 12
      if (mesActual <= plazoFijoMeses) {
        totalReduccion = sumReductions(oferta.bonificaciones, 'tinFijo')
        if (oferta.tinFijo !== undefined) {
          baseRate = oferta.tinFijo
        } else if (oferta.tinFijoBonificado !== undefined) {
          baseRate = oferta.tinFijoBonificado + totalReduccion
          isAssumedBase = true
        } else {
          baseRate = 0
          isAssumedBase = true
        }
      } else {
        totalReduccion = sumReductions(oferta.bonificaciones, 'diferencial')
        if (oferta.diferencial !== undefined) {
          baseRate = euribor + oferta.diferencial
        } else if (oferta.diferencialBonificado !== undefined) {
          baseRate = euribor + oferta.diferencialBonificado + totalReduccion
          isAssumedBase = true
        } else {
          baseRate = euribor
          isAssumedBase = true
        }
      }
      break
    }
  }

  let finalRate = baseRate
  if (conBonificaciones) {
    finalRate = baseRate - totalReduccion
  }

  return { rate: Math.max(0, finalRate) / 100 / 12, isAssumedBase: isAssumedBase }
}

export function calcularTAE(prestamo: number, numCuotas: number, gastosIniciales: number, flujoCuotas: number[], costeMensualProductos: number): number {
  const importeNetoRecibido = prestamo - gastosIniciales

  const van = (tae: number): number => {
    const tirMensual = Math.pow(1 + tae, 1 / 12) - 1
    let suma = 0
    for (let i = 0; i < numCuotas; i++) {
      if (flujoCuotas[i] !== undefined) {
        suma += (flujoCuotas[i] + costeMensualProductos) / Math.pow(1 + tirMensual, i + 1)
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
  // Por simplicidad, asumimos que todos los gastos adicionales son para el TAE
  const gastosParaTAE = gastosTotalesReales
  const plazoMeses = plazoAnios * 12

  const baseRateInfoSinBonif = obtenerInteresMensual(oferta, euribor, false, 1)
  const baseRateInfoConBonif = obtenerInteresMensual(oferta, euribor, true, 1)

  const cuotasSinBonificar = calcularFlujoDeCuotas(oferta, importe, plazoMeses, euribor, false)
  const costeTotalPagadoSinBonificar = cuotasSinBonificar.reduce((acc, cuota) => acc + cuota, 0)
  const costeTotalSinBonificar = costeTotalPagadoSinBonificar + gastosTotalesReales
  const taeSinBonificar = calcularTAE(importe, plazoMeses, gastosParaTAE, cuotasSinBonificar, 0)

  const cuotasConBonificar = calcularFlujoDeCuotas(oferta, importe, plazoMeses, euribor, true)
  const costeTotalBonificaciones = oferta.bonificaciones.reduce((acc, b) => acc + (b.costeAnual || 0), 0) * plazoAnios
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

  if (oferta.tipo === 'fija') {
    tinInicial = baseRateInfoSinBonif.rate * 1200
    tinBonificado = baseRateInfoConBonif.rate * 1200
  } else if (oferta.tipo === 'variable') {
    diferencialInicial = (baseRateInfoSinBonif.rate * 1200) - euribor
    diferencialBonificado = Math.max(0, (baseRateInfoConBonif.rate * 1200) - euribor)
  } else if (oferta.tipo === 'mixta') {
    tinInicial = (baseRateInfoSinBonif.rate * 1200)
    tinBonificado = (baseRateInfoConBonif.rate * 1200)

    const plazoFijoMesesMixta = oferta.plazoFijoAnios * 12 // This was plazoFijoMeses inside the case

    const baseRateInfoVariableSinBonif = obtenerInteresMensual(oferta, euribor, false, plazoFijoMesesMixta + 1)
    const baseRateInfoVariableConBonif = obtenerInteresMensual(oferta, euribor, true, plazoFijoMesesMixta + 1)

    diferencialInicialVariable = (baseRateInfoVariableSinBonif.rate * 1200) - euribor
    diferencialBonificadoVariable = Math.max(0, (baseRateInfoVariableConBonif.rate * 1200) - euribor)

    if (baseRateInfoVariableSinBonif.isAssumedBase) {
      isAssumedBaseRate = true
    }
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
    diferencialBonificadoVariable
  }
}
