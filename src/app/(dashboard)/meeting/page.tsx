'use client';

import TeamMeeting from '@/components/meeting/TeamMeeting';

export default function MeetingPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Team Meeting</h1>
      </div>
      <div className="flex-1 min-h-0">
        <TeamMeeting />
      </div>
    </div>
  );
}
