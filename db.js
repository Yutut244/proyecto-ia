// db.js - Base de datos SQLite integrada con node:sqlite para SeguIA
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, 'seguia.db');

function getDatabase() {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

function initDatabase() {
  const db = getDatabase();

  // Crear tablas
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      teacher_name TEXT NOT NULL,
      grade_scale_min REAL DEFAULT 0,
      grade_scale_max REAL DEFAULT 100,
      passing_grade REAL DEFAULT 60,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS competencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      student_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      competency_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      activity_type TEXT DEFAULT 'Taller',
      max_score REAL DEFAULT 100,
      weight REAL DEFAULT 1.0,
      activity_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (competency_id) REFERENCES competencies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      activity_id INTEGER NOT NULL,
      score REAL NOT NULL,
      observation TEXT,
      evidence_type TEXT DEFAULT 'Documento',
      evidence_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, activity_id),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interventions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      situation_detected TEXT NOT NULL,
      ai_recommendation_summary TEXT,
      teacher_decision TEXT NOT NULL,
      intervention_type TEXT NOT NULL,
      score_before REAL,
      score_after REAL,
      status TEXT DEFAULT 'En curso',
      date_recorded TEXT NOT NULL,
      date_evaluated TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      model_used TEXT NOT NULL,
      summary TEXT NOT NULL,
      pedagogical_interpretation TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      explicability TEXT NOT NULL,
      raw_metrics TEXT NOT NULL,
      scenario_type TEXT DEFAULT 'B_FULL_CONTEXT',
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rubric_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feedback_id INTEGER,
      student_id INTEGER NOT NULL,
      relevance_score INTEGER NOT NULL,
      clarity_score INTEGER NOT NULL,
      coherence_score INTEGER NOT NULL,
      pedagogical_utility_score INTEGER NOT NULL,
      data_backing_score INTEGER NOT NULL,
      appropriate_language_score INTEGER NOT NULL,
      overall_score REAL NOT NULL,
      teacher_comments TEXT,
      evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (feedback_id) REFERENCES ai_feedbacks(id) ON DELETE SET NULL
    );
  `);

  // Configuración por defecto si no existe
  const checkSettings = db.prepare('SELECT COUNT(*) as count FROM settings').get();
  if (checkSettings.count === 0) {
    const defaultSettings = {
      consecutive_drops_threshold: 3,
      drop_delta_threshold: 10,
      priority_alert_slope: -1.5,
      anonymize_ai: true,
      gemini_api_key: '',
      ai_provider: 'auto', // 'gemini' | 'heuristic' | 'auto'
      gemini_model: 'gemini-2.5-flash'
    };
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(defaultSettings)) {
      insertSetting.run(k, JSON.stringify(v));
    }
  }

  // Comprobar si hay cursos; si no, sembrar datos pedagógicos de demostración
  const checkCourses = db.prepare('SELECT COUNT(*) as count FROM courses').get();
  if (checkCourses.count === 0) {
    seedDatabase(db);
  }

  return db;
}

function seedDatabase(db) {
  console.log('Sembrando datos iniciales pedagógicos basados en el Briefing SeguIA...');

  // Curso 1: Matemáticas 9° Grado (Caso del Briefing con Juan Camilo y otros estudiantes)
  const insertCourse = db.prepare(`
    INSERT INTO courses (code, name, description, teacher_name, grade_scale_min, grade_scale_max, passing_grade)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const course1 = insertCourse.run(
    'MAT-901',
    'Matemáticas 9° - Álgebra y Pensamiento Cuantitativo',
    'Curso centrado en resolución de problemas algebraicos, ecuaciones y modelado geométrico.',
    'Prof. Cristóbal Martínez & Jainer Salas',
    0,
    100,
    60
  );
  const courseId = course1.lastInsertRowid;

  // Competencias para el curso
  const insertComp = db.prepare(`
    INSERT INTO competencies (course_id, code, name, description)
    VALUES (?, ?, ?, ?)
  `);
  const comp1 = insertComp.run(courseId, 'COMP-RES', 'Resolución de problemas en contextos cotidianos', 'Capacidad para formular y resolver situaciones problema utilizando operaciones y ecuaciones.');
  const comp2 = insertComp.run(courseId, 'COMP-MOD', 'Modelado y razonamiento algebraico', 'Traducción de enunciados a expresiones algebraicas y resolución de sistemas.');
  const comp3 = insertComp.run(courseId, 'COMP-COM', 'Comunicación y argumentación matemática', 'Explicación rigurosa de los procedimientos seguidos y justificación de resultados.');

  const compResId = comp1.lastInsertRowid;
  const compModId = comp2.lastInsertRowid;
  const compComId = comp3.lastInsertRowid;

  // Actividades del curso
  const insertAct = db.prepare(`
    INSERT INTO activities (course_id, competency_id, title, description, activity_type, max_score, weight, activity_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const act1 = insertAct.run(courseId, compResId, 'Taller 1: Fracciones y proporciones aplicadas', 'Problemas de aplicación práctica de fracciones en mezclas y compras.', 'Taller', 100, 1.0, '2026-08-10');
  const act2 = insertAct.run(courseId, compModId, 'Quiz 1: Lenguaje algebraico', 'Identificación de incógnitas y formulación básica.', 'Quiz', 100, 1.0, '2026-08-18');
  const act3 = insertAct.run(courseId, compResId, 'Taller 2: Ecuaciones lineales en problemas de velocidad', 'Resolución de problemas de móviles y tiempo.', 'Taller', 100, 1.0, '2026-08-27');
  const act4 = insertAct.run(courseId, compResId, 'Evaluación parcial: Problemas complejos de ecuaciones', 'Examen acumulativo de resolución de problemas.', 'Examen', 100, 1.5, '2026-09-08');
  const act5 = insertAct.run(courseId, compComId, 'Ensayo y sustentación: Justificación de métodos numéricos', 'Exposición oral y rúbrica de argumentación.', 'Proyecto', 100, 1.0, '2026-09-17');
  const act6 = insertAct.run(courseId, compResId, 'Taller Post-Intervención: Refuerzo práctico de problemas', 'Taller aplicado tras la estrategia de refuerzo docente.', 'Taller', 100, 1.0, '2026-09-28');

  // Estudiantes
  const insertStudent = db.prepare(`
    INSERT INTO students (course_id, student_code, full_name, email, notes)
    VALUES (?, ?, ?, ?, ?)
  `);
  // EST-001: Juan Camilo (Caso central del briefing: baja en resolución de problemas, 55 antes, taller refuerzo, 68 después)
  const s1 = insertStudent.run(courseId, 'EST-001', 'Juan Camilo Pérez', 'juan.perez@colegio.edu', 'Estudiante participativo; presenta bloqueos puntuales al traducir enunciados a ecuaciones.');
  // EST-002: María Gómez (Estable, excelente desempeño)
  const s2 = insertStudent.run(courseId, 'EST-002', 'María Fernanda Gómez', 'maria.gomez@colegio.edu', 'Desempeño constante y autónomo.');
  // EST-003: Carlos Morales (Alerta amarilla: baja puntual en modelado)
  const s3 = insertStudent.run(courseId, 'EST-003', 'Carlos Andrés Morales', 'carlos.morales@colegio.edu', 'Ritmo de aprendizaje adecuado, requiere apoyo en abstracción algebraica.');
  // EST-004: Valentina Rivas (Alerta roja: tendencia descendente prolongada y notas críticas)
  const s4 = insertStudent.run(courseId, 'EST-004', 'Valentina Rivas', 'valentina.rivas@colegio.edu', 'Frecuentes inasistencias los días de evaluación.');
  // EST-005: Sebastián Castro (Estudiante nuevo: falta de datos para probar honestidad del sistema)
  const s5 = insertStudent.run(courseId, 'EST-005', 'Sebastián Castro', 'sebastian.castro@colegio.edu', 'Ingresó recientemente por traslado institucional.');

  const s1Id = s1.lastInsertRowid;
  const s2Id = s2.lastInsertRowid;
  const s3Id = s3.lastInsertRowid;
  const s4Id = s4.lastInsertRowid;
  const s5Id = s5.lastInsertRowid;

  // Calificaciones y evidencias descriptivas
  const insertGrade = db.prepare(`
    INSERT INTO grades (student_id, activity_id, score, observation, evidence_type, evidence_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Juan Camilo (EST-001) - Historial que muestra disminución en resolución de problemas hasta 55, y post-intervención 68
  insertGrade.run(s1Id, act1.lastInsertRowid, 78, 'Resolvió adecuadamente los ejercicios directos; dificultad en los dos últimos que requerían interpretar texto largo.', 'Guía resuelta', '#evidencia-taller1-est001');
  insertGrade.run(s1Id, act2.lastInsertRowid, 82, 'Demuestra buen manejo conceptual del vocabulario algebraico elemental.', 'Hoja de respuestas', '#evidencia-quiz1-est001');
  insertGrade.run(s1Id, act3.lastInsertRowid, 65, 'Omitió el planteamiento gráfico inicial; errores recurrentes en el despeje de unidades.', 'Taller en parejas', '#evidencia-taller2-est001');
  insertGrade.run(s1Id, act4.lastInsertRowid, 55, 'Dificultad evidente al estructurar pasos de resolución de problemas con enunciados compuestos. Quedó bloqueado en el ejercicio 3.', 'Examen escrito', '#evidencia-eval1-est001');
  insertGrade.run(s1Id, act5.lastInsertRowid, 75, 'Buena capacidad comunicativa oral; explica con claridad sus razonamientos aunque cometa deslices numéricos.', 'Rúbrica exposición', '#evidencia-expo1-est001');
  insertGrade.run(s1Id, act6.lastInsertRowid, 68, 'Mejora notable en la identificación de datos e incógnitas tras el taller de refuerzo. Superó el umbral crítico.', 'Taller de refuerzo', '#evidencia-tallerpost-est001');

  // María Fernanda Gómez (EST-002) - Desempeño regular y alto
  insertGrade.run(s2Id, act1.lastInsertRowid, 92, 'Procedimientos impecables y ordenados.', 'Guía resuelta', null);
  insertGrade.run(s2Id, act2.lastInsertRowid, 95, 'Comprensión cabal de todos los conceptos.', 'Hoja de respuestas', null);
  insertGrade.run(s2Id, act3.lastInsertRowid, 89, 'Resuelve con solvencia y propone métodos alternativos.', 'Taller', null);
  insertGrade.run(s2Id, act4.lastInsertRowid, 94, 'Excelente rigor matemático.', 'Examen escrito', null);
  insertGrade.run(s2Id, act5.lastInsertRowid, 90, 'Exposición clara y argumentada.', 'Rúbrica', null);

  // Carlos Andrés Morales (EST-003) - Alerta amarilla
  insertGrade.run(s3Id, act1.lastInsertRowid, 75, 'Cumple con los requisitos del taller.', 'Guía', null);
  insertGrade.run(s3Id, act2.lastInsertRowid, 58, 'Dificultad en la simbolización algebraica de problemas verbales.', 'Quiz', null);
  insertGrade.run(s3Id, act3.lastInsertRowid, 68, 'Dificultades en despeje.', 'Taller', null);
  insertGrade.run(s3Id, act4.lastInsertRowid, 62, 'Rendimiento bajo en preguntas de modelado.', 'Examen', null);

  // Valentina Rivas (EST-004) - Alerta roja: tendencia descendente
  insertGrade.run(s4Id, act1.lastInsertRowid, 72, 'Entrega parcial pero correcta.', 'Guía', null);
  insertGrade.run(s4Id, act2.lastInsertRowid, 60, 'Errores conceptuales recurrentes.', 'Quiz', null);
  insertGrade.run(s4Id, act3.lastInsertRowid, 50, 'No completó 4 de los 6 ejercicios solicitados.', 'Taller', null);
  insertGrade.run(s4Id, act4.lastInsertRowid, 42, 'Disminución marcada en retención y aplicación de fórmulas.', 'Examen', null);

  // Sebastián Castro (EST-005) - Solo 1 nota para probar honestidad sobre falta de datos
  insertGrade.run(s5Id, act1.lastInsertRowid, 70, 'Primera actividad evaluada tras incorporarse al grupo.', 'Taller', null);

  // Registrar la intervención pedagógica del caso ejemplo del Briefing para Juan Camilo
  const insertIntervention = db.prepare(`
    INSERT INTO interventions (
      student_id, course_id, situation_detected, ai_recommendation_summary,
      teacher_decision, intervention_type, score_before, score_after, status,
      date_recorded, date_evaluated, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertIntervention.run(
    s1Id,
    courseId,
    'Disminución progresiva en actividades de resolución de problemas (82 -> 65 -> 55 en examen).',
    'Considerar una actividad de refuerzo enfocada en descomposición de problemas paso a paso y modelado gráfico.',
    'Realizar taller adicional de refuerzo personalizado y trabajo en parejas guiado.',
    'Taller de refuerzo / Acompañamiento guiado',
    55.0,
    68.0,
    'Superada con éxito',
    '2026-09-10',
    '2026-09-28',
    'El estudiante incrementó +13 puntos en la siguiente evidencia (Actividad 6: 68/100). Se evidencia efectividad del acompañamiento.'
  );

  // Registrar una retroalimentación IA previa y su evaluación con rúbrica
  const insertAi = db.prepare(`
    INSERT INTO ai_feedbacks (
      student_id, model_used, summary, pedagogical_interpretation,
      recommendation, explicability, raw_metrics, scenario_type
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const feedbackRes = insertAi.run(
    s1Id,
    'SeguIA Heuristic Engine v1.0',
    'El estudiante EST-001 presenta un promedio acumulado de 70.5/100, con una trayectoria inicial favorable seguida de tres caídas consecutivas en la competencia de Resolución de problemas.',
    'Se observa que el estudiante comprende los conceptos formales (82 en Quiz 1 y 75 en Comunicación), pero experimenta dificultades específicas cuando los enunciados integran múltiples etapas analíticas. No se detectan dificultades generales de aprendizaje, sino un bloqueo puntual en la fase de traducción y planificación del problema.',
    'Se sugiere al docente considerar una sesión de refuerzo centrada en estrategias heurísticas (ej. diagramas de barras, formulación de subproblemas) antes de evaluaciones sumativas adicionales.',
    'Indicadores objetivos que sustentan esta sugerencia: 1) Tres actividades consecutivas con disminución (-17 pts entre Quiz 1 y Taller 2, -10 pts en Evaluación parcial). 2) La competencia "Resolución de problemas" promedia 66.0, situándose 8.5 puntos por debajo de sus otras dimensiones. 3) Observaciones docentes cualitativas que corroboran "bloqueo en enunciado compuesto".',
    JSON.stringify({ average: 70.5, trendSlope: -3.2, consecutiveDrops: 3, criticalComp: 'Resolución de problemas' }),
    'B_FULL_CONTEXT'
  );

  const insertRubric = db.prepare(`
    INSERT INTO rubric_evaluations (
      feedback_id, student_id, relevance_score, clarity_score, coherence_score,
      pedagogical_utility_score, data_backing_score, appropriate_language_score,
      overall_score, teacher_comments
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertRubric.run(
    feedbackRes.lastInsertRowid,
    s1Id,
    5, // Pertinencia
    5, // Claridad
    5, // Coherencia
    4, // Utilidad pedagógica
    5, // Sustento en datos
    5, // Lenguaje apropiado
    4.83,
    'La retroalimentación fue altamente precisa. Nos permitió identificar que el problema no era desinterés sino dificultad de traducción del enunciado, facilitando la intervención mediante el taller de refuerzo.'
  );

  // Curso 2 de ejemplo adicional: Lengua Castellana 10°
  const course2 = insertCourse.run(
    'LEN-101',
    'Lengua Castellana y Argumentación 10°',
    'Desarrollo de competencias de lectura crítica, producción de ensayos y argumentación retórica.',
    'Prof. María Elena Restrepo',
    0,
    100,
    60
  );
  const course2Id = course2.lastInsertRowid;
  const compL1 = insertComp.run(course2Id, 'COMP-LEC', 'Lectura crítica y comprensión inferencial', 'Interpretación y análisis de sesgos en textos ensayísticos.');
  const compL2 = insertComp.run(course2Id, 'COMP-ESC', 'Producción textual y coherencia argumentativa', 'Estructuración de tesis, argumentos y contraargumentos.');

  console.log('Base de datos inicializada y sembrada con éxito.');
}

module.exports = {
  getDatabase,
  initDatabase
};
