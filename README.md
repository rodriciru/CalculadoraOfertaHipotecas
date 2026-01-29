# Comparador de Hipotecas Avanzado

Este proyecto es una herramienta web local para comparar ofertas de hipotecas de tipo fijo, variable y mixto. Calcula y compara el **Coste Total** y la **TAE (Tasa Anual Equivalente)** efectiva para proporcionar una visión precisa del coste real de cada préstamo.

La interfaz está construida con **Tailwind CSS** y la lógica de cálculo está escrita en **TypeScript** para mayor robustez y mantenibilidad.

## Características

-   **Comparación Precisa:** Utiliza la TAE para comparar diferentes tipos de ofertas.
-   **Soporte Multi-tipo:** Analiza hipotecas de tipo `fijo`, `variable` y `mixto`.
-   **Bonificaciones Detalladas:** Contempla el coste y la reducción de interés de productos vinculados (seguros, nóminas, etc.).
-   **Interfaz Moderna:** Diseño limpio y responsive gracias a Tailwind CSS.
-   **Datos Externos:** Las ofertas de hipotecas se gestionan fácilmente en un archivo `hipotecas.json`.
-   **Entorno de Desarrollo Moderno:** Usa TypeScript para un código más seguro y `pnpm` para una gestión de paquetes eficiente.

---

## Prerrequisitos

Antes de empezar, asegúrate de tener instalado lo siguiente:

1.  **Node.js:** Necesario para ejecutar TypeScript y `pnpm`. Puedes descargarlo desde [nodejs.org](https://nodejs.org/).
2.  **pnpm:** Un gestor de paquetes rápido y eficiente. Se recomienda instalarlo después de Node.js ejecutando este comando en la terminal:
    ```bash
    npm install -g pnpm
    ```
3.  **Python (Opcional, recomendado):** Para levantar un servidor web local de forma sencilla. La mayoría de los sistemas operativos lo incluyen por defecto.

---

## Instalación y Uso

Sigue estos pasos para poner en marcha el comparador:

**1. Instalar Dependencias**

Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
pnpm install
```

Este comando leerá el `package.json` e instalará TypeScript en el proyecto.

**2. Compilar el Código TypeScript**

El código principal está en `calculadora.ts`. Para que el navegador lo entienda, necesitas compilarlo a JavaScript. Ejecuta:

```bash
pnpm run build
```

Este comando creará (o actualizará) el archivo `calculadora.js`. **Debes ejecutar este comando cada vez que hagas cambios en `calculadora.ts`.**

**3. Iniciar el Servidor Web Local**

Para que el `index.html` pueda cargar el archivo `hipotecas.json`, necesitas servir los archivos desde un servidor local. La forma más sencilla es usando Python:

```bash
# Abre una terminal en la carpeta del proyecto y ejecuta:
python -m http.server

# Si tienes Python 2, el comando puede ser: python -m SimpleHTTPServer
```

El servidor se iniciará. Verás un mensaje en la terminal como `Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/)`.

**4. Abrir el Comparador**

Abre tu navegador web y ve a la dirección:

[**http://localhost:8000**](http://localhost:8000)

¡Listo! Ya puedes usar el comparador. Introduce el importe, el plazo, el Euríbor actual y pulsa "Calcular".

---

## Cómo Modificar las Ofertas de Hipotecas

Para añadir, eliminar o editar las ofertas, simplemente abre y modifica el archivo **`hipotecas.json`**.

### Estructura de una Oferta

Cada oferta es un objeto JSON con los siguientes campos base:

-   `banco`: Nombre de la entidad.
-   `gastosTasacion`, `comisionBroker`, `otrosGastos`: Gastos iniciales en euros.
-   `gastosCancelacionAnterior`: (Opcional) Coste de cancelar una hipoteca anterior.
-   `bonificaciones`: Una lista de productos vinculados.

La estructura varía según el `tipo` de hipoteca (`fija`, `variable` o `mixta`).

#### Lógica del TIN y Diferencial

El sistema puede definir el tipo de interés de dos maneras, lo que afecta cómo se presenta el "TIN Base" o "Diferencial Base":

1.  **Tipo Base Explícito (Recomendado):** Se define un `tin` (para hipotecas fijas y tramo fijo de mixtas) o `diferencial` (para hipotecas variables y tramo variable de mixtas). Las bonificaciones (`reduccionTin`, `reduccionDiferencial`, `reduccionTinFijo`) se aplican sobre este tipo base. En este caso, el tipo base mostrado en la tabla es el que se ha configurado directamente.

2.  **Tipo Bonificado Directo (Base Inferida):** Se define un `tinBonificado` o `diferencialBonificado` que ya incluye todas las reducciones de las bonificaciones. Cuando se usa esta opción, el sistema **infiere** el tipo de interés base (el valor sin bonificar) sumando las reducciones de las bonificaciones al tipo bonificado.
    En la interfaz, este tipo base inferido se marcará con un **asterisco (*)** para indicar que no es un valor configurado explícitamente, sino que ha sido calculado por el sistema.

**Prioridad:** Si se definen tanto el tipo base explícito (`tin` o `diferencial`) como el tipo bonificado (`tinBonificado` o `diferencialBonificado`), el sistema siempre priorizará y utilizará el **tipo base explícito**.

---

#### Ejemplo: Hipoteca Fija

Puedes definirla con el TIN base o el TIN ya bonificado.

```json
{
  "banco": "Banco Fijo (TIN Base)",
  "tipo": "fija",
  "tin": 3.10,
  "gastosTasacion": 300,
  "comisionBroker": 0,
  "otrosGastos": 150,
  "gastosCancelacionAnterior": 1000,
  "bonificaciones": [
    { "nombre": "Nómina", "reduccionTin": 0.50, "costeAnual": 0 },
    { "nombre": "Seguro de Vida", "reduccionTin": 0.25, "costeAnual": 360 }
  ]
},
{
  "banco": "Banco Fijo (Bonificado Directo)",
  "tipo": "fija",
  "tinBonificado": 2.25,
  "gastosTasacion": 300,
  "comisionBroker": 0,
  "otrosGastos": 0,
  "bonificaciones": [
    { "nombre": "Nómina", "reduccionTin": 0.75, "costeAnual": 0, "isSupposed": true },
    { "nombre": "Seguro Hogar", "reduccionTin": 0.10, "costeAnual": 250, "isSupposed": true }
  ]
}
```

#### Ejemplo: Hipoteca Variable

Igual que la fija, puedes especificar el diferencial base o el ya bonificado.

```json
{
  "banco": "Banco Variable (Diferencial Base)",
  "tipo": "variable",
  "diferencial": 0.49,
  "gastosTasacion": 0,
  "comisionBroker": 2500,
  "otrosGastos": 0,
  "bonificaciones": [
    { "nombre": "Nómina", "reduccionDiferencial": 0.20, "costeAnual": 0 }
  ]
}
```

#### Ejemplo: Hipoteca Mixta

La hipoteca mixta combina un período fijo y uno variable.

```json
{
  "banco": "Hipoteca Mixta Segura",
  "tipo": "mixta",
  "plazoFijoAnios": 10,
  "tinFijo": 2.50,
  "diferencial": 0.75,
  "gastosTasacion": 350,
  "comisionBroker": 0,
  "otrosGastos": 0,
  "bonificaciones": [
    { "nombre": "Nómina", "reduccionTinFijo": 0.30, "reduccionDiferencial": 0.20, "costeAnual": 0 }
  ]
}
```

### Campos de Bonificaciones

-   `nombre`: Nombre del producto.
-   `costeAnual`: **Prioritario.** Coste anual del producto en euros.
-   `reduccionTin`: Para hipotecas `fija`, reduce el TIN.
-   `reduccionDiferencial`: Para hipotecas `variable` o el tramo variable de una `mixta`, reduce el diferencial.
-   `reduccionTinFijo`: Para el tramo fijo de una hipoteca `mixta`, reduce el TIN fijo.
-   `isSupposed`: (Opcional) Un valor booleano que, si es `true`, marca visualmente esta bonificación en la tabla de resultados (por ejemplo, con un fondo amarillo) para indicar que es una condición o valor supuesto en la oferta.
