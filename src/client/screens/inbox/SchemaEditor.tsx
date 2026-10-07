import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { SchemaField, ValidationRule } from "../../../shared/types";
import {
  newRule,
  rulesForType,
  ruleSummary,
  type RuleOption,
} from "../../lib/schema-rules";
import { Button } from "../../components/ui/button";
import { Input, fieldControl as baseControl } from "../../components/ui/input";
import { cn } from "../../lib/cn";

const fieldControl = cn(baseControl, "h-10");

function ValueControl({
  label,
  type,
  choices,
  value,
  allowDefault = true,
  onChange,
}: {
  label: string;
  type: RuleOption["type"];
  choices?: string[];
  value: unknown;
  allowDefault?: boolean;
  onChange: (value: string | number | boolean | undefined) => void;
}) {
  if (choices || type === "boolean")
    return (
      <select
        aria-label={label}
        className={fieldControl}
        value={value === undefined ? "__default" : String(value)}
        onChange={(event) =>
          onChange(
            event.target.value === "__default"
              ? undefined
              : type === "boolean"
                ? event.target.value === "true"
                : event.target.value,
          )
        }
      >
        {allowDefault && <option value="__default">Default</option>}
        {(choices ?? ["true", "false"]).map((choice) => (
          <option key={choice} value={choice}>
            {choice === "" ? "No delimiter" : choice}
          </option>
        ))}
      </select>
    );
  return (
    <Input
      aria-label={label}
      type={type === "number" ? "number" : "text"}
      step="any"
      value={value === undefined ? "" : String(value)}
      placeholder={label}
      onChange={(event) =>
        onChange(
          type === "number"
            ? event.target.value === ""
              ? undefined
              : Number(event.target.value)
            : event.target.value,
        )
      }
    />
  );
}

export function SchemaEditor({
  fields,
  onChange,
}: {
  fields: SchemaField[];
  onChange: (fields: SchemaField[]) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  function update(index: number, changes: Partial<SchemaField>) {
    onChange(
      fields.map((field, position) =>
        position === index ? { ...field, ...changes } : field,
      ),
    );
  }
  function updateRule(
    index: number,
    position: number,
    changes: Partial<ValidationRule>,
  ) {
    update(index, {
      rules: fields[index].rules?.map((rule, i) =>
        i === position ? { ...rule, ...changes } : rule,
      ),
    });
  }
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h3 className="m-0 text-sm font-bold">
          Fields{" "}
          <span className="font-normal text-muted">({fields.length})</span>
        </h3>
        <span className="text-xs text-muted">Exact keys sent by your form</span>
      </div>
      {fields.length === 0 && (
        <p className="m-0 rounded-xl border border-dashed border-line-strong p-5 text-sm text-muted">
          Add the fields you want to keep. Everything else is dropped when
          schema enforcement is on.
        </p>
      )}
      {fields.map((field, index) => {
        const open = expanded === index;
        const definitions = rulesForType(field.type);
        return (
          <div
            key={index}
            className="overflow-hidden rounded-xl border border-line bg-surface"
          >
            <div className="flex flex-wrap items-center gap-2 p-3">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${open ? "Collapse" : "Expand"} field ${index + 1}`}
                aria-expanded={open}
                onClick={() => setExpanded(open ? null : index)}
              >
                {open ? <ChevronDown /> : <ChevronRight />}
              </Button>
              <Input
                aria-label={`Field ${index + 1} name`}
                value={field.name}
                placeholder="field_name"
                maxLength={100}
                className="min-w-0 flex-1 basis-28 font-mono text-[13px]"
                onChange={(event) =>
                  update(index, { name: event.target.value })
                }
              />
              <select
                aria-label={`Field ${index + 1} type`}
                className={cn(fieldControl, "w-28")}
                value={field.type}
                onChange={(event) =>
                  update(index, {
                    type: event.target.value as SchemaField["type"],
                    rules: [],
                    values: event.target.value === "enum" ? [""] : undefined,
                  })
                }
              >
                {Object.entries({
                  string: "Text",
                  number: "Number",
                  boolean: "Boolean",
                  enum: "Choices",
                  scalar: "Any value",
                }).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-ink-2">
                <input
                  type="checkbox"
                  checked={Boolean(field.required)}
                  onChange={(event) =>
                    update(index, { required: event.target.checked })
                  }
                />
                Required
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove field ${index + 1}`}
                onClick={() => {
                  onChange(fields.filter((_, i) => i !== index));
                  setExpanded(null);
                }}
              >
                <Trash2 />
              </Button>
              {!open && (
                <button
                  type="button"
                  className="ml-10 w-full cursor-pointer truncate text-left text-xs text-muted"
                  onClick={() => setExpanded(index)}
                >
                  {field.type === "enum"
                    ? `${field.values?.length ?? 0} allowed choices`
                    : field.rules?.length
                      ? field.rules
                          .map((rule) => ruleSummary(field.type, rule))
                          .join(" · ")
                      : "Type checking only · Add validation"}
                </button>
              )}
            </div>
            {open && (
              <div className="grid gap-3 border-t border-line bg-surface-2/40 p-4">
                {field.type === "enum" ? (
                  <>
                    <p className="m-0 text-xs text-muted">
                      Allowed choices are case-sensitive.
                    </p>
                    {(field.values ?? []).map((value, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          aria-label={`Choice ${i + 1}`}
                          value={value}
                          onChange={(event) =>
                            update(index, {
                              values: field.values?.map((v, position) =>
                                position === i ? event.target.value : v,
                              ),
                            })
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove choice ${i + 1}`}
                          onClick={() =>
                            update(index, {
                              values: field.values?.filter(
                                (_, position) => position !== i,
                              ),
                            })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="secondary"
                      className="justify-self-start"
                      onClick={() =>
                        update(index, { values: [...(field.values ?? []), ""] })
                      }
                    >
                      <Plus />
                      Add choice
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-semibold text-ink-2">
                      Validation & transformations{" "}
                      <span className="font-normal text-muted">
                        · run top to bottom
                      </span>
                    </div>
                    {(field.rules ?? []).map((rule, position) => {
                      const definition = definitions.find(
                        (item) => item.check === rule.check,
                      );
                      return (
                        <div key={position} className="grid gap-1 py-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              aria-label={`Validation ${position + 1}`}
                              className={`${fieldControl} min-w-0 flex-1 basis-32`}
                              value={rule.check}
                              onChange={(event) =>
                                updateRule(index, position, {
                                  value: undefined,
                                  options: undefined,
                                  ...newRule(
                                    definitions.find(
                                      (item) =>
                                        item.check === event.target.value,
                                    )!,
                                  ),
                                })
                              }
                            >
                              {definitions.map((item) => (
                                <option key={item.check} value={item.check}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                            {definition?.valueType && (
                              <div className="min-w-0 flex-1 basis-20">
                                <ValueControl
                                  label={`Value for validation ${position + 1}`}
                                  type={definition.valueType}
                                  allowDefault={false}
                                  choices={definition.choices}
                                  value={rule.value}
                                  onChange={(value) =>
                                    updateRule(index, position, { value })
                                  }
                                />
                              </div>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove validation ${position + 1}`}
                              onClick={() =>
                                update(index, {
                                  rules: field.rules?.filter(
                                    (_, i) => i !== position,
                                  ),
                                })
                              }
                            >
                              <Trash2 />
                            </Button>
                          </div>
                          <details className="text-xs text-muted">
                            <summary className="cursor-pointer">
                              Options & error message
                            </summary>
                            <div className="mt-3 grid gap-3">
                              {definition?.options?.map((option) => (
                                <label key={option.key} className="grid gap-1">
                                  {option.label}
                                  <ValueControl
                                    label={option.label}
                                    type={option.type}
                                    choices={option.choices}
                                    value={rule.options?.[option.key]}
                                    onChange={(value) => {
                                      const options = { ...rule.options };
                                      if (value === undefined)
                                        delete options[option.key];
                                      else options[option.key] = value;
                                      updateRule(index, position, { options });
                                    }}
                                  />
                                </label>
                              ))}
                              <Input
                                aria-label={`Error message for validation ${position + 1}`}
                                value={rule.message ?? ""}
                                placeholder="Custom error message (optional)"
                                onChange={(event) =>
                                  updateRule(index, position, {
                                    message: event.target.value || undefined,
                                  })
                                }
                              />
                              <div className="flex gap-2">
                                {[
                                  [-1, "Move up"],
                                  [1, "Move down"],
                                ].map(([delta, label]) => (
                                  <Button
                                    key={label}
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={
                                      position + Number(delta) < 0 ||
                                      position + Number(delta) >=
                                        (field.rules?.length ?? 0)
                                    }
                                    onClick={() => {
                                      const rules = [...(field.rules ?? [])];
                                      [
                                        rules[position],
                                        rules[position + Number(delta)],
                                      ] = [
                                        rules[position + Number(delta)],
                                        rules[position],
                                      ];
                                      update(index, { rules });
                                    }}
                                  >
                                    {delta === -1 ? <ArrowUp /> : <ArrowDown />}
                                    {label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </details>
                        </div>
                      );
                    })}
                    {definitions.length > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="justify-self-start"
                        onClick={() =>
                          update(index, {
                            rules: [
                              ...(field.rules ?? []),
                              newRule(definitions[0]),
                            ],
                          })
                        }
                      >
                        <Plus />
                        Add validation
                      </Button>
                    )}
                    {field.type === "scalar" && (
                      <p className="m-0 text-xs text-muted">
                        Accepts text, numbers, booleans, or null. Nested values
                        and files are not supported.
                      </p>
                    )}
                  </>
                )}
                {!field.required && (
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={Boolean(field.nullable)}
                      onChange={(event) =>
                        update(index, { nullable: event.target.checked })
                      }
                    />
                    Allow null for this optional field
                  </label>
                )}
              </div>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        variant="secondary"
        className="justify-self-start"
        disabled={fields.length >= 50}
        onClick={() => {
          setExpanded(fields.length);
          onChange([...fields, { name: "", type: "string", rules: [] }]);
        }}
      >
        <Plus />
        Add field
      </Button>
      <p className="m-0 text-xs leading-relaxed text-muted">
        Regex uses safe RE2 syntax (no lookarounds or backreferences). Use
        “Disallow characters” for a simpler alternative.
      </p>
    </div>
  );
}
