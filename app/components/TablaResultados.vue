<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { TableMeta, Row } from '@tanstack/vue-table'

const props = defineProps<{
    resultados: IResultadoCalculo[],
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
            const header = h('strong', `${res.banco} (${res.tipo})`)

            // 2. Construir detalles de TIN/Diferencial según tipo
            let rateDetails = null
            if (res.oferta.tipo === 'fija') {
                rateDetails = [
                    h('span', { class: 'block text-xs mt-1' }, [
                        `TIN Base: ${res.tinInicial?.toFixed(2)}%`,
                        res.isAssumedBaseRate ? h('span', { class: 'font-bold text-blue-700' }, '*') : null
                    ]),
                    (res.isAssumedBaseRate && res.oferta.tinBonificado !== undefined)
                        ? h('span', { class: 'block text-xs' }, `(Inferido de TIN Bonificado: ${res.oferta.tinBonificado.toFixed(2)}%)`)
                        : null
                ]
            } else if (res.oferta.tipo === 'variable') {
                rateDetails = [
                    h('span', { class: 'block text-xs mt-1' }, [
                        `Dif. Base: ${res.diferencialInicial?.toFixed(2)}%`,
                        res.isAssumedBaseRate ? h('span', { class: 'font-bold text-blue-700' }, '*') : null
                    ]),
                    (res.isAssumedBaseRate && res.oferta.diferencialBonificado !== undefined)
                        ? h('span', { class: 'block text-xs' }, `(Inferido de Dif. Bonificado: ${res.oferta.diferencialBonificado.toFixed(2)}%)`)
                        : null
                ]
            } else if (res.oferta.tipo === 'mixta') {
                rateDetails = [
                    h('span', { class: 'block text-xs mt-1' }, [
                        `TIN Fijo Base: ${res.tinInicial?.toFixed(2)}%`,
                        res.isAssumedBaseRate ? h('span', { class: 'font-bold text-blue-700' }, '*') : null
                    ]),
                    (res.isAssumedBaseRate && res.oferta.tinFijoBonificado !== undefined)
                        ? h('span', { class: 'block text-xs' }, `(Inferido de TIN Fijo Bonificado: ${res.oferta.tinFijoBonificado.toFixed(2)}%)`)
                        : null
                ]
            }

            // 3. Lista de gastos
            const expenses = h('div', { class: 'mt-2 text-xs' }, [
                h('strong', `Gastos Iniciales: ${formatearNumero(res.desgloseGastos.total)}`),
                h('ul', { class: 'list-disc list-inside ml-2' }, [
                    h('li', `Tasación: ${formatearNumero(res.desgloseGastos.tasacion)}`),
                    h('li', `Bróker: ${formatearNumero(res.desgloseGastos.broker)}`),
                    h('li', `Otros: ${formatearNumero(res.desgloseGastos.otros)}`),
                    h('li', `Cancelación Anterior: ${formatearNumero(res.desgloseGastos.cancelacionAnterior)}`),
                ])
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
            const tae = h('strong', { class: 'block' }, `TAE: ${formatearNumero(res.taeConBonificar, 'percent')}`)

            // Detalles de Tipo (TIN Bonificado, etc)
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
                breakdownItems.push(h('li', `Capital + Intereses: ${formatearNumero(res.costeTotalConBonificar - res.costeTotalBonificaciones - res.desgloseGastos.total)}`))
                breakdownItems.push(h('li', `Gastos Iniciales: ${formatearNumero(res.desgloseGastos.total)}`))
                if (res.costeTotalBonificaciones > 0) {
                    breakdownItems.push(h('li', `Coste Bonificaciones: ${formatearNumero(res.costeTotalBonificaciones)}`))
                }
            }

            const totalCost = h('div', { class: 'mt-1' }, [
                h('span', ['Coste Total: ', h('strong', formatearNumero(res.costeTotalConBonificar))]),
                breakdownItems.length > 0 ? h('ul', { class: 'list-disc list-inside ml-2 text-xs' }, breakdownItems) : null
            ])

            // Coste Total Real (Extras)
            let realCost = null
            if (res.productosPersonalesIncluidos && res.productosPersonalesIncluidos.length > 0) {
                realCost = h('span', { class: 'text-blue-700 font-bold mt-1 block' }, [
                    `Coste Total Real (con extras): ${formatearNumero(res.costeTotalConExtras || 0)}`,
                    h('br'),
                    h('span', { class: 'text-xs font-normal' }, `(Incluye: ${res.productosPersonalesIncluidos.join(', ')})`)
                ])
            } else if (res.costeTotalConExtras !== res.costeTotalConBonificar) {
                realCost = h('span', { class: 'text-blue-700 font-bold mt-1 block' },
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

            const tae = h('strong', { class: 'block' }, `TAE: ${formatearNumero(res.taeSinBonificar, 'percent')}`)

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
                breakdownItems.push(h('li', `Capital + Intereses (Sin Bonif.): ${formatearNumero(res.costeTotalSinBonificar - res.desgloseGastos.total)}`))
                breakdownItems.push(h('li', `Gastos Iniciales: ${formatearNumero(res.desgloseGastos.total)}`))
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
            let content = null

            if (res.bonificaciones.length > 0) {
                // Crear lista de LIs
                const lis = res.bonificaciones.map(b => {
                    let texts = [`- ${b.nombre} ${b.isSupposed ? '(Valor supuesto)' : ''}: ${b.costeAnual > 0 ? `${formatearNumero(b.costeAnual)}/año` : 'Sin coste'}`]
                    if (b.reduccionTin) texts.push(` -${b.reduccionTin.toFixed(2)}% TIN`)
                    if (b.reduccionDiferencial) texts.push(` -${b.reduccionDiferencial.toFixed(2)}% Dif.`)
                    if (b.reduccionTinFijo) texts.push(` -${b.reduccionTinFijo.toFixed(2)}% TIN Fijo`)

                    return h('li', { class: b.isSupposed ? 'bg-yellow-100 rounded-md p-1 mb-1' : 'mb-1' }, texts)
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

const meta: TableMeta<IResultadoCalculo> = {
    class: {
        tr: (row: Row<IResultadoCalculo>) => {
            return row.original.costeTotalConExtras === props.mejorOpcionCosteTotal ? 'best-choice' : ''
        }
    }
}
</script>

<template>
    <div class="table-responsive">
        <UTable :data="resultados" :columns="columns" :meta="meta" :ui="{
            td: 'whitespace-nowrap px-6 py-4 text-sm border border-gray-200',
            base: 'border border-gray-200 border-collapse'
        }" />
    </div>
</template>

<style scoped>
/* Estilos necesarios para la clase dinámica de la fila */
:deep(.best-choice) {
    background-color: #d1fae5 !important;
    /* bg-emerald-100 */
}

:deep(.best-choice td:first-child::before) {
    content: "⭐ ";
    font-weight: bold;
}

.table-responsive {
    overflow-x: auto;
}
</style>