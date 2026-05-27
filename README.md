# Random Things Hub

Random Things Hub es una colección de utilidades web centradas en el azar, la toma de decisiones rápidas y pequeñas herramientas interactivas. El proyecto ya no gira solo alrededor de Tiny Wheel: ahora [index.html](index.html) funciona como punto de entrada para varios módulos, mostrando qué herramientas están listas y cuáles siguen en desarrollo.

## Enfoque del proyecto

La web está planteada como un hub ligero de herramientas independientes hechas con HTML, CSS y JavaScript sin frameworks. Cada módulo tiene su propia página, sus estilos y su lógica, mientras que la portada principal organiza el acceso a todo el conjunto.

Actualmente el hub ofrece:

- Un acceso centralizado desde [index.html](index.html).
- Un módulo principal ya funcional: Tiny Wheel.
- Espacio preparado para futuras utilidades como dados, moneda y números aleatorios.
- Una presentación clara del estado de cada herramienta para evitar enlaces a páginas vacías.

## Módulos del hub

### Tiny Wheel

El módulo más avanzado del proyecto. Permite trabajar con ruletas personalizables y cuenta con funcionalidades como:

- Gestión de ruedas y carpetas.
- Edición de opciones, nombres, colores, porcentajes y descripciones.
- Interfaz visual con canvas interactivo.
- Persistencia de datos mediante JSON.

Archivos principales:

- [html/tiny-wheel.html](html/tiny-wheel.html)
- [css/tiny-wheel.css](css/tiny-wheel.css)
- [js/tiny-wheel.js](js/tiny-wheel.js)
- [tiny-wheel-data.json](tiny-wheel-data.json)

### Roller Dice

Módulo previsto para lanzar dados y resolver decisiones rápidas.

Estado actual: en preparación.

### Números aleatorios

Módulo pensado para generar números dentro de un rango configurable.

Estado actual: en preparación.

### Coin Flip

Módulo orientado a lanzar una moneda y elegir entre dos posibilidades.

Estado actual: en preparación.

## Estado actual

En este momento, Tiny Wheel es el único módulo completamente implementado. El resto de herramientas ya forman parte del hub como siguientes piezas del proyecto, pero todavía no tienen interfaz desarrollada.

Esto significa que el enfoque actual del repositorio es doble:

- Mantener Tiny Wheel como módulo principal y funcional.
- Hacer crecer la web como una plataforma con varias utilidades relacionadas.

## Estructura del proyecto

```text
.
|-- index.html
|-- html/
|   |-- tiny-wheel.html
|   |-- roller-dice.html
|   |-- num-ramdom.html
|   \-- coin-flip.html
|-- css/
|   |-- tiny-wheel.css
|   |-- roller-dice.css
|   |-- num-ramdom.css
|   \-- coin-flip.css
|-- js/
|   |-- tiny-wheel.js
|   |-- roller-dice.js
|   |-- num-ramdom.js
|   \-- coin-flip.js
\-- tiny-wheel-data.json
```

## Cómo usarlo

1. Abre [index.html](index.html) en el navegador.
2. Usa el hub para entrar en los módulos disponibles.
3. Accede a Tiny Wheel como herramienta principal ya operativa.

No requiere instalación ni build: es un proyecto estático.

## Objetivo a medio plazo

La intención es que el repositorio termine siendo una pequeña suite de utilidades de azar y decisión, con una entrada común, diseño coherente entre módulos y experiencias independientes para cada herramienta.

## Autoría

Proyecto creado por Adrián R.R.