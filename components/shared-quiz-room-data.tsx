"use client";
import { useEffect, useSyncExternalStore, type ComponentProps } from "react";
import { SharedQuizRoom } from "@/components/shared-quiz-room";
import { getGroupCache, getEmptyGroupCache, subscribeGroupCache, watchGroup } from "@/lib/shared-group-cache";
import { hydrateSharedQuizQuestions } from "@/lib/shared-quiz";
export function SharedQuizRoomData(props: ComponentProps<typeof SharedQuizRoom>) {
  const cached = useSyncExternalStore(subscribeGroupCache, () => getGroupCache(props.groupId), getEmptyGroupCache);
  useEffect(() => watchGroup(props.groupId, props.session.status === "active"), [props.groupId, props.session.status]);
  const identities = new Map(cached.members?.map((member) => [member.userId, member]));
  const participants = props.participants.map((item) => ({ ...item, ...(identities.get(item.userId) ? { avatarUrl: identities.get(item.userId)!.avatarUrl, level: identities.get(item.userId)!.level, displayName: identities.get(item.userId)!.displayName } : {}) }));
  const standings = props.standings.map((item) => ({ ...item, ...(identities.get(item.userId) ? { avatarUrl: identities.get(item.userId)!.avatarUrl, level: identities.get(item.userId)!.level, displayName: identities.get(item.userId)!.displayName } : {}) }));
  const questions = props.session.status === "active" ? hydrateSharedQuizQuestions(props.session.questions, cached.photos?.entries.map((entry) => entry.memory) ?? []) : [];
  if (cached.forbidden || cached.error) return <p role="alert" className="auth-notice auth-notice--error mt-7">{cached.error}</p>;
  if (props.session.status === "active" && !cached.photos) return null;
  return <SharedQuizRoom {...props} participants={participants} standings={standings} questions={questions} />;
}
