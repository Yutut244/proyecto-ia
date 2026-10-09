# SeguIA — Sistema Inteligente de Seguimiento Académico y Retroalimentación Docente Basado en Evidencias

> **"La IA propone, los datos sustentan y el docente decide."**  
> *Autores:* **Cristóbal Martínez & Jainer Salas**  
> *Basado en el documento:* `SeguIA_Briefing_Pedagogico (2).docx`

---

## 📖 1. Visión y Fundamentación Pedagógica

**SeguIA no es una plataforma tradicional de notas ni un generador automático de textos genéricos.** Es una herramienta de **acompañamiento pedagógico continuo** diseñada para:
1. Organizar evidencias observables y resultados por competencias.
2. Calcular indicadores estadísticos objetivos mediante un **motor determinístico convencional**.
3. Utilizar **Inteligencia Artificial** (Google Gemini y motor heurístico local) para traducir esos indicadores en interpretaciones formativas con **lenguaje prudente**.
4. Empoderar el criterio profesional del educador para tomar **decisiones pedagógicas** y medir su impacto real en el aula (*antes vs. después*).

---

## 🔄 2. El Eje Pedagógico: Un Ciclo Continuo, No una Alerta Aislada

A diferencia de los sistemas tradicionales que solo almacenan notas o emiten alertas pasivas, SeguIA implementa el ciclo completo de acompañamiento:

```
[ EVIDENCIA ] ➔ [ DATOS ] ➔ [ INDICADORES ] ➔ [ ANÁLISIS ] ➔ [ RETROALIMENTACIÓN IA ] 
                                                                     ↓
[ SEGUIMIENTO ] ➔ [ NUEVA EVIDENCIA ] ➔ [ INTERVENCIÓN ] ➔ [ DECISIÓN DOCENTE ]
```

### Caso Ejemplo del Briefing Implementado en SeguIA:
* **Estudiante:** Juan Camilo Pérez (`EST-001`)
* **Situación detectada:** Disminución en 3 actividades consecutivas en la competencia de *Resolución de problemas* (82 ➔ 65 ➔ 55 en examen acumulativo).
* **Recomendación del sistema:** Considerar una actividad de refuerzo enfocada en descomposición de problemas paso a paso y modelado gráfico.
* **Decisión del profesor:** Taller adicional de refuerzo personalizado y trabajo en parejas guiado.
* **Resultado antes de la intervención:** **55 / 100**
* **Resultado después de la intervención:** **68 / 100**
* **Impacto pedagógico medido:** **+13 puntos** (Alerta superada exitosamente).

---

## 🏛️ 3. Los 5 Componentes del MVP Desarrollados

### 1. Gestión Académica
* Administración de docentes, cursos escolares, estudiantes anonimizados (`EST-001`), actividades de evaluación y competencias pedagógicas formativas (ej. *Resolución de problemas*, *Modelado algebraico*, *Comunicación matemática*).

### 2. Evidencias y Registro Cualitativo
* Registro de calificaciones y **observaciones cualitativas descriptivas obligatorias**. El sistema exige descripciones observables de desempeño en aula (ej. *"dificultad al resolver tres ejercicios de fracciones"*), rechazando juicios de valor subjetivos (ej. *"es malo en matemáticas"*).

### 3. Motor de Análisis Determinístico ("La IA no hace los cálculos")
* **Independencia de cálculo:** Promedios, pendientes de tendencia mediante regresión lineal ($m = \frac{\sum (x - \bar{x})(y - \bar{y})}{\sum (x - \bar{x})^2}$), conteo de caídas consecutivas y brechas de competencia son calculados por código determinístico en [analyticsEngine.js](file:///c:/Users/admin/Downloads/proyecto%20ia/analyticsEngine.js).
* **Alertas Responsables en 3 Niveles:**
  * 🟢 **Seguimiento regular:** Desempeño estable o ascendente, sin caídas recurrentes.
  * 🟡 **Revisión recomendada:** Disminución en 3 actividades consecutivas o desempeño en una competencia bajo el promedio personal.
  * 🔴 **Atención prioritaria:** Coincidencia de factores críticos (pendiente descendente prolongada, evaluaciones bajas repetidas, brecha persistente).
  * **Umbrales configurables:** El docente puede calibrar la sensibilidad según su materia o nivel institucional.
* **Honestidad ante falta de datos:** Si un estudiante tiene menos de 3 actividades registradas (ej. estudiante nuevo `EST-005`), el sistema lo indica explícitamente: *"No existen suficientes actividades registradas para identificar una tendencia confiable"*, protegiendo al alumno de conclusiones precipitadas.

### 4. Inteligencia Artificial Contextualizada & Ética
* **Explicabilidad Obligatoria:** Cada sugerencia de la IA cuenta con un bloque auditado titulado *"¿Por qué aparece esta recomendación?"*, citando los datos numéricos exactos que la sustentan.
* **Lenguaje Prudente, Nunca Diagnóstico:** Empleo de giros pedagógicos como *"se recomienda revisar"*, *"podría requerir seguimiento"*, prohibiendo diagnósticos clínicos o sentencias fatales (*"el alumno reprobará"*).
* **Doble Motor:**
  * **Google Gemini API** (`gemini-2.5-flash`): Conexión oficial configurable mediante API Key.
  * **Motor Heurístico Local Pedagógico:** Funciona 100% offline sin dependencias externas ni consumo de tokens.
* **Privacidad de Datos:** Envíos anonimizados con tokens de protección (`EST-001`).

### 5. Seguimiento e Intervención
* Dashboard interactivo del curso con semáforo y filtros rápidos.
* Ficha individual con gráfico de evolución temporal (SVG nativo con trazado de regresión y umbral aprobatorio) y barras comparativas de competencias.
* Registro de la intervención docente y cálculo automático del diferencial de impacto (*Pre vs. Post*).
* Generador de **Informes Pedagógicos Oficiales** listos para imprimir o guardar como PDF (`Ctrl + P` o botón directo).

---

## ⚖️ 4. Laboratorio Comparativo A/B y Rúbrica de Validación (Sección 6)

El sistema incluye una pestaña de investigación para contrastar dos paradigmas:
* **Escenario A (IA Tradicional / Nota Aislada):** Solo recibe *"Nota: 55/100"*. Produce respuestas genéricas, punitivas y de poca utilidad para el docente (Puntaje en rúbrica: ~1.8 / 5.0).
* **Escenario B (SeguIA Contextualizado):** Recibe historial, competencias, tendencia matemática y observaciones de aula. Produce un análisis formativo, explicable y accionable (Puntaje en rúbrica: ~4.9 / 5.0).

### Rúbrica Pedagógica de 6 Criterios Integrada:
1. **Pertinencia:** ¿Corresponde con los resultados registrados?
2. **Claridad:** ¿Es comprensible para el docente?
3. **Coherencia:** ¿Hay relación entre evidencias, indicadores y recomendación?
4. **Utilidad pedagógica:** ¿Ayuda al profesor a decidir?
5. **Sustento en datos:** ¿Evita afirmaciones sin respaldo?
6. **Lenguaje apropiado:** ¿Evita etiquetas o diagnósticos definitivos?

---

## 📜 5. Decálogo Ético: "Lo que SeguIA NO es" (Sección 9)

1. **No sustituye la valoración profesional del docente.**
2. **No hace diagnósticos psicológicos ni clínicos.**
3. **No determina si un estudiante aprobará o reprobará.**
4. **No interpreta correlación como causa.**
5. **Depende de la calidad de los datos que registra el docente.**
6. **Requiere supervisión humana obligatoria sobre las respuestas generadas por IA.**

---

## 🚀 6. Cómo Ejecutar el Proyecto

El proyecto está diseñado con **cero dependencias externas pesadas**, utilizando el runtime nativo de Node.js v24 con SQLite incorporado (`node:sqlite`).

### Opción 1: Un solo clic en Windows
Hacer doble clic sobre el archivo ejecutable:
```cmd
start.bat
```
*(Inicia el servidor y abre automáticamente `http://localhost:3000` en tu navegador web predeterminado).*

### Opción 2: Desde la consola / terminal
```bash
node server.js
```
O utilizando `agy-node`:
```cmd
"C:\Users\admin\AppData\Roaming\Antigravity\bin\agy-node.cmd" server.js
```

### Ejecutar la Suite de Pruebas Automatizadas
Para verificar los 6 componentes de cálculo y ética pedagógica:
```bash
node test-suite.js
```

---

## 📁 7. Estructura del Código Fuente

```
proyecto ia/
│
├── SeguIA_Briefing_Pedagogico (2).docx    # Documento de requerimientos pedagógicos original
├── README.md                              # Documentación completa y manual de usuario
├── package.json                           # Manifiesto del proyecto y scripts
├── start.bat                              # Lanzador de un solo clic para Windows
├── server.js                              # Servidor HTTP nativo y API REST
├── db.js                                  # Base de datos SQLite y datos semilla del caso de estudio
├── analyticsEngine.js                     # Motor determinístico de regresión lineal y alertas
├── aiService.js                           # Servicio de IA (Google Gemini + Motor Heurístico + A/B)
├── test-suite.js                          # Suite de pruebas automatizadas (6/6 verificaciones)
└── public/
    ├── index.html                         # Panel de control pedagógico e interfaz de usuario
    ├── css/
    │   └── styles.css                     # Sistema de diseño pedagógico, responsive y optimizado para impresión
    └── js/
        ├── charts.js                      # Motor gráfico vectorial SVG nativo (regresión lineal y competencias)
        ├── api.js                         # Cliente HTTP REST para comunicación con el backend
        └── app.js                         # Lógica de interfaz, modales, ciclo de intervención y reportes
```
