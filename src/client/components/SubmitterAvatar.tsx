import type { Submission } from "../../shared/types";
import { avatarGradient } from "../lib/avatar";
import { cn } from "../lib/cn";
import { initials } from "../lib/format";

const sizes = { md: "size-9 text-xs", lg: "size-13 text-base" };

export function SubmitterAvatar({ submission, size = "md" }: { submission: Submission; size?: keyof typeof sizes }) {
  const seed = String(submission.payload.email ?? submission.payload.name ?? submission.id);
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center rounded-full font-bold tracking-wide text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]", sizes[size], submission.status === "spam" && "opacity-55 grayscale")}
      style={{ backgroundImage: avatarGradient(seed) }}
    >
      {initials(submission)}
    </span>
  );
}
