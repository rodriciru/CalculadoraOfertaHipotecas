<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { VNode } from 'vue'
import type { TableColumn } from '@nuxt/ui'

const props = defineProps<{
  resultados: IResultadoCalculo[]
  mejorOpcionCosteTotal: number
}>()

const emit = defineEmits(['verGrafico'])

// Resolvemos componentes de Nuxt UI para usarlos en las funciones de renderizado
const UButton = resolveComponent('UButton')

// DEFINICIÓN DE COLUMNAS Y RENDERIZADO
const columns: TableColumn<IResultadoCalculo>[] = [
  {
    accessorKey: 'entidad', // Identificador lógico
    header: 'Entidad y Gastos',
    cell: ({ row }) => {
      const res = row.original // Accedemos al objeto completo de la fila

      // 1. Construir cabecera: Banco (Tipo)
      const header = h('strong', { class: 'text-gray-900 dark:text-white' }, `${res.banco} (${res.tipo})`)

      // 2. Construir detalles de TIN/Diferencial según tipo
      let rateDetails = null
      if (res.oferta.tipo === 'fija') {
        rateDetails = [
          h('span', { class: 'block text-xs mt-1' }, [
            `TIN Base: ${res.tinInicial?.toFixed(2)}%`,
            res.isAssumedBaseRate ? h('span', { class: 'font-bold text-blue-700' }, '*') : null
          ]),
          (res.isAssumedBaseRate && res.oferta.tinBonificado !== undefined)
            ? h('span', { class: 'block text-xs text-gray-500 dark:text-gray-300' }, `(Inferido de TIN Bonificado: ${res.oferta.tinBonificado.toFixed(2)}%)`)
            : null
        ]
      } else if (res.oferta.tipo === 'variable') {
        rateDetails = [
          h('span', { class: 'block text-xs mt-1' }, [
            `Dif. Base: ${res.diferencialInicial?.toFixed(2)}%`,
            res.isAssumedBaseRate ? h('span', { class: 'font-bold text-blue-700' }, '*') : null
          ]),
          (res.isAssumedBaseRate && res.oferta.diferencialBonificado !== undefined)
            ? h('span', { class: 'block text-xs text-gray-500 dark:text-gray-300' }, `(Inferido de Dif. Bonificado: ${res.oferta.diferencialBonificado.toFixed(2)}%)`)
            : null
        ]
      } else if (res.oferta.tipo === 'mixta') {
        rateDetails = [
          h('span', { class: 'block text-xs mt-1' }, [
            `TIN Fijo Base: ${res.tinInicial?.toFixed(2)}%`,
            res.isAssumedBaseRate ? h('span', { class: 'font-bold text-blue-700' }, '*') : null
          ]),
          (res.isAssumedBaseRate && res.oferta.tinFijoBonificado !== undefined)
            ? h('span', { class: 'block text-xs text-gray-500 dark:text-gray-300' }, `(Inferido de TIN Fijo Bonificado: ${res.oferta.tinFijoBonificado.toFixed(2)}%)`)
            : null
        ]
      }

      // 3. Lista de gastos
      const expenses = h('div', { class: 'mt-2 text-xs' }, [
        h('strong', `Gastos Iniciales: ${formatearNumero(res.desgloseGastos.total)}`),
        res.desgloseGastos.detalles && res.desgloseGastos.detalles.length > 0
          ? h('ul', { class: 'list-disc list-inside ml-2' },
              res.desgloseGastos.detalles.map(g => h('li', { class: 'text-gray-500 dark:text-gray-300' }, `${g.nombre}: ${formatearNumero(g.coste)}`))
            )
          : h('p', { class: 'text-gray-500 dark:text-gray-300 italic' }, 'Sin gastos adicionales.')
      ])

      return h('div', { class: 'whitespace-normal' }, [header, rateDetails, expenses])
    }
  },
  {
    accessorKey: 'conBonificaciones',
    header: 'Con Bonificaciones',
    cell: ({ row }) => {
      const res = row.original

      // TAE
      const tae = h('strong', { class: 'block text-gray-900 dark:text-white' }, `TAE: ${formatearNumero(res.taeConBonificar, 'percent')}`) // Detalles de Tipo (TIN Bonificado, etc)
      let typeDetails = null
      if (res.oferta.tipo === 'fija') {
        typeDetails = h('div', [h('span', { class: 'block text-xs' }, `TIN Bonificado: ${res.tinBonificado?.toFixed(2)}%`)])
      } else if (res.oferta.tipo === 'variable') {
        typeDetails = h('div', [h('span', { class: 'block text-xs' }, `E + ${res.diferencialBonificado?.toFixed(2)}%`)])
      } else if (res.oferta.tipo === 'mixta') {
        typeDetails = h('div', [
          h('span', { class: 'block text-xs' }, `TIN Fijo Bonificado: ${res.tinBonificado?.toFixed(2)}%`),
          res.diferencialBonificadoVariable !== undefined
            ? h('span', { class: 'block text-xs mt-1' }, `Dif. Var. Bonificado: ${res.diferencialBonificadoVariable?.toFixed(2)}%`)
            : null
        ])
      }

      // Cuotas
      let quotas = null
      if (res.oferta.tipo === 'mixta' && res.cuotaMensualVariableConBonificar) {
        quotas = h('div', [
          h('span', { class: 'block mt-1' }, ['Cuota Fija: ', h('strong', `${formatearNumero(res.cuotaMensualConBonificar)}/mes`)]),
          h('span', { class: 'block' }, ['Cuota Var.: ', h('strong', `${formatearNumero(res.cuotaMensualVariableConBonificar)}/mes`)])
        ])
      } else {
        quotas = h('div', [
          h('span', { class: 'block mt-1' }, ['Cuota: ', h('strong', `${formatearNumero(res.cuotaMensualConBonificar)}/mes`)])
        ])
      }

      // Coste Total y Desglose
      const breakdownItems = []
      if (res.costeTotalBonificaciones > 0 || res.desgloseGastos.total > 0) {
        breakdownItems.push(h('li', { class: 'text-gray-500 dark:text-gray-300' }, `Capital + Intereses: ${formatearNumero(res.costeTotalConBonificar - res.costeTotalBonificaciones - res.desgloseGastos.total)}`))
        breakdownItems.push(h('li', { class: 'text-gray-500 dark:text-gray-300' }, `Gastos Iniciales: ${formatearNumero(res.desgloseGastos.total)}`))
        if (res.costeTotalBonificaciones > 0) {
          breakdownItems.push(h('li', { class: 'text-gray-500 dark:text-gray-300' }, `Coste Bonificaciones: ${formatearNumero(res.costeTotalBonificaciones)}`))
        }
      }

      const totalCost = h('div', { class: 'mt-1' }, [
        h('span', ['Coste Total: ', h('strong', formatearNumero(res.costeTotalConBonificar))]),
        breakdownItems.length > 0 ? h('ul', { class: 'list-disc list-inside ml-2 text-xs' }, breakdownItems) : null
      ])

      // Coste Total Real (Extras)
      let realCost = null
      if (res.productosPersonalesIncluidos && res.productosPersonalesIncluidos.length > 0) {
        realCost = h('span', { class: 'text-blue-700 dark:text-blue-300 font-bold mt-1 block bg-blue-50 dark:bg-blue-900 p-1 rounded-md' }, [
          `Coste Total Real (con extras): ${formatearNumero(res.costeTotalConExtras || 0)}`,
          h('br'),
          h('span', { class: 'text-xs text-gray-500 dark:text-gray-300 font-normal' }, `(Incluye: ${res.productosPersonalesIncluidos.join(', ')})`)
        ])
      } else if (res.costeTotalConExtras !== res.costeTotalConBonificar) {
        realCost = h('span', { class: 'text-blue-700 dark:text-blue-300 font-bold mt-1 block bg-blue-50 dark:bg-blue-900 p-1 rounded-md' },
          `Coste Total Real (con extras): ${formatearNumero(res.costeTotalConExtras || 0)}`
        )
      }

      return h('div', { class: 'whitespace-normal' }, [tae, typeDetails, quotas, totalCost, realCost])
    }
  },
  {
    accessorKey: 'sinBonificaciones',
    header: 'Sin Bonificaciones',
    cell: ({ row }) => {
      const res = row.original

      const tae = h('strong', { class: 'block text-gray-900 dark:text-white' }, `TAE: ${formatearNumero(res.taeSinBonificar, 'percent')}`)
      let typeDetails = null
      if (res.oferta.tipo === 'fija') {
        typeDetails = h('div', [h('span', { class: 'block text-xs' }, `TIN: ${res.tinInicial?.toFixed(2)}%`)])
      } else if (res.oferta.tipo === 'variable') {
        typeDetails = h('div', [h('span', { class: 'block text-xs' }, `E + ${res.diferencialInicial?.toFixed(2)}%`)])
      } else if (res.oferta.tipo === 'mixta') {
        typeDetails = h('div', [
          h('span', { class: 'block text-xs' }, `TIN Fijo: ${res.tinInicial?.toFixed(2)}%`),
          res.diferencialInicialVariable !== undefined
            ? h('span', { class: 'block text-xs mt-1' }, `Dif. Var.: ${res.diferencialInicialVariable?.toFixed(2)}%`)
            : null
        ])
      }

      let quotas = null
      if (res.oferta.tipo === 'mixta' && res.cuotaMensualVariableSinBonificar) {
        quotas = h('div', [
          h('span', { class: 'block mt-1' }, ['Cuota Fija: ', h('strong', `${formatearNumero(res.cuotaMensualSinBonificar)}/mes`)]),
          h('span', { class: 'block' }, ['Cuota Var.: ', h('strong', `${formatearNumero(res.cuotaMensualVariableSinBonificar)}/mes`)])
        ])
      } else {
        quotas = h('div', [
          h('span', { class: 'block mt-1' }, ['Cuota: ', h('strong', `${formatearNumero(res.cuotaMensualSinBonificar)}/mes`)])
        ])
      }

      const breakdownItems = []
      if (res.desgloseGastos.total > 0) {
        breakdownItems.push(h('li', { class: 'text-gray-500 dark:text-gray-300' }, `Capital + Intereses (Sin Bonif.): ${formatearNumero(res.costeTotalSinBonificar - res.desgloseGastos.total)}`))
        breakdownItems.push(h('li', { class: 'text-gray-500 dark:text-gray-300' }, `Gastos Iniciales: ${formatearNumero(res.desgloseGastos.total)}`))
      }

      const totalCost = h('div', { class: 'mt-1' }, [
        h('span', ['Coste Hipoteca (Sin Bonificaciones): ', h('strong', formatearNumero(res.costeTotalSinBonificar))]),
        breakdownItems.length > 0 ? h('ul', { class: 'list-disc list-inside ml-2 text-xs' }, breakdownItems) : null
      ])

      return h('div', { class: 'whitespace-normal' }, [tae, typeDetails, quotas, totalCost])
    }
  },
  {
    accessorKey: 'detalleBonificaciones',
    header: 'Detalle Bonificaciones',
    cell: ({ row }) => {
      const res = row.original
      const UCheckbox = resolveComponent('UCheckbox')

      let content: VNode | VNode[] | null = null

      if (res.bonificaciones.length > 0) {
        // Mapeamos a un array de VNodes
        const lis = res.bonificaciones.map((b) => {
          // Checkbox
          const checkbox = h(UCheckbox, {
            modelValue: b.enabled, // Enlazamos al estado
            onChange: () => {
              emit('alternarBonificacion', { hipotecaId: res.oferta.id, bonificacionId: b.id })
            }
          })

          // Textos
          const texts: (string | VNode)[] = [b.nombre]
          if (b.isSupposed) texts.push(h('span', { class: 'text-gray-500' }, '(S)'))
          texts.push(`: ${b.costeAnual > 0 ? `${formatearNumero(b.costeAnual)}/año` : 'Sin coste'}`)
          if (b.reduccionTin) texts.push(h('span', { class: 'text-gray-500' }, ` -${b.reduccionTin.toFixed(2)}% TIN`))
          if (b.reduccionDiferencial) texts.push(h('span', { class: 'text-gray-500' }, ` -${b.reduccionDiferencial.toFixed(2)}% Dif.`))
          if (b.reduccionTinFijo) texts.push(h('span', { class: 'text-gray-500' }, ` -${b.reduccionTinFijo.toFixed(2)}% TIN Fijo`))

          const label = h('label', { class: 'ml-2 flex-grow' }, texts)

          // Contenedor Flex para alinear checkbox y texto
          const flexContainer = h('div', { class: 'flex items-center' }, [checkbox, label])

          return h('li', { class: `mb-1 ${!b.enabled ? 'opacity-50' : ''} ${b.isSupposed ? 'bg-yellow-100' : ''}` }, [flexContainer])
        })
        content = h('ul', { class: 'list-none p-0 m-0 text-sm' }, lis)
      } else {
        content = h('span', 'Sin bonificaciones')
      }

      const total = h('div', { class: 'font-bold mt-2 pt-2 border-t border-gray-200' }, `Coste total bonificaciones: ${formatearNumero(res.costeTotalBonificaciones)}`)

      return h('div', { class: 'whitespace-normal' }, [content, total])
    }
  },
  {
    accessorKey: 'acciones',
    header: 'Acciones',
    cell: ({ row }) => {
      return h(UButton, {
        color: 'primary',
        variant: 'solid',
        size: 'sm',
        onClick: () => emit('verGrafico', row.original) // Emitir evento con los datos de la fila
      }, () => 'Ver Gráfico')
    }
  }
]

const rowClass = (row: IResultadoCalculo) => {
  return row.costeTotalConExtras === props.mejorOpcionCosteTotal ? 'best-choice' : ''
}
</script>

<template>
  <div class="table-responsive">
    <UTable
      :data="resultados"
      :columns="columns"
      :row-class="rowClass"
      :ui="{
        td: 'whitespace-nowrap px-6 py-4 text-sm border border-gray-200'
      }"
    />
  </div>
</template>

<style scoped>
/* Estilos necesarios para la clase dinámica de la fila */
:deep(.best-choice) {
    background-color: #d1fae5 !important; /* bg-emerald-100 */
    --tw-bg-opacity: 1;
    background-color: rgb(209 250 229 / var(--tw-bg-opacity)) !important; /* Equivalent to bg-emerald-100 */
}

:deep(html.dark .best-choice) {
    --tw-bg-opacity: 1;
    background-color: rgb(6 78 59 / var(--tw-bg-opacity)) !important; /* Equivalent to bg-emerald-900 */
}

:deep(.best-choice td:first-child::before) {
    content: "⭐ ";
    font-weight: bold;
    color: black; /* Default for light theme */
}

:deep(html.dark .best-choice td:first-child::before) {
    color: white; /* Visible in dark theme */
}

.table-responsive {
    overflow-x: auto;
}
</style>
