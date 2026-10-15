import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { lessonFeedbackSchema } from "@/lib/validators";

type LessonFeedbackClient = Pick<PrismaClient, "teacherProfile" | "lesson" | "lessonFeedback">;
type LessonFeedbackInput = z.input<typeof lessonFeedbackSchema>;

export async function saveLessonFeedback(
  payload: LessonFeedbackInput,
  actorId: string,
  client: LessonFeedbackClient = prisma
) {
  const input = lessonFeedbackSchema.parse(payload);
  if (!input.focus && !input.feedback && !input.homework && !input.videoUrl) {
    return { saved: false as const };
  }

  const teacher = await client.teacherProfile.findUniqueOrThrow({
    where: { userId: actorId },
    select: { id: true }
  });
  const lesson = await client.lesson.findFirst({
    where: { id: input.lessonId, teacherId: teacher.id },
    select: { studentId: true, teacherId: true }
  });
  if (!lesson) {
    throw new ApiError("LESSON_NOT_OWNED", "Teachers can only save feedback for their own lessons.", 403);
  }

  const feedback = await client.lessonFeedback.upsert({
    where: { lessonId: input.lessonId },
    update: {
      studentId: lesson.studentId,
      teacherId: lesson.teacherId,
      focus: input.focus,
      feedback: input.feedback,
      homework: input.homework,
      videoUrl: input.videoUrl
    },
    create: {
      lessonId: input.lessonId,
      studentId: lesson.studentId,
      teacherId: lesson.teacherId,
      focus: input.focus,
      feedback: input.feedback,
      homework: input.homework,
      videoUrl: input.videoUrl
    }
  });
  return { saved: true as const, feedback };
}
