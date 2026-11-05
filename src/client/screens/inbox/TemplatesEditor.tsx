import { useId } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { EmailTemplate, TemplateVariable } from "../../../shared/types";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Input, fieldControl } from "../../components/ui/input";
import { SwitchRow } from "../../components/ui/switch";
import { cn } from "../../lib/cn";

/** A template being edited; new templates have no id until saved. */
export type TemplateDraft = Omit<EmailTemplate, "id"> & { id?: string };

interface TemplatesEditorProps {
  templates: TemplateDraft[];
  onChange: (templates: TemplateDraft[]) => void;
  /** Known submission fields, suggested for field variables. */
  fields: string[];
}

export function TemplatesEditor({ templates, onChange, fields }: TemplatesEditorProps) {
  const listId = useId();
  const update = (index: number, change: Partial<TemplateDraft>) =>
    onChange(templates.map((template, position) => position === index ? { ...template, ...change } : template));
  const updateVariable = (index: number, position: number, change: Partial<TemplateVariable>) =>
    update(index, { variables: templates[index].variables.map((variable, i) => i === position ? { ...variable, ...change } : variable) });

  return (
    <div className="grid gap-3">
      <datalist id={listId}>{fields.map((field) => <option key={field} value={field} />)}</datalist>
      {templates.length === 0 && (
        <p className="m-0 rounded-xl border border-dashed border-line-strong p-5 text-sm text-muted">
          No templates yet. Add one for each email you send from Resend, such as a confirmation or an update to everyone who signed up.
        </p>
      )}
      {templates.map((template, index) => (
        <section key={template.id ?? `new-${index}`} className="grid gap-4 rounded-xl border border-line bg-surface p-4" aria-label={template.name || `Template ${index + 1}`}>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <Field label="Name">
              <Input value={template.name} maxLength={80} placeholder="Confirmation" onChange={(event) => update(index, { name: event.target.value })} />
            </Field>
            <Field label="Resend template">
              <Input value={template.resendTemplate} placeholder="ID or alias" className="font-mono text-[13px]" onChange={(event) => update(index, { resendTemplate: event.target.value })} />
            </Field>
            <Button type="button" variant="ghost" size="icon" aria-label={`Delete template ${template.name || index + 1}`} onClick={() => onChange(templates.filter((_, position) => position !== index))}>
              <Trash2 />
            </Button>
          </div>
          <SwitchRow
            checked={template.autoSend}
            onCheckedChange={(autoSend) => update(index, { autoSend })}
            label="Send automatically"
            description="Email the submitter as soon as a submission arrives."
          />
          <div className="grid gap-2">
            <p className="m-0 text-[13px] font-semibold text-ink-2">Variables</p>
            {template.variables.length === 0 && (
              <p className="m-0 text-xs text-muted">Every submission field is already sent under its own name. Add variables to rename a field or to fill in a value yourself.</p>
            )}
            {template.variables.map((variable, position) => (
              <div key={position} className="grid grid-cols-[minmax(0,1fr)_7.5rem_minmax(0,1.3fr)_auto] gap-2">
                <Input aria-label="Variable name" value={variable.key} placeholder="LINK" className="font-mono text-[13px]" onChange={(event) => updateVariable(index, position, { key: event.target.value })} />
                <select
                  aria-label="Variable source"
                  className={cn(fieldControl, "h-10")}
                  value={variable.source}
                  onChange={(event) => updateVariable(index, position, { source: event.target.value as TemplateVariable["source"], value: "" })}
                >
                  <option value="field">From field</option>
                  <option value="manual">Manual</option>
                </select>
                {variable.source === "field" ? (
                  <Input aria-label="Submission field" list={listId} value={variable.value} placeholder="email" className="font-mono text-[13px]" onChange={(event) => updateVariable(index, position, { value: event.target.value })} />
                ) : (
                  <Input aria-label="Default value" value={variable.value} placeholder="Default, editable when sending" onChange={(event) => updateVariable(index, position, { value: event.target.value })} />
                )}
                <Button type="button" variant="ghost" size="icon" aria-label="Remove variable" onClick={() => update(index, { variables: template.variables.filter((_, i) => i !== position) })}>
                  <X />
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" className="justify-self-start" onClick={() => update(index, { variables: [...template.variables, { key: "", source: "manual", value: "" }] })}>
              <Plus /> Add variable
            </Button>
          </div>
        </section>
      ))}
      <Button
        type="button"
        variant="secondary"
        className="justify-self-start"
        onClick={() => onChange([...templates, { name: "", resendTemplate: "", variables: [], autoSend: false }])}
      >
        <Plus /> Add template
      </Button>
    </div>
  );
}
