<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

import { nextTick, resolveComponent } from 'vue'

// Resolvemos componentes de Nuxt UI para usarlos dentro de las funciones de renderizado (JS)
const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const _UIcon = resolveComponent('UIcon')
const USelect = resolveComponent('USelect') // Añadido
const UInput = resolveComponent('UInput')
const UCheckbox = resolveComponent('UCheckbox') // Añadido

// ----------------------------------------------------------------------
// 1. TIPADO DE DATOS
// ----------------------------------------------------------------------

// Estado de datos
const hipotecas = ref<OfertaHipotecaTipo[]>([])
const loading = ref(false)
const gastos = ref<IGasto[]>([])
const nuevoGastoSeleccionado = ref<string>('')
const costoNuevoGasto = ref<number>(0)
const nuevoGastoPersonalizadoNombre = ref<string>('')
const nuevoGastoPersonalizadoCoste = ref<number>(0)

// BONIFICACIONES (Catálogo y selección en editor)
const bonificacionesCatalogo = ref<Array<Pick<IBonificacion, 'id' | 'nombre'>>>([]) // Catálogo global simplificado
const nuevaBonificacionSeleccionada = ref<string>('') // Nombre de la bonificación predefinida seleccionada
const costoBonificacionAAnadir = ref<number>(0)
const reduccionBonificacionAAnadir = ref<number | undefined>(undefined)
const isSupposedBonificacionAAnadir = ref<boolean>(false)

// Campos para crear y añadir una bonificación personalizada al catálogo y a la oferta
const nombreBonificacionPersonalizada = ref<string>('')
const costeAnualBonificacionPersonalizada = ref<number>(0)
const reduccionBonificacionPersonalizada = ref<number | undefined>(undefined)
const isSupposedBonificacionPersonalizada = ref<boolean>(false)

// Estado del Editor
const formRef = ref<HTMLElement | null>(null)
const editorDefaultState = {
  active: false,
  index: -1,
  data: {} as Partial<OfertaHipotecaTipo> & { bonificaciones: IBonificacion[], gastosAdicionales: IGasto[] }
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
          color: 'success',
          variant: 'ghost',
          onClick: () => openEditor(res, row.index)
        }),
        h(UButton, {
          icon: 'i-heroicons-trash',
          size: '2xs',
          color: 'error',
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
    console.warn('API no disponible.', error)
  } finally {
    loading.value = false
  }
}

async function loadGastos() {
  try {
    const data = await $fetch<IGasto[]>('/api/gastos')
    gastos.value = data
    if (gastos.value.length > 0 && gastos.value[0]) {
      if (!gastos.value[0].id) gastos.value[0].id = Date.now() // Asegurar ID
      nuevoGastoSeleccionado.value = gastos.value[0].nombre
      costoNuevoGasto.value = gastos.value[0].coste
    }
  } catch (error) {
    console.error('Error al cargar los gastos:', error)
  }
}

async function saveGastosToServer() {
  try {
    await $fetch('/api/gastosPredefinidos', {
      method: 'POST',
      body: gastos.value
    })
  } catch (error) {
    console.error('Error al guardar gastos predefinidos en el servidor:', error)
  }
}

async function loadBonificacionesCatalogo() {
  try {
    const data = await $fetch<Array<Pick<IBonificacion, 'id' | 'nombre'>>>('/api/bonificaciones')
    bonificacionesCatalogo.value = data
    if (bonificacionesCatalogo.value.length > 0 && bonificacionesCatalogo.value[0]) {
      // Inicializar la bonificación seleccionada con el primer elemento del catálogo
      nuevaBonificacionSeleccionada.value = bonificacionesCatalogo.value[0].nombre
      // El watcher se encargará de pre-rellenar los campos de edición
    }
  } catch (error) {
    console.error('Error al cargar el catálogo de bonificaciones:', error)
  }
}

async function saveBonificacionesCatalogoToServer() {
  try {
    const dataToSave = bonificacionesCatalogo.value.map(b => ({ id: b.id, nombre: b.nombre }))
    await $fetch('/api/bonificaciones', {
      method: 'POST',
      body: dataToSave
    })
  } catch (error) {
    console.error('Error al guardar el catálogo de bonificaciones en el servidor:', error)
  }
}

async function saveToServer() {
  try {
    await $fetch('/api/hipotecas', { method: 'POST', body: hipotecas.value })
  } catch (e) {
    console.error('Error guardando en API', e)
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
  if (!editor.data.gastosAdicionales) editor.data.gastosAdicionales = [] // Asegurarse de inicializar gastos adicionales
  if (!editor.data.tipo) editor.data.tipo = 'fija' // Default

  // Resetear campos de adición de bonificación para evitar arrastrar valores de una edición a otra
  nuevaBonificacionSeleccionada.value = ''
  costoBonificacionAAnadir.value = 0
  reduccionBonificacionAAnadir.value = undefined
  isSupposedBonificacionAAnadir.value = false

  nombreBonificacionPersonalizada.value = ''
  costeAnualBonificacionPersonalizada.value = 0
  reduccionBonificacionPersonalizada.value = undefined
  isSupposedBonificacionPersonalizada.value = false

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

// Métodos de bonificaciones (para la oferta actual)
function addBonificacionPredefinida() {
  const selectedBonifCatalogoItem = bonificacionesCatalogo.value.find(b => b.nombre === nuevaBonificacionSeleccionada.value)

  if (!selectedBonifCatalogoItem) {
    alert('Por favor, selecciona una bonificación válida del catálogo.')
    return
  }

  const newBonif: IBonificacion = {
    id: selectedBonifCatalogoItem.id || Date.now().toString(), // Usar ID del catálogo o generar uno nuevo
    nombre: selectedBonifCatalogoItem.nombre,
    costeAnual: costoBonificacionAAnadir.value,
    reduccion: reduccionBonificacionAAnadir.value,
    isSupposed: isSupposedBonificacionAAnadir.value
  }

  // Verificar si la bonificación (por ID) ya está en la oferta
  if (editor.data.bonificaciones.some((b: IBonificacion) => b.id === newBonif.id)) {
    alert(`La bonificación '${newBonif.nombre}' ya ha sido añadida a esta oferta.`)
    return
  }

  editor.data.bonificaciones.push(newBonif)
}

function addBonificacionPersonalizada() {
  const name = nombreBonificacionPersonalizada.value.trim()
  const cost = costeAnualBonificacionPersonalizada.value
  const redu = reduccionBonificacionPersonalizada.value
  const isSupposed = isSupposedBonificacionPersonalizada.value

  if (!name || isNaN(cost) || cost < 0) {
    alert('Por favor, introduce un nombre y un coste anual válido para la bonificación personalizada.')
    return
  }

  const newId = name.toLowerCase().replace(/\s/g, '-')

  const bonificacionParaOferta: IBonificacion = {
    id: newId,
    nombre: name,
    costeAnual: cost,
    reduccion: redu,
    isSupposed: isSupposed
  }

  // Añadir al catálogo global (solo id y nombre) si no existe
  if (!bonificacionesCatalogo.value.some(b => b.id === newId)) {
    bonificacionesCatalogo.value.push({ id: newId, nombre: name }) // Solo id y nombre al catálogo
    saveBonificacionesCatalogoToServer()
  }

  // Añadir a la oferta actual (puede ser una nueva instancia)
  editor.data.bonificaciones.push(JSON.parse(JSON.stringify(bonificacionParaOferta)))

  // Limpiar campos
  nombreBonificacionPersonalizada.value = ''
  costeAnualBonificacionPersonalizada.value = 0
  reduccionTinBonificacionPersonalizada.value = undefined
  reduccionDiferencialBonificacionPersonalizada.value = undefined
  reduccionTinFijoBonificacionPersonalizada.value = undefined
  isSupposedBonificacionPersonalizada.value = false
}
function removeBonif(idx: number) {
  editor.data.bonificaciones.splice(idx, 1)
}

// Métodos de gastos adicionales (para la oferta actual)
// Ya no existe addGasto, se usa addPredefinedGasto o addGastoPersonalizado
function removeGasto(idx: number) {
  editor.data.gastosAdicionales.splice(idx, 1)
}

function addPredefinedGasto() {
  const name = nuevoGastoSeleccionado.value
  const cost = costoNuevoGasto.value

  if (!name || isNaN(cost) || cost < 0) {
    alert('Por favor, selecciona un gasto y/o introduce un coste válido.')
    return
  }

  // Añadir a la oferta actual
  editor.data.gastosAdicionales.push({
    id: Date.now().toString(), // Generar ID único para este gasto en la oferta
    nombre: name,
    coste: cost
  })
}

function addGastoPersonalizado() {
  const name = nuevoGastoPersonalizadoNombre.value.trim()
  const cost = nuevoGastoPersonalizadoCoste.value

  if (!name || isNaN(cost) || cost < 0) {
    alert('Por favor, introduce un nombre y un coste válido para el gasto personalizado.')
    return
  }

  // Crear un ID basado en el nombre para este gasto personalizado persistente
  const newId = name.toLowerCase().replace(/\s/g, '-')

  // Añadir a la lista global de gastos predefinidos si no existe
  if (!gastos.value.some(g => g.id === newId)) {
    gastos.value.push({
      id: newId,
      nombre: name,
      coste: cost
    })
    saveGastosToServer() // Persistir la lista actualizada de gastos
  }

  // Añadir a la oferta actual (puede ser el mismo o un nuevo objeto)
  editor.data.gastosAdicionales.push({
    id: Date.now().toString(), // ID único para esta instancia en la oferta
    nombre: name,
    coste: cost
  })

  // Limpiar campos
  nuevoGastoPersonalizadoNombre.value = ''
  nuevoGastoPersonalizadoCoste.value = 0
}

// Watcher para actualizar el costoNuevoGasto cuando se selecciona un gasto predefinido
watch(nuevoGastoSeleccionado, (newValue) => {
  const selectedGasto = gastos.value.find(g => g.nombre === newValue)
  if (selectedGasto) {
    costoNuevoGasto.value = selectedGasto.coste
  } else {
    costoNuevoGasto.value = 0
  }
})

// Watcher para actualizar los campos de reducción cuando se selecciona una bonificación predefinida
watch(nuevaBonificacionSeleccionada, (newValue) => {
  const selectedBonif = bonificacionesCatalogo.value.find(b => b.nombre === newValue)
  if (selectedBonif) {
    // Resetear a valores por defecto ya que el catálogo simplificado no los tiene
    costoBonificacionAAnadir.value = 0
    reduccionTinBonificacionAAnadir.value = undefined
    reduccionDiferencialBonificacionAAnadir.value = undefined
    reduccionTinFijoBonificacionAAnadir.value = undefined
    isSupposedBonificacionAAnadir.value = false
  } else {
    // Resetear si no se encuentra (e.g., opción en blanco o eliminada)
    costoBonificacionAAnadir.value = 0
    reduccionTinBonificacionAAnadir.value = undefined
    reduccionDiferencialBonificacionAAnadir.value = undefined
    reduccionTinFijoBonificacionAAnadir.value = undefined
    isSupposedBonificacionAAnadir.value = false
  }
})

// Inicialización
onMounted(() => {
  fetchHipotecas()
  loadGastos()
  loadBonificacionesCatalogo() // Nueva llamada para cargar bonificaciones
})

function setNumericValue(value: string | number, updater: (val: number) => void) {
  if (value === '' || value === null) {
    updater(0)
    return
  }
  const parsed = parseFloat(String(value))
  updater(isNaN(parsed) ? 0 : parsed)
}
</script>

<template>
  <div class="container mx-auto p-4 max-w-5xl">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
        Hipotecas
      </h1>
      <!-- Botón añadir arriba -->
      <UButton
        icon="i-heroicons-plus"
        size="md"
        color="success"
        @click="openEditor({}, -1)"
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
    />

    <!-- FORMULARIO DE EDICIÓN (DEBAJO DE LA TABLA) -->
    <!-- Aparece solo si editor.active es true -->
    <div
      v-if="editor.active"
      ref="formRef"
      class="editor-section mt-8"
    >
      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-semibold text-primary-600">
              {{ editor.index === -1 ? 'Nueva Oferta Hipotecaria' : `Editando: ${editor.data.banco}` }}
            </h3>
            <UButton
              icon="i-heroicons-x-mark"
              color="neutral"
              variant="ghost"
              @click="closeEditor"
            />
          </div>
        </template>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
          <!-- COLUMNA IZQUIERDA: DATOS PRINCIPALES -->
          <div class="md:col-span-4 space-y-4">
            <UFormField label="Banco Entidad">
              <UInput
                v-model="editor.data.banco"
                icon="i-heroicons-building-library"
                autofocus
              />
            </UFormField>
            <UFormField label="Tipo de interés">
              <USelect
                v-model="editor.data.tipo"
                :items="['fija', 'variable', 'mixta']"
              />
            </UFormField>
            <UFormField label="Tope Bonificación %">
              <UInput
                v-model="editor.data.topeBonificacion"
                type="number"
                step="0.05"
                @update:model-value="(val: string | number) => setNumericValue(val, v => editor.data.topeBonificacion = v)"
              />
            </UFormField>
          </div>

          <!-- COLUMNA DERECHA: CONDICIONES DETALLADAS -->
          <div class="md:col-span-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
            <!-- TIPO FIJO -->
            <div
              v-if="editor.data.tipo === 'fija'"
              class="grid grid-cols-2 gap-4"
            >
              <UFormField label="TIN Base %">
                <UInput
                  v-model="editor.data.tin"
                  type="number"
                  step="0.05"
                  @update:model-value="(val: string | number) => setNumericValue(val, v => editor.data.tin = v)"
                />
              </UFormField>
              <UFormField label="TIN Bonificado %">
                <UInput
                  v-model="editor.data.tinBonificado"
                  type="number"
                  step="0.05"
                  @update:model-value="(val: string | number) => setNumericValue(val, v => editor.data.tinBonificado = v)"
                />
              </UFormField>
            </div>

            <!-- TIPO VARIABLE -->
            <div
              v-else-if="editor.data.tipo === 'variable'"
              class="grid grid-cols-2 gap-4"
            >
              <UFormField label="Diferencial Base %">
                <UInput
                  v-model="editor.data.diferencial"
                  type="number"
                  step="0.05"
                  @update:model-value="(val: string | number) => setNumericValue(val, v => editor.data.diferencial = v)"
                />
              </UFormField>
              <UFormField label="Diferencial Bonificado %">
                <UInput
                  v-model="editor.data.diferencialBonificado"
                  type="number"
                  step="0.05"
                  @update:model-value="(val: string | number) => setNumericValue(val, v => editor.data.diferencialBonificado = v)"
                />
              </UFormField>
            </div>

            <!-- TIPO MIXTA -->
            <div
              v-else-if="editor.data.tipo === 'mixta'"
              class="space-y-3"
            >
              <div class="grid grid-cols-3 gap-3">
                <UFormField label="Años Fijos">
                  <UInput
                    v-model="editor.data.plazoFijoAnios"
                    type="number"
                    @update:model-value="(val: string | number) => setNumericValue(val, v => editor.data.plazoFijoAnios = v)"
                  />
                </UFormField>
                <UFormField label="TIN Fijo %">
                  <UInput
                    v-model="editor.data.tinFijo"
                    type="number"
                    step="0.05"
                    @update:model-value="(val: string | number) => setNumericValue(val, v => editor.data.tinFijo = v)"
                  />
                </UFormField>
                <UFormField label="TIN Fijo Bonif. %">
                  <UInput
                    v-model="editor.data.tinFijoBonificado"
                    type="number"
                    step="0.05"
                    @update:model-value="(val: string | number) => setNumericValue(val, v => editor.data.tinFijoBonificado = v)"
                  />
                </UFormField>
              </div>
              <div class="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                <UFormField label="Diferencial Variable %">
                  <UInput
                    v-model="editor.data.diferencial"
                    type="number"
                    step="0.05"
                    @update:model-value="(val: string | number) => setNumericValue(val, v => editor.data.diferencial = v)"
                  />
                </UFormField>
                <UFormField label="Dif. Variable Bonif. %">
                  <UInput
                    v-model="editor.data.diferencialBonificado"
                    type="number"
                    step="0.05"
                    @update:model-value="(val: string | number) => setNumericValue(val, v => editor.data.diferencialBonificado = v)"
                  />
                </UFormField>
              </div>
            </div>
          </div>

          <div class="col-span-full">
            <UDivider label="Gastos y Bonificaciones" />
          </div>

          <!-- GASTOS DINÁMICOS -->
          <div class="md:col-span-4">
            <div class="flex justify-between mb-2">
              <h4 class="font-medium text-sm text-gray-500">
                Gastos Adicionales (€)
              </h4>
            </div>

            <!-- Selector de gastos predefinidos -->
            <div class="flex gap-2 items-center mb-4">
              <USelect
                v-model="nuevoGastoSeleccionado"
                :items="gastos.map(g => g.nombre)"
                placeholder="Selecciona gasto..."
                class="w-full"
                size="sm"
              />
              <UInput
                v-model="costoNuevoGasto"
                type="number"
                placeholder="Coste (€)"
                class="w-24"
                size="sm"
                @update:model-value="(val: string | number) => setNumericValue(val, v => costoNuevoGasto = v)"
              />
              <UButton
                icon="i-heroicons-plus"
                color="success"
                size="sm"
                @click="addPredefinedGasto"
              >
                Añadir
              </UButton>
            </div>

            <!-- Añadir Gasto Personalizado -->
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <h5 class="font-medium text-xs text-gray-500 mb-2">
                Añadir Gasto al Catálogo
              </h5>
              <div class="flex gap-2 items-center mb-2">
                <UInput
                  v-model="nuevoGastoPersonalizadoNombre"
                  placeholder="Nombre nuevo gasto"
                  class="w-full"
                  size="sm"
                />
                <UInput
                  v-model="nuevoGastoPersonalizadoCoste"
                  type="number"
                  placeholder="Coste (€)"
                  class="w-24"
                  size="sm"
                  @update:model-value="(val: string | number) => setNumericValue(val, v => nuevoGastoPersonalizadoCoste = v)"
                />
                <UButton
                  icon="i-heroicons-plus"
                  color="success"
                  size="sm"
                  @click="addGastoPersonalizado"
                >
                  Crear y Añadir
                </UButton>
              </div>
            </div>

            <div
              v-if="editor.data.gastosAdicionales?.length"
              class="space-y-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
            >
              <div
                v-for="(gasto, gIndex) in editor.data.gastosAdicionales"
                :key="gIndex"
                class="flex gap-2 items-center"
              >
                <UInput
                  v-model="gasto.nombre"
                  placeholder="Nombre del gasto"
                  class="w-full"
                  size="sm"
                />
                <UInput
                  v-model="gasto.coste"
                  placeholder="Coste €"
                  class="w-24"
                  type="number"
                  size="sm"
                  @update:model-value="(val: string | number) => setNumericValue(val, v => gasto.coste = v)"
                />
                <UButton
                  icon="i-heroicons-trash"
                  color="error"
                  variant="ghost"
                  @click="removeGasto(Number(gIndex))"
                />
              </div>
            </div>
            <p
              v-else
              class="text-xs text-gray-400 italic mt-4"
            >
              No hay gastos adicionales en esta oferta.
            </p>
          </div>

          <!-- LISTA BONIFICACIONES -->
          <div class="md:col-span-8">
            <div class="flex justify-between mb-2">
              <h4 class="font-medium text-sm text-gray-500">
                Bonificaciones (Productos vinculados)
              </h4>
            </div>

            <!-- Selector de bonificaciones predefinidas -->
            <div class="space-y-2 mb-4 p-3 border rounded-md bg-gray-50 dark:bg-gray-800">
              <h5 class="font-medium text-xs text-gray-500 mb-2">
                Seleccionar del Catálogo
              </h5>
              <UFormField
                label="Bonificación del Catálogo"
                class="mb-2"
              >
                <USelect
                  v-model="nuevaBonificacionSeleccionada"
                  :items="bonificacionesCatalogo.map(b => b.nombre)"
                  placeholder="Selecciona bonificación..."
                  size="sm"
                />
              </UFormField>
              <div class="grid grid-cols-2 gap-2 mb-2">
                <UFormField label="Coste Anual (€)">
                  <UInput
                    v-model="costoBonificacionAAnadir"
                    type="number"
                    step="10"
                    size="sm"
                    @update:model-value="(val: string | number) => setNumericValue(val, v => costoBonificacionAAnadir = v)"
                  />
                </UFormField>
                <UFormField label="Reducción %">
                  <UInput
                    v-model="reduccionBonificacionAAnadir"
                    type="number"
                    step="0.01"
                    size="sm"
                    @update:model-value="(val: string | number) => setNumericValue(val, v => reduccionBonificacionAAnadir = v)"
                  />
                </UFormField>
              </div>
              <UCheckbox
                v-model="isSupposedBonificacionAAnadir"
                label="Valor supuesto"
                class="mb-2"
              />
              <UButton
                icon="i-heroicons-plus"
                color="success"
                size="sm"
                @click="addBonificacionPredefinida"
              >
                Añadir Bonificación
              </UButton>
            </div>

            <!-- Añadir Bonificación Personalizada al Catálogo -->
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 space-y-2 p-3 rounded-md bg-gray-50 dark:bg-gray-800">
              <h5 class="font-medium text-xs text-gray-500 mb-2">
                Crear y Añadir al Catálogo
              </h5>
              <UFormField
                label="Nombre Nueva Bonificación"
                class="mb-2"
              >
                <UInput
                  v-model="nombreBonificacionPersonalizada"
                  placeholder="Nombre de la bonificación"
                  size="sm"
                />
              </UFormField>
              <div class="grid grid-cols-2 gap-2 mb-2">
                <UFormField label="Coste Anual (€)">
                  <UInput
                    v-model="costeAnualBonificacionPersonalizada"
                    type="number"
                    step="10"
                    size="sm"
                    @update:model-value="(val: string | number) => setNumericValue(val, v => costeAnualBonificacionPersonalizada = v)"
                  />
                </UFormField>
                <UFormField label="Reducción %">
                  <UInput
                    v-model="reduccionBonificacionPersonalizada"
                    type="number"
                    step="0.01"
                    size="sm"
                    @update:model-value="(val: string | number) => setNumericValue(val, v => reduccionBonificacionPersonalizada = v)"
                  />
                </UFormField>
              </div>
              <UCheckbox
                v-model="isSupposedBonificacionPersonalizada"
                label="Valor supuesto"
                class="mb-2"
              />
              <UButton
                icon="i-heroicons-plus"
                color="success"
                size="sm"
                @click="addBonificacionPersonalizada"
              >
                Crear y Añadir
              </UButton>
            </div>

            <!-- Bonificaciones en esta oferta -->
            <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h5 class="font-medium text-sm text-gray-500 mb-2">
                Bonificaciones en esta Oferta
              </h5>
              <div
                v-if="editor.data.bonificaciones?.length"
                class="space-y-2"
              >
                <div
                  v-for="(bon, bIndex) in editor.data.bonificaciones"
                  :key="bon.id || bIndex"
                  class="flex flex-wrap items-center gap-x-2 gap-y-1"
                >
                  <span class="font-medium text-gray-800 dark:text-gray-200">{{ bon.nombre }}</span>
                  <span class="text-sm text-gray-600 dark:text-gray-400">({{ formatearNumero(bon.costeAnual) }}/año)</span>
                  <span
                    v-if="bon.reduccion"
                    class="text-xs text-blue-600 dark:text-blue-300"
                  >-{{ bon.reduccion.toFixed(2) }}%</span>
                  <span
                    v-if="bon.isSupposed"
                    class="text-xs text-yellow-600 dark:text-yellow-300"
                  >(Valor supuesto)</span>
                  <UButton
                    icon="i-heroicons-trash"
                    color="red"
                    variant="ghost"
                    size="xs"
                    class="ml-auto"
                    @click="removeBonif(Number(bIndex))"
                  />
                </div>
              </div>
              <p
                v-else
                class="text-xs text-gray-400 italic"
              >
                No hay bonificaciones añadidas a esta oferta.
              </p>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton
              label="Cancelar"
              color="neutral"
              @click="closeEditor"
            />
            <UButton
              label="Guardar Cambios"
              color="success"
              icon="i-heroicons-check"
              @click="saveForm"
            />
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
