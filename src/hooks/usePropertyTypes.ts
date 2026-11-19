import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const DEFAULT_TYPES: string[] = [
  'Apartment',
  'Penthouse',
  'Luxury Apartment',
  'Duplex',
  'Smart Home',
  'Villa',
  'Townhouse',
  'Commercial',
];

interface PropertyTypesSettingValue {
  types?: unknown;
}

function extractTypesList(val: unknown): string[] | null {
  if (!val || typeof val !== 'object') return null;
  const raw = (val as PropertyTypesSettingValue).types;
  if (!Array.isArray(raw)) return null;
  const cleaned = raw.filter((item): item is string => typeof item === 'string');
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * usePropertyTypes
 * Subscribes to the Supabase settings table (key='property_types') in real time.
 * Returns { types, loading } — types is always sorted alphabetically.
 */
export function usePropertyTypes(): { types: string[]; loading: boolean } {
  const [types, setTypes] = useState<string[]>(DEFAULT_TYPES);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTypes = async (): Promise<void> => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'property_types')
        .single();

      const fetched = extractTypesList(data?.value);
      if (fetched) {
        setTypes([...fetched].sort());
      } else {
        await supabase
          .from('settings')
          .upsert({ key: 'property_types', value: { types: DEFAULT_TYPES } });
        setTypes(DEFAULT_TYPES);
      }
      setLoading(false);
    };

    void fetchTypes();

    const sub = supabase
      .channel('property_types_setting')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'settings',
          filter: 'key=eq.property_types',
        },
        (payload) => {
          const nextRow = payload.new as { value?: unknown } | null | undefined;
          const t = extractTypesList(nextRow?.value);
          if (t) setTypes([...t].sort());
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(sub);
    };
  }, []);

  return { types, loading };
}

/**
 * addPropertyType — adds a new type to Supabase settings.
 * Returns the updated array.
 */
export async function addPropertyType(
  newType: string,
  currentTypes: string[]
): Promise<string[]> {
  const updated = [...new Set([...currentTypes, newType.trim()])].sort();
  await supabase
    .from('settings')
    .upsert({ key: 'property_types', value: { types: updated } });
  return updated;
}

/**
 * removePropertyType — removes a type from Supabase settings.
 */
export async function removePropertyType(
  typeToRemove: string,
  currentTypes: string[]
): Promise<string[]> {
  const updated = currentTypes.filter((t) => t !== typeToRemove);
  await supabase
    .from('settings')
    .upsert({ key: 'property_types', value: { types: updated } });
  return updated;
}
