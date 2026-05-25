"use client";
import { useState } from "react";
import Link from "next/link";

export interface CourseEntry {
  slug: string;
  title: string;
  num: string;
  readingTimeMin: number;
}

interface Props {
  courses: CourseEntry[];
  topic: string;
  topicLabel: string;
}

export default function CourseList({ courses, topic, topicLabel }: Props) {
  const [query, setQuery] = useState("");
  const filtered = query.trim()
    ? courses.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
    : courses;

  return (
    <div>
      {courses.length > 3 && (
        <div style={{ padding: "0 0 12px" }}>
          <input
            type="search"
            placeholder="Search courses…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              background: "var(--surface)",
              color: "inherit",
              fontSize: "0.9rem",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}

      {filtered.length === 0 && query && (
        <p style={{ color: "var(--muted)", padding: "12px 0" }}>
          No courses match &ldquo;{query}&rdquo;
        </p>
      )}

      {filtered.map((course) => (
        <Link
          key={course.slug}
          href={`/courseware/${topic}/${course.slug}`}
          className="kb-source-row"
          style={{ textDecoration: "none" }}
        >
          <div>
            <div className="kb-source-title">{course.title}</div>
            <div className="kb-source-author">
              Course {course.num}&ensp;&middot;&ensp;{topicLabel}&ensp;&middot;&ensp;~{course.readingTimeMin} min read
            </div>
          </div>
          <div className="kb-source-type">Course</div>
          <div><span className="kb-badge course_generated">generated</span></div>
          <div className="kb-source-author" style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.72rem" }}>
            {course.slug}
          </div>
        </Link>
      ))}
    </div>
  );
}
