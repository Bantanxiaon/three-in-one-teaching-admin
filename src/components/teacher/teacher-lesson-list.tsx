"use client";

import { CalendarClock, MapPin } from "lucide-react";
import { ClassroomRecordDialog, type TeacherLessonRecord } from "@/components/teacher/classroom-record-dialog";
import type { Locale } from "@/i18n/routing";
import { formatTeachingStatus } from "@/lib/teaching-localization";
import { formatTeachingDateTime } from "@/lib/teaching-time";

export function TeacherLessonList({ locale, lessons, emptyMessage }: { locale: Locale; lessons: TeacherLessonRecord[]; emptyMessage: string }) {
  if (!lessons.length) return <p className="border-y border-piano/[0.06] py-12 text-center text-sm text-piano/40">{emptyMessage}</p>;

  return (
    <ul className="divide-y divide-piano/[0.07] border-y border-piano/[0.07]">
      {lessons.map((lesson) => {
        const startsAt = new Date(lesson.startsAt);
        return (
          <li key={lesson.id} className="grid min-w-0 gap-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="truncate font-semibold">{lesson.studentName}</p>
                <span className="rounded-full bg-piano/[0.06] px-2.5 py-1 text-xs text-piano/60">{formatTeachingStatus(lesson.status, locale)}</span>
                <span className="rounded-full bg-gold/10 px-2.5 py-1 text-xs text-gold">{formatTeachingStatus(lesson.attendance?.status ?? "PENDING", locale)}</span>
              </div>
              <p className="mt-1 truncate text-sm text-piano/55">{lesson.topic}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-piano/42">
                <span className="inline-flex items-center gap-1.5"><CalendarClock size={13} aria-hidden="true" />{formatTeachingDateTime(startsAt, locale)}</span>
                {lesson.classroomName ? <span className="inline-flex items-center gap-1.5"><MapPin size={13} aria-hidden="true" />{lesson.classroomName}</span> : null}
                <span>{lesson.studentNumber}</span>
              </div>
            </div>
            {lesson.status === "CANCELLED" ? <span className="text-sm text-piano/38">{formatTeachingStatus("CANCELLED", locale)}</span> : <ClassroomRecordDialog locale={locale} lesson={lesson} />}
          </li>
        );
      })}
    </ul>
  );
}
