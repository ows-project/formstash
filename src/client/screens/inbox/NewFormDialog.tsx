import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { api } from "../../api";
import { errorMessage } from "../../lib/format";
import { useForms } from "../../components/FormsProvider";
import { Button } from "../../components/ui/button";
import { Callout } from "../../components/ui/callout";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader } from "../../components/ui/dialog";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";

export function NewFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { refreshForms } = useForms();
  const [, navigate] = useLocation();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const created = await api<{ id: string }>("/api/forms", { method: "POST", body: JSON.stringify({ name: data.get("name") }) });
      await refreshForms();
      onOpenChange(false);
      navigate(`/forms/${created.id}`);
      toast.success("Form created");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setError(""); onOpenChange(next); }}>
      <DialogContent size="sm">
        <form onSubmit={create} className="contents">
          <DialogHeader title="New form" description="Each form gets its own endpoint and inbox." />
          <DialogBody className="grid gap-4">
            <Field label="Form name">
              <Input name="name" autoFocus placeholder="Contact form" maxLength={80} required />
            </Field>
            {error && <Callout tone="danger">{error}</Callout>}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
            <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create form"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
