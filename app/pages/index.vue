<template>
  <div class="container mx-auto max-w-8xl shadow-lg rounded-xl p-8 my-8">


    <div class="flex flex-col md:flex-row items-center justify-center gap-6 mb-10">
      <UFormField label="Importe del Préstamo (€)" class="w-full md:w-52">
        <UInput type="number" v-model.number="importe" />
      </UFormField>
      <UFormField label="Plazo (años)" class="w-full md:w-36">
        <UInput type="number" v-model.number="plazo" />
      </UFormField>
      <UFormField label="Euríbor Actual (%)" class="w-full md:w-36">
        <UInput type="number" v-model.number="euribor" step="0.01" />
      </UFormField>
      <UButton @click="calcularComparativa" class="mt-6 md:mt-0">
        Calcular
      </UButton>
    </div>

    <!-- Productos Personales Adicionales -->
    <div class="mb-8 p-6 rounded-lg shadow-sm">
      <h2 class="text-xl font-bold  mb-4">Bonificaciones Personales Adicionales (no bonificables)</h2>
      <p class="mb-4">Selecciona y añade productos que contratarías por tu cuenta. Su coste anual se
        sumará
        al coste total de las ofertas de hipotecas que no los incluyan como bonificación.</p>

      <BonificacionesPersonales :bonificaciones="personalBonificaciones" @alternar="alternarBonificacionPersonal"
        @actualizar:coste="actualizarCosteBonificacionPersonal" @eliminar="eliminarBonificacionPersonal" />

      <div class="flex flex-wrap items-center gap-4 mt-6 p-4 border-t pt-4">
        <div class="flex-grow">
          <USelect v-model="nuevoBonusSeleccionado" :items="bonificacionesPersonales.map(b => b.nombre)" />
        </div>
        <div class="w-32">
          <UInput type="number" v-model.number="costoNuevoBonus" step="10" min="0" placeholder="Coste Anual (€)" />
        </div>
        <UButton @click="addPersonalBonus" color="success">
          Añadir Producto
        </UButton>
      </div>
    </div>

    <TablaResultados :resultados="resultados" :mejor-opcion-coste-total="mejorOpcionCosteTotal"
      @ver-grafico="mostrarGrafico" />

    <GraficoAmortizacion v-model="isModalOpen" :resultado="resultadoSeleccionado" :importe="importe" :plazo="plazo"
      :euribor="euribor" />
  </div>
</template>

<script setup lang="ts">

const importe = ref(136000);
const plazo = ref(27);
const euribor = ref(3.5);
const ofertasHipotecas = ref<OfertaHipotecaTipo[]>([]);
const personalBonificaciones = ref<IProductoPersonal[]>([]);
const bonificacionesPersonales = ref<IProductoPersonal[]>([]);
const nuevoBonusSeleccionado = ref<string>('');
const costoNuevoBonus = ref<number>(0);
const resultados = ref<IResultadoCalculo[]>([]);
const isModalOpen = ref(false);
const resultadoSeleccionado = ref<IResultadoCalculo | null>(null);

const mejorOpcionCosteTotal = computed(() => {
  if (resultados.value.length === 0) return 0;
  return Math.min(...resultados.value.map(r => r.costeTotalConExtras !== undefined ? r.costeTotalConExtras : r.costeTotalConBonificar))
});

watch(nuevoBonusSeleccionado, (newValue) => {
  const selectedBonus = bonificacionesPersonales.value.find(b => b.nombre === newValue);
  if (selectedBonus) {
    costoNuevoBonus.value = selectedBonus.costeAnual;
  }
});

async function cargarBonificacionesPersonales() {
  try {
    const data = await $fetch<IProductoPersonal[]>('/api/bonificaciones');
    bonificacionesPersonales.value = data;
    if (bonificacionesPersonales.value.length > 0) {
      nuevoBonusSeleccionado.value = bonificacionesPersonales.value[0].nombre;
    }
  } catch (error) {
    console.error('Error al cargar los productos personales predefinidos:', error);
  }
}


async function cargarOfertas() {
  try {
    const response = await $fetch<OfertaHipotecaTipo[]>('/api/hipotecas');
    ofertasHipotecas.value = response;
    calcularComparativa();
  } catch (error) {
    console.error('Error al cargar las ofertas de hipotecas:', error);
  }
}

function calcularComparativa() {
  if (isNaN(importe.value) || isNaN(plazo.value) || isNaN(euribor.value) || importe.value <= 0 || plazo.value <= 0) {
    return;
  }

  if (ofertasHipotecas.value.length === 0) {
    return;
  }
  resultados.value.length = 0
  ofertasHipotecas.value.forEach(oferta => {
    resultados.value.push(CalculadoraHipoteca.calcularResultadoParaOferta(
      oferta,
      importe.value,
      plazo.value,
      euribor.value,
      personalBonificaciones.value
    ));
  });

}


function mostrarGrafico(resultado: IResultadoCalculo) {
  resultadoSeleccionado.value = resultado;
  isModalOpen.value = true;
}

function addPersonalBonus() {
  const name = nuevoBonusSeleccionado.value;
  const cost = costoNuevoBonus.value;

  if (!name || isNaN(cost) || cost < 0) {
    alert('Por favor, selecciona un producto y/o introduce un coste anual válido.');
    return;
  }

  if (personalBonificaciones.value.some(b => b.nombre === name)) {
    alert(`El producto '${name}' ya ha sido añadido.`);
    return;
  }

  const newBonus: IProductoPersonal = {
    id: Date.now(),
    nombre: name,
    costeAnual: cost,
    enabled: true
  };
  personalBonificaciones.value.push(newBonus);
  calcularComparativa();
}

function eliminarBonificacionPersonal(id: number) {
  personalBonificaciones.value = personalBonificaciones.value.filter(bonus => bonus.id !== id);
  calcularComparativa();
}

function alternarBonificacionPersonal(id: number) {
  const bonus = personalBonificaciones.value.find(b => b.id === id);
  if (bonus) {
    bonus.enabled = !bonus.enabled;
    calcularComparativa();
  }
}

function actualizarCosteBonificacionPersonal(id: number, cost: number) {
  const bonus = personalBonificaciones.value.find(b => b.id === id);
  if (bonus) {
    bonus.costeAnual = cost;
    calcularComparativa();
  }
}

onMounted(() => {
  cargarOfertas();
  cargarBonificacionesPersonales();
});
</script>