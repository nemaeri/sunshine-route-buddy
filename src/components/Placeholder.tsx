import { PageHeader, Card } from "@/components/PageHeader";
import { Sparkles } from "lucide-react";

export function Placeholder({
  title,
  description,
  note,
}: {
  title: string;
  description?: string;
  note?: string;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card className="p-10 text-center">
        <div className="mx-auto size-12 rounded-full bg-brand-gold/10 text-brand-gold flex items-center justify-center mb-4">
          <Sparkles className="size-6" />
        </div>
        <h3 className="font-display font-bold text-lg mb-1">Module scaffolded</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {note ?? "This page is ready to be built out. Ask to implement it next and we'll wire it to the database."}
        </p>
      </Card>
    </>
  );
}
