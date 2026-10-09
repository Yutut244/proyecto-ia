// server.js - Servidor Full-Stack Node.js para SeguIA
const http = require('node:http');
const url = require('node:url');
const fs = require('node:fs');
const path = require('node:path');

const { initDatabase, getDatabase } = require('./db');
const { analyzeStudentPerformance, analyzeCourseOverview, summarizeCompetencies } = require('./analyticsEngine');
const { generateFeedback, generateABComparison } = require('./aiService');

// Inicializar base de datos
const db = initDatabase();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types para archivos estáticos
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Utilidad para responder JSON
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// Utilidad para parsear cuerpo de petición
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 5 * 1024 * 1024) { // 5MB max
        reject(new Error('Payload demasiado grande'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('JSON inválido en el cuerpo de la petición'));
      }
    });
    req.on('error', reject);
  });
}

// Cargar configuraciones del sistema
function loadSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => {
    try {
      settings[r.key] = JSON.parse(r.value);
    } catch {
      settings[r.key] = r.value;
    }
  });
  return settings;
}

// Servir archivos estáticos
function serveStatic(req, res, pathname) {
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Prevenir Directory Traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Acceso denegado');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback a index.html para rutas SPA
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Archivo no encontrado');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
}

// Enrutador de la API REST
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;
  const method = req.method;

  // Manejo de preflight CORS
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  try {
    // ==========================================
    // 1. ENDPOINTS DE CURSOS
    // ==========================================
    if (pathname === '/api/courses' && method === 'GET') {
      const courses = db.prepare(`
        SELECT c.*, 
          (SELECT COUNT(*) FROM students WHERE course_id = c.id) as students_count,
          (SELECT COUNT(*) FROM activities WHERE course_id = c.id) as activities_count
        FROM courses c
        ORDER BY c.id ASC
      `).all();
      return sendJSON(res, 200, { success: true, courses });
    }

    if (pathname === '/api/courses' && method === 'POST') {
      const body = await parseBody(req);
      const stmt = db.prepare(`
        INSERT INTO courses (code, name, description, teacher_name, grade_scale_min, grade_scale_max, passing_grade)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        body.code,
        body.name,
        body.description || '',
        body.teacher_name || 'Docente Responsable',
        body.grade_scale_min || 0,
        body.grade_scale_max || 100,
        body.passing_grade || 60
      );
      return sendJSON(res, 201, { success: true, courseId: result.lastInsertRowid });
    }

    const courseMatch = pathname.match(/^\/api\/courses\/(\d+)$/);
    if (courseMatch && method === 'GET') {
      const courseId = Number(courseMatch[1]);
      const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
      if (!course) return sendJSON(res, 404, { error: 'Curso no encontrado' });

      const competencies = db.prepare('SELECT * FROM competencies WHERE course_id = ?').all(courseId);
      const activities = db.prepare(`
        SELECT a.*, c.name as competency_name, c.code as competency_code
        FROM activities a
        LEFT JOIN competencies c ON a.competency_id = c.id
        WHERE a.course_id = ?
        ORDER BY a.activity_date ASC
      `).all(courseId);

      return sendJSON(res, 200, { success: true, course, competencies, activities });
    }

    // ==========================================
    // 2. COMPETENCIAS Y ACTIVIDADES
    // ==========================================
    if (pathname === '/api/competencies' && method === 'POST') {
      const body = await parseBody(req);
      const stmt = db.prepare(`
        INSERT INTO competencies (course_id, code, name, description)
        VALUES (?, ?, ?, ?)
      `);
      const result = stmt.run(body.course_id, body.code, body.name, body.description || '');
      return sendJSON(res, 201, { success: true, competencyId: result.lastInsertRowid });
    }

    if (pathname === '/api/activities' && method === 'POST') {
      const body = await parseBody(req);
      const stmt = db.prepare(`
        INSERT INTO activities (course_id, competency_id, title, description, activity_type, max_score, weight, activity_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        body.course_id,
        body.competency_id,
        body.title,
        body.description || '',
        body.activity_type || 'Taller',
        body.max_score || 100,
        body.weight || 1.0,
        body.activity_date || new Date().toISOString().slice(0, 10)
      );
      return sendJSON(res, 201, { success: true, activityId: result.lastInsertRowid });
    }

    // ==========================================
    // 3. ESTUDIANTES Y RESUMEN CON INDICADORES
    // ==========================================
    const courseStudentsMatch = pathname.match(/^\/api\/courses\/(\d+)\/students$/);
    if (courseStudentsMatch && method === 'GET') {
      const courseId = Number(courseStudentsMatch[1]);
      const settings = loadSettings();
      const students = db.prepare('SELECT * FROM students WHERE course_id = ? ORDER BY student_code ASC').all(courseId);
      const competencies = db.prepare('SELECT * FROM competencies WHERE course_id = ?').all(courseId);

      // Calcular indicadores para cada estudiante mediante analyticsEngine
      const studentsWithAnalytics = students.map(s => {
        const grades = db.prepare(`
          SELECT g.*, a.title as activity_title, a.activity_date, a.competency_id
          FROM grades g
          JOIN activities a ON g.activity_id = a.id
          WHERE g.student_id = ?
          ORDER BY a.activity_date ASC
        `).all(s.id);

        const analytics = analyzeStudentPerformance(grades, competencies, settings);

        // Contar intervenciones
        const interventionsCount = db.prepare('SELECT COUNT(*) as count FROM interventions WHERE student_id = ?').get(s.id).count;

        return {
          ...s,
          hasData: analytics.hasData,
          insufficientData: analytics.insufficientData,
          studentAverage: analytics.studentAverage || (analytics.hasData ? analytics.average : 0),
          average: analytics.studentAverage || (analytics.hasData ? analytics.average : 0),
          alertLevel: analytics.alertLevel,
          alertBadge: analytics.alertBadge,
          trend: analytics.trend,
          consecutiveDrops: analytics.consecutiveDrops,
          gradesCount: grades.length,
          interventionsCount
        };
      });

      // Calcular visión general del curso
      const overview = analyzeCourseOverview(studentsWithAnalytics);

      return sendJSON(res, 200, {
        success: true,
        students: studentsWithAnalytics,
        courseOverview: overview
      });
    }

    if (pathname === '/api/students' && method === 'POST') {
      const body = await parseBody(req);
      const stmt = db.prepare(`
        INSERT INTO students (course_id, student_code, full_name, email, notes)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = stmt.run(body.course_id, body.student_code, body.full_name, body.email || '', body.notes || '');
      return sendJSON(res, 201, { success: true, studentId: result.lastInsertRowid });
    }

    // Perfil completo del estudiante
    const studentMatch = pathname.match(/^\/api\/students\/(\d+)$/);
    if (studentMatch && method === 'GET') {
      const studentId = Number(studentMatch[1]);
      const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
      if (!student) return sendJSON(res, 404, { error: 'Estudiante no encontrado' });

      const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(student.course_id);
      const competencies = db.prepare('SELECT * FROM competencies WHERE course_id = ?').all(student.course_id);
      const settings = loadSettings();

      const grades = db.prepare(`
        SELECT g.*, a.title as activity_title, a.activity_date, a.competency_id, a.activity_type, a.max_score,
               c.name as competency_name, c.code as competency_code
        FROM grades g
        JOIN activities a ON g.activity_id = a.id
        LEFT JOIN competencies c ON a.competency_id = c.id
        WHERE g.student_id = ?
        ORDER BY a.activity_date ASC
      `).all(studentId);

      // Calcular promedio del curso para contextualizar
      const courseAvgRow = db.prepare(`
        SELECT AVG(g.score) as avgScore
        FROM grades g
        JOIN activities a ON g.activity_id = a.id
        WHERE a.course_id = ?
      `).get(student.course_id);
      const courseAverage = courseAvgRow ? courseAvgRow.avgScore : null;

      // Análisis objetivo determinístico
      const analytics = analyzeStudentPerformance(grades, competencies, settings, courseAverage);

      // Intervenciones registradas
      const interventions = db.prepare(`
        SELECT * FROM interventions
        WHERE student_id = ?
        ORDER BY date_recorded DESC
      `).all(studentId);

      // Últimas retroalimentaciones de IA
      const feedbacks = db.prepare(`
        SELECT f.*, 
               r.id as rubric_id, r.relevance_score, r.clarity_score, r.coherence_score,
               r.pedagogical_utility_score, r.data_backing_score, r.appropriate_language_score,
               r.overall_score, r.teacher_comments
        FROM ai_feedbacks f
        LEFT JOIN rubric_evaluations r ON r.feedback_id = f.id
        WHERE f.student_id = ?
        ORDER BY f.generated_at DESC
      `).all(studentId);

      return sendJSON(res, 200, {
        success: true,
        student,
        course,
        grades,
        analytics,
        interventions,
        feedbacks
      });
    }

    // ==========================================
    // 4. CALIFICACIONES Y EVIDENCIAS
    // ==========================================
    if (pathname === '/api/grades' && method === 'POST') {
      const body = await parseBody(req);
      const stmt = db.prepare(`
        INSERT INTO grades (student_id, activity_id, score, observation, evidence_type, evidence_url)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(student_id, activity_id) DO UPDATE SET
          score = excluded.score,
          observation = excluded.observation,
          evidence_type = excluded.evidence_type,
          evidence_url = excluded.evidence_url
      `);
      stmt.run(
        body.student_id,
        body.activity_id,
        body.score,
        body.observation || '',
        body.evidence_type || 'Documento',
        body.evidence_url || ''
      );
      return sendJSON(res, 200, { success: true });
    }

    // ==========================================
    // 5. INTELIGENCIA ARTIFICIAL & RETROALIMENTACIÓN
    // ==========================================
    const aiFeedbackMatch = pathname.match(/^\/api\/ai\/feedback\/(\d+)$/);
    if (aiFeedbackMatch && method === 'POST') {
      const studentId = Number(aiFeedbackMatch[1]);
      const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
      if (!student) return sendJSON(res, 404, { error: 'Estudiante no encontrado' });

      const competencies = db.prepare('SELECT * FROM competencies WHERE course_id = ?').all(student.course_id);
      const settings = loadSettings();

      const grades = db.prepare(`
        SELECT g.*, a.title as activity_title, a.activity_date, a.competency_id,
               c.name as competency_name
        FROM grades g
        JOIN activities a ON g.activity_id = a.id
        LEFT JOIN competencies c ON a.competency_id = c.id
        WHERE g.student_id = ?
        ORDER BY a.activity_date ASC
      `).all(studentId);

      const courseAvgRow = db.prepare(`
        SELECT AVG(g.score) as avgScore
        FROM grades g
        JOIN activities a ON g.activity_id = a.id
        WHERE a.course_id = ?
      `).get(student.course_id);
      const courseAvg = courseAvgRow ? courseAvgRow.avgScore : null;

      const analytics = analyzeStudentPerformance(grades, competencies, settings, courseAvg);

      const observations = grades.map(g => ({
        activity_title: g.activity_title,
        competency_name: g.competency_name,
        score: g.score,
        activity_date: g.activity_date,
        observation: g.observation
      }));

      // Generar con IA
      const feedback = await generateFeedback(student, analytics, observations, settings);

      // Guardar en base de datos
      const saveStmt = db.prepare(`
        INSERT INTO ai_feedbacks (student_id, model_used, summary, pedagogical_interpretation, recommendation, explicability, raw_metrics, scenario_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertRes = saveStmt.run(
        studentId,
        feedback.modelUsed,
        feedback.summary,
        feedback.pedagogicalInterpretation,
        feedback.recommendation,
        feedback.explicability,
        feedback.rawMetrics,
        feedback.scenarioType || 'B_FULL_CONTEXT'
      );

      return sendJSON(res, 200, {
        success: true,
        feedbackId: insertRes.lastInsertRowid,
        feedback
      });
    }

    // Laboratorio Comparativo A/B
    const aiABMatch = pathname.match(/^\/api\/ai\/compare-ab\/(\d+)$/);
    if (aiABMatch && method === 'POST') {
      const studentId = Number(aiABMatch[1]);
      const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
      if (!student) return sendJSON(res, 404, { error: 'Estudiante no encontrado' });

      const competencies = db.prepare('SELECT * FROM competencies WHERE course_id = ?').all(student.course_id);
      const settings = loadSettings();

      const grades = db.prepare(`
        SELECT g.*, a.title as activity_title, a.activity_date, a.competency_id,
               c.name as competency_name
        FROM grades g
        JOIN activities a ON g.activity_id = a.id
        LEFT JOIN competencies c ON a.competency_id = c.id
        WHERE g.student_id = ?
        ORDER BY a.activity_date ASC
      `).all(studentId);

      const analytics = analyzeStudentPerformance(grades, competencies, settings);

      const observations = grades.map(g => ({
        activity_title: g.activity_title,
        competency_name: g.competency_name,
        score: g.score,
        activity_date: g.activity_date,
        observation: g.observation
      }));

      const abComparison = await generateABComparison(student, analytics, observations, settings);

      return sendJSON(res, 200, { success: true, abComparison });
    }

    // ==========================================
    // 6. INTERVENCIONES DOCENTES (CERRAR EL CICLO)
    // ==========================================
    if (pathname === '/api/interventions' && method === 'POST') {
      const body = await parseBody(req);
      const stmt = db.prepare(`
        INSERT INTO interventions (
          student_id, course_id, situation_detected, ai_recommendation_summary,
          teacher_decision, intervention_type, score_before, score_after,
          status, date_recorded, date_evaluated, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        body.student_id,
        body.course_id,
        body.situation_detected,
        body.ai_recommendation_summary || '',
        body.teacher_decision,
        body.intervention_type || 'Taller de refuerzo',
        body.score_before || null,
        body.score_after || null,
        body.status || 'En curso',
        body.date_recorded || new Date().toISOString().slice(0, 10),
        body.date_evaluated || null,
        body.notes || ''
      );
      return sendJSON(res, 201, { success: true, interventionId: result.lastInsertRowid });
    }

    const interventionUpdateMatch = pathname.match(/^\/api\/interventions\/(\d+)$/);
    if (interventionUpdateMatch && method === 'PUT') {
      const interventionId = Number(interventionUpdateMatch[1]);
      const body = await parseBody(req);

      const stmt = db.prepare(`
        UPDATE interventions
        SET score_after = ?,
            date_evaluated = ?,
            status = ?,
            notes = ?
        WHERE id = ?
      `);
      stmt.run(
        body.score_after !== undefined ? body.score_after : null,
        body.date_evaluated || new Date().toISOString().slice(0, 10),
        body.status || 'Superada con éxito',
        body.notes || '',
        interventionId
      );
      return sendJSON(res, 200, { success: true });
    }

    // ==========================================
    // 7. EVALUACIÓN CON RÚBRICA (SECCIÓN 6 DEL BRIEFING)
    // ==========================================
    if (pathname === '/api/rubrics' && method === 'POST') {
      const body = await parseBody(req);

      const p = Number(body.relevance_score) || 5;
      const cl = Number(body.clarity_score) || 5;
      const co = Number(body.coherence_score) || 5;
      const u = Number(body.pedagogical_utility_score) || 5;
      const s = Number(body.data_backing_score) || 5;
      const l = Number(body.appropriate_language_score) || 5;

      const overall = Number(((p + cl + co + u + s + l) / 6).toFixed(2));

      const stmt = db.prepare(`
        INSERT INTO rubric_evaluations (
          feedback_id, student_id, relevance_score, clarity_score, coherence_score,
          pedagogical_utility_score, data_backing_score, appropriate_language_score,
          overall_score, teacher_comments
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        body.feedback_id || null,
        body.student_id,
        p, cl, co, u, s, l,
        overall,
        body.teacher_comments || ''
      );
      return sendJSON(res, 201, { success: true, rubricId: result.lastInsertRowid, overallScore: overall });
    }

    // ==========================================
    // 8. CONFIGURACIÓN DEL SISTEMA
    // ==========================================
    if (pathname === '/api/settings' && method === 'GET') {
      const settings = loadSettings();
      // Ocultar la parte sensible del API Key si existe
      if (settings.gemini_api_key && settings.gemini_api_key.length > 8) {
        settings.gemini_api_key_masked = settings.gemini_api_key.slice(0, 4) + '...' + settings.gemini_api_key.slice(-4);
      }
      return sendJSON(res, 200, { success: true, settings });
    }

    if (pathname === '/api/settings' && method === 'POST') {
      const body = await parseBody(req);
      const updateStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      for (const [k, v] of Object.entries(body)) {
        updateStmt.run(k, JSON.stringify(v));
      }
      return sendJSON(res, 200, { success: true });
    }

    // ==========================================
    // 9. INFORME IMPRIMIBLE DEL ESTUDIANTE
    // ==========================================
    const reportMatch = pathname.match(/^\/api\/reports\/student\/(\d+)$/);
    if (reportMatch && method === 'GET') {
      const studentId = Number(reportMatch[1]);
      const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
      if (!student) return sendJSON(res, 404, { error: 'Estudiante no encontrado' });

      const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(student.course_id);
      const competencies = db.prepare('SELECT * FROM competencies WHERE course_id = ?').all(student.course_id);
      const grades = db.prepare(`
        SELECT g.*, a.title as activity_title, a.activity_date, c.name as competency_name
        FROM grades g
        JOIN activities a ON g.activity_id = a.id
        LEFT JOIN competencies c ON a.competency_id = c.id
        WHERE g.student_id = ?
        ORDER BY a.activity_date ASC
      `).all(studentId);

      const interventions = db.prepare('SELECT * FROM interventions WHERE student_id = ?').all(studentId);
      const lastFeedback = db.prepare('SELECT * FROM ai_feedbacks WHERE student_id = ? ORDER BY generated_at DESC LIMIT 1').get(studentId);
      const lastRubric = lastFeedback ? db.prepare('SELECT * FROM rubric_evaluations WHERE feedback_id = ?').get(lastFeedback.id) : null;
      const settings = loadSettings();
      const analytics = analyzeStudentPerformance(grades, competencies, settings);

      return sendJSON(res, 200, {
        success: true,
        report: {
          projectMeta: {
            title: 'SeguIA - Sistema Inteligente de Seguimiento Académico y Retroalimentación Docente',
            authors: 'Cristóbal Martínez & Jainer Salas',
            motto: 'La IA propone, los datos sustentan y el docente decide.',
            date: new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
          },
          course,
          student,
          grades,
          analytics,
          interventions,
          lastFeedback,
          lastRubric
        }
      });
    }

    // Si no es una ruta de API, servir estáticos
    return serveStatic(req, res, pathname);

  } catch (error) {
    console.error('Error interno del servidor:', error);
    return sendJSON(res, 500, { error: 'Error interno del servidor', message: error.message });
  }
});

// Iniciar servidor si se ejecuta directamente
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` SeguIA - Sistema Inteligente de Seguimiento Académico`);
    console.log(` "La IA propone, los datos sustentan y el docente decide."`);
    console.log(` Autores: Cristóbal Martínez & Jainer Salas`);
    console.log(` Servidor activo en: http://localhost:${PORT}`);
    console.log(`=======================================================`);
  });
}

module.exports = { server, PORT };
