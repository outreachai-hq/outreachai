CREATE TABLE IF NOT EXISTS "MeetingPage" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "title"       TEXT NOT NULL DEFAULT 'Book a meeting',
  "description" TEXT,
  "duration"    INTEGER NOT NULL DEFAULT 30,
  "timezone"    TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "weeklyHours" JSONB NOT NULL DEFAULT '{}',
  "bufferMins"  INTEGER NOT NULL DEFAULT 15,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingPage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MeetingPage_userId_key"  ON "MeetingPage"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "MeetingPage_slug_key"    ON "MeetingPage"("slug");
CREATE INDEX        IF NOT EXISTS "MeetingPage_slug_idx"    ON "MeetingPage"("slug");
ALTER TABLE "MeetingPage" ADD CONSTRAINT "MeetingPage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Booking" (
  "id"            TEXT NOT NULL,
  "meetingPageId" TEXT NOT NULL,
  "guestName"     TEXT NOT NULL,
  "guestEmail"    TEXT NOT NULL,
  "startAt"       TIMESTAMP(3) NOT NULL,
  "endAt"         TIMESTAMP(3) NOT NULL,
  "notes"         TEXT,
  "status"        TEXT NOT NULL DEFAULT 'confirmed',
  "cancelToken"   TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Booking_cancelToken_key"           ON "Booking"("cancelToken");
CREATE INDEX        IF NOT EXISTS "Booking_meetingPageId_startAt_idx" ON "Booking"("meetingPageId", "startAt");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_meetingPageId_fkey"
  FOREIGN KEY ("meetingPageId") REFERENCES "MeetingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
