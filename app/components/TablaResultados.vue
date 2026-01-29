<template>
  <div class="table-responsive">
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
        <tr v-for="(res, index) in resultados" :key="index" :class="['border-b border-gray-200', (index % 2 === 1) ? 'bg-gray-50' : 'bg-white', res.costeTotalConExtras === mejorOpcionCosteTotal ? 'best-choice' : '']">
          
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border border-gray-200">
            <strong>{{ res.banco }} ({{ res.tipo }})</strong>
            
            <div v-if="res.oferta.tipo === 'fija'">
              <span class="block text-xs text-gray-500 mt-1">TIN Base: {{ res.tinInicial?.toFixed(2) }}%<span v-if="res.isAssumedBaseRate" class="font-bold text-blue-700">*</span></span>
              <span v-if="res.isAssumedBaseRate && res.oferta.tinBonificado !== undefined" class="block text-xs text-gray-400">(Inferido de TIN Bonificado: {{ res.oferta.tinBonificado.toFixed(2) }}%)</span>
            </div>
            <div v-else-if="res.oferta.tipo === 'variable'">
               <span class="block text-xs text-gray-500 mt-1">Dif. Base: {{ res.diferencialInicial?.toFixed(2) }}%<span v-if="res.isAssumedBaseRate" class="font-bold text-blue-700">*</span></span>
              <span v-if="res.isAssumedBaseRate && res.oferta.diferencialBonificado !== undefined" class="block text-xs text-gray-400">(Inferido de Diferencial Bonificado: {{ res.oferta.diferencialBonificado.toFixed(2) }}%)</span>
            </div>
             <div v-else-if="res.oferta.tipo === 'mixta'">
                <span class="block text-xs text-gray-500 mt-1">TIN Fijo Base: {{ res.tinInicial?.toFixed(2) }}%<span v-if="res.isAssumedBaseRate" class="font-bold text-blue-700">*</span></span>
                <span v-if="res.isAssumedBaseRate && res.oferta.tinFijoBonificado !== undefined" class="block text-xs text-gray-400">(Inferido de TIN Fijo Bonificado: {{ res.oferta.tinFijoBonificado.toFixed(2) }}%)</span>
            </div>

            <div class="mt-2 text-xs text-gray-600">
                <strong>Gastos Iniciales: {{ formatearNumero(res.desgloseGastos.total) }}</strong>
                <ul class="list-disc list-inside ml-2">
                    <li>Tasación: {{ formatearNumero(res.desgloseGastos.tasacion) }}</li>
                    <li>Bróker: {{ formatearNumero(res.desgloseGastos.broker) }}</li>
                    <li>Otros: {{ formatearNumero(res.desgloseGastos.otros) }}</li>
                    <li>Cancelación Anterior: {{ formatearNumero(res.desgloseGastos.cancelacionAnterior) }}</li>
                </ul>
            </div>
          </td>

          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-200">
            <strong class="block">TAE: {{ formatearNumero(res.taeConBonificar, 'percent') }}</strong>
             <div v-if="res.oferta.tipo === 'fija'">
                <span class="block text-xs text-gray-500">TIN Bonificado: {{ res.tinBonificado?.toFixed(2) }}%</span>
            </div>
            <div v-else-if="res.oferta.tipo === 'variable'">
                <span class="block text-xs text-gray-500">E + {{ res.diferencialBonificado?.toFixed(2) }}%</span>
            </div>
            <div v-else-if="res.oferta.tipo === 'mixta'">
                <span class="block text-xs text-gray-500">TIN Fijo Bonificado: {{ res.tinBonificado?.toFixed(2) }}%</span>
                <span v-if="res.diferencialBonificadoVariable !== undefined" class="block text-xs text-gray-500 mt-1">Dif. Var. Bonificado: {{ res.diferencialBonificadoVariable?.toFixed(2) }}%</span>
            </div>

            <div v-if="res.oferta.tipo === 'mixta' && res.cuotaMensualVariableConBonificar">
                <span class="block mt-1">Cuota Fija: <strong>{{ formatearNumero(res.cuotaMensualConBonificar) }}/mes</strong></span>
                <span class="block">Cuota Var.: <strong>{{ formatearNumero(res.cuotaMensualVariableConBonificar) }}/mes</strong></span>
            </div>
            <div v-else>
                <span class="block mt-1">Cuota: <strong>{{ formatearNumero(res.cuotaMensualConBonificar) }}/mes</strong></span>
            </div>
            
            <div class="text-gray-600 mt-1">
                <span>Coste Total: <strong>{{ formatearNumero(res.costeTotalConBonificar) }}</strong></span>
                <ul v-if="res.costeTotalBonificaciones > 0 || res.desgloseGastos.total > 0" class="list-disc list-inside ml-2 text-xs">
                    <li>Capital + Intereses: {{ formatearNumero(res.costeTotalConBonificar - res.costeTotalBonificaciones - res.desgloseGastos.total) }}</li>
                    <li>Gastos Iniciales: {{ formatearNumero(res.desgloseGastos.total) }}</li>
                    <li v-if="res.costeTotalBonificaciones > 0">Coste Bonificaciones: {{ formatearNumero(res.costeTotalBonificaciones) }}</li>
                </ul>
            </div>
             <span v-if="res.productosPersonalesIncluidos && res.productosPersonalesIncluidos.length > 0" class="text-blue-700 font-bold mt-1 block">
                Coste Total Real (con extras): {{ formatearNumero(res.costeTotalConExtras || 0) }}
                <br><span class="text-xs font-normal">(Incluye: {{ res.productosPersonalesIncluidos.join(', ') }})</span>
            </span>
             <span v-else-if="res.costeTotalConExtras !== res.costeTotalConBonificar" class="text-blue-700 font-bold mt-1 block">
                Coste Total Real (con extras): {{ formatearNumero(res.costeTotalConExtras || 0) }}
            </span>
          </td>

          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-200">
             <strong class="block">TAE: {{ formatearNumero(res.taeSinBonificar, 'percent') }}</strong>
              <div v-if="res.oferta.tipo === 'fija'">
                <span class="block text-xs text-gray-500">TIN: {{ res.tinInicial?.toFixed(2) }}%</span>
            </div>
            <div v-else-if="res.oferta.tipo === 'variable'">
                <span class="block text-xs text-gray-500">E + {{ res.diferencialInicial?.toFixed(2) }}%</span>
            </div>
            <div v-else-if="res.oferta.tipo === 'mixta'">
                <span class="block text-xs text-gray-500">TIN Fijo: {{ res.tinInicial?.toFixed(2) }}%</span>
                <span v-if="res.diferencialInicialVariable !== undefined" class="block text-xs text-gray-500 mt-1">Dif. Var.: {{ res.diferencialInicialVariable?.toFixed(2) }}%</span>
            </div>

             <div v-if="res.oferta.tipo === 'mixta' && res.cuotaMensualVariableSinBonificar">
                <span class="block mt-1">Cuota Fija: <strong>{{ formatearNumero(res.cuotaMensualSinBonificar) }}/mes</strong></span>
                <span class="block">Cuota Var.: <strong>{{ formatearNumero(res.cuotaMensualVariableSinBonificar) }}/mes</strong></span>
            </div>
            <div v-else>
                 <span class="block mt-1">Cuota: <strong>{{ formatearNumero(res.cuotaMensualSinBonificar) }}/mes</strong></span>
            </div>

            <div class="text-gray-600 mt-1">
                <span>Coste Hipoteca (Sin Bonificaciones): <strong>{{ formatearNumero(res.costeTotalSinBonificar) }}</strong></span>
                <ul v-if="res.desgloseGastos.total > 0" class="list-disc list-inside ml-2 text-xs">
                    <li>Capital + Intereses (Sin Bonificaciones): {{ formatearNumero(res.costeTotalSinBonificar - res.desgloseGastos.total) }}</li>
                    <li>Gastos Iniciales: {{ formatearNumero(res.desgloseGastos.total) }}</li>
                </ul>
            </div>
          </td>

          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-200">
            <ul v-if="res.bonificaciones.length > 0" class="bonificaciones-lista">
                <li v-for="b in res.bonificaciones" :class="[b.isSupposed ? 'bg-yellow-100 rounded-md p-1 mb-1' : 'mb-1']">
                    - {{ b.nombre }} {{ b.isSupposed ? '(Valor supuesto)' : '' }}: {{ b.costeAnual > 0 ? `${formatearNumero(b.costeAnual)}/año` : 'Sin coste' }}
                    <span v-if="b.reduccionTin"> -{{ b.reduccionTin.toFixed(2) }}% TIN</span>
                    <span v-if="b.reduccionDiferencial"> -{{ b.reduccionDiferencial.toFixed(2) }}% Dif.</span>
                    <span v-if="b.reduccionTinFijo"> -{{ b.reduccionTinFijo.toFixed(2) }}% TIN Fijo</span>
                </li>
            </ul>
            <span v-else class="text-gray-500">Sin bonificaciones</span>
            <div class="total-bonificacion text-gray-700">Coste total bonificaciones: {{ formatearNumero(res.costeTotalBonificaciones) }}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium border border-gray-200">
            <UButton @click="$emit('verGrafico', res)">Ver Gráfico</UButton>
          </td>

        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">

const props = defineProps<{
  resultados: IResultadoCalculo[],
  mejorOpcionCosteTotal: number
}>();
</script>

<style scoped>
.best-choice {
    background-color: #d1fae5 !important;
}
.best-choice td:first-child::before {
    content: "⭐ ";
    font-weight: bold;
}
.table-responsive {
    overflow-x: auto;
}
.bonificaciones-lista {
    list-style-type: none;
    padding: 0;
    margin: 0;
    font-size: 0.875em;
}
.total-bonificacion {
    font-weight: bold;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #e5e7eb;
}
</style>
