<script setup lang="ts">

import type { TableColumn } from '@nuxt/ui'
import type { TableMeta, Row } from '@tanstack/vue-table'

// Resolvemos componentes de Nuxt UI para usarlos dentro de las funciones de renderizado (JS)
const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')

// ----------------------------------------------------------------------
// 1. TIPADO DE DATOS
// ----------------------------------------------------------------------
interface IBonificacion {
  nombre: string
  costeAnual: number
  reduccionTin?: number
  isSupposed: boolean
}

interface OfertaHipotecaTipo {
  id?: number | string // Identificador para la fila
  banco: string
  tipo: 'fija' | 'variable' | 'mixta'
  
  // Tasas
  tin?: number
  tinBonificado?: number
  diferencial?: number
  diferencialBonificado?: number
  tinFijo?: number
  tinFijoBonificado?: number
  plazoFijoAnios?: number
  
  // Datos extra
  bonificaciones?: IBonificacion[]
  gastosTasacion?: number
  comisionBroker?: number
  otrosGastos?: number
  gastosCancelacionAnterior?: number
}

// Estado de datos
const hipotecas = ref<OfertaHipotecaTipo[]>([])
const loading = ref(false)

// Estado del Editor
const formRef = ref<HTMLElement | null>(null) // Referencia para el scroll
const editorDefaultState = {
  active: false,
  index: -1,
  data: {} as Partial<OfertaHipotecaTipo> & { bonificaciones: IBonificacion[] },
}
const editor = reactive(JSON.parse(JSON.stringify(editorDefaultState)))

// Helpers de formato visual
const fmtPerc = (val: number | undefined) => (val !== undefined && val !== null) ? `${val.toFixed(2)}%` : '-'


const columns: TableColumn<OfertaHipotecaTipo>[] = [
  {
    accessorKey: 'banco',
    header: 'Banco',
    cell: ({ row }) => { 
      const res = row.original
      return h('span', { class: 'font-bold text-gray-900 dark:text-white' }, res.banco)
    }
  },
  {
    accessorKey: 'tipo',
    header: 'Tipo',
    cell: ({ row }) => {
      const res = row.original
      const colors = { fija: 'success', variable: 'error', mixta: 'warning' } as const
      const label = res.tipo.charAt(0).toUpperCase() + res.tipo.slice(1)
      return h(UBadge, { variant: 'subtle', color: colors[res.tipo] || 'gray' }, () => label)
    }
  },
  {
    accessorKey: 'baseRate', // Columna virtual
    header: 'TIN/Dif. Base',
    cell: ({ row }) => {
      const res = row.original
      if (res.tipo === 'fija') return h('span', `${fmtPerc(res.tin)} TIN`)
      if (res.tipo === 'variable') return h('span', `E + ${fmtPerc(res.diferencial)}`)
      if (res.tipo === 'mixta') {
        return h('div', { class: 'text-sm' }, [
          h('div', `${fmtPerc(res.tinFijo)} TIN Fijo`),
          h('div', { class: 'text-xs text-gray-500' }, `luego E + ${fmtPerc(res.diferencial)}`)
        ])
      }
      return '-'
    }
  },
  {
    accessorKey: 'bonifiedRate', // Columna virtual
    header: 'TIN/Dif. Bonif.',
    cell: ({ row }) => {
      const res = row.original
      const styles = 'font-bold text-emerald-600 dark:text-emerald-400'
      if (res.tipo === 'fija') return h('span', { class: styles }, `${fmtPerc(res.tinBonificado)} TIN`)
      if (res.tipo === 'variable') return h('span', { class: styles }, `E + ${fmtPerc(res.diferencialBonificado)}`)
      if (res.tipo === 'mixta') {
        return h('div', [
          h('div', { class: styles }, `${fmtPerc(res.tinFijoBonificado)} TIN Fijo`),
          h('div', { class: 'text-xs text-gray-500' }, `luego E + ${fmtPerc(res.diferencialBonificado)}`)
        ])
      }
      return '-'
    }
  },
  {
    accessorKey: 'acciones',
    header: 'Acciones',
    cell: ({ row }) => {
      const res = row.original
      return h('div', { class: 'flex gap-2' }, [
        h(UButton, {
          icon: 'i-heroicons-pencil-square',
          size: '2xs',
          color: 'amber',
          variant: 'ghost',
          onClick: () => openEditor(res, row.index) // Pasamos los datos directos
        }),
        h(UButton, {
          icon: 'i-heroicons-trash',
          size: '2xs',
          color: 'red',
          variant: 'ghost',
          onClick: () => removeHipoteca(row.index)
        })
      ])
    }
  }
]

// ----------------------------------------------------------------------
// 3. LOGICA DE DATOS
// ----------------------------------------------------------------------

async function fetchHipotecas() {
  loading.value = true
  try {
    const data = await $fetch<OfertaHipotecaTipo[]>('/api/hipotecas')
    hipotecas.value = data || []
  } catch (error) {
    console.warn('API no disponible, cargando datos de prueba local.')
  } finally {
    loading.value = false
  }
}

async function saveToServer() {
  try {
    await $fetch('/api/hipotecas', { method: 'POST', body: hipotecas.value })
  } catch (e) {
    console.log('Error guardando en API (ignoralo si trabajas en local)')
  }
}

// ----------------------------------------------------------------------
// 4. LOGICA DEL EDITOR (INLINE)
// ----------------------------------------------------------------------

function openEditor(hipoteca: Partial<OfertaHipotecaTipo> = {}, index = -1) {
  // 1. Configuramos el estado
  editor.index = index
  editor.data = JSON.parse(JSON.stringify(hipoteca))
  if (!editor.data.bonificaciones) editor.data.bonificaciones = []
  if (!editor.data.tipo) editor.data.tipo = 'fija' // Default
  
  // 2. Activamos el formulario
  editor.active = true
  
  // 3. Hacemos Scroll suave hacia el formulario
  nextTick(() => {
    formRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

function closeEditor() {
  editor.active = false
  // Limpiamos datos despues de la animación
  setTimeout(() => {
    Object.assign(editor, JSON.parse(JSON.stringify(editorDefaultState)))
  }, 300)
}

function saveForm() {
  const payload = { ...editor.data } as OfertaHipotecaTipo
  
  if (editor.index > -1) {
    hipotecas.value[editor.index] = payload
  } else {
    // Generar ID temporal si es nuevo
    payload.id = Date.now()
    hipotecas.value.push(payload)
  }
  
  saveToServer()
  closeEditor()
  // Scroll arriba
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function removeHipoteca(index: number) {
  if (confirm('¿Eliminar esta oferta?')) {
    hipotecas.value.splice(index, 1)
    saveToServer()
    // Si estábamos editando la que borramos, cerrar editor
    if (editor.index === index) closeEditor()
  }
}

// Métodos de bonificaciones
function addBonif() {
    editor.data.bonificaciones.push({ nombre: '', costeAnual: 0, isSupposed: false })
}
function removeBonif(idx: number) {
    editor.data.bonificaciones.splice(idx, 1)
}

// Inicialización
onMounted(fetchHipotecas)
</script>

<template>
  <div class="container mx-auto p-4 max-w-5xl">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Hipotecas</h1>
      <!-- Botón añadir arriba -->
      <UButton 
        @click="openEditor({}, -1)" 
        icon="i-heroicons-plus" 
        size="md"
        color="primary"
      >
        Añadir Oferta
      </UButton>
    </div>

    <!-- TABLA DE HIPOTECAS -->
    <!-- Iteramos columnas para usar las render functions JS -->
    <UTable 
      :data="hipotecas" 
      :columns="columns" 
      :loading="loading"
      class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm mb-8"
    >
      <!-- TRUCO PARA RENDERIZAR COLUMNAS DEFINIDAS EN JS -->
      <!-- Iteramos cada columna definida en 'columns' -->
      <template v-for="col in columns" :key="col.key" #[`${col.key}-data`]="{ row, index }">
        <!-- Renderizamos lo que devuelve la función render(row) -->
        <component :is="() => col.render(row, index)" />
      </template>
    </UTable>

    <!-- FORMULARIO DE EDICIÓN (DEBAJO DE LA TABLA) -->
    <!-- Aparece solo si editor.active es true -->
    <div v-if="editor.active" ref="formRef" class="editor-section mt-8">
      
      <UCard :ui="{ ring: 'ring-1 ring-gray-200 dark:ring-gray-700', shadow: 'shadow-lg' }">
        <template #header>
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-semibold text-primary-600">
              {{ editor.index === -1 ? 'Nueva Oferta Hipotecaria' : `Editando: ${editor.data.banco}` }}
            </h3>
            <UButton icon="i-heroicons-x-mark" color="gray" variant="ghost" @click="closeEditor" />
          </div>
        </template>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
            
          <!-- COLUMNA IZQUIERDA: DATOS PRINCIPALES -->
          <div class="md:col-span-4 space-y-4">
             <UFormField label="Banco Entidad">
                <UInput v-model="editor.data.banco" icon="i-heroicons-building-library" autofocus />
             </UFormField>
             <UFormField label="Tipo de interés">
                <USelect v-model="editor.data.tipo" :options="['fija', 'variable', 'mixta']" />
             </UFormField>
          </div>

          <!-- COLUMNA DERECHA: CONDICIONES DETALLADAS -->
          <div class="md:col-span-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
             
             <!-- TIPO FIJO -->
             <div v-if="editor.data.tipo === 'fija'" class="grid grid-cols-2 gap-4">
                <UFormField label="TIN Base %"><UInput v-model.number="editor.data.tin" type="number" step="0.05" /></UFormField>
                <UFormField label="TIN Bonificado %"><UInput v-model.number="editor.data.tinBonificado" type="number" step="0.05" /></UFormField>
             </div>

             <!-- TIPO VARIABLE -->
             <div v-else-if="editor.data.tipo === 'variable'" class="grid grid-cols-2 gap-4">
                <UFormField label="Diferencial Base %"><UInput v-model.number="editor.data.diferencial" type="number" step="0.05" /></UFormField>
                <UFormField label="Diferencial Bonificado %"><UInput v-model.number="editor.data.diferencialBonificado" type="number" step="0.05" /></UFormField>
             </div>

             <!-- TIPO MIXTA -->
             <div v-else-if="editor.data.tipo === 'mixta'" class="space-y-3">
                <div class="grid grid-cols-3 gap-3">
                   <UFormField label="Años Fijos"><UInput v-model.number="editor.data.plazoFijoAnios" type="number" /></UFormField>
                   <UFormField label="TIN Fijo %"><UInput v-model.number="editor.data.tinFijo" type="number" step="0.05" /></UFormField>
                   <UFormField label="TIN Fijo Bonif. %"><UInput v-model.number="editor.data.tinFijoBonificado" type="number" step="0.05" /></UFormField>
                </div>
                <div class="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                   <UFormField label="Diferencial Variable %"><UInput v-model.number="editor.data.diferencial" type="number" step="0.05" /></UFormField>
                   <UFormField label="Dif. Variable Bonif. %"><UInput v-model.number="editor.data.diferencialBonificado" type="number" step="0.05" /></UFormField>
                </div>
             </div>
          </div>
          
          <div class="col-span-full"><UDivider label="Gastos y Bonificaciones" /></div>

          <!-- GASTOS -->
          <div class="md:col-span-4 space-y-2">
             <h4 class="font-medium text-sm text-gray-500 mb-2">Gastos Iniciales (€)</h4>
             <div class="grid grid-cols-2 gap-2">
                 <UInput placeholder="Tasación" v-model.number="editor.data.gastosTasacion" type="number"><template #trailing>€</template></UInput>
                 <UInput placeholder="Bróker" v-model.number="editor.data.comisionBroker" type="number"><template #trailing>€</template></UInput>
             </div>
          </div>

          <!-- LISTA BONIFICACIONES -->
          <div class="md:col-span-8">
              <div class="flex justify-between mb-2">
                 <h4 class="font-medium text-sm text-gray-500">Bonificaciones (Productos vinculados)</h4>
                 <UButton size="2xs" icon="i-heroicons-plus" variant="link" @click="addBonif">Añadir</UButton>
              </div>
              <div v-if="editor.data.bonificaciones?.length" class="space-y-2">
                 <div v-for="(bon, bIndex) in editor.data.bonificaciones" :key="bIndex" class="flex gap-2 items-center">
                    <UInput v-model="bon.nombre" placeholder="Nombre" class="w-full" size="sm" />
                    <UInput v-model.number="bon.costeAnual" placeholder="Coste €/año" class="w-24" type="number" size="sm" />
                    <UButton icon="i-heroicons-trash" color="red" variant="ghost" @click="removeBonif(bIndex)" />
                 </div>
              </div>
              <p v-else class="text-xs text-gray-400 italic">No hay bonificaciones añadidas.</p>
          </div>

        </div>

        <template #footer>
          <div class="flex justify-end gap-3">
             <UButton label="Cancelar" color="white" @click="closeEditor" />
             <UButton label="Guardar Cambios" color="black" icon="i-heroicons-check" @click="saveForm" />
          </div>
        </template>

      </UCard>
    </div>
  </div>
</template>

<style scoped>
/* Transición de entrada para el editor */
.editor-section {
    animation: slideDown 0.4s ease-out;
}

@keyframes slideDown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>