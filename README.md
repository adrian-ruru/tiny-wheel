# Random Things Hub

Random Things Hub es una colección de utilidades web centradas en el azar, la toma de decisiones rápidas y pequeñas herramientas interactivas. El proyecto ya no gira solo alrededor de Tiny Wheel: ahora [index.html](index.html) funciona como punto de entrada para varios módulos.

## Enfoque del proyecto

La web está planteada como un hub ligero de herramientas autónomas hechas con HTML, CSS y JavaScript sin frameworks. Cada módulo tiene su propia página, sus estilos y su lógica, mientras que la portada principal organiza el acceso a todo el conjunto.

Actualmente el hub ofrece:

- Un acceso centralizado desde [index.html](index.html).
- Un módulo principal ya funcional: Tiny Wheel.
- Acceso a utilidades como dados, moneda y números aleatorios.

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

Módulo para lanzar dados y resolver decisiones rápidas.

### Números aleatorios

Módulo pensado para generar números dentro de un rango configurable.

### Coin Flip

Módulo orientado a lanzar una moneda y elegir entre dos posibilidades.

## Estructura del proyecto

```text
.
|-- index.html
|-- html/
|   |-- tiny-wheel.html
|   |-- roller-dice.html
|   |-- ramdom-numbers.html
|   \-- coin-flip.html
|-- css/
|   |-- tiny-wheel.css
|   |-- roller-dice.css
|   |-- ramdom-numbers.css
|   \-- coin-flip.css
|-- js/
|   |-- tiny-wheel.js
|   |-- roller-dice.js
|   |-- ramdom-numbers.js
|   \-- coin-flip.js
\-- tiny-wheel-data.json
```

## Cómo usarlo

1. Abre [index.html](index.html) en el navegador.
2. Usa el hub para entrar en los módulos.
3. Accede a Tiny Wheel o a cualquier otra utilidad desde la portada.

No requiere instalación ni build: es un proyecto estático.

## Objetivo a medio plazo

La intención es que el repositorio termine siendo una pequeña suite de utilidades de azar y decisión, con una entrada común, diseño coherente entre módulos y experiencias autónomas para cada herramienta.

## Autoría

Proyecto creado por Adrián R.R.
