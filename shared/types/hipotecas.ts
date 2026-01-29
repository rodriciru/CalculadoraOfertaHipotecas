export interface IBonificacion {
  nombre: string;
  reduccionTin?: number;
  reduccionDiferencial?: number;
  reduccionTinFijo?: number;
  costeAnual: number;
  isSupposed?: boolean;
}

export interface IOfertaBase {
  banco: string;
  gastosTasacion: number;
  comisionBroker: number;
  otrosGastos: number;
  gastosCancelacionAnterior?: number;
  bonificaciones: IBonificacion[];
}

export interface IOfertaFija extends IOfertaBase {
  tipo: 'fija';
  tin?: number;
  tinBonificado?: number;
}

export interface IOfertaVariable extends IOfertaBase {
  tipo: 'variable';
  diferencial?: number;
  diferencialBonificado?: number;
}

export interface IOfertaMixta extends IOfertaBase {
  tipo: 'mixta';
  plazoFijoAnios: number;
  tinFijo?: number;
  tinFijoBonificado?: number;
  diferencial?: number;
  diferencialBonificado?: number;
}

export type OfertaHipotecaTipo = IOfertaFija | IOfertaVariable | IOfertaMixta;

export interface IProductoPersonal {
  id: number;
  nombre: string;
  costeAnual: number;
  enabled: boolean;
}


export interface IResultadoCalculo {
  banco: string;
  tipo: string;
  taeSinBonificar: number;
  taeConBonificar: number;
  cuotaMensualSinBonificar: number;
  cuotaMensualConBonificar: number;
  costeTotalSinBonificar: number;
  costeTotalConBonificar: number;
  costeTotalBonificaciones: number;
  bonificaciones: IBonificacion[];
  desgloseGastos: {
      tasacion: number;
      broker: number;
      otros: number;
      cancelacionAnterior: number;
      total: number;
  };
  oferta: OfertaHipotecaTipo;
  tinInicial?: number;
  tinBonificado?: number;
  diferencialInicial?: number;
  diferencialBonificado?: number;
  isAssumedBaseRate?: boolean;
  costeTotalConExtras?: number;
  productosPersonalesIncluidos?: string[];
  cuotaMensualVariableSinBonificar?: number;
  cuotaMensualVariableConBonificar?: number;
  diferencialInicialVariable?: number;
  diferencialBonificadoVariable?: number;
}
