import Chart from 'chart.js/auto';

// ================================================================================= //
// TIPOS Y INTERFACES
// ================================================================================= //

interface Bonificacion {
  nombre: string;
  reduccionTin?: number;
  reduccionDiferencial?: number;
  reduccionTinFijo?: number;
  costeAnual: number;
  isSupposed?: boolean; // Nuevo campo para indicar si el valor es supuesto
}

interface OfertaBase {
  banco: string;
  gastosTasacion: number;
  comisionBroker: number;
  otrosGastos: number;
  gastosCancelacionAnterior?: number; // Nuevo campo
  bonificaciones: Bonificacion[];
}

interface OfertaFija extends OfertaBase {
  tipo: 'fija';
  tin?: number; // TIN sin bonificar (prioritario)
  tinBonificado?: number; // TIN ya bonificado al máximo
}

interface OfertaVariable extends OfertaBase {
  tipo: 'variable';
  diferencial?: number; // Diferencial sin bonificar (prioritario)
  diferencialBonificado?: number; // Diferencial ya bonificado al máximo
}

interface OfertaMixta extends OfertaBase {
  tipo: 'mixta';
  plazoFijoAnios: number;
  tinFijo?: number; // TIN fijo sin bonificar (prioritario)
  tinFijoBonificado?: number; // TIN fijo ya bonificado al máximo
  diferencial?: number; // Diferencial sin bonificar (prioritario)
  diferencialBonificado?: number; // Diferencial ya bonificado al máximo
}

type OfertaHipoteca = OfertaFija | OfertaVariable | OfertaMixta;

interface PersonalBonus {
  id: number; // Para identificar unívocamente cada producto añadido
  nombre: string;
  costeAnual: number;
  enabled: boolean;
}

interface ResultadoCalculo {
  banco: string;
  tipo: string;
  taeSinBonificar: number;
  taeConBonificar: number;
  cuotaMensualSinBonificar: number;
  cuotaMensualConBonificar: number;
  costeTotalSinBonificar: number;
  costeTotalConBonificar: number;
  costeTotalBonificaciones: number;
  bonificaciones: Bonificacion[];
  desgloseGastos: {
      tasacion: number;
      broker: number;
      otros: number;
      cancelacionAnterior: number;
      total: number;
  };
  oferta: OfertaHipoteca; // Guardar la oferta original para el gráfico
  // Nuevos campos para mostrar el TIN/Diferencial
  tinInicial?: number;
  tinBonificado?: number;
  diferencialInicial?: number;
  diferencialBonificado?: number;
  isAssumedBaseRate?: boolean; // Indica si la tasa base se infirió del TIN bonificado
  costeTotalConExtras?: number; // Nuevo campo para el coste total incluyendo productos personales no bonificables
  productosPersonalesIncluidos?: string[]; // Lista de nombres de productos personales que se han añadido al costeTotalConExtras
  cuotaMensualVariableSinBonificar?: number; // Para hipotecas mixtas
  cuotaMensualVariableConBonificar?: number; // Para hipotecas mixtas
  diferencialInicialVariable?: number; // Nuevo campo para mixtas
  diferencialBonificadoVariable?: number; // Nuevo campo para mixtas
}

interface PredefinedPersonalBonus {
  nombre: string;
  costeAnualDefecto: number;
}

// ================================================================================= //
// FUNCIONES AUXILIARES (ahora globales)
// ================================================================================= //

function calcularCuotaFrances(capital: number, interesMensual: number, meses: number): number {
    if (interesMensual <= 0) {
        return capital / meses;
    }
    return capital * (interesMensual * Math.pow(1 + interesMensual, meses)) / (Math.pow(1 + interesMensual, meses) - 1);
}

function obtenerInteresMensual(oferta: OfertaHipoteca, euribor: number, conBonificaciones: boolean, mesActual: number): { rate: number; isAssumedBase: boolean } {
    let baseRate = 0; // Este será el TIN/Diferencial ANUAL que usaremos como base para aplicar bonificaciones
    let isAssumedBase = false; // Bandera para saber si la tasa base fue inferida
    let totalReduccion = 0;

    // Helper para sumar las reducciones de bonificaciones relevantes
    const sumReductions = (bonificaciones: Bonificacion[], type: 'tin' | 'diferencial' | 'tinFijo') => {
        return bonificaciones.reduce((acc, b) => {
            if (type === 'tin' && b.reduccionTin !== undefined) return acc + b.reduccionTin;
            if (type === 'diferencial') {
                if (b.reduccionDiferencial !== undefined) return acc + b.reduccionDiferencial;
                if (b.reduccionTin !== undefined) return acc + b.reduccionTin; // Fallback for mixed variable tranche
            }
            if (type === 'tinFijo') {
                if (b.reduccionTinFijo !== undefined) return acc + b.reduccionTinFijo;
                if (b.reduccionTin !== undefined) return acc + b.reduccionTin; // Fallback for mixed fixed tranche
            }
            return acc;
        }, 0);
    };

    switch (oferta.tipo) {
        case 'fija':
            totalReduccion = sumReductions(oferta.bonificaciones, 'tin');
            if (oferta.tin !== undefined) { // Prioridad 1: TIN sin bonificar explícito
                baseRate = oferta.tin;
            } else if (oferta.tinBonificado !== undefined) { // Prioridad 2: TIN bonificado explícito, inferir base
                baseRate = oferta.tinBonificado + totalReduccion;
                isAssumedBase = true; // La tasa base ha sido inferida
            } else {
                // Si no hay ninguno, o es un error o asumimos 0.
                baseRate = 0; 
                isAssumedBase = true;
            }
            break;
        case 'variable':
            totalReduccion = sumReductions(oferta.bonificaciones, 'diferencial');
            if (oferta.diferencial !== undefined) { // Prioridad 1: Diferencial sin bonificar explícito
                baseRate = euribor + oferta.diferencial; // La tasa base de variable es E+D
            } else if (oferta.diferencialBonificado !== undefined) { // Prioridad 2: Diferencial bonificado explícito, inferir base
                baseRate = euribor + oferta.diferencialBonificado + totalReduccion;
                isAssumedBase = true;
            } else {
                baseRate = euribor; // Sin diferencial, solo euribor
                isAssumedBase = true;
            }
            break;
        case 'mixta':
            const plazoFijoMeses = oferta.plazoFijoAnios * 12;
            if (mesActual <= plazoFijoMeses) { // Tramo fijo
                totalReduccion = sumReductions(oferta.bonificaciones, 'tinFijo');
                if (oferta.tinFijo !== undefined) { // Prioridad 1: TIN fijo sin bonificar explícito
                    baseRate = oferta.tinFijo;
                } else if (oferta.tinFijoBonificado !== undefined) { // Prioridad 2: TIN fijo bonificado explícito, inferir base
                    baseRate = oferta.tinFijoBonificado + totalReduccion;
                    isAssumedBase = true;
                } else {
                    baseRate = 0; 
                    isAssumedBase = true;
                }
            } else { // Tramo variable
                totalReduccion = sumReductions(oferta.bonificaciones, 'diferencial');
                if (oferta.diferencial !== undefined) { // Prioridad 1: Diferencial sin bonificar explícito
                    baseRate = euribor + oferta.diferencial;
                } else if (oferta.diferencialBonificado !== undefined) { // Prioridad 2: Diferencial bonificado explícito, inferir base
                    baseRate = euribor + oferta.diferencialBonificado + totalReduccion;
                    isAssumedBase = true;
                } else {
                    baseRate = euribor;
                    isAssumedBase = true;
                }
            }
            break;
    }

    let finalRate = baseRate;
    if (conBonificaciones) {
        // Aplicar la reducción si estamos calculando el escenario CON bonificaciones
        finalRate = baseRate - totalReduccion;
    }

    return { rate: Math.max(0, finalRate) / 100 / 12, isAssumedBase: isAssumedBase };
}

function formatearNumero(numero: number, estilo: 'currency' | 'percent' = 'currency'): string {
    if (isNaN(numero)) return "N/A";

    if (estilo === 'percent') {
        return new Intl.NumberFormat('es-ES', {
            style: 'percent',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(numero / 100);
    }
    
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(numero);
}

function generarListaBonificaciones(bonificaciones: Bonificacion[]): string {
    let listaHTML = '<ul class="bonificaciones-lista">';
    bonificaciones.forEach(b => {
        const costeDisplay = b.costeAnual > 0 ? `${formatearNumero(b.costeAnual)}/año` : 'Sin coste';
        let reduccionDisplay = '';
        if (b.reduccionTin) reduccionDisplay += `-${b.reduccionTin.toFixed(2)}% TIN`;
        if (b.reduccionDiferencial) reduccionDisplay += `-${b.reduccionDiferencial.toFixed(2)}% Dif.`;
        if (b.reduccionTinFijo) reduccionDisplay += `-${b.reduccionTinFijo.toFixed(2)}% TIN Fijo`;
        
        const itemClasses = b.isSupposed ? 'bg-yellow-100 rounded-md p-1 mb-1' : 'mb-1';
        listaHTML += `<li class="${itemClasses}">- ${b.nombre} ${b.isSupposed ? '(Valor supuesto)' :''}: ${costeDisplay} (${reduccionDisplay.trim()})</li>`;
    });
    listaHTML += '</ul>';
    return listaHTML;
}


// ================================================================================= //
// CÁLCULO DE LA TAE (Tasa Anual Equivalente) - Ahora global
// ================================================================================= //

function calcularTAE(prestamo: number, numCuotas: number, gastosIniciales: number, flujoCuotas: number[], costeMensualProductos: number): number {
    const importeNetoRecibido = prestamo - gastosIniciales;
    
    // Función que calcula el Valor Actual Neto (VAN) de los flujos de caja
    const van = (tae: number): number => {
        // CORRECCIÓN: Usar la fórmula de la tasa efectiva para la conversión de anual a mensual.
        const tirMensual = Math.pow(1 + tae, 1/12) - 1;
        let suma = 0;
        for (let i = 0; i < numCuotas; i++) {
            suma += (flujoCuotas[i] + costeMensualProductos) / Math.pow(1 + tirMensual, i + 1);
        }
        return suma - importeNetoRecibido;
    };

    // Método de bisección para encontrar la raíz (la TAE)
    let taeMin = 0.00; // Límite inferior (0% anual)
    let taeMax = 0.20; // Límite superior (20% anual, más realista para hipotecas)
    const precision = 1e-7; // Mayor precisión (0.00001%)
    let taeMed = 0;

    // Asegurarse de que el intervalo inicial contiene la raíz
    // Si no, expandir el rango o indicar un error
    if (van(taeMin) * van(taeMax) >= 0) {
        // En un contexto real, aquí podríamos expandir el rango o loggear un error más severo
        // Por simplicidad, ajustamos el rango dinámicamente si es necesario
        // o asumimos que la raíz está fuera de un rango razonable y devolvemos NaN.
        // Para hipotecas, es muy improbable que la TAE real esté fuera de este rango inicial.
        if (van(taeMin) < 0) { // Si ambos son negativos, la TAE es mayor que taeMax. Aumentamos taeMax.
            taeMax = 0.5; // 50% anual, un rango muy amplio.
        } else { // Si ambos son positivos, la TAE es menor que taeMin. Disminuimos taeMin.
            taeMin = -0.05; // -5% anual
        }

        if (van(taeMin) * van(taeMax) >= 0) {
             // Si después del ajuste el problema persiste, es mejor indicar que no se encontró una raíz válida.
            return NaN;
        }
    }
    
    let iter = 0;
    const maxIterations = 500; // Aumentar el número de iteraciones para mayor fiabilidad
    while ((taeMax - taeMin) >= precision && iter < maxIterations) {
        taeMed = (taeMin + taeMax) / 2;
        if (van(taeMed) === 0.0) {
            break;
        } else if (van(taeMed) * van(taeMin) < 0) {
            taeMax = taeMed;
        } else {
            taeMin = taeMed;
        }
        iter++;
    }
    
    return taeMed * 100;
}

// ================================================================================= //
// CÁLCULOS INDIVIDUALES POR OFERTA (ahora global)
// ================================================================================= //

function calcularFlujoDeCuotas(oferta: OfertaHipoteca, importe: number, plazoMeses: number, euribor: number, conBonificaciones: boolean): number[] {
    let capitalPendiente = importe;
    const cuotas: number[] = [];

    if (oferta.tipo === 'fija') {
        const interesMensual = obtenerInteresMensual(oferta, euribor, conBonificaciones, 1);
        const cuotaConstante = calcularCuotaFrances(importe, interesMensual.rate, plazoMeses);
        return Array(plazoMeses).fill(cuotaConstante);
    }

    if (oferta.tipo === 'variable') {
        for (let mes = 1; mes <= plazoMeses; mes++) {
            const interesMensual = obtenerInteresMensual(oferta, euribor, conBonificaciones, mes);
            const cuota = calcularCuotaFrances(capitalPendiente, interesMensual.rate, plazoMeses - mes + 1);
            const interesPagado = capitalPendiente * interesMensual.rate;
            const capitalAmortizado = cuota - interesPagado;
            capitalPendiente -= capitalAmortizado;
            cuotas.push(cuota);
        }
        return cuotas;
    }

    if (oferta.tipo === 'mixta') {
        const plazoFijoMeses = oferta.plazoFijoAnios * 12;

        // --- Tramo Fijo ---
        const interesFijoMensual = obtenerInteresMensual(oferta, euribor, conBonificaciones, 1);
        const cuotaFija = calcularCuotaFrances(importe, interesFijoMensual.rate, plazoMeses);

        for (let mes = 1; mes <= plazoFijoMeses; mes++) {
            const interesPagado = capitalPendiente * interesFijoMensual.rate;
            const capitalAmortizado = cuotaFija - interesPagado;
            capitalPendiente -= capitalAmortizado;
            cuotas.push(cuotaFija);
        }

        // --- Tramo Variable ---
        for (let mes = plazoFijoMeses + 1; mes <= plazoMeses; mes++) {
            const interesVariableMensual = obtenerInteresMensual(oferta, euribor, conBonificaciones, mes);
            const cuotaVariable = calcularCuotaFrances(capitalPendiente, interesVariableMensual.rate, plazoMeses - mes + 1);
            const interesPagado = capitalPendiente * interesVariableMensual.rate;
            const capitalAmortizado = cuotaVariable - interesPagado;
            capitalPendiente -= capitalAmortizado;
            cuotas.push(cuotaVariable);
        }
        return cuotas;
    }

    return []; // Should not be reached with current types
}

function calcularCostes(oferta: OfertaHipoteca, importe: number, plazoMeses: number, euribor: number, conBonificaciones: boolean) {
    let costeTotalBonificaciones = 0;
    
    if (conBonificaciones) {
        costeTotalBonificaciones = oferta.bonificaciones.reduce((acc, b) => acc + (b.costeAnual || 0), 0) * (plazoMeses / 12);
    }
    
    const cuotas = calcularFlujoDeCuotas(oferta, importe, plazoMeses, euribor, conBonificaciones);
    const costeTotalPagado = cuotas.reduce((acc, cuota) => acc + cuota, 0);
    const totalGastosIniciales = (oferta.gastosTasacion || 0) + (oferta.comisionBroker || 0) + (oferta.otrosGastos || 0);

    return {
        cuotasConBonificar: conBonificaciones ? cuotas : [],
        cuotasSinBonificar: !conBonificaciones ? cuotas : [],
        costeTotalConBonificar: conBonificaciones ? costeTotalPagado + totalGastosIniciales + costeTotalBonificaciones : 0,
        costeTotalSinBonificar: !conBonificaciones ? costeTotalPagado + totalGastosIniciales : 0,
        costeTotalBonificaciones
    };
}

function calcularResultadoParaOferta(oferta: OfertaHipoteca, importe: number, plazoAnios: number, euribor: number, personalBonificaciones: PersonalBonus[]): ResultadoCalculo {
    const gastosParaTAE = (oferta.gastosTasacion || 0) + (oferta.otrosGastos || 0);
    const gastosTotalesReales = gastosParaTAE + (oferta.comisionBroker || 0) + (oferta.gastosCancelacionAnterior || 0);
    const plazoMeses = plazoAnios * 12;

    // Determinar las tasas efectivas base y bonificadas con la nueva lógica
    const baseRateInfoSinBonif = obtenerInteresMensual(oferta, euribor, false, 1); // mes 1 para tener un punto de referencia para el TIN inicial
    const baseRateInfoConBonif = obtenerInteresMensual(oferta, euribor, true, 1);

    // --- CÁLCULO SIN BONIFICACIONES ---
    const { cuotasSinBonificar, costeTotalSinBonificar } = calcularCostes(oferta, importe, plazoMeses, euribor, false);
    const taeSinBonificar = calcularTAE(importe, plazoMeses, gastosParaTAE, cuotasSinBonificar, 0);

    // --- CÁLCULO CON BONIFICACIONES ---
    const { cuotasConBonificar, costeTotalConBonificar, costeTotalBonificaciones } = calcularCostes(oferta, importe, plazoMeses, euribor, true);
    const taeConBonificar = calcularTAE(importe, plazoMeses, gastosParaTAE, cuotasConBonificar, costeTotalBonificaciones / plazoMeses);
    
    // --- CALCULAR COSTE TOTAL CON EXTRAS (incluyendo productos personales) --- 
    let costeTotalConExtras = costeTotalConBonificar;
    const productosPersonalesIncluidos: string[] = [];

    personalBonificaciones.forEach(pBonus => {
        if (pBonus.enabled) {
            // Normalizar nombres para la comparación (ej. ignorar mayúsculas/minúsculas y espacios extra)
            const pBonusNombreNormalizado = pBonus.nombre.toLowerCase().trim();
            const tieneBonificacionSimilar = oferta.bonificaciones.some(oBonus => 
                oBonus.nombre.toLowerCase().trim().includes(pBonusNombreNormalizado)
            );
            
            if (!tieneBonificacionSimilar) {
                costeTotalConExtras += pBonus.costeAnual * plazoAnios;
                productosPersonalesIncluidos.push(pBonus.nombre); // Guardar el nombre del producto incluido
            }
        }
    });

    // --- PREPARAR VALORES PARA MOSTRAR EN LA TABLA ---
    let tinInicial, tinBonificado, diferencialInicial, diferencialBonificado;
    let diferencialInicialVariable: number | undefined;
    let diferencialBonificadoVariable: number | undefined; // Nuevas variables
    let isAssumedBaseRate = baseRateInfoSinBonif.isAssumedBase; // Usar el isAssumedBase del escenario sin bonificar

    if (oferta.tipo === 'fija') {
        tinInicial = baseRateInfoSinBonif.rate * 1200; // Convertir a % anual
        tinBonificado = baseRateInfoConBonif.rate * 1200;
    } else if (oferta.tipo === 'variable') {
        // Para variable, `baseRateInfo.rate` ya contiene euribor + diferencial
        // Necesitamos extraer el diferencial
        diferencialInicial = (baseRateInfoSinBonif.rate * 1200) - euribor;
        diferencialBonificado = Math.max(0, (baseRateInfoConBonif.rate * 1200) - euribor);
    } else if (oferta.tipo === 'mixta') {
        // Para mixta, la lógica de obtenerInteresMensual ya gestiona el tramo fijo/variable
        tinInicial = (baseRateInfoSinBonif.rate * 1200); // Esto representará el TIN Fijo base
        tinBonificado = (baseRateInfoConBonif.rate * 1200); // Esto representará el TIN Fijo bonificado

        // Variable period differentials
        const plazoFijoMeses = (oferta as OfertaMixta).plazoFijoAnios * 12;
        const baseRateInfoVariableSinBonif = obtenerInteresMensual(oferta, euribor, false, plazoFijoMeses + 1);
        const baseRateInfoVariableConBonif = obtenerInteresMensual(oferta, euribor, true, plazoFijoMeses + 1);

        diferencialInicialVariable = (baseRateInfoVariableSinBonif.rate * 1200) - euribor;
        diferencialBonificadoVariable = Math.max(0, (baseRateInfoVariableConBonif.rate * 1200) - euribor);

        // The isAssumedBaseRate should also consider the variable part if it was inferred there
        if (baseRateInfoVariableSinBonif.isAssumedBase) {
            isAssumedBaseRate = true;
        }
    }

    // --- CÁLCULO DE CUOTAS VARIABLES PARA MIXTA ---
    let cuotaMensualVariableSinBonificar: number | undefined;
    let cuotaMensualVariableConBonificar: number | undefined;

    if (oferta.tipo === 'mixta') {
        const primerMesVariableIndex = (oferta as OfertaMixta).plazoFijoAnios * 12;
        if (plazoMeses > primerMesVariableIndex) {
            cuotaMensualVariableSinBonificar = cuotasSinBonificar[primerMesVariableIndex];
            cuotaMensualVariableConBonificar = cuotasConBonificar[primerMesVariableIndex];
        }
    }

    return {
        banco: oferta.banco,
        tipo: `${oferta.tipo.charAt(0).toUpperCase()}${oferta.tipo.slice(1)}`,
        taeSinBonificar,
        taeConBonificar,
        cuotaMensualSinBonificar: cuotasSinBonificar[0],
        cuotaMensualConBonificar: cuotasConBonificar[0],
        costeTotalSinBonificar: costeTotalSinBonificar, 
        costeTotalConBonificar: costeTotalConBonificar,
        costeTotalBonificaciones,
        bonificaciones: oferta.bonificaciones,
        desgloseGastos: {
            tasacion: oferta.gastosTasacion || 0,
            broker: oferta.comisionBroker || 0,
            otros: oferta.otrosGastos || 0,
            cancelacionAnterior: oferta.gastosCancelacionAnterior || 0,
            total: gastosTotalesReales
        },
        oferta: oferta,
        tinInicial,
        tinBonificado,
        diferencialInicial,
        diferencialBonificado,
        isAssumedBaseRate,
        costeTotalConExtras,
        productosPersonalesIncluidos, // Añadir el nuevo campo al resultado
        cuotaMensualVariableSinBonificar,
        cuotaMensualVariableConBonificar,
        diferencialInicialVariable, // Añadir a la interfaz de resultados
        diferencialBonificadoVariable // Añadir a la interfaz de resultados
    };
}


// ================================================================================= //
// GENERACIÓN DE LA TABLA HTML (ahora global y recibe divResultados)
// ================================================================================= //

let currentChart: Chart | null = null; // Variable global para la instancia del gráfico

function generarTabla(resultados: ResultadoCalculo[], mejorOpcionCosteTotal: number, divResultados: HTMLDivElement, inputImporte: HTMLInputElement, inputPlazo: HTMLInputElement, inputEuribor: HTMLInputElement) {
    let tablaHTML = `
        <table class="min-w-full divide-y divide-gray-200 shadow-sm rounded-lg">
            <thead class="bg-gray-50">
                <tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">Entidad y Gastos</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">Con Bonificaciones</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">Sin Bonificaciones</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">Detalle Bonificaciones</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">Acciones</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
    `;

    resultados.forEach((res, index) => {
        const esMejorOpcion = res.costeTotalConExtras === mejorOpcionCosteTotal; // Comparar con costeTotalConExtras
        const rowClasses = `border-b border-gray-200 ${(index % 2 === 1) ? 'bg-gray-50' : 'bg-white'} ${esMejorOpcion ? 'best-choice' : ''}`;
        
        let tinConBonifDisplay = '';
        let tinSinBonifDisplay = '';
        let tinBaseDisplay = '';

        if (res.oferta.tipo === 'fija') {
            tinBaseDisplay = `<span class="block text-xs text-gray-500 mt-1">TIN Base: ${res.tinInicial?.toFixed(2)}%${res.isAssumedBaseRate ? ' <span class="font-bold text-blue-700">*</span>' : ''}</span>`;
            if (res.isAssumedBaseRate && res.oferta.tipo === 'fija' && res.oferta.tinBonificado !== undefined) {
                tinBaseDisplay += `<span class="block text-xs text-gray-400">(Inferido de TIN Bonificado: ${res.oferta.tinBonificado.toFixed(2)}%)</span>`;
            }
            tinSinBonifDisplay = `<span class="block text-xs text-gray-500">TIN: ${res.tinInicial?.toFixed(2)}%</span>`;
            tinConBonifDisplay = `<span class="block text-xs text-gray-500">TIN Bonificado: ${res.tinBonificado?.toFixed(2)}%</span>`;
        } else if (res.oferta.tipo === 'variable') {
            tinBaseDisplay = `<span class="block text-xs text-gray-500 mt-1">Dif. Base: ${res.diferencialInicial?.toFixed(2)}%${res.isAssumedBaseRate ? ' <span class="font-bold text-blue-700">*</span>' : ''}</span>`;
            if (res.isAssumedBaseRate && res.oferta.tipo === 'variable' && res.oferta.diferencialBonificado !== undefined) {
                tinBaseDisplay += `<span class="block text-xs text-gray-400">(Inferido de Diferencial Bonificado: ${res.oferta.diferencialBonificado.toFixed(2)}%)</span>`;
            }
            tinSinBonifDisplay = `<span class="block text-xs text-gray-500">E + ${res.diferencialInicial?.toFixed(2)}%</span>`;
            tinConBonifDisplay = `<span class="block text-xs text-gray-500">E + ${res.diferencialBonificado?.toFixed(2)}%</span>`;
        } else if (res.oferta.tipo === 'mixta') {
            tinBaseDisplay = `<span class="block text-xs text-gray-500 mt-1">TIN Fijo Base: ${res.tinInicial?.toFixed(2)}%${res.isAssumedBaseRate ? ' <span class="font-bold text-blue-700">*</span>' : ''}</span>`;
            if (res.isAssumedBaseRate && res.oferta.tipo === 'mixta' && res.oferta.tinFijoBonificado !== undefined) {
                tinBaseDisplay += `<span class="block text-xs text-gray-400">(Inferido de TIN Fijo Bonificado: ${res.oferta.tinFijoBonificado.toFixed(2)}%)</span>`;
            }
            tinSinBonifDisplay = `<span class="block text-xs text-gray-500">TIN Fijo: ${res.tinInicial?.toFixed(2)}%</span>`;
            if (res.diferencialInicialVariable !== undefined) {
                tinSinBonifDisplay += `<span class="block text-xs text-gray-500 mt-1">Dif. Var.: ${res.diferencialInicialVariable?.toFixed(2)}%</span>`;
            }
            tinConBonifDisplay = `<span class="block text-xs text-gray-500">TIN Fijo Bonificado: ${res.tinBonificado?.toFixed(2)}%</span>`;
            if (res.diferencialBonificadoVariable !== undefined) {
                tinConBonifDisplay += `<span class="block text-xs text-gray-500 mt-1">Dif. Var. Bonificado: ${res.diferencialBonificadoVariable?.toFixed(2)}%</span>`;
            }
        }

        tablaHTML += `
            <tr class="${rowClasses}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border border-gray-200">
                    <strong>${res.banco} (${res.tipo})</strong>
                    ${tinBaseDisplay}
                    <div class="mt-2 text-xs text-gray-600">
                        <strong>Gastos Iniciales: ${formatearNumero(res.desgloseGastos.total)}</strong>
                        <ul class="list-disc list-inside ml-2">
                            <li>Tasación: ${formatearNumero(res.desgloseGastos.tasacion)}</li>
                            <li>Bróker: ${formatearNumero(res.desgloseGastos.broker)}</li>
                            <li>Otros: ${formatearNumero(res.desgloseGastos.otros)}</li>
                            <li>Cancelación Anterior: ${formatearNumero(res.desgloseGastos.cancelacionAnterior)}</li>
                        </ul>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-200">
                    <strong class="block">TAE: ${formatearNumero(res.taeConBonificar, 'percent')}</strong>
                    ${tinConBonifDisplay}
                    ${res.oferta.tipo === 'mixta' && res.cuotaMensualVariableConBonificar
                        ? `<span class="block mt-1">Cuota Fija: <strong>${formatearNumero(res.cuotaMensualConBonificar)}/mes</strong></span>
                           <span class="block">Cuota Var.: <strong>${formatearNumero(res.cuotaMensualVariableConBonificar)}/mes</strong></span>`
                        : `<span class="block mt-1">Cuota: <strong>${formatearNumero(res.cuotaMensualConBonificar)}/mes</strong></span>`
                    }
                    <div class="text-gray-600 mt-1">
                        <span>Coste Total: <strong>${formatearNumero(res.costeTotalConBonificar)}</strong></span>
                        ${(res.costeTotalBonificaciones > 0 || res.desgloseGastos.total > 0) ? `
                            <ul class="list-disc list-inside ml-2 text-xs">
                                <li>Capital + Intereses: ${formatearNumero(res.costeTotalConBonificar - res.costeTotalBonificaciones - res.desgloseGastos.total)}</li>
                                <li>Gastos Iniciales: ${formatearNumero(res.desgloseGastos.total)}</li>
                                ${res.costeTotalBonificaciones > 0 ? `<li>Coste Bonificaciones: ${formatearNumero(res.costeTotalBonificaciones)}</li>` : ''}
                            </ul>
                        ` : ''}
                    </div>
                    ${(res.productosPersonalesIncluidos && res.productosPersonalesIncluidos.length > 0) ? 
                        `<span class="text-blue-700 font-bold mt-1 block">Coste Total Real (con extras): ${formatearNumero(res.costeTotalConExtras || 0)}
                            <br><span class="text-xs font-normal">(Incluye: ${res.productosPersonalesIncluidos.join(', ')})</span>
                        </span>` : 
                        (res.costeTotalConExtras !== res.costeTotalConBonificar ? `<span class="text-blue-700 font-bold mt-1 block">Coste Total Real (con extras): ${formatearNumero(res.costeTotalConExtras || 0)}</span>` : '')
                    }
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-200">
                    <strong class="block">TAE: ${formatearNumero(res.taeSinBonificar, 'percent')}</strong>
                    ${tinSinBonifDisplay}
                     ${res.oferta.tipo === 'mixta' && res.cuotaMensualVariableSinBonificar
                        ? `<span class="block mt-1">Cuota Fija: <strong>${formatearNumero(res.cuotaMensualSinBonificar)}/mes</strong></span>
                           <span class="block">Cuota Var.: <strong>${formatearNumero(res.cuotaMensualVariableSinBonificar)}/mes</strong></span>`
                        : `<span class="block mt-1">Cuota: <strong>${formatearNumero(res.cuotaMensualSinBonificar)}/mes</strong></span>`
                    }
                    <div class="text-gray-600 mt-1">
                        <span>Coste Hipoteca (Sin Bonificaciones): <strong>${formatearNumero(res.costeTotalSinBonificar)}</strong></span>
                        ${res.desgloseGastos.total > 0 ? `
                            <ul class="list-disc list-inside ml-2 text-xs">
                                <li>Capital + Intereses (Sin Bonificaciones): ${formatearNumero(res.costeTotalSinBonificar - res.desgloseGastos.total)}</li>
                                <li>Gastos Iniciales: ${formatearNumero(res.desgloseGastos.total)}</li>
                            </ul>
                        ` : ''}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-200">
                    ${res.bonificaciones.length > 0 ? generarListaBonificaciones(res.bonificaciones) : '<span class="text-gray-500">Sin bonificaciones</span>'}
                    <div class="total-bonificacion text-gray-700">Coste total bonificaciones: ${formatearNumero(res.costeTotalBonificaciones)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium border border-gray-200">
                    <button class="view-chart-btn bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" data-index="${index}">
                        Ver Gráfico
                    </button>
                </td>
            </tr>
        `;
    });

    tablaHTML += `</tbody></table>`;
    divResultados.innerHTML = tablaHTML;

    // Añadir event listeners a los botones de gráfico después de que se haya renderizado la tabla
    document.querySelectorAll('.view-chart-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const target = event.currentTarget as HTMLButtonElement;
            const index = parseInt(target.dataset.index || '0', 10);
            const resultado = resultados[index];

            // Asegurarse de que tenemos el contexto de los inputs aquí
            mostrarGrafico(resultado, parseFloat(inputImporte.value), parseInt(inputPlazo.value, 10), parseFloat(inputEuribor.value));
        });
    });
}

// ================================================================================= //
// GRÁFICOS (ahora globales)
// ================================================================================= //

function generarDatosAmortizacion(oferta: OfertaHipoteca, importe: number, plazoAnios: number, euribor: number, conBonificaciones: boolean) {
    let capitalPendiente = importe;
    const plazoMeses = plazoAnios * 12;
    const meses: string[] = [];
    const capitalRestante: number[] = [];
    const interesesPagados: number[] = [];
    const capitalAmortizadoAcumulado: number[] = [];
    
    let acumuladoIntereses = 0;
    let acumuladoCapital = 0;

    for (let mes = 1; mes <= plazoMeses; mes++) {
        const interesMensual = obtenerInteresMensual(oferta, euribor, conBonificaciones, mes);
        const cuota = calcularCuotaFrances(capitalPendiente, interesMensual.rate, plazoMeses - mes + 1);
        const interesPagadoMes = capitalPendiente * interesMensual.rate;
        const capitalAmortizadoMes = cuota - interesPagadoMes;
        
        capitalPendiente -= capitalAmortizadoMes;
        acumuladoIntereses += interesPagadoMes;
        acumuladoCapital += capitalAmortizadoMes;

        meses.push(`Mes ${mes}`);
        capitalRestante.push(Math.max(0, capitalPendiente)); // Asegurarse de que no baje de 0
        interesesPagados.push(acumuladoIntereses);
        capitalAmortizadoAcumulado.push(acumuladoCapital);
    }

    return { meses, capitalRestante, interesesPagados, capitalAmortizadoAcumulado };
}

let chartInstance: Chart | null = null; // Variable para mantener la instancia del gráfico

function mostrarGrafico(resultado: ResultadoCalculo, importe: number, plazoAnios: number, euribor: number) {
    const modal = document.getElementById('chart-modal') as HTMLDivElement;
    const chartTitle = document.getElementById('chart-title') as HTMLHeadingElement;
    const ctx = (document.getElementById('amortization-chart') as HTMLCanvasElement).getContext('2d');

    if (!ctx) return;

    chartTitle.textContent = `Gráfico de Amortización para ${resultado.banco} (Con Bonificaciones)`;

    const { meses, capitalRestante, interesesPagados, capitalAmortizadoAcumulado } = generarDatosAmortizacion(
        resultado.oferta, 
        importe, 
        plazoAnios, 
        euribor,
        true // Mostrar siempre con bonificaciones en el gráfico por ahora
    );

    // Destruir el gráfico anterior si existe
    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: meses,
            datasets: [
                {
                    label: 'Capital Restante (€)',
                    data: capitalRestante,
                    borderColor: '#4299e1', // Tailwind blue-500
                    backgroundColor: 'rgba(66, 153, 225, 0.2)',
                    fill: false,
                    tension: 0.1
                },
                {
                    label: 'Intereses Pagados Acumulados (€)',
                    data: interesesPagados,
                    borderColor: '#ef4444', // Tailwind red-500
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    fill: false,
                    tension: 0.1
                },
                {
                    label: 'Capital Amortizado Acumulado (€)',
                    data: capitalAmortizadoAcumulado,
                    borderColor: '#10b981', // Tailwind emerald-500
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    fill: false,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Mes' } },
                y: { title: { display: true, text: 'Cantidad (€)' } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context: any) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatearNumero(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });

    modal.classList.remove('hidden');
    modal.classList.add('opacity-100'); // Para la transición de opacidad
}

// ================================================================================= //
// LÓGICA PRINCIPAL DEL COMPARADOR (reorganizada para usar funciones globales)
// ================================================================================= //

document.addEventListener('DOMContentLoaded', () => {
    const botonCalcular = document.getElementById('calcular') as HTMLButtonElement;
    const inputImporte = document.getElementById('importe') as HTMLInputElement;
    const inputPlazo = document.getElementById('plazo') as HTMLInputElement;
    const inputEuribor = document.getElementById('euribor') as HTMLInputElement;
    const divResultados = document.getElementById('tabla-resultados') as HTMLDivElement;
    const chartModal = document.getElementById('chart-modal') as HTMLDivElement;
    const closeModalBtn = document.getElementById('close-modal-btn') as HTMLButtonElement;

    // Elementos para productos personales dinámicos
    const newPersonalBonusSelect = document.getElementById('newPersonalBonusSelect') as HTMLSelectElement;
    const newPersonalBonusCostInput = document.getElementById('newPersonalBonusCost') as HTMLInputElement;
    const addPersonalBonusBtn = document.getElementById('addPersonalBonusBtn') as HTMLButtonElement;
    const personalBonusesContainer = document.getElementById('personal-bonuses-container') as HTMLDivElement;

    let personalBonificaciones: PersonalBonus[] = []; // Array para almacenar los productos personales activos del usuario
    let predefinedPersonalBonuses: PredefinedPersonalBonus[] = []; // Array para almacenar los productos cargados del JSON
    let nextPersonalBonusId = 0;

    // Función para renderizar los productos personales activos en el DOM
    function renderPersonalBonificaciones() {
        personalBonusesContainer.innerHTML = '';
        personalBonificaciones.forEach(bonus => {
            const div = document.createElement('div');
            div.id = `personal-bonus-${bonus.id}`;
            div.className = 'flex items-center gap-4 mb-2 p-2 bg-white rounded-md shadow-sm border border-gray-200';
            div.innerHTML = `
                <input type="checkbox" id="personalBonusEnabled-${bonus.id}" class="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" ${bonus.enabled ? 'checked' : ''}>
                <label for="personalBonusEnabled-${bonus.id}" class="text-gray-700 font-semibold flex-grow">${bonus.nombre}</label>
                <input type="number" id="personalBonusCost-${bonus.id}" value="${bonus.costeAnual}" step="10" min="0" 
                       class="p-1 border border-gray-300 rounded-md shadow-sm w-24 text-right" ${!bonus.enabled ? 'disabled' : ''}>
                <button data-id="${bonus.id}" class="remove-personal-bonus-btn text-red-600 hover:text-red-800 font-bold text-lg">&times;</button>
            `;
            personalBonusesContainer.appendChild(div);

            // Añadir event listeners a los elementos recién creados
            const checkbox = div.querySelector(`#personalBonusEnabled-${bonus.id}`) as HTMLInputElement;
            const costInput = div.querySelector(`#personalBonusCost-${bonus.id}`) as HTMLInputElement;
            const removeBtn = div.querySelector(`.remove-personal-bonus-btn`) as HTMLButtonElement;

            checkbox.addEventListener('change', () => {
                bonus.enabled = checkbox.checked;
                costInput.disabled = !checkbox.checked;
                if (!checkbox.checked) {
                    costInput.value = '0'; // Resetear el coste si se deshabilita
                    bonus.costeAnual = 0; // Actualizar el modelo también
                } else {
                    // Restaurar el valor original o un valor por defecto si se habilita
                    const predefined = predefinedPersonalBonuses.find(p => p.nombre === bonus.nombre);
                    bonus.costeAnual = parseFloat(costInput.value); // Usa el valor actual del input, que ya puede haber sido modificado por el usuario
                    if (bonus.costeAnual === 0 && predefined) { // Si el coste era 0 y hay un valor predefinido, restaurar
                        costInput.value = String(predefined.costeAnualDefecto);
                        bonus.costeAnual = predefined.costeAnualDefecto;
                    }
                }
                calcularComparativa();
            });

            costInput.addEventListener('change', () => {
                bonus.costeAnual = parseFloat(costInput.value);
                calcularComparativa();
            });

            removeBtn.addEventListener('click', () => {
                removePersonalBonus(bonus.id);
            });
        });
    }

    // Función para añadir un nuevo producto personal
    function addPersonalBonus() {
        const selectedOption = newPersonalBonusSelect.options[newPersonalBonusSelect.selectedIndex];
        const name = selectedOption.text.trim();
        const cost = parseFloat(newPersonalBonusCostInput.value);

        if (!name || isNaN(cost) || cost < 0) {
            alert('Por favor, selecciona un producto y/o introduce un coste anual válido.');
            return;
        }

        // Evitar añadir el mismo producto personal más de una vez (por nombre)
        if (personalBonificaciones.some(b => b.nombre === name)) {
            alert(`El producto '${name}' ya ha sido añadido.`);
            return;
        }

        const newBonus: PersonalBonus = {
            id: nextPersonalBonusId++,
            nombre: name,
            costeAnual: cost,
            enabled: true
        };
        personalBonificaciones.push(newBonus);
        renderPersonalBonificaciones();
        // Limpiar inputs o reestablecer al valor por defecto
        newPersonalBonusSelect.selectedIndex = 0; // Seleccionar la primera opción de nuevo
        if (predefinedPersonalBonuses.length > 0) {
            newPersonalBonusCostInput.value = String(predefinedPersonalBonuses[0].costeAnualDefecto);
        } else {
            newPersonalBonusCostInput.value = '0';
        }
        calcularComparativa();
    }

    // Función para eliminar un producto personal
    function removePersonalBonus(id: number) {
        personalBonificaciones = personalBonificaciones.filter(bonus => bonus.id !== id);
        renderPersonalBonificaciones();
        calcularComparativa();
    }

    // Función para cargar los productos personales predefinidos y popular el select
    async function loadPredefinedPersonalBonuses() {
        try {
            const response = await fetch('personalProducts.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            predefinedPersonalBonuses = await response.json();

            newPersonalBonusSelect.innerHTML = ''; // Limpiar opciones existentes
            predefinedPersonalBonuses.forEach(pBonus => {
                const option = document.createElement('option');
                option.value = pBonus.nombre;
                option.textContent = pBonus.nombre;
                newPersonalBonusSelect.appendChild(option);
            });

            // Establecer el coste por defecto del primer elemento
            if (predefinedPersonalBonuses.length > 0) {
                newPersonalBonusCostInput.value = String(predefinedPersonalBonuses[0].costeAnualDefecto);
            }
        } catch (error) {
            console.error('Error al cargar los productos personales predefinidos:', error);
            // Considerar mostrar un mensaje de error en la UI
        }
    }

    let ofertasHipotecas: OfertaHipoteca[] = [];

    async function cargarOfertas() {
        try {
            const response = await fetch('hipotecas.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            ofertasHipotecas = await response.json();
            calcularComparativa();
        } catch (error) {
            console.error('Error al cargar las ofertas de hipotecas:', error);
            divResultados.innerHTML = `<p class="text-red-500 text-center">Error al cargar 'hipotecas.json'. Asegúrate de que el archivo existe y el servidor está funcionando.</p>`;
        }
    }

    function calcularComparativa() {
        const importe = parseFloat(inputImporte.value);
        const plazoAnios = parseInt(inputPlazo.value, 10);
        const euribor = parseFloat(inputEuribor.value);

        if (isNaN(importe) || isNaN(plazoAnios) || isNaN(euribor) || importe <= 0 || plazoAnios <= 0) {
            divResultados.innerHTML = `<p class="text-red-500 text-center">Por favor, introduce valores válidos para todos los campos.</p>`;
            return;
        }

        if (ofertasHipotecas.length === 0) {
            divResultados.innerHTML = `<p class="text-yellow-500 text-center">No hay ofertas de hipotecas para comparar.</p>`;
            return;
        }

        const resultados = ofertasHipotecas.map(oferta => 
            calcularResultadoParaOferta(oferta, importe, plazoAnios, euribor, personalBonificaciones)
        );
        
        const mejorOpcionCosteTotal = Math.min(...resultados.map(r => r.costeTotalConExtras !== undefined ? r.costeTotalConExtras : r.costeTotalConBonificar));
        
        generarTabla(resultados, mejorOpcionCosteTotal, divResultados, inputImporte, inputPlazo, inputEuribor);
    }
    
    // Event listeners
    addPersonalBonusBtn.addEventListener('click', addPersonalBonus);
    newPersonalBonusSelect.addEventListener('change', () => {
        const selectedName = newPersonalBonusSelect.value;
        const selectedBonus = predefinedPersonalBonuses.find(b => b.nombre === selectedName);
        if (selectedBonus) {
            newPersonalBonusCostInput.value = String(selectedBonus.costeAnualDefecto);
        }
    });
    botonCalcular.addEventListener('click', cargarOfertas);
    closeModalBtn.addEventListener('click', () => {
        chartModal.classList.add('hidden');
        chartModal.classList.remove('opacity-100');
    });

    // Cargar las ofertas y los productos personales al inicio
    loadPredefinedPersonalBonuses(); // Cargar primero los productos personales
    cargarOfertas(); // Luego cargar las ofertas de hipotecas
});