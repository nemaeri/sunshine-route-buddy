import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_authenticated/my-children")({ component: MyChildrenPage });

function MyChildrenPage() { return <Placeholder title="My Children" />; }
