export interface IBonificacion {
  id?: number | string // Identificación única
  nombre: string
  reduccionTin?: number
  reduccionDiferencial?: number
  reduccionTinFijo?: number
  costeAnual: number
  isSupposed?: boolean
  enabled?: boolean
}

export interface IGasto {
  id?: number | string
  nombre: string
  coste: number
}

export interface IOfertaBase {
  id?: number | string
  banco: string
  gastosAdicionales: IGasto[]
  bonificaciones: IBonificacion[] // Usar IBonificacion
}

export interface IOfertaFija extends IOfertaBase {
  tipo: 'fija'
  tin?: number
  tinBonificado?: number
}

export interface IOfertaVariable extends IOfertaBase {
  tipo: 'variable'
  diferencial?: number
  diferencialBonificado?: number
}

export interface IOfertaMixta extends IOfertaBase {
  tipo: 'mixta'
  plazoFijoAnios: number
  tinFijo?: number
  tinFijoBonificado?: number
  diferencial?: number
  diferencialBonificado?: number
}

export type OfertaHipotecaTipo = IOfertaFija | IOfertaVariable | IOfertaMixta

export interface IProductoPersonal {
  id: number
  nombre: string
  costeAnual: number
  enabled: boolean
}

export interface IResultadoCalculo {
  banco: string
  tipo: string
  taeSinBonificar: number
  taeConBonificar: number
  cuotaMensualSinBonificar: number
  cuotaMensualConBonificar: number
  costeTotalSinBonificar: number
  costeTotalConBonificar: number
  costeTotalBonificaciones: number
  bonificaciones: IBonificacion[] // Usar IBonificacion
  desgloseGastos: {
    total: number
    detalles?: IGasto[]
  }
  oferta: OfertaHipotecaTipo
  tinInicial?: number
  tinBonificado?: number
  diferencialInicial?: number
  diferencialBonificado?: number
  isAssumedBaseRate?: boolean
  costeTotalConExtras?: number
  productosPersonalesIncluidos?: string[]
  cuotaMensualVariableSinBonificar?: number
  cuotaMensualVariableConBonificar?: number
  diferencialInicialVariable?: number
  diferencialBonificadoVariable?: number
}
