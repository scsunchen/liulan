import { createFileRoute } from "@tanstack/react-router";
import { FlowStage } from "@/components/flow-stage";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <FlowStage />;
}
