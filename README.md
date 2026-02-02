Una aplicación web moderna y reactiva para analizar y comparar ofertas de hipotecas de tipo fijo, variable y mixto. Construida con Nuxt 4 y Vue 3, esta herramienta permite una simulación detallada y en tiempo real del coste total de un préstamo hipotecario.

## Características Clave

-   **Análisis Completo:** Calcula y compara la **TAE**, **cuotas mensuales** y el **coste total** a lo largo de la vida del préstamo.
-   **Interfaz Reactiva:** Cualquier cambio en los parámetros (importe, plazo, Euríbor) o en la selección de bonificaciones se refleja **instantáneamente** en los resultados, sin necesidad de recargar ni pulsar botones.
-   **Bonificaciones Configurables:** Permite activar o desactivar cada bonificación de una oferta para simular cómo afecta al coste total y decidir si compensa contratarla.
-   **Comparación Inteligente:** Destaca visualmente la oferta más económica basándose en el "Coste Total Real", que incluye tanto las bonificaciones de la hipoteca como los productos adicionales que el usuario contrataría por su cuenta.
-   **Soporte Multi-tipo:** Analiza y compara hipotecas `fijas`, `variables` y `mixtas`.
-   **Gráficos Interactivos:** Visualiza el cuadro de amortización de cada oferta.
-   **Generación Dinámica de Ofertas:** Utiliza la ruta `/generador` para crear y exportar nuevas ofertas de hipotecas en formato JSON, facilitando la expansión del catálogo de forma interactiva.
-   **API Propia:** Gestiona los datos de las ofertas (hipotecas, gastos, bonificaciones) a través de una API interna de Nuxt, facilitando su mantenimiento y escalabilidad.

## Stack Tecnológico

-   **Framework:** [Nuxt 4](https://nuxt.com/)
-   **UI Framework:** [Vue 3](https://vuejs.org/) (Composition API)
-   **Componentes UI:** [Nuxt UI](https://ui.nuxt.com/) (basado en Tailwind CSS)
-   **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
-   **Gestor de Paquetes:** [pnpm](https://pnpm.io/)

---

## Instalación y Uso

Sigue estos pasos para poner en marcha el proyecto en tu entorno local.

**1. Prerrequisitos**

-   Asegúrate de tener [Node.js](https://nodejs.org/) (versión 18 o superior) instalado.
-   Se recomienda usar `pnpm` como gestor de paquetes. Puedes instalarlo con `npm install -g pnpm`.

**2. Clonar el Repositorio**

```bash
git clone https://github.com/tu-usuario/tu-repositorio.git
cd tu-repositorio
```

**3. Instalar Dependencias**

Abre una terminal en la raíz del proyecto y ejecuta:

```bash
pnpm install
```

**4. Iniciar el Servidor de Desarrollo**

Ejecuta el siguiente comando para iniciar la aplicación en modo de desarrollo con recarga en caliente:

```bash
pnpm dev
```

La aplicación estará disponible en **http://localhost:3000**.

## Gestión de Datos

Los datos de las ofertas se gestionan a través de archivos JSON ubicados en la carpeta `server/data/`. Además, puedes generar nuevas ofertas dinámicamente usando la ruta `/generador`.

-   `hipotecas.json`: Define las ofertas de los bancos, sus tipos de interés y las bonificaciones asociadas.
-   `gastos.json`: Define los gastos iniciales (tasación, etc.) que se pueden asociar a una hipoteca.
-   `bonificaciones.json`: Catálogo de todas las posibles bonificaciones que un banco puede ofrecer.

Para modificar, añadir o eliminar ofertas, o para utilizar la herramienta de generación dinámica, edita estos archivos o navega a la ruta `/generador`. La aplicación reflejará los cambios automáticamente.