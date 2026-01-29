// ================================================================================= //
// INTERFACES (Copiadas de calculadora.ts para consistencia)
// ================================================================================= //

interface Bonificacion {
  nombre: string;
  reduccionTin?: number;
  reduccionDiferencial?: number;
  reduccionTinFijo?: number;
  costeAnual: number;
  isSupposed?: boolean;
}

interface OfertaBase {
  banco: string;
  gastosTasacion: number;
  comisionBroker: number;
  otrosGastos: number;
  gastosCancelacionAnterior?: number;
  bonificaciones: Bonificacion[];
}

interface OfertaFija extends OfertaBase {
  tipo: 'fija';
  tin?: number;
  tinBonificado?: number;
}

interface OfertaVariable extends OfertaBase {
  tipo: 'variable';
  diferencial?: number;
  diferencialBonificado?: number;
}

interface OfertaMixta extends OfertaBase {
  tipo: 'mixta';
  plazoFijoAnios: number;
  tinFijo?: number;
  tinFijoBonificado?: number;
  diferencial?: number;
  diferencialBonificado?: number;
}

type OfertaHipoteca = OfertaFija | OfertaVariable | OfertaMixta;


// ================================================================================= //
// ESTADO Y CONSTANTES GLOBALES
// ================================================================================= //

let hipotecas: OfertaHipoteca[] = [];
const API_URL = '/api/hipotecas';

// Elementos del DOM
const hipotecasListaContainer = document.getElementById('hipotecas-lista') as HTMLDivElement;
const addNewBtn = document.getElementById('add-new-btn') as HTMLButtonElement;
const formTemplate = document.getElementById('hipoteca-form-template') as HTMLTemplateElement;


// ================================================================================= //
// RENDERIZADO Y MANEJO DEL DOM
// ================================================================================= //

/**
 * Renderiza la lista de hipotecas actuales con botones para editar y eliminar.
 */
function renderHipotecasLista() {
    // Guarda el editor si existe para no perder los datos al re-renderizar
    const activeEditor = document.querySelector('.hipoteca-form');
    const activeEditorParent = activeEditor?.parentElement;
    const activeEditorNextSibling = activeEditor?.nextSibling;

    hipotecasListaContainer.innerHTML = '';
    if (hipotecas.length === 0) {
        hipotecasListaContainer.innerHTML = '<p>No hay hipotecas cargadas. Añade una nueva para empezar.</p>';
    }

    hipotecas.forEach((hipoteca, index) => {
        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-lg shadow-md flex justify-between items-center hipoteca-item';
        div.dataset.index = String(index);
        div.innerHTML = `
            <div>
                <p class="font-bold text-lg">${hipoteca.banco}</p>
                <p class="text-sm text-gray-600">Tipo: ${hipoteca.tipo.charAt(0).toUpperCase() + hipoteca.tipo.slice(1)}</p>
            </div>
            <div class="flex gap-2">
                <button data-index="${index}" class="edit-btn bg-yellow-500 text-white py-1 px-3 rounded-md hover:bg-yellow-600">Editar</button>
                <button data-index="${index}" class="remove-btn bg-red-500 text-white py-1 px-3 rounded-md hover:bg-red-600">Eliminar</button>
            </div>
        `;
        hipotecasListaContainer.appendChild(div);
    });

    // Si había un editor, intenta reinsertarlo donde estaba
    if (activeEditor && activeEditorParent && activeEditorNextSibling) {
         activeEditorParent.insertBefore(activeEditor, activeEditorNextSibling);
    } else if (activeEditor) {
        // Si no se puede reinsertar en su sitio (p.ej. se borró el elemento), lo pone al final
        hipotecasListaContainer.appendChild(activeEditor);
    }
}

/**
 * Crea y muestra el formulario de edición/creación para una hipoteca.
 * @param anchorElement - El elemento de la lista tras el cual se insertará el editor. Si es null, se inserta al principio.
 * @param hipoteca - La hipoteca a editar, o un objeto vacío para crear una nueva.
 * @param index - El índice de la hipoteca en el array, o -1 si es nueva.
 */
function openEditor(anchorElement: HTMLElement | null, hipoteca: Partial<OfertaHipoteca> = {}, index = -1) {
    // Cerrar cualquier otro editor abierto
    document.querySelector('.hipoteca-form')?.remove();

    const formClone = formTemplate.content.cloneNode(true) as DocumentFragment;
    const form = formClone.querySelector('.hipoteca-form') as HTMLFormElement;
    
    // Poblar campos generales
    form.querySelector<HTMLHeadingElement>('h3')!.textContent = index === -1 ? 'Creando Nueva Hipoteca' : `Editando: ${hipoteca.banco}`;
    form.querySelector<HTMLInputElement>('[name="originalIndex"]')!.value = String(index);
    form.querySelector<HTMLInputElement>('[name="banco"]')!.value = hipoteca.banco || '';
    form.querySelector<HTMLInputElement>('[name="gastosTasacion"]')!.value = String(hipoteca.gastosTasacion || 0);
    form.querySelector<HTMLInputElement>('[name="comisionBroker"]')!.value = String(hipoteca.comisionBroker || 0);
    form.querySelector<HTMLInputElement>('[name="otrosGastos"]')!.value = String(hipoteca.otrosGastos || 0);
    form.querySelector<HTMLInputElement>('[name="gastosCancelacionAnterior"]')!.value = String(hipoteca.gastosCancelacionAnterior || 0);
    
    // Tipo y campos dinámicos
    const tipoSelect = form.querySelector<HTMLSelectElement>('[name="tipo"]')!;
    tipoSelect.value = hipoteca.tipo || 'fija';
    renderTipoFields(form, tipoSelect.value, hipoteca);
    tipoSelect.addEventListener('change', () => renderTipoFields(form, tipoSelect.value, {}));

    // Bonificaciones
    const bonificacionesContainer = form.querySelector('.bonificaciones-container') as HTMLDivElement;
    (hipoteca.bonificaciones || []).forEach(bonificacion => {
        const bonificacionNode = createBonificacionNode(bonificacion);
        bonificacionesContainer.appendChild(bonificacionNode);
    });
    form.querySelector('.add-bonificacion-btn')!.addEventListener('click', () => {
        bonificacionesContainer.appendChild(createBonificacionNode());
    });

    // Event Listeners del formulario
    form.addEventListener('submit', handleFormSave);
    form.querySelector('.cancel-edit-btn')!.addEventListener('click', () => form.remove());

    // Insertar el formulario en el DOM
    if (anchorElement) {
        anchorElement.after(form);
    } else {
        hipotecasListaContainer.prepend(form);
    }
}


/**
 * Renderiza los campos específicos según el tipo de hipoteca seleccionado.
 */
function renderTipoFields(form: HTMLFormElement, tipo: string, data: any) {
    const container = form.querySelector('.tipo-fields-container') as HTMLDivElement;
    container.innerHTML = ''; // Limpiar campos anteriores

    const createInput = (name: string, label: string, type = 'number', step = '0.01', value: any) => `
        <div>
            <label class="block text-sm font-medium text-gray-700">${label}</label>
            <input type="${type}" name="${name}" value="${value || ''}" step="${step}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 focus:border-blue-500 focus:ring-blue-500">
        </div>`;
    
    switch (tipo) {
        case 'fija':
            container.innerHTML = createInput('tin', 'TIN (%)', 'number', '0.01', data.tin) + 
                                  createInput('tinBonificado', 'TIN Bonificado (%)', 'number', '0.01', data.tinBonificado);
            break;
        case 'variable':
            container.innerHTML = createInput('diferencial', 'Diferencial (%)', 'number', '0.01', data.diferencial) + 
                                  createInput('diferencialBonificado', 'Diferencial Bonificado (%)', 'number', '0.01', data.diferencialBonificado);
            break;
        case 'mixta':
            container.innerHTML = createInput('plazoFijoAnios', 'Plazo Fijo (Años)', 'number', '1', data.plazoFijoAnios) +
                                  createInput('tinFijo', 'TIN Fijo (%)', 'number', '0.01', data.tinFijo) +
                                  createInput('tinFijoBonificado', 'TIN Fijo Bonificado (%)', 'number', '0.01', data.tinFijoBonificado) +
                                  createInput('diferencial', 'Diferencial Variable (%)', 'number', '0.01', data.diferencial) +
                                  createInput('diferencialBonificado', 'Diferencial Variable Bonificado (%)', 'number', '0.01', data.diferencialBonificado);
            break;
    }
}


/**
 * Crea un nodo de DOM para una bonificación.
 */
function createBonificacionNode(bonificacion: Partial<Bonificacion> = {}): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'grid grid-cols-1 md:grid-cols-7 gap-2 border p-2 rounded-md bg-gray-50 bonificacion-item items-center';
    div.innerHTML = `
        <input type="text" name="bonificacion_nombre" placeholder="Nombre" value="${bonificacion.nombre || ''}" class="md:col-span-2 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 focus:border-blue-500 focus:ring-blue-500" required>
        <input type="number" name="bonificacion_costeAnual" placeholder="Coste Anual (€)" step="1" value="${bonificacion.costeAnual || '0'}" class="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 focus:border-blue-500 focus:ring-blue-500" required>
        <div class="md:col-span-2 grid grid-cols-3 gap-1">
            <input type="number" name="bonificacion_reduccionTinFijo" placeholder="Red. TIN Fijo (%)" step="0.01" value="${bonificacion.reduccionTinFijo || ''}" class="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 focus:border-blue-500 focus:ring-blue-500">
            <input type="number" name="bonificacion_reduccionTin" placeholder="Red. TIN (%)" step="0.01" value="${bonificacion.reduccionTin || ''}" class="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 focus:border-blue-500 focus:ring-blue-500">
            <input type="number" name="bonificacion_reduccionDiferencial" placeholder="Red. Dif. (%)" step="0.01" value="${bonificacion.reduccionDiferencial || ''}" class="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 focus:border-blue-500 focus:ring-blue-500">
        </div>
        <label class="flex items-center justify-center text-sm text-gray-700">
            <input type="checkbox" name="bonificacion_isSupposed" class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" ${bonificacion.isSupposed ? 'checked' : ''}>
            <span class="ml-2">Supuesto</span>
        </label>
        <button type="button" class="remove-bonificacion-btn self-center justify-self-center bg-red-200 text-red-800 rounded-full h-6 w-6 flex items-center justify-center font-bold">×</button>
    `;
    div.querySelector('.remove-bonificacion-btn')!.addEventListener('click', () => div.remove());
    return div;
}


// ================================================================================= //
// MANEJO DE DATOS Y EVENTOS
// ================================================================================= //

/**
 * Recolecta los datos del formulario y los convierte en un objeto OfertaHipoteca.
 */
function getFormData(form: HTMLFormElement): OfertaHipoteca {
    const formData = new FormData(form);
    const data: any = {};
    formData.forEach((value, key) => {
        if (value !== '') {
            // Convertir a número si es posible
            const numValue = parseFloat(value as string);
            data[key] = isNaN(numValue) ? value : numValue;
        }
    });

    const bonificaciones: Bonificacion[] = [];
    form.querySelectorAll('.bonificacion-item').forEach(item => {
        const nombre = item.querySelector<HTMLInputElement>('[name="bonificacion_nombre"]')!.value;
        if (!nombre) return; // No guardar bonificaciones sin nombre
        const isSupposedCheckbox = item.querySelector<HTMLInputElement>('[name="bonificacion_isSupposed"]');
        bonificaciones.push({
            nombre: nombre,
            costeAnual: parseFloat(item.querySelector<HTMLInputElement>('[name="bonificacion_costeAnual"]')!.value || '0'),
            reduccionTin: parseFloat(item.querySelector<HTMLInputElement>('[name="bonificacion_reduccionTin"]')!.value) || undefined,
            reduccionDiferencial: parseFloat(item.querySelector<HTMLInputElement>('[name="bonificacion_reduccionDiferencial"]')!.value) || undefined,
            reduccionTinFijo: parseFloat(item.querySelector<HTMLInputElement>('[name="bonificacion_reduccionTinFijo"]')!.value) || undefined,
            isSupposed: isSupposedCheckbox ? isSupposedCheckbox.checked : false,
        });
    });

    const baseData: OfertaBase = {
        banco: data.banco,
        gastosTasacion: data.gastosTasacion || 0,
        comisionBroker: data.comisionBroker || 0,
        otrosGastos: data.otrosGastos || 0,
        gastosCancelacionAnterior: data.gastosCancelacionAnterior || 0,
        bonificaciones: bonificaciones,
    };
    
    switch (data.tipo) {
        case 'fija':
            return { ...baseData, tipo: 'fija', tin: data.tin, tinBonificado: data.tinBonificado };
        case 'variable':
            return { ...baseData, tipo: 'variable', diferencial: data.diferencial, diferencialBonificado: data.diferencialBonificado };
        case 'mixta':
            return { ...baseData, tipo: 'mixta', plazoFijoAnios: data.plazoFijoAnios, tinFijo: data.tinFijo, tinFijoBonificado: data.tinFijoBonificado, diferencial: data.diferencial, diferencialBonificado: data.diferencialBonificado };
        default:
            throw new Error('Tipo de hipoteca no reconocido');
    }
}


/**
 * Maneja el guardado de una hipoteca desde el formulario.
 */
async function handleFormSave(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const index = parseInt(form.querySelector<HTMLInputElement>('[name="originalIndex"]')!.value, 10);
    const nuevaHipoteca = getFormData(form);

    if (index === -1) {
        // Añadir nueva
        hipotecas.push(nuevaHipoteca);
    } else {
        // Actualizar existente
        hipotecas[index] = nuevaHipoteca;
    }

    try {
        await saveAllHipotecas('¡Hipoteca guardada correctamente!'); // Guardar inmediatamente en el servidor
        renderHipotecasLista(); // Re-renderizar la lista para reflejar los cambios
        form.remove(); // Eliminar el formulario después de guardar
    } catch (error) {
        // El error ya se muestra en saveAllHipotecas, aquí podríamos evitar cerrar el editor
        console.error("No se cerró el editor debido a un error al guardar.");
    }
}


/**
 * Maneja los clics en la lista de hipotecas (editar/eliminar).
 */
function handleListClick(event: Event) {
    const target = event.target as HTMLElement;
    const button = target.closest('button');
    if (!button) return;

    const index = parseInt(button.dataset.index!, 10);
    const hipotecaItem = button.closest('.hipoteca-item') as HTMLElement;

    if (button.classList.contains('edit-btn')) {
        openEditor(hipotecaItem, hipotecas[index], index);
    } else if (button.classList.contains('remove-btn')) {
        if (confirm(`¿Estás seguro de que quieres eliminar la hipoteca de ${hipotecas[index].banco}?`)) {
            hipotecas.splice(index, 1);
            // Si hay un editor abierto para este item, eliminarlo también
            hipotecaItem.nextElementSibling?.classList.contains('hipoteca-form') && hipotecaItem.nextElementSibling.remove();
            hipotecaItem.remove(); // Eliminar el item de la lista visualmente
            // Opcional: re-renderizar todo para mantener la consistencia
            // renderHipotecasLista(); 
        }
    }
}

// ================================================================================= //
// COMUNICACIÓN CON EL SERVIDOR
// ================================================================================= //

async function fetchHipotecas() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('La respuesta del servidor no fue OK');
        hipotecas = await response.json();
        renderHipotecasLista();
    } catch (error) {
        console.error('Fallo al cargar las hipotecas:', error);
        hipotecasListaContainer.innerHTML = `<p class="text-red-500">Error al cargar hipotecas.json. Revisa la consola y asegúrate de que el servidor esté funcionando.</p>`;
    }
}

async function saveAllHipotecas(successMessage = '¡Hipotecas guardadas en el servidor correctamente!') {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(hipotecas, null, 2), // Guardar con formato para legibilidad
        });
        if (!response.ok) throw new Error('La respuesta del servidor no fue OK');
        alert(successMessage);
    } catch (error) {
        console.error('Fallo al guardar las hipotecas:', error);
        alert('Error al guardar las hipotecas en el servidor. Revisa la consola.');
        throw error; // Re-lanzar el error para que el llamador pueda manejarlo
    }
}


// ================================================================================= //
// INICIALIZACIÓN
// ================================================================================= //

function init() {
    // El botón de añadir nuevo ahora abre el editor al principio de la lista
    addNewBtn.addEventListener('click', () => openEditor(null, {}, -1));
    hipotecasListaContainer.addEventListener('click', handleListClick);
    fetchHipotecas();
}

init();