import type { Metadata } from "next";
import { WordleGame } from "@/components/wordle/wordle-game";

export const metadata: Metadata = {
  title: "Auravo Wordle",
  description: "Daily five-letter vocabulary challenge for communication practice.",
};

export default function WordlePage() {
  return <WordleGame />;
}
