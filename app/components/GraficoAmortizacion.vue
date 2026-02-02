<template>
  <UModal
    v-model:open="open"
    :title="tituloModal"
    :ui="{ content: 'sm:max-w-4xl  h-96' }"
  >
    <template #body>
      <canvas ref="chartCanvas" />
    </template>
  </UModal>
</template>

<script setup lang="ts">
import Chart from 'chart.js/auto'

const props = defineProps<{
  modelValue: boolean
  resultado: IResultadoCalculo | null
  importe: number
  plazo: number
  euribor: number
}>()

const emit = defineEmits(['update:modelValue'])

const tituloModal = computed(() => `Gráfico de Amortización para ${props.resultado?.banco}`)

const open = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

watch(() => props.resultado, (newResultado) => {
  if (newResultado && open.value) {
    nextTick(() => {
      renderChart(newResultado)
    })
  }
})

watch(open, (isOpen) => {
  if (isOpen && props.resultado) {
    nextTick(() => {
      renderChart(props.resultado)
    })
  }
})

function renderChart(resultado: IResultadoCalculo) {
  const ctx = chartCanvas.value?.getContext('2d')
  if (!ctx) return

  const { meses, capitalRestante, interesesPagados, capitalAmortizadoAcumulado } = generarDatosAmortizacion(
    resultado.oferta,
    props.importe,
    props.plazo,
    props.euribor,
    true
  )

  if (chartInstance) {
    chartInstance.destroy()
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: meses,
      datasets: [
        {
          label: 'Capital Restante (€)',
          data: capitalRestante,
          borderColor: '#4299e1',
          backgroundColor: 'rgba(66, 153, 225, 0.2)',
          fill: false,
          tension: 0.1
        },
        {
          label: 'Intereses Pagados Acumulados (€)',
          data: interesesPagados,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          fill: false,
          tension: 0.1
        },
        {
          label: 'Capital Amortizado Acumulado (€)',
          data: capitalAmortizadoAcumulado,
          borderColor: '#10b981',
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
            label: function (context: any) {
              let label = context.dataset.label || ''
              if (label) {
                label += ': '
              }
              if (context.parsed.y !== null) {
                label += formatearNumero(context.parsed.y)
              }
              return label
            }
          }
        }
      }
    }
  })
}

function generarDatosAmortizacion(oferta: OfertaHipotecaTipo, importe: number, plazoAnios: number, euribor: number, conBonificaciones: boolean) {
  let capitalPendiente = importe
  const plazoMeses = plazoAnios * 12
  const meses: string[] = []
  const capitalRestante: number[] = []
  const interesesPagados: number[] = []
  const capitalAmortizadoAcumulado: number[] = []

  let acumuladoIntereses = 0
  let acumuladoCapital = 0

  for (let mes = 1; mes <= plazoMeses; mes++) {
    const interesMensual = CalculadoraHipoteca.obtenerInteresMensual(oferta, euribor, conBonificaciones, mes)
    const cuota = CalculadoraHipoteca.calcularCuotaFrances(capitalPendiente, interesMensual.rate, plazoMeses - mes + 1)
    const interesPagadoMes = capitalPendiente * interesMensual.rate
    const capitalAmortizadoMes = cuota - interesPagadoMes

    capitalPendiente -= capitalAmortizadoMes
    acumuladoIntereses += interesPagadoMes
    acumuladoCapital += capitalAmortizadoMes

    meses.push(`Mes ${mes}`)
    capitalRestante.push(Math.max(0, capitalPendiente)) // Asegurarse de que no baje de 0
    interesesPagados.push(acumuladoIntereses)
    capitalAmortizadoAcumulado.push(acumuladoCapital)
  }

  return { meses, capitalRestante, interesesPagados, capitalAmortizadoAcumulado }
}
</script>
