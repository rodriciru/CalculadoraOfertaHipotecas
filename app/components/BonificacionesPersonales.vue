<template>
  <div class="mb-4 space-y-2">
    <div v-for="bonificacion in bonificaciones" :key="bonificacion.id"
      class="flex items-center gap-4 mb-2 p-2 bg-white rounded-md shadow-sm border border-gray-200">
      <UCheckbox :model-value="bonificacion.enabled" @update:model-value="alternarBonificacion(bonificacion.id)" />
      <label class="text-gray-700 font-semibold flex-grow">{{ bonificacion.nombre }}</label>
      <UInput type="number" :model-value="bonificacion.costeAnual" @update:model-value="actualizarCoste(bonificacion.id, $event)"
        step="10" min="0" class="w-24 text-right" :disabled="!bonificacion.enabled" />
      <UButton @click="eliminarBonificacion(bonificacion.id)" color="error" variant="ghost" icon="i-heroicons-x-mark" />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  bonificaciones: IProductoPersonal[]
}>();

const emit = defineEmits(['alternar', 'actualizar:coste', 'eliminar']);

function alternarBonificacion(id: number) {
  emit('alternar', id);
}

function actualizarCoste(id: number, coste: string) {
  emit('actualizar:coste', id, parseFloat(coste));
}

function eliminarBonificacion(id: number) {
  emit('eliminar', id);
}
</script>
