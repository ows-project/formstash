ALTER TABLE forms ADD COLUMN schema_json TEXT NOT NULL DEFAULT '[]';

-- Preserve existing strict forms as optional scalar fields. New forms
-- still default to accepting all fields; fields_json remains display metadata.
UPDATE forms SET schema_json = (
  SELECT json_group_array(json_object('name', value, 'type', 'scalar'))
  FROM json_each(forms.fields_json)
) WHERE strict_fields = 1;
