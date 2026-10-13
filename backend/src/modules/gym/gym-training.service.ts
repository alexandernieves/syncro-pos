import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { memberInBranch } from './gym-branch';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const MUSCLE_GROUPS = ['CHEST', 'BACK', 'LEGS', 'GLUTES', 'SHOULDERS', 'ARMS', 'CORE', 'CARDIO', 'FULL_BODY'];
const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

/** Starter library, loaded the first time a gym opens the exercises. */
const STARTER_EXERCISES: [string, string, string, string][] = [
  ['Press de banca', 'CHEST', 'Barra y banco', 'Acostado en el banco, baja la barra al pecho con control y empuja hasta extender los brazos sin bloquear los codos.'],
  ['Press inclinado con mancuernas', 'CHEST', 'Mancuernas y banco inclinado', 'Banco a 30–45°. Baja las mancuernas a los lados del pecho y súbelas juntándolas arriba.'],
  ['Aperturas con mancuernas', 'CHEST', 'Mancuernas y banco', 'Brazos casi rectos, abre hasta sentir el estiramiento del pecho y cierra en arco.'],
  ['Fondos en paralelas', 'CHEST', 'Paralelas', 'Inclina el torso hacia adelante y baja hasta 90° de codo.'],
  ['Flexiones de pecho', 'CHEST', 'Peso corporal', 'Cuerpo recto de cabeza a talones; baja el pecho al suelo y empuja.'],
  ['Dominadas', 'BACK', 'Barra fija', 'Agarre más ancho que los hombros; sube hasta pasar la barbilla y baja completo.'],
  ['Jalón al pecho', 'BACK', 'Polea alta', 'Tira de la barra hacia la parte alta del pecho llevando los codos abajo y atrás.'],
  ['Remo con barra', 'BACK', 'Barra', 'Torso inclinado y espalda neutra; lleva la barra al abdomen apretando la espalda.'],
  ['Remo con mancuerna', 'BACK', 'Mancuerna y banco', 'Apoya una mano y una rodilla en el banco; sube la mancuerna hacia la cadera.'],
  ['Remo sentado en polea', 'BACK', 'Polea baja', 'Pecho alto, tira del agarre hacia el abdomen y vuelve estirando los brazos.'],
  ['Peso muerto', 'BACK', 'Barra', 'Barra pegada a las piernas, espalda neutra; empuja el suelo con los pies y extiende la cadera.'],
  ['Sentadilla con barra', 'LEGS', 'Barra y rack', 'Barra en la espalda alta; baja con la espalda recta hasta que los muslos queden paralelos al suelo.'],
  ['Prensa de piernas', 'LEGS', 'Máquina de prensa', 'Pies al ancho de hombros; baja hasta 90° de rodilla y empuja sin bloquear.'],
  ['Zancadas', 'LEGS', 'Mancuernas', 'Da un paso largo y baja hasta que ambas rodillas formen 90°; alterna piernas.'],
  ['Extensión de cuádriceps', 'LEGS', 'Máquina', 'Extiende las piernas por completo y baja controlando.'],
  ['Curl femoral', 'LEGS', 'Máquina', 'Flexiona las rodillas llevando los talones hacia los glúteos.'],
  ['Elevación de talones', 'LEGS', 'Máquina o escalón', 'Sube en puntas de pie lo más alto posible y baja estirando la pantorrilla.'],
  ['Hip thrust', 'GLUTES', 'Barra y banco', 'Espalda alta apoyada en el banco; sube la cadera hasta alinearla con el torso y aprieta los glúteos.'],
  ['Patada de glúteo en polea', 'GLUTES', 'Polea baja', 'Lleva la pierna hacia atrás con la rodilla casi recta, sin arquear la espalda.'],
  ['Abducción de cadera', 'GLUTES', 'Máquina', 'Abre las piernas contra la resistencia y vuelve despacio.'],
  ['Press militar', 'SHOULDERS', 'Barra o mancuernas', 'De pie o sentado; empuja el peso sobre la cabeza sin arquear la espalda.'],
  ['Elevaciones laterales', 'SHOULDERS', 'Mancuernas', 'Sube los brazos a los lados hasta la altura de los hombros con los codos un poco flexionados.'],
  ['Pájaros (deltoide posterior)', 'SHOULDERS', 'Mancuernas', 'Torso inclinado; abre los brazos hacia los lados apretando la espalda alta.'],
  ['Face pull', 'SHOULDERS', 'Polea con cuerda', 'Tira de la cuerda hacia la cara separando las manos.'],
  ['Curl de bíceps con barra', 'ARMS', 'Barra', 'Codos pegados al cuerpo; sube la barra sin balancear.'],
  ['Curl martillo', 'ARMS', 'Mancuernas', 'Palmas mirándose; flexiona los codos alternando.'],
  ['Extensión de tríceps en polea', 'ARMS', 'Polea alta', 'Codos fijos a los lados; extiende los brazos hacia abajo.'],
  ['Press francés', 'ARMS', 'Barra Z y banco', 'Acostado, baja la barra hacia la frente doblando solo los codos.'],
  ['Plancha', 'CORE', 'Peso corporal', 'Antebrazos y puntas de pie; mantén el cuerpo recto apretando abdomen y glúteos.'],
  ['Crunch abdominal', 'CORE', 'Colchoneta', 'Sube los hombros del suelo contrayendo el abdomen, sin tirar del cuello.'],
  ['Elevación de piernas colgado', 'CORE', 'Barra fija', 'Colgado de la barra, sube las piernas sin balancearte.'],
  ['Russian twist', 'CORE', 'Disco o balón', 'Sentado con el torso inclinado, gira de un lado a otro.'],
  ['Caminadora', 'CARDIO', 'Caminadora', 'Camina o trota a ritmo constante o por intervalos.'],
  ['Bicicleta estática', 'CARDIO', 'Bicicleta', 'Pedalea a ritmo constante; ajusta la resistencia según el objetivo.'],
  ['Elíptica', 'CARDIO', 'Elíptica', 'Movimiento continuo de brazos y piernas, sin impacto.'],
  ['Remo (máquina)', 'CARDIO', 'Remo', 'Empuja con las piernas, luego tira con la espalda y los brazos.'],
  ['Burpees', 'FULL_BODY', 'Peso corporal', 'Agáchate, lleva los pies atrás, haz una flexión, vuelve y salta.'],
  ['Kettlebell swing', 'FULL_BODY', 'Kettlebell', 'Impulsa la pesa con la cadera hasta la altura del pecho, espalda recta.'],
  ['Saltos al cajón', 'FULL_BODY', 'Cajón pliométrico', 'Salta con ambos pies al cajón y baja con control.'],
  ['Thruster', 'FULL_BODY', 'Barra o mancuernas', 'Sentadilla frontal y, al subir, empuja el peso sobre la cabeza en un solo movimiento.'],
];

type DayInput = { name?: string; exercises?: { exerciseId?: string; name?: string; sets?: number; reps?: string; weight?: string; restSec?: number; notes?: string }[] };
type RoutineInput = { name?: string; goal?: string | null; level?: string; description?: string | null; trainerId?: string | null; days?: DayInput[]; startsAt?: string | null; endsAt?: string | null; isActive?: boolean };
type AssessmentInput = Partial<Record<'weightKg' | 'heightCm' | 'bodyFatPct' | 'muscleMassKg' | 'waistCm' | 'hipCm' | 'chestCm' | 'armCm' | 'thighCm' | 'restingHr', number | null>> & {
  date?: string;
  bloodPressure?: string | null;
  notes?: string | null;
  trainerId?: string | null;
  photos?: string[];
};

const day = (v?: string | null) => {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : new Date(v);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Fecha inválida');
  return d;
};

/** Exercise library, routines (templates and the copies assigned to members), workouts and body assessments. */
@Injectable()
export class GymTrainingService {
  constructor(private prisma: PrismaService) {}

  // ── Exercises ──────────────────────────────────────────────────────────────

  async listExercises(businessId: string) {
    if (!(await this.prisma.gymExercise.count({ where: { businessId } }))) {
      await this.prisma.gymExercise.createMany({ data: STARTER_EXERCISES.map(([name, muscleGroup, equipment, instructions]) => ({ businessId, name, muscleGroup, equipment, instructions })) });
    }
    return this.prisma.gymExercise.findMany({ where: { businessId }, orderBy: [{ isActive: 'desc' }, { muscleGroup: 'asc' }, { name: 'asc' }] });
  }

  async saveExercise(businessId: string, id: string | null, d: { name?: string; muscleGroup?: string; equipment?: string | null; instructions?: string | null; videoUrl?: string | null; imageUrl?: string | null; isActive?: boolean }) {
    if (d.muscleGroup !== undefined && !MUSCLE_GROUPS.includes(d.muscleGroup)) throw new BadRequestException('Grupo muscular inválido');
    if ((!id || d.name !== undefined) && !d.name?.trim()) throw new BadRequestException('Escribe el nombre del ejercicio');
    if (d.videoUrl && !/^https?:\/\//.test(d.videoUrl)) throw new BadRequestException('El video debe ser un enlace (https://…)');
    const data = {
      ...(d.name !== undefined && { name: d.name.trim() }),
      ...(d.muscleGroup !== undefined && { muscleGroup: d.muscleGroup }),
      ...(d.equipment !== undefined && { equipment: d.equipment?.trim() || null }),
      ...(d.instructions !== undefined && { instructions: d.instructions?.trim() || null }),
      ...(d.videoUrl !== undefined && { videoUrl: d.videoUrl?.trim() || null }),
      ...(d.imageUrl !== undefined && { imageUrl: d.imageUrl || null }),
      ...(d.isActive !== undefined && { isActive: !!d.isActive }),
    };
    if (!id) {
      if (!d.muscleGroup) throw new BadRequestException('Elige el grupo muscular');
      return this.prisma.gymExercise.create({ data: { businessId, name: d.name!.trim(), muscleGroup: d.muscleGroup, ...data } });
    }
    if (!(await this.prisma.gymExercise.findFirst({ where: { id, businessId } }))) throw new NotFoundException('Ejercicio no encontrado');
    return this.prisma.gymExercise.update({ where: { id }, data });
  }

  // ── Routines ───────────────────────────────────────────────────────────────

  private cleanDays(days: DayInput[] | undefined) {
    if (!Array.isArray(days) || !days.length) throw new BadRequestException('Agrega al menos un día a la rutina');
    if (days.length > 7) throw new BadRequestException('Una rutina tiene como máximo 7 días');
    return days.map((dd, i) => {
      const exercises = (dd.exercises || []).filter((x) => x.name?.trim());
      if (!exercises.length) throw new BadRequestException(`El día ${i + 1} no tiene ejercicios`);
      return {
        name: dd.name?.trim() || `Día ${i + 1}`,
        exercises: exercises.map((x) => ({
          exerciseId: x.exerciseId || null,
          name: x.name!.trim(),
          sets: Math.max(1, Math.min(20, Math.round(Number(x.sets) || 3))),
          reps: String(x.reps ?? '10').trim().slice(0, 20) || '10',
          weight: x.weight ? String(x.weight).trim().slice(0, 20) : '',
          restSec: Math.max(0, Math.min(600, Math.round(Number(x.restSec) || 60))),
          notes: x.notes?.trim().slice(0, 200) || '',
        })),
      };
    });
  }

  private routineData(d: RoutineInput, partial = false) {
    if (d.level !== undefined && !LEVELS.includes(d.level)) throw new BadRequestException('Nivel inválido');
    if ((!partial || d.name !== undefined) && !d.name?.trim()) throw new BadRequestException('Escribe el nombre de la rutina');
    return {
      ...(d.name !== undefined && { name: d.name.trim() }),
      ...(d.goal !== undefined && { goal: d.goal?.trim() || null }),
      ...(d.level !== undefined && { level: d.level }),
      ...(d.description !== undefined && { description: d.description?.trim() || null }),
      ...(d.trainerId !== undefined && { trainerId: d.trainerId || null }),
      ...((!partial || d.days !== undefined) && { days: this.cleanDays(d.days) as unknown as Prisma.InputJsonValue }),
      ...(d.startsAt !== undefined && { startsAt: day(d.startsAt) }),
      ...(d.endsAt !== undefined && { endsAt: day(d.endsAt) }),
      ...(d.isActive !== undefined && { isActive: !!d.isActive }),
    };
  }

  listTemplates(businessId: string) {
    return this.prisma.gymRoutine.findMany({
      where: { businessId, memberId: null },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { trainer: { select: { id: true, name: true } } },
    }).then(async (rows) => {
      const assigned = await this.prisma.gymRoutine.groupBy({ by: ['templateId'], where: { businessId, memberId: { not: null }, isActive: true, templateId: { in: rows.map((r) => r.id) } }, _count: { _all: true } });
      return rows.map((r) => ({ ...r, assignedCount: assigned.find((a) => a.templateId === r.id)?._count._all ?? 0 }));
    });
  }

  createTemplate(businessId: string, d: RoutineInput) {
    return this.prisma.gymRoutine.create({ data: { businessId, ...(this.routineData(d) as any) } });
  }

  async updateRoutine(businessId: string, id: string, d: RoutineInput) {
    if (!(await this.prisma.gymRoutine.findFirst({ where: { id, businessId } }))) throw new NotFoundException('Rutina no encontrada');
    return this.prisma.gymRoutine.update({ where: { id }, data: this.routineData(d, true) as any });
  }

  /** Gives a member their own copy of a template (or a routine written for them). Their previous one is archived. */
  async assign(businessId: string, memberId: string, d: RoutineInput & { templateId?: string }) {
    const member = await this.prisma.gymMember.findFirst({ where: { id: memberId, businessId } });
    if (!member) throw new NotFoundException('Socio no encontrado');
    let base: RoutineInput = d;
    if (d.templateId) {
      const t = await this.prisma.gymRoutine.findFirst({ where: { id: d.templateId, businessId, memberId: null } });
      if (!t) throw new NotFoundException('Rutina no encontrada');
      base = { name: t.name, goal: t.goal, level: t.level, description: t.description, days: t.days as any, trainerId: d.trainerId ?? t.trainerId, ...(d.days && { days: d.days }) };
    }
    const data = this.routineData({ ...base, startsAt: d.startsAt ?? new Date().toISOString(), endsAt: d.endsAt ?? null });
    return this.prisma.$transaction(async (tx) => {
      await tx.gymRoutine.updateMany({ where: { businessId, memberId, isActive: true }, data: { isActive: false } });
      return tx.gymRoutine.create({ data: { businessId, memberId, templateId: d.templateId || null, ...(data as any) } });
    });
  }

  async memberTraining(businessId: string, memberId: string) {
    const [routines, logs] = await Promise.all([
      this.prisma.gymRoutine.findMany({ where: { businessId, memberId }, orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }], take: 10, include: { trainer: { select: { id: true, name: true } } } }),
      this.prisma.gymWorkoutLog.findMany({ where: { businessId, memberId }, orderBy: { doneAt: 'desc' }, take: 30 }),
    ]);
    const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    return { current: routines.find((r) => r.isActive) ?? null, previous: routines.filter((r) => !r.isActive), logs, workoutsLast4Weeks: logs.filter((l) => l.doneAt >= since).length };
  }

  async logWorkout(businessId: string, memberId: string, d: { routineId?: string; dayIndex?: number; entries?: any[]; notes?: string }) {
    let dayName: string | null = null;
    if (d.routineId) {
      const r = await this.prisma.gymRoutine.findFirst({ where: { id: d.routineId, businessId, memberId } });
      if (!r) throw new NotFoundException('Rutina no encontrada');
      const days = r.days as any[];
      dayName = Number.isInteger(d.dayIndex) && days[d.dayIndex!] ? days[d.dayIndex!].name : null;
    }
    const entries = Array.isArray(d.entries)
      ? d.entries.slice(0, 30).map((e) => ({ exerciseId: e.exerciseId || null, name: String(e.name || '').slice(0, 80), sets: (Array.isArray(e.sets) ? e.sets : []).slice(0, 20).map((s: any) => ({ reps: Math.max(0, Math.round(Number(s.reps) || 0)), weight: Math.max(0, Number(s.weight) || 0) })) }))
      : undefined;
    return this.prisma.gymWorkoutLog.create({ data: { businessId, memberId, routineId: d.routineId || null, dayIndex: Number.isInteger(d.dayIndex) ? d.dayIndex : null, dayName, entries: entries as any, notes: d.notes?.trim() || null } });
  }

  // ── Assessments ────────────────────────────────────────────────────────────

  private assessmentData(d: AssessmentInput) {
    const num = (v: any, min: number, max: number) => (v === undefined ? undefined : v === null || v === '' ? null : Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max ? Math.round(Number(v) * 10) / 10 : (() => { throw new BadRequestException('Revisa las medidas: hay un valor fuera de rango'); })());
    const fields = { weightKg: [20, 400], heightCm: [80, 250], bodyFatPct: [2, 70], muscleMassKg: [5, 150], waistCm: [30, 250], hipCm: [30, 250], chestCm: [30, 250], armCm: [10, 80], thighCm: [20, 120] } as const;
    const out: any = {};
    for (const [k, [min, max]] of Object.entries(fields)) { const v = num((d as any)[k], min, max); if (v !== undefined) out[k] = v; }
    if (d.restingHr !== undefined) out.restingHr = d.restingHr === null ? null : Math.round(Number(num(d.restingHr, 30, 220)));
    if (d.bloodPressure !== undefined) out.bloodPressure = d.bloodPressure?.trim() || null;
    if (d.notes !== undefined) out.notes = d.notes?.trim() || null;
    if (d.trainerId !== undefined) out.trainerId = d.trainerId || null;
    if (d.photos !== undefined) out.photos = (d.photos || []).filter((p) => typeof p === 'string').slice(0, 6);
    if (d.date !== undefined) out.date = day(d.date);
    return out;
  }

  async assessments(businessId: string, memberId: string) {
    const rows = await this.prisma.gymAssessment.findMany({ where: { businessId, memberId }, orderBy: { date: 'asc' }, include: { trainer: { select: { name: true } } } });
    const withBmi = rows.map((r) => ({ ...r, bmi: r.weightKg && r.heightCm ? Math.round((r.weightKg / (r.heightCm / 100) ** 2) * 10) / 10 : null }));
    const first = withBmi[0];
    const last = withBmi[withBmi.length - 1];
    const delta = (k: 'weightKg' | 'bodyFatPct' | 'waistCm' | 'muscleMassKg') => (first && last && first !== last && first[k] != null && last[k] != null ? Math.round((last[k]! - first[k]!) * 10) / 10 : null);
    return { items: withBmi, change: { weightKg: delta('weightKg'), bodyFatPct: delta('bodyFatPct'), waistCm: delta('waistCm'), muscleMassKg: delta('muscleMassKg') } };
  }

  async addAssessment(businessId: string, memberId: string, d: AssessmentInput) {
    if (!(await this.prisma.gymMember.findFirst({ where: { id: memberId, businessId } }))) throw new NotFoundException('Socio no encontrado');
    const data = this.assessmentData(d);
    if (!Object.keys(data).some((k) => !['date', 'notes', 'trainerId', 'photos'].includes(k) && data[k] != null)) throw new BadRequestException('Anota al menos una medida');
    // Height rarely changes: reuse the last one so the BMI keeps working
    if (data.heightCm === undefined) {
      const prev = await this.prisma.gymAssessment.findFirst({ where: { memberId, heightCm: { not: null } }, orderBy: { date: 'desc' }, select: { heightCm: true } });
      if (prev?.heightCm) data.heightCm = prev.heightCm;
    }
    return this.prisma.gymAssessment.create({ data: { businessId, memberId, ...data } });
  }

  async updateAssessment(businessId: string, id: string, d: AssessmentInput) {
    if (!(await this.prisma.gymAssessment.findFirst({ where: { id, businessId } }))) throw new NotFoundException('Evaluación no encontrada');
    return this.prisma.gymAssessment.update({ where: { id }, data: this.assessmentData(d) });
  }

  async deleteAssessment(businessId: string, id: string) {
    if (!(await this.prisma.gymAssessment.findFirst({ where: { id, businessId } }))) throw new NotFoundException('Evaluación no encontrada');
    await this.prisma.gymAssessment.delete({ where: { id } });
    return { deleted: true };
  }

  /** Recent assessments across the gym (for the training page). */
  recentAssessments(businessId: string) {
    return this.prisma.gymAssessment.findMany({
      where: { businessId, ...memberInBranch() },
      orderBy: { date: 'desc' },
      take: 100,
      include: { member: { select: { id: true, memberNumber: true, photoUrl: true, client: { select: { name: true } } } }, trainer: { select: { name: true } } },
    });
  }
}
