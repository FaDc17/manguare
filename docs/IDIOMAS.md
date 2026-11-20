# Idiomas de la aplicación

El selector está en **Ajustes → Idioma**, en Inicio, en las pantallas de ingreso y registro y en el panel de salud. Cambia la interfaz en la pantalla actual y guarda la preferencia junto a los ajustes de la PWA. Los valores históricos `aw` y `sh` se leen como `agr` y `cbt`. La PWA y el panel recuperan la misma preferencia al abrirse en el mismo navegador.

Los catálogos están en `web/src/locales/` y se incluyen en la compilación de la PWA. Tras la primera carga con conexión, se puede cambiar de idioma y volver a abrir la aplicación sin red. Si falta una clave, se muestra el texto en español. El texto de los usuarios, los identificadores del servidor y los SMS conservan su idioma original.

## Archivos de texto

- `es.json` contiene los textos originales y proporciona el respaldo.
- `agr.json`, `cbt.json` y `cni.json` contienen las traducciones documentadas de awajún, shawi y asháninka.
- `propuestas.json` contiene los rótulos provisionales que muestra la aplicación mientras esperan revisión.
- `simulacion-visual.json` contiene las frases mixtas y las muestras de la compilación beta.
- `docs/i18n/catalogo-espanol.json` y `docs/i18n/borradores/` guardan el contexto, las fuentes y el estado de revisión de cada clave.

## Cobertura lingüística

La cobertura cuenta las claves del catálogo español que tienen una equivalencia comprobable en la fuente citada. Las fuentes respaldan el vocabulario. Sigue pendiente la revisión de su uso en la aplicación por hablantes de las comunidades, especialmente en los flujos de emergencia.

| Idioma | Con texto respaldado | Pendientes |
| --- | ---: | ---: |
| Español (`es`) | 733/733 (100 %) | 0 |
| Awajún (`agr`) | 24/733 (3,27 %) | 709 |
| Shawi (`cbt`) | 9/733 (1,23 %) | 724 |
| Asháninka (`cni`) | 21/733 (2,86 %) | 712 |

El cambio ya se aprecia en Inicio. El awajún muestra el saludo, el botón de emergencia, Ayuda, Comunidad y Mapa. El shawi cambia Comunidad en la barra inferior y traduce varios rótulos al entrar en esa sección. El asháninka muestra el saludo, el botón de emergencia, Ayuda y Comunidad.

| Idioma y clave | Texto | Fuente y entrada |
| --- | --- | --- |
| `agr` · `biodiversity.title` | Adaikamu | [Vocabulario pedagógico awajún, Minedu](https://repositorio.minedu.gob.pe/handle/20.500.12799/8172), p. 22, «título» |
| `agr` · `registration.firstName` | Daa | [Vocabulario pedagógico awajún, Minedu](https://repositorio.minedu.gob.pe/handle/20.500.12799/8172), p. 29, ejemplo de nombre de persona |
| `agr` · `common.photo` | Dakúmamkam | [Diccionario awajún–castellano, CAAAP](https://caaap.org.pe/Libros/2021/Diccionario-Awajun-Castellano-2020.pdf), entrada `dakúmamkam` |
| `agr` · `location.community` | Yaákat | [Diccionario awajún–castellano, CAAAP](https://caaap.org.pe/Libros/2021/Diccionario-Awajun-Castellano-2020.pdf), entrada `yaákat` en el sentido de lugar |
| `agr` · `navigation.map` | Núgka dakumkámu | [Diccionario awajún–castellano, CAAAP](https://caaap.org.pe/Libros/2021/Diccionario-Awajun-Castellano-2020.pdf), p. 85, «mapa» |
| `agr` · `settings.language` | Chícham | [Diccionario awajún–castellano, CAAAP](https://caaap.org.pe/Libros/2021/Diccionario-Awajun-Castellano-2020.pdf), entrada `chícham` en el sentido de idioma |
| `agr` · `home.greeting`, `home.emergencia`, `newAlert.emergencia` | Amekáitam; Wájimas utújchat | «Hola» y «emergencia». [Diccionario awajún–castellano, CAAAP](https://caaap.org.pe/Libros/2021/Diccionario-Awajun-Castellano-2020.pdf) |
| `agr` · `common.back`, `common.view`, `community.category.vestimenta` | Wakétut; Díit; Jáanch | [Diccionario awajún–castellano, CAAAP](https://caaap.org.pe/Libros/2021/Diccionario-Awajun-Castellano-2020.pdf), entradas de «volver», «mirar» y «vestimenta» |
| `agr` · `common.community`, `helpSheet.puestoDeSalud`, `settings.puestoDeSalud` | Yaákat; Tsuwámatai | [Diccionario awajún–castellano, CAAAP](https://caaap.org.pe/Libros/2021/Diccionario-Awajun-Castellano-2020.pdf), entradas en el sentido de «comunidad» y «posta médica» |
| `agr` · `common.help`, `emergency.enfermedad` | Yaimat; Játa | [Glosario de la Central de Interpretación y Traducción, Ministerio de Cultura](https://centroderecursos.cultura.pe/sites/default/files/rb/pdf/Glosario%20VMI.pdf), «ayuda» y «enfermedad» |
| `agr` · `community.departamento`, `registration.departamento`, `emergency.parto` | Núgka akankamu · Akíkmáu | «Departamento» en sentido territorial y «parto». [Diccionario awajún–castellano, CAAAP](https://caaap.org.pe/Libros/2021/Diccionario-Awajun-Castellano-2020.pdf) |
| `agr` · `login.borrar`, `panel.enviar` | Esakáut · Akupét | «Borrar» en sentido de escrito y «enviar». [Diccionario awajún–castellano, CAAAP](https://caaap.org.pe/Libros/2021/Diccionario-Awajun-Castellano-2020.pdf) |
| `agr` · `registration.escribeTuNombre` | Daajum agagta | «Escriba su nombre», anexo de frases usuales. [Guía para la implementación de señalética, Ministerio de Cultura](https://centroderecursos.cultura.pe/sites/default/files/rb/pdf/Gu%C3%ADa%20de%20se%C3%B1al%C3%A9tica_F_compressed.pdf) |
| `agr` · `time.yesterday` | yaú | Entrada `yaú`, «ayer». [Diccionario awajún–castellano, CAAAP](https://caaap.org.pe/Libros/2021/Diccionario-Awajun-Castellano-2020.pdf) |
| `cbt` · `emergency.enfermedad` | Kañu | [Diccionario en lengua originaria shawi, Minedu](https://repositorio.minedu.gob.pe/handle/20.500.12799/11178), p. 50, ejemplo de la entrada `Mahterin` |
| `cbt` · `common.community`, `location.community` | Ninanu' | [Diccionario en lengua originaria shawi, Minedu](https://repositorio.minedu.gob.pe/handle/20.500.12799/11178), entrada `Ninanu'` y ejemplos de `ninanuke` como lugar habitado |
| `cbt` · `common.view`, `community.category.alimentos` | Kenanakasu'; Kusharu' | [Diccionario en lengua originaria shawi, Minedu](https://repositorio.minedu.gob.pe/handle/20.500.12799/11178), entradas `Kenanin` y `Kusharu'` |
| `cbt` · `common.retry`, `registration.apellido` | Nakeranchin · Turise | «Otra vez» en el botón para repetir una acción y «apellido». [Diccionario en lengua originaria shawi, Minedu](https://repositorio.minedu.gob.pe/handle/20.500.12799/11178) |
| `cbt` · `time.yesterday`, `time.tomorrow` | i'wara · tahshiraya | «Ayer» en el ejemplo de `A'chinterin` y «mañana» en la entrada `Tahshiraya`. [Diccionario en lengua originaria shawi, Minedu](https://repositorio.minedu.gob.pe/handle/20.500.12799/11178) |
| `cni` · `biodiversity.title` | Osankenaitoki | [Vocabulario pedagógico asháninka, Minedu](https://repositorio.minedu.gob.pe/handle/20.500.12799/7194), p. 31, «título» |
| `cni` · `emergency.enfermedad` | Mantsiyarentsi | [Vocabulario pedagógico asháninka, Minedu](https://repositorio.minedu.gob.pe/handle/20.500.12799/7194), p. 69, ejemplo de la entrada `noñabentakoperotero` |
| `cni` · `home.greeting`, `registration.welcome` | Kametsa pimpoke | [Guía del estudiante 4, Minedu](https://repositorio.minedu.gob.pe/bitstream/handle/20.500.12799/5270/Campo%20de%20conocimiento%2C%20Humanidades.%20Gu%C3%ADa%20para%20el%20estudiante%204%2C%20Ciclo%20Avanzado.pdf?isAllowed=y&sequence=1), p. 81, saludo de bienvenida |
| `cni` · `common.community`, `location.community`, `common.photo`, `common.view`, `community.category.vestimenta` | Nampitsi; Shiyakaantsi; Amenaantsi; Maatsaantsi | [Diccionario asháninka–castellano, Cushimariano y Sebastián](https://lengamer.org/publicaciones/diccionarios/Dic_Prelim_Ashaninka.pdf), entradas `shitobaantsi` (ejemplo con «comunidad»), `shiyakaantsi`, `amenaantsi` y «ropa» |
| `cni` · `common.help`, `registration.celular` | Amitakotantsi; Kaimamentotsi | [Glosario de la Central de Interpretación y Traducción, Ministerio de Cultura](https://centroderecursos.cultura.pe/sites/default/files/rb/pdf/Glosario%20VMI.pdf), «ayuda» y «celu» |
| `cni` · `common.no`, `common.yes` | Te; Je | [Palabras clave para la atención en salud, Minsa](https://cdn.www.gob.pe/uploads/document/file/315142/Palabras_clave_para_la_atenci%C3%B3n_en_salud__Ashaninka20190521-6322-1g0qnnb.pdf), p. 33, «No» y «Sí» |
| `cni` · `registration.firstName` | Bajirontsi | [Tesoro de nombres asháninkas, Reniec](https://www.reniec.gob.pe/portal/publi_catalogoCAER_archivos/c-117-tesoro-ashaninka-03Dic.pdf), p. 21, «nombre» |
| `cni` · `settings.language` | Ñanentsi | [Vocabulario pedagógico asháninka, Minedu](https://repositorio.minedu.gob.pe/handle/20.500.12799/7194), p. 146, propuesta «lengua, idioma», también usada en [El narrar en asháninka](https://amazoniaperuana.caaap.org.pe/index.php/amazoniaperuana/en/article/download/269/268), p. 145 |
| `cni` · `home.emergencia`, `newAlert.emergencia`, `topBar.emergencias` | Shintsipaite yabintete | «Emergencia» en señalética de salud, tabla 8. [Guía para la implementación de señalética, Ministerio de Cultura](https://centroderecursos.cultura.pe/sites/default/files/rb/pdf/Gu%C3%ADa%20de%20se%C3%B1al%C3%A9tica_F_compressed.pdf) |
| `cni` · `registration.escribeTuNombre` | Pisankenatero pibajiro | «Escriba su nombre», anexo de frases usuales. [Guía para la implementación de señalética, Ministerio de Cultura](https://centroderecursos.cultura.pe/sites/default/files/rb/pdf/Gu%C3%ADa%20de%20se%C3%B1al%C3%A9tica_F_compressed.pdf) |
| `cni` · `time.yesterday`, `time.tomorrow` | chapinki · osaitekera | «Ayer» en el ejemplo de `ari` y «mañana» en el ejemplo de `noinijantero`. [Diccionario asháninka–castellano](https://lengamer.org/publicaciones/diccionarios/Dic_Prelim_Ashaninka.pdf), [Vocabulario pedagógico asháninka, Minedu](https://repositorio.minedu.gob.pe/handle/20.500.12799/7194) |

Las fichas de la BDPI del Ministerio de Cultura documentan las zonas y variedades de [awajún](https://bdpi.cultura.gob.pe/lenguas/awajun), [shawi](https://bdpi.cultura.gob.pe/index.php/lenguas/shawi) y [asháninka](https://bdpi.cultura.gob.pe/lenguas/ashaninka). Para cerrar las claves pendientes, hace falta consultar a hablantes de la variedad de las comunidades del piloto. En shawi, conviene contrastar los usos de Cahuapanas y Balsapuerto recogidos en el diccionario. En asháninka, consultar también el [manual de escritura](https://repositorio.minedu.gob.pe/handle/20.500.12799/10942) para las variantes regionales. Las etiquetas de geografía, salud y emergencias necesitan revisión en la pantalla donde se usan.

El registro de claves pendientes se genera por idioma con `node scripts/i18n-status.mjs --pendientes` e incluye el texto en español de cada clave. Las fuentes consultadas aportan vocabulario y frases de formularios, pero siguen pendientes los mensajes propios de la aplicación sobre ubicación GPS, almacenamiento local y sincronización. El Ministerio de Cultura mantiene un registro público de intérpretes y traductores para los textos que requieren una traducción nueva. [Registro Nacional de Intérpretes y Traductores de Lenguas Indígenas u Originarias](https://traductoresdelenguas.cultura.pe/)

El aviso de traducción parcial se calcula a partir de las claves que faltan. `node scripts/i18n-status.mjs --completo` devuelve un código de salida distinto de cero mientras quede algún catálogo incompleto.

Añadir una clave al catálogo de una lengua después de comprobar la equivalencia y documentar su fuente aquí. El catálogo español contiene el texto que se muestra mientras tanto.

## Preparación asistida por IA

[Catálogo español](i18n/catalogo-espanol.json), [awajún](i18n/borradores/agr.json), [shawi](i18n/borradores/cbt.json), [asháninka](i18n/borradores/cni.json).

Cada archivo contiene las 733 claves originales, distribuidas en nueve lotes de 77 a 82. El catálogo español incluye el contexto, las referencias en el código y las variables que se deben conservar. Los tres archivos de preparación incluyen también el original, la propuesta, su estado, la confianza, las fuentes, las observaciones y la necesidad de revisión humana.

| Idioma | Respaldo documental | Borrador de IA | Sin propuesta confiable | Con propuesta o respaldo |
| --- | ---: | ---: | ---: | ---: |
| Awajún | 24 | 38 | 671 | 62/733 (8,46 %) |
| Shawi | 9 | 19 | 705 | 28/733 (3,82 %) |
| Asháninka | 21 | 18 | 694 | 39/733 (5,32 %) |

Una propuesta asistida aplica un lema o adapta una expresión al uso en pantalla. La confianza «media» indica cercanía al sentido documentado. La confianza «baja» indica que hace falta comprobar el sentido, la morfología o el registro en contexto. Las claves sin evidencia suficiente llevan `propuesta: null`.

Para revisar el texto sin conexión, abre [vista-local.html](i18n/vista-local.html) en el navegador y carga uno de los tres JSON de preparación. La página permite filtrar por lote y estado y probar el ajuste del texto a 320, 390 o 640 px en tarjetas de comparación.

Al continuar el trabajo, conservar cada clave y el campo `original`. Añadir la propuesta, sus enlaces de referencia, una observación y confianza `baja` o `media`. Ejecutar `node scripts/i18n-preparacion.mjs --actualizar` para sincronizar contexto y metadatos. La misma orden sin opciones comprueba cobertura, duplicados, variables, saltos de línea e identificadores protegidos. Las referencias a líneas se actualizan desde el código. Para las claves construidas en ejecución, una referencia puede señalar la función que comparte la familia de claves.

Entre las decisiones pendientes de los revisores están la variante local de cada lengua, el registro de las instrucciones, los términos para acciones digitales y los préstamos para dispositivos. Las claves marcadas con `requiereRevisionCritica` se deben revisar en la pantalla o el flujo antes de publicarlas.

## Propuestas en la aplicación

El selector habitual carga 36 propuestas lingüísticas para rótulos de Inicio, Comunidad, historial, audio, navegación y bienvenida. Están en [web/src/locales/propuestas.json](../web/src/locales/propuestas.json) y siguen pendientes de revisión humana.

El rótulo awajún «Mina étsejmau aidau» adapta «Mis alertas» como «Mis avisos». Usa el lema para «aviso» y el posesivo y plural atestiguados en materiales pedagógicos. [Diccionario awajún–castellano, CAAAP](https://caaap.org.pe/Libros/2021/Diccionario-Awajun-Castellano-2020.pdf) · [Vocabulario pedagógico awajún, Minedu](https://repositorio.perueduca.pe/recursos/2022/DEIB22-0548.pdf)

| Idioma | Equivalencias documentadas | Propuestas visibles | Textos visibles en el idioma |
| --- | ---: | ---: | ---: |
| Awajún | 24 | 13 | 37/733 |
| Shawi | 9 | 11 | 20/733 |
| Asháninka | 21 | 12 | 33/733 |

El catálogo documentado tiene prioridad cuando incorpora una clave. Las instrucciones de alerta, los mensajes de sincronización y las validaciones de autenticación conservan el texto documentado o el español completo.

## Compilación beta visual

`npm run build:beta` compila la misma aplicación y el panel en `web/dist` con frases mixtas y muestras del ZIP. El selector de idioma explica el carácter de los textos de prueba. La compilación normal `npm run build` usa traducciones documentadas, propuestas lingüísticas y el respaldo en español.

| Idioma | Textos de prueba adicionales | Total con texto localizado o de prueba |
| --- | ---: | ---: |
| Awajún | 172 | 209/733 |
| Shawi | 137 | 157/733 |
| Asháninka | 138 | 171/733 |

Cada clave se muestra una sola vez. Cuando falta una traducción disponible, [simulacion-visual.json](../web/src/locales/simulacion-visual.json) permite usar una frase mixta con términos documentados o un rótulo de prueba del ZIP. Las instrucciones de envío y los permisos de ubicación usan una sola versión comprensible con respaldo en español. Las plantillas de fechas, los identificadores, las notas sobre el idioma y los datos de las publicaciones conservan su presentación original.

En la beta, las guías de Inicio, Ajustes y opciones de alerta añaden términos del idioma elegido al guion en castellano. La voz es la síntesis en castellano del dispositivo. Las grabaciones revisadas de las tres lenguas originarias siguen pendientes. Para verificar la compilación beta en Chromium, ejecutar `npm run test:e2e -- --beta-visual` después de compilarla.

## Alcance y verificación

- Integración en Inicio, Ajustes, Comunidad, publicaciones de demostración, Mapa, biodiversidad, historial, creación y detalle de alertas, ingreso y registro, y panel de salud. También incluye navegación, ventanas, avisos y etiquetas de accesibilidad de estos recorridos.
- Código creado en `web/src/i18n/`, cuatro catálogos en `web/src/locales/` y el control de zoom en `web/src/components/MapZoom.tsx`. Pruebas de catálogos en `web/test/i18n.test.ts` y reporte de cobertura en `scripts/i18n-status.mjs`.
- Código modificado en las entradas de la PWA y el panel, `App.tsx`, `AppContext.tsx`, `lib/settings.ts`, `PanelApp.tsx`, las pantallas y componentes que muestran texto, `styles/app.css` y `scripts/e2e.mjs`. Se usaron las dependencias del archivo de bloqueo.
- Los catálogos incluyen los formatos de fecha y hora, los tiempos relativos, los títulos de las pestañas y los mensajes de validación del ingreso y el registro. Los formatos en español conservan la presentación peruana. El audio de demostración permanece en castellano. Los avisos del navegador, la instalación de la PWA y el HTML que se muestra antes de arrancar React dependen del navegador o del documento estático. Los errores técnicos externos se presentan como llegan cuando se muestran como diagnóstico.
- `npm run check` valida tipos, catálogos, interpolaciones, formato de fechas, almacenamiento, pruebas del servidor y compilación. `npm run test:e2e` cubre los recorridos existentes, la selección de idioma antes de iniciar sesión, la conservación de los formularios y de la sesión del panel, y el cambio de idioma sin red y su persistencia a 320 px en Chromium.
- Quedan pendientes las pruebas en un Android físico y la revisión de las grabaciones y traducciones por hablantes.
