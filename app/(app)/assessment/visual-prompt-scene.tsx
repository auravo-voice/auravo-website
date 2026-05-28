import Image from "next/image";

const IMAGE_PATH = "/assessment/visual-prompt-scene.png";

const IMAGE_ALT =
  "Black and white street photograph: an older man in the foreground looks at his phone; three younger women farther back also look at their phones in front of a shop window with mannequins.";

/**
 * Fixed photograph for the visual-description segment of the initial assessment.
 * Served from `public/assessment/visual-prompt-scene.png`.
 */
export function VisualPromptScene({ className }: { className?: string }) {
  return (
    <Image
      src={IMAGE_PATH}
      alt={IMAGE_ALT}
      width={1024}
      height={695}
      className={className}
      priority
      sizes="(max-width: 640px) 100vw, 320px"
    />
  );
}
