# Atlas · Editor territorial · Versión 7.0

Editor local con React, TypeScript y SVG para crear mapas imprimibles con fronteras compartidas, agua y tierra sin región. No contiene mecánicas de juego.

## Proyecto y control de versiones

La carpeta de desarrollo es `C:\Users\Usuario\Documents\Codex\Projects\atlas-editor`. El proyecto ya no se desarrolla dentro de `outputs`. Los ZIP y capturas anteriores permanecen en la carpeta original como archivo de entregas.

La rama principal es `main`; la primera versión registrada es `v0.5.3`. El historial comienza con la base actual, sin inventar commits para los ZIP anteriores. Consultar `CHANGELOG.md` y `ROADMAP.md`. La comprobación de GitHub Actions ejecuta instalación reproducible, pruebas y compilación en cada cambio de main y cada pull request.

Para continuar el trabajo, abrir `atlas-editor.code-workspace` en esta carpeta. El repositorio de GitHub es [NachoMoscatelli/atlas-editor](https://github.com/NachoMoscatelli/atlas-editor), conectado como `origin`.

## Iniciar

Requiere Node.js 22.14 o superior y npm. Abrir esta carpeta como proyecto, o `atlas-editor.code-workspace` en Visual Studio Code. En una terminal dentro de la carpeta:

```powershell
npm ci
npm run dev
```

Abrir la dirección indicada, normalmente **http://127.0.0.1:5173/**. Las dependencias ya están instaladas en el workspace entregado: allí basta `npm run dev`. Mantener la terminal abierta; `Ctrl+C` detiene el servidor. No abrir `index.html` mediante doble clic. Funciona sin conexión después de instalar las dependencias.

```powershell
npm test          # Pruebas del motor, migración y archivos
npm run build    # TypeScript + producción en dist/
npm run preview  # Servir la compilación de producción
```

## Dibujar terreno con pinceles (v7.0)

**Geografía** abre el dibujo actual; **Generar mapa → Dibujar terreno** inicia un borrador vacío con las dimensiones elegidas. Ya no se proponen continentes o islas al azar. Un navegador sin proyecto guardado comienza con agua; el modo rectangular clásico sigue disponible de forma explícita. Los proyectos existentes no se regeneran al actualizar.

La paleta está encima del lienzo, sin panel lateral de propuestas. Hay tres herramientas:

- **Tierra · contorno**: mantener clic izquierdo y rodear una superficie. Al soltar, el recorrido se cierra al punto inicial y se suma a la tierra existente. Las superficies que se tocan se unen; pintar sobre agua la rellena. También elimina montañas dentro del área pintada.
- **Agua · pincel**: mantener clic y trazar con el grosor elegido. El trazo recorta tierra y montañas. Si cruza una masa de lado a lado, la separa; un anillo cerrado conserva una isla en el centro. Un toque crea un pequeño lago. Los extremos son redondeados.
- **Montañas · pincel**: mismo gesto y grosor que agua, con textura vectorial. Solo pinta sobre tierra. La masa terrestre continúa siendo una sola, aunque la superficie apta para territorios pueda quedar dividida. Las montañas no tienen territorios ni asignación regional encima.

El **Grosor** se expresa como porcentaje del lado menor del encuadre. Se aproxima con segmentos vectoriales; no son imágenes superpuestas. En agua/montañas, si el trazo termina cerca de su inicio, se conecta para cerrar el anillo. La tierra siempre cierra su contorno al soltar. **Deshacer trazo / Rehacer trazo** conservan hasta 30 cambios del borrador; Ctrl+Z / Ctrl+Mayús+Z funcionan fuera de campos. Escape cancela un trazo activo; el siguiente Escape cierra el borrador. **Vaciar dibujo** también puede deshacerse.

**Aplicar solo geografía** crea áreas de tierra sin región, una por zona apta conectada. Permite guardar y seguir diseñando antes de crear regiones, incluidos mapas de solo agua o de tierra enteramente montañosa. **Continuar a territorios** permite elegir cantidad por masa y creación opcional de región. El mínimo depende de las zonas aptas que separan las montañas; el límite total sigue siendo 120. **Previsualizar territorios → Aplicar mapa** respeta agua y montañas. La irregularidad y el detalle se aplican a las fronteras internas, manteniendo las costas.

La generación reconstruye las divisiones y regiones actuales **solo al aplicar**, en una operación reversible. Cancelar conserva el proyecto abierto. Los cortes, uniones, nodos, selección por lazo y SVG contemplan huecos interiores. El JSON usa **esquema v5**, que requiere esta versión del editor; la lectura de v1/v2/v3/v4 se conserva. La copia local usa atlas.project.v5 y mantiene las anteriores como respaldo. Máximos: 3 MB, 120 territorios, 80 masas, 120 polígonos montañosos, 12000 vértices totales y 2000 nodos por anillo. Los fragmentos menores de una unidad cuadrada del lienzo se descartan como residuos del pincel; un exceso de detalle se informa conservando el borrador anterior.

Las operaciones de dibujo usan [polygon-clipping](https://github.com/mfogel/polygon-clipping). src/geometry/paint.ts implementa trazos y distribución; polygons.ts concentra operaciones, anillos con huecos, etiquetas, normalización compartida y validación de cobertura. La geometría territorial cubre exactamente tierra menos montañas. Las montañas siguen siendo parte de las masas físicas.

Ejemplo: examples/terreno-pintado-v7.atlas.json y su SVG contienen un continente, un anillo de agua con isla y una cordillera. El JSON se abre desde **Abrir proyecto**.

Comprobación v7: 149 pruebas del motor aprobadas, compilación correcta y nueve comprobaciones del flujo de dibujo en /tests/browser/painting.html. Esta última usa eventos sintéticos y una captura simulada de puntero; se comprobaron adicionalmente arrastres nativos de agua y montañas, vista previa de 32 territorios, aplicar y recuperación exacta del mapa con Deshacer. Las pruebas usaron un puerto separado del proyecto del usuario.

## Tierra, regiones y encuadre (v6.1 — controles anteriores reemplazados por pinceles)

El mapa distingue **encuadre**, **tierra/agua** y **asignación regional**. Una masa terrestre puede continuar hasta los lados del encuadre. Quitarle una región a un área no elimina ni deforma la tierra.

- Para un archipiélago como escenario, mantener las masas rodeadas de agua.
- Para un continente con regiones de interés, prolongar tierra hasta el borde y dejar las áreas exteriores sin región. Las fronteras regionales pueden quedar dentro de una misma masa terrestre.
- Para dos costas con una isla entre ellas, ajustar masas independientes y prolongar las dos principales hacia sus lados respectivos. Esto representa la distribución de tierra y agua; el río como entidad geométrica divisoria sigue pendiente.

En **Geografía → Masa seleccionada**, elegir **Continuidad de tierra** y pulsar **Prolongar tierra hasta el borde**. Se conserva la costa que mira hacia el interior y se continúa el otro lado hasta el encuadre. Se puede repetir hacia otro lado; se rechazan cruces con otras masas. Esta operación modifica el borrador y, al aplicar, regenera la distribución, como las demás ediciones de Geografía.

**Separación inicial del borde** admite 0–20 % y solo afecta la ubicación de las propuestas nuevas. No crea una franja prohibida ni limita el arrastre posterior. Arrastrar una masa hasta el borde conserva su forma; prolongarla agrega tierra.

Desactivar **Crear región en esta masa** deja sus áreas como tierra de contexto. En Distribuir territorios se puede elegir lo mismo por masa; inicialmente se reserva una sola área para cada masa de contexto. En el mapa ya aplicado, seleccionar una o varias áreas y pulsar **Dejar como tierra sin región**, en **Seleccionar y unir**, quita su asignación sin cambiar vértices, nombres o costas. Se puede deshacer en una operación. La casilla **Asignar a una región** de un territorio permite devolverle una región individual.

La separación entre una región y el borde puede estar ocupada por agua o tierra sin región. **Todavía no se genera automáticamente una franja de ancho numérico alrededor de una región**: se delimita editando sus áreas. Ríos y montañas como entidades que fragmentan territorios e impiden asignaciones regionales quedan para otra iteración. Las medidas físicas de la hoja y su presentación se mantienen independientes de esta separación geográfica.

Los archivos mantienen el esquema v4; margin pasa a registrar solo la separación inicial, admite cero y no restringe la geometría. Para abrir tierras que llegan al encuadre se necesita el editor v6.1 o posterior. Los archivos existentes no se regeneran al actualizar.

## Costas e islas: geografía primero (v6.0 — historial de la interfaz anterior)

1. Pulsar **Generar mapa**, elegir **Costas e islas · geografía primero**, configurar tamaño, semilla y división, y pulsar **Definir geografía**. **Rectángulo clásico** conserva la generación anterior.
2. En **Definir tierra y agua**, elegir cantidad de islas, extensión de tierra, irregularidad de costa y separación inicial del borde. **Otra propuesta** varía la forma usando la misma semilla. Estos controles reemplazan la propuesta, sin modificar el proyecto abierto.
3. Arrastrar una masa para moverla, o sus puntos para ajustar la costa. El selector permite elegir y nombrar cada masa, agregar un punto en su tramo más largo o quitarla. Se impiden cruces y superposiciones, y se permite llegar al encuadre.
4. Continuar a **Distribuir territorios**, indicar la cantidad por masa y pulsar **Previsualizar territorios**. Se admiten entre 4 y 120 en total, con al menos uno por masa. La distribución inicial se propone según la superficie.
5. **Aplicar mapa costero** reemplaza el mapa en una sola operación que puede deshacerse. Cancelar conserva el proyecto anterior.

El botón superior **Geografía** abre las costas del mapa actual cuando existen, o propone una geografía nueva para mapas antiguos. **Editar aquí y aplicar genera otra distribución de territorios y regiones**: no conserva las divisiones o nombres actuales. Revisar la vista previa antes de aplicar. Para ajustes puntuales que conserven los territorios, usar **Nodos** en el lienzo principal.

El mar es un fondo sin territorios seleccionables; las costas son límites geométricos reales. Cada masa marcada para ello comienza con una región, que luego puede reorganizarse desde **Regiones**, incluso agrupando territorios de islas diferentes. Las divisiones posteriores conservan la región. Los territorios costeros siempre son tierra y el agua se define en Geografía. Los mapas rectangulares anteriores siguen admitiendo áreas de agua como antes.

Esta primera etapa admite masas simples separadas, movimiento y edición de vértices. **Todavía no permite lagos interiores, dibujo libre de costas ni territorios con varios contornos**. Cambiar los parámetros de propuestas no conserva los ajustes manuales del borrador. JSON y SVG incluyen el mar y las costas; los proyectos costeros usan el esquema v4 y requieren esta versión del editor.

## Vista Solo áreas (v5.3)

Activar **Solo áreas** en la barra de herramientas, junto a **Etiquetas**, oculta el marco de presentación, la sombra, el título, el subtítulo y el pie del mapa. Queda solo el rectángulo de territorios, con sus colores y fronteras. Desactivarlo recupera la presentación completa sin modificar la geometría ni el historial. **Etiquetas** permite ocultar los nombres de forma independiente. El mapa continúa siendo editable en ambas vistas.

**Exportar SVG** respeta estas opciones: en Solo áreas usa el rectángulo de la malla como encuadre y omite el fondo y título visibles. Conserva las medidas físicas elegidas; si la proporción del rectángulo difiere de la hoja, el visor puede dejar espacio transparente para evitar deformarlo. El título se conserva como metadato accesible del archivo. Estas opciones de vista son temporales y no se guardan en el JSON.

## Generar un mapa y elegir su tamaño (v5.2)

1. Pulsar **✧ Generar mapa** en la barra superior. La ventana reúne cantidad de territorios, semilla, irregularidad y tramos por frontera. Abrirla no modifica el mapa.
2. Indicar **Ancho (cm)** y **Alto (cm)**, entre 10 y 200 cm por lado. Se admiten tamaños horizontales, verticales y cuadrados. **Usar 70 × 50 cm** recupera el tamaño de referencia.
3. **70 × 50 cm es un valor provisional acordado con el usuario**, no una medida verificada del tablero desplegado de TEG La Revancha. La página del [fabricante](https://yetem.com/juegos/t-e-g-la-revancha-2/) consultada no proporciona esas medidas y las publicaciones comerciales encontradas indican dimensiones de embalaje. Las medidas exactas se pueden introducir en cualquier momento al generar otro mapa.
4. En el modo clásico, pulsar **Generar mapa** dentro de la ventana para reemplazar el proyecto actual. En Costas e islas, continuar al flujo de geografía descrito arriba. **Cancelar**, la × o Escape cierran la ventana sin aplicar la configuración. No hay una segunda confirmación: la ventana indica que reemplaza el mapa y que se puede recuperar con **Deshacer**.
5. El ancho y alto corresponden a la **hoja/tablero completo**, incluidos título y márgenes, y se guardan con el proyecto. El mapa ocupa el espacio interior y cambia sus proporciones sin estirar los territorios después de generarlos. Los nuevos mapas parten del tamaño provisional; los proyectos antiguos conservan su exportación A4 hasta generar un nuevo mapa con dimensiones elegidas.

El SVG utiliza las medidas físicas del proyecto, ya no un A4 fijo. Para obtener el tamaño previsto al imprimir, usar escala 100 % o tamaño real y una hoja/impresión adecuada; ajustar a página cambia la escala. La exportación PDF y la impresión en mosaico de varias hojas siguen siendo extensiones futuras. La interfaz muestra las dimensiones del proyecto junto al título y en el pie del mapa.

## Paneles y administrador de regiones (v5.0)

El panel izquierdo se organiza en cuatro secciones: **Seleccionar y unir**, **Territorio**, **Dividir territorio** y **Corte manual y fusión**. **Generar mapa** está en la barra superior y abre una ventana de configuración. Solo una permanece abierta; pulsar de nuevo su título permite cerrar todas. Seleccionar un territorio abre sus propiedades; las herramientas de corte manual y selección abren la sección correspondiente. **Nodos** se controla exclusivamente desde la barra superior: muestra los puntos y signos + del mapa, un contador de vértices y **Quitar nodo seleccionado** debajo de la barra. Los controles conservan sus valores al plegarse.

El botón **Regiones** de la barra superior abre o cierra el panel derecho. Al crear una región desde **Región con subdivisiones**, se abre automáticamente y muestra la región nueva. El listado incluye una fila por región, con su color, nombre y cantidad de territorios; incluye regiones individuales y excluye agua/tierra sin región. El panel tiene su propio desplazamiento y se puede cerrar para ampliar el lienzo. En pantallas estrechas se muestra sobre el lado derecho del editor.

1. Hacer clic en una región para desplegar su ficha.
2. Editar **Nombre de la región** y **Color de la región**, o escribir su código hexadecimal, y pulsar **Guardar cambios**. El color de la región se aplica a todos sus territorios en pantalla y en el SVG. El panel del territorio permite editar su nombre y superficie, y ofrece **Editar región y color** para abrir su región; no tiene una paleta de color propia.
3. Ver todos sus integrantes en **Territorios**. **Ver en mapa** selecciona sus territorios sin modificar el proyecto.
4. Pulsar el tachito junto a un territorio para separarlo. Se convierte en una región individual con su nombre y un color inicial recuperado del proyecto, editable desde su ficha, sin eliminar geometría ni dejarlo como área libre. La región original conserva su identidad, nombre y color aunque le quede un solo territorio. Al separar el último integrante desaparece el registro vacío. El tachito está desactivado cuando el territorio ya forma su propia región individual.
5. **Deshacer** recupera cada edición o separación. Las regiones se guardan en el JSON y en la copia local; nombre y color aparecen en el SVG.

Las regiones individuales de proyectos anteriores conservan su identidad al dividirse: se crea un registro independiente con su nombre y color antes de agregar subterritorios. Ninguna división, manual o automática, crea regiones nuevas por defecto. Las áreas libres siguen libres.

## Dividir un área en una cantidad elegida de partes (v4.6)

1. Seleccionar una única área del mapa (el nodo o pieza que se quiere subdividir).
2. En **Dividir en varias áreas**, elegir **Puntos de corte**: **Vértices existentes** (predeterminado) conecta puntos que ya pertenecían al contorno del territorio; **Cualquier punto del borde** permite insertar extremos nuevos. Escribir la **Cantidad de partes**. Se admite desde 2 hasta el máximo disponible para el modo elegido, sin superar las 120 áreas del mapa.
3. Ajustar **Irregularidad** (0–100 %) y **Detalle de fronteras** (1–12 tramos por arista interna nueva). Por defecto se usan 75 % y 8 tramos. El detalle agrega puntos editables compartidos; la irregularidad los desplaza formando curvas suaves. Con irregularidad 0 quedan alineados y con detalle 1 no hay puntos intermedios. Pulsar **Previsualizar división** para ver las partes numeradas. La distribución favorece formas compactas y un reparto equilibrado, pero las superficies pueden tener tamaños distintos.
4. Elegir **Aplicar división** o **Cancelar vista previa**. La vista previa no modifica ni guarda la geometría del proyecto; mientras se muestra, el mapa no admite edición geométrica. Cambiar el modo de puntos de corte, la cantidad, la irregularidad, el detalle, la selección o el proyecto descarta la vista previa.
5. Al aplicar se seleccionan las nuevas partes, listas para editar individualmente o volver a unir. Toda la división se puede deshacer o rehacer en un solo paso.

Las partes conservan superficie y pertenecen a la misma región del territorio original, incluso si la región tenía un solo territorio. Heredan su color común y no aumenta el número de regiones. Si el área estaba libre, todas siguen libres. En el modo libre, los extremos nuevos sobre fronteras vecinas se insertan también en esos vecinos, conservando la superficie total y evitando huecos. Con vértices existentes, los vecinos conservan exactamente sus anillos y coordenadas.

El modo libre evalúa cortes interiores en 16 direcciones. El modo de vértices evalúa diagonales entre vértices actuales y reserva suficientes vértices para las subdivisiones pendientes. Ambos penalizan los perímetros largos y luego transforman las nuevas fronteras internas en cadenas curvas compartidas. El contorno exterior se mantiene fijo: una forma original estrecha puede seguir produciendo partes alargadas. Se controla la distancia a otras fronteras y se reduce la curvatura si hace falta para evitar cruces. Las etiquetas se recolocan en el interior de cada parte. Es determinista para la misma forma, cantidad y controles. Si la forma, tamaño mínimo o límites de nodos impiden la división, informa un error y conserva íntegro el proyecto; puede probarse una cantidad menor o un corte manual. No promete áreas exactamente iguales.

Con **Vértices existentes**, los extremos de todas las nuevas fronteras pertenecen al contorno original. El detalle crea vértices intermedios solo en las fronteras internas, después de calcular los cortes. Sin introducir extremos adicionales, un territorio con n vértices admite como máximo n−2 partes; el tamaño mínimo y la geometría pueden reducir ese máximo. Un cuadrilátero puede dividirse en dos, y un triángulo requiere agregar vértices desde **Nodos** o elegir el modo libre. Esta restricción puede producir piezas triangulares; el modo libre permite buscar formas más compactas. No hay cambio automático de modo si no se encuentra una solución.

## Contorno conjunto y selección por contacto (v4.3)

Al seleccionar varias áreas, el resaltado recorre solo el contorno del conjunto. Las aristas compartidas por dos áreas seleccionadas no se resaltan; conservan el trazo normal del mapa. Esto también funciona con componentes separadas y con huecos, sin modificar la geometría ni realizar una unión.

**Lazo con botón derecho:** mantener el botón derecho sobre el mapa, dibujar un recorrido libre y soltar. La vista muestra un trazo semitransparente cerrado; al soltar se agrega el segmento desde el último punto hasta el inicial. Se agregan las áreas que el trazo toque, atraviese o encierre, incluso si el contacto solo ocurre en un borde o esquina. También se detectan áreas enteramente encerradas y lazos pequeños dentro de un área grande. No se utiliza el centro del área ni la posición de su etiqueta.

También se puede activar **Lazo** en la barra y dibujar con el botón izquierdo. El botón derecho está disponible desde cualquier herramienta, incluso sobre nombres o controles SVG. En el mapa se evita el menú contextual para reservar ese botón al lazo.

- La selección es acumulativa: sucesivos lazos agregan áreas y no quitan las anteriores.
- Un clic sin movimiento o un trazo que no toca el mapa conserva la selección previa. Una pasada recta también suma las áreas que atraviesa; no hace falta encerrar una superficie ni pasar por el centro.
- Escape cancela un lazo en curso y conserva la selección. Una cancelación del puntero o pérdida de foco también descarta el trazo.
- Se puede soltar fuera del SVG: el editor utiliza captura de puntero para completar o cancelar el gesto.
- Mayús + clic permite quitar áreas individuales; **Limpiar selección** vacía todo.
- Seleccionar no fusiona ni modifica áreas. Después se puede pulsar **Unir en una sola área**.

## Unir varias áreas en una sola pieza (v4.1)

1. Activar **Selección múltiple** y hacer clic en las áreas, o usar **Mayús + clic** para sumarlas o quitarlas.
2. Pulsar **Unir en una sola área**. El panel indica cuántas áreas se convertirán en una y qué nombre se conservará.
3. El resultado es un único polígono seleccionable y editable: se eliminan las fronteras internas y los nodos que dejan de usarse. Se conservan el identificador, nombre, color, superficie y asignación de la primera área seleccionada. Después se pueden cambiar sus atributos.

La unión se hace en una sola operación sobre toda la selección. Las áreas deben estar conectadas por aristas; tocarse solo en una esquina no basta. Se rechazan piezas separadas y uniones que dejen huecos o superen los límites de nodos. Las áreas no seleccionadas conservan sus formas. Se puede deshacer/rehacer y guardar/cargar el resultado.

Ejemplo: seleccionar tres áreas contiguas y unirlas deja **una sola área**, con un único contorno y sin las divisiones anteriores. La selección pasa automáticamente a esa pieza, lista para mover o editar.

## Opcional: región con subdivisiones

La opción anterior de crear una región lógica se conserva dentro del desplegable **Región con subdivisiones**, separada de la unión geométrica. Para convertir las áreas en una sola pieza, usar el botón principal **Unir en una sola área**.


1. Activar **Selección múltiple** y hacer clic en cada área para sumarla o quitarla. También se puede comenzar con un clic normal y sumar con **Mayús + clic**. El panel muestra la cantidad y todos los contornos seleccionados se resaltan. **Seleccionar todas** y **Limpiar selección** completan los controles.
2. Escribir **Nombre del grupo**, elegir su color y pulsar **Crear grupo conservando áreas**. Requiere al menos dos áreas. El grupo se convierte en una región compartida; las áreas conservan sus polígonos, nombres, superficies y colores propios. Se admiten áreas separadas y de distintos tipos de superficie.
3. El mapa y el SVG usan el color común y el nombre del grupo. Las fronteras interiores siguen visibles con trazos más suaves; los límites de la región se dibujan sólidos. El conteo de regiones considera el grupo una sola vez.
4. Al seleccionar un miembro, **Seleccionar grupo completo** recupera todos los integrantes. Con todo el grupo seleccionado se puede usar **Guardar cambios del grupo** para modificar nombre/color o **Desagrupar grupo** para volver a regiones individuales con sus colores propios. Si antes había áreas libres, desagrupar también las convierte en regiones individuales; **Deshacer** recupera exactamente el estado anterior.

Agrupar no fusiona geometrías ni elimina sus fronteras. La operación de fusionar sigue disponible para áreas vecinas seleccionadas individualmente. Los atributos y nodos de un área se editan con selección individual, para evitar cambios parciales accidentales. No hay arrastre conjunto de la selección en esta versión.

La selección es temporal; los grupos se guardan en el proyecto y en la copia local. Agrupar, modificar grupos y desagrupar se pueden deshacer/rehacer. Reagrupar una selección parcial modifica solo esas áreas; un grupo que queda con menos de dos miembros se convierte en regiones individuales.

## Agua y tierra sin región

1. Seleccionar un área en el mapa.
2. En **Superficie**, elegir **Tierra** o **Agua**. Agua propone un color azul y desmarca la asignación de región.
3. Desmarcar **Asignar a una región** para que el área sea libre. Esto también permite tierra neutral. Superficie y asignación se pueden cambiar independientemente.
4. Elegir el nombre. Las áreas libres usan un tono azul para agua y verde neutro para tierra. Para territorios asignados, el color se edita en su región. Los cambios se guardan y aparecen en el SVG.

El pie cuenta regiones y áreas libres por separado. Cada área conserva su geometría editable aunque no pertenezca a una región. Esta versión permite convertir, dividir y fusionar áreas existentes. Todavía no dibuja un lago cerrado dentro de un polígono. Los contornos de las áreas libres siguen visibles en la exportación.

## Dividir y fusionar (v3)

**Dividir:** seleccionar un área y pulsar **Dividir esta área** en el panel, o **Dividir** en la barra. Marcar dos puntos de su borde con dos clics; aparece una guía desde el primero. Los clics se ajustan al borde dentro de una tolerancia de 16 píxeles. Escape cancela. La línea debe quedar dentro del área: se rechazan cortes exteriores, cruces y partes demasiado pequeñas. Cada parte conserva superficie y pertenece a la misma región y color del territorio original. Si el área estaba libre, ambas siguen libres. El nombre de la nueva parte termina en «(2)».

**Fusionar:** seleccionar el área principal y elegir un vecino en **Fusionar con**. Solo se ofrecen áreas que comparten una arista; tocarse en una esquina no basta. El vecino se resalta y el panel explica qué propiedades se conservarán. Pulsar **Fusionar áreas** para eliminar la frontera interior. Se mantienen el nombre, color, superficie y asignación de la primera área, incluso si el vecino tenía otras propiedades. Se rechazan uniones con huecos o varios contornos.

Ambas operaciones se pueden deshacer y rehacer y se guardan en JSON. Los extremos de un corte se insertan también en las fronteras de todos los vecinos. Al fusionar se eliminan los nodos que dejan de usarse.

El límite de 120 áreas sigue vigente. La cantidad elegida en Generación describe el punto de partida; después de dividir o fusionar puede diferir del total actual.

## Cantidad de aristas

Una **frontera** separa dos áreas vecinas y está compuesta por **tramos rectos** o aristas. Un nodo intermedio une dos tramos.

- Al generar, **Tramos por frontera** elige entre **1 y 6** para cada frontera interior inicial: 1 tramo sin nodos intermedios, 2 tramos con 1 nodo, o 6 tramos con 5 nodos. El valor inicial 2 equivale al generador anterior. El contorno exterior mantiene sus aristas iniciales.
- **Irregularidad** desplaza nodos: cambia la forma, no la cantidad de tramos. Con irregularidad 0 quedan alineados.
- En **Nodos**, cada **+** agrega un punto medio compartido y divide una arista en dos sin cambiar su forma. Después se puede arrastrar el nuevo nodo.
- En la herramienta superior **Nodos**, seleccionar un círculo y pulsar **Quitar nodo seleccionado** en la barra contextual elimina un nodo intermedio y une sus tramos. Las uniones de tres o más fronteras y las esquinas de la hoja están protegidas. Se rechazan cambios que produzcan cruces.
- El panel muestra **nodos / aristas del perímetro**: la suma de todas las fronteras del área y sus bordes exteriores. Este total no es el número de vecinos.

Ambos vecinos recorren los mismos nodos en sentidos opuestos. Agregar, mover o quitar un nodo modifica todas las áreas involucradas. Los parámetros iniciales solo se aplican al pulsar **Generar mapa**.

## Edición y archivos

- **Generar mapa:** 4 a 120 áreas, semilla, irregularidad y tramos. La misma combinación, incluidas las dimensiones, reproduce el mismo mapa. Se configura desde la ventana superior y se puede deshacer.
- **Mover:** arrastrar un área mueve su malla y deforma sus vecinos. Los nodos exteriores conservan su eje para mantener la hoja rectangular.
- **Nodos:** arrastrar círculos y usar los signos +. Se mantiene la última posición válida si un movimiento produciría cruces.
- **Nombres:** arrastrar una etiqueta sin mover fronteras. Los nombres largos pueden requerir abreviación o reubicación manual.
- **Deshacer / Rehacer:** hasta 40 operaciones; `Ctrl+Z` / `Ctrl+Mayús+Z`, también Cmd en macOS. El historial no se guarda en el JSON.
- **Guardar proyecto:** descarga `mapa.atlas.json`. **Abrir proyecto** acepta esquemas v1, v2, v3 y v4; migra los antiguos sin alterar su geometría, nombres ni colores.
- **Exportar SVG:** salida vectorial con el tamaño físico elegido (A4 horizontal de 297 × 210 mm para archivos anteriores sin dimensiones), título, colores y nombres según **Etiquetas**. Abrir en un navegador o editor vectorial para imprimir.

El proyecto se recupera desde el almacenamiento local del mismo navegador, perfil y dirección. La v6 utiliza la clave local atlas.project.v4 y mantiene las copias anteriores; si aún no hay copia nueva, recupera el proyecto de la versión previa. Para conservar o transportar trabajo, descargar el JSON. El SVG es una salida imprimible; su reimportación aún no está implementada.

## Arquitectura

```text
src/model/types.ts        Esquemas v3/v4 y contratos MapImporter / MapExporter
src/geometry/generate.ts  Semilla, Voronoi, relajación y subdivisión
src/geometry/geography.ts Costas, masas separadas y distribución sobre tierra
src/editor/GeographyDialog.tsx Borrador visual de geografía y vista previa
src/geometry/topology.ts  Aristas únicas, áreas, cruces y rutas SVG
src/geometry/edit.ts      Subdivisión y eliminación de nodos compartidos
src/geometry/areas.ts     División de áreas, vecinos y fusión de contornos
src/geometry/*.test.ts    Pruebas de geometría, migración y archivos
src/editor/MapCanvas.tsx  Lienzo, selección, arrastre y controles de nodos
src/editor/useProject.ts  Historial inmutable
src/io/project.ts         Validación, migración v1/v2→v3 y persistencia
src/model/groups.ts       Agrupación, desagrupación, selección y conteos
src/model/regions.ts      Listado de regiones, edición independiente y separación
src/editor/EditorSection.tsx Secciones plegables del panel izquierdo
src/editor/RegionsPanel.tsx  Administrador de regiones del panel derecho
src/editor/GroupPanel.tsx Controles de selección y edición de grupos
src/geometry/presentation.ts Fronteras interiores y etiquetas de grupos
src/io/svg.ts             Exportación independiente de la interfaz
src/model/print.ts        Tamaño físico, validación y proporciones de generación
src/editor/GenerationDialog.tsx Ventana de generación y dimensiones en cm
src/App.tsx               Controles del editor
```

La malla almacena un diccionario de vértices y anillos de identificadores por área. La aplicación abre v1/v2/v3/v4. Los mapas clásicos conservan v3; los costeros usan v4 con geography.landforms (anillos de los mismos identificadores de vértices de la malla), margin y waterColor. Cada arista de costa aparece una sola vez entre los territorios; las aristas interiores, dos veces. La superficie territorial total coincide con la tierra, dejando el mar fuera de la malla. El campo histórico `territories` contiene las áreas geométricas; cada una tiene `surface: 'land' | 'water'` y `regionId: string | null`. Cada área puede tener una región propia (`regionId === id`), estar libre (`null`) o compartir un identificador de `groups`. Cada grupo almacena `id`, `name` y `color`, con al menos dos miembros por defecto. La v5 admite el indicador opcional `keepSingle: true` para conservar la identidad de una región con un solo territorio. Los registros vacíos se eliminan; el máximo de registros es 120. El importador valida las referencias; las operaciones limpian los grupos sin miembros suficientes según ese indicador, sin modificar los estados previos del historial. Se mantiene el esquema v3 y la compatibilidad de lectura con los proyectos anteriores; las versiones antiguas del editor no admiten los nuevos registros de región de un solo integrante.

La generación usa [d3-delaunay/Voronoi](https://d3js.org/d3-delaunay/voronoi), dos pasadas de relajación y subdivisión de aristas interiores. Los desplazamientos se limitan según su proximidad a otras aristas. La configuración utiliza [Vite](https://vite.dev/guide/).

La carga valida versión, tipos, referencias, colores, áreas positivas, cruces, incidencia y cobertura rectangular o costera según el proyecto. Límites: 3 MB, 120 áreas, 3000 vértices y 500 nodos por anillo. El SVG escapa textos como XML y conserva superficie/asignación como atributos de sus polígonos.

**Próximas extensiones:** implementar `MapImporter` para GeoJSON/SVG y normalizar fronteras hacia la misma malla editable. El esquema v4 admite masas de tierra separadas, con un anillo simple por territorio. Huecos, multipolígonos y proyección requieren ampliar el esquema y sus validadores. Implementar `MapExporter` para PDF; actualmente puede imprimirse el SVG usando «Guardar como PDF». Para mapas mayores, añadir índice espacial y validación en un worker: el chequeo actual de cruces es cuadrático.

## Ejemplos y verificación

- `examples/continente-contexto-v6.1.atlas.json` y `examples/continente-contexto-v6.1.svg`: ejemplo esquemático de continente hasta el borde con tierra exterior sin región. No representa una geografía histórica.

Verificación v6.1: 135 pruebas aprobadas, compilación y edición en navegador comprobadas. Se verificaron continuidad hasta dos bordes, islas intactas, tierra sin región y Deshacer recuperando exactamente geometría, colores y asignaciones.

- `examples/costas-islas-v6.atlas.json` y `examples/costas-islas-v6.svg`: continente y tres islas, 32 territorios, mar sin territorios y tamaño físico 70 × 50 cm.

Verificación v6.0 (23 de octubre de 2026): 127 pruebas aprobadas y compilación correcta. La prueba en navegador generó una vista previa de 72 territorios sobre cuatro masas, aplicó el mapa y recuperó con Deshacer exactamente las fronteras del proyecto anterior.

- `examples/tablero-solo-areas-v5.3.svg`: exportación del tablero sin marco, título ni márgenes decorativos.

- `examples/tablero-70x50-v5.2.atlas.json` y `examples/tablero-70x50-v5.2.svg`: tablero de referencia de 70 × 50 cm.

- `examples/subdivision-region-v5.1.atlas.json` y `examples/subdivision-region-v5.1.svg`: cinco subterritorios que conservan una sola región y su color común.

- `examples/regiones-v5.atlas.json` y `examples/regiones-v5.svg`: región con un solo territorio que conserva su identidad, territorio separado y región individual con nombre/color independientes.

- `examples/subdivision-vertices-v4.6.atlas.json` y `examples/subdivision-vertices-v4.6.svg`: cinco partes con extremos en vértices existentes y fronteras internas curvas.

- `examples/subdivision-organica-v4.5.atlas.json` y `examples/subdivision-organica-v4.5.svg`: división en cinco partes con fronteras curvas compartidas.

- `examples/subdivision-v4.4.atlas.json` y `examples/subdivision-v4.4.svg`: un área original dividida automáticamente en cinco piezas.

- `examples/union-v4.1.atlas.json` y `examples/union-v4.1.svg`: ejemplo de tres áreas convertidas en una sola pieza.

- `examples/grupos-v4.atlas.json` y `examples/grupos-v4.svg`: tres áreas agrupadas con color y nombre común.

- `examples/division-v3.atlas.json` y `examples/division-v3.svg`: ejemplo de un área dividida en dos partes editables.
- `examples/horizonte.atlas.json`: ejemplo original v1 para comprobar compatibilidad.
- `examples/agua-tierra-v2.atlas.json`: ejemplo v2 con agua y tierra sin región.
- `examples/agua-tierra-v2.svg`: su salida imprimible.

Verificado el 20 de octubre de 2026: compilación correcta y **113 pruebas aprobadas**. Incluyen 4/32/120 áreas, 1/3/6 tramos, cobertura sin huecos, subdivisión/eliminación compartida, uniones protegidas, migración, persistencia de superficies/asignación, cortes y fusiones con cobertura completa, áreas cóncavas y rechazo de huecos.

En el navegador de escritorio se comprobó convertir un área en agua libre, el cambio de conteo, agregar/quitar un nodo y deshacer las operaciones. Se conservó el mapa del usuario al terminar las pruebas. En la v3 también se dividió un área de un mapa de 72 regiones y se fusionaron sus dos partes en el navegador; ambas operaciones se deshicieron para recuperar el proyecto original. La adaptación móvil está implementada pero no fue comprobada en un dispositivo físico.

En la v4 se verificó en el navegador la selección de tres áreas con Mayús + clic, agrupación, selección parcial/completa, desagrupación y deshacer. El mapa del usuario, incluidas sus áreas de agua, se restauró tras la prueba. Las pruebas del motor verifican persistencia, migración, colores propios, exportación y compatibilidad con división/fusión.


En la v4.1 se verificó la unión de tres áreas en una sola pieza en el navegador, eliminando sus líneas internas, y luego se deshizo para conservar el mapa del usuario. Las pruebas adicionales cubren unión múltiple, eliminación de aristas/nodos internos, conservación de vecinos, selección desconectada y resolución simultánea de contornos.

Comprobación del lazo en navegador: iniciar el editor y abrir `/tests/browser/lasso.html`, con un mapa de varias áreas, y pulsar el botón de comprobación. Verifica cierre automático, eventos de botón derecho e izquierdo, menú contextual, suma de selección y cancelación. Esta prueba usa eventos sintéticos con captura de puntero simulada; se verificó además un clic derecho real para comprobar la captura nativa y la supresión del menú. Se completaron 11 comprobaciones en el navegador integrado. La prueba no cambia la geometría del proyecto.

El contorno resaltado y el lazo son ayudas de edición: no cambian el proyecto, no se guardan y no aparecen en el SVG exportado. La herramienta Lazo permanece activa después de cerrar un recorrido, para poder sumar nuevas áreas con sucesivos trazos.

La v4.3 reemplaza la selección por centros por intersección geométrica. Se prueban contactos mínimos, bordes compartidos, trazos rectos, pasos entre muestras lejanas, lazos contenidos en áreas, áreas encerradas, formas cóncavas y ausencia de contacto. El umbral mínimo del gesto es de cuatro píxeles para evitar que un clic derecho sin recorrido seleccione accidentalmente.

La v4.4 añade `src/geometry/subdivide.ts` (subdivisión automática) y `src/editor/SubdivisionPanel.tsx` (cantidad, vista previa, aplicar/cancelar). Se verificaron divisiones en 2/3/5/10 partes, formas cóncavas, conservación de grupos y agua libre, y una división que llega exactamente a 120 áreas. En el navegador se comprobó previsualizar cinco partes sobre un área cóncava grande, cancelar, aplicar y recuperar el original con un solo Deshacer. El mapa del usuario se conservó.

La v4.5 mejora la compacidad de las partes y añade irregularidad y detalle para las fronteras de subdivisión. Las curvas son polilíneas de nodos compartidos, editables y exportables con la misma geometría que se muestra en pantalla. Se verificaron compacidad en un rectángulo, curvas con más aristas, conservación de vértices existentes, desactivación de irregularidad y detalle máximo. En el navegador se revisaron cinco partes sobre el área cóncava del usuario, los controles, aplicar y deshacer; se restauró el mapa original.

La v4.6 añade puntos de corte en vértices existentes, con selector de modo y límite de cantidad según los vértices disponibles. Las pruebas cubren extremos originales, anillos vecinos intactos, determinismo, agua libre con curvas compartidas, límite n−2, alternativa libre y una forma cóncava en L. En el navegador se comprobó la vista previa de cinco partes sobre el territorio cóncavo del usuario, el cambio de modo y la conservación del mapa.

La v5.0 reorganiza las herramientas y añade el administrador de regiones. Se verificaron en navegador: secciones exclusivas, apertura/cierre del panel derecho, apertura automática al crear una región, edición de nombre y color, separación hacia una región individual, conservación de nombre/color al quedar un integrante y Deshacer para recuperar el mapa del usuario. Las 97 pruebas incluyen enumeración sin áreas libres, identidad independiente, exportación, persistencia, eliminación de registros vacíos, referencias inválidas e inmutabilidad. La disposición adaptable está implementada; no fue comprobada en un teléfono físico.

La v5.1 elimina la sección lateral de vértices y concentra agregar/mover/quitar nodos en la herramienta superior. El color se edita desde las regiones, con acceso directo desde cada territorio; se conserva el campo histórico de color en los archivos para compatibilidad e inicialización de regiones antiguas. Las áreas sin región usan colores de superficie. Los cortes manuales y automáticos conservan siempre la región; una región individual antigua adquiere metadatos propios antes del primer corte, preservando nombre y color. Se verificó en navegador agregar y quitar nodos desde la barra, dividir un territorio en cuatro sin aumentar las cinco regiones existentes, aplicar un color común a las cuatro partes y deshacer las operaciones para conservar el mapa del usuario.

La v5.2 mueve Generar mapa a la barra superior y añade una ventana modal nativa con configuración, dimensiones, validación y cancelación. Los campos opcionales `generation.widthMm` y `generation.heightMm` guardan el tamaño total en milímetros dentro del esquema v3. Deben aparecer juntos y estar entre 100 y 2000 mm. Sin ellos se preservan el generador histórico y la exportación A4. La geometría deja espacio para título/márgenes con la misma relación de aspecto que la hoja. Se probaron seis tamaños, incluidos verticales, cuadrados y extremos; cobertura completa, exportación física, persistencia, determinismo, rechazo de dimensiones inválidas y compatibilidad anterior. En navegador se comprobó el tamaño provisional, cancelación sin cambios, bloqueo de un ancho menor a 10 cm, generación vertical 40 × 60 cm, recuperación de sus opciones, cierre con Escape y Deshacer; la geometría, colores y nombres del mapa original coincidieron exactamente con el estado previo a la prueba.

La v5.3 añade Solo áreas para el lienzo y la exportación SVG. Se verificaron desaparición/restauración de los elementos de presentación, geometría intacta y combinación con etiquetas. Las 113 pruebas incluyen exportación sin fondo ni título visible, encuadre del rectángulo y conservación de dimensiones físicas.
