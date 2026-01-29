<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import type { OfertaHipotecaTipo, IBonificacion } from '~/shared/types/hipotecas';

const hipotecas = ref<OfertaHipotecaTipo[]>([]);

const editorDefaultState = {
  active: false,
  index: -1,
  data: {} as Partial<OfertaHipotecaTipo> & { bonificaciones: IBonificacion[] },
};

const editor = reactive(JSON.parse(JSON.stringify(editorDefaultState)));


async function fetchHipotecas() {
  try {
    const data = await $fetch<OfertaHipotecaTipo[]>('/api/hipotecas');
    hipotecas.value = data;
  } catch (error) {
    console.error('Fallo al cargar las hipotecas:', error);
    alert('Error al cargar las hipotecas.');
  }
}

async function saveAllHipotecas(successMessage = '¡Hipotecas guardadas en el servidor correctamente!') {
  try {
    await $fetch('/api/hipotecas', {
      method: 'POST',
      body: hipotecas.value,
    });
    alert(successMessage);
  } catch (error) {
    console.error('Fallo al guardar las hipotecas:', error);
    alert('Error al guardar las hipotecas en el servidor.');
    throw error;
  }
}

function openEditor(anchorElement: HTMLElement | null, hipoteca: Partial<OfertaHipotecaTipo> = {}, index = -1) {
  editor.active = true;
  editor.index = index;
  editor.data = JSON.parse(JSON.stringify(hipoteca)); // Deep copy to avoid modifying original data
  if (!editor.data.bonificaciones) {
    editor.data.bonificaciones = [];
  }
}

function cancelEdit() {
  Object.assign(editor, JSON.parse(JSON.stringify(editorDefaultState)));
}

function saveForm() {
  if (editor.index === -1) {
    hipotecas.value.push(editor.data as OfertaHipotecaTipo);
  } else {
    hipotecas.value[editor.index] = editor.data as OfertaHipotecaTipo;
  }
  saveAllHipotecas('¡Hipoteca guardada correctamente!');
  cancelEdit();
}

function removeHipoteca(index: number) {
  if (confirm(`¿Estás seguro de que quieres eliminar la hipoteca de ${hipotecas.value[index].banco}?`)) {
    hipotecas.value.splice(index, 1);
    saveAllHipotecas('¡Hipoteca eliminada correctamente!');
  }
}

function addBonificacion() {
  editor.data.bonificaciones.push({
    nombre: '',
    costeAnual: 0,
    reduccionTin: undefined,
    reduccionDiferencial: undefined,
    reduccionTinFijo: undefined,
    isSupposed: false,
  });
}

function removeBonificacion(index: number) {
  editor.data.bonificaciones.splice(index, 1);
}

onMounted(fetchHipotecas);
</script>