CREATE TABLE "UserSportProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "favoriteSport" TEXT,
    "level" TEXT,
    "preferredFormat" TEXT,
    "preferredLocation" TEXT,
    "maxParticipants" INTEGER,
    "preferredTime" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSportProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "EventRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sportType" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "preferredDate" DATETIME,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "userId" TEXT NOT NULL,
    CONSTRAINT "EventRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "EventReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "recommend" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "bookingId" TEXT,
    CONSTRAINT "EventReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EventReview_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "EventDemandVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "comment" TEXT,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    CONSTRAINT "EventDemandVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EventDemandVote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserSportProfile_userId_key" ON "UserSportProfile"("userId");
CREATE INDEX "EventRequest_status_createdAt_idx" ON "EventRequest"("status", "createdAt");
CREATE INDEX "EventRequest_userId_createdAt_idx" ON "EventRequest"("userId", "createdAt");
CREATE UNIQUE INDEX "EventReview_userId_eventId_key" ON "EventReview"("userId", "eventId");
CREATE INDEX "EventReview_eventId_createdAt_idx" ON "EventReview"("eventId", "createdAt");
CREATE UNIQUE INDEX "EventDemandVote_userId_eventId_type_key" ON "EventDemandVote"("userId", "eventId", "type");
CREATE INDEX "EventDemandVote_eventId_type_idx" ON "EventDemandVote"("eventId", "type");
CREATE INDEX "EventDemandVote_userId_createdAt_idx" ON "EventDemandVote"("userId", "createdAt");
