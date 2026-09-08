import { permanentRedirect } from "next/navigation";

export default function QuestionsPage() {
  permanentRedirect("/library#submit-question");
}
